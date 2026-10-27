"""
Complaint/dispute system, customer-facing half. A Yajmaan can raise a
complaint on a booking once its puja is marked completed, and carry on
a two-way thread with admin until it's resolved. See
routers/admin_complaints.py for the admin-facing triage/resolve half,
and the 20260914000000_complaints.sql migration for the schema.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from notifications import notify_user
from permissions import require_roles

router = APIRouter(prefix="/complaints", tags=["complaints"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Complaints service is not configured.")
    return service_supabase


def _get_own_complaint_or_404(client, user_id: str, complaint_id: str) -> dict:
    resp = client.table("complaints").select("*").eq("id", complaint_id).eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Complaint not found.")
    return rows[0]


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


class ComplaintIn(BaseModel):
    booking_id: str
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10, max_length=5000)


@router.post("", status_code=201)
async def create_complaint(
    payload: ComplaintIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()

    booking_resp = (
        client.table("bookings")
        .select("id, status, client_id, pandit_id, amount")
        .eq("id", payload.booking_id)
        .eq("client_id", current_user["id"])
        .limit(1)
        .execute()
    )
    booking_rows = getattr(booking_resp, "data", None) or []
    if not booking_rows:
        raise HTTPException(status_code=404, detail="Booking not found.")
    booking = booking_rows[0]

    if booking.get("status") != "completed":
        raise HTTPException(status_code=400, detail="You can raise a complaint once your puja is marked completed.")

    try:
        complaint_resp = (
            client.table("complaints")
            .insert({
                "booking_id": booking["id"],
                "user_id": current_user["id"],
                "subject": payload.subject.strip(),
                "status": "open",
            })
            .select("*")
            .execute()
        )
    except Exception as exc:
        # The partial unique index (one open/in-progress complaint per
        # booking) is the backstop against a race between two tabs --
        # PostgREST surfaces a conflict as a generic exception here, so
        # this is the one place we can't just let it bubble as a 500.
        if "duplicate key" in str(exc).lower() or "idx_complaints_one_open_per_booking" in str(exc):
            raise HTTPException(status_code=400, detail="You already have an open complaint on this booking.")
        raise HTTPException(status_code=500, detail="Could not raise this complaint. Please try again.")

    complaint_rows = getattr(complaint_resp, "data", None) or []
    if not complaint_rows:
        raise HTTPException(status_code=400, detail="You already have an open complaint on this booking.")
    complaint = complaint_rows[0]

    client.table("complaint_messages").insert({
        "complaint_id": complaint["id"],
        "sender_id": current_user["id"],
        "sender_role": "user",
        "body": payload.description.strip(),
    }).execute()

    write_audit_log(
        action="COMPLAINT_CREATED",
        actor_id=str(current_user["id"]),
        entity="complaints",
        entity_id=complaint["id"],
        payload={"booking_id": booking["id"], "subject": payload.subject},
    )

    admins_resp = client.table("users").select("id").eq("role", "admin").execute()
    for admin_row in getattr(admins_resp, "data", None) or []:
        await notify_user(
            user_id=admin_row["id"],
            type="COMPLAINT_RAISED",
            title="New complaint raised",
            message=f"{current_user.get('full_name') or 'A customer'} raised a complaint: {payload.subject}",
            link="/admin/complaints",
            metadata={"complaint_id": complaint["id"], "booking_id": booking["id"]},
        )

    return {"complaint": _attach_thread(client, complaint)}


@router.get("/mine")
async def list_my_complaints(
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    resp = (
        client.table("complaints")
        .select("*")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"items": getattr(resp, "data", None) or []}


@router.get("/by-booking/{booking_id}")
async def get_complaint_for_booking(
    booking_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    """
    Lets the booking-detail modal check, in one call, whether this
    booking already has an open/in-progress/resolved complaint -- so it
    knows whether to show "Raise a Complaint" or the existing thread.
    """
    client = _client()
    resp = (
        client.table("complaints")
        .select("*")
        .eq("booking_id", booking_id)
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        return {"complaint": None}
    return {"complaint": _attach_thread(client, rows[0])}


@router.get("/{complaint_id}")
async def get_complaint_detail(
    complaint_id: str,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    complaint = _get_own_complaint_or_404(client, current_user["id"], complaint_id)
    return {"complaint": _attach_thread(client, complaint)}


class ComplaintMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


@router.post("/{complaint_id}/messages", status_code=201)
async def add_complaint_message(
    complaint_id: str,
    payload: ComplaintMessageIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()
    complaint = _get_own_complaint_or_404(client, current_user["id"], complaint_id)
    if complaint.get("status") == "resolved":
        raise HTTPException(status_code=400, detail="This complaint is already resolved and can't accept new messages.")

    resp = (
        client.table("complaint_messages")
        .insert({
            "complaint_id": complaint_id,
            "sender_id": current_user["id"],
            "sender_role": "user",
            "body": payload.body.strip(),
        })
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not send this message.")

    write_audit_log(
        action="COMPLAINT_MESSAGE_ADDED",
        actor_id=str(current_user["id"]),
        entity="complaints",
        entity_id=complaint_id,
        payload={"sender_role": "user"},
    )

    admins_resp = client.table("users").select("id").eq("role", "admin").execute()
    for admin_row in getattr(admins_resp, "data", None) or []:
        await notify_user(
            user_id=admin_row["id"],
            type="COMPLAINT_MESSAGE_ADDED",
            title="New message on a complaint",
            message=f"{current_user.get('full_name') or 'A customer'} replied on their complaint: {complaint.get('subject')}",
            link="/admin/complaints",
            metadata={"complaint_id": complaint_id},
        )

    return {"message": rows[0]}
