from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from audit import write_audit_log
from bank_crypto import decrypt_value, encrypt_value, is_configured, mask_value
from db import convert_record_image_fields, service_supabase, upload_image_to_bucket, validate_image_upload
from notifications import notify_user
from permissions import require_roles

router = APIRouter(prefix="/pandit/me", tags=["pandit-profile"])


def _client():
    if service_supabase is None:
        raise HTTPException(status_code=500, detail="Pandit portal service is not configured.")
    return service_supabase


def _get_pandit_row(client, user_id: str) -> Optional[dict]:
    resp = client.table("pandits").select("*").eq("user_id", user_id).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    return rows[0] if rows else None


def _require_pandit_row(client, user_id: str) -> dict:
    pandit = _get_pandit_row(client, user_id)
    if not pandit:
        raise HTTPException(
            status_code=404,
            detail="Pandit profile not found. Please complete onboarding first.",
        )
    return pandit


def _is_locked_for_review(client, pandit: dict) -> bool:
    """
    A brand-new pandit row also starts life with verification_status
    'pending' (set at registration, before the onboarding wizard is
    even started), so 'pending' alone isn't enough to mean "locked".
    It's only actually locked once documents have been submitted for
    admin review (same signal /status uses to decide the wizard is
    done).
    """
    if pandit.get("verification_status") != "pending":
        return False
    reg_resp = (
        client.table("pandit_registrations")
        .select("id")
        .eq("pandit_id", pandit["id"])
        .limit(1)
        .execute()
    )
    return bool(getattr(reg_resp, "data", None))


def _ensure_editable(client, pandit: dict):
    if _is_locked_for_review(client, pandit):
        raise HTTPException(
            status_code=400,
            detail="Your profile is under admin review and can't be edited right now.",
        )


@router.get("/status")
async def get_pandit_status(current_user: dict = Depends(require_roles("pandit"))):
    """
    Tells the frontend which screen to show:
    - "onboarding": no documents submitted yet -> show the 3-step wizard
    - "pending": documents submitted, awaiting admin review
    - "approved": full dashboard
    - "rejected": show the reason + let them re-submit documents
    """
    client = _client()
    pandit = _get_pandit_row(client, current_user["id"])

    if not pandit:
        # Shouldn't normally happen (registration always creates a bare
        # row), but handled defensively.
        return {"stage": "onboarding", "pandit_id": None}

    verification_status = pandit.get("verification_status") or "pending"

    # An already-approved pandit always goes straight to the dashboard
    # -- whether they got there through the normal wizard-then-review
    # path, or admin bulk-uploaded them directly (created "approved"
    # up front, by design; see admin_pandits.py's bulk-upload). Their
    # profile/services/documents/bank details stay fully editable any
    # time from the dashboard's My Profile screen -- nothing here
    # should force an approved pandit back through the wizard just
    # because they never happened to submit a pandit_registrations row.
    if verification_status == "approved":
        return {
            "stage": "approved",
            "pandit_id": pandit["id"],
            "display_name": pandit.get("display_name") or pandit.get("name"),
            "rejection_reason": None,
        }

    reg_resp = (
        client.table("pandit_registrations")
        .select("id")
        .eq("pandit_id", pandit["id"])
        .limit(1)
        .execute()
    )
    has_submitted_documents = bool(getattr(reg_resp, "data", None))

    if not has_submitted_documents:
        return {"stage": "onboarding", "pandit_id": pandit["id"]}

    return {
        "stage": verification_status,
        "pandit_id": pandit["id"],
        "display_name": pandit.get("display_name") or pandit.get("name"),
        "rejection_reason": pandit.get("rejection_reason"),
    }


@router.get("/profile")
async def get_profile(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_row(client, current_user["id"])
    return {"pandit": pandit}


class ProfileIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    experience_years: Optional[int] = Field(default=None, ge=0)
    address: str = Field(min_length=1, max_length=500)
    city: str = Field(min_length=1, max_length=120)
    pin: str = Field(min_length=1, max_length=12)


@router.put("/profile")
async def update_profile(
    payload: ProfileIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _get_pandit_row(client, current_user["id"])

    columns = {
        "name": payload.full_name.strip(),
        "display_name": payload.full_name.strip(),
        "date_of_birth": payload.date_of_birth,
        "languages_spoken": payload.languages,
        "experience_years": payload.experience_years,
        "address": payload.address.strip(),
        "city": payload.city.strip(),
        "pin": payload.pin.strip(),
    }

    if pandit:
        _ensure_editable(client, pandit)
        resp = client.table("pandits").update(columns).eq("id", pandit["id"]).select("*").execute()
        action = "PANDIT_PROFILE_UPDATED"
    else:
        columns["user_id"] = current_user["id"]
        resp = client.table("pandits").insert(columns).select("*").execute()
        action = "PANDIT_PROFILE_CREATED"

    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save your profile.")
    saved = rows[0]

    write_audit_log(
        action=action,
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(saved["id"]),
        payload={"name": saved.get("display_name")},
    )

    return {"message": "Profile saved successfully.", "pandit": saved}


class AvailabilityIn(BaseModel):
    days: List[str] = Field(min_length=1)
    start_time: str
    end_time: str


@router.put("/availability")
async def update_availability(
    payload: AvailabilityIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    client = _client()
    pandit = _require_pandit_row(client, current_user["id"])
    _ensure_editable(client, pandit)

    pattern = {"days": payload.days, "start_time": payload.start_time, "end_time": payload.end_time}

    client.table("pandits").update({"availability_pattern": pattern}).eq("id", pandit["id"]).execute()

    write_audit_log(
        action="PANDIT_AVAILABILITY_UPDATED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(pandit["id"]),
        payload=pattern,
    )

    return {"message": "Availability saved successfully.", "availability_pattern": pattern}


async def _read_upload(file: Optional[UploadFile], pandit_id: str, kind: str) -> Optional[str]:
    if file is None or not file.filename:
        return None
    content = await file.read()
    if not content:
        return None
    validate_image_upload(file.content_type, content)
    ext = ""
    if "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()
    path = f"pandits/{pandit_id}/{kind}{ext}"
    return upload_image_to_bucket(content, file.content_type or "", path)


@router.get("/documents")
async def get_documents(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_row(client, current_user["id"])
    if not pandit:
        return {"registration": None}

    resp = (
        client.table("pandit_registrations")
        .select("*")
        .eq("pandit_id", pandit["id"])
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = getattr(resp, "data", None) or []
    registration = rows[0] if rows else None
    if registration:
        convert_record_image_fields(registration, fields=["aadhar_front_url", "aadhar_back_url", "photo_url"])

    return {"registration": registration}


@router.put("/documents")
async def update_documents(
    aadhar_front: Optional[UploadFile] = File(default=None),
    aadhar_back: Optional[UploadFile] = File(default=None),
    photo: Optional[UploadFile] = File(default=None),
    current_user: dict = Depends(require_roles("pandit")),
):
    """
    Aadhaar front/back is only relevant for a pandit whose Aadhaar
    verification is "skipped" (either admin skipped it for them
    individually, or the global Admin Settings toggle skips it for
    everyone) -- otherwise Aadhaar goes through the OTP flow in
    routers/pandit_aadhar.py and these two fields are simply ignored.

    Called separately for Aadhaar images vs. the photo (two distinct
    UI steps), so this accepts a PARTIAL update each time rather than
    requiring everything in one call -- "already submitted, locked"
    only applies once the submission is actually complete (photo_url
    present), not after the first partial piece.
    """
    client = _client()
    pandit = _require_pandit_row(client, current_user["id"])

    existing_resp = (
        client.table("pandit_registrations")
        .select("*")
        .eq("pandit_id", pandit["id"])
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing_resp, "data", None) or []
    existing_reg = existing_rows[0] if existing_rows else None
    already_complete = bool(existing_reg and existing_reg.get("photo_url"))

    if already_complete and pandit.get("verification_status") == "pending":
        raise HTTPException(
            status_code=400,
            detail="Your documents are already submitted and under admin review.",
        )

    aadhar_status = pandit.get("aadhar_verification_status")
    if aadhar_status not in ("verified", "skipped"):
        raise HTTPException(
            status_code=400,
            detail="Please complete Aadhaar authentication before uploading documents.",
        )

    aadhar_front_url = await _read_upload(aadhar_front, pandit["id"], "aadhar-front")
    aadhar_back_url = await _read_upload(aadhar_back, pandit["id"], "aadhar-back")
    photo_url = await _read_upload(photo, pandit["id"], "photo")

    if not (aadhar_front_url or aadhar_back_url or photo_url):
        raise HTTPException(status_code=400, detail="Please choose at least one file to upload.")

    columns = {}
    if aadhar_front_url:
        columns["aadhar_front_url"] = aadhar_front_url
    if aadhar_back_url:
        columns["aadhar_back_url"] = aadhar_back_url
    if photo_url:
        columns["photo_url"] = photo_url

    if existing_reg:
        columns["submitted_at"] = datetime.now(timezone.utc).isoformat()
        columns["reviewed_by"] = None
        columns["reviewed_at"] = None
        resp = (
            client.table("pandit_registrations")
            .update(columns)
            .eq("id", existing_reg["id"])
            .select("*")
            .execute()
        )
    else:
        columns["pandit_id"] = pandit["id"]
        resp = client.table("pandit_registrations").insert(columns).select("*").execute()

    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save your documents.")
    saved_reg = rows[0]

    pandit_updates = {}

    # Resubmitting after a rejection puts the profile back into review.
    if pandit.get("verification_status") == "rejected":
        pandit_updates["verification_status"] = "pending"
        pandit_updates["rejection_reason"] = None

    # The passport photo doubles as the pandit's public display picture
    # everywhere (home page, pandit detail page, etc.) once uploaded.
    if photo_url:
        pandit_updates["avatar_url"] = photo_url

    if pandit_updates:
        client.table("pandits").update(pandit_updates).eq("id", pandit["id"]).execute()

    write_audit_log(
        action="PANDIT_DOCUMENTS_SUBMITTED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(pandit["id"]),
        payload={"resubmission": existing_reg is not None, "aadhar_images": bool(aadhar_front_url or aadhar_back_url)},
    )

    # Only notify admin once the submission is actually complete (a
    # photo is present) -- a 'skipped' pandit's Aadhaar-images-only
    # call shouldn't page admin before there's anything to fully review.
    if saved_reg.get("photo_url") and service_supabase is not None:
        try:
            pandit_name = pandit.get("display_name") or pandit.get("name") or "A Pandit Ji"
            admins_resp = service_supabase.table("users").select("id").eq("role", "admin").execute()
            for admin_row in getattr(admins_resp, "data", None) or []:
                await notify_user(
                    user_id=admin_row["id"],
                    type="PANDIT_REGISTRATION_SUBMITTED",
                    title="New Pandit Ji awaiting review" if not existing_reg else "Pandit Ji re-submitted documents",
                    message=f"{pandit_name} submitted documents for review.",
                    link="/admin/pandits",
                    metadata={"pandit_id": pandit["id"]},
                )
        except Exception:
            pass

    convert_record_image_fields(saved_reg, fields=["aadhar_front_url", "aadhar_back_url", "photo_url"])
    return {"message": "Documents submitted successfully.", "registration": saved_reg}


@router.get("/bank-details")
async def get_bank_details(current_user: dict = Depends(require_roles("pandit"))):
    client = _client()
    pandit = _get_pandit_row(client, current_user["id"])
    if not pandit:
        return {"bank_details": None}

    resp = client.table("pandit_bank_details").select("*").eq("pandit_id", pandit["id"]).limit(1).execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        return {"bank_details": None}

    row = rows[0]
    return {
        "bank_details": {
            "account_holder_name": row.get("account_holder_name"),
            "bank_name": row.get("bank_name"),
            "account_number_masked": mask_value(decrypt_value(row.get("account_no_enc"))),
            "ifsc_masked": mask_value(decrypt_value(row.get("ifsc_enc"))),
            "upi_id": decrypt_value(row.get("upi_id_enc")),
            "updated_at": row.get("updated_at"),
        }
    }


class BankDetailsIn(BaseModel):
    account_holder_name: str = Field(min_length=1, max_length=200)
    bank_name: str = Field(min_length=1, max_length=200)
    # Optional on purpose: once bank details exist, re-submitting (e.g.
    # just to add/change the UPI ID) shouldn't force the pandit to
    # retype the full account number/IFSC every time -- the masked
    # values shown on screen aren't real input they can just resend.
    # Only the very first submission actually requires them (enforced
    # below).
    account_number: Optional[str] = Field(default=None, min_length=4, max_length=34)
    ifsc: Optional[str] = Field(default=None, min_length=4, max_length=20)
    upi_id: Optional[str] = None


@router.put("/bank-details")
async def update_bank_details(
    payload: BankDetailsIn,
    current_user: dict = Depends(require_roles("pandit")),
):
    if not is_configured():
        raise HTTPException(status_code=500, detail="Bank details storage is not configured.")

    client = _client()
    pandit = _require_pandit_row(client, current_user["id"])

    existing_resp = (
        client.table("pandit_bank_details")
        .select("account_no_enc, ifsc_enc, upi_id_enc")
        .eq("pandit_id", pandit["id"])
        .limit(1)
        .execute()
    )
    existing_rows = getattr(existing_resp, "data", None) or []
    existing = existing_rows[0] if existing_rows else None

    if not existing and not (payload.account_number and payload.ifsc):
        raise HTTPException(
            status_code=400,
            detail="Please enter your account number and IFSC code.",
        )

    # PostgREST's upsert replaces the *entire* row on conflict -- a key
    # simply missing from the payload is NOT left untouched, it's
    # written as NULL (and pandit_bank_details.account_no_enc/ifsc_enc
    # are NOT NULL). So a value that wasn't resubmitted (e.g. only
    # adding a UPI ID) must be explicitly carried forward from the
    # existing encrypted row rather than omitted.
    columns = {
        "pandit_id": pandit["id"],
        "account_holder_name": payload.account_holder_name.strip(),
        "bank_name": payload.bank_name.strip(),
        "account_no_enc": encrypt_value(payload.account_number) if payload.account_number else existing["account_no_enc"],
        "ifsc_enc": encrypt_value(payload.ifsc.upper()) if payload.ifsc else existing["ifsc_enc"],
        "upi_id_enc": encrypt_value(payload.upi_id) if payload.upi_id else (existing["upi_id_enc"] if existing else None),
    }

    resp = client.table("pandit_bank_details").upsert(columns, on_conflict="pandit_id").select("*").execute()
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status_code=500, detail="Could not save your bank details.")

    write_audit_log(
        action="PANDIT_BANK_DETAILS_UPDATED",
        actor_id=str(current_user["id"]),
        entity="pandits",
        entity_id=str(pandit["id"]),
        payload={},
    )

    return {"message": "Bank details saved successfully."}
