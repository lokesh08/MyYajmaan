"""
Aadhaar OTP authentication for Pandit Ji onboarding -- replaces the
old raw Aadhaar front/back photo upload. Flow:

  1. POST /send-otp    {aadhar_number}  -> generates + "sends" an OTP
  2. POST /verify-otp  {otp}            -> validates it, then compares
     the (mock) UIDAI demographic response against the pandit's own
     account name/phone
  3. If they match: aadhar_verification_status = "verified", the
     pandit may proceed to photo + bank details.
     If they don't: "mismatch" -- blocked from proceeding until they
     fix their profile, then POST /recheck (no new OTP needed, since
     the UIDAI-side data is already on file).

Admin can also set aadhar_verification_status = "skipped" for a
pandit whose Aadhaar isn't mobile-linked (see routers/admin_pandits.py
skip_aadhar_verification) -- that also unblocks step 3.


NO LICENSED UIDAI/AUA-KUA PROVIDER IS WIRED UP YET
====================================================
Real Aadhaar e-KYC requires a government-licensed intermediary
(Digio, Signzy, Surepass, Karza, etc.) with a paid account -- not
something this app can call directly. Until one is configured
(AADHAR_MOCK_MODE=false plus real provider credentials), send_otp()
and _mock_uidai_lookup() below simulate the whole exchange so the
rest of the flow (this router, the onboarding UI, admin's skip
override, mismatch handling) is fully real and testable. Swapping in
a real provider later only means rewriting the body of those two
functions -- everything downstream of them (status transitions, the
mismatch check, the UI) stays the same.

Mock test values (last digit of the 12-digit Aadhaar number entered):
  - ends in 1 or 3  -> "UIDAI" returns a NAME THAT DOESN'T MATCH the
                       pandit's account -> exercises the mismatch path
  - ends in 5 or 7  -> "UIDAI" returns a matching name but gender
                       "female" -> exercises admin's female-highlight
  - anything else   -> matching name, gender "male" -> the normal,
                       clean success path
The OTP itself is a real random 6 digits, hashed server-side; since
there's no real SMS gateway, send_otp()'s response includes it in
`debug_otp` (mock mode only -- this field must not exist once a real
provider sends the OTP directly to the phone).
"""

import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import aadhar_crypto
import config
from audit import write_audit_log
from db import convert_record_image_fields, service_supabase
from permissions import require_roles

router = APIRouter(prefix="/pandit/me/aadhar", tags=["pandit-aadhar"])
logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
AADHAR_RE = re.compile(r"^\d{12}$")


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_pandit_or_404(client, user_id: str) -> dict:
    resp = client.table("pandits").select("*").eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=404, detail="Pandit profile not found. Please complete onboarding first.")
    return rows[0]


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _mock_uidai_lookup(aadhar_number: str, account_name: str) -> dict:
    """See module docstring for the exact test-value rules."""
    last_digit = aadhar_number[-1]
    if last_digit in ("1", "3"):
        return {"name": "Mismatch Test Name", "phone": "9000000000", "gender": "male"}
    if last_digit in ("5", "7"):
        return {"name": account_name, "phone": None, "gender": "female"}
    return {"name": account_name, "phone": None, "gender": "male"}


def _normalize_name(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _normalize_phone(value: Optional[str]) -> str:
    return re.sub(r"\D", "", value or "")


def _apply_match_result(client, pandit: dict, current_user: dict, aadhar_name: str, aadhar_phone: Optional[str]) -> dict:
    """Compares the (mock) UIDAI record against the pandit's account and
    updates aadhar_verification_status accordingly. Returns the result dict
    the endpoint responds with."""

    account_name = current_user.get("full_name") or ""
    account_phone = current_user.get("phone") or ""

    name_matches = _normalize_name(aadhar_name) == _normalize_name(account_name)
    # A None phone from the mock means "UIDAI didn't return one to check" --
    # treated as a pass rather than a forced mismatch (a real provider
    # always returns one; this only happens in the mock's "female" case).
    phone_matches = aadhar_phone is None or _normalize_phone(aadhar_phone) == _normalize_phone(account_phone)

    matched = name_matches and phone_matches
    status = "verified" if matched else "mismatch"

    update_columns = {
        "aadhar_verification_status": status,
        "aadhar_name_on_record": aadhar_name,
        "aadhar_phone_on_record": aadhar_phone,
    }
    if matched:
        update_columns["aadhar_verified_at"] = datetime.now(timezone.utc).isoformat()

    client.table("pandits").update(update_columns).eq("id", pandit["id"]).execute()

    write_audit_log(
        action="PANDIT_AADHAR_VERIFIED" if matched else "PANDIT_AADHAR_MISMATCH",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(pandit["id"]),
        payload={"name_matches": name_matches, "phone_matches": phone_matches},
    )

    mismatched_fields = []
    if not name_matches:
        mismatched_fields.append("name")
    if not phone_matches:
        mismatched_fields.append("phone")

    return {
        "status": status,
        "matched": matched,
        "mismatched_fields": mismatched_fields,
        "message": (
            "Aadhaar verified successfully."
            if matched
            else (
                "Aadhaar is validated, but the "
                + " and ".join(mismatched_fields)
                + " on your Aadhaar doesn't match what's on your MyYajmaan profile. "
                "Please correct your profile in the Profile tab to match your Aadhaar card exactly, "
                "then come back here and tap \"Re-check\" -- no need to redo the OTP."
            )
        ),
    }


class SendOtpIn(BaseModel):
    aadhar_number: str = Field(min_length=12, max_length=12)


@router.post("/send-otp")
async def send_otp(payload: SendOtpIn, current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    if pandit.get("aadhar_verification_status") in ("verified", "skipped"):
        raise HTTPException(status_code=400, detail="Aadhaar is already verified for your account.")

    aadhar_number = payload.aadhar_number.strip()
    if not AADHAR_RE.match(aadhar_number):
        raise HTTPException(status_code=400, detail="Please enter a valid 12-digit Aadhaar number.")

    if not aadhar_crypto.is_configured():
        raise HTTPException(status_code=500, detail="Aadhaar verification is not configured.")

    otp = f"{secrets.randbelow(1_000_000):06d}"

    client.table("pandits").update(
        {
            "aadhar_number_enc": aadhar_crypto.encrypt_value(aadhar_number),
            "aadhar_verification_status": "otp_sent",
            "aadhar_otp_hash": _hash_otp(otp),
            "aadhar_otp_sent_at": datetime.now(timezone.utc).isoformat(),
            "aadhar_otp_attempts": 0,
        }
    ).eq("id", pandit["id"]).execute()

    write_audit_log(
        action="PANDIT_AADHAR_OTP_SENT",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(pandit["id"]),
        payload={"masked_aadhar": aadhar_crypto.mask_value(aadhar_number)},
    )

    if config.aadhar_mock_active():
        logger.info("MOCK Aadhaar OTP for pandit %s: %s", pandit["id"], otp)

    response = {
        "message": "An OTP has been sent to the mobile number linked with this Aadhaar.",
        "masked_aadhar": aadhar_crypto.mask_value(aadhar_number),
    }
    if config.aadhar_mock_active():
        # No real SMS gateway behind this yet -- see module docstring.
        # Must be removed once a real provider actually delivers the OTP.
        response["debug_otp"] = otp
        response["debug_note"] = "Mock mode: no real SMS is sent. This OTP is shown only for testing."
    return response


class VerifyOtpIn(BaseModel):
    otp: str = Field(min_length=6, max_length=6)


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpIn, current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    if pandit.get("aadhar_verification_status") != "otp_sent":
        raise HTTPException(status_code=400, detail="Please request a new OTP first.")

    sent_at = pandit.get("aadhar_otp_sent_at")
    if sent_at:
        sent_dt = datetime.fromisoformat(sent_at.replace("Z", "+00:00"))
        if datetime.now(timezone.utc) - sent_dt > timedelta(minutes=OTP_EXPIRY_MINUTES):
            raise HTTPException(status_code=400, detail="This OTP has expired. Please request a new one.")

    attempts = pandit.get("aadhar_otp_attempts") or 0
    if attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new OTP.")

    if _hash_otp(payload.otp.strip()) != pandit.get("aadhar_otp_hash"):
        client.table("pandits").update({"aadhar_otp_attempts": attempts + 1}).eq("id", pandit["id"]).execute()
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please try again.")

    aadhar_number = aadhar_crypto.decrypt_value(pandit.get("aadhar_number_enc"))
    if not aadhar_number:
        raise HTTPException(status_code=500, detail="Could not read your Aadhaar details. Please try again.")

    account_name = current_user.get("full_name") or ""
    lookup = _mock_uidai_lookup(aadhar_number, account_name)

    # Update gender on the account from the (mock) UIDAI record -- the
    # one place this app currently learns it at all.
    if lookup.get("gender"):
        client.table("users").update({"gender": lookup["gender"]}).eq("id", current_user["id"]).execute()

    client.table("pandits").update({"aadhar_otp_hash": None}).eq("id", pandit["id"]).execute()

    return _apply_match_result(client, pandit, current_user, lookup["name"], lookup.get("phone"))


@router.post("/recheck")
async def recheck_match(current_user: dict = Depends(require_roles("pandit"))):
    """
    After a mismatch, the pandit fixes their profile name/phone and
    calls this instead of redoing the OTP -- the UIDAI-side data from
    the original verify is already on file.
    """
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    if pandit.get("aadhar_verification_status") != "mismatch":
        raise HTTPException(status_code=400, detail="There is no pending Aadhaar mismatch to re-check.")

    return _apply_match_result(
        client, pandit, current_user, pandit.get("aadhar_name_on_record") or "", pandit.get("aadhar_phone_on_record")
    )


@router.get("/status")
async def get_status(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])
    aadhar_number = aadhar_crypto.decrypt_value(pandit.get("aadhar_number_enc"))
    status = pandit.get("aadhar_verification_status") or "not_started"

    # When Aadhaar is "skipped" (admin skipped it for this pandit, or
    # the global setting skips it for everyone), the frontend shows a
    # raw Aadhaar-card-image upload form instead of OTP -- but only
    # until images are actually on file, after which it's a read-only
    # "submitted, awaiting review" state instead of asking again.
    aadhar_images = None
    if status == "skipped":
        reg_resp = (
            client.table("pandit_registrations")
            .select("aadhar_front_url, aadhar_back_url")
            .eq("pandit_id", pandit["id"])
            .order("submitted_at", desc=True)
            .limit(1)
            .execute()
        )
        reg_rows = getattr(reg_resp, "data", None) or []
        if reg_rows and (reg_rows[0].get("aadhar_front_url") or reg_rows[0].get("aadhar_back_url")):
            convert_record_image_fields(reg_rows[0], fields=["aadhar_front_url", "aadhar_back_url"])
            aadhar_images = {
                "front_url": reg_rows[0].get("aadhar_front_url"),
                "back_url": reg_rows[0].get("aadhar_back_url"),
                "submitted": bool(reg_rows[0].get("aadhar_front_url") and reg_rows[0].get("aadhar_back_url")),
            }

    return {
        "status": status,
        "masked_aadhar": aadhar_crypto.mask_value(aadhar_number) if aadhar_number else None,
        "aadhar_name_on_record": pandit.get("aadhar_name_on_record"),
        "aadhar_phone_on_record": pandit.get("aadhar_phone_on_record"),
        "verified_at": pandit.get("aadhar_verified_at"),
        "aadhar_images": aadhar_images,
        # So the frontend can show/prefill "what's currently on your
        # MyYajmaan profile" next to the Aadhaar record, without a
        # second round-trip to a different endpoint.
        "account_name": current_user.get("full_name"),
        "account_phone": current_user.get("phone"),
    }


class FixIdentityIn(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    phone: Optional[str] = Field(default=None, min_length=7, max_length=20)


@router.patch("/fix-identity")
async def fix_identity(payload: FixIdentityIn, current_user: dict = Depends(require_roles("pandit"))):
    """
    Narrow, single-purpose correction for the Aadhaar-mismatch recovery
    flow -- lets a pandit fix just their name/phone (to match their
    Aadhaar card) without going through the full profile form. Call
    POST /recheck right after this to re-run the match.
    """
    if not payload.full_name and not payload.phone:
        raise HTTPException(status_code=400, detail="Please provide a name or phone number to update.")

    client = _client()
    pandit = _get_pandit_or_404(client, current_user["id"])

    user_columns = {}
    pandit_columns = {}
    if payload.full_name:
        user_columns["full_name"] = payload.full_name.strip()
        pandit_columns["name"] = payload.full_name.strip()
        pandit_columns["display_name"] = payload.full_name.strip()
    if payload.phone:
        user_columns["phone"] = payload.phone.strip()

    client.table("users").update(user_columns).eq("id", current_user["id"]).execute()
    if pandit_columns:
        client.table("pandits").update(pandit_columns).eq("id", pandit["id"]).execute()

    write_audit_log(
        action="PANDIT_IDENTITY_CORRECTED",
        actor_id=str(current_user["id"]),
        entity="users",
        entity_id=str(current_user["id"]),
        payload={"fields": list(user_columns.keys())},
    )

    return {"message": "Profile updated. You can now re-check your Aadhaar match."}
