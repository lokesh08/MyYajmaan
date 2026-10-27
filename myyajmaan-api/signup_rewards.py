"""
Wallet rewards granted for a new customer signup.

These are paid only once the account has passed its one-time email +
phone verification (see routers/otp.py), not at the moment the signup
form is submitted -- otherwise throwaway accounts with made-up contact
details could farm the bonus.
"""

import logging

from audit import write_audit_log
from db import service_supabase
from wallet import credit_wallet, get_active_coupon_amount

logger = logging.getLogger(__name__)

# Every new customer gets this fixed bonus, referred or not. It is
# intentionally not admin-configurable (unlike the referral reward).
SIGNUP_WALLET_BONUS = 25


def grant_signup_rewards(user: dict) -> None:
    """
    Credits the signup bonus and, if this customer signed up through a
    referral link (users.referred_by, recorded at registration), the
    referrer's reward. Callers must invoke this exactly once, when the
    account is released from verification. Never raises: a wallet
    problem must not undo a successful verification.
    """

    if user.get("role") != "user":
        return

    user_id = user["id"]

    try:
        credit_wallet(
            user_id=user_id,
            amount=SIGNUP_WALLET_BONUS,
            reason="signup_bonus",
            reference_type="user",
            reference_id=user_id,
        )
    except Exception:
        logger.exception("Could not credit signup bonus for user %s", user_id)

    referrer_id = user.get("referred_by")
    if not referrer_id or service_supabase is None:
        return

    try:
        reward_amount = get_active_coupon_amount("referral_signup")
        if not reward_amount:
            return

        credit_wallet(
            user_id=referrer_id,
            amount=reward_amount,
            reason="referral_signup",
            reference_type="user",
            reference_id=user_id,
        )
        write_audit_log(
            action="REFERRAL_SIGNUP_LINKED",
            actor_id=str(user_id),
            entity="users",
            entity_id=referrer_id,
            payload={
                "referred_user_id": user_id,
                "referred_email": user.get("email"),
                "reward_amount": reward_amount,
            },
        )
    except Exception:
        logger.exception("Could not credit referral reward for new user %s", user_id)
