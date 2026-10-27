import logging
import os
from datetime import datetime, timezone
from typing import Optional, cast

import httpx
from dotenv import load_dotenv
from fastapi import (
    APIRouter,
    Cookie,
    HTTPException,
    Request,
    Response,
    status,
)
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr

import login_rate_limit
from account_status import describe_login_block
from app_settings import SKIP_AADHAR_SETTING_KEY, get_setting
from audit import write_audit_log
from auth import get_current_user
from db import service_supabase
from referral_utils import ensure_referral_code, find_referrer_user_id
from routers.otp import send_signup_otps

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FRONTEND_ORIGINS = os.getenv("FRONTEND_ORIGINS", "")

COOKIE_SECURE = (
    os.getenv("COOKIE_SECURE", "false").lower() == "true"
)

COOKIE_SAMESITE = os.getenv(
    "COOKIE_SAMESITE",
    "lax",
)

ACCESS_COOKIE = "myyajmaan_access"
REFRESH_COOKIE = "myyajmaan_refresh"

# Short-lived, distinct from the real session cookies above. Set instead
# of a full session when an account still has must_change_password set
# (a bulk-uploaded Pandit Ji's first login with their temp password, or
# any pandit whose password admin just reset) -- it authorizes exactly
# one call, POST /auth/set-new-password, and nothing else in the app.
PWRESET_COOKIE = "myyajmaan_pwreset"
PWRESET_MAX_AGE_SECONDS = 15 * 60

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


def api_error(code: str, message: str) -> dict:
    return {
        "code": code,
        "message": message,
    }


def login_client_metadata(request: Request) -> dict:
    user_agent = request.headers.get("user-agent", "")
    user_agent_lower = user_agent.lower()

    if "android" in user_agent_lower:
        device_type = "android"
    elif "iphone" in user_agent_lower or "ipad" in user_agent_lower:
        device_type = "ios"
    elif user_agent:
        device_type = "web"
    else:
        device_type = "unknown"

    return {
        "device_id": request.headers.get("x-device-id"),
        "device_name": user_agent[:500] or None,
        "device_type": device_type,
        "ip_address": request.client.host if request.client else None,
    }


def write_login_history(
    user_id: Optional[str],
    request: Request,
    login_status: str,
) -> None:
    if service_supabase is None:
        return

    try:
        service_supabase.table("login_history").insert({
            "user_id": user_id,
            "login_status": login_status,
            **login_client_metadata(request),
        }).execute()
    except Exception:
        logger.exception("Could not record login history for user %s", user_id)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str
    referral_code: Optional[str] = None
    agreed_to_terms: bool = False


class LoginIn(BaseModel):
    email: EmailStr
    password: str
    # Which login screen this came from — "customer" (the default
    # /login page) or "pandit" (/pandit/login) — so the backend can
    # reject a login attempt made from the wrong portal before ever
    # establishing a session, instead of just hiding the mismatch in
    # the frontend after the cookie has already been set. Admin never
    # authenticates through this endpoint at all (see /admin/auth/login).
    portal: Optional[str] = None


class PanditRegisterIn(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    state: str
    city: str
    password: str
    agreed_to_terms: bool = False


class ProfileOut(BaseModel):
    id: str
    auth_uid: Optional[str] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None


def set_auth_cookies(
    response: Response,
    session: dict,
):
    """
    Stores Supabase session tokens in HttpOnly cookies.

    React cannot read these values.
    """

    access_token = session.get("access_token")
    refresh_token = session.get("refresh_token")

    if access_token:
        response.set_cookie(
            key=ACCESS_COOKIE,
            value=access_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=int(
                session.get("expires_in", 3600)
            ),
            path="/",
        )

    if refresh_token:
        response.set_cookie(
            key=REFRESH_COOKIE,
            value=refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=60 * 60 * 24 * 30,
            path="/",
        )


def clear_auth_cookies(response: Response):
    response.delete_cookie(
        key=ACCESS_COOKIE,
        path="/",
    )

    response.delete_cookie(
        key=REFRESH_COOKIE,
        path="/",
    )


async def supabase_signup(
    email: str,
    password: str,
    full_name: str,
    phone: str,
):
    """
    Creates a customer through the public Supabase signup API.

    This does not use /auth/v1/admin/users.
    """

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "AUTH_CONFIGURATION_ERROR",
                "Authentication service is not configured.",
            ),
        )

    signup_url = f"{SUPABASE_URL}/auth/v1/signup"

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "email": email,
        "password": password,
        "data": {
            "full_name": full_name,
            "phone": phone,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            result = await client.post(
                signup_url,
                headers=headers,
                json=payload,
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "AUTH_SERVICE_UNAVAILABLE",
                "Registration service is temporarily unavailable.",
            ),
        )

    try:
        data = result.json()
    except Exception:
        data = {}

    if result.status_code not in (200, 201):
        error_code = None

        if isinstance(data, dict):
            error_code = (
                data.get("error_code")
                or data.get("code")
                or data.get("error")
            )

        if error_code in (
            "user_already_exists",
            "email_exists",
            "user_exists",
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=api_error(
                    "USER_ALREADY_EXISTS",
                    "An account with this email already exists. Please log in instead.",
                ),
            )

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "REGISTRATION_FAILED",
                "We could not create your account. Please check your details and try again.",
            ),
        )

    auth_user = data.get("user") or data

    if not auth_user or not auth_user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "AUTH_USER_NOT_CREATED",
                "Your account could not be created. Please try again.",
            ),
        )

    return auth_user, data.get("session")


async def supabase_password_login(
    email: str,
    password: str,
    request: Optional[Request] = None,
):
    """
    Authenticates a user through Supabase password login.

    `request` is only present for a real public login attempt (/auth/login,
    /admin/auth/login) -- the self-service "confirm your current password"
    callers (client_settings.py, admin_settings.py) pass none, since an
    already-authenticated user re-typing their own password isn't the
    brute-force scenario this guards against, and rate-limiting it would
    just lock people out of changing their password after a typo or two.
    """

    ip_address = login_client_metadata(request)["ip_address"] if request else None

    if request:
        try:
            login_rate_limit.check_login_rate_limit(email, ip_address)
        except login_rate_limit.LoginRateLimitedError as exc:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=api_error(exc.code, exc.message),
            )

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "AUTH_CONFIGURATION_ERROR",
                "Authentication service is not configured.",
            ),
        )

    login_url = (
        f"{SUPABASE_URL}/auth/v1/token"
        "?grant_type=password"
    )

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "email": email,
        "password": password,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            result = await client.post(
                login_url,
                headers=headers,
                json=payload,
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "AUTH_SERVICE_UNAVAILABLE",
                "Login service is temporarily unavailable.",
            ),
        )

    try:
        data = result.json()
    except Exception:
        data = {}

    if result.status_code != 200:
        if request:
            write_login_history(None, request, "failed")
            login_rate_limit.record_login_attempt(email, ip_address, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "INVALID_CREDENTIALS",
                "The email or password is incorrect.",
            ),
        )

    if not data.get("access_token"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "LOGIN_FAILED",
                "Login failed. Please try again.",
            ),
        )

    if request:
        # A correct password is what matters for the brute-force counter,
        # not whatever happens afterward (account blocked, wrong portal,
        # etc. -- those are the caller's own business-rule checks, not a
        # sign the password itself was guessed) -- resets the streak so a
        # few mistyped attempts don't linger against a legitimate owner
        # who then got it right.
        login_rate_limit.record_login_attempt(email, ip_address, success=True)

    return data


async def get_supabase_user_from_token(
    access_token: str,
):
    """
    Gets the Supabase Auth user from an access token.
    """

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "AUTH_CONFIGURATION_ERROR",
                "Authentication service is not configured.",
            ),
        )

    user_url = f"{SUPABASE_URL}/auth/v1/user"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": SUPABASE_ANON_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            result = await client.get(
                user_url,
                headers=headers,
            )
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "AUTH_SERVICE_UNAVAILABLE",
                "Authentication service is temporarily unavailable.",
            ),
        )

    if result.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "SESSION_EXPIRED",
                "Your session has expired. Please log in again.",
            ),
        )

    return result.json()


async def get_profile_from_auth_uid(
    auth_uid: str,
):
    """
    Loads the application profile from public.users.
    """

    if service_supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "DATABASE_NOT_CONFIGURED",
                "Application database is not configured.",
            ),
        )

    try:
        result = (
            service_supabase
            .table("users")
            .select(
                "id, auth_uid, email, full_name, phone, role, must_change_password, signup_verification_pending"
            )
            .eq("auth_uid", auth_uid)
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "PROFILE_LOOKUP_FAILED",
                "We could not load your account profile.",
            ),
        )

    if getattr(result, "error", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "PROFILE_LOOKUP_FAILED",
                "We could not load your account profile.",
            ),
        )

    rows = result.data or []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "PROFILE_NOT_FOUND",
                "Your account profile could not be found.",
            ),
        )

    return rows[0]


async def revoke_supabase_session(
    access_token: Optional[str],
) -> None:
    """
    Best-effort revocation of a Supabase session.

    Ends the refresh token tied to the given access token so a
    session that gets replaced in this browser cannot silently
    keep working elsewhere. Uses scope=local so it only ends this
    one session, not every session the account may have (e.g. a
    mobile app login).
    """

    if not access_token or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return

    logout_url = f"{SUPABASE_URL}/auth/v1/logout?scope=local"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "apikey": SUPABASE_ANON_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(logout_url, headers=headers)
    except Exception:
        logger.warning(
            "Could not revoke the previous session during login switch.",
            exc_info=True,
        )


async def force_logout_previous_session(
    previous_access_token: str,
    new_profile: dict,
) -> None:
    """
    Ends whatever session this browser already held before a new
    login succeeds.

    A single browser must never hold two active accounts at once
    (e.g. an admin session and a customer session, or two
    different customers). Every login endpoint calls this with
    whatever access-token cookie was already present.
    """

    old_profile = None

    try:
        old_auth_user = await get_supabase_user_from_token(
            previous_access_token
        )
        old_profile = await get_profile_from_auth_uid(
            old_auth_user["id"]
        )
    except Exception:
        old_profile = None

    await revoke_supabase_session(previous_access_token)

    if old_profile and str(old_profile["id"]) != str(new_profile["id"]):
        write_audit_log(
            action="AUTH_FORCED_LOGOUT",
            actor_id=str(new_profile["id"]),
            entity="users",
            entity_id=str(old_profile["id"]),
            payload={
                "reason": "new_login_replaced_browser_session",
                "previous_email": old_profile.get("email"),
                "previous_role": old_profile.get("role"),
                "new_email": new_profile.get("email"),
                "new_role": new_profile.get("role"),
            },
        )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterIn,
    response: Response,
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Customer registration.

    Public registration always creates role = user.
    The role is never accepted from the frontend.
    """

    email = str(payload.email).strip().lower()
    full_name = payload.full_name.strip()
    phone = payload.phone.strip()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "FULL_NAME_REQUIRED",
                "Please enter your full name.",
            ),
        )

    if not phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "PHONE_REQUIRED",
                "Please enter your phone number.",
            ),
        )

    if len(payload.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "PASSWORD_TOO_SHORT",
                "Password must contain at least 6 characters.",
            ),
        )

    if not payload.agreed_to_terms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "TERMS_NOT_ACCEPTED",
                "Please agree to the Privacy Policy and Terms and Conditions to continue.",
            ),
        )

    if service_supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "DATABASE_NOT_CONFIGURED",
                "Registration database is not configured.",
            ),
        )

    # Checked before creating anything in Supabase Auth -- that only
    # enforces email uniqueness on its own, never phone, and checking
    # first here avoids creating an orphaned auth user for the
    # phone-collision case.
    #
    # Two separate, fully parameterized .eq() lookups rather than one
    # .or_(f"email.eq.{email},phone.eq.{phone}") -- phone is free-text
    # user input with no format restriction, and PostgREST's OR syntax
    # treats commas/parens/dots as filter-expression syntax, so
    # building that filter by string-interpolating raw input would let
    # a crafted phone value change which column/condition actually gets
    # checked (a filter-injection hole on a public, unauthenticated
    # endpoint).
    existing_email_resp = service_supabase.table("users").select("id").eq("email", email).limit(1).execute()
    existing_phone_resp = service_supabase.table("users").select("id").eq("phone", phone).limit(1).execute()
    if getattr(existing_email_resp, "data", None) or getattr(existing_phone_resp, "data", None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error(
                "ACCOUNT_ALREADY_EXISTS",
                "An account is already associated with this email or phone number. Please log in instead.",
            ),
        )

    auth_user, session = await supabase_signup(
        email=email,
        password=payload.password,
        full_name=full_name,
        phone=phone,
    )

    profile = {
        "auth_uid": auth_user["id"],
        "email": email,
        "full_name": full_name,
        "phone": phone,
        "role": "user",
        "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
        # No login until the email and phone OTPs have both been
        # entered once (see routers/otp.py).
        "signup_verification_pending": True,
    }

    try:
        profile_result = (
            service_supabase
            .table("users")
            .upsert(
                profile,
                on_conflict="auth_uid",
            )
            .select(
                "id, auth_uid, email, full_name, phone, role, signup_verification_pending"
            )
            .execute()
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "PROFILE_CREATE_FAILED",
                "Your account was created, but your profile could not be completed.",
            ),
        )

    if getattr(profile_result, "error", None):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "PROFILE_CREATE_FAILED",
                "Your account was created, but your profile could not be completed.",
            ),
        )

    rows = profile_result.data or []

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "PROFILE_CREATE_FAILED",
                "Your account was created, but your profile could not be completed.",
            ),
        )

    created_profile = rows[0]

    # The signup bonus and the referrer's reward are NOT paid here --
    # they are granted once the email + phone OTPs are both verified
    # (signup_rewards.grant_signup_rewards, called from routers/otp.py).
    # Only the referral link itself is recorded now.

    # Give the new user their own shareable referral code right away.
    ensure_referral_code(created_profile["id"], full_name=created_profile.get("full_name"))

    referral_code = (payload.referral_code or "").strip()
    if referral_code:
        referrer_id = find_referrer_user_id(referral_code)

        if referrer_id and referrer_id != created_profile["id"]:
            try:
                service_supabase.table("users").update(
                    {"referred_by": referrer_id}
                ).eq("id", created_profile["id"]).execute()
            except Exception:
                # Referral linking is best-effort — a failure here must
                # never block the account from being created.
                logger.exception(
                    "Could not link referral for new user %s",
                    created_profile["id"],
                )

    # Deliberately no session cookies here: the account can't be used
    # until both OTPs are verified, and login (which then sets the
    # cookies) is the only way in. Supabase may have returned a
    # session for the new auth user; it is simply not handed out.

    write_audit_log(
        action="AUTH_REGISTER",
        actor_id=str(created_profile["id"]),
        entity="users",
        entity_id=str(created_profile["id"]),
        payload={
            "email": created_profile.get("email"),
            "role": created_profile.get("role"),
            "registration_type": "customer",
        },
    )

    otp_results = await send_signup_otps(cast(dict, created_profile))

    return {
        "message": (
            "Your account was created. "
            "Please verify your email and phone number to continue."
        ),
        "user": created_profile,
        "verification_required": True,
        "otp": otp_results,
    }


@router.post("/login")
async def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Logs in through Supabase and creates HttpOnly cookies.
    """

    email = str(payload.email).strip().lower()

    session = await supabase_password_login(
        email=email,
        password=payload.password,
        request=request,
    )

    auth_user = await get_supabase_user_from_token(
        session["access_token"]
    )

    profile = await get_profile_from_auth_uid(
        auth_user["id"]
    )
    profile_dict = cast(dict, profile)

    # Self-registered accounts can't log in until the one-time email +
    # phone OTP verification is done. Checked only after the password
    # was accepted (supabase_password_login raises otherwise), so this
    # never reveals anything to someone without the credentials.
    if profile_dict.get("signup_verification_pending"):
        write_login_history(str(profile_dict["id"]), request, "failed")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(
                "VERIFICATION_REQUIRED",
                "Please verify your email and phone number to continue.",
            ),
        )

    block_reason = describe_login_block(profile_dict)

    if not block_reason:
        # Portal enforcement: admin never authenticates through this
        # shared endpoint (it has its own /admin/auth/login), and a
        # role mismatch between the login screen used and the
        # account's real role is rejected here — before any cookie is
        # set — rather than only being caught client-side afterward.
        account_role = profile_dict.get("role")
        if account_role == "admin":
            block_reason = "Admin accounts must sign in from the Admin portal."
        elif payload.portal == "pandit" and account_role != "pandit":
            block_reason = "This login is for Pandit Ji accounts. Please use the customer login."
        elif payload.portal == "customer" and account_role == "pandit":
            block_reason = "This account is registered as a Pandit Ji. Please use the Pandit Ji login."

    if block_reason:
        write_login_history(str(profile_dict["id"]), request, "failed")
        write_audit_log(
            action="AUTH_LOGIN_BLOCKED",
            actor_id=str(profile_dict["id"]),
            entity="users",
            entity_id=str(profile_dict["id"]),
            payload={
                "email": profile_dict.get("email"),
                "role": profile_dict.get("role"),
                "reason": block_reason,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error("ACCOUNT_DISABLED", block_reason),
        )

    if profile_dict.get("must_change_password"):
        # Valid credentials (a temp password from a bulk upload, or a
        # password admin just reset), but no real app session is
        # granted until a new password is set. Only a short-lived,
        # single-purpose cookie is issued -- it authorizes exactly
        # POST /auth/set-new-password and nothing else.
        response.set_cookie(
            key=PWRESET_COOKIE,
            value=session["access_token"],
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=PWRESET_MAX_AGE_SECONDS,
            path="/",
        )

        write_login_history(str(profile_dict["id"]), request, "success")
        write_audit_log(
            action="AUTH_LOGIN_TEMP_PASSWORD",
            actor_id=str(profile_dict["id"]),
            entity="users",
            entity_id=str(profile_dict["id"]),
            payload={
                "email": profile_dict.get("email"),
                "role": profile_dict.get("role"),
            },
        )

        return {
            "must_change_password": True,
            "role": profile_dict.get("role"),
            "message": "Please set a new password to continue.",
        }

    if myyajmaan_access and myyajmaan_access != session.get("access_token"):
        # A different session was already active in this browser
        # (e.g. an admin or another customer). Only one account can
        # be signed in per browser at a time, so end it here.
        await force_logout_previous_session(
            myyajmaan_access, profile_dict,
        )

    set_auth_cookies(response, session)

    write_login_history(str(profile_dict["id"]), request, "success"); write_audit_log(
        action="AUTH_LOGIN",
        actor_id=str(profile_dict["id"]),
        entity="users",
        entity_id=str(profile_dict["id"]),
        payload={
            "email": profile_dict.get("email"),
            "role": profile_dict.get("role"),
            "login_method": "email_password",
        },
    )

    return {
        "message": "Login successful.",
        "user": profile,
    }


class SetNewPasswordIn(BaseModel):
    new_password: str


@router.post("/set-new-password")
async def set_new_password(
    payload: SetNewPasswordIn,
    myyajmaan_pwreset: Optional[str] = Cookie(
        default=None,
        alias=PWRESET_COOKIE,
    ),
):
    """
    Completes the mandatory password change after a login with a
    temporary password (a bulk-uploaded Pandit Ji's first login, or
    any pandit whose password admin just reset). Only reachable with
    the short-lived cookie /auth/login issues in that specific case --
    never with a normal session.

    On success the account is signed out (per the required flow: set
    a new password, then log back in with it) rather than left signed
    in here.
    """

    if not myyajmaan_pwreset:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "PASSWORD_RESET_SESSION_EXPIRED",
                "Your password-reset session has expired. Please log in again with your temporary password.",
            ),
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=api_error("PASSWORD_TOO_SHORT", "Password must contain at least 6 characters."),
        )

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail=api_error("AUTH_CONFIGURATION_ERROR", "Authentication service is not configured."))

    auth_user = await get_supabase_user_from_token(myyajmaan_pwreset)
    profile = cast(dict, await get_profile_from_auth_uid(auth_user["id"]))

    update_url = f"{SUPABASE_URL}/auth/v1/admin/users/{profile['auth_uid']}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            update_resp = await client.put(update_url, headers=headers, json={"password": payload.new_password})
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail=api_error("AUTH_SERVICE_UNAVAILABLE", "Authentication service is temporarily unavailable."))

    if update_resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=api_error("PASSWORD_UPDATE_FAILED", "Could not update your password. Please try again."))

    service_supabase.table("users").update({"must_change_password": False}).eq("id", profile["id"]).execute()

    # is_active is only ever set True by admin's approve_pandit() now
    # (bulk-uploaded pandits go through the same review as anyone
    # else -- see routers/admin_pandits.py's bulk-upload) -- nothing
    # here needs to touch it.
    await revoke_supabase_session(myyajmaan_pwreset)

    write_audit_log(
        action="AUTH_PASSWORD_SET_AFTER_TEMP_LOGIN",
        actor_id=str(profile["id"]),
        entity="users",
        entity_id=str(profile["id"]),
        payload={"email": profile.get("email"), "role": profile.get("role")},
    )

    response = JSONResponse(
        {
            "message": "Password updated successfully. Please log in again with your new password.",
            "role": profile.get("role"),
        }
    )
    response.delete_cookie(key=PWRESET_COOKIE, path="/")
    return response


class ForgotPasswordIn(BaseModel):
    email: EmailStr


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """
    Standard self-service "forgot password" for customers and Pandit
    Ji accounts (admin is intentionally excluded -- the Admin portal
    has no self-service reset). Always responds with the same generic
    message regardless of whether the email is on file, so this can't
    be used to probe which emails have accounts.
    """

    generic_response = {
        "message": "If an account exists with this email, we've sent a password reset link to it.",
    }

    email = str(payload.email).strip().lower()

    if service_supabase is None or not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return generic_response

    lookup = (
        service_supabase.table("users")
        .select("id, email, role")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    rows = getattr(lookup, "data", None) or []
    if not rows or rows[0].get("role") not in ("user", "pandit"):
        return generic_response

    account = rows[0]
    frontend_origin = (FRONTEND_ORIGINS.split(",")[0] or "").strip() or "http://localhost:3000"
    redirect_to = f"{frontend_origin}/reset-password"

    recover_url = f"{SUPABASE_URL}/auth/v1/recover"
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            await client.post(
                recover_url,
                headers=headers,
                json={"email": email, "options": {"redirect_to": redirect_to}},
            )
    except httpx.RequestError:
        logger.warning("Could not reach Supabase to send a password reset email.", exc_info=True)
        return generic_response

    write_audit_log(
        action="AUTH_PASSWORD_RESET_REQUESTED",
        actor_id=str(account["id"]),
        entity="users",
        entity_id=str(account["id"]),
        payload={"email": email, "role": account.get("role")},
    )

    return generic_response


class PasswordResetConfirmedIn(BaseModel):
    access_token: str


@router.post("/password-reset-confirmed")
async def password_reset_confirmed(payload: PasswordResetConfirmedIn):
    """
    Called by the /reset-password page right after the Supabase SDK
    has successfully updated the account's password via a recovery
    link. Not itself responsible for changing the password -- just
    records the audit trail and clears must_change_password if it
    happened to be set.
    """

    auth_user = await get_supabase_user_from_token(payload.access_token)
    profile = cast(dict, await get_profile_from_auth_uid(auth_user["id"]))

    if profile.get("must_change_password"):
        service_supabase.table("users").update({"must_change_password": False}).eq("id", profile["id"]).execute()

    await revoke_supabase_session(payload.access_token)

    write_audit_log(
        action="AUTH_PASSWORD_RESET_COMPLETED",
        actor_id=str(profile["id"]),
        entity="users",
        entity_id=str(profile["id"]),
        payload={"email": profile.get("email"), "role": profile.get("role")},
    )

    return {"message": "Password updated successfully.", "role": profile.get("role")}


@router.get("/me")
async def me(
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Returns the currently authenticated application profile.
    """

    if not myyajmaan_access:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "NOT_AUTHENTICATED",
                "Please log in to continue.",
            ),
        )
    auth_user = await get_supabase_user_from_token(
        myyajmaan_access
    )

    profile = await get_profile_from_auth_uid(
        auth_user["id"]
    )

    # Same real-time check as auth.get_current_user() (used by every
    # role-protected business endpoint) -- without it here too, a
    # disabled account's header/session state wouldn't reflect the
    # change until it happened to hit a protected endpoint, even
    # though this exact "am I logged in" check is what most pages
    # call first.
    block_reason = describe_login_block(cast(dict, profile))
    if block_reason:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error("ACCOUNT_DISABLED", block_reason),
        )

    return {
        "user": profile,
    }


@router.post("/refresh")
async def refresh(
    response: Response,
    myyajmaan_refresh: Optional[str] = Cookie(
        default=None,
        alias=REFRESH_COOKIE,
    ),
):
    """
    Refreshes the access token using the HttpOnly refresh cookie.
    """

    if not myyajmaan_refresh:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "REFRESH_TOKEN_MISSING",
                "Your session has expired. Please log in again.",
            ),
        )

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=api_error(
                "AUTH_CONFIGURATION_ERROR",
                "Authentication service is not configured.",
            ),
        )

    refresh_url = (
        f"{SUPABASE_URL}/auth/v1/token"
        "?grant_type=refresh_token"
    )

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
    }

    payload = {
        "refresh_token": myyajmaan_refresh,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            result = await client.post(
                refresh_url,
                headers=headers,
                json=payload,
            )
    except httpx.RequestError:
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=api_error(
                "AUTH_SERVICE_UNAVAILABLE",
                "Authentication service is temporarily unavailable.",
            ),
        )

    if result.status_code != 200:
        clear_auth_cookies(response)

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "REFRESH_FAILED",
                "Your session has expired. Please log in again.",
            ),
        )

    session = result.json()

    set_auth_cookies(response, session)

    return {
        "message": "Session refreshed.",
    }


@router.post("/logout")
async def logout(
    response: Response,
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Clears the authentication cookies and creates an audit entry.
    """

    if myyajmaan_access:
        try:
            current_user = await get_current_user(
                myyajmaan_access=myyajmaan_access,
            )

            write_audit_log(
                action="AUTH_LOGOUT",
                actor_id=str(current_user["id"]),
                entity="users",
                entity_id=str(current_user["id"]),
                payload={
                    "email": current_user.get("email"),
                    "role": current_user.get("role"),
                },
            )
        except Exception:
            # Logout should still clear cookies even if audit fails.
            pass

    clear_auth_cookies(response)

    return {
        "message": "Logged out successfully.",
    }


@router.post("/pandit/register", status_code=status.HTTP_201_CREATED)
async def register_pandit(payload: PanditRegisterIn, response: Response):
    first_name = payload.first_name.strip()
    last_name = payload.last_name.strip()
    full_name = f"{first_name} {last_name}".strip()
    email = str(payload.email).strip().lower()
    phone = payload.phone.strip()
    state = payload.state.strip()
    city = payload.city.strip()

    if not first_name or not last_name or not phone or not state or not city:
        raise HTTPException(status_code=400, detail=api_error("PANDIT_DETAILS_REQUIRED", "Please complete all required details."))
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail=api_error("PASSWORD_TOO_SHORT", "Password must contain at least 6 characters."))
    if not payload.agreed_to_terms:
        raise HTTPException(status_code=400, detail=api_error("TERMS_NOT_ACCEPTED", "Please agree to the Privacy Policy and Terms and Conditions to continue."))
    if service_supabase is None:
        raise HTTPException(status_code=500, detail=api_error("DATABASE_NOT_CONFIGURED", "Registration database is not configured."))

    auth_user, _session = await supabase_signup(email, payload.password, full_name, phone)
    profile = {
        "auth_uid": auth_user["id"],
        "email": email,
        "full_name": full_name,
        "phone": phone,
        "role": "pandit",
        "metadata": {"registration_type": "pandit", "city": city, "state": state, "approval_status": "pending"},
        "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
        # No login until the email and phone OTPs have both been
        # entered once (see routers/otp.py).
        "signup_verification_pending": True,
    }

    try:
        profile_result = service_supabase.table("users").upsert(profile, on_conflict="auth_uid").select("id, auth_uid, email, full_name, phone, role, metadata, signup_verification_pending").execute()
        if getattr(profile_result, "error", None) or not profile_result.data:
            raise RuntimeError("profile insert failed")
        created_profile = profile_result.data[0]
        skip_aadhar = bool(get_setting(SKIP_AADHAR_SETTING_KEY, False))
        pandit_record = {
            "user_id": created_profile["id"], "name": full_name, "display_name": full_name, "city": city, "state": state,
            "is_active": False, "metadata": {"approval_status": "pending"},
            # Admin's global "skip Aadhaar for new registrations" toggle
            # (Admin Settings > Pandit Ji Registration) -- falls back to
            # manual Aadhaar-card-image review instead of OTP.
            "aadhar_verification_status": "skipped" if skip_aadhar else "not_started",
        }
        existing_pandit = service_supabase.table("pandits").select("id").eq("user_id", created_profile["id"]).limit(1).execute()
        if getattr(existing_pandit, "error", None):
            raise RuntimeError(str(existing_pandit.error))

        if existing_pandit.data:
            pandit_result = service_supabase.table("pandits").update(pandit_record).eq("id", existing_pandit.data[0]["id"]).execute()
        else:
            pandit_result = service_supabase.table("pandits").insert(pandit_record).execute()

        if getattr(pandit_result, "error", None):
            raise RuntimeError(str(pandit_result.error))
    except Exception as exc:
        logger.exception("Pandit profile creation failed for user %s: %s", created_profile.get("id"), exc)
        raise HTTPException(status_code=500, detail=api_error("PANDIT_PROFILE_CREATE_FAILED", "Your account was created, but your Pandit profile could not be completed."))

    write_audit_log(action="AUTH_REGISTER", actor_id=str(created_profile["id"]), entity="users", entity_id=str(created_profile["id"]), payload={"email": email, "role": "pandit", "registration_type": "pandit", "city": city, "state": state, "approval_status": "pending"})

    otp_results = await send_signup_otps(cast(dict, created_profile))

    return {
        "message": "Pandit registration completed. Please verify your email and phone number to continue.",
        "user": created_profile,
        "verification_required": True,
        "otp": otp_results,
    }