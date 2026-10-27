from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_roles

router = APIRouter(prefix="/pandit/me/feedback", tags=["pandit-feedback"])


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


@router.get("")
async def list_my_feedback(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = (
        client.table("pandit_feedback")
        .select("*", count="exact")
        .eq("pandit_id", pandit["id"])
        .order("created_at", desc=True)
        .range(start, end)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    return {"items": rows, "total": total, "page": page, "page_size": page_size}


class FeedbackIn(BaseModel):
    booking_id: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    comment: str = Field(min_length=1, max_length=2000)


@router.post("")
async def submit_feedback(
    payload: FeedbackIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    if payload.booking_id:
        booking_resp = (
            client.table("bookings")
            .select("id")
            .eq("id", payload.booking_id)
            .eq("pandit_id", pandit["id"])
            .limit(1)
            .execute()
        )
        if not getattr(booking_resp, "data", None):
            raise HTTPException(status_code=404, detail="Booking not found.")

    resp = (
        client.table("pandit_feedback")
        .insert(
            {
                "pandit_id": pandit["id"],
                "booking_id": payload.booking_id,
                "rating": payload.rating,
                "comment": payload.comment.strip(),
            }
        )
        .select("*")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not submit your feedback.")

    write_audit_log(
        action="PANDIT_FEEDBACK_SUBMITTED",
        actor_id=str(current_user["id"]),
        entity="pandit_feedback",
        entity_id=str(rows[0]["id"]),
        payload={"booking_id": payload.booking_id, "rating": payload.rating},
    )

    return {"message": "Feedback submitted successfully. Thank you!", "feedback": rows[0]}
