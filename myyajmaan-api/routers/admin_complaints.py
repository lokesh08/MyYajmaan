"""
Complaint/dispute system, admin-facing half. Mirrors admin_support.py's
list/status pattern closely, extended with a reply thread and a
resolve step that carries a verdict + optional refund. See
routers/complaints.py for the customer-facing half.

Blocking a user found to be untruthful is deliberately NOT a new
endpoint here -- the admin UI's "Block this user" action calls the
existing PATCH /admin/users/{user_id}/status (admin_users.py), which
already deactivates the account, writes an audited user_flags row, and
is picked up by account_status.py's login check. No new blocking logic
belongs in this file.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import sanitize_or_filter_term, service_supabase
from notifications import notify_user
from permissions import require_admin_roles
from wallet import credit_wallet

router = APIRouter(prefix="/admin/complaints", tags=["admin-complaints"])

STATUS_VALUES = ("open", "in_progress", "resolved")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin complaints service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(f"subject.ilike.%{term}%")


def _attach_details(client, rows: list) -> list:
    user_ids = [row["user_id"] for row in rows if row.get("user_id")]
    booking_ids = [row["booking_id"] for row in rows if row.get("booking_id")]

    users_by_id = {}
    if user_ids:
        users_resp = client.table("users").select("id, full_name, email, phone").in_("id", user_ids).execute()
        users_by_id = {row["id"]: row for row in (getattr(users_resp, "data", None) or [])}

    bookings_by_id = {}
    if booking_ids:
        bookings_resp = client.table("bookings").select("id, booking_date, muhurat_time_slot, amount, pandit_id, catalog_puja_id").in_("id", booking_ids).execute()
        bookings_by_id = {row["id"]: row for row in (getattr(bookings_resp, "data", None) or [])}

    for row in rows:
        row["user"] = users_by_id.get(row.get("user_id"))
        row["booking"] = bookings_by_id.get(row.get("booking_id"))
    return rows


def _attach_thread(client, complaint: dict) -> dict:
    resp = (
        client.table("complaint_messages")
        .select("*")
        .eq("complaint_id", complaint["id"])
        .order("created_at")
        .execute()
    )
    complaint["messages"] = getattr(resp, "data", None) or []
    return complaint


# Matches the wording you asked for: the "new" state reads as "Not
# Viewed" on this screen specifically, distinct from admin_support.py's
# plain "New" (same underlying value, different admin-facing label).
STATUS_LABELS = {"open": "Not Viewed", "in_progress": "In Progress", "resolved": "Completed"}


@router.get("/counts")
async def get_complaint_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    counts = {}
    for tab in ("all",) + STATUS_VALUES:
        query = client.table("complaints").select("id", count="exact")
        query = _apply_search(query, search)
        if tab != "all":
            query = query.eq("status", tab)
        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0
    return counts


@router.get("")
async def list_complaints(
    status_filter: str = Query(default="all", alias="status"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("complaints").select("*", count="exact")
    query = _apply_search(query, search)
    if status_filter != "all":
        query = query.eq("status", status_filter)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    _attach_details(client, rows)

    return {
        "items": rows,
        "total": getattr(resp, "count", None) or 0,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{complaint_id}")
async def get_complaint_detail(
    complaint_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("complaints").select("*").eq("id", complaint_id).single().execute()
    complaint = getattr(resp, "data", None)
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    _attach_details(client, [complaint])
    _attach_thread(client, complaint)
    return {"complaint": complaint}


class ComplaintStatusIn(BaseModel):
    status: str = Field(pattern="^(open|in_progress)$")


@router.patch("/{complaint_id}/status")
async def update_complaint_status(
    complaint_id: str,
    payload: ComplaintStatusIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    A plain status move (e.g. into "in_progress" while researching) --
    reaching a verdict goes through /resolve instead, which is the only
    path that can set status="resolved".
    """
    client = _client()
    existing_resp = client.table("complaints").select("id, status").eq("id", complaint_id).limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    if existing_rows[0].get("status") == "resolved":
        raise HTTPException(status_code=400, detail="This complaint is already resolved.")

    client.table("complaints").update({"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", complaint_id).execute()

    write_audit_log(
        action="COMPLAINT_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="complaints",
        entity_id=complaint_id,
        payload={"old_status": existing_rows[0].get("status"), "new_status": payload.status},
    )

    return {"message": "Complaint status updated.", "status": payload.status}


class ComplaintReplyIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.post("/{complaint_id}/reply", status_code=201)
async def reply_to_complaint(
    complaint_id: str,
    payload: ComplaintReplyIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """Adds an admin message to the thread without closing the case."""
    client = _client()
    existing_resp = client.table("complaints").select("id, user_id, subject, status").eq("id", complaint_id).limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    complaint = existing_rows[0]
    if complaint.get("status") == "resolved":
        raise HTTPException(status_code=400, detail="This complaint is already resolved.")

    resp = (
        client.table("complaint_messages")
        .insert({"complaint_id": complaint_id, "sender_id": current_user["id"], "sender_role": "admin", "body": payload.body.strip()})
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not send this reply.")

    write_audit_log(
        action="COMPLAINT_MESSAGE_ADDED",
        actor_id=str(current_user["id"]),
        entity="complaints",
        entity_id=complaint_id,
        payload={"sender_role": "admin"},
    )

    if complaint.get("user_id"):
        await notify_user(
            user_id=complaint["user_id"],
            type="COMPLAINT_MESSAGE_ADDED",
            title="Admin replied to your complaint",
            message=f"You have a new reply on: {complaint.get('subject')}",
            link="/dashboard/bookings",
            metadata={"complaint_id": complaint_id},
        )

    return {"message": rows[0]}


class ComplaintResolveIn(BaseModel):
    resolution: str = Field(pattern="^(valid|invalid)$")
    reply_message: Optional[str] = Field(default=None, max_length=5000)
    refund_type: Optional[str] = Field(default=None, pattern="^(full|partial)$")
    refund_amount: Optional[float] = Field(default=None, gt=0)


@router.post("/{complaint_id}/resolve")
async def resolve_complaint(
    complaint_id: str,
    payload: ComplaintResolveIn,
    current_user: dict = Depends(require_admin_roles()),
):
    if payload.refund_type and payload.resolution != "valid":
        raise HTTPException(status_code=400, detail="A refund can only be issued when the complaint is resolved as valid.")
    if payload.refund_type and not payload.refund_amount:
        raise HTTPException(status_code=400, detail="Enter a refund amount.")

    client = _client()
    existing_resp = client.table("complaints").select("*").eq("id", complaint_id).limit(1).execute()
    existing_rows = getattr(existing_resp, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    complaint = existing_rows[0]
    if complaint.get("status") == "resolved":
        raise HTTPException(status_code=400, detail="This complaint is already resolved.")

    # A capped, sane refund -- never more than the booking actually cost.
    if payload.refund_amount:
        booking_resp = client.table("bookings").select("amount").eq("id", complaint["booking_id"]).limit(1).execute()
        booking_rows = getattr(booking_resp, "data", None) or []
        booking_amount = float(booking_rows[0]["amount"]) if booking_rows else None
        if booking_amount is not None and payload.refund_amount > booking_amount:
            raise HTTPException(status_code=400, detail=f"Refund cannot exceed the booking amount (Rs. {booking_amount:.2f}).")

    now = datetime.now(timezone.utc).isoformat()

    if payload.reply_message and payload.reply_message.strip():
        client.table("complaint_messages").insert({
            "complaint_id": complaint_id,
            "sender_id": current_user["id"],
            "sender_role": "admin",
            "body": payload.reply_message.strip(),
        }).execute()

    update_payload = {
        "status": "resolved",
        "resolution": payload.resolution,
        "refund_type": payload.refund_type,
        "refund_amount": payload.refund_amount,
        "resolved_by": current_user["id"],
        "resolved_at": now,
        "updated_at": now,
    }
    client.table("complaints").update(update_payload).eq("id", complaint_id).execute()

    new_balance = None
    if payload.refund_type and payload.refund_amount:
        new_balance = credit_wallet(
            user_id=complaint["user_id"],
            amount=payload.refund_amount,
            reason="complaint_refund",
            reference_type="complaint",
            reference_id=complaint_id,
        )

    write_audit_log(
        action="COMPLAINT_RESOLVED",
        actor_id=str(current_user["id"]),
        entity="complaints",
        entity_id=complaint_id,
        payload={
            "resolution": payload.resolution,
            "refund_type": payload.refund_type,
            "refund_amount": payload.refund_amount,
            "wallet_balance_after": new_balance,
        },
    )

    if complaint.get("user_id"):
        if payload.resolution == "valid":
            refund_note = f" Rs. {payload.refund_amount:.2f} has been credited to your MyYajmaan wallet." if payload.refund_amount else ""
            message = f"Your complaint has been reviewed and resolved in your favor.{refund_note}"
        else:
            message = "Your complaint has been reviewed. After investigation, we were unable to substantiate the issue raised."
        await notify_user(
            user_id=complaint["user_id"],
            type="COMPLAINT_RESOLVED",
            title="Your complaint has been resolved",
            message=message,
            link="/dashboard/bookings",
            metadata={"complaint_id": complaint_id},
        )

    return {"message": "Complaint resolved.", "wallet_balance": new_balance}
