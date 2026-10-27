# Deploying MyYajmaan

Three pieces: **Supabase Cloud** (database/auth/storage), **Render** (FastAPI
backend), **Vercel** (React frontend). Your domain (`myyajmaan.com`) stays
registered at GoDaddy — it's only used for DNS, pointing at Vercel and Render.

Steps marked **[you]** need your own account/login and can't be done for you.
Steps marked **[me]** I can run once you've handed me what the step before it
produced (a project ref, a URL, an API key).

---

## 1. Supabase Cloud (database, auth, storage)

1. **[you]** Sign up at [supabase.com](https://supabase.com), create a new
   project (pick a region close to your users — Mumbai/Singapore for India).
   Save the **database password** you're asked to set; you won't see it again.
2. **[you]** From the project's Settings → API page, copy three values and
   send them to me: **Project URL**, **anon public key**, **service_role
   key** (service_role is secret — treat it like a password).
3. **[me]** Push the local schema (100 migrations) to the new project:
   ```
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
4. **[you]** In Supabase Studio → Storage, create a new bucket named
   `images`, set it **public**. (Not covered by a migration — it was created
   by hand in local dev too.)
5. **[me]** Run `scripts/create_admin_user.py` against the Cloud project
   (with a real password this time, not `admin1234`) to seed your first
   admin login.

## 2. Render (FastAPI backend)

1. **[you]** Sign up at [render.com](https://render.com), connect your
   GitHub account, and give Render access to this repo.
2. **[you]** New → Blueprint, point it at this repo. Render reads
   `render.yaml` at the repo root and proposes the `myyajmaan-api` web
   service automatically (Docker runtime, `myyajmaan-api/` as root dir).
3. **[you]** Before the first deploy, fill in the env vars marked
   `sync: false` in `render.yaml` — these are secrets and were deliberately
   left out of the file (which is committed to git). In the Render
   dashboard, for each one:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` — from
     step 1.2 above.
   - `BANK_DETAILS_ENCRYPTION_KEY`, `AADHAR_ENCRYPTION_KEY`,
     `OTP_HASH_SECRET` — three separate random values. Generate each with:
     ```
     python -c "import secrets; print(secrets.token_urlsafe(32))"
     ```
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — from your Razorpay
     dashboard (switch from Test to Live mode keys when you're ready to
     take real payments).
   - `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` —
     your email provider's SMTP credentials.
   - `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID` — from your MSG91 account (needs
     an approved DLT OTP template for India).
4. **[you]** Deploy. Render builds the Dockerfile and gives you a URL like
   `https://myyajmaan-api.onrender.com` — send it to me.
5. **[me]** Sanity-check the deployed API (`GET /`, `GET /docs`, a login
   attempt) once it's live.

## 3. Vercel (React frontend)

1. **[you]** Sign up at [vercel.com](https://vercel.com), connect GitHub,
   import this repo. Vercel auto-detects Vite; `vercel.json` at the repo
   root handles the SPA routing fallback.
2. **[you]** In the project's Settings → Environment Variables, add:
   - `VITE_API_BASE_URL` = the Render URL from step 2.4
   - `VITE_SITE_URL` = `https://www.myyajmaan.com`
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` = from step 1.2 (only
     needed if the app uses direct Supabase Storage uploads from the
     browser — harmless to set either way)
3. **[you]** Deploy. Vercel gives you a URL like
   `https://myyajmaan.vercel.app` to confirm it works before wiring the
   real domain.

## 4. Domain (GoDaddy DNS → Vercel + Render)

1. **[you]** In Vercel's project → Settings → Domains, add `myyajmaan.com`
   and `www.myyajmaan.com`. Vercel shows you the exact DNS records to add
   (usually an `A` record for the apex domain and a `CNAME` for `www`).
2. **[you]** In GoDaddy's DNS management for `myyajmaan.com`, add those
   records exactly as Vercel shows them. DNS changes can take anywhere from
   a few minutes to a few hours to propagate.
3. **[you]** (Optional but recommended) Point a subdomain at the backend
   too, e.g. `api.myyajmaan.com` → Render, via the CNAME Render gives you
   under its own custom-domain settings. Then update `VITE_API_BASE_URL` on
   Vercel to `https://api.myyajmaan.com` instead of the `.onrender.com` URL.

## 5. Final env var sync (both sides need to agree on the real domain)

Once the domain is live, two values need to point at the *final* URLs, not
the placeholder `.onrender.com`/`.vercel.app` ones:

- On **Render**: `FRONTEND_ORIGINS=https://www.myyajmaan.com,https://myyajmaan.com`
  (already set this way in `render.yaml` — double-check it matches your real
  domain) and `PUBLIC_SITE_URL=https://www.myyajmaan.com`.
- On **Vercel**: `VITE_API_BASE_URL` and `VITE_SITE_URL` as above.

## 6. Post-launch checklist

- [ ] `COOKIE_SECURE=true` on Render (already set in `render.yaml`) — this
      also auto-disables every local dev/mock mode (OTP_DEV_MODE,
      RAZORPAY_MOCK_MODE, AADHAR_MOCK_MODE), so confirm real Razorpay/SMTP/
      MSG91 credentials are in place *before* this goes live, or those
      flows will fail outright instead of falling back to mock behavior.
- [ ] Log in as the seeded admin (step 1.5), immediately change the
      password from Admin → Settings.
- [ ] Place one real test booking end-to-end (signup → OTP → book → pay)
      with Razorpay in Live mode.
- [ ] Set Razorpay's webhook URL (if you use one) to the Render domain.
- [ ] Re-run `npm run build && npm run check:seo` locally against the real
      `VITE_SITE_URL` to confirm sitemap/canonical URLs are correct.
