import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect

from auth import ACCESS_COOKIE, get_current_user
from db import service_supabase
from notifications import manager
from routers.auth import get_profile_from_auth_uid, get_supabase_user_from_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Notification service is not configured.")
    return service_supabase


@router.get("")
async def list_notifications(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=6, ge=1, le=50),
    current_user: dict = Depends(get_current_user),
):
    """
    Unread notifications only, newest first -- the bell's dropdown is
    an inbox of things still needing attention, not a permanent log
    (once read, a notification leaves this list for good). Paginated
    by plain offset rather than a created_at cursor: several
    notifications can legitimately share the same timestamp (e.g. a
    booking that fans out to every admin in one loop), which would
    make a `created_at <` cursor skip or duplicate rows at that
    boundary. Offset costs a little more at scale but is exactly
    correct regardless, and this list is never large enough for that
    trade-off to matter.
    """

    client = _client()
    resp = (
        client.table("notifications")
        .select("*")
        .eq("user_id", current_user["id"])
        .eq("is_read", False)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    items = getattr(resp, "data", None) or []

    return {"items": items, "has_more": len(items) == limit}


@router.get("/unread-count")
async def get_unread_count(current_user: dict = Depends(get_current_user)):
    client = _client()
    resp = (
        client.table("notifications")
        .select("id", count="exact")
        .eq("user_id", current_user["id"])
        .eq("is_read", False)
        .execute()
    )
    return {"count": getattr(resp, "count", None) or 0}


@router.patch("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    client = _client()
    resp = (
        client.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", current_user["id"])
        .select("id")
        .execute()
    )
    if not getattr(resp, "data", None):
        raise HTTPException(status_code=404, detail="Notification not found.")
    return {"message": "Marked as read."}


@router.patch("/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    client = _client()
    client.table("notifications").update({"is_read": True}).eq("user_id", current_user["id"]).eq(
        "is_read", False
    ).execute()
    return {"message": "All notifications marked as read."}


# The frontend reaches REST through Vercel's /api rewrite (so the session
# cookie is first-party), but Vercel can't proxy a WebSocket -- the
# socket has to go straight to the API host, where that cookie isn't
# sent. So the page first fetches a short-lived signed ticket over REST
# (cookie-authenticated) and passes it on the socket URL instead.
WS_TICKET_TTL_SECONDS = 60


def _ws_ticket_key() -> bytes:
    secret = os.getenv("WS_TICKET_SECRET") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
    return hashlib.sha256(f"ws-ticket:{secret}".encode()).digest()


def _make_ws_ticket(user_id: str) -> str:
    body = base64.urlsafe_b64encode(
        json.dumps({"uid": user_id, "exp": int(time.time()) + WS_TICKET_TTL_SECONDS}).encode()
    ).decode().rstrip("=")
    signature = hmac.new(_ws_ticket_key(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _read_ws_ticket(ticket: str) -> Optional[str]:
    try:
        body, signature = ticket.split(".", 1)
        expected = hmac.new(_ws_ticket_key(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        data = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if int(data["exp"]) < time.time():
            return None
        return str(data["uid"])
    except (ValueError, KeyError, TypeError):
        return None


@router.get("/ws-ticket")
async def get_ws_ticket(current_user: dict = Depends(get_current_user)):
    return {"ticket": _make_ws_ticket(str(current_user["id"])), "expires_in": WS_TICKET_TTL_SECONDS}


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket):
    """
    One connection per open tab/device. Authenticated by a ticket from
    GET /notifications/ws-ticket (see above), or -- when the frontend
    and API share a host, e.g. local dev -- by the same HttpOnly
    session cookie every REST request uses, read directly off the
    handshake since a WebSocket can't use FastAPI's Depends() cookie
    parsing.
    """

    ticket = websocket.query_params.get("ticket")
    if ticket:
        user_id = _read_ws_ticket(ticket)
        if not user_id:
            await websocket.close(code=4401)
            return
    else:
        access_token = websocket.cookies.get(ACCESS_COOKIE)
        if not access_token:
            await websocket.close(code=4401)
            return

        try:
            auth_user = await get_supabase_user_from_token(access_token)
            profile = await get_profile_from_auth_uid(auth_user["id"])
        except HTTPException:
            await websocket.close(code=4401)
            return

        user_id = str(profile["id"])

    await websocket.accept()
    await manager.connect(user_id, websocket)

    try:
        while True:
            # The client never needs to send anything meaningful; this
            # just blocks until the socket closes so we notice the
            # disconnect and clean up.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(user_id, websocket)
