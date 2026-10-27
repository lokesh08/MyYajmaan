import base64
import hashlib
import hmac
import os
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from audit import write_audit_log
from db import service_supabase
from permissions import optional_current_user

router = APIRouter(prefix="/contact", tags=["contact"])
CAPTCHA_SECRET = os.getenv("CONTACT_CAPTCHA_SECRET") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "development-contact-captcha-secret"


class ContactMessageIn(BaseModel):
    firstName: str = Field(min_length=1, max_length=80)
    lastName: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=7, max_length=30)
    email: EmailStr
    message: str = Field(min_length=10, max_length=2000)
    captchaAnswer: str = Field(min_length=1, max_length=10)
    captchaToken: str = Field(min_length=1, max_length=500)


def _captcha_signature(challenge: str) -> str:
    return hmac.new(CAPTCHA_SECRET.encode(), challenge.encode(), hashlib.sha256).hexdigest()


@router.get("/captcha")
async def get_contact_captcha():
    first = secrets.randbelow(8) + 2
    second = secrets.randbelow(8) + 2
    challenge = f"{first}:{second}"
    token = base64.urlsafe_b64encode(f"{challenge}:{_captcha_signature(challenge)}".encode()).decode()
    return {"question": f"What is {first} + {second}?", "token": token}


def _extract_created_record(response: Any) -> dict:
    response_status = getattr(response, "status_code", None)
    if response_status is not None and response_status >= 400:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONTACT_MESSAGE_SAVE_FAILED",
                "message": "We could not send your message. Please try again.",
            },
        )

    records = getattr(response, "data", None) or []
    if not records:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONTACT_MESSAGE_SAVE_FAILED",
                "message": "We could not send your message. Please try again.",
            },
        )

    return records[0]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_contact_message(
    payload: ContactMessageIn,
    current_user: dict | None = Depends(optional_current_user),
):
    if service_supabase is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "DATABASE_NOT_CONFIGURED",
                "message": "The contact service is not configured.",
            },
        )

    try:
        decoded = base64.urlsafe_b64decode(payload.captchaToken.encode()).decode()
        first, second, signature = decoded.split(":")
        challenge = f"{first}:{second}"
        expected_answer = int(first) + int(second)
        valid_captcha = hmac.compare_digest(signature, _captcha_signature(challenge)) and int(payload.captchaAnswer) == expected_answer
    except (ValueError, TypeError, UnicodeDecodeError):
        valid_captcha = False

    if not valid_captcha:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_CAPTCHA", "message": "Please complete the security check correctly."},
        )

    record = {
        "user_id": current_user.get("id") if current_user else None,
        "first_name": payload.firstName.strip(),
        "last_name": payload.lastName.strip(),
        "phone": payload.phone.strip(),
        "email": str(payload.email).lower(),
        "message": payload.message.strip(),
        "status": "new",
    }

    try:
        response = (
            service_supabase
            .table("contact_messages")
            .insert(record)
            .select("id, status, created_at")
            .execute()
        )
        saved_record = _extract_created_record(response)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "CONTACT_MESSAGE_SAVE_FAILED",
                "message": "We could not send your message. Please try again.",
            },
        )

    write_audit_log(
        action="contact_message.created",
        actor_id=str(current_user["id"]) if current_user else None,
        entity="contact_messages",
        entity_id=str(saved_record.get("id")),
        payload={
            "role": current_user.get("role") if current_user else "anonymous",
            "email": record["email"],
            "status": record["status"],
        },
    )

    return {
        "message": "Your message has been sent successfully.",
        "contact": saved_record,
    }
