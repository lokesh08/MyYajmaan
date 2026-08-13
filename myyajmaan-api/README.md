# MyYajmaan FastAPI backend (local dev)

Quick start:

1. Copy `.env.example` to `.env` and fill values (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
   - For local Supabase, SUPABASE_URL is `http://127.0.0.1:54321`.
   - Get the service role key from `npx supabase status` (Secret). Keep it secret.

2. Create & activate virtual environment:

Windows (PowerShell)
```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1