import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException
from pydantic import BaseModel, Field

from audit import write_audit_log
from db import service_supabase
from permissions import require_roles
from routers.auth import ACCESS_COOKIE, supabase_password_login

router = APIRouter(prefix="/me", tags=["client-settings"])

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

LANGUAGE_VALUES = ("english", "hindi", "marathi", "gujarati")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Profile service is not configured.")
    return service_supabase


@router.get("/profile")
async def get_my_profile(current_user: dict = Depends(require_roles("user"))):
    client = _client()
    resp = (
        client.table("users")
        .select("full_name, email, phone, date_of_birth, gender, address, language, created_at")
        .eq("id", current_user["id"])
        .single()
        .execute()
    )
    return {"profile": getattr(resp, "data", None)}


class ProfileIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=6, max_length=20)
    date_of_birth: str = Field(min_length=1)
    gender: str = Field(min_length=1, max_length=20)
    address: str = Field(min_length=1, max_length=500)
    language: str = Field(pattern="^(english|hindi|marathi|gujarati)$")


@router.put("/profile")
async def update_my_profile(
    payload: ProfileIn,
    current_user: dict = Depends(require_roles("user")),
):
    client = _client()

    columns = {
        "full_name": payload.full_name.strip(),
        "phone": payload.phone.strip(),
        "date_of_birth": payload.date_of_birth,
        "gender": payload.gender.strip(),
        "address": payload.address.strip(),
        "language": payload.language,
    }

    resp = (
        client.table("users")
        .update(columns)
        .eq("id", current_user["id"])
        .select("full_name, email, phone, date_of_birth, gender, address, language, created_at")
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save your profile.")

    write_audit_log(
        action="CLIENT_PROFILE_UPDATED",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"full_name": columns["full_name"]},
    )

    return {"message": "Profile updated successfully.", "profile": rows[0]}


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=200)


@router.post("/change-password")
async def change_my_password(
    payload: ChangePasswordIn,
    current_user: dict = Depends(require_roles("user")),
    myyajmaan_access: Optional[str] = Cookie(default=None, alias=ACCESS_COOKIE),
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Authentication service is not configured.")

    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email on file.")

    # Confirms the user actually knows the current password before
    # allowing a change -- same verify-then-update pattern as the
    # admin Settings page's change_password.
    try:
        await supabase_password_login(email=email, password=payload.current_password)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Your current password is incorrect.")

    auth_uid = current_user.get("auth_uid")
    if not auth_uid:
        raise HTTPException(status_code=500, detail="Your account is missing its auth reference.")

    update_url = f"{SUPABASE_URL}/auth/v1/admin/users/{auth_uid}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.put(update_url, headers=headers, json={"password": payload.new_password})
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service is temporarily unavailable.")

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Could not update your password. Please try again.")

    # Signs out every other active session for this account, not this
    # one -- same follow-through as the admin password change.
    if myyajmaan_access:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{SUPABASE_URL}/auth/v1/logout?scope=others",
                    headers={
                        "Authorization": f"Bearer {myyajmaan_access}",
                        "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    },
                )
        except Exception:
            logger.warning("Could not revoke other sessions after password change.", exc_info=True)

    write_audit_log(
        action="CLIENT_PASSWORD_CHANGED",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"email": email},
    )

    return {"message": "Your password has been updated successfully."}
