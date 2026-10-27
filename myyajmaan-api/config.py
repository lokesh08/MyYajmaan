"""
Central place for third-party integration settings.

Everything is read from environment variables (loaded from
myyajmaan-api/.env locally -- git-ignored -- and from real
environment variables once deployed), so nothing sensitive is ever
written into code or shipped to the browser. See .env.example for the
full list and what each value is.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _get(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _get_bool(name: str, default: bool = False) -> bool:
    raw = _get(name)
    if not raw:
        return default
    return raw.lower() in ("1", "true", "yes", "on")


def _get_int(name: str, default: int) -> int:
    try:
        return int(_get(name) or default)
    except ValueError:
        return default


# ---- Razorpay ------------------------------------------------------
# Key ID is public (the browser needs it to open Checkout); the key
# secret must stay on the server -- it verifies every payment.
RAZORPAY_KEY_ID = _get("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = _get("RAZORPAY_KEY_SECRET")
RAZORPAY_MERCHANT_NAME = _get("RAZORPAY_MERCHANT_NAME", "MyYajmaan")


# LOCAL TESTING ONLY: fakes the Razorpay order and payment so the
# booking flow can be exercised without any Razorpay account/keys. No
# money moves and nothing is verified by Razorpay. Ignored whenever
# COOKIE_SECURE=true (a real HTTPS deployment).
RAZORPAY_MOCK_MODE = _get_bool("RAZORPAY_MOCK_MODE", False)


def razorpay_configured() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


# ---- Aadhaar e-KYC (Pandit Ji onboarding) ---------------------------
# LOCAL TESTING ONLY: no licensed UIDAI provider is wired up yet, so
# Aadhaar OTP send/verify is simulated -- see routers/pandit_aadhar.py.
# Same guard as OTP_DEV_MODE/RAZORPAY_MOCK_MODE below: even if this is
# left "true" in a deployment's environment by mistake, a real
# (COOKIE_SECURE=true) deployment still won't echo OTPs back in the
# API response.
AADHAR_MOCK_MODE_RAW = _get_bool("AADHAR_MOCK_MODE", True)


def aadhar_mock_active() -> bool:
    # COOKIE_SECURE is defined further down; resolved at call time.
    return AADHAR_MOCK_MODE_RAW and not COOKIE_SECURE


def razorpay_mock_active() -> bool:
    # COOKIE_SECURE is defined further down; resolved at call time.
    return RAZORPAY_MOCK_MODE and not COOKIE_SECURE


# ---- Signup OTP (email + phone verification) -----------------------
OTP_LENGTH = 6
OTP_TTL_SECONDS = _get_int("OTP_TTL_SECONDS", 15 * 60)
OTP_RESEND_COOLDOWN_SECONDS = _get_int("OTP_RESEND_COOLDOWN_SECONDS", 30)
OTP_MAX_ATTEMPTS = _get_int("OTP_MAX_ATTEMPTS", 5)
# Max OTP sends per channel + destination within an hour (abuse guard).
OTP_MAX_SENDS_PER_HOUR = _get_int("OTP_MAX_SENDS_PER_HOUR", 5)

# Secret used to hash stored OTPs. Falls back to the service-role key
# (already server-only) so nothing extra is required locally, but set a
# dedicated value in production.
OTP_HASH_SECRET = _get("OTP_HASH_SECRET") or _get("SUPABASE_SERVICE_ROLE_KEY") or "dev-only-otp-secret"

# True on a real HTTPS deployment; used to force OTP_DEV_MODE off there.
COOKIE_SECURE = _get_bool("COOKIE_SECURE", False)

# LOCAL DEV ONLY: when true, no email/SMS is sent -- the OTP is printed
# to the API console and returned in the send-otp response so the flow
# can be tested without real providers. MUST be false in production.
OTP_DEV_MODE = _get_bool("OTP_DEV_MODE", False)

# Email OTP -- any SMTP server (Gmail app password, Brevo, SES SMTP, ...)
SMTP_HOST = _get("SMTP_HOST")
SMTP_PORT = _get_int("SMTP_PORT", 587)
SMTP_USERNAME = _get("SMTP_USERNAME")
SMTP_PASSWORD = _get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = _get("SMTP_FROM_EMAIL") or SMTP_USERNAME
SMTP_FROM_NAME = _get("SMTP_FROM_NAME", "MyYajmaan")
SMTP_USE_TLS = _get_bool("SMTP_USE_TLS", True)

# Phone OTP -- MSG91 (India, DLT-friendly). The template must be approved.
SMS_PROVIDER = _get("SMS_PROVIDER", "msg91").lower()
MSG91_AUTH_KEY = _get("MSG91_AUTH_KEY")
MSG91_TEMPLATE_ID = _get("MSG91_TEMPLATE_ID")
SMS_DEFAULT_COUNTRY_CODE = _get("SMS_DEFAULT_COUNTRY_CODE", "91")


def email_otp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_FROM_EMAIL)


def sms_otp_configured() -> bool:
    return bool(MSG91_AUTH_KEY and MSG91_TEMPLATE_ID)


# ---- Login brute-force protection -----------------------------------
# Applies to both /auth/login and /admin/auth/login (one shared choke
# point, see routers/auth.py's supabase_password_login). Two
# independent limits:
#   - per email:  stops repeated guessing against one account.
#   - per IP:     stops one source hammering many different accounts.
# The per-IP limit is deliberately looser -- shared/NAT'd IPs (offices,
# campuses) are common, and this only needs to blunt automation, not
# match the tight per-account limit.
LOGIN_MAX_FAILED_ATTEMPTS = _get_int("LOGIN_MAX_FAILED_ATTEMPTS", 5)
LOGIN_MAX_FAILED_ATTEMPTS_PER_IP = _get_int("LOGIN_MAX_FAILED_ATTEMPTS_PER_IP", 20)
LOGIN_LOCKOUT_WINDOW_MINUTES = _get_int("LOGIN_LOCKOUT_WINDOW_MINUTES", 15)


# ---- SEO ------------------------------------------------------------
# Public web address of the front-end (no trailing slash). Used to build
# the absolute URLs in /sitemap-dynamic.xml. Defaults to the first allowed
# front-end origin, which is right for local development.
PUBLIC_SITE_URL = _get("PUBLIC_SITE_URL") or (_get("FRONTEND_ORIGINS").split(",")[0].strip())

# List approved Pandit Ji profile pages in the sitemap. Set false to keep
# individual profiles out of the sitemap while leaving the pages reachable.
SITEMAP_INCLUDE_PANDITS = _get_bool("SITEMAP_INCLUDE_PANDITS", True)
