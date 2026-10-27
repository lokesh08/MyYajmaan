"""
Encrypt/decrypt helpers for the sensitive columns on
public.pandit_bank_details (account_no_enc, ifsc_enc, upi_id_enc).

Uses Fernet (symmetric, authenticated encryption) keyed by
BANK_DETAILS_ENCRYPTION_KEY. Never log or return decrypted values in
full — callers should only ever surface a masked form (e.g. last 4
digits) back to the client.
"""

import logging
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

_KEY = os.getenv("BANK_DETAILS_ENCRYPTION_KEY")
_fernet: Optional[Fernet] = None

if _KEY:
    try:
        _fernet = Fernet(_KEY.encode())
    except Exception:
        logger.exception("BANK_DETAILS_ENCRYPTION_KEY is set but invalid.")
        _fernet = None
else:
    logger.warning("BANK_DETAILS_ENCRYPTION_KEY is not configured — bank details cannot be stored.")


def is_configured() -> bool:
    return _fernet is not None


def encrypt_value(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if _fernet is None:
        raise RuntimeError("Bank details encryption is not configured.")
    return _fernet.encrypt(value.strip().encode()).decode()


def decrypt_value(token: Optional[str]) -> Optional[str]:
    if not token or _fernet is None:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        logger.error("Could not decrypt a bank details value — key mismatch or corrupted data.")
        return None


def mask_value(value: Optional[str], visible: int = 4) -> Optional[str]:
    """Returns only the last N characters, for display (e.g. "••••1234")."""
    if not value:
        return None
    if len(value) <= visible:
        return "•" * len(value)
    return f"{'•' * (len(value) - visible)}{value[-visible:]}"
