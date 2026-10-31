"""
Short-lived in-memory cache for the public, read-only GET endpoints the
home and booking pages call on every visit (pujas, festivals, offers,
coupons, reviews, CMS, public settings...). Their answers are the same
for every visitor and change only when admin edits something, yet each
visit used to re-query Supabase -- and the home page fires ~12 of them
at once, which queued up on the small Render instance.

  - Only the whitelisted public paths below are cached, and only 200
    responses. Anything per-user (/auth, /me, /pandit/me, /admin,
    bookings, wallet...) never matches, and neither does Pandit Ji
    availability for a given puja/date/city.
  - Entries live RESPONSE_CACHE_TTL_SECONDS (default 60s; 0 disables).
  - Any successful POST/PUT/PATCH/DELETE clears the whole cache, so an
    admin edit shows straight away (on this worker; another uvicorn
    worker catches up within the TTL).
  - Browsers may reuse these responses for BROWSER_MAX_AGE seconds.
  - Every cacheable response carries X-Cache: HIT or MISS.

Pure ASGI (not BaseHTTPMiddleware) so a cached answer is sent without
ever reaching the route or its thread pool.
"""

import os
import re
import threading
import time
from collections import OrderedDict
from urllib.parse import parse_qsl, urlencode

TTL_SECONDS = int(os.getenv("RESPONSE_CACHE_TTL_SECONDS", "60") or 0)
BROWSER_MAX_AGE = 30
MAX_ENTRIES = 300

# Public GET paths whose response doesn't depend on who is asking.
_CACHEABLE = [
    re.compile(p)
    for p in [
        r"^/pujas$",
        r"^/pujas/[^/]+$",
        r"^/festivals$",
        r"^/festivals/[^/]+$",
        r"^/offers$",
        r"^/coupons$",
        r"^/reviews/published$",
        r"^/cms/[^/]+$",
        r"^/settings/(booking|pricing|social-links)$",
        r"^/muhrat/next$",
        r"^/referral/rewards$",
        r"^/cities$",
        r"^/pandits$",
        r"^/pandits/[^/]+$",
        r"^/pandits/[^/]+/pujas$",
    ]
]
# Pandit Ji search for a specific puja/date/slot/city reflects live
# availability -- always fresh.
_LIVE_PARAMS = {"/pandits": {"puja_id", "date", "timeslot", "city"}}

_store = OrderedDict()  # key -> (expires_at, status, headers, body)
_lock = threading.Lock()


def clear():
    with _lock:
        _store.clear()


def _cache_key(scope):
    path = scope.get("path", "")
    if not any(p.match(path) for p in _CACHEABLE):
        return None
    params = parse_qsl(scope.get("query_string", b"").decode("latin-1"), keep_blank_values=True)
    if _LIVE_PARAMS.get(path, set()) & {name for name, value in params if value}:
        return None
    return f"{path}?{urlencode(sorted(params))}"


def _get(key):
    with _lock:
        entry = _store.get(key)
        if not entry:
            return None
        if entry[0] < time.monotonic():
            del _store[key]
            return None
        return entry


def _put(key, status, headers, body):
    with _lock:
        _store[key] = (time.monotonic() + TTL_SECONDS, status, headers, body)
        _store.move_to_end(key)
        while len(_store) > MAX_ENTRIES:
            _store.popitem(last=False)


def _with_cache_headers(headers, state):
    kept = [(k, v) for k, v in headers if k.lower() not in (b"cache-control", b"x-cache")]
    return kept + [
        (b"cache-control", f"public, max-age={BROWSER_MAX_AGE}".encode()),
        (b"x-cache", state.encode()),
    ]


class ResponseCacheMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or TTL_SECONDS <= 0:
            return await self.app(scope, receive, send)

        method = scope.get("method", "GET")
        if method not in ("GET", "HEAD", "OPTIONS"):
            return await self._passthrough_and_invalidate(scope, receive, send)
        if method != "GET":
            return await self.app(scope, receive, send)

        key = _cache_key(scope)
        if key is None:
            return await self.app(scope, receive, send)

        hit = _get(key)
        if hit:
            _, status, headers, body = hit
            await send({"type": "http.response.start", "status": status, "headers": _with_cache_headers(headers, "HIT")})
            await send({"type": "http.response.body", "body": body})
            return

        captured = {"status": None, "headers": [], "chunks": [], "ok": True}

        async def capture(message):
            if message["type"] == "http.response.start":
                captured["status"] = message["status"]
                captured["headers"] = list(message.get("headers", []))
                if message["status"] == 200:
                    message = {**message, "headers": _with_cache_headers(captured["headers"], "MISS")}
            elif message["type"] == "http.response.body":
                captured["chunks"].append(message.get("body", b""))
                if not message.get("more_body") and captured["status"] == 200 and captured["ok"]:
                    stored_headers = [(k, v) for k, v in captured["headers"] if k.lower() not in (b"set-cookie", b"content-length")]
                    body = b"".join(captured["chunks"])
                    stored_headers.append((b"content-length", str(len(body)).encode()))
                    _put(key, 200, stored_headers, body)
            await send(message)

        try:
            await self.app(scope, receive, capture)
        except Exception:
            captured["ok"] = False
            raise

    async def _passthrough_and_invalidate(self, scope, receive, send):
        async def watch(message):
            if message["type"] == "http.response.start" and message["status"] < 400:
                clear()
            await send(message)

        await self.app(scope, receive, watch)
