"""
Small key/value store for global app settings admin can toggle from
the Admin Settings screen -- read from wherever the setting actually
matters (currently: Pandit Ji registration, in both auth.py's
register_pandit() and admin_pandits.py's bulk-upload).
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from db import service_supabase

logger = logging.getLogger(__name__)

SKIP_AADHAR_SETTING_KEY = "skip_aadhar_for_new_pandits"
BOOKING_MIN_LEAD_HOURS_KEY = "booking_min_lead_hours"
PREMIUM_PACKAGE_FEE_KEY = "premium_package_fee"
GST_PERCENTAGE_KEY = "gst_percentage"
PLATFORM_FEE_KEY = "platform_fee"
# Company details shown on the header of every generated GST tax invoice
# (see invoicing.py) -- left blank until admin fills them in, at which
# point invoices already generated keep showing whatever was configured
# at the time (each invoice's `snapshot` is a point-in-time copy), only
# new invoices pick up a later change.
INVOICE_COMPANY_NAME_KEY = "invoice_company_name"
INVOICE_COMPANY_GSTIN_KEY = "invoice_company_gstin"
INVOICE_COMPANY_ADDRESS_KEY = "invoice_company_address"
INVOICE_COMPANY_STATE_KEY = "invoice_company_state"
INVOICE_SAC_CODE_KEY = "invoice_sac_code"

# Destination URL for each social icon shown in the footer (see
# Footer.jsx) -- empty string means "not configured yet", in which case
# the footer keeps that icon pointing at "#" instead of a dead link.
SOCIAL_LINK_INSTAGRAM_KEY = "social_link_instagram"
SOCIAL_LINK_FACEBOOK_KEY = "social_link_facebook"
SOCIAL_LINK_WHATSAPP_KEY = "social_link_whatsapp"
SOCIAL_LINK_X_TWITTER_KEY = "social_link_x_twitter"
SOCIAL_LINK_LINKEDIN_KEY = "social_link_linkedin"
SOCIAL_LINK_YOUTUBE_KEY = "social_link_youtube"
SOCIAL_LINK_THREADS_KEY = "social_link_threads"


def get_setting(key: str, default: Any = None) -> Any:
    if service_supabase is None:
        return default
    try:
        resp = service_supabase.table("app_settings").select("value").eq("key", key).limit(1).execute()
        rows = getattr(resp, "data", None) or []
        return rows[0]["value"] if rows else default
    except Exception:
        logger.exception("Could not read app setting %s; using default.", key)
        return default


def set_setting(key: str, value: Any, updated_by: Optional[str] = None) -> None:
    if service_supabase is None:
        return
    service_supabase.table("app_settings").upsert(
        {
            "key": key,
            "value": value,
            "updated_by": updated_by,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="key",
    ).execute()
