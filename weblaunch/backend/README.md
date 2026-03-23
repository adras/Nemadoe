# NEMADEO Waitlist Backend

Minimales ASP.NET Minimal API Backend für die Waitlist.
Der Resend API Key wird **verschlüsselt auf der Festplatte** gespeichert (ASP.NET Data Protection).
Er steht nie im Source Code und nie dauerhaft in der Umgebungsvariable.

## Setup (einmalig)

```bash
# 1. Projekt anlegen (falls noch nicht vorhanden)
dotnet new web -n NemadeoBackend
# Program.cs + appsettings.json aus diesem Ordner reinkopieren

# 2. Key temporär als Env-Variable setzen
export RESEND_API_KEY=re_deinEchterKey   # Linux/macOS
$env:RESEND_API_KEY="re_deinEchterKey"   # Windows PowerShell

# 3. App starten
dotnet run

# 4. Key einmalig verschlüsseln (einmal aufrufen, dann nie wieder nötig)
curl -X POST http://localhost:5000/init-key

# ✅ Ab jetzt ist der Key verschlüsselt in ./resend.key gespeichert.
# Die Env-Variable wurde automatisch gecleart.
# /init-key kann jetzt aus Program.cs entfernt werden.
```

## Flow

```
Browser → POST /waitlist { email }
       → Key aus ./resend.key entschlüsseln (Data Protection)
       → Resend API aufrufen
       → 200 OK
```

## Sicherheit

- `resend.key` niemals committen → .gitignore eintragen
- `./keys/` (Data Protection Keys) ebenfalls in .gitignore
- `/init-key` Endpoint nach Setup aus dem Code entfernen
- `AllowedOrigin` in appsettings.json auf deine Domain setzen
