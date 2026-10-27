from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from auth import api_error
from db import service_supabase
from payment_verification import PaymentNotVerifiedError, attach_consumed_reference, consume_verified_payment
from permissions import require_roles
from wallet import credit_wallet

router = APIRouter(prefix="/me/wallet", tags=["client-wallet"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Wallet service is not configured.")
    return service_supabase


@router.get("")
async def get_my_wallet(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()

    user_resp = client.table("users").select("wallet_balance").eq("id", current_user["id"]).single().execute()
    balance = float((getattr(user_resp, "data", None) or {}).get("wallet_balance") or 0)

    start = (page - 1) * page_size
    end = start + page_size - 1
    txn_resp = (
        client.table("wallet_transactions")
        .select("*", count="exact")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .range(start, end)
        .execute()
    )
    transactions = getattr(txn_resp, "data", None) or []
    total = getattr(txn_resp, "count", None) or 0

    return {
        "balance": balance,
        "transactions": transactions,
        "total_transactions": total,
        "page": page,
        "page_size": page_size,
    }


class TopupIn(BaseModel):
    amount: float = Field(gt=0, le=100000)
    payment_ref: str = Field(min_length=1, max_length=100)


@router.post("/topup")
async def topup_wallet(
    payload: TopupIn,
    current_user: dict = Depends(require_roles("user")),
):
    # payment_ref must be a REAL, verified Razorpay payment for exactly
    # this amount -- see payment_verification.py. Without this, anyone
    # could credit their own wallet with any amount via a made-up
    # reference and no money ever changing hands (this is the same
    # ledger bookings.py and package_bookings.py consume from).
    try:
        consume_verified_payment(
            user_id=current_user["id"],
            payment_id=payload.payment_ref,
            expected_amount=payload.amount,
            reference_type="wallet_topup",
        )
    except PaymentNotVerifiedError as exc:
        raise HTTPException(status_code=400, detail=api_error(exc.code, exc.message))

    new_balance = credit_wallet(
        user_id=current_user["id"],
        amount=payload.amount,
        reason="wallet_topup",
        reference_type="wallet_topup",
    )
    if new_balance is None:
        raise HTTPException(status_code=500, detail="Could not add money to your wallet. Please try again.")

    attach_consumed_reference(payload.payment_ref, str(current_user["id"]))

    write_audit_log(
        action="CLIENT_WALLET_TOPUP",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"amount": payload.amount, "payment_ref": payload.payment_ref},
    )

    return {"message": "Money added to your wallet successfully.", "balance": new_balance}
