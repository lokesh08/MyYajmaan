from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/pandit-feedback", tags=["admin-pandit-feedback"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin pandit-feedback service is not configured.")
    return service_supabase


def _attach_details(client, rows: list):
    pandit_ids = [row["pandit_id"] for row in rows if row.get("pandit_id")]
    booking_ids = [row["booking_id"] for row in rows if row.get("booking_id")]

    pandits = client.table("pandits").select("id, display_name, name, city").in_("id", pandit_ids).execute() if pandit_ids else None
    pandits_by_id = {row["id"]: row for row in (getattr(pandits, "data", None) or [])}

    bookings = client.table("bookings").select("id, booking_date, date, muhurat_time_slot, timeslot, notes").in_("id", booking_ids).execute() if booking_ids else None
    bookings_by_id = {row["id"]: row for row in (getattr(bookings, "data", None) or [])}

    for row in rows:
        row["pandit"] = pandits_by_id.get(row.get("pandit_id")) or {}
        booking = bookings_by_id.get(row.get("booking_id"))
        if booking:
            row["booking"] = {
                "date": booking.get("booking_date") or booking.get("date"),
                "timeslot": booking.get("muhurat_time_slot") or booking.get("timeslot"),
                "puja_title": (booking.get("notes") or "").removeprefix("Puja: ").strip() or None,
            }
        else:
            row["booking"] = None
    return rows


@router.get("/summary")
async def get_pandit_feedback_summary(current_user: dict = Depends(require_admin_roles())):
    client = _client()
    resp = client.table("pandit_feedback").select("rating", count="exact").execute()
    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    rated = [row["rating"] for row in rows if row.get("rating") is not None]
    average = round(sum(rated) / len(rated), 1) if rated else None
    return {"total": total, "average_rating": average, "rated_count": len(rated)}


@router.get("")
async def list_pandit_feedback(
    search: Optional[str] = Query(default=None),
    rating: Optional[int] = Query(default=None, ge=1, le=5),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    query = client.table("pandit_feedback").select("*", count="exact")
    if rating:
        query = query.eq("rating", rating)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_details(client, rows)

    if search:
        term = search.strip().lower()
        rows = [
            row for row in rows
            if term in (row["pandit"].get("display_name") or row["pandit"].get("name") or "").lower()
            or term in (row.get("comment") or "").lower()
        ]

    return {"items": rows, "total": total, "page": page, "page_size": page_size}
