from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/muhrats", tags=["admin-muhrats"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin muhurat service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(f"title.ilike.%{term}%,description.ilike.%{term}%")


@router.get("")
async def list_muhrats_admin(
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    query = client.table("muhrats").select("*", count="exact")
    query = _apply_search(query, search)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("start_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{muhrat_id}")
async def get_muhrat_admin_detail(
    muhrat_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("muhrats").select("*").eq("id", muhrat_id).single().execute()
    muhrat = getattr(resp, "data", None)
    if not muhrat:
        raise HTTPException(status_code=404, detail="Shubh Muhurat not found.")
    return {"muhrat": muhrat}


class PujaDiscountIn(BaseModel):
    puja_id: str
    puja_title: Optional[str] = None
    discount_type: str = Field(default="percentage")
    discount_value: float = Field(gt=0)


class MuhratIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    start_at: str
    end_at: str
    discount_percent: Optional[float] = Field(default=None, ge=0, le=100)
    puja_discounts: List[PujaDiscountIn] = Field(default_factory=list)
    active: bool = True


def _validate_payload(payload: MuhratIn):
    if payload.end_at <= payload.start_at:
        raise HTTPException(status_code=400, detail="End time must be after start time.")
    for pd in payload.puja_discounts:
        if pd.discount_type not in ("percentage", "flat"):
            raise HTTPException(status_code=400, detail="Invalid per-puja discount type.")


def _muhrat_columns(payload: MuhratIn) -> dict:
    return {
        "title": payload.title.strip(),
        "description": (payload.description or "").strip() or None,
        "start_at": payload.start_at,
        "end_at": payload.end_at,
        "discount_percent": payload.discount_percent,
        "puja_discounts": [pd.model_dump() for pd in payload.puja_discounts],
        "active": payload.active,
    }


@router.post("", status_code=201)
async def create_muhrat(
    payload: MuhratIn,
    current_user: dict = Depends(require_admin_roles()),
):
    _validate_payload(payload)
    client = _client()

    insert_payload = _muhrat_columns(payload)
    insert_payload["created_by"] = current_user["id"]
    insert_payload["updated_by"] = current_user["id"]

    resp = client.table("muhrats").insert(insert_payload).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not create the Shubh Muhurat.")
    muhrat = rows[0]

    write_audit_log(
        action="ADMIN_MUHURAT_CREATED",
        actor_id=str(current_user["id"]),
        entity="muhrats",
        entity_id=str(muhrat["id"]),
        payload={"title": muhrat.get("title")},
    )

    return {"message": "Shubh Muhurat created successfully.", "muhrat": muhrat}


@router.patch("/{muhrat_id}")
async def update_muhrat(
    muhrat_id: str,
    payload: MuhratIn,
    current_user: dict = Depends(require_admin_roles()),
):
    _validate_payload(payload)
    client = _client()

    existing_resp = client.table("muhrats").select("id, title").eq("id", muhrat_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Shubh Muhurat not found.")

    update_payload = _muhrat_columns(payload)
    update_payload["updated_by"] = current_user["id"]

    resp = client.table("muhrats").update(update_payload).eq("id", muhrat_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update the Shubh Muhurat.")
    muhrat = rows[0]

    write_audit_log(
        action="ADMIN_MUHURAT_UPDATED",
        actor_id=str(current_user["id"]),
        entity="muhrats",
        entity_id=muhrat_id,
        payload={"title": muhrat.get("title")},
    )

    return {"message": "Shubh Muhurat updated successfully.", "muhrat": muhrat}


@router.delete("/{muhrat_id}")
async def delete_muhrat(
    muhrat_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("muhrats").select("id, title").eq("id", muhrat_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Shubh Muhurat not found.")

    client.table("muhrats").delete().eq("id", muhrat_id).execute()

    write_audit_log(
        action="ADMIN_MUHURAT_DELETED",
        actor_id=str(current_user["id"]),
        entity="muhrats",
        entity_id=muhrat_id,
        payload={"title": existing.get("title")},
    )

    return {"message": "Shubh Muhurat deleted successfully."}
