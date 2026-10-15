"""Resident directory. Personal fields are decrypted only for authorised viewers, and every
decryption of another person's record is written to the audit log."""
from fastapi import APIRouter, Depends, HTTPException, status

from deps import STAFF_ROLES, Services, get_or_404, get_services, require_roles
from routers.billing import load_billing
from services.auth import SessionUser
from services.crypto import ALGORITHM
from services.students import (COLLECTION, ENCRYPTED_FIELDS, decrypt_record, directory_entry, stored_view,
                               student_id)

router = APIRouter(prefix="/api/students", tags=["students"])
staff = require_roles(*STAFF_ROLES)


def _encryption_info(services: Services) -> dict:
    return {"algorithm": ALGORITHM, "keyId": services.cipher.key_id, "keySource": services.cipher.key_source,
            "encryptedFields": list(ENCRYPTED_FIELDS), "credentialHash": "PBKDF2-HMAC-SHA256, 120,000 iterations"}


@router.get("")
def directory(services: Services = Depends(get_services), _: SessionUser = Depends(staff)) -> dict:
    docs = sorted(services.store.list(COLLECTION), key=lambda d: (d.get("block", ""), d.get("room", ""), d.get("name", "")))
    cycle = load_billing(services.store)["cycleId"]
    paid = {p["studentId"] for p in services.store.list("payments") if p.get("cycleId") == cycle}
    rows = [{**directory_entry(d, services.cipher), "duesPaid": d["id"] in paid} for d in docs]
    return {"students": rows, "cycleId": cycle, "encryption": _encryption_info(services)}


@router.get("/me")
def my_profile(services: Services = Depends(get_services), user: SessionUser = Depends(require_roles("Student"))) -> dict:
    doc = services.store.get(COLLECTION, user.id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resident record is linked to this account")
    return {**decrypt_record(doc, services.cipher), "encryption": _encryption_info(services)}


@router.get("/{sid}")
def profile(sid: str, services: Services = Depends(get_services), user: SessionUser = Depends(staff)) -> dict:
    doc = get_or_404(services.store, COLLECTION, sid if sid.startswith("student:") else student_id(sid), "Student")
    services.aws.log_event("Encryption", "Decrypt PII", "SUCCESS",
                           f"{user.name} opened the encrypted profile of {doc['name']} ({doc.get('regNo', '')})")
    return decrypt_record(doc, services.cipher)


@router.get("/{sid}/stored")
def stored_record(sid: str, services: Services = Depends(get_services),
                  _: SessionUser = Depends(require_roles("CampusAdmin"))) -> dict:
    """The record exactly as it sits in the database, to show that personal fields are ciphertext."""
    doc = get_or_404(services.store, COLLECTION, sid if sid.startswith("student:") else student_id(sid), "Student")
    return stored_view(doc)
