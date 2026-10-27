"""
Brute-force protection for password login, shared by /auth/login and
/admin/auth/login (both go through routers/auth.py's
supabase_password_login -- wiring it in there covers both at once).

Two independent, sliding-window limits, each backed by the
login_attempts table (see the
20261004000000_login_rate_limiting.sql migration) rather than an
in-memory counter -- this app's deployment model is already documented
elsewhere (see notifications.py) as single-process-only *today*, but a
login counter that resets on every restart/deploy is a much weaker
guarantee than this app already gives OTPs, so it's DB-backed the same
way from day one:

  - per email:  LOGIN_MAX_FAILED_ATTEMPTS failures within
                LOGIN_LOCKOUT_WINDOW_MINUTES blocks further attempts
                against that account specifically.
  - per IP:     LOGIN_MAX_FAILED_ATTEMPTS_PER_IP failures within the
                same window blocks further attempts from that address,
                regardless of which email they target (credential
                stuffing across many accounts).

Both windows are sliding (checked against a timestamp cutoff, not a
separate "locked until" field), so a block lifts on its own as old
failures age out -- nothing to clean up or unlock manually.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import config
from db import service_supabase

logger = logging.getLogger(__name__)


class LoginRateLimitedError(Exception):
    """A user-presentable lockout (never a stack trace)."""

    def __init__(self, message: str, retry_after_seconds: int):
        super().__init__(message)
        self.code = "LOGIN_RATE_LIMITED"
        self.message = message
        self.retry_after_seconds = retry_after_seconds


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _window_start() -> str:
    return (_now() - timedelta(minutes=config.LOGIN_LOCKOUT_WINDOW_MINUTES)).isoformat()


def _oldest_failure_age_seconds(rows: list) -> int:
    """How long until the oldest counted failure ages out of the window."""
    timestamps = [
        datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")) for row in rows
    ]
    oldest = min(timestamps)
    window_ends_at = oldest + timedelta(minutes=config.LOGIN_LOCKOUT_WINDOW_MINUTES)
    return max(0, int((window_ends_at - _now()).total_seconds()))


def check_login_rate_limit(email: str, ip_address: Optional[str]) -> None:
    """
    Raises LoginRateLimitedError if either limit is already exceeded.
    Called BEFORE the password is even checked against Supabase, so a
    locked-out attempt costs this app nothing extra and can't be used
    to keep probing.
    """

    if service_supabase is None:
        return  # fails open only when the DB itself isn't configured at all

    email = (email or "").strip().lower()
    since = _window_start()

    try:
        email_resp = (
            service_supabase.table("login_attempts")
            .select("created_at")
            .eq("email", email)
            .eq("success", False)
            .gte("created_at", since)
            .execute()
        )
        email_failures = getattr(email_resp, "data", None) or []
    except Exception:
        logger.exception("Could not check login rate limit for %s", email)
        return  # a logging failure must never itself lock someone out

    if len(email_failures) >= config.LOGIN_MAX_FAILED_ATTEMPTS:
        retry_after = _oldest_failure_age_seconds(email_failures)
        raise LoginRateLimitedError(
            f"Too many failed login attempts. Please try again in {max(1, retry_after // 60)} minute(s).",
            retry_after,
        )

    if not ip_address:
        return

    try:
        ip_resp = (
            service_supabase.table("login_attempts")
            .select("created_at")
            .eq("ip_address", ip_address)
            .eq("success", False)
            .gte("created_at", since)
            .execute()
        )
        ip_failures = getattr(ip_resp, "data", None) or []
    except Exception:
        logger.exception("Could not check IP login rate limit for %s", ip_address)
        return

    if len(ip_failures) >= config.LOGIN_MAX_FAILED_ATTEMPTS_PER_IP:
        retry_after = _oldest_failure_age_seconds(ip_failures)
        raise LoginRateLimitedError(
            f"Too many failed login attempts from this network. Please try again in {max(1, retry_after // 60)} minute(s).",
            retry_after,
        )


def record_login_attempt(email: str, ip_address: Optional[str], success: bool) -> None:
    """Best-effort, like every other audit-style write in this codebase."""

    if service_supabase is None:
        return
    try:
        service_supabase.table("login_attempts").insert({
            "email": (email or "").strip().lower(),
            "ip_address": ip_address,
            "success": success,
        }).execute()
    except Exception:
        logger.exception("Could not record login attempt for %s", email)
