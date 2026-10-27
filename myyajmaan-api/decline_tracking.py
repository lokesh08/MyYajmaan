"""
Shared by admin_bookings.py, admin_pandits.py and pandit_bookings.py --
a pandit's consecutive-decline streak, and their durable decline history,
both computed from booking_assignment_events rather than bookings.pandit_id
(which gets overwritten the moment admin reassigns a booking away from
them, per reassign_booking() in admin_bookings.py).
"""

from typing import Optional


def get_consecutive_declines(client, pandit_id: str) -> int:
    """
    Counts the leading run of 'pandit_declined' events for this pandit,
    newest first, stopping at the first 'pandit_accepted' (or when the
    event history runs out). A pandit who has never responded to
    anything, or whose most recent response was an accept, is 0.
    """
    resp = (
        client.table("booking_assignment_events")
        .select("action")
        .eq("previous_pandit_id", pandit_id)
        .in_("action", ["pandit_declined", "pandit_accepted"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    rows = getattr(resp, "data", None) or []

    streak = 0
    for row in rows:
        if row["action"] == "pandit_declined":
            streak += 1
        else:
            break
    return streak


def get_decline_alerts(client, threshold: int = 3) -> list:
    """
    Every pandit currently on a >= threshold consecutive-decline streak,
    worst first. Cheap enough for a dashboard banner: only pandits who
    have declined at all are considered (most have never declined).
    """
    declined_resp = (
        client.table("booking_assignment_events")
        .select("previous_pandit_id")
        .eq("action", "pandit_declined")
        .execute()
    )
    pandit_ids = list({row["previous_pandit_id"] for row in (getattr(declined_resp, "data", None) or []) if row.get("previous_pandit_id")})
    if not pandit_ids:
        return []

    pandits_resp = client.table("pandits").select("id, display_name, name, city").in_("id", pandit_ids).execute()
    pandits_by_id = {row["id"]: row for row in (getattr(pandits_resp, "data", None) or [])}

    alerts = []
    for pandit_id in pandit_ids:
        streak = get_consecutive_declines(client, pandit_id)
        if streak >= threshold:
            pandit = pandits_by_id.get(pandit_id, {})
            alerts.append(
                {
                    "pandit_id": pandit_id,
                    "name": pandit.get("display_name") or pandit.get("name") or "Pandit Ji",
                    "city": pandit.get("city"),
                    "current_streak": streak,
                }
            )

    alerts.sort(key=lambda a: a["current_streak"], reverse=True)
    return alerts
