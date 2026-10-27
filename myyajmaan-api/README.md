# MyYajmaan FastAPI backend

FastAPI backend for MyYajmaan: auth, bookings, payments, Pandit Ji management,
admin panel, CMS, OTP verification, and more, on top of Supabase/Postgres.

See [`../README.md`](../README.md) for the React frontend, which calls this API.

## Stack

FastAPI, Supabase (Postgres + Auth + Storage, run locally via the Supabase CLI),
Razorpay (payments), SMTP + MSG91 (email/SMS OTP), bleach (CMS HTML sanitising).

## Getting started

1. **Start local Supabase** (from the repo root, not this folder):
   ```
   npx supabase start
   ```
   This runs Postgres, Auth, Storage, etc. in Docker and applies the migrations
   in `supabase/migrations/`. Leave it running in the background.

2. **Copy `.env.example` to `.env`** and fill in the values:
   ```
   copy .env.example .env
   ```
   - `SUPABASE_URL` for local Supabase is `http://127.0.0.1:54321`.
   - `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` come from
     `npx supabase status` (run from the repo root). Keep the service role key secret.
   - Everything else (Razorpay, SMTP, MSG91, encryption keys) can stay blank for
     local development - see **Optional integrations** below for what each one
     unlocks and its local mock/dev mode.

3. **Create and activate a virtual environment:**

   Windows (PowerShell)
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
   macOS/Linux
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```

4. **Install dependencies:**
   ```
   pip install -r requirements.txt
   ```

5. **Run the API:**
   ```
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   `--reload` restarts the process on file changes. The frontend's
   `VITE_API_BASE_URL` should point at this address (`http://127.0.0.1:8000` by
   default). API docs are served at `/docs`.

6. **Create the admin login** (one-off, idempotent):
   ```
   python scripts/create_admin_user.py
   ```
   Creates `admin@gmail.com` / `admin1234` as the admin account. **Local dev
   only** - change the password from Admin → Settings before this ever touches
   a real deployment.

## Optional integrations

These all have a local dev/mock mode so the app runs fully without real
credentials. Fill them in in `.env` when you need the real behaviour; see the
comments in `.env.example` for exact keys.

| Integration | Env vars | Local dev mode |
| --- | --- | --- |
| **Razorpay** (payments) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_MERCHANT_NAME` | `RAZORPAY_MOCK_MODE=true` fakes the order/payment flow with no real keys needed |
| **Email OTP** (SMTP) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `SMTP_USE_TLS` | `OTP_DEV_MODE=true` skips sending; the code is printed to this API's console and shown on the verify screen |
| **Phone OTP** (MSG91) | `SMS_PROVIDER`, `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `SMS_DEFAULT_COUNTRY_CODE` | Same `OTP_DEV_MODE=true` switch as above; needs an approved DLT OTP template in production |
| **Aadhaar verification** | `AADHAR_ENCRYPTION_KEY` | `AADHAR_MOCK_MODE=true` skips real verification |

`OTP_DEV_MODE` and the mock-mode flags are automatically ignored once
`COOKIE_SECURE=true` (i.e. in production), so they can't accidentally ship live.

## Architecture notes

- **Routers** (`routers/`) are grouped by audience: public (`pandits.py`,
  `pujas.py`, `public_settings.py`, `cms.py`'s public half, ...), authenticated
  user/pandit (`bookings.py`, `client_*.py`, `pandit_*.py`), and admin-only
  (`admin_*.py`, `admin_settings.py`, `cms.py`'s admin half). Admin routes use
  the `require_admin_roles()` dependency; user/pandit routes use
  `require_roles(...)`.
- **Generic settings store** (`app_settings.py`) backs the Admin → Settings
  screen (pricing, booking lead time, invoice/GST details, Pandit Ji
  registration rules, social media links) - a simple key/value table, read
  with `get_setting()` / written with `set_setting()`. Public-facing values are
  re-exposed unauthenticated through `routers/public_settings.py`.
- **CMS** (`routers/cms.py`) stores editable copy (policy pages, the booking
  journey, benefits cards) as versioned rows, sanitised with `bleach` before
  save. Read publicly via `GET /cms/{key}`, edited via `/admin/cms/{key}`.
- **Security**: `security_middleware.py` enforces a CSRF header
  (`X-Requested-With: XMLHttpRequest`) on every unsafe request, cookie-based
  Supabase auth (`routers/auth.py`), login rate limiting, and an audit log
  (`audit.py`) for admin actions.
- **Payments**: `payments.py` + `payment_verification.py` keep a server-side
  ledger of verified Razorpay payments so a booking can never be confirmed
  from a client-supplied amount alone.

## Tests

```
pytest
```
Covers payments/OTP, coupons, referrals & muhurats, login history, login rate
limiting + wallet top-up, and general security hardening (`tests/`).

## Production checklist

- Set real `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for the hosted project.
- Set `COOKIE_SECURE=true` (this also disables every local dev/mock mode above).
- Fill in real Razorpay, SMTP, and MSG91 credentials.
- Set `PUBLIC_SITE_URL` to the real public site address (used for
  `/sitemap-dynamic.xml`).
- Change the seeded admin password.
