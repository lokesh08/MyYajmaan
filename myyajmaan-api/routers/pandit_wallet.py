import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from notifications import notify_user
from permissions import require_roles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/pandit/me/wallet", tags=["pandit-wallet"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_pandit_or_404(client, user_id: str) -> dict:
    resp = client.table("pandits").select("id").eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pandit profile not found. Please complete onboarding first.")
    return rows[0]


def _has_bank_details(client, pandit_id: str) -> bool:
    # pandit_bank_details is keyed by pandit_id itself (no separate id column).
    resp = client.table("pandit_bank_details").select("pandit_id").eq("pandit_id", pandit_id).limit(1).execute()
    return bool(getattr(resp, "data", None))


def _reserved_for_withdrawals(client, pandit_id: str) -> float:
    # Any earlier requests still awaiting payout are provisionally
    # reserved so a pandit can't request more than what's actually free.
    resp = (
        client.table("wallet_withdrawal_requests")
        .select("amount")
        .eq("pandit_id", pandit_id)
        .in_("status", ["pending", "approved"])
        .execute()
    )
    return sum(float(row["amount"]) for row in (getattr(resp, "data", None) or []))


@router.get("")
async def get_my_wallet(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

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

    withdrawals_resp = (
        client.table("wallet_withdrawal_requests")
        .select("*")
        .eq("pandit_id", pandit["id"])
        .order("requested_at", desc=True)
        .limit(10)
        .execute()
    )
    withdrawal_requests = getattr(withdrawals_resp, "data", None) or []
    reserved = _reserved_for_withdrawals(client, pandit["id"])

    # Completed pujas whose fee admin hasn't released to the wallet yet.
    # Informational only -- never let it break the wallet page.
    awaiting_release_amount = 0.0
    awaiting_release_count = 0
    try:
        unreleased_resp = (
            client.table("bookings")
            .select("pandit_fee_amount")
            .eq("pandit_id", pandit["id"])
            .eq("status", "completed")
            .is_("pandit_payout_released_at", "null")
            .execute()
        )
        unreleased = getattr(unreleased_resp, "data", None) or []
        awaiting_release_count = len(unreleased)
        awaiting_release_amount = round(sum(float(r.get("pandit_fee_amount") or 0) for r in unreleased), 2)
    except Exception:
        logger.exception("Could not load unreleased earnings for pandit %s", pandit["id"])

    return {
        "balance": balance,
        "available_balance": round(max(balance - reserved, 0), 2),
        "awaiting_release_amount": awaiting_release_amount,
        "awaiting_release_count": awaiting_release_count,
        "has_bank_details": _has_bank_details(client, pandit["id"]),
        "transactions": transactions,
        "total_transactions": total,
        "page": page,
        "page_size": page_size,
        "withdrawal_requests": withdrawal_requests,
    }


class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)


@router.post("/withdraw")
async def request_withdrawal(
    payload: WithdrawIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    if not _has_bank_details(client, pandit["id"]):
        raise HTTPException(
            status_code=400,
            detail="Please add your bank details before requesting a withdrawal.",
        )

    user_resp = client.table("users").select("wallet_balance").eq("id", current_user["id"]).single().execute()
    balance = float((getattr(user_resp, "data", None) or {}).get("wallet_balance") or 0)

    available = round(balance - _reserved_for_withdrawals(client, pandit["id"]), 2)

    if payload.amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Withdrawal amount exceeds your available balance of Rs. {available:.2f}.",
        )

    resp = (
        client.table("wallet_withdrawal_requests")
        .insert(
            {
                "pandit_id": pandit["id"],
                "user_id": current_user["id"],
                "amount": payload.amount,
                "status": "pending",
            }
        )
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not submit your withdrawal request.")

    write_audit_log(
        action="PANDIT_WALLET_WITHDRAWAL_REQUESTED",
        actor_id=str(current_user["id"]),
        entity="wallet_withdrawal_requests",
        entity_id=str(rows[0]["id"]),
        payload={"amount": payload.amount},
    )

    try:
        pandit_name_resp = client.table("pandits").select("display_name, name").eq("id", pandit["id"]).limit(1).execute()
        pandit_name_rows = getattr(pandit_name_resp, "data", None) or []
        pandit_name = (pandit_name_rows[0].get("display_name") or pandit_name_rows[0].get("name")) if pandit_name_rows else "A Pandit Ji"
        admins_resp = client.table("users").select("id").eq("role", "admin").execute()
        for admin_row in getattr(admins_resp, "data", None) or []:
            await notify_user(
                user_id=admin_row["id"],
                type="WITHDRAWAL_REQUESTED",
                title="New withdrawal request",
                message=f"{pandit_name} requested a withdrawal of Rs. {payload.amount:.2f}.",
                link="/admin/wallet?tab=withdrawals",
                metadata={"withdrawal_id": rows[0]["id"]},
            )
    except Exception:
        pass

    return {
        "message": "Withdrawal request submitted. Admin will process it shortly.",
        "withdrawal_request": rows[0],
    }
