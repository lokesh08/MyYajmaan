from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/support", tags=["admin-support"])

STATUS_VALUES = ("new", "in_progress", "resolved")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin support service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = search.strip().replace("%", "")
    if not term:
        return query
    return query.or_(
        f"first_name.ilike.%{term}%,last_name.ilike.%{term}%,email.ilike.%{term}%,message.ilike.%{term}%"
    )


@router.get("/counts")
async def get_support_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    counts = {}

    for tab in ("all",) + STATUS_VALUES:
        query = client.table("contact_messages").select("id", count="exact")
        query = _apply_search(query, search)
        if tab != "all":
            query = query.eq("status", tab)
        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0

    return counts


@router.get("")
async def list_support_requests(
    status_filter: str = Query(default="all", alias="status"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()
    query = client.table("contact_messages").select("*", count="exact")
    query = _apply_search(query, search)
    if status_filter != "all":
        query = query.eq("status", status_filter)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/{message_id}")
async def get_support_request_detail(
    message_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("contact_messages").select("*").eq("id", message_id).single().execute()
    message = getattr(resp, "data", None)
    if not message:
        raise HTTPException(status_code=404, detail="Support request not found.")
    return {"message": message}


class SupportUpdateIn(BaseModel):
    status: str = Field(pattern="^(new|in_progress|resolved)$")
    admin_notes: Optional[str] = Field(default=None, max_length=2000)


@router.patch("/{message_id}")
async def update_support_request(
    message_id: str,
    payload: SupportUpdateIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("contact_messages").select("id, status").eq("id", message_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="Support request not found.")

    update_payload = {"status": payload.status}
    if payload.admin_notes is not None:
        update_payload["admin_notes"] = payload.admin_notes.strip() or None

    if payload.status == "resolved" and existing.get("status") != "resolved":
        update_payload["resolved_by"] = current_user["id"]
        update_payload["resolved_at"] = datetime.now(timezone.utc).isoformat()

    client.table("contact_messages").update(update_payload).eq("id", message_id).execute()

    write_audit_log(
        action="ADMIN_SUPPORT_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="contact_messages",
        entity_id=message_id,
        payload={"old_status": existing.get("status"), "new_status": payload.status},
    )

    return {"message": "Support request updated successfully."}
