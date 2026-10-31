import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError

from response_cache import ResponseCacheMiddleware
from security_middleware import CsrfHeaderMiddleware, SecurityHeadersMiddleware

load_dotenv()

from routers import (
    admin_auth,
    admin_bookings,
    admin_complaints,
    admin_coupons,
    admin_dashboard,
    admin_muhrats,
    admin_package_bookings,
    admin_pandit_feedback,
    admin_pandits,
    admin_pujas,
    admin_reports,
    admin_reviews,
    admin_settings,
    admin_support,
    admin_users,
    admin_wallet,
    audit,
    auth,
    bookings,
    client_addresses,
    client_bookings,
    client_settings,
    client_wallet,
    complaints,
    coupons,
    cities,
    cms,
    contact,
    festivals,
    messaging,
    muhrats,
    notifications,
    offers,
    otp,
    package_bookings,
    pandit_aadhar,
    pandit_bookings,
    pandit_feedback,
    pandit_photos,
    pandit_profile,
    pandit_pujas,
    pandit_wallet,
    pandits,
    payments,
    public_settings,
    pujas,
    referrals,
    reviews,
    seo,
)

app = FastAPI(
    title="MyYajmaan API",
)

logger = logging.getLogger(__name__)

# Postgres/PostgREST error codes that mean "the request was bad", not
# "the server broke". Without this, any route that forgot to validate
# one of these cases (e.g. "" sent for a DATE column) surfaced as a bare
# 500 "Internal Server Error" the frontend can't explain to anyone.
DB_ERROR_RESPONSES = {
    "22007": (400, "INVALID_INPUT", "One of the dates or times entered is not valid."),
    "22008": (400, "INVALID_INPUT", "One of the dates or times entered is not valid."),
    "22P02": (400, "INVALID_INPUT", "One of the values entered is not in a valid format."),
    "22003": (400, "INVALID_INPUT", "One of the numbers entered is out of range."),
    "22001": (400, "INVALID_INPUT", "One of the values entered is too long."),
    "23502": (400, "MISSING_REQUIRED_FIELD", "A required field is missing."),
    "23514": (400, "INVALID_INPUT", "One of the values entered is not allowed."),
    "23503": (409, "RELATED_RECORD_CONFLICT", "This refers to a record that doesn't exist or is still in use."),
    "23505": (409, "ALREADY_EXISTS", "This record already exists."),
    "PGRST116": (404, "NOT_FOUND", "The requested record was not found."),
    # Routes that query with the user's own token (RLS): an expired or
    # malformed JWT is a session problem, and SESSION_EXPIRED is what
    # makes the frontend refresh the session and retry.
    "PGRST301": (401, "SESSION_EXPIRED", "Your session has expired. Please log in again."),
    "PGRST303": (401, "SESSION_EXPIRED", "Your session has expired. Please log in again."),
}


@app.exception_handler(APIError)
async def database_error_handler(request: Request, exc: APIError):
    status_code, code, message = DB_ERROR_RESPONSES.get(
        exc.code or "",
        (500, "DATABASE_ERROR", "Something went wrong while saving. Please try again."),
    )
    log = logger.exception if status_code >= 500 else logger.warning
    log("Database error on %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status_code,
        content={"detail": {"code": code, "message": message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    # FastAPI's default 422 body is a list the frontend can't display
    # (it fell back to "Something went wrong"). Name the first bad field
    # in plain words; the full list stays under "errors".
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = next((str(part) for part in reversed(first.get("loc", ())) if not isinstance(part, int)), "")
    field_label = field.replace("_", " ").capitalize()
    message = f"{field_label}: {first.get('msg', 'is invalid')}" if field_label and field not in ("body", "query") else "Some of the details entered are not valid."
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "VALIDATION_ERROR", "message": message, "errors": jsonable_encoder(errors)}},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception):
    # Same {"detail": {code, message}} shape every other error uses, so the
    # frontend shows a readable message instead of "status code 500".
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again."}},
    )

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# Registered before CORSMiddleware so CORS ends up outermost (Starlette
# applies middleware in reverse of registration order) -- see
# security_middleware.py for why that ordering matters.
# Innermost: cached public responses still pass through the security
# and CORS layers below/around it (see response_cache.py).
app.add_middleware(ResponseCacheMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CsrfHeaderMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin_auth.router)
app.include_router(admin_bookings.router)
app.include_router(admin_package_bookings.router)
app.include_router(admin_complaints.router)
app.include_router(admin_coupons.router)
app.include_router(admin_dashboard.router)
app.include_router(admin_muhrats.router)
app.include_router(admin_pandit_feedback.router)
app.include_router(admin_pandits.router)
app.include_router(admin_pujas.router)
app.include_router(admin_reports.router)
app.include_router(admin_reviews.router)
app.include_router(admin_settings.router)
app.include_router(admin_support.router)
app.include_router(admin_users.router)
app.include_router(admin_wallet.router)
app.include_router(audit.router)
app.include_router(bookings.router)
app.include_router(package_bookings.router)
app.include_router(client_addresses.router)
app.include_router(client_bookings.router)
app.include_router(complaints.router)
app.include_router(client_settings.router)
app.include_router(client_wallet.router)
app.include_router(coupons.router)
app.include_router(cities.router)
app.include_router(cms.public_router)
app.include_router(cms.admin_router)
app.include_router(contact.router)
app.include_router(festivals.router)
app.include_router(muhrats.router)
app.include_router(notifications.router)
app.include_router(messaging.router)
app.include_router(offers.router)
app.include_router(otp.router)
app.include_router(pandit_aadhar.router)
app.include_router(pandit_bookings.router)
app.include_router(pandit_feedback.router)
app.include_router(pandit_photos.router)
app.include_router(pandit_profile.router)
app.include_router(pandit_pujas.router)
app.include_router(pandit_wallet.router)
app.include_router(pandits.router)
app.include_router(payments.router)
app.include_router(public_settings.router)
app.include_router(pujas.router)
app.include_router(referrals.router)
app.include_router(reviews.router)
app.include_router(seo.router)


@app.get("/")
def health():
    return {
        "status": "ok",
    }