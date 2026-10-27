from fastapi import APIRouter

from app_settings import (
    BOOKING_MIN_LEAD_HOURS_KEY,
    GST_PERCENTAGE_KEY,
    PLATFORM_FEE_KEY,
    PREMIUM_PACKAGE_FEE_KEY,
    SOCIAL_LINK_FACEBOOK_KEY,
    SOCIAL_LINK_INSTAGRAM_KEY,
    SOCIAL_LINK_LINKEDIN_KEY,
    SOCIAL_LINK_THREADS_KEY,
    SOCIAL_LINK_WHATSAPP_KEY,
    SOCIAL_LINK_X_TWITTER_KEY,
    SOCIAL_LINK_YOUTUBE_KEY,
    get_setting,
)

router = APIRouter(prefix="/settings", tags=["public-settings"])


@router.get("/booking")
async def get_public_booking_settings():
    """
    Unauthenticated read of the admin-configured minimum booking lead
    time (see admin_settings.py's /admin/settings/booking) -- the Date
    & Time booking step needs this before a customer has necessarily
    finished logging in, so it can't sit behind require_admin_roles().
    """
    return {"min_lead_hours": int(get_setting(BOOKING_MIN_LEAD_HOURS_KEY, 6))}


@router.get("/pricing")
async def get_public_pricing_settings():
    """
    Unauthenticated read of the admin-configured pricing add-ons (see
    admin_settings.py's /admin/settings/pricing) -- the Payment step
    needs these to compute the real total before login is guaranteed.
    """
    return {
        "premium_package_fee": float(get_setting(PREMIUM_PACKAGE_FEE_KEY, 500)),
        "gst_percentage": float(get_setting(GST_PERCENTAGE_KEY, 0)),
        "platform_fee": float(get_setting(PLATFORM_FEE_KEY, 200)),
    }


@router.get("/social-links")
async def get_public_social_links_settings():
    """
    Unauthenticated read of the admin-configured social profile URLs
    (see admin_settings.py's /admin/settings/social-links) -- the
    Footer, shown on every page, needs this without requiring login.
    """
    return {
        "instagram": get_setting(SOCIAL_LINK_INSTAGRAM_KEY, "") or "",
        "facebook": get_setting(SOCIAL_LINK_FACEBOOK_KEY, "") or "",
        "whatsapp": get_setting(SOCIAL_LINK_WHATSAPP_KEY, "") or "",
        "x_twitter": get_setting(SOCIAL_LINK_X_TWITTER_KEY, "") or "",
        "linkedin": get_setting(SOCIAL_LINK_LINKEDIN_KEY, "") or "",
        "youtube": get_setting(SOCIAL_LINK_YOUTUBE_KEY, "") or "",
        "threads": get_setting(SOCIAL_LINK_THREADS_KEY, "") or "",
    }
