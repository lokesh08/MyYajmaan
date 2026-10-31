from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from bank_crypto import decrypt_value, mask_value
from db import service_supabase
from notifications import notify_user
from permissions import require_admin_roles
from wallet import credit_wallet, debit_wallet

router = APIRouter(prefix="/admin/wallet", tags=["admin-wallet"])

WITHDRAWAL_STATUS_VALUES = ("pending", "approved", "rejected", "paid")

# Groups the ledger's free-text `reason` values into a small set of
# admin-facing categories, so filtering doesn't require knowing every
# exact reason string the app happens to use internally.
REASON_CATEGORIES = {
    "signup_bonus": "Signup Bonus",
    "referral_signup": "Referral Reward",
    "referral_first_booking": "Referral Reward",
    "wallet_topup": "Wallet Top-up",
    "booking_reschedule_fee": "Reschedule Fee",
    "booking_cancellation_refund": "Cancellation Refund",
    "wallet_withdrawal_paid": "Withdrawal Payout",
    "pandit_booking_earning": "Puja Earning",
}

PAYOUT_METHODS = ("neft", "imps", "rtgs", "upi", "other")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Wallet service is not configured.")
    return service_supabase


def _attach_user_info(client, rows: list, id_field: str = "user_id"):
    user_ids = [row[id_field] for row in rows if row.get(id_field)]
    if not user_ids:
        return rows

    resp = client.table("users").select("id, full_name, email, role").in_("id", user_ids).execute()
    users_by_id = {u["id"]: u for u in (getattr(resp, "data", None) or [])}

    for row in rows:
        user = users_by_id.get(row.get(id_field)) or {}
        row["user_name"] = user.get("full_name")
        row["user_email"] = user.get("email")
        row["user_role"] = user.get("role")

    return rows


@router.get("/summary")
async def get_wallet_summary(current_user: dict = Depends(require_admin_roles())):
    client = _client()

    balances_resp = client.table("users").select("role, wallet_balance").execute()
    balances = getattr(balances_resp, "data", None) or []
    customer_balance = sum(float(r.get("wallet_balance") or 0) for r in balances if r.get("role") == "user")
    pandit_balance = sum(float(r.get("wallet_balance") or 0) for r in balances if r.get("role") == "pandit")

    txns_resp = client.table("wallet_transactions").select("type, amount").execute()
    txns = getattr(txns_resp, "data", None) or []
    total_credited = sum(float(t.get("amount") or 0) for t in txns if t.get("type") == "credit")
    total_debited = sum(float(t.get("amount") or 0) for t in txns if t.get("type") == "debit")

    pending_resp = (
        client.table("wallet_withdrawal_requests")
        .select("amount", count="exact")
        .eq("status", "pending")
        .execute()
    )
    pending_rows = getattr(pending_resp, "data", None) or []
    pending_count = getattr(pending_resp, "count", None) or 0
    pending_amount = sum(float(r.get("amount") or 0) for r in pending_rows)

    unreleased_resp = (
        client.table("bookings")
        .select("pandit_fee_amount", count="exact")
        .eq("status", "completed")
        .is_("pandit_payout_released_at", "null")
        .execute()
    )
    unreleased_rows = getattr(unreleased_resp, "data", None) or []

    return {
        "customer_wallet_total": round(customer_balance, 2),
        "pandit_wallet_total": round(pandit_balance, 2),
        "total_credited": round(total_credited, 2),
        "total_debited": round(total_debited, 2),
        "pending_withdrawal_count": pending_count,
        "pending_withdrawal_amount": round(pending_amount, 2),
        "unreleased_earning_count": getattr(unreleased_resp, "count", None) or 0,
        "unreleased_earning_amount": round(sum(float(r.get("pandit_fee_amount") or 0) for r in unreleased_rows), 2),
    }


@router.get("/transactions")
async def list_wallet_transactions(
    role: Optional[str] = Query(default=None, description="user | pandit | admin"),
    txn_type: Optional[str] = Query(default=None, alias="type", description="credit | debit"),
    reason: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    query = client.table("wallet_transactions").select("*", count="exact")
    if txn_type in ("credit", "debit"):
        query = query.eq("type", txn_type)
    if reason:
        query = query.eq("reason", reason)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_user_info(client, rows)

    for row in rows:
        row["reason_label"] = REASON_CATEGORIES.get(row.get("reason"), (row.get("reason") or "").replace("_", " ").title())

    # role/search filter applied post-join (user info isn't available
    # to filter on directly via the wallet_transactions table).
    if role in ("user", "pandit", "admin"):
        rows = [r for r in rows if r.get("user_role") == role]
    if search:
        term = search.strip().lower()
        rows = [
            r for r in rows
            if term in (r.get("user_name") or "").lower() or term in (r.get("user_email") or "").lower()
        ]

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/transactions/reasons")
async def list_transaction_reasons(current_user: dict = Depends(require_admin_roles())):
    """Distinct reasons actually present in the ledger, for the filter dropdown."""
    client = _client()
    resp = client.table("wallet_transactions").select("reason").execute()
    rows = getattr(resp, "data", None) or []
    reasons = sorted({r["reason"] for r in rows if r.get("reason")})
    return [{"value": r, "label": REASON_CATEGORIES.get(r, r.replace("_", " ").title())} for r in reasons]


@router.get("/bookings")
async def list_booking_payments(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    query = client.table("bookings").select(
        "id, client_id, pandit_id, amount, payment_ref, status, booking_date, date, "
        "cancellation_fee, refund_amount, reschedule_fee_charged, created_at",
        count="exact",
    )
    if status_filter:
        query = query.eq("status", status_filter)
    if date_from:
        query = query.gte("created_at", date_from)
    if date_to:
        query = query.lte("created_at", date_to)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    client_ids = [r["client_id"] for r in rows if r.get("client_id")]
    pandit_ids = [r["pandit_id"] for r in rows if r.get("pandit_id")]

    names_by_client = {}
    if client_ids:
        client_resp = client.table("users").select("id, full_name, email").in_("id", client_ids).execute()
        names_by_client = {u["id"]: u for u in (getattr(client_resp, "data", None) or [])}

    names_by_pandit = {}
    if pandit_ids:
        pandit_resp = client.table("pandits").select("id, display_name, name").in_("id", pandit_ids).execute()
        names_by_pandit = {p["id"]: (p.get("display_name") or p.get("name")) for p in (getattr(pandit_resp, "data", None) or [])}

    for row in rows:
        customer = names_by_client.get(row.get("client_id")) or {}
        row["customer_name"] = customer.get("full_name")
        row["customer_email"] = customer.get("email")
        row["pandit_name"] = names_by_pandit.get(row.get("pandit_id"))

    if search:
        term = search.strip().lower()
        rows = [
            r for r in rows
            if term in (r.get("customer_name") or "").lower()
            or term in (r.get("pandit_name") or "").lower()
            or term in (r.get("payment_ref") or "").lower()
        ]

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


# ---------------- Pandit Ji earnings (completed pujas) ----------------
#
# A completed booking's pandit_fee_amount is not credited automatically:
# admin releases it to the Pandit Ji's wallet (after checking for any
# complaint), and the Pandit Ji then requests a withdrawal to their bank.


def _puja_titles(client, rows: list) -> dict:
    puja_ids = list({r["catalog_puja_id"] for r in rows if r.get("catalog_puja_id")})
    if not puja_ids:
        return {}
    resp = client.table("pujas").select("id, title").in_("id", puja_ids).execute()
    return {p["id"]: p.get("title") for p in (getattr(resp, "data", None) or [])}


def _puja_title(row: dict, titles: dict) -> str:
    return titles.get(row.get("catalog_puja_id")) or (row.get("notes") or "").removeprefix("Puja: ").strip() or "Puja"


@router.get("/pandit-earnings")
async def list_pandit_earnings(
    status_filter: str = Query(default="pending", alias="status", description="pending | released | all"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("pending", "released", "all"):
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("bookings").select(
        "id, client_id, pandit_id, catalog_puja_id, notes, amount, pandit_fee_amount, refund_amount, "
        "booking_date, date, updated_at, pandit_payout_released_at, pandit_payout_released_by, pandit_payout_amount",
        count="exact",
    ).eq("status", "completed")
    if status_filter == "pending":
        query = query.is_("pandit_payout_released_at", "null")
    elif status_filter == "released":
        query = query.not_.is_("pandit_payout_released_at", "null")

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("updated_at", desc=True).range(start, end).execute()
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    pandit_ids = list({r["pandit_id"] for r in rows if r.get("pandit_id")})
    client_ids = list({r["client_id"] for r in rows if r.get("client_id")})
    booking_ids = [r["id"] for r in rows]

    pandits_by_id = {}
    if pandit_ids:
        pandit_resp = client.table("pandits").select("id, user_id, display_name, name, city").in_("id", pandit_ids).execute()
        pandits_by_id = {p["id"]: p for p in (getattr(pandit_resp, "data", None) or [])}

    customers_by_id = {}
    if client_ids:
        customer_resp = client.table("users").select("id, full_name").in_("id", client_ids).execute()
        customers_by_id = {u["id"]: u for u in (getattr(customer_resp, "data", None) or [])}

    # Bookings with a complaint still being looked into -- admin should
    # settle it before releasing the fee.
    open_complaints = set()
    if booking_ids:
        complaint_resp = (
            client.table("complaints")
            .select("booking_id")
            .in_("booking_id", booking_ids)
            .in_("status", ["open", "in_progress"])
            .execute()
        )
        open_complaints = {c["booking_id"] for c in (getattr(complaint_resp, "data", None) or [])}

    titles = _puja_titles(client, rows)
    for row in rows:
        pandit = pandits_by_id.get(row.get("pandit_id")) or {}
        row["pandit_name"] = pandit.get("display_name") or pandit.get("name")
        row["pandit_city"] = pandit.get("city")
        row["customer_name"] = (customers_by_id.get(row.get("client_id")) or {}).get("full_name")
        row["puja_title"] = _puja_title(row, titles)
        row["has_open_complaint"] = row["id"] in open_complaints
        row.pop("notes", None)

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


class ReleaseEarningIn(BaseModel):
    # Defaults to the booking's pandit_fee_amount; a lower amount (e.g.
    # after a complaint) needs a note explaining the deduction.
    amount: Optional[float] = Field(default=None, gt=0)
    admin_notes: Optional[str] = Field(default=None, max_length=500)


@router.post("/pandit-earnings/{booking_id}/release")
async def release_pandit_earning(
    booking_id: str,
    payload: ReleaseEarningIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    resp = (
        client.table("bookings")
        .select("id, pandit_id, status, amount, pandit_fee_amount, pandit_payout_released_at")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = rows[0]

    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Only completed pujas can be paid to Pandit Ji.")
    if booking.get("pandit_payout_released_at"):
        raise HTTPException(status_code=409, detail="This Pandit Ji fee has already been released.")

    pandit_resp = client.table("pandits").select("id, user_id").eq("id", booking.get("pandit_id") or "").limit(1).execute()
    pandit_rows = getattr(pandit_resp, "data", None) or []
    pandit_user_id = pandit_rows[0].get("user_id") if pandit_rows else None
    if not pandit_user_id:
        raise HTTPException(status_code=400, detail="This booking has no Pandit Ji account to pay.")

    fee = round(float(booking.get("pandit_fee_amount") or 0), 2)
    # Older bookings may have no fee recorded; then admin enters it, up
    # to what the customer paid.
    max_amount = fee if fee > 0 else round(float(booking.get("amount") or 0), 2)
    amount = round(float(payload.amount), 2) if payload.amount is not None else fee
    notes = (payload.admin_notes or "").strip() or None

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Please enter the amount to pay this Pandit Ji.")
    if amount > max_amount:
        raise HTTPException(status_code=400, detail=f"Amount cannot be more than Rs. {max_amount:.2f} for this booking.")
    if fee > 0 and amount < fee and not notes:
        raise HTTPException(status_code=400, detail="Please add a note explaining why less than the full fee is being paid.")

    # Claim the booking first (only succeeds while still unreleased), so
    # two admins clicking at once can't credit the same fee twice.
    claim_resp = (
        client.table("bookings")
        .update(
            {
                "pandit_payout_released_at": datetime.now(timezone.utc).isoformat(),
                "pandit_payout_released_by": current_user["id"],
                "pandit_payout_amount": amount,
            }
        )
        .eq("id", booking_id)
        .eq("status", "completed")
        .is_("pandit_payout_released_at", "null")
        .select("id")
        .execute()
    )
    if not (getattr(claim_resp, "data", None) or []):
        raise HTTPException(status_code=409, detail="This Pandit Ji fee has already been released.")

    new_balance = credit_wallet(
        user_id=pandit_user_id,
        amount=amount,
        reason="pandit_booking_earning",
        reference_type="bookings",
        reference_id=booking_id,
    )
    if new_balance is None:
        client.table("bookings").update(
            {"pandit_payout_released_at": None, "pandit_payout_released_by": None, "pandit_payout_amount": None}
        ).eq("id", booking_id).execute()
        raise HTTPException(status_code=500, detail="Could not credit the Pandit Ji's wallet. Please try again.")

    write_audit_log(
        action="ADMIN_PANDIT_EARNING_RELEASED",
        actor_id=str(current_user["id"]),
        entity="bookings",
        entity_id=booking_id,
        payload={"amount": amount, "pandit_fee_amount": fee, "admin_notes": notes},
    )

    await notify_user(
        user_id=pandit_user_id,
        type="EARNING_RELEASED",
        title="Puja earning added to your wallet",
        message=f"Rs. {amount:.2f} for a completed puja has been added to your wallet."
        + (f" Note: {notes}" if notes else "")
        + " You can now move it to your bank account.",
        link="/pandit/wallet",
        metadata={"booking_id": booking_id},
    )

    return {"message": f"Rs. {amount:.2f} added to the Pandit Ji's wallet.", "booking_id": booking_id, "balance_after": new_balance}


@router.get("/withdrawals")
async def list_withdrawal_requests(
    status_filter: str = Query(default="pending", alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + WITHDRAWAL_STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("wallet_withdrawal_requests").select("*", count="exact")
    if status_filter != "all":
        query = query.eq("status", status_filter)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("requested_at", desc=True).range(start, end).execute()
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    pandit_ids = [r["pandit_id"] for r in rows if r.get("pandit_id")]
    pandits_by_id = {}
    bank_by_pandit = {}
    if pandit_ids:
        pandit_resp = client.table("pandits").select("id, display_name, name, city").in_("id", pandit_ids).execute()
        pandits_by_id = {p["id"]: p for p in (getattr(pandit_resp, "data", None) or [])}

        bank_resp = (
            client.table("pandit_bank_details")
            .select("pandit_id, account_holder_name, bank_name, account_no_enc, ifsc_enc")
            .in_("pandit_id", pandit_ids)
            .execute()
        )
        for b in getattr(bank_resp, "data", None) or []:
            bank_by_pandit[b["pandit_id"]] = b

    for row in rows:
        pandit = pandits_by_id.get(row.get("pandit_id")) or {}
        row["pandit_name"] = pandit.get("display_name") or pandit.get("name")
        row["pandit_city"] = pandit.get("city")

        bank = bank_by_pandit.get(row.get("pandit_id"))
        if bank:
            row["bank_details"] = {
                "account_holder_name": bank.get("account_holder_name"),
                "bank_name": bank.get("bank_name"),
                "account_number_masked": mask_value(decrypt_value(bank.get("account_no_enc"))),
                "ifsc_masked": mask_value(decrypt_value(bank.get("ifsc_enc"))),
            }
        else:
            row["bank_details"] = None

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


@router.get("/withdrawals/{withdrawal_id}/bank-details")
async def reveal_withdrawal_bank_details(
    withdrawal_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    """Full (unmasked) bank details for one open request, so admin can make the transfer. Every view is audit-logged."""
    client = _client()

    resp = client.table("wallet_withdrawal_requests").select("id, pandit_id, status").eq("id", withdrawal_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Withdrawal request not found.")
    withdrawal = rows[0]
    if withdrawal.get("status") not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="Bank details are only shown for requests still to be paid.")

    bank_resp = (
        client.table("pandit_bank_details")
        .select("account_holder_name, bank_name, account_no_enc, ifsc_enc, upi_id_enc")
        .eq("pandit_id", withdrawal["pandit_id"])
        .limit(1)
        .execute()
    )
    bank_rows = getattr(bank_resp, "data", None) or []
    if not bank_rows:
        raise HTTPException(status_code=404, detail="This Pandit Ji has no bank details on file.")
    bank = bank_rows[0]

    account_number = decrypt_value(bank.get("account_no_enc"))
    ifsc = decrypt_value(bank.get("ifsc_enc"))
    if not account_number or not ifsc:
        raise HTTPException(status_code=500, detail="Could not read the stored bank details. Please check the encryption key.")

    write_audit_log(
        action="ADMIN_PANDIT_BANK_DETAILS_VIEWED",
        actor_id=str(current_user["id"]),
        entity="wallet_withdrawal_requests",
        entity_id=withdrawal_id,
        payload={"pandit_id": withdrawal["pandit_id"]},
    )

    return {
        "account_holder_name": bank.get("account_holder_name"),
        "bank_name": bank.get("bank_name"),
        "account_number": account_number,
        "ifsc": ifsc,
        "upi_id": decrypt_value(bank.get("upi_id_enc")),
    }


class WithdrawalActionIn(BaseModel):
    action: str = Field(pattern="^(approve|reject|mark_paid)$")
    admin_notes: Optional[str] = Field(default=None, max_length=500)
    # Required for mark_paid: the bank/UPI transaction reference (UTR) of
    # the transfer admin made outside the app.
    payout_reference: Optional[str] = Field(default=None, max_length=100)
    payout_method: Optional[str] = Field(default=None, pattern="^(neft|imps|rtgs|upi|other)$")


@router.patch("/withdrawals/{withdrawal_id}")
async def process_withdrawal(
    withdrawal_id: str,
    payload: WithdrawalActionIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    resp = client.table("wallet_withdrawal_requests").select("*").eq("id", withdrawal_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Withdrawal request not found.")
    withdrawal = rows[0]

    if withdrawal.get("status") not in ("pending", "approved"):
        raise HTTPException(status_code=400, detail="This request has already been finalized.")

    if payload.action == "reject" and not (payload.admin_notes or "").strip():
        raise HTTPException(status_code=400, detail="Please provide a reason for rejecting this request.")

    payout_reference = (payload.payout_reference or "").strip()
    if payload.action == "mark_paid" and (len(payout_reference) < 4 or not payload.payout_method):
        raise HTTPException(
            status_code=400,
            detail="Please enter the transaction reference (UTR) and payment method of the bank transfer.",
        )

    status_map = {"approve": "approved", "reject": "rejected", "mark_paid": "paid"}
    new_status = status_map[payload.action]

    if payload.action == "mark_paid":
        new_balance = debit_wallet(
            user_id=withdrawal["user_id"],
            amount=float(withdrawal["amount"]),
            reason="wallet_withdrawal_paid",
            reference_type="wallet_withdrawal_requests",
            reference_id=withdrawal_id,
        )
        if new_balance is None:
            raise HTTPException(
                status_code=400,
                detail="Could not debit the pandit's wallet (balance may have changed). Please review before retrying.",
            )

    update_columns = {
        "status": new_status,
        "processed_by": current_user["id"],
        "processed_at": datetime.now(timezone.utc).isoformat(),
        "admin_notes": (payload.admin_notes or "").strip() or None,
    }
    if payload.action == "mark_paid":
        update_columns["payout_reference"] = payout_reference
        update_columns["payout_method"] = payload.payout_method
    updated_resp = (
        client.table("wallet_withdrawal_requests")
        .update(update_columns)
        .eq("id", withdrawal_id)
        .select("*")
        .execute()
    )
    updated_rows = getattr(updated_resp, "data", None) or []

    write_audit_log(
        action=f"ADMIN_WALLET_WITHDRAWAL_{new_status.upper()}",
        actor_id=str(current_user["id"]),
        entity="wallet_withdrawal_requests",
        entity_id=withdrawal_id,
        payload={
            "amount": float(withdrawal["amount"]),
            "admin_notes": payload.admin_notes,
            "payout_reference": payout_reference or None,
            "payout_method": payload.payout_method,
        },
    )

    messages = {
        "approved": "Withdrawal request approved.",
        "rejected": "Withdrawal request rejected.",
        "paid": "Withdrawal marked as paid and debited from the pandit's wallet.",
    }

    pandit_messages = {
        "approved": f"Your withdrawal request of Rs. {float(withdrawal['amount']):.2f} was approved.",
        "rejected": f"Your withdrawal request of Rs. {float(withdrawal['amount']):.2f} was rejected."
        + (f" Reason: {payload.admin_notes.strip()}" if payload.admin_notes else ""),
        "paid": f"Rs. {float(withdrawal['amount']):.2f} has been paid out to your bank account"
        + (f" ({(payload.payout_method or '').upper()} ref: {payout_reference})." if payout_reference else "."),
    }
    if withdrawal.get("user_id"):
        await notify_user(
            user_id=withdrawal["user_id"],
            type=f"WITHDRAWAL_{new_status.upper()}",
            title=messages[new_status],
            message=pandit_messages[new_status],
            link="/pandit/wallet",
            metadata={"withdrawal_id": withdrawal_id},
        )

    return {"message": messages[new_status], "withdrawal_request": updated_rows[0] if updated_rows else None}
