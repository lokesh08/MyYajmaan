"""
Real-time, in-app notifications shared by all three roles (customer,
Pandit Ji, admin). Two halves:

  - create_notification() / notify_user(): write a row to the
    `notifications` table and (if the recipient has an active
    WebSocket connection) push it to them immediately.
  - ConnectionManager: tracks each user's currently-open WebSocket
    connection(s) (a user can have more than one tab/device open) so
    a push can be fanned out to all of them.

Single-process, in-memory connection registry -- correct for this
app's current single-worker uvicorn deployment (same assumption the
rest of this codebase already makes, e.g. no cross-process pub/sub
anywhere else either). Moving to multiple workers/processes later
would need a shared broker (e.g. Redis pub/sub) instead of this dict.


HOW TO ADD A NEW NOTIFICATION TRIGGER
======================================

1. Import it in whichever router has the action:

       from notifications import notify_user

2. Right after the action succeeds (never before -- a notification
   must not be able to block or half-complete the real thing it's
   about), call it. It's async, so the endpoint must be `async def`
   (every router already is) and you `await` it:

       await notify_user(
           user_id=some_users_id,       # public.users.id of the RECIPIENT
           type="SOMETHING_HAPPENED",   # SCREAMING_SNAKE_CASE, unique-ish per event kind
           title="Short headline",      # shown bold in the panel
           message="One sentence with the specific detail.",  # optional, shown under the title
           link="/dashboard/bookings",  # optional, frontend route the click navigates to
           metadata={"booking_id": booking_id},  # optional, small dict for later use
       )

   That's the whole API -- one call, four meaningful fields
   (type/title/message/link). It writes the row AND pushes it live
   over the socket in the same call; nothing else to wire up.

3. Wrap it so it can never break the action it's attached to (every
   existing call site does this -- copy the pattern):

       try:
           await notify_user(...)
       except Exception:
           pass

   (notify_user() already swallows its own errors internally and
   logs them, so this is only extra insurance if you're doing lookups
   -- e.g. resolving a name -- in the same block.)

4. Two common recipient patterns already used throughout this file's
   callers:

   - You already have the user_id (e.g. booking["client_id"], or
     current_user["id"] for the actor's own account) -- just pass it.

   - You only have a PANDIT's `pandits.id`, not their `users.id` --
     resolve it first:

         pandit_resp = client.table("pandits").select("user_id").eq("id", pandit_id).limit(1).execute()
         rows = getattr(pandit_resp, "data", None) or []
         if rows and rows[0].get("user_id"):
             await notify_user(user_id=rows[0]["user_id"], ...)

   - You want every admin notified (used for anything admin-facing):

         admins_resp = client.table("users").select("id").eq("role", "admin").execute()
         for admin_row in getattr(admins_resp, "data", None) or []:
             await notify_user(user_id=admin_row["id"], ...)

5. Pick a real, working frontend route for `link` -- it's what the
   notification navigates to when clicked. If the ideal page doesn't
   exist yet, point at the closest real page rather than a "Coming
   Soon" placeholder (e.g. admin booking-related notifications
   currently link to /admin/wallet, since /admin/bookings isn't built
   yet -- update the link once it is).

See routers/bookings.py's create_booking(), routers/admin_pandits.py's
approve_pandit()/reject_pandit(), or routers/pandit_bookings.py's
respond_to_booking() for complete, real examples of all of the above.
"""

import logging
from typing import Optional

from fastapi import WebSocket

from db import service_supabase

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        self._connections.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        sockets = self._connections.get(user_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(user_id, None)

    async def push_to_user(self, user_id: str, payload: dict):
        sockets = list(self._connections.get(user_id, ()))
        if not sockets:
            return
        dead = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(user_id, socket)


manager = ConnectionManager()


def create_notification(
    user_id: str,
    type: str,
    title: str,
    message: Optional[str] = None,
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[dict]:
    """
    Synchronous DB write (mirrors write_audit_log's style elsewhere in
    this codebase) -- use notify_user() from an async route so the
    live WebSocket push happens too; call this directly only from a
    context where no push is needed/possible.
    """

    if service_supabase is None:
        logger.warning("Notification service not configured; skipping notification for %s", user_id)
        return None

    row = {
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "link": link,
        "metadata": metadata or {},
    }

    try:
        resp = service_supabase.table("notifications").insert(row).select("*").execute()
        rows = getattr(resp, "data", None) or []
        return rows[0] if rows else None
    except Exception:
        # A notification failing to write must never break the actual
        # action that triggered it (a booking, an approval, ...).
        logger.exception("Could not create notification for user %s (%s)", user_id, type)
        return None


async def notify_user(
    user_id: str,
    type: str,
    title: str,
    message: Optional[str] = None,
    link: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[dict]:
    """Creates the notification row and pushes it live if the user is connected."""

    row = create_notification(user_id, type, title, message, link, metadata)
    if row:
        try:
            await manager.push_to_user(user_id, {"event": "notification", "notification": row})
        except Exception:
            logger.exception("Could not push live notification to user %s", user_id)
    return row
