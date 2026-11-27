"""
LOCAL TESTING ONLY. Gives every approved Pandit Ji a handful of random
(normal, non-package) pujas and a weekly availability pattern, so the
"Book from a Pandit Ji's page" flow has something to work with.

  - Every Pandit Ji gets Satyanarayan Puja (if it exists) plus 6-9
    random others, some at their own price (price_override).
  - Availability patterns rotate through a few shapes -- weekends-only
    evenings, weekday mornings, all week, none set (= always free) --
    so "next available date & time" lands on different days/times.
  - Idempotent: pandit_puja rows are upserted on (pandit_id, puja_id);
    re-running reshuffles nothing (fixed random seed).

Refuses to run unless SUPABASE_URL points at localhost.

    cd myyajmaan-api
    .venv/Scripts/python scripts/seed_local_pandit_pujas.py
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import service_supabase  # noqa: E402

ALL_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Rotated across pandits in created_at order; Lokesh Sharma is pinned to
# the weekend-evenings one (see SPECIFIC_PATTERNS).
PATTERNS = [
    {"days": ["sat", "sun"], "start_time": "17:00", "end_time": "21:00"},
    {"days": ["mon", "tue", "wed", "thu", "fri"], "start_time": "06:00", "end_time": "10:00"},
    {"days": ALL_DAYS, "start_time": "06:00", "end_time": "21:00"},
    {"days": ["tue", "thu", "sat"], "start_time": "11:00", "end_time": "14:00"},
    {},  # nothing set -- treated as always available
]
SPECIFIC_PATTERNS = {
    "lokesh sharma": PATTERNS[0],
}


def main():
    url = os.getenv("SUPABASE_URL", "")
    if "127.0.0.1" not in url and "localhost" not in url:
        sys.exit(f"Refusing to seed a non-local database ({url or 'SUPABASE_URL not set'}).")
    if service_supabase is None:
        sys.exit("Service Supabase client is not configured.")

    rng = random.Random(42)
    pandits = (
        service_supabase.table("pandits")
        .select("id, name, display_name")
        .eq("verification_status", "approved")
        .order("created_at")
        .execute()
        .data
    )
    pujas = service_supabase.table("pujas").select("id, title, base_price, puja_type, is_active").execute().data
    normal = [p for p in pujas if p.get("is_active") and (p.get("puja_type") or "normal") != "package"]
    satyanarayan = next((p for p in normal if "satyanarayan" in (p["title"] or "").lower()), None)

    for index, pandit in enumerate(pandits):
        name = (pandit.get("display_name") or pandit.get("name") or "").strip()
        picks = rng.sample(normal, k=min(len(normal), rng.randint(6, 9)))
        if satyanarayan and satyanarayan not in picks:
            picks.append(satyanarayan)

        rows = []
        for puja in picks:
            base = float(puja.get("base_price") or 0)
            # About half charge their own price, rounded to ₹100.
            override = round(base * rng.uniform(0.8, 1.3) / 100) * 100 if base and rng.random() < 0.5 else None
            rows.append({"pandit_id": pandit["id"], "puja_id": puja["id"], "price_override": override, "active": True})
        service_supabase.table("pandit_puja").upsert(rows, on_conflict="pandit_id,puja_id").execute()

        pattern = SPECIFIC_PATTERNS.get(name.lower(), PATTERNS[index % len(PATTERNS)])
        service_supabase.table("pandits").update({"availability_pattern": pattern}).eq("id", pandit["id"]).execute()

        when = f"{','.join(pattern['days'])} {pattern['start_time']}-{pattern['end_time']}" if pattern else "always"
        print(f"{name:<20} {len(rows):>2} pujas   available: {when}")


if __name__ == "__main__":
    main()
