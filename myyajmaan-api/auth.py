import os
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import Cookie, Depends, HTTPException, status

from account_status import describe_login_block
from db import service_supabase

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

ACCESS_COOKIE = "myyajmaan_access"


def api_error(code: str, message: str) -> dict:
    return {
        "code": code,
        "message": message,
    }


async def get_bearer_token(
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Compatibility function.

    The name is preserved so existing routers do not need
    immediate changes. It now reads the HttpOnly cookie instead
    of an Authorization header.
    """

    return myyajmaan_access


async def get_current_user(
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """
    Validates the Supabase access token from the HttpOnly cookie
    and returns the application user profile.
    """

    if not myyajmaan_access:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "NOT_AUTHENTICATED",
                "Please log in to continue.",
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

    headers = {
        "Authorization": f"Bearer {myyajmaan_access}",
        "apikey": SUPABASE_ANON_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
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

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "SESSION_EXPIRED",
                "Your session has expired. Please log in again.",
            ),
        )

    auth_user = response.json()
    auth_uid = auth_user.get("id")

    if not auth_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "INVALID_AUTH_USER",
                "Authentication failed. Please log in again.",
            ),
        )

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
            .select("*")
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

    profiles = result.data or []

    if not profiles:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error(
                "PROFILE_NOT_FOUND",
                "Your account profile could not be found.",
            ),
        )

    profile = profiles[0]

    # Real-time check on every authenticated request -- not just at
    # login -- so an account admin disables mid-session is cut off
    # immediately (their Supabase access token is still cryptographically
    # valid for up to an hour otherwise; this doesn't wait for that).
    # The row was already fetched above, so this costs nothing extra.
    block_reason = describe_login_block(profile)
    if block_reason:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=api_error("ACCOUNT_DISABLED", block_reason),
        )

    return profile