"""
Encrypt/decrypt helper for the sensitive pandits.aadhar_number_enc
column. Separate key from bank_crypto.py's BANK_DETAILS_ENCRYPTION_KEY
deliberately -- these are two different categories of KYC secret, so
one key getting rotated/compromised doesn't affect the other.

Same Fernet (symmetric, authenticated encryption) approach. Never log
or return a decrypted Aadhaar number in full -- callers must only ever
surface a masked form (last 4 digits) back to a client.
"""

import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_KEY = os.getenv("AADHAR_ENCRYPTION_KEY")
_fernet: Optional[Fernet] = None

if _KEY:
    try:
        _fernet = Fernet(_KEY.encode())
    except Exception:
        logger.exception("AADHAR_ENCRYPTION_KEY is set but invalid.")
        _fernet = None
else:
    logger.warning("AADHAR_ENCRYPTION_KEY is not configured — Aadhaar numbers cannot be stored.")


def is_configured() -> bool:
    return _fernet is not None


def encrypt_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if _fernet is None:
        raise RuntimeError("Aadhaar encryption is not configured.")
    return _fernet.encrypt(value.strip().encode()).decode()


def decrypt_value(token: Optional[str]) -> Optional[str]:
    if not token or _fernet is None:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        logger.error("Could not decrypt an Aadhaar value — key mismatch or corrupted data.")
        return None


def mask_value(value: Optional[str], visible: int = 4) -> Optional[str]:
    """Returns only the last N digits, for display (e.g. "•••• •••• 1234")."""
    if not value:
        return None
    if len(value) <= visible:
        return "•" * len(value)
    return f"{'•' * (len(value) - visible)}{value[-visible:]}"
