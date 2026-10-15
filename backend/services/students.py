"""Resident student records: encrypted personal fields and hashed sign-in codes.

A stored record keeps operational fields (name, course, block, room) in clear so the hostel can
work with them, while contact, family, health and address details are AES-256-GCM encrypted
(see services.crypto). The access code is stored only as a salted PBKDF2 hash.
"""
import base64
import hashlib
import hmac
import secrets
from typing import Optional

from services.crypto import FieldCipher

COLLECTION = "students"
ENCRYPTED_FIELDS = (
    "phone", "dateOfBirth", "bloodGroup", "guardianName", "guardianRelation",
    "guardianPhone", "guardianEmail", "homeAddress", "medicalNotes",
)
PUBLIC_FIELDS = (
    "id", "studentId", "regNo", "name", "email", "gender", "course", "branch", "yearOfStudy",
    "block", "room", "roomId", "dietaryPref", "status", "proctorId", "createdAt",
)
PBKDF2_ITERATIONS = 120_000


def student_id(email: str) -> str:
    return f"student:{email.strip().lower()}"


def _normalise_code(code: str) -> bytes:
    """Codes are case-insensitive and may be typed with or without the dash."""
    return "".join(ch for ch in code.upper() if ch.isalnum()).encode("utf-8")


def hash_code(code: str, salt: Optional[bytes] = None) -> dict:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", _normalise_code(code), salt, PBKDF2_ITERATIONS)
    return {"alg": "pbkdf2-sha256", "iterations": PBKDF2_ITERATIONS,
            "salt": base64.b64encode(salt).decode("ascii"), "hash": base64.b64encode(digest).decode("ascii")}


def verify_code(credential: dict, code: str) -> bool:
    salt = base64.b64decode(credential["salt"])
    expected = base64.b64decode(credential["hash"])
    digest = hashlib.pbkdf2_hmac("sha256", _normalise_code(code), salt,
                                 int(credential.get("iterations", PBKDF2_ITERATIONS)))
    return hmac.compare_digest(digest, expected)


def build_record(profile: dict, access_code: str, cipher: FieldCipher) -> dict:
    """Turns a plaintext profile into the stored form: PII encrypted, access code hashed."""
    rid = student_id(profile["email"])
    doc = {k: profile[k] for k in PUBLIC_FIELDS if k in profile}
    doc["id"] = rid
    doc["email"] = profile["email"].strip().lower()
    for field in ENCRYPTED_FIELDS:
        value = profile.get(field)
        if value:
            doc[field] = cipher.encrypt(str(value), rid, field)
    doc["credential"] = hash_code(access_code)
    doc["encryption"] = {"algorithm": "AES-256-GCM", "keyId": cipher.key_id}
    return doc


def decrypt_record(doc: dict, cipher: FieldCipher) -> dict:
    """Full profile for authorised viewers. Never includes the credential hash."""
    out = {k: doc[k] for k in PUBLIC_FIELDS if k in doc}
    unreadable = []
    for field in ENCRYPTED_FIELDS:
        if field in doc:
            value = cipher.try_decrypt(doc[field], doc["id"], field)
            if value is None:
                unreadable.append(field)
            out[field] = value
    if unreadable:
        out["decryptionErrors"] = unreadable
    return out


def _mask_phone(phone: Optional[str]) -> str:
    digits = "".join(ch for ch in phone or "" if ch.isdigit())
    return f"+91 {digits[-10:-8]}••••••{digits[-2:]}" if len(digits) >= 10 else "—"


def directory_entry(doc: dict, cipher: FieldCipher) -> dict:
    """Directory row: operational fields plus masked contact details."""
    out = {k: doc[k] for k in PUBLIC_FIELDS if k in doc}
    out["phoneMasked"] = _mask_phone(cipher.try_decrypt(doc.get("phone"), doc["id"], "phone"))
    out["encryptedFields"] = [f for f in ENCRYPTED_FIELDS if cipher.is_encrypted(doc.get(f))]
    return out


def stored_view(doc: dict) -> dict:
    """The record exactly as persisted (ciphertext included), minus the credential hash."""
    view = {k: v for k, v in doc.items() if k != "credential"}
    view["credential"] = {"alg": doc["credential"]["alg"], "iterations": doc["credential"]["iterations"],
                          "hash": doc["credential"]["hash"][:16] + "…"} if "credential" in doc else None
    return view


class StudentRegistry:
    """Store-backed lookups used by sign-in and notifications."""

    def __init__(self, store, cipher: FieldCipher):
        self.store = store
        self.cipher = cipher

    def get(self, email: str) -> Optional[dict]:
        return self.store.get(COLLECTION, student_id(email)) if email else None

    def guardian_email(self, email: str) -> str:
        doc = self.get(email)
        if not doc:
            return ""
        return self.cipher.try_decrypt(doc.get("guardianEmail"), doc["id"], "guardianEmail") or ""


# Unambiguous characters only (no 0/O, 1/I/L), so codes can be read out or printed safely.
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_access_code() -> str:
    raw = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(8))
    return f"{raw[:4]}-{raw[4:]}"
