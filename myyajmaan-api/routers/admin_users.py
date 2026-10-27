import csv
import io
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_admin_roles

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

ACTIVE_FLAG_TYPES = ("banned", "suspended")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin user service is not configured.")
    return service_supabase


def _blocked_user_ids() -> set:
    """User ids that currently have an active moderation flag."""
    resp = (
        _client()
        .table("user_flags")
        .select("user_id")
        .eq("is_active", True)
        .in_("flag_type", ACTIVE_FLAG_TYPES)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return {row["user_id"] for row in rows}


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = sanitize_or_filter_term(search.strip().replace("%", ""))
    if not term:
        return query
    return query.or_(
        f"full_name.ilike.%{term}%,email.ilike.%{term}%,phone.ilike.%{term}%"
    )


def _user_status(user: dict, blocked_ids: set) -> str:
    if user["id"] in blocked_ids:
        return "blocked"
    return "active" if user.get("is_active") else "inactive"


@router.get("/counts")
async def get_user_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    blocked_ids = _blocked_user_ids()

    counts = {}
    for tab in ("all", "active", "inactive", "blocked"):
        query = client.table("users").select("id", count="exact").eq("role", "user")
        query = _apply_search(query, search)

        if tab == "active":
            query = query.eq("is_active", True)
        elif tab == "inactive":
            query = query.eq("is_active", False)
        elif tab == "blocked":
            if not blocked_ids:
                counts[tab] = 0
                continue
            query = query.in_("id", list(blocked_ids))

        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0

        if tab in ("active", "inactive") and blocked_ids:
            # Active/inactive counts above may include blocked accounts; subtract them.
            overlap_resp = (
                client.table("users")
                .select("id", count="exact")
                .eq("role", "user")
                .eq("is_active", tab == "active")
                .in_("id", list(blocked_ids))
                .execute()
            )
            counts[tab] -= getattr(overlap_resp, "count", None) or 0

    return counts


def _fetch_users_page(client, status_filter: str, search: Optional[str], page: int, page_size: int):
    blocked_ids = _blocked_user_ids()

    query = client.table("users").select(
        "id, full_name, email, phone, role, is_active, profile_image, created_at",
        count="exact",
    ).eq("role", "user")
    query = _apply_search(query, search)

    if status_filter == "active":
        query = query.eq("is_active", True)
        if blocked_ids:
            query = query.not_.in_("id", list(blocked_ids))
    elif status_filter == "inactive":
        query = query.eq("is_active", False)
        if blocked_ids:
            query = query.not_.in_("id", list(blocked_ids))
    elif status_filter == "blocked":
        if not blocked_ids:
            return [], 0
        query = query.in_("id", list(blocked_ids))

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0

    for row in rows:
        row["status"] = _user_status(row, blocked_ids)

    return rows, total


@router.get("")
async def list_users(
    status_filter: str = Query(default="all", alias="status"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all", "active", "inactive", "blocked"):
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    rows, total = _fetch_users_page(_client(), status_filter, search, page, page_size)

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/export")
async def export_users(
    status_filter: str = Query(default="all", alias="status"),
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    rows, _ = _fetch_users_page(_client(), status_filter, search, page=1, page_size=5000)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Name", "Email", "Phone", "Role", "Status", "Joined On"])
    for row in rows:
        writer.writerow(
            [
                row.get("full_name") or "",
                row.get("email") or "",
                row.get("phone") or "",
                row.get("role") or "",
                row.get("status") or "",
                row.get("created_at") or "",
            ]
        )
    buffer.seek(0)

    write_audit_log(
        action="ADMIN_USERS_EXPORTED",
        actor_id=str(current_user["id"]),
        entity="users",
        payload={"status": status_filter, "search": search, "row_count": len(rows)},
    )

    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"},
    )


@router.get("/{user_id}")
async def get_user_detail(
    user_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("users").select("*").eq("id", user_id).single().execute()
    user = getattr(resp, "data", None)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    flags_resp = (
        client.table("user_flags")
        .select("id, flag_type, reason, is_active, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    flags = getattr(flags_resp, "data", None) or []

    bookings_resp = (
        client.table("bookings").select("id", count="exact").eq("client_id", user_id).execute()
    )
    total_bookings = getattr(bookings_resp, "count", None) or 0

    user["status"] = _user_status(user, _blocked_user_ids())
    user.pop("password_hash", None)

    return {"user": user, "flags": flags, "total_bookings": total_bookings}


class UpdateUserStatusIn(BaseModel):
    status: str = Field(pattern="^(active|inactive|blocked)$")
    reason: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: str,
    payload: UpdateUserStatusIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()

    existing_resp = client.table("users").select("id, role, is_active, full_name, email").eq("id", user_id).single().execute()
    existing = getattr(existing_resp, "data", None)
    if not existing:
        raise HTTPException(status_code=404, detail="User not found.")

    if existing.get("role") != "user":
        raise HTTPException(status_code=400, detail="This account cannot be managed from Users.")

    if payload.status == "blocked" and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="A reason is required to block a user.")

    old_status = _user_status(existing, _blocked_user_ids())

    # Deactivate any existing moderation flags before applying the new status.
    client.table("user_flags").update({"is_active": False}).eq("user_id", user_id).eq("is_active", True).execute()

    client.table("users").update({"is_active": payload.status == "active"}).eq("id", user_id).execute()

    if payload.status == "blocked":
        client.table("user_flags").insert(
            {
                "user_id": user_id,
                "flag_type": "banned",
                "reason": payload.reason.strip(),
                "flagged_by": current_user["id"],
                "is_active": True,
            }
        ).execute()

    write_audit_log(
        action="ADMIN_USER_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=user_id,
        payload={
            "old_status": old_status,
            "new_status": payload.status,
            "reason": payload.reason,
            "target_email": existing.get("email"),
        },
    )

    return {"message": "User status updated successfully.", "status": payload.status}
