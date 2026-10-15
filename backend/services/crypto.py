"""Field-level encryption for personal data at rest (AES-256-GCM).

Encrypted values are stored as ``enc:v1:<base64url(nonce || ciphertext || tag)>``. The record id
and field name are bound in as associated data, so a ciphertext copied into another record or
field fails to decrypt instead of silently revealing someone else's data.
"""
import base64
import hashlib
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

PREFIX = "enc:v1:"
ALGORITHM = "AES-256-GCM"


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def parse_key(raw: str) -> bytes:
    """Accepts a 32-byte key encoded as base64/base64url (44/43 chars) or hex (64 chars)."""
    raw = raw.strip()
    try:
        key = bytes.fromhex(raw) if len(raw) == 64 else _unb64(raw.replace("+", "-").replace("/", "_").rstrip("="))
    except ValueError as e:
        raise ValueError("DATA_ENCRYPTION_KEY must be 32 bytes, base64- or hex-encoded") from e
    if len(key) != 32:
        raise ValueError("DATA_ENCRYPTION_KEY must decode to exactly 32 bytes")
    return key


def derive_key(secret: str) -> bytes:
    """Development fallback: a data key derived from SECRET_KEY with HKDF-SHA256."""
    return HKDF(algorithm=SHA256(), length=32, salt=b"demeure-ai/pii", info=b"field-encryption-v1").derive(
        secret.encode("utf-8"))


class FieldCipher:
    def __init__(self, key: bytes, key_source: str):
        self._aead = AESGCM(key)
        self.key_source = key_source
        # Short, non-reversible fingerprint so operators can tell which key encrypted the data.
        self.key_id = hashlib.sha256(b"demeure-key-id" + key).hexdigest()[:12]

    @staticmethod
    def is_encrypted(value: object) -> bool:
        return isinstance(value, str) and value.startswith(PREFIX)

    def encrypt(self, plaintext: str, record_id: str, field: str) -> str:
        nonce = os.urandom(12)
        ct = self._aead.encrypt(nonce, plaintext.encode("utf-8"), f"{record_id}|{field}".encode("utf-8"))
        return PREFIX + _b64(nonce + ct)

    def decrypt(self, token: str, record_id: str, field: str) -> str:
        blob = _unb64(token[len(PREFIX):])
        return self._aead.decrypt(blob[:12], blob[12:], f"{record_id}|{field}".encode("utf-8")).decode("utf-8")

    def try_decrypt(self, token: object, record_id: str, field: str) -> Optional[str]:
        if not self.is_encrypted(token):
            return token if isinstance(token, str) else None
        try:
            return self.decrypt(token, record_id, field)
        except Exception:  # wrong key or tampered value
            return None

