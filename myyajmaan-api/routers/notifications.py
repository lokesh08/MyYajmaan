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


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket):
    """
    One connection per open tab/device. Authenticated the same way as
    every REST request -- the same HttpOnly session cookie -- read
    directly off the handshake request since a WebSocket can't carry
    an Authorization header or use FastAPI's normal Depends() cookie
    parsing.
    """

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
