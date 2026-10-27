"""
Two small, app-wide HTTP defenses that don't belong in any one router:

  - CsrfHeaderMiddleware: blocks cross-site request forgery against the
    cookie-authenticated API.
  - SecurityHeadersMiddleware: baseline response headers (clickjacking,
    MIME-sniffing, referrer leakage).

Wired up in main.py, added BEFORE CORSMiddleware so CORS ends up as the
outermost layer (Starlette applies middleware in reverse of
registration order) -- that's what lets a browser read a clean 4xx
JSON body instead of a bare CORS failure when either of these blocks
a request.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

# Session cookies are HttpOnly + SameSite=Lax (see routers/auth.py's
# set_auth_cookies), which already blocks a cross-site <form> POST/PUT/
# PATCH/DELETE navigation, and a JSON request body already forces a CORS
# preflight that only this app's own configured origins can pass (see
# FRONTEND_ORIGINS in main.py). This header closes the one gap those two
# don't cover on their own: a plain cross-site <form
# enctype="multipart/form-data"> targeting a file-upload endpoint is
# "simple" (no preflight) and would still carry the cookie if
# COOKIE_SAMESITE were ever set to "none" for some deployment. A
# same-site <form> (or curl/Postman) can't set custom headers without
# the caller deliberately choosing to -- so requiring one here doesn't
# depend on SameSite/CORS being configured exactly right everywhere,
# defense in depth rather than the only layer.
#
# This does NOT stop someone who already holds a valid session cookie
# (e.g. testing with Postman) from adding this header themselves and
# proceeding -- that's expected. CSRF defenses stop a victim's own
# browser being tricked into firing a request the victim never chose
# to send; they are not an access-control mechanism (that's what the
# per-role Depends() on every endpoint are for).
CSRF_HEADER_NAME = "x-requested-with"
CSRF_HEADER_VALUE = "XMLHttpRequest"

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Path prefixes allowed to skip the header check -- e.g. a future
# server-to-server payment-provider webhook, which by definition can't
# attach an app-chosen header and isn't cookie-authenticated anyway.
# Empty today; every current endpoint requires the header.
CSRF_EXEMPT_PREFIXES: tuple[str, ...] = ()


class CsrfHeaderMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        if request.method not in SAFE_METHODS and not request.url.path.startswith(CSRF_EXEMPT_PREFIXES):
            if request.headers.get(CSRF_HEADER_NAME, "").lower() != CSRF_HEADER_VALUE.lower():
                return JSONResponse(
                    status_code=403,
                    content={
                        "detail": {
                            "code": "CSRF_HEADER_MISSING",
                            "message": "This request could not be verified. Please refresh the page and try again.",
                        }
                    },
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        # The app is never meant to be framed by another site (nothing
        # in it embeds itself in an iframe either) -- clickjacking
        # defense, a cross-site attack class in its own right.
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        # geolocation=(self): BrowsePanditsMap.jsx's "use my location"
        # needs it; every other sensitive browser API stays off.
        response.headers.setdefault("Permissions-Policy", "geolocation=(self), microphone=(), camera=()")
        return response
