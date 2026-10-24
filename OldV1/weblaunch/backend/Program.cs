using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;

bool initKeyOnly = args.Contains("--init-key", StringComparer.Ordinal);
string[] webArgs = args.Where(arg => arg != "--init-key").ToArray();
WebApplicationBuilder builder = WebApplication.CreateBuilder(webArgs);

// Data Protection keeps the encrypted Resend credential compatible with v1.1.
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("./keys"))
    .SetApplicationName("NemadeoWaitlist");

string allowedOrigin = builder.Configuration["AllowedOrigin"] ?? "https://nemadeo.online";
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigin).WithMethods("GET", "POST").AllowAnyHeader()));

builder.Services.AddHttpClient("resend", client =>
    client.Timeout = TimeSpan.FromSeconds(15));

// Five attempted registrations per IP per hour. A reverse proxy must be
// configured to forward the real client IP through trusted middleware.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("signup", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
                AutoReplenishment = true
            }));
});

WebApplication app = builder.Build();

// One-time offline initialization: `dotnet run -- --init-key`.
// This command never binds a public HTTP endpoint.
if (initKeyOnly)
{
    string? raw = Environment.GetEnvironmentVariable("RESEND_API_KEY");
    if (string.IsNullOrWhiteSpace(raw))
        throw new InvalidOperationException("RESEND_API_KEY is missing.");

    IDataProtectionProvider dp = app.Services.GetRequiredService<IDataProtectionProvider>();
    IDataProtector protector = dp.CreateProtector("ResendApiKey");
    File.WriteAllText("./resend.key", protector.Protect(raw));
    Console.WriteLine("Encrypted key saved to ./resend.key. Clear RESEND_API_KEY in your shell.");
    return;
}

app.UseRouting();
app.UseCors();
app.UseRateLimiter();

string waitlistPath = Path.Combine(app.Environment.ContentRootPath, "waitlist.json");
SemaphoreSlim registrationLock = new(1, 1);
HashSet<string> registered = File.Exists(waitlistPath)
    ? new HashSet<string>(
        JsonSerializer.Deserialize<string[]>(File.ReadAllText(waitlistPath))
            ?? throw new InvalidDataException("waitlist.json is not an array."),
        StringComparer.OrdinalIgnoreCase)
    : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

app.MapGet("/waitlist/count", async () =>
{
    await registrationLock.WaitAsync();
    try { return Results.Ok(new { count = registered.Count }); }
    finally { registrationLock.Release(); }
});

app.MapPost("/waitlist", async Task<IResult> (
    WaitlistRequest? request,
    IDataProtectionProvider dpProvider,
    IHttpClientFactory httpFactory,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    string email = (request?.Email ?? "").Trim();
    if (!IsValidEmail(email))
        return Results.BadRequest(new { error = "Invalid email address." });

    await registrationLock.WaitAsync(cancellationToken);
    try
    {
        // Same answer for a repeat signup, without another external email.
        if (registered.Contains(email))
            return Results.Ok(new { success = true, count = registered.Count });

        string apiKey;
        try
        {
            IDataProtector protector = dpProvider.CreateProtector("ResendApiKey");
            apiKey = protector.Unprotect(File.ReadAllText("./resend.key").Trim());
        }
        catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException || ex is System.Security.Cryptography.CryptographicException)
        {
            logger.LogError(ex, "Cannot load encrypted Resend credential");
            return Results.Problem("Waitlist service unavailable.", statusCode: 503);
        }

        try
        {
            HttpClient client = httpFactory.CreateClient("resend");
            using HttpRequestMessage message = new(HttpMethod.Post, "https://api.resend.com/emails");
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            message.Content = JsonContent.Create(new
            {
                from = "NEMADEO Waitlist <onboarding@resend.dev>",
                to = new[] { "contact@nirin.online" },
                subject = "New NEMADEO waitlist signup",
                html = "<p>New waitlist signup:</p><p><strong>" + WebUtility.HtmlEncode(email) + "</strong></p>"
            });
            using HttpResponseMessage response = await client.SendAsync(message, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Resend returned status {StatusCode}", response.StatusCode);
                return Results.Problem("Signup delivery failed. Try again later.", statusCode: 502);
            }
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Resend network error");
            return Results.Problem("Signup delivery failed. Try again later.", statusCode: 502);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Resend timed out");
            return Results.Problem("Signup delivery timed out. Try again later.", statusCode: 504);
        }

        // Write atomically, so interrupted writes cannot corrupt the list.
        registered.Add(email);
        string temp = waitlistPath + ".tmp";
        try
        {
            File.WriteAllText(temp, JsonSerializer.Serialize(registered.OrderBy(e => e).ToArray()));
            File.Move(temp, waitlistPath, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException || ex is UnauthorizedAccessException)
        {
            registered.Remove(email);
            logger.LogError(ex, "Cannot persist waitlist signup");
            return Results.Problem("Signup could not be stored.", statusCode: 503);
        }
        return Results.Ok(new { success = true, count = registered.Count });
    }
    finally { registrationLock.Release(); }
}).RequireRateLimiting("signup");

app.Run();

static bool IsValidEmail(string email)
{
    if (email.Length < 5 || email.Length > 254) return false;
    return Regex.IsMatch(email,
        @"\A[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+\z",
        RegexOptions.CultureInvariant,
        TimeSpan.FromMilliseconds(100));
}

record WaitlistRequest(string? Email);
