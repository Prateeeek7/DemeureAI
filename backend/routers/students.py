"""Resident directory and onboarding.

Personal fields are decrypted only for authorised viewers, and every decryption of another
person's record is written to the audit log. Staff can add residents one at a time or import a
spreadsheet; each new resident gets a bed, a one-time access code (e-mailed to them and shown
once to staff) and an encrypted record.
"""
import threading
from datetime import date
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ValidationError, field_validator

from deps import STAFF_ROLES, Services, get_or_404, get_services, require_roles
from routers.billing import load_billing
from services import emails
from services.auth import SessionUser
from services.crypto import ALGORITHM
from services.rooms import BLOCK_GENDER, Hostel, block_allows, parse_room, parse_room_text, room_id, room_label
from services.students import (COLLECTION, ENCRYPTED_FIELDS, build_record, decrypt_record, directory_entry,
                               generate_access_code, hash_code, stored_view, student_id)

router = APIRouter(prefix="/api/students", tags=["students"])
staff = require_roles(*STAFF_ROLES)
_onboarding_lock = threading.Lock()  # keeps bed assignment consistent across concurrent requests
MAX_IMPORT_ROWS = 500
DEFAULT_BLOCK = {"Male": "A", "Female": "B"}
BLOOD_GROUPS = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
# Spreadsheet spellings accepted for the fixed-choice columns.
_CHOICES = {"m": "Male", "male": "Male", "f": "Female", "female": "Female", "other": "Other",
            "veg": "Vegetarian", "vegetarian": "Vegetarian", "non-veg": "Non-Vegetarian", "nonveg": "Non-Vegetarian",
            "non vegetarian": "Non-Vegetarian", "non-vegetarian": "Non-Vegetarian", "jain": "Jain", "vegan": "Vegan",
            "single": "Single", "double": "Double", "suite": "Suite"}


def _encryption_info(services: Services) -> dict:
    return {"algorithm": ALGORITHM, "keyId": services.cipher.key_id, "keySource": services.cipher.key_source,
            "encryptedFields": list(ENCRYPTED_FIELDS), "credentialHash": "PBKDF2-HMAC-SHA256, 120,000 iterations"}


def _resolve(sid: str) -> str:
    return sid if sid.startswith("student:") else student_id(sid)


# --- validation ------------------------------------------------------------------------
def _phone(value: Optional[str]) -> Optional[str]:
    if value in (None, ""):
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("must be a 10-digit Indian mobile number")
    return f"+91 {digits}"


def _choice(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    value = value.strip()
    compact = value.replace(" ", "").upper()
    if compact in ("A", "B", "C") or compact in BLOOD_GROUPS:
        return compact
    return _CHOICES.get(value.lower(), value) or None


class ResidentFields(BaseModel):
    """Editable profile fields (all optional, shared by create and update)."""
    course: Optional[str] = Field(default=None, min_length=1, max_length=30)
    branch: Optional[str] = Field(default=None, min_length=1, max_length=40)
    yearOfStudy: Optional[str] = Field(default=None, min_length=1, max_length=20)
    dietaryPref: Optional[Literal["Vegetarian", "Non-Vegetarian", "Jain", "Vegan"]] = None
    phone: Optional[str] = None
    dateOfBirth: Optional[date] = None
    bloodGroup: Optional[Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]] = None
    guardianName: Optional[str] = Field(default=None, max_length=80)
    guardianRelation: Optional[str] = Field(default=None, max_length=30)
    guardianPhone: Optional[str] = None
    guardianEmail: Optional[str] = Field(default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    homeAddress: Optional[str] = Field(default=None, max_length=300)
    medicalNotes: Optional[str] = Field(default=None, max_length=300)

    @field_validator("*", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("phone", "guardianPhone", mode="before")
    @classmethod
    def check_phone(cls, v):
        return _phone(v)

    @field_validator("dietaryPref", "bloodGroup", mode="before")
    @classmethod
    def normalise_choice(cls, v):
        return _choice(v)

    @field_validator("dateOfBirth")
    @classmethod
    def check_dob(cls, v):
        if v and not (date(1950, 1, 1) <= v <= date.today().replace(year=date.today().year - 14)):
            raise ValueError("must be a plausible date of birth (age 14 or older)")
        return v


class ResidentCreate(ResidentFields):
    regNo: str = Field(min_length=3, max_length=20, pattern=r"^[A-Za-z0-9/-]+$")
    name: str = Field(min_length=2, max_length=80, pattern=r"^[A-Za-z][A-Za-z .'-]*$")
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    gender: Literal["Male", "Female", "Other"]
    course: str = Field(min_length=1, max_length=30)
    branch: str = Field(min_length=1, max_length=40)
    yearOfStudy: str = Field(min_length=1, max_length=20)
    block: Optional[Literal["A", "B", "C"]] = None
    roomId: Optional[str] = Field(default=None, max_length=5)
    preferredFloor: int = Field(default=1, ge=1, le=5)
    roomType: Optional[Literal["Single", "Double", "Suite"]] = None

    @field_validator("gender", "block", "roomType", mode="before")
    @classmethod
    def normalise_create_choice(cls, v):
        return _choice(v)


class ResidentUpdate(ResidentFields):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80, pattern=r"^[A-Za-z][A-Za-z .'-]*$")
    status: Optional[Literal["Active", "Inactive"]] = None
    roomId: Optional[str] = Field(default=None, max_length=5)


class ImportRequest(BaseModel):
    students: list[dict[str, Any]] = Field(min_length=1, max_length=MAX_IMPORT_ROWS)
    sendEmails: bool = True


# --- helpers -----------------------------------------------------------------------------
def _hostel(services: Services) -> Hostel:
    allocations = {d["id"]: d["occupants"] for d in services.store.list("room_allocations")}
    genders = {d["name"]: d.get("gender", "") for d in services.store.list(COLLECTION)}
    return Hostel(allocations, genders)


def _save_rooms(services: Services, hostel: Hostel) -> None:
    for doc in hostel.allocation_docs(only_changed=True):
        services.store.put("room_allocations", doc)
    hostel.changed.clear()


def _onboard(body: ResidentCreate, services: Services, hostel: Hostel, taken_regnos: set[str],
             send_email: bool) -> dict:
    email = body.email.strip().lower()
    if services.store.get(COLLECTION, student_id(email)):
        raise ValueError(f"A resident with e-mail {email} already exists")
    if body.regNo.upper() in taken_regnos:
        raise ValueError(f"Registration number {body.regNo.upper()} is already in use")
    block = body.block or DEFAULT_BLOCK.get(body.gender, "C")
    fixed = None
    if body.roomId:
        fixed = parse_room_text(body.roomId)
        if not fixed:
            raise ValueError(f"Unknown room {body.roomId}")
        block = fixed[0]
    if not block_allows(block, body.gender):
        raise ValueError(f"Block {block} is reserved for {BLOCK_GENDER[block].lower()} residents")
    key = hostel.place(body.name, body.gender, block, body.preferredFloor, body.roomType or "", fixed=fixed)

    profile = body.model_dump(exclude={"block", "roomId", "preferredFloor", "roomType"}, exclude_none=True)
    profile.update(
        email=email, regNo=body.regNo.upper(), status="Active",
        studentId=f"STU-{len(services.store.list(COLLECTION)) + 1:03d}",
        block=key[0], room=room_label(*key), roomId=room_id(*key),
    )
    if body.dateOfBirth:
        profile["dateOfBirth"] = body.dateOfBirth.isoformat()
    code = generate_access_code()
    doc = services.store.put(COLLECTION, build_record(profile, code, services.cipher))
    _save_rooms(services, hostel)
    taken_regnos.add(profile["regNo"])
    emailed = send_email and services.aws.send_notification_email(
        email, "Demeure AI: Your resident access code",
        emails.access_code_issued(body.name, email, profile["room"], code))
    return {"student": directory_entry(doc, services.cipher), "accessCode": code, "emailed": bool(emailed)}


def _first_error(e: ValidationError) -> str:
    err = e.errors()[0]
    field = ".".join(str(p) for p in err.get("loc", []))
    msg = str(err.get("msg", "invalid")).removeprefix("Value error, ")
    return f"{field}: {msg}" if field else msg


# --- directory ---------------------------------------------------------------------------
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


# --- onboarding --------------------------------------------------------------------------
@router.post("")
def add_resident(body: ResidentCreate, services: Services = Depends(get_services),
                 user: SessionUser = Depends(staff)) -> dict:
    with _onboarding_lock:
        taken = {d.get("regNo", "").upper() for d in services.store.list(COLLECTION)}
        try:
            result = _onboard(body, services, _hostel(services), taken, send_email=True)
        except ValueError as e:
            raise HTTPException(status.HTTP_409_CONFLICT, str(e))
    services.aws.log_event("Encryption", "Encrypt PII", "SUCCESS",
                           f"{user.name} added resident {body.name} ({result['student']['room']})")
    return result


@router.post("/import")
def import_residents(body: ImportRequest, services: Services = Depends(get_services),
                     user: SessionUser = Depends(staff)) -> dict:
    """Validates every row; valid rows are created, invalid rows are reported and skipped."""
    results = []
    with _onboarding_lock:
        hostel = _hostel(services)
        taken = {d.get("regNo", "").upper() for d in services.store.list(COLLECTION)}
        seen_emails: set[str] = set()
        for i, row in enumerate(body.students, start=1):
            label = str(row.get("email") or row.get("name") or f"row {i}")
            try:
                parsed = ResidentCreate.model_validate(row)
                if parsed.email.lower() in seen_emails:
                    raise ValueError("Duplicate e-mail in this file")
                seen_emails.add(parsed.email.lower())
                outcome = _onboard(parsed, services, hostel, taken, send_email=body.sendEmails)
                results.append({"row": i, "status": "created", **outcome})
            except ValidationError as e:
                results.append({"row": i, "status": "error", "label": label, "error": _first_error(e)})
            except ValueError as e:
                results.append({"row": i, "status": "error", "label": label, "error": str(e)})
    created = sum(r["status"] == "created" for r in results)
    services.aws.log_event("Encryption", "Encrypt PII", "SUCCESS",
                           f"{user.name} imported {created} of {len(results)} residents")
    return {"created": created, "failed": len(results) - created, "results": results}


# --- single resident -----------------------------------------------------------------------
@router.get("/{sid}")
def profile(sid: str, services: Services = Depends(get_services), user: SessionUser = Depends(staff)) -> dict:
    doc = get_or_404(services.store, COLLECTION, _resolve(sid), "Student")
    services.aws.log_event("Encryption", "Decrypt PII", "SUCCESS",
                           f"{user.name} opened the encrypted profile of {doc['name']} ({doc.get('regNo', '')})")
    return decrypt_record(doc, services.cipher)


@router.patch("/{sid}")
def update_resident(sid: str, body: ResidentUpdate, services: Services = Depends(get_services),
                    user: SessionUser = Depends(staff)) -> dict:
    with _onboarding_lock:
        doc = get_or_404(services.store, COLLECTION, _resolve(sid), "Student")
        changes = body.model_dump(exclude_unset=True)
        old_name, new_name = doc["name"], changes.get("name") or doc["name"]
        current = parse_room(doc.get("roomId", ""))
        target = current
        if changes.get("roomId") and parse_room_text(changes["roomId"]) != current:
            target = parse_room_text(changes["roomId"])
            if not target:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown room {changes['roomId']}")
        changes.pop("roomId", None)

        hostel = None
        if target != current or new_name != old_name:
            hostel = _hostel(services)
            if current:
                hostel.remove(old_name, current)
            if target:
                try:
                    hostel.place(new_name, doc.get("gender", ""), target[0], fixed=target)
                except ValueError as e:
                    raise HTTPException(status.HTTP_409_CONFLICT, str(e))
                doc.update(block=target[0], room=room_label(*target), roomId=room_id(*target))

        for field, value in changes.items():
            if field in ENCRYPTED_FIELDS:
                if value is None:
                    doc.pop(field, None)
                else:
                    doc[field] = services.cipher.encrypt(value.isoformat() if isinstance(value, date) else str(value),
                                                         doc["id"], field)
            elif value is not None:
                doc[field] = value
        services.store.put(COLLECTION, doc)
        if hostel:
            _save_rooms(services, hostel)
    services.aws.log_event("Encryption", "Encrypt PII", "SUCCESS", f"{user.name} updated resident {doc['name']}")
    return decrypt_record(doc, services.cipher)


@router.post("/{sid}/reset-code")
def reset_code(sid: str, services: Services = Depends(get_services), user: SessionUser = Depends(staff)) -> dict:
    doc = get_or_404(services.store, COLLECTION, _resolve(sid), "Student")
    code = generate_access_code()
    doc["credential"] = hash_code(code)
    services.store.put(COLLECTION, doc)
    emailed = services.aws.send_notification_email(
        doc["email"], "Demeure AI: Your access code was reset",
        emails.access_code_issued(doc["name"], doc["email"], doc.get("room", ""), code, reset=True))
    services.aws.log_event("Auth", "Reset access code", "SUCCESS", f"{user.name} reset the code for {doc['name']}")
    return {"accessCode": code, "emailed": emailed}


@router.get("/{sid}/stored")
def stored_record(sid: str, services: Services = Depends(get_services),
                  _: SessionUser = Depends(require_roles("CampusAdmin"))) -> dict:
    """The record exactly as it sits in the database, to show that personal fields are ciphertext."""
    doc = get_or_404(services.store, COLLECTION, _resolve(sid), "Student")
    return stored_view(doc)
