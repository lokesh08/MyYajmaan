"""
Signup OTP generation, storage and delivery (email + phone).

Providers are configured entirely through config.py / environment
variables -- see .env.example:

  - Email: any SMTP server (SMTP_HOST / SMTP_PORT / SMTP_USERNAME / ...)
  - Phone: MSG91 (MSG91_AUTH_KEY / MSG91_TEMPLATE_ID)

For local testing without real providers set OTP_DEV_MODE=true: the
code is printed to the API console and returned to the caller instead
of being sent. That switch is ignored whenever COOKIE_SECURE=true
(i.e. a real HTTPS deployment) so it cannot leak OTPs in production.
"""

import asyncio
import hashlib
import hmac
import logging
import re
import secrets
import smtplib
import string
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Optional

import httpx

import config
from db import service_supabase

logger = logging.getLogger(__name__)

CHANNELS = ("email", "phone")

MSG91_OTP_URL = "https://control.msg91.com/api/v5/otp"


class OtpError(Exception):
    """A user-presentable OTP failure (never a stack trace)."""

    def __init__(self, code: str, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retry_after = retry_after


def dev_mode_active() -> bool:
    return config.OTP_DEV_MODE and not config.COOKIE_SECURE


def normalize_phone(phone: str) -> str:
    """Digits only, with the default country code added to a bare 10-digit number."""

    digits = re.sub(r"\D", "", phone or "")
    digits = digits.lstrip("0") if len(digits) > 10 else digits
    if len(digits) == 10:
        return f"{config.SMS_DEFAULT_COUNTRY_CODE}{digits}"
    return digits


def _generate_code() -> str:
    return "".join(secrets.choice(string.digits) for _ in range(config.OTP_LENGTH))


def _hash_code(user_id: str, channel: str, code: str) -> str:
    # Keyed, and bound to the user + channel, so a leaked table can't be
    # reversed with a plain 6-digit lookup and a code for one channel
    # can never satisfy another.
    return hmac.new(
        config.OTP_HASH_SECRET.encode(),
        f"{user_id}:{channel}:{code}".encode(),
        hashlib.sha256,
    ).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ---- delivery -------------------------------------------------------

def _send_email_sync(to_email: str, code: str) -> None:
    message = EmailMessage()
    message["Subject"] = "Your MyYajmaan verification code"
    message["From"] = f"{config.SMTP_FROM_NAME} <{config.SMTP_FROM_EMAIL}>"
    message["To"] = to_email
    minutes = max(1, config.OTP_TTL_SECONDS // 60)
    message.set_content(
        f"Your MyYajmaan verification code is {code}.\n\n"
        f"It expires in {minutes} minutes. If you did not sign up, you can ignore this email."
    )

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15) as server:
        if config.SMTP_USE_TLS:
            server.starttls()
        if config.SMTP_USERNAME:
            server.login(config.SMTP_USERNAME, config.SMTP_PASSWORD)
        server.send_message(message)


async def _send_email(to_email: str, code: str) -> None:
    if not config.email_otp_configured():
        raise OtpError("OTP_NOT_CONFIGURED", "Email verification is not available right now.")
    try:
        await asyncio.to_thread(_send_email_sync, to_email, code)
    except Exception:
        logger.exception("Could not send OTP email")
        raise OtpError("OTP_DELIVERY_FAILED", "We could not send the email code. Please try again.")


async def _send_sms(phone: str, code: str) -> None:
    if config.SMS_PROVIDER != "msg91" or not config.sms_otp_configured():
        raise OtpError("OTP_NOT_CONFIGURED", "Phone verification is not available right now.")

    params = {
        "template_id": config.MSG91_TEMPLATE_ID,
        "mobile": normalize_phone(phone),
        "authkey": config.MSG91_AUTH_KEY,
        "otp": code,
        "otp_expiry": max(1, config.OTP_TTL_SECONDS // 60),
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(MSG91_OTP_URL, params=params)
        body = response.json() if response.content else {}
    except Exception:
        logger.exception("Could not reach the SMS provider")
        raise OtpError("OTP_DELIVERY_FAILED", "We could not send the SMS code. Please try again.")

    if response.status_code != 200 or str(body.get("type", "")).lower() == "error":
        # Provider text can include the auth key / number; log, don't show.
        logger.error("MSG91 rejected the OTP send (%s): %s", response.status_code, body)
        raise OtpError("OTP_DELIVERY_FAILED", "We could not send the SMS code. Please try again.")


# ---- issue / verify -------------------------------------------------

async def issue_otp(user: dict, channel: str) -> dict:
    """
    Creates and delivers a fresh OTP. Returns {"dev_otp": code} in dev
    mode, {} otherwise. Raises OtpError for cooldown / rate limit /
    delivery problems.
    """

    if channel not in CHANNELS or service_supabase is None:
        raise OtpError("OTP_UNAVAILABLE", "Verification is not available right now.")

    user_id = str(user["id"])
    destination = user["email"] if channel == "email" else user.get("phone") or ""
    if not destination:
        raise OtpError("OTP_NO_DESTINATION", "No contact detail found to send the code to.")

    hour_ago = (_now() - timedelta(hours=1)).isoformat()
    recent = (
        service_supabase.table("signup_otps")
        .select("id, created_at")
        .eq("user_id", user_id)
        .eq("channel", channel)
        .gte("created_at", hour_ago)
        .order("created_at", desc=True)
        .execute()
    )
    recent_rows = getattr(recent, "data", None) or []

    if recent_rows:
        elapsed = (_now() - _parse_ts(recent_rows[0]["created_at"])).total_seconds()
        remaining = int(config.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
        if remaining > 0:
            raise OtpError(
                "OTP_COOLDOWN",
                f"A code was just sent. You can request another in {remaining} seconds.",
                retry_after=remaining,
            )

    if len(recent_rows) >= config.OTP_MAX_SENDS_PER_HOUR:
        raise OtpError(
            "OTP_RATE_LIMITED",
            "Too many codes requested. Please try again in an hour.",
            retry_after=3600,
        )

    code = _generate_code()
    inserted = (
        service_supabase.table("signup_otps")
        .insert({
            "user_id": user_id,
            "channel": channel,
            "destination": destination,
            "code_hash": _hash_code(user_id, channel, code),
            "expires_at": (_now() + timedelta(seconds=config.OTP_TTL_SECONDS)).isoformat(),
        })
        .execute()
    )
    inserted_rows = getattr(inserted, "data", None) or []

    if dev_mode_active():
        logger.warning("[OTP_DEV_MODE] %s OTP for %s is %s", channel, destination, code)
        return {"dev_otp": code}

    try:
        if channel == "email":
            await _send_email(destination, code)
        else:
            await _send_sms(destination, code)
    except OtpError:
        # A code nobody received must not eat the person's cooldown or
        # hourly allowance.
        if inserted_rows:
            service_supabase.table("signup_otps").delete().eq("id", inserted_rows[0]["id"]).execute()
        raise

    return {}


def verify_otp(user: dict, channel: str, code: str) -> None:
    """Checks the code; on success marks it used and stamps the user's *_verified_at."""

    if channel not in CHANNELS or service_supabase is None:
        raise OtpError("OTP_UNAVAILABLE", "Verification is not available right now.")

    user_id = str(user["id"])

    latest = (
        service_supabase.table("signup_otps")
        .select("id, code_hash, expires_at, attempts")
        .eq("user_id", user_id)
        .eq("channel", channel)
        .is_("consumed_at", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(latest, "data", None) or []

    if not rows:
        raise OtpError("OTP_NOT_FOUND", "No active code found. Please request a new one.")

    row = rows[0]

    if _parse_ts(row["expires_at"]) < _now():
        raise OtpError("OTP_EXPIRED", "This code has expired. Please request a new one.")

    if row["attempts"] >= config.OTP_MAX_ATTEMPTS:
        raise OtpError("OTP_LOCKED", "Too many wrong attempts. Please request a new code.")

    if not hmac.compare_digest(row["code_hash"], _hash_code(user_id, channel, code.strip())):
        service_supabase.table("signup_otps").update({"attempts": row["attempts"] + 1}).eq("id", row["id"]).execute()
        left = config.OTP_MAX_ATTEMPTS - row["attempts"] - 1
        raise OtpError(
            "OTP_INVALID",
            "That code is incorrect." + (f" {left} attempt(s) left." if left > 0 else " Please request a new code."),
        )

    now_iso = _now().isoformat()
    service_supabase.table("signup_otps").update({"consumed_at": now_iso}).eq("id", row["id"]).execute()
    field = "email_verified_at" if channel == "email" else "phone_verified_at"
    service_supabase.table("users").update({field: now_iso}).eq("id", user_id).execute()
