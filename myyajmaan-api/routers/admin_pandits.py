import io
import logging
import os
import re
import secrets
import string
from datetime import datetime, timezone
from typing import Optional

import httpx
import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Font, PatternFill
from pydantic import BaseModel, Field

import aadhar_crypto
from app_settings import SKIP_AADHAR_SETTING_KEY, get_setting
from audit import write_audit_log
from db import convert_record_image_fields, convert_records_image_fields, service_supabase
from decline_tracking import get_consecutive_declines, get_decline_alerts
from notifications import notify_user
from permissions import require_admin_roles
from routers.auth import supabase_signup

router = APIRouter(prefix="/admin/pandits", tags=["admin-pandits"])

logger = logging.getLogger(__name__)

STATUS_VALUES = ("pending", "approved", "rejected")

PANDIT_PLACEHOLDER_IMAGE = "/images/panditPlaceholder.png"

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

MAX_BULK_UPLOAD_ROWS = 500
MAX_BULK_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

# (internal key, spreadsheet column header, required, help text for the
# Instructions sheet). The uploaded file's header row must match these
# headers exactly (case-insensitive) -- admin downloads this template,
# fills it, and uploads the same file back, so we don't try to be
# lenient about a reshaped sheet; we just tell them to redownload it.
BULK_UPLOAD_COLUMNS = [
    ("first_name", "First Name", True, "Pandit Ji's first name."),
    ("last_name", "Last Name", True, "Pandit Ji's last name."),
    ("email", "Email", True, "Must be unique -- used to log in."),
    ("phone", "Phone", True, "10-digit mobile number."),
    ("state", "State", True, "e.g. Delhi, Maharashtra."),
    ("city", "City", True, "e.g. Delhi, Mumbai."),
    ("address", "Address", False, "Street-level address shown to customers."),
    ("pincode", "Pincode", False, "6-digit postal code."),
    ("experience_years", "Experience (Years)", False, "Whole number, e.g. 12."),
    ("languages_spoken", "Languages Spoken", False, "Comma separated, e.g. Hindi, Sanskrit, English."),
    ("specialities", "Specialities", False, "Comma separated, e.g. Griha Pravesh, Satyanarayan Puja."),
    ("service_areas", "Service Areas", False, "Comma separated locality/area names this Pandit Ji travels to."),
    ("price", "Price (INR)", False, "Starting price shown to customers, e.g. 2100."),
    ("about", "About / Bio", False, "Short description shown on the Pandit Ji's profile."),
    ("latitude", "Latitude", False, "Decimal, -90 to 90. Leave blank if unknown."),
    ("longitude", "Longitude", False, "Decimal, -180 to 180. Leave blank if unknown."),
]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _generate_temp_password() -> str:
    # Unambiguous alphabet (no 0/O/1/l/I) so admin can read it aloud or
    # retype it over the phone without confusion.
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(10))


def _apply_avatar_fallback(record: Optional[dict]):
    if not record:
        return record
    if not record.get("avatar_url"):
        record["avatar_url"] = PANDIT_PLACEHOLDER_IMAGE
    return record


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Admin pandit service is not configured.")
    return service_supabase


def _apply_search(query, search: Optional[str]):
    if not search:
        return query
    term = search.strip().replace("%", "")
    if not term:
        return query
    # Pandits don't carry email/phone on their own row (that lives on
    # public.users), so search covers the fields the pandit profile
    # itself has. Good enough for finding a specific applicant by name
    # or city without an extra join round-trip.
    return query.or_(
        f"display_name.ilike.%{term}%,name.ilike.%{term}%,city.ilike.%{term}%"
    )


def _attach_user_info(client, rows: list):
    """Merges each pandit row's contact info from public.users (no SQL joins in supabase-py)."""
    user_ids = [row["user_id"] for row in rows if row.get("user_id")]
    if not user_ids:
        return rows

    resp = (
        client.table("users")
        .select("id, email, phone, gender")
        .in_("id", user_ids)
        .execute()
    )
    users_by_id = {u["id"]: u for u in (getattr(resp, "data", None) or [])}

    # is_active=False on an already-approved pandit is ambiguous by
    # itself -- it means either "hasn't completed their first forced
    # password change yet" (never active) or "admin disabled this
    # account" (was active, isn't now). An active moderation flag is
    # what actually distinguishes the two, so the frontend can show
    # the right badge instead of guessing.
    flags_resp = (
        client.table("user_flags")
        .select("user_id")
        .in_("user_id", user_ids)
        .eq("is_active", True)
        .in_("flag_type", ("banned", "suspended"))
        .execute()
    )
    disabled_user_ids = {row["user_id"] for row in (getattr(flags_resp, "data", None) or [])}

    for row in rows:
        user = users_by_id.get(row.get("user_id")) or {}
        row["email"] = user.get("email")
        row["phone"] = user.get("phone")
        # Currently only ever learned from the (mocked) Aadhaar
        # verification response -- see routers/pandit_aadhar.py. Null
        # until that's completed, including when admin skips it.
        row["gender"] = user.get("gender")
        row["account_disabled"] = row.get("user_id") in disabled_user_ids

    return rows


def _attach_puja_info(client, pandit_id: str) -> list:
    relation_resp = (
        client.table("pandit_puja")
        .select("puja_id, price_override, active")
        .eq("pandit_id", pandit_id)
        .eq("active", True)
        .execute()
    )
    relations = getattr(relation_resp, "data", None) or []
    if not relations:
        return []

    puja_ids = [row["puja_id"] for row in relations]
    pujas_resp = (
        client.table("pujas")
        .select("id, title, thumbnail_url, image_url, base_price")
        .in_("id", puja_ids)
        .execute()
    )
    pujas_by_id = {p["id"]: p for p in (getattr(pujas_resp, "data", None) or [])}
    convert_records_image_fields(list(pujas_by_id.values()), fields=["thumbnail_url", "image_url"])

    items = []
    for relation in relations:
        puja = pujas_by_id.get(relation["puja_id"])
        if not puja:
            continue
        items.append(
            {
                **puja,
                "price": relation.get("price_override") if relation.get("price_override") is not None else puja.get("base_price"),
            }
        )
    return items


@router.get("/counts")
async def get_pandit_status_counts(
    search: Optional[str] = Query(default=None),
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    counts = {}

    for tab in ("all",) + STATUS_VALUES:
        query = client.table("pandits").select("id", count="exact")
        query = _apply_search(query, search)
        if tab != "all":
            query = query.eq("verification_status", tab)
        resp = query.execute()
        counts[tab] = getattr(resp, "count", None) or 0

    return counts


@router.get("")
async def list_pandits_admin(
    status_filter: str = Query(default="pending", alias="status"),
    search: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_admin_roles()),
):
    if status_filter not in ("all",) + STATUS_VALUES:
        raise HTTPException(status_code=400, detail="Invalid status filter.")

    client = _client()

    query = client.table("pandits").select(
        "id, user_id, name, display_name, city, state, experience_years, specialities, "
        "avatar_url, verification_status, rejection_reason, is_active, created_at, "
        "aadhar_verification_status",
        count="exact",
    )
    query = _apply_search(query, search)
    if status_filter != "all":
        query = query.eq("verification_status", status_filter)

    start = (page - 1) * page_size
    end = start + page_size - 1
    resp = query.order("created_at", desc=True).range(start, end).execute()

    rows = getattr(resp, "data", None) or []
    total = getattr(resp, "count", None) or 0
    _attach_user_info(client, rows)
    convert_records_image_fields(rows, fields=["avatar_url"])
    for row in rows:
        _apply_avatar_fallback(row)
        # Lets the Pandit Ji table badge anyone on a concerning
        # consecutive-decline streak without a separate round trip.
        row["current_streak"] = get_consecutive_declines(client, row["id"])

    return {
        "items": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/decline-alerts")
async def list_decline_alerts(current_user: dict = Depends(require_admin_roles())):
    """
    Every Pandit Ji currently on a 3+ consecutive-decline streak, worst
    first -- backs the Admin Dashboard's red "needs attention" banner.
    """
    client = _client()
    return {"items": get_decline_alerts(client, threshold=3)}


@router.get("/bulk-template")
async def download_bulk_upload_template(
    current_user: dict = Depends(require_admin_roles()),
):
    """
    An .xlsx admin downloads, fills in by hand (one Pandit Ji per row),
    and uploads back via POST /bulk-upload. A second "Instructions"
    sheet documents every column.

    Registered ahead of GET /{pandit_id} -- otherwise FastAPI's
    path-matching order would treat "bulk-template" as a pandit_id.
    """

    wb = openpyxl.Workbook()

    sheet = wb.active
    sheet.title = "Pandits"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="7A1F2D", end_color="7A1F2D", fill_type="solid")
    required_fill = PatternFill(start_color="FDE68A", end_color="FDE68A", fill_type="solid")

    for col_index, (_key, header, required, _help) in enumerate(BULK_UPLOAD_COLUMNS, start=1):
        cell = sheet.cell(row=1, column=col_index, value=header + (" *" if required else ""))
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        sheet.column_dimensions[cell.column_letter].width = max(18, len(header) + 4)

    sheet.freeze_panes = "A2"

    instructions = wb.create_sheet("Instructions")
    instructions.column_dimensions["A"].width = 24
    instructions.column_dimensions["B"].width = 12
    instructions.column_dimensions["C"].width = 60

    instructions.append(["How to use this template"])
    instructions["A1"].font = Font(bold=True, size=13, color="7A1F2D")
    instructions.append([])
    instructions.append([
        "1. Fill one row per Pandit Ji on the \"Pandits\" sheet. Do not rename, "
        "reorder, or remove any column -- upload will reject a modified header row."
    ])
    instructions.append([
        "2. Columns marked with * are required. Leave optional columns blank if unknown."
    ])
    instructions.append([
        "3. A temporary password is generated automatically for each Pandit Ji and "
        "shown to you after upload, for you to share with them."
    ])
    instructions.append([
        "4. Each Pandit Ji still goes through the normal review: they log in with the "
        "temporary password, set their own password, complete Aadhaar authentication, "
        "and upload a photo and bank details -- then you approve or decline them from "
        "the Pending tab, same as any other registration."
    ])
    instructions.append([])

    col_header_font = Font(bold=True)
    instructions.append(["Column", "Required", "Notes"])
    for cell in instructions[instructions.max_row]:
        cell.font = col_header_font
        cell.fill = required_fill

    for _key, header, required, help_text in BULK_UPLOAD_COLUMNS:
        instructions.append([header, "Yes" if required else "No", help_text])

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    write_audit_log(
        action="ADMIN_PANDIT_BULK_TEMPLATE_DOWNLOADED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=None,
        payload={},
    )

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=pandit_upload_template.xlsx"},
    )


@router.get("/{pandit_id}")
async def get_pandit_detail(
    pandit_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    resp = client.table("pandits").select("*").eq("id", pandit_id).single().execute()
    pandit = getattr(resp, "data", None)
    if not pandit:
        raise HTTPException(status_code=404, detail="Pandit not found.")

    _attach_user_info(client, [pandit])
    convert_record_image_fields(pandit, fields=["avatar_url"])
    _apply_avatar_fallback(pandit)

    aadhar_number = aadhar_crypto.decrypt_value(pandit.get("aadhar_number_enc"))
    pandit["aadhar_masked"] = aadhar_crypto.mask_value(aadhar_number) if aadhar_number else None
    pandit.pop("aadhar_number_enc", None)
    pandit.pop("aadhar_otp_hash", None)

    reg_resp = (
        client.table("pandit_registrations")
        .select("id, photo_url, submitted_at, reviewed_at")
        .eq("pandit_id", pandit_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    reg_rows = getattr(reg_resp, "data", None) or []
    registration = reg_rows[0] if reg_rows else None
    if registration:
        convert_record_image_fields(registration, fields=["photo_url"])

    bookings_resp = (
        client.table("bookings").select("id", count="exact").eq("pandit_id", pandit_id).execute()
    )
    total_bookings = getattr(bookings_resp, "count", None) or 0

    return {
        "pandit": pandit,
        "registration": registration,
        "total_bookings": total_bookings,
        "pujas": _attach_puja_info(client, pandit_id),
    }


def _get_pandit_or_404(client, pandit_id: str) -> dict:
    resp = (
        client.table("pandits")
        .select("id, user_id, display_name, name, verification_status, aadhar_verification_status")
        .eq("id", pandit_id)
        .single()
        .execute()
    )
    pandit = getattr(resp, "data", None)
    if not pandit:
        raise HTTPException(status_code=404, detail="Pandit not found.")
    return pandit


def _stamp_latest_registration(client, pandit_id: str, reviewer_id: str):
    """Best-effort: marks the most recent onboarding submission as reviewed."""
    reg_resp = (
        client.table("pandit_registrations")
        .select("id")
        .eq("pandit_id", pandit_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(reg_resp, "data", None) or []
    if rows:
        client.table("pandit_registrations").update(
            {
                "reviewed_by": reviewer_id,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", rows[0]["id"]).execute()


@router.patch("/{pandit_id}/approve")
async def approve_pandit(
    pandit_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    pandit = _get_pandit_or_404(client, pandit_id)

    aadhar_status = pandit.get("aadhar_verification_status")
    if aadhar_status not in ("verified", "skipped"):
        raise HTTPException(
            status_code=400,
            detail=(
                "This Pandit Ji's Aadhaar is not verified yet. Please wait for them to complete Aadhaar "
                "verification, or use \"Skip Aadhaar\" on this list first."
            ),
        )

    if aadhar_status == "skipped":
        # Skipping OTP doesn't skip having SOME Aadhaar evidence to
        # review -- it falls back to manual card-image review instead.
        reg_resp = (
            client.table("pandit_registrations")
            .select("aadhar_front_url, aadhar_back_url")
            .eq("pandit_id", pandit_id)
            .order("submitted_at", desc=True)
            .limit(1)
            .execute()
        )
        reg_rows = getattr(reg_resp, "data", None) or []
        has_aadhar_images = bool(reg_rows and reg_rows[0].get("aadhar_front_url") and reg_rows[0].get("aadhar_back_url"))
        if not has_aadhar_images:
            raise HTTPException(
                status_code=400,
                detail="This Pandit Ji hasn't uploaded their Aadhaar card images yet for review.",
            )

    client.table("pandits").update(
        {
            "verification_status": "approved",
            "is_active": True,
            "rejection_reason": None,
        }
    ).eq("id", pandit_id).execute()

    _stamp_latest_registration(client, pandit_id, current_user["id"])

    write_audit_log(
        action="ADMIN_PANDIT_APPROVED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=pandit_id,
        payload={
            "pandit_name": pandit.get("display_name") or pandit.get("name"),
            "previous_status": pandit.get("verification_status"),
        },
    )

    if pandit.get("user_id"):
        await notify_user(
            user_id=pandit["user_id"],
            type="PANDIT_APPROVED",
            title="Profile approved!",
            message="Your Pandit Ji profile has been approved. You're now live and can receive bookings.",
            link="/pandit/profile",
            metadata={"pandit_id": pandit_id},
        )

    return {"message": "Pandit Ji approved successfully.", "status": "approved"}


class RejectPanditIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{pandit_id}/reject")
async def reject_pandit(
    pandit_id: str,
    payload: RejectPanditIn,
    current_user: dict = Depends(require_admin_roles()),
):
    client = _client()
    pandit = _get_pandit_or_404(client, pandit_id)

    reason = (payload.reason or "").strip() or None

    client.table("pandits").update(
        {
            "verification_status": "rejected",
            # Hidden from the public booking catalog, but users.is_active
            # is intentionally left untouched so the Pandit Ji can still
            # log in and re-submit documents for another review.
            "is_active": False,
            "rejection_reason": reason,
        }
    ).eq("id", pandit_id).execute()

    _stamp_latest_registration(client, pandit_id, current_user["id"])

    write_audit_log(
        action="ADMIN_PANDIT_REJECTED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=pandit_id,
        payload={
            "pandit_name": pandit.get("display_name") or pandit.get("name"),
            "previous_status": pandit.get("verification_status"),
            "reason": reason,
        },
    )

    if pandit.get("user_id"):
        await notify_user(
            user_id=pandit["user_id"],
            type="PANDIT_REJECTED",
            title="Registration declined",
            message=reason or "Your registration was declined. Please review and re-submit your documents.",
            link="/pandit/profile",
            metadata={"pandit_id": pandit_id},
        )

    return {"message": "Pandit Ji registration rejected.", "status": "rejected"}


@router.patch("/{pandit_id}/skip-aadhar")
async def skip_aadhar_verification(
    pandit_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    For a Pandit Ji whose Aadhaar isn't linked to a mobile number (so
    OTP can never reach them) -- they call admin directly, and this
    lets that specific pandit skip straight to photo + bank details.
    Deliberately restricted to pandits still "pending": once approved,
    there's no reason to retroactively bypass verification, and this
    action existing on an approved row would be confusing/unsafe.
    """
    client = _client()
    pandit = _get_pandit_or_404(client, pandit_id)

    if pandit.get("verification_status") != "pending":
        raise HTTPException(
            status_code=400,
            detail="Aadhaar verification can only be skipped for a Pandit Ji still pending review.",
        )

    if pandit.get("aadhar_verification_status") in ("verified", "skipped"):
        raise HTTPException(status_code=400, detail="Aadhaar verification is already resolved for this Pandit Ji.")

    client.table("pandits").update(
        {
            "aadhar_verification_status": "skipped",
            "aadhar_verification_skipped_by": current_user["id"],
            "aadhar_verification_skipped_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", pandit_id).execute()

    write_audit_log(
        action="ADMIN_PANDIT_AADHAR_SKIPPED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=pandit_id,
        payload={"pandit_name": pandit.get("display_name") or pandit.get("name")},
    )

    return {"message": "Aadhaar verification skipped. This Pandit Ji can now upload their photo and bank details."}


class PanditAccountStatusIn(BaseModel):
    status: str = Field(pattern="^(active|disabled)$")
    reason: Optional[str] = Field(default=None, max_length=500)


@router.patch("/{pandit_id}/account-status")
async def update_pandit_account_status(
    pandit_id: str,
    payload: PanditAccountStatusIn,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    For an already-approved, live Pandit Ji: disabling them blocks any
    future login AND ends any session they currently have open --
    auth.get_current_user() re-checks this on every single request
    (not just at login), so a disabled pandit's next API call fails
    regardless of how much longer their access token would otherwise
    stay valid. Also pulls them off the public booking catalog
    (pandits.is_active), same as a rejection would.

    Restricted to "approved" pandits -- pending/rejected ones aren't
    live in the first place, so this action doesn't apply to them.
    """
    client = _client()
    resp = (
        client.table("pandits")
        .select("id, user_id, display_name, name, verification_status, is_active")
        .eq("id", pandit_id)
        .single()
        .execute()
    )
    pandit = getattr(resp, "data", None)
    if not pandit:
        raise HTTPException(status_code=404, detail="Pandit not found.")

    if pandit.get("verification_status") != "approved":
        raise HTTPException(
            status_code=400,
            detail="Only an approved Pandit Ji's account can be enabled/disabled from here.",
        )

    user_id = pandit.get("user_id")
    if not user_id:
        raise HTTPException(status_code=500, detail="This Pandit Ji has no linked account.")

    if payload.status == "disabled" and not (payload.reason or "").strip():
        raise HTTPException(status_code=400, detail="Please provide a reason for disabling this account.")

    is_active = payload.status == "active"

    # Clear any existing moderation flag before applying the new one --
    # mirrors admin_users.py's exact same active/inactive/blocked pattern,
    # just scoped to pandits instead of customers.
    client.table("user_flags").update({"is_active": False}).eq("user_id", user_id).eq("is_active", True).execute()

    client.table("users").update({"is_active": is_active}).eq("id", user_id).execute()
    client.table("pandits").update({"is_active": is_active}).eq("id", pandit_id).execute()

    if payload.status == "disabled":
        client.table("user_flags").insert(
            {
                "user_id": user_id,
                "flag_type": "suspended",
                "reason": payload.reason.strip(),
                "flagged_by": current_user["id"],
                "is_active": True,
            }
        ).execute()

    pandit_name = pandit.get("display_name") or pandit.get("name") or "This Pandit Ji"

    write_audit_log(
        action="ADMIN_PANDIT_ACCOUNT_STATUS_CHANGED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=pandit_id,
        payload={"pandit_name": pandit_name, "new_status": payload.status, "reason": payload.reason},
    )

    # Only notify on re-enable -- while disabled they can't log in to
    # see (or act on) a notification anyway.
    if payload.status == "active":
        await notify_user(
            user_id=user_id,
            type="PANDIT_ACCOUNT_ENABLED",
            title="Account re-enabled",
            message="Your account has been re-enabled. You can log in and receive bookings again.",
            link="/pandit/dashboard",
            metadata={"pandit_id": pandit_id},
        )

    return {
        "message": f"{pandit_name}'s account has been {'disabled' if payload.status == 'disabled' else 'enabled'}.",
        "status": payload.status,
    }


def _cell_str(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _validate_bulk_row(row_number: int, values: dict, seen_emails: set) -> list:
    """Returns a list of error dicts for this row (empty if valid)."""
    errors = []

    def add(field, message):
        errors.append({"row": row_number, "field": field, "message": message})

    first_name = values["first_name"]
    last_name = values["last_name"]
    email = values["email"].lower()
    phone = values["phone"]
    state = values["state"]
    city = values["city"]

    if not first_name:
        add("first_name", "First Name is required.")
    if not last_name:
        add("last_name", "Last Name is required.")
    if not state:
        add("state", "State is required.")
    if not city:
        add("city", "City is required.")

    if not email:
        add("email", "Email is required.")
    elif not EMAIL_RE.match(email):
        add("email", f'"{email}" is not a valid email address.')
    elif email in seen_emails:
        add("email", f'Email "{email}" is used more than once in this sheet.')

    phone_digits = re.sub(r"\D", "", phone)
    if not phone:
        add("phone", "Phone is required.")
    elif not (7 <= len(phone_digits) <= 15):
        add("phone", f'"{phone}" is not a valid phone number.')

    if values["experience_years"]:
        try:
            years = int(float(values["experience_years"]))
            if years < 0 or years > 80:
                raise ValueError
        except ValueError:
            add("experience_years", f'Experience "{values["experience_years"]}" must be a whole number of years.')

    if values["price"]:
        try:
            price = float(values["price"])
            if price < 0:
                raise ValueError
        except ValueError:
            add("price", f'Price "{values["price"]}" must be a positive number.')

    if values["latitude"]:
        try:
            lat = float(values["latitude"])
            if not (-90 <= lat <= 90):
                raise ValueError
        except ValueError:
            add("latitude", f'Latitude "{values["latitude"]}" must be a number between -90 and 90.')

    if values["longitude"]:
        try:
            lng = float(values["longitude"])
            if not (-180 <= lng <= 180):
                raise ValueError
        except ValueError:
            add("longitude", f'Longitude "{values["longitude"]}" must be a number between -180 and 180.')

    return errors


@router.post("/bulk-upload")
async def bulk_upload_pandits(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Validates the whole spreadsheet first; creates nothing at all if
    any row fails validation, so a bad file never leaves a half-done
    import. Each valid row becomes an approved-but-not-yet-visible
    Pandit Ji account with a generated temporary password -- see
    BULK_UPLOAD_COLUMNS / the Instructions sheet for the full flow.
    """

    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Please upload the .xlsx spreadsheet downloaded from this page.")

    if service_supabase is None or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Pandit account service is not configured.")

    raw = await file.read()
    if len(raw) > MAX_BULK_UPLOAD_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"This file is too large. Please upload a spreadsheet under {MAX_BULK_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    try:
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheet = wb["Pandits"] if "Pandits" in wb.sheetnames else wb.worksheets[0]
    except Exception:
        raise HTTPException(status_code=400, detail="This file could not be read. Please upload a valid .xlsx file.")

    rows_iter = sheet.iter_rows(values_only=True)
    try:
        header_row = next(rows_iter)
    except StopIteration:
        raise HTTPException(status_code=400, detail="This spreadsheet is empty.")

    expected_headers = [header for _key, header, required, _help in BULK_UPLOAD_COLUMNS]
    actual_headers = [
        re.sub(r"\s*\*\s*$", "", _cell_str(h)) for h in header_row[: len(expected_headers)]
    ]
    if [h.lower() for h in actual_headers] != [h.lower() for h in expected_headers]:
        raise HTTPException(
            status_code=400,
            detail=(
                "This spreadsheet's columns don't match the current template. "
                "Please download the latest template, fill it in, and upload that file."
            ),
        )

    parsed_rows = []
    for offset, raw_row in enumerate(rows_iter, start=2):
        if raw_row is None or all(_cell_str(v) == "" for v in raw_row):
            continue
        if len(parsed_rows) >= MAX_BULK_UPLOAD_ROWS:
            raise HTTPException(status_code=400, detail=f"This sheet has more than {MAX_BULK_UPLOAD_ROWS} rows. Please split it into smaller batches.")

        values = {}
        for index, (key, _header, _required, _help) in enumerate(BULK_UPLOAD_COLUMNS):
            values[key] = _cell_str(raw_row[index] if index < len(raw_row) else None)
        parsed_rows.append((offset, values))

    if not parsed_rows:
        raise HTTPException(status_code=400, detail="No Pandit Ji rows found in this sheet.")

    # Pass 1: validate every row before creating anything.
    all_errors = []
    seen_emails = set()
    for row_number, values in parsed_rows:
        all_errors.extend(_validate_bulk_row(row_number, values, seen_emails))
        if values["email"]:
            seen_emails.add(values["email"].lower())

    if not all_errors:
        # Check against emails that already exist in the system.
        candidate_emails = [values["email"].lower() for _row, values in parsed_rows if values["email"]]
        existing_resp = (
            service_supabase.table("users").select("email").in_("email", candidate_emails).execute()
        )
        existing_emails = {row["email"].lower() for row in (getattr(existing_resp, "data", None) or [])}
        for row_number, values in parsed_rows:
            email = values["email"].lower()
            if email in existing_emails:
                all_errors.append({"row": row_number, "field": "email", "message": f'An account with email "{email}" already exists.'})

    if all_errors:
        raise HTTPException(status_code=422, detail={"code": "BULK_UPLOAD_INVALID", "message": "This spreadsheet has errors. Nothing was uploaded.", "errors": all_errors})

    # Pass 2: everything validated -- create each account.
    created = []
    failed = []
    skip_aadhar = bool(get_setting(SKIP_AADHAR_SETTING_KEY, False))
    for row_number, values in parsed_rows:
        full_name = f"{values['first_name']} {values['last_name']}".strip()
        email = values["email"].lower()
        temp_password = _generate_temp_password()

        try:
            auth_user, _session = await supabase_signup(email, temp_password, full_name, values["phone"])

            profile = {
                "auth_uid": auth_user["id"],
                "email": email,
                "full_name": full_name,
                "phone": values["phone"],
                "role": "pandit",
                "must_change_password": True,
                "metadata": {"registration_type": "pandit", "city": values["city"], "state": values["state"], "approval_status": "pending"},
                "terms_accepted_at": datetime.now(timezone.utc).isoformat(),
            }
            profile_resp = service_supabase.table("users").insert(profile).select(
                "id, auth_uid, email, full_name, phone, role"
            ).execute()
            created_profile = profile_resp.data[0]

            def _split_list(raw_value: str):
                return [item.strip() for item in raw_value.split(",") if item.strip()] if raw_value else []

            pandit_record = {
                "user_id": created_profile["id"],
                "name": full_name,
                "display_name": full_name,
                "address": values["address"] or None,
                "city": values["city"],
                "state": values["state"],
                "pin": values["pincode"] or None,
                "experience_years": int(float(values["experience_years"])) if values["experience_years"] else None,
                "languages_spoken": _split_list(values["languages_spoken"]),
                "specialities": _split_list(values["specialities"]),
                "service_areas": _split_list(values["service_areas"]),
                "price": float(values["price"]) if values["price"] else None,
                "about": values["about"] or None,
                "latitude": float(values["latitude"]) if values["latitude"] else None,
                "longitude": float(values["longitude"]) if values["longitude"] else None,
                # Bulk-created pandits are NOT auto-approved -- they go
                # through the same review as anyone else (temp-password
                # login -> Aadhaar authentication -> photo/bank details
                # -> admin approve/decline), just with their basic info
                # already pre-filled from the spreadsheet.
                "verification_status": "pending",
                "is_active": False,
                "created_by_admin_id": current_user["id"],
                "metadata": {"approval_status": "pending", "source": "admin_bulk_upload"},
                # Same global "skip Aadhaar for new registrations" toggle
                # as self-registration (Admin Settings > Pandit Ji
                # Registration).
                "aadhar_verification_status": "skipped" if skip_aadhar else "not_started",
            }
            service_supabase.table("pandits").insert(pandit_record).execute()

            write_audit_log(
                action="ADMIN_PANDIT_BULK_CREATED",
                actor_id=str(current_user["id"]),
                entity="users",
                entity_id=str(created_profile["id"]),
                payload={"email": email, "name": full_name, "row": row_number},
            )

            created.append({"row": row_number, "name": full_name, "email": email, "temporary_password": temp_password})
        except Exception as exc:
            logger.exception("Bulk pandit creation failed for row %s (%s): %s", row_number, email, exc)
            failed.append({"row": row_number, "email": email, "message": "Could not create this account. Please add this row again in a new upload."})

    write_audit_log(
        action="ADMIN_PANDIT_BULK_UPLOAD",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=None,
        payload={"created_count": len(created), "failed_count": len(failed), "filename": file.filename},
    )

    return {
        "message": f"{len(created)} Pandit Ji account(s) created.",
        "created": created,
        "failed": failed,
    }


@router.post("/{pandit_id}/reset-password")
async def reset_pandit_password(
    pandit_id: str,
    current_user: dict = Depends(require_admin_roles()),
):
    """
    Admin-initiated password reset for an existing Pandit Ji. Generates
    a new temporary password (shown once, for admin to share manually)
    and forces the same "set a new password, then log back in" flow as
    a fresh bulk-uploaded account -- but never touches is_active, so an
    already-live Pandit Ji doesn't get silently hidden by this.
    """

    client = _client()
    pandit = _get_pandit_or_404(client, pandit_id)

    user_resp = client.table("users").select("id, auth_uid, email").eq("id", pandit["user_id"]).limit(1).execute()
    user_rows = getattr(user_resp, "data", None) or []
    if not user_rows:
        raise HTTPException(status_code=404, detail="This Pandit Ji's account could not be found.")
    user = user_rows[0]

    temp_password = _generate_temp_password()
    update_url = f"{SUPABASE_URL}/auth/v1/admin/users/{user['auth_uid']}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.put(update_url, headers=headers, json={"password": temp_password})
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Authentication service is temporarily unavailable.")

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail="Could not reset this Pandit Ji's password. Please try again.")

    client.table("users").update({"must_change_password": True}).eq("id", user["id"]).execute()

    write_audit_log(
        action="ADMIN_PANDIT_PASSWORD_RESET",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(user["id"]),
        payload={"email": user.get("email"), "pandit_name": pandit.get("display_name") or pandit.get("name")},
    )

    return {
        "message": "Password reset. Share this temporary password with the Pandit Ji directly -- it will not be shown again.",
        "email": user.get("email"),
        "temporary_password": temp_password,
    }
