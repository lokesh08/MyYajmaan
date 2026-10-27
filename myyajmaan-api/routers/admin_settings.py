import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app_settings import (
    BOOKING_MIN_LEAD_HOURS_KEY,
    GST_PERCENTAGE_KEY,
    INVOICE_COMPANY_ADDRESS_KEY,
    INVOICE_COMPANY_GSTIN_KEY,
    INVOICE_COMPANY_NAME_KEY,
    INVOICE_COMPANY_STATE_KEY,
    INVOICE_SAC_CODE_KEY,
    PLATFORM_FEE_KEY,
    PREMIUM_PACKAGE_FEE_KEY,
    SKIP_AADHAR_SETTING_KEY,
    SOCIAL_LINK_FACEBOOK_KEY,
    SOCIAL_LINK_INSTAGRAM_KEY,
    SOCIAL_LINK_LINKEDIN_KEY,
    SOCIAL_LINK_THREADS_KEY,
    SOCIAL_LINK_WHATSAPP_KEY,
    SOCIAL_LINK_X_TWITTER_KEY,
    SOCIAL_LINK_YOUTUBE_KEY,
    get_setting,
    set_setting,
)
from audit import write_audit_log
from permissions import require_admin_roles
from routers.auth import ACCESS_COOKIE, supabase_password_login

router = APIRouter(prefix="/admin/settings", tags=["admin-settings"])

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


@router.get("/profile")
async def get_admin_profile(current_user: dict = Depends(require_admin_roles())):
    return {
        "profile": {
            "id": current_user.get("id"),
            "full_name": current_user.get("full_name"),
            "email": current_user.get("email"),
            "phone": current_user.get("phone"),
            "role": current_user.get("role"),
        }
    }


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=200)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordIn,
    current_user: dict = Depends(require_admin_roles()),
    myyajmaan_access: Optional[str] = Cookie(default=None, alias=ACCESS_COOKIE),
):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Authentication service is not configured.")

    email = current_user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email on file.")

    # Confirms the admin actually knows the current password before
    # allowing a change — reuses the exact same login call as /auth/login.
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
            response = await client.put(
                update_url,
                headers=headers,
                json={"password": payload.new_password},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service is temporarily unavailable.")

    if response.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Could not update your password. Please try again.")

    # Signs out every OTHER active session for this account (not this
    # one, so the admin isn't logged out of the tab they just used
    # this from) — a standard security follow-through after a
    # password change.
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
        action="ADMIN_PASSWORD_CHANGED",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"email": email},
    )

    return {"message": "Your password has been updated successfully."}


@router.get("/pandit-registration")
async def get_pandit_registration_settings(current_user: dict = Depends(require_admin_roles())):
    return {"skip_aadhar_verification": bool(get_setting(SKIP_AADHAR_SETTING_KEY, False))}


class PanditRegistrationSettingsIn(BaseModel):
    skip_aadhar_verification: bool


@router.put("/pandit-registration")
async def update_pandit_registration_settings(
    payload: PanditRegistrationSettingsIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Global switch: when on, every NEW Pandit Ji registration (self-
    registered or admin bulk-uploaded) skips Aadhaar OTP entirely from
    the start and goes straight to the manual Aadhaar-card-image
    upload + admin review flow -- same end state as an admin manually
    skipping Aadhaar for one specific pandit (see
    PATCH /admin/pandits/{id}/skip-aadhar), just applied up front to
    everyone instead of case by case.
    """
    set_setting(SKIP_AADHAR_SETTING_KEY, payload.skip_aadhar_verification, current_user["id"])

    write_audit_log(
        action="ADMIN_SETTINGS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="app_settings",
        entity_id=SKIP_AADHAR_SETTING_KEY,
        payload={"skip_aadhar_verification": payload.skip_aadhar_verification},
    )

    return {"message": "Settings updated.", "skip_aadhar_verification": payload.skip_aadhar_verification}


@router.get("/booking")
async def get_booking_settings(current_user: dict = Depends(require_admin_roles())):
    return {"min_lead_hours": int(get_setting(BOOKING_MIN_LEAD_HOURS_KEY, 6))}


class BookingSettingsIn(BaseModel):
    min_lead_hours: int = Field(ge=0, le=168)


@router.put("/booking")
async def update_booking_settings(
    payload: BookingSettingsIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Global minimum-notice window for a new booking (any puja, any
    pandit) -- read by the public GET /settings/booking endpoint so the
    Date & Time booking step can grey out slots that don't leave enough
    time to actually arrange a Pandit Ji.
    """
    set_setting(BOOKING_MIN_LEAD_HOURS_KEY, payload.min_lead_hours, current_user["id"])

    write_audit_log(
        action="ADMIN_SETTINGS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="app_settings",
        entity_id=BOOKING_MIN_LEAD_HOURS_KEY,
        payload={"min_lead_hours": payload.min_lead_hours},
    )

    return {"message": "Settings updated.", "min_lead_hours": payload.min_lead_hours}


@router.get("/pricing")
async def get_pricing_settings(current_user: dict = Depends(require_admin_roles())):
    return {
        "premium_package_fee": float(get_setting(PREMIUM_PACKAGE_FEE_KEY, 500)),
        "gst_percentage": float(get_setting(GST_PERCENTAGE_KEY, 0)),
        "platform_fee": float(get_setting(PLATFORM_FEE_KEY, 200)),
    }


class PricingSettingsIn(BaseModel):
    # Field's numeric bounds plus Pydantic's own type coercion rules
    # mean a non-numeric or out-of-range body value is rejected with a
    # 422 before this handler ever runs -- not just a frontend guard.
    premium_package_fee: float = Field(ge=0, le=100000)
    gst_percentage: float = Field(ge=0, le=100)
    platform_fee: float = Field(ge=0, le=100000)


@router.put("/pricing")
async def update_pricing_settings(
    payload: PricingSettingsIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Global pricing add-ons applied at checkout (see BookPayment.jsx):
    Premium package selection adds premium_package_fee on top of the
    Pandit Ji's per-puja price; gst_percentage is charged on the
    discounted subtotal; platform_fee is a flat, untaxed charge on top.
    """
    set_setting(PREMIUM_PACKAGE_FEE_KEY, payload.premium_package_fee, current_user["id"])
    set_setting(GST_PERCENTAGE_KEY, payload.gst_percentage, current_user["id"])
    set_setting(PLATFORM_FEE_KEY, payload.platform_fee, current_user["id"])

    write_audit_log(
        action="ADMIN_SETTINGS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="app_settings",
        entity_id="pricing",
        payload=payload.model_dump(),
    )

    return {
        "message": "Settings updated.",
        "premium_package_fee": payload.premium_package_fee,
        "gst_percentage": payload.gst_percentage,
        "platform_fee": payload.platform_fee,
    }


@router.get("/invoice")
async def get_invoice_settings(current_user: dict = Depends(require_admin_roles())):
    return {
        "company_name": get_setting(INVOICE_COMPANY_NAME_KEY, "") or "",
        "company_gstin": get_setting(INVOICE_COMPANY_GSTIN_KEY, "") or "",
        "company_address": get_setting(INVOICE_COMPANY_ADDRESS_KEY, "") or "",
        "company_state": get_setting(INVOICE_COMPANY_STATE_KEY, "") or "",
        "sac_code": get_setting(INVOICE_SAC_CODE_KEY, "998599") or "998599",
    }


class InvoiceSettingsIn(BaseModel):
    company_name: str = Field(default="", max_length=200)
    company_gstin: str = Field(default="", max_length=20)
    company_address: str = Field(default="", max_length=500)
    company_state: str = Field(default="", max_length=100)
    sac_code: str = Field(default="998599", max_length=20)


@router.put("/invoice")
async def update_invoice_settings(
    payload: InvoiceSettingsIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Company details shown in the header of every generated tax invoice
    (see invoicing.py). Left blank is allowed -- invoices still generate,
    just show "GSTIN not configured" until these are filled in. The SAC
    code defaults to a general-purpose "other support services" code for
    the platform's convenience fee; confirm the right one with your tax
    advisor and correct it here, no code change needed.
    """
    set_setting(INVOICE_COMPANY_NAME_KEY, payload.company_name.strip(), current_user["id"])
    set_setting(INVOICE_COMPANY_GSTIN_KEY, payload.company_gstin.strip().upper(), current_user["id"])
    set_setting(INVOICE_COMPANY_ADDRESS_KEY, payload.company_address.strip(), current_user["id"])
    set_setting(INVOICE_COMPANY_STATE_KEY, payload.company_state.strip(), current_user["id"])
    set_setting(INVOICE_SAC_CODE_KEY, payload.sac_code.strip(), current_user["id"])

    write_audit_log(
        action="ADMIN_SETTINGS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="app_settings",
        entity_id="invoice",
        payload=payload.model_dump(),
    )

    return {"message": "Settings updated.", **payload.model_dump()}


SOCIAL_LINK_KEYS = {
    "instagram": SOCIAL_LINK_INSTAGRAM_KEY,
    "facebook": SOCIAL_LINK_FACEBOOK_KEY,
    "whatsapp": SOCIAL_LINK_WHATSAPP_KEY,
    "x_twitter": SOCIAL_LINK_X_TWITTER_KEY,
    "linkedin": SOCIAL_LINK_LINKEDIN_KEY,
    "youtube": SOCIAL_LINK_YOUTUBE_KEY,
    "threads": SOCIAL_LINK_THREADS_KEY,
}


@router.get("/social-links")
async def get_social_links_settings(current_user: dict = Depends(require_admin_roles())):
    return {field: get_setting(key, "") or "" for field, key in SOCIAL_LINK_KEYS.items()}


class SocialLinksSettingsIn(BaseModel):
    instagram: str = Field(default="", max_length=300)
    facebook: str = Field(default="", max_length=300)
    whatsapp: str = Field(default="", max_length=300)
    x_twitter: str = Field(default="", max_length=300)
    linkedin: str = Field(default="", max_length=300)
    youtube: str = Field(default="", max_length=300)
    threads: str = Field(default="", max_length=300)

    @field_validator("instagram", "facebook", "whatsapp", "x_twitter", "linkedin", "youtube", "threads")
    @classmethod
    def strip_and_validate(cls, value: str) -> str:
        value = (value or "").strip()
        # Left blank is allowed -- the footer just keeps that icon's
        # link disabled ("#") until a real URL is configured. If
        # something IS entered, it must be a real link so the footer
        # never ships a broken/typo'd href.
        if value and not (value.startswith("http://") or value.startswith("https://")):
            raise ValueError("Link must start with http:// or https://, or be left blank.")
        return value


@router.put("/social-links")
async def update_social_links_settings(
    payload: SocialLinksSettingsIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Destination URL for each social icon in the footer (see
    Footer.jsx + the public GET /settings/social-links it reads from).
    """
    data = payload.model_dump()
    for field, key in SOCIAL_LINK_KEYS.items():
        set_setting(key, data[field], current_user["id"])

    write_audit_log(
        action="ADMIN_SETTINGS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="app_settings",
        entity_id="social_links",
        payload=data,
    )

    return {"message": "Settings updated.", **data}
