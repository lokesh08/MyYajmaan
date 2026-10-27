"""
Shared helpers for a user's personal referral code (backed by the
existing public.referrals table — one row per user).
"""

import logging
import re
import secrets
from typing import Optional

from db import service_supabase

logger = logging.getLogger(__name__)


def _code_prefix(full_name: Optional[str]) -> str:
    base = re.sub(r"[^A-Za-z]", "", full_name or "").upper()[:10]
    return base or "MYYAJMAAN"


def ensure_referral_code(user_id: str, full_name: Optional[str] = None) -> Optional[str]:
    """
    Returns the user's personal referral code, creating one (and the
    backing referrals row) on first use if it doesn't exist yet.
    """

    if service_supabase is None or not user_id:
        return None

    try:
        existing = (
            service_supabase
            .table("referrals")
            .select("code")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = getattr(existing, "data", None) or []

        if rows:
            return rows[0]["code"]

        prefix = _code_prefix(full_name)

        for _ in range(5):
            candidate = f"{prefix}{secrets.randbelow(9000) + 1000}"

            try:
                insert_resp = (
                    service_supabase
                    .table("referrals")
                    .insert({"user_id": user_id, "code": candidate})
                    .select("code")
                    .execute()
                )
                inserted = getattr(insert_resp, "data", None) or []

                if inserted:
                    return inserted[0]["code"]

            except Exception:
                # Most likely a unique-code collision; try another candidate.
                continue

        return None

    except Exception:
        logger.exception("Could not ensure referral code for user %s", user_id)
        return None


def find_referrer_user_id(referral_code: str) -> Optional[str]:
    """Looks up the user_id that owns a given referral code, if any."""

    if service_supabase is None or not referral_code:
        return None

    try:
        resp = (
            service_supabase
            .table("referrals")
            .select("user_id")
            .eq("code", referral_code.strip().upper())
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return rows[0]["user_id"] if rows else None

    except Exception:
        logger.exception("Could not look up referrer for code %s", referral_code)
        return None
