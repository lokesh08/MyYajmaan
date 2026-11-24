"""
Admin -> Festivals: the festival calendar shown on the home page and used
for festival-puja date checks (pujas.festival_name is matched to
festivals.title, see routers/admin_pujas.py and the booking page).
Before this, festivals could only be added by a database migration.
"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/festivals", tags=["admin-festivals"])

FIELDS = "id, title, description, start_date, end_date, image_url, highlight, created_at, updated_at"


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Festival service is not configured.")
    return service_supabase


class FestivalIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=1000)
    start_date: date
    end_date: Optional[date] = None
    image_url: Optional[str] = Field(default=None, max_length=500)
    highlight: bool = False

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Festival name is required.")
        return value

    @field_validator("description", "image_url")
    @classmethod
    def _blank_to_none(cls, value):
        return (value or "").strip() or None

    @field_validator("end_date", mode="before")
    @classmethod
    def _blank_end_date(cls, value):
        return None if value in ("", None) else value


def _check_dates(payload: FestivalIn):
    if payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="End date can't be before the start date.")


def _row_payload(payload: FestivalIn) -> dict:
    return {
        "title": payload.title,
        "description": payload.description,
        "start_date": payload.start_date.isoformat(),
        # single-day festival: no end date
        "end_date": payload.end_date.isoformat() if payload.end_date and payload.end_date != payload.start_date else None,
        "image_url": payload.image_url,
        "highlight": payload.highlight,
    }


@router.get("")
async def list_festivals(
    when: str = Query(default="upcoming", pattern="^(upcoming|past|all)$"),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    query = client.table("festivals").select(FIELDS)
    today = date.today().isoformat()
    if when == "upcoming":
        query = query.or_(f"end_date.gte.{today},and(end_date.is.null,start_date.gte.{today})")
    elif when == "past":
        query = query.or_(f"end_date.lt.{today},and(end_date.is.null,start_date.lt.{today})")
    resp = query.order("start_date", desc=(when == "past")).limit(500).execute()
    return {"items": getattr(resp, "data", None) or []}


@router.get("/names")
async def list_festival_names(current_user: dict = Depends(require_admin_roles())):
    """Distinct festival names, for the 'Linked festival' dropdown on pujas."""
    resp = _client().table("festivals").select("title").execute()
    names = sorted({(r.get("title") or "").strip() for r in (getattr(resp, "data", None) or []) if (r.get("title") or "").strip()}, key=str.lower)
    return {"names": names}


@router.post("", status_code=201)
async def create_festival(payload: FestivalIn, current_user: dict = Depends(require_admin_roles())):
    _check_dates(payload)
    client = _client()
    duplicate = client.table("festivals").select("id").eq("title", payload.title).eq("start_date", payload.start_date.isoformat()).limit(1).execute()
    if getattr(duplicate, "data", None):
        raise HTTPException(status_code=409, detail="This festival is already in the calendar for that date.")

    resp = client.table("festivals").insert(_row_payload(payload)).select(FIELDS).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not add this festival.")

    write_audit_log(
        action="ADMIN_FESTIVAL_CREATED",
        actor_id=str(current_user["id"]),
        entity="festivals",
        entity_id=str(rows[0]["id"]),
        payload={"title": payload.title, "start_date": payload.start_date.isoformat()},
    )
    return {"message": "Festival added.", "festival": rows[0]}


@router.patch("/{festival_id}")
async def update_festival(festival_id: str, payload: FestivalIn, current_user: dict = Depends(require_admin_roles())):
    _check_dates(payload)
    client = _client()
    existing = client.table("festivals").select("id").eq("id", festival_id).limit(1).execute()
    if not getattr(existing, "data", None):
        raise HTTPException(status_code=404, detail="Festival not found.")

    resp = client.table("festivals").update(_row_payload(payload)).eq("id", festival_id).select(FIELDS).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update this festival.")

    write_audit_log(
        action="ADMIN_FESTIVAL_UPDATED",
        actor_id=str(current_user["id"]),
        entity="festivals",
        entity_id=festival_id,
        payload={"title": payload.title, "start_date": payload.start_date.isoformat()},
    )
    return {"message": "Festival updated.", "festival": rows[0]}


@router.delete("/{festival_id}")
async def delete_festival(festival_id: str, current_user: dict = Depends(require_admin_roles())):
    client = _client()
    existing = client.table("festivals").select("id, title, start_date").eq("id", festival_id).limit(1).execute()
    rows = getattr(existing, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Festival not found.")

    client.table("festivals").delete().eq("id", festival_id).execute()
    write_audit_log(
        action="ADMIN_FESTIVAL_DELETED",
        actor_id=str(current_user["id"]),
        entity="festivals",
        entity_id=festival_id,
        payload={"title": rows[0].get("title"), "start_date": rows[0].get("start_date")},
    )
    return {"message": "Festival deleted."}
