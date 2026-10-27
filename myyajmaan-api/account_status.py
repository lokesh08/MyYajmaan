"""
Shared helpers for computing whether an account is allowed to log in.

Mirrors the active/inactive/blocked logic routers/admin_users.py already
uses for the Users screen (users.is_active + an active banned/suspended
user_flags row), but scoped to a single user so it can run cheaply at
login time.
"""

import logging
from typing import Optional

from db import service_supabase

logger = logging.getLogger(__name__)

ACTIVE_FLAG_TYPES = ("banned", "suspended")


def get_active_block_flag(user_id: str) -> Optional[dict]:
    """
    Returns the user's currently active ban/suspension flag row
    (with `flag_type` and `reason`), or None if the account isn't
    blocked.
    """

    if service_supabase is None:
        return None

    try:
        resp = (
            service_supabase
            .table("user_flags")
            .select("id, flag_type, reason")
            .eq("user_id", user_id)
            .eq("is_active", True)
            .in_("flag_type", ACTIVE_FLAG_TYPES)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("Could not look up account block status for user %s", user_id)
        return None

    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None


def describe_login_block(user: dict) -> Optional[str]:
    """
    Returns a user-facing reason the account cannot log in right
    now, or None if the account is allowed to log in.
    """

    block_flag = get_active_block_flag(user["id"])

    if block_flag:
        reason = (block_flag.get("reason") or "").strip()
        suffix = f" Reason: {reason}." if reason else ""
        return (
            "Your account has been blocked."
            f"{suffix} Please contact support for assistance."
        )

    if not user.get("is_active", True):
        return (
            "Your account has been deactivated. "
            "Please contact support for assistance."
        )

    # Safety net for every authenticated request (login raises its own,
    # more specific VERIFICATION_REQUIRED before reaching here): a
    # session obtained some other way still can't use an account whose
    # one-time email + phone verification isn't finished.
    if user.get("signup_verification_pending"):
        return "Please verify your email and phone number to continue."

    return None
