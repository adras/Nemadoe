# NEMADEO waitlist backend

ASP.NET Core 8 minimal API for the landing-page waitlist. Signups are saved
in `waitlist.json` (not committed), and the `/waitlist/count` endpoint returns
the **actual** number of stored entries. Duplicate signups do not resend email.
The existing encrypted `resend.key`/`keys/` scheme remains compatible.

## Run

Requires .NET 8 SDK (or newer SDK capable of targeting net8.0).

```sh
cd weblaunch/backend
dotnet restore
dotnet run
```

**One-time Resend key setup (before starting the server):**

```sh
# Linux/macOS
export RESEND_API_KEY='re_your_real_key'
dotnet run -- --init-key
unset RESEND_API_KEY

# PowerShell
$env:RESEND_API_KEY='re_your_real_key'
dotnet run -- --init-key
Remove-Item Env:RESEND_API_KEY
```

There is intentionally **no HTTP `/init-key` route**. Never expose key
initialization over the internet. Old encrypted credentials stay readable
provided `./keys` and `./resend.key` are preserved.

Set `AllowedOrigin` in `appsettings.json` to the landing page's origin.
The application must have write access to its working directory for
`keys/`, `resend.key`, and `waitlist.json`. Back up those files securely.
`waitlist.json` contains personal email addresses: protect its file permissions
and follow your privacy/deletion obligations. It should not be publicly served.

## Endpoints

- `POST /waitlist` with `{ "email": "name@example.com" }`: validates,
  checks duplicates, sends an owner notification, and persists after delivery.
- `GET /waitlist/count`: `{ "count": 42 }` based on the stored signup list.

The server rate limits signups to 5 attempts per remote IP per hour (429),
escapes email addresses in notification HTML, and times out Resend calls.
In a deployment **behind a reverse proxy**, configure ASP.NET Core forwarded
headers **for explicitly trusted proxies** before relying on `RemoteIpAddress`
for per-client limits. Otherwise all signups may share the proxy's IP.

**Limitations:** This is a single-process/file-backed list, not a distributed
waitlist. It doesn't implement email ownership confirmation or double opt-in;
those require a verified sender domain and confirmation workflow. Existing
signups from earlier versions were not stored and cannot be reconstructed.
The default `onboarding@resend.dev` Resend sender may have account-specific
recipient limitations; configure a verified sending domain for production.
