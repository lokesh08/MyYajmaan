from typing import Optional, cast

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status

from audit import write_audit_log
from permissions import require_admin_roles
from routers.auth import (
    ACCESS_COOKIE,
    LoginIn,
    api_error,
    clear_auth_cookies,
    force_logout_previous_session,
    get_profile_from_auth_uid,
    get_supabase_user_from_token,
    set_auth_cookies,
    supabase_password_login,
    write_login_history,
)

router = APIRouter(prefix="/admin/auth", tags=["admin-auth"])


@router.post("/login")
async def admin_login(
    payload: LoginIn,
    request: Request,
    response: Response,
    myyajmaan_access: Optional[str] = Cookie(
        default=None,
        alias=ACCESS_COOKIE,
    ),
):
    """Authenticates an admin account through the hidden admin portal only."""
    email = str(payload.email).strip().lower()

    session = await supabase_password_login(
        email=email,
        password=payload.password,
        request=request,
    )

    auth_user = await get_supabase_user_from_token(session["access_token"])
    profile = await get_profile_from_auth_uid(auth_user["id"])

    if profile.get("role") != "admin":
        write_login_history(str(profile["id"]), request, "failed")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=api_error(
                "NOT_AN_ADMIN_ACCOUNT",
                "This account does not have admin access.",
            ),
        )

    if myyajmaan_access and myyajmaan_access != session.get("access_token"):
        # A different session was already active in this browser
        # (e.g. a customer or Pandit Ji account). Only one account
        # can be signed in per browser at a time, so end it here.
        await force_logout_previous_session(
            myyajmaan_access, cast(dict, profile),
        )

    set_auth_cookies(response, session)
    write_login_history(str(profile["id"]), request, "success")
    write_audit_log(
        action="ADMIN_LOGIN",
        actor_id=str(profile["id"]),
        entity="users",
        entity_id=str(profile["id"]),
        payload={"email": profile.get("email")},
    )

    return {"message": "Login successful.", "user": profile}


@router.get("/me")
async def admin_me(current_user: dict = Depends(require_admin_roles())):
    return {"user": current_user}


@router.post("/logout")
async def admin_logout(response: Response, current_user: dict = Depends(require_admin_roles())):
    write_audit_log(
        action="ADMIN_LOGOUT",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"email": current_user.get("email")},
    )
    clear_auth_cookies(response)
    return {"message": "Logged out successfully."}
