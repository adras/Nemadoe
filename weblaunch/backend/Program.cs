using Microsoft.AspNetCore.DataProtection;
using Resend;

var builder = WebApplication.CreateBuilder(args);

// Data Protection — keys werden automatisch in ./keys/ gespeichert
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("./keys"))
    .SetApplicationName("NemadeoWaitlist");

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(builder.Configuration["AllowedOrigin"] ?? "*")
     .AllowAnyMethod()
     .AllowAnyHeader()));

builder.Services.AddHttpClient();
var app = builder.Build();
app.UseCors();

// ── Hilfsmethode: Key aus verschlüsselter Datei lesen ──────────────────────
static string LoadResendKey(IDataProtector protector)
{
    const string path = "./resend.key";
    if (!File.Exists(path))
        throw new FileNotFoundException("resend.key nicht gefunden. Bitte init-key aufrufen.");

    var cipher = File.ReadAllText(path).Trim();
    return protector.Unprotect(cipher);
}

// ── POST /init-key  (einmalig, danach deaktivieren oder löschen!) ──────────
// Liest RESEND_API_KEY aus der Umgebung und speichert ihn verschlüsselt.
app.MapPost("/init-key", (IDataProtectionProvider dpProvider, IConfiguration config) =>
{
    var raw = Environment.GetEnvironmentVariable("RESEND_API_KEY")
              ?? throw new InvalidOperationException("Env-Variable RESEND_API_KEY nicht gesetzt.");

    var protector = dpProvider.CreateProtector("ResendApiKey");
    var cipher    = protector.Protect(raw);
    File.WriteAllText("./resend.key", cipher);

    // Key sofort aus der Umgebung entfernen
    Environment.SetEnvironmentVariable("RESEND_API_KEY", null);

    return Results.Ok("Key verschlüsselt gespeichert. Env-Variable wurde gecleart.");
})
.WithName("InitKey");

// ── POST /waitlist ─────────────────────────────────────────────────────────
app.MapPost("/waitlist", async (WaitlistRequest req, IDataProtectionProvider dpProvider, IHttpClientFactory httpFactory) =>
{
    if (string.IsNullOrWhiteSpace(req.Email) || !req.Email.Contains('@'))
        return Results.BadRequest("Ungültige E-Mail-Adresse.");

    string apiKey;
    try
    {
        var protector = dpProvider.CreateProtector("ResendApiKey");
        apiKey = LoadResendKey(protector);
    }
    catch (Exception ex)
    {
        return Results.Problem("Key konnte nicht geladen werden: " + ex.Message);
    }

    var client = httpFactory.CreateClient();
    var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
    {
        Headers = { { "Authorization", $"Bearer {apiKey}" } },
        Content = JsonContent.Create(new
        {
            from    = "NEMADEO Waitlist <onboarding@resend.dev>",
            to      = new[] { "contact@nirin.online" },
            subject = $"New waitlist signup: {req.Email}",
            html    = $"<p>New signup on the NEMADEO waitlist:</p><p><strong>{req.Email}</strong></p>"
        })
    });

    return response.IsSuccessStatusCode
        ? Results.Ok("Erfolgreich eingetragen.")
        : Results.Problem("Resend API Fehler: " + await response.Content.ReadAsStringAsync());
});

app.Run();

record WaitlistRequest(string Email);
