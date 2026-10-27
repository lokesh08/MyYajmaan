"""
Shared helpers for crediting a user's wallet and reading the
currently-configured reward amount for a system coupon type
(referral_signup / referral_booking).

Every credit here is best-effort: a failure logs and returns None
rather than raising, so a wallet-ledger hiccup never blocks the
surrounding registration/booking request that triggered it.
"""

import logging
from typing import Optional

from audit import write_audit_log
from db import service_supabase

logger = logging.getLogger(__name__)


def credit_wallet(
    user_id: str,
    amount: float,
    reason: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> Optional[float]:
    """
    Credits a user's wallet and records a wallet_transactions ledger
    entry. Returns the new balance, or None if the credit couldn't
    be applied.

    NOTE: this reads the current balance then writes the new one,
    which is not atomic under concurrent credits to the same user.
    Acceptable at this app's scale; an RPC-based atomic increment
    would be the fix if that ever becomes a real risk.
    """

    if service_supabase is None or not user_id or amount is None or amount <= 0:
        return None

    try:
        user_resp = (
            service_supabase
            .table("users")
            .select("wallet_balance")
            .eq("id", user_id)
            .single()
            .execute()
        )
        current = getattr(user_resp, "data", None)

        if not current:
            return None

        new_balance = round(float(current.get("wallet_balance") or 0) + float(amount), 2)

        service_supabase.table("users").update(
            {"wallet_balance": new_balance}
        ).eq("id", user_id).execute()

        service_supabase.table("wallet_transactions").insert(
            {
                "user_id": user_id,
                "type": "credit",
                "amount": amount,
                "reason": reason,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "balance_after": new_balance,
            }
        ).execute()

        write_audit_log(
            action="WALLET_CREDITED",
            actor_id=None,
            entity="users",
            entity_id=user_id,
            payload={
                "amount": amount,
                "reason": reason,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "balance_after": new_balance,
            },
        )

        return new_balance

    except Exception:
        logger.exception(
            "Could not credit wallet for user %s (reason=%s)",
            user_id,
            reason,
        )
        return None


def debit_wallet(
    user_id: str,
    amount: float,
    reason: str,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
) -> Optional[float]:
    """
    Debits a user's wallet (fails, returning None, if the balance is
    insufficient) and records a wallet_transactions ledger entry.
    Returns the new balance on success.

    Mirrors credit_wallet()'s read-then-write pattern and the same
    non-atomicity caveat.
    """

    if service_supabase is None or not user_id or amount is None or amount <= 0:
        return None

    try:
        user_resp = (
            service_supabase
            .table("users")
            .select("wallet_balance")
            .eq("id", user_id)
            .single()
            .execute()
        )
        current = getattr(user_resp, "data", None)

        if not current:
            return None

        current_balance = float(current.get("wallet_balance") or 0)
        if current_balance < amount:
            return None

        new_balance = round(current_balance - float(amount), 2)

        service_supabase.table("users").update(
            {"wallet_balance": new_balance}
        ).eq("id", user_id).execute()

        service_supabase.table("wallet_transactions").insert(
            {
                "user_id": user_id,
                "type": "debit",
                "amount": amount,
                "reason": reason,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "balance_after": new_balance,
            }
        ).execute()

        write_audit_log(
            action="WALLET_DEBITED",
            actor_id=user_id,
            entity="users",
            entity_id=user_id,
            payload={
                "amount": amount,
                "reason": reason,
                "reference_type": reference_type,
                "reference_id": reference_id,
                "balance_after": new_balance,
            },
        )

        return new_balance

    except Exception:
        logger.exception(
            "Could not debit wallet for user %s (reason=%s)",
            user_id,
            reason,
        )
        return None


def get_active_coupon_amount(coupon_type: str) -> Optional[float]:
    """
    Returns the discount_value of the currently active coupon of the
    given system coupon_type (e.g. "referral_signup"), or None if
    none is configured/active. Callers should skip crediting in that
    case rather than guessing an amount.
    """

    if service_supabase is None:
        return None

    try:
        resp = (
            service_supabase
            .table("coupons")
            .select("discount_value")
            .eq("coupon_type", coupon_type)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = getattr(resp, "data", None) or []
        return float(rows[0]["discount_value"]) if rows else None

    except Exception:
        logger.exception(
            "Could not look up active coupon amount for %s",
            coupon_type,
        )
        return None


def has_wallet_transaction(user_id: str, reason: str) -> bool:
    """Idempotency guard: has this user already received a credit for this reason?"""

    if service_supabase is None or not user_id:
        return False

    try:
        resp = (
            service_supabase
            .table("wallet_transactions")
            .select("id")
            .eq("user_id", user_id)
            .eq("reason", reason)
            .limit(1)
            .execute()
        )
        return bool(getattr(resp, "data", None))

    except Exception:
        logger.exception(
            "Could not check existing wallet_transactions for user %s (reason=%s)",
            user_id,
            reason,
        )
        # Fail closed: if we can't tell, don't risk a duplicate credit.
        return True
