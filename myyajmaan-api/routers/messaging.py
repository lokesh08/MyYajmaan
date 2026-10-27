"""
Messaging Center: internal person-to-person mail between any two
registered users (Yajmaan, Pandit Ji, Admin), plus a unified Inbox that
merges it with the existing system notifications (see notifications.py
-- untouched, still the source of every booking/decline/etc. alert).

One shared router for all three roles: get_current_user resolves the
same way regardless of role/cookie (confirmed against permissions.py),
so a single require_roles("user", "pandit", "admin") dependency covers
every endpoint here -- no need for three near-duplicate routers.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import sanitize_or_filter_term, service_supabase
from notifications import manager
from permissions import require_admin_roles, require_roles

router = APIRouter(prefix="/messaging", tags=["messaging"])

ANY_ROLE = require_roles("user", "pandit", "admin")

ROLE_LABELS = {"user": "Yajmaan", "pandit": "Pandit Ji", "admin": "Admin"}


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Messaging service is not configured.")
    return service_supabase


def _role_label(role: Optional[str]) -> str:
    return ROLE_LABELS.get(role, "User")


def _find_user_by_email(client, email: str) -> Optional[dict]:
    resp = (
        client.table("users")
        .select("id, full_name, email, role")
        .ilike("email", email.strip())
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None


# ---------------------------------------------------------------------
# Inbox (merged: notifications + received messages)
# ---------------------------------------------------------------------

@router.get("/inbox")
async def list_inbox(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(ANY_ROLE),
):
    """
    Everything addressed to me, newest first -- unlike the notification
    bell's dropdown (which only ever shows unread ones), this is a
    permanent log: read items stay visible, just no longer bolded.
    Pulled from two tables and merged in Python (same "merge, don't
    join" style used elsewhere in this codebase, e.g.
    admin_bookings.py's _attach_details) since they're differently
    shaped and PostgREST can't UNION them for us.
    """
    client = _client()

    # Over-fetch each source by (offset + limit) so the merged,
    # re-sorted result can still be sliced correctly -- neither source
    # alone tells us how many of the other kind sort in between.
    fetch_n = offset + limit

    notif_resp = (
        client.table("notifications")
        .select("id, type, title, message, link, is_read, created_at")
        .eq("user_id", current_user["id"])
        .order("created_at", desc=True)
        .limit(fetch_n)
        .execute()
    )
    notif_rows = getattr(notif_resp, "data", None) or []

    msg_resp = (
        client.table("messages")
        .select("id, sender_id, subject, body, is_read, created_at")
        .eq("recipient_id", current_user["id"])
        .eq("status", "sent")
        .order("created_at", desc=True)
        .limit(fetch_n)
        .execute()
    )
    msg_rows = getattr(msg_resp, "data", None) or []

    sender_ids = [row["sender_id"] for row in msg_rows]
    senders_by_id = {}
    if sender_ids:
        senders_resp = client.table("users").select("id, full_name, role").in_("id", sender_ids).execute()
        senders_by_id = {row["id"]: row for row in (getattr(senders_resp, "data", None) or [])}

    items = []
    for row in notif_rows:
        items.append({
            "id": row["id"],
            "kind": "notification",
            "title": row["title"],
            "body": row.get("message"),
            "from_name": "MyYajmaan",
            "is_read": row["is_read"],
            "link": row.get("link"),
            "created_at": row["created_at"],
        })
    for row in msg_rows:
        sender = senders_by_id.get(row["sender_id"]) or {}
        sender_name = sender.get("full_name") or "Unknown user"
        role_label = _role_label(sender.get("role"))
        items.append({
            "id": row["id"],
            "kind": "message",
            "title": row["subject"],
            "body": row.get("body"),
            "from_name": f"{sender_name} ({role_label})",
            "is_read": row["is_read"],
            "link": None,
            "created_at": row["created_at"],
        })

    items.sort(key=lambda item: item["created_at"], reverse=True)
    page = items[offset : offset + limit]
    return {"items": page, "has_more": len(items) > offset + limit}


@router.get("/unread-count")
async def get_messaging_unread_count(current_user: dict = Depends(ANY_ROLE)):
    client = _client()
    notif_resp = (
        client.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .eq("is_read", False)
        .execute()
    )
    msg_resp = (
        client.table("messages")
        .select("id", count="exact")
        .eq("recipient_id", current_user["id"])
        .eq("status", "sent")
        .eq("is_read", False)
        .execute()
    )
    notif_count = getattr(notif_resp, "count", None) or 0
    msg_count = getattr(msg_resp, "count", None) or 0
    return {"count": notif_count + msg_count}


@router.patch("/inbox/{item_id}/read")
async def mark_inbox_item_read(
    item_id: str,
    kind: str = Query(...),
    current_user: dict = Depends(ANY_ROLE),
):
    if kind not in ("notification", "message"):
        raise HTTPException(status_code=400, detail="kind must be 'notification' or 'message'.")

    client = _client()
    table = "notifications" if kind == "notification" else "messages"
    owner_column = "user_id" if kind == "notification" else "recipient_id"

    resp = (
        client.table(table)
        .update({"is_read": True})
        .eq("id", item_id)
        .eq(owner_column, current_user["id"])
        .select("id")
        .execute()
    )
    if not getattr(resp, "data", None):
        raise HTTPException(status_code=404, detail="Item not found.")
    return {"message": "Marked as read."}


# ---------------------------------------------------------------------
# Sent / Drafts
# ---------------------------------------------------------------------

@router.get("/sent")
async def list_sent(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(ANY_ROLE),
):
    client = _client()
    resp = (
        client.table("messages")
        .select("*", count="exact")
        .eq("sender_id", current_user["id"])
        .eq("status", "sent")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    _attach_recipient_names(client, rows)
    return {"items": rows, "total": getattr(resp, "count", None) or 0}


@router.get("/drafts")
async def list_drafts(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(ANY_ROLE),
):
    client = _client()
    resp = (
        client.table("messages")
        .select("*", count="exact")
        .eq("sender_id", current_user["id"])
        .eq("status", "draft")
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    _attach_recipient_names(client, rows)
    return {"items": rows, "total": getattr(resp, "count", None) or 0}


def _attach_recipient_names(client, rows: list):
    recipient_ids = [row["recipient_id"] for row in rows if row.get("recipient_id")]
    if not recipient_ids:
        return rows
    resp = client.table("users").select("id, full_name, email, role").in_("id", recipient_ids).execute()
    users_by_id = {row["id"]: row for row in (getattr(resp, "data", None) or [])}
    for row in rows:
        recipient = users_by_id.get(row.get("recipient_id")) or {}
        row["recipient_name"] = recipient.get("full_name")
        row["recipient_email"] = recipient.get("email")
        row["recipient_role"] = recipient.get("role")
    return rows


# ---------------------------------------------------------------------
# Recipient lookup / search
# ---------------------------------------------------------------------

@router.get("/lookup-recipient")
async def lookup_recipient(
    email: str = Query(..., min_length=3),
    current_user: dict = Depends(ANY_ROLE),
):
    """
    Exact (case-insensitive) email match only -- deliberately NOT a
    fuzzy/partial search, so a Yajmaan or Pandit Ji can reach anyone by
    email (per your "anyone to anyone" call) without being able to
    browse or enumerate the platform's full user directory. Admin gets
    a real search instead, see /messaging/search-users below.
    """
    client = _client()
    user = _find_user_by_email(client, email)
    if not user:
        raise HTTPException(status_code=404, detail="No user found with that email address.")
    if user["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't send a message to yourself.")
    return {
        "id": user["id"],
        "full_name": user.get("full_name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "role_label": _role_label(user.get("role")),
    }


@router.get("/search-users")
async def search_users_for_compose(
    q: str = Query(default="", max_length=100),
    current_user: dict = Depends(require_admin_roles()),
):
    """Admin-only: a real name/email search across every role, for the compose autocomplete."""
    if not q.strip():
        return {"items": []}
    client = _client()
    term = sanitize_or_filter_term(q.strip().replace("%", ""))
    resp = (
        client.table("users")
        .select("id, full_name, email, role")
        .or_(f"full_name.ilike.%{term}%,email.ilike.%{term}%")
        .neq("id", current_user["id"])
        .limit(10)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    for row in rows:
        row["role_label"] = _role_label(row.get("role"))
    return {"items": rows}


# ---------------------------------------------------------------------
# Compose / send / save-as-draft
# ---------------------------------------------------------------------

class ComposeIn(BaseModel):
    recipient_email: str = Field(min_length=3, max_length=200)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    save_as_draft: bool = False


@router.post("", status_code=201)
async def compose_message(
    payload: ComposeIn,
    current_user: dict = Depends(ANY_ROLE),
):
    client = _client()
    recipient = _find_user_by_email(client, payload.recipient_email)
    if not recipient:
        raise HTTPException(status_code=404, detail="No user found with that email address.")
    if recipient["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't send a message to yourself.")

    now = datetime.now(timezone.utc).isoformat()

    record = {
        "sender_id": current_user["id"],
        "recipient_id": recipient["id"],
        "subject": payload.subject.strip(),
        "body": payload.body.strip(),
        "status": "draft" if payload.save_as_draft else "sent",
        "sent_at": None if payload.save_as_draft else now,
    }
    resp = client.table("messages").insert(record).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save this message.")
    message = rows[0]

    if not payload.save_as_draft:
        await _push_new_message(recipient["id"], message, current_user)
        write_audit_log(
            action="MESSAGE_SENT",
            actor_id=str(current_user["id"]),
            entity="messages",
            entity_id=message["id"],
            payload={"recipient_id": recipient["id"], "subject": payload.subject},
        )

    return {"message": message}


class UpdateDraftIn(BaseModel):
    recipient_email: str = Field(min_length=3, max_length=200)
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    save_as_draft: bool = True


@router.patch("/drafts/{draft_id}")
async def update_draft(
    draft_id: str,
    payload: UpdateDraftIn,
    current_user: dict = Depends(ANY_ROLE),
):
    client = _client()
    existing = (
        client.table("messages")
        .select("id, status")
        .eq("id", draft_id)
        .eq("sender_id", current_user["id"])
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing, "data", None) or []
    if not existing_rows:
        raise HTTPException(status_code=404, detail="Draft not found.")
    if existing_rows[0].get("status") != "draft":
        raise HTTPException(status_code=400, detail="This message has already been sent and can't be edited.")

    recipient = _find_user_by_email(client, payload.recipient_email)
    if not recipient:
        raise HTTPException(status_code=404, detail="No user found with that email address.")
    if recipient["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't send a message to yourself.")

    now = datetime.now(timezone.utc).isoformat()

    update = {
        "recipient_id": recipient["id"],
        "subject": payload.subject.strip(),
        "body": payload.body.strip(),
        "status": "draft" if payload.save_as_draft else "sent",
        "sent_at": None if payload.save_as_draft else now,
        "updated_at": now,
    }
    resp = client.table("messages").update(update).eq("id", draft_id).select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not update this draft.")
    message = rows[0]

    if not payload.save_as_draft:
        await _push_new_message(recipient["id"], message, current_user)
        write_audit_log(
            action="MESSAGE_SENT",
            actor_id=str(current_user["id"]),
            entity="messages",
            entity_id=message["id"],
            payload={"recipient_id": recipient["id"], "subject": payload.subject, "from_draft": True},
        )

    return {"message": message}


@router.delete("/drafts/{draft_id}", status_code=204)
async def delete_draft(
    draft_id: str,
    current_user: dict = Depends(ANY_ROLE),
):
    client = _client()
    resp = (
        client.table("messages")
        .delete()
        .eq("id", draft_id)
        .eq("sender_id", current_user["id"])
        .eq("status", "draft")
        .select("id")
        .execute()
    )
    if not getattr(resp, "data", None):
        raise HTTPException(status_code=404, detail="Draft not found.")
    return None


async def _push_new_message(recipient_id: str, message: dict, sender: dict):
    """
    Live delivery over the *same* WebSocket connection/endpoint
    notifications already use (/notifications/ws) -- reuses the
    already-open per-user socket registry (notifications.py's
    ConnectionManager) rather than standing up a second connection.
    Best-effort: a failed push must never fail the send that already
    succeeded (the message is already saved either way).
    """
    try:
        payload = dict(message)
        payload["from_name"] = f"{sender.get('full_name') or 'Someone'} ({_role_label(sender.get('role'))})"
        await manager.push_to_user(recipient_id, {"event": "message", "message": payload})
    except Exception:
        pass
