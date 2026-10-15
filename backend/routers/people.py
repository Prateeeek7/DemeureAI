"""People search and profiles across students, faculty, wardens and staff.

Who can find whom is fixed per role, and personal details are decrypted only for roles that need
them (every such view is audited):
  Student      -> faculty, wardens (official contact details only)
  Faculty      -> students (academic details; personal contacts only for their own proctees), faculty, wardens
  HostelAdmin  -> students (full record), wardens, staff
  MessManager  -> students (name, room, meal plan), staff
  CampusAdmin  -> everyone
"""
import secrets
import threading
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from deps import STAFF_ROLES, Services, current_user, get_services, require_roles
from routers.billing import load_billing
from services import emails, personnel as P
from services.students import hash_code
from services.auth import SessionUser
from services.rooms import parse_room_text
from services.students import COLLECTION as STUDENTS, decrypt_record

router = APIRouter(prefix="/api/people", tags=["people"])

SEARCH_SCOPE = {
    "Student": ("Faculty", "Warden"),
    "Faculty": ("Student", "Faculty", "Warden"),
    "HostelAdmin": ("Student", "Warden", "Staff"),
    "MessManager": ("Student", "Staff"),
    "CampusAdmin": ("Student", "Faculty", "Warden", "Staff"),
}
MAX_RESULTS = 50


def _norm(value: str) -> str:
    return "".join(ch for ch in (value or "").lower() if ch.isalnum())


def _score(query: str, ident: str, name: str, extra: str) -> Optional[int]:
    """Lower is better; None means no match. IDs match exactly or by prefix; names by word prefix."""
    if not query:
        return 5
    q, nq = query.lower().strip(), _norm(query)
    ident_n = _norm(ident)
    if nq and ident_n == nq:
        return 0
    if nq and ident_n.startswith(nq):
        return 1
    words = name.lower().replace(".", " ").split()
    if any(w.startswith(q) for w in words) or name.lower().startswith(q):
        return 2
    if q in name.lower():
        return 3
    if q in extra.lower() or (nq and nq in ident_n):
        return 4
    return None


def _student_card(doc: dict) -> dict:
    return {"ref": doc.get("regNo", ""), "kind": "Student", "name": doc["name"],
            "title": f"{doc.get('course', '')} {doc.get('branch', '')} · {doc.get('yearOfStudy', '')}",
            "detail": f"Room {doc.get('room', '—')}", "status": doc.get("status", "Active")}


def _person_card(doc: dict) -> dict:
    if doc["kind"] == "Warden":
        detail = f"Block {doc.get('block')} · Floors {doc.get('floors')}"
    elif doc["kind"] == "Faculty":
        detail = f"{doc.get('school')} · {doc.get('office', '')}"
    else:
        detail = doc.get("department", "")
    return {"ref": doc["id"], "kind": doc["kind"], "name": doc["name"], "title": doc.get("designation", ""),
            "detail": detail, "status": doc.get("status", "Active")}


def _wardens_for_student(services: Services, doc: dict) -> list[dict]:
    key = parse_room_text(doc.get("room", ""))
    wardens = [w for w in services.personnel.all() if w.get("kind") == "Warden"]
    return [{"id": w["id"], "name": w["name"], "designation": w["designation"], "dutyPhone": w.get("dutyPhone", ""),
             "office": w.get("office", ""), "email": w.get("email", "")}
            for w in P.wardens_for(wardens, doc.get("block", ""), key[1] if key else None)]


def _proctor_summary(services: Services, proctor_id: Optional[str]) -> Optional[dict]:
    doc = services.personnel.get(proctor_id) if proctor_id else None
    if not doc:
        return None
    return {k: doc.get(k) for k in ("id", "name", "designation", "department", "email", "office", "officeHours", "extension")}


def _find_student(services: Services, ref: str) -> Optional[dict]:
    target = _norm(ref)
    return next((d for d in services.store.list(STUDENTS) if _norm(d.get("regNo", "")) == target), None)


# --- search ---------------------------------------------------------------------------------
@router.get("/search")
def search(q: str = Query("", max_length=60), kind: str = Query("", max_length=10),
           services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> dict:
    allowed = SEARCH_SCOPE.get(user.role, ())
    if kind and kind not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role cannot search {kind.lower()} records")
    kinds = (kind,) if kind else allowed
    scored = []
    if "Student" in kinds:
        for d in services.store.list(STUDENTS):
            if d.get("status", "Active") != "Active" and user.role not in STAFF_ROLES:
                continue
            s = _score(q, d.get("regNo", ""), d["name"], f"{d.get('email', '')} {d.get('room', '')} {d.get('branch', '')}")
            if s is not None:
                scored.append((s, d["name"], _student_card(d)))
    for d in services.personnel.all():
        if d.get("kind") not in kinds or (d.get("status", "Active") != "Active" and user.role != "CampusAdmin"):
            continue
        s = _score(q, d["id"], d["name"], f"{d.get('email', '')} {d.get('department', '')} {d.get('designation', '')} {d.get('school', '')}")
        if s is not None:
            scored.append((s, d["name"], _person_card(d)))
    scored.sort(key=lambda t: (t[0], t[1]))
    return {"results": [c for _, _, c in scored[:MAX_RESULTS]], "total": len(scored), "scope": list(allowed)}


# --- the signed-in user's own context -------------------------------------------------------------
@router.get("/me")
def my_record(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> dict:
    doc = services.personnel.get(user.ref) if user.ref and user.role != "Student" else None
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staff record is linked to this sign-in")
    return P.decrypt_view(doc, services.cipher)


@router.get("/my-contacts")
def my_contacts(services: Services = Depends(get_services), user: SessionUser = Depends(require_roles("Student"))) -> dict:
    doc = services.store.get(STUDENTS, user.id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No resident record is linked to this account")
    return {"proctor": _proctor_summary(services, doc.get("proctorId")), "wardens": _wardens_for_student(services, doc)}


@router.get("/proctees")
def proctees(services: Services = Depends(get_services), user: SessionUser = Depends(require_roles("Faculty"))) -> list[dict]:
    cycle = load_billing(services.store)["cycleId"]
    paid = {p["studentId"] for p in services.store.list("payments") if p.get("cycleId") == cycle}
    mine = [d for d in services.store.list(STUDENTS) if d.get("proctorId") == user.ref]
    return sorted(({**_student_card(d), "email": d["email"], "duesPaid": d["id"] in paid} for d in mine),
                  key=lambda c: c["name"])


@router.get("/technicians")
def technician_options(category: str = Query("General", max_length=20), services: Services = Depends(get_services),
                       _: SessionUser = Depends(require_roles(*STAFF_ROLES))) -> list[dict]:
    return [{"id": t["id"], "name": t["name"], "designation": t["designation"], "shift": t.get("shift", ""),
             "extension": t.get("extension", "")} for t in P.technicians(services.personnel.all(), category)]


# --- staff onboarding (campus admin) --------------------------------------------------------------
_id_lock = threading.Lock()
PREFIX = {"Faculty": ("FAC", 4, 1001), "Warden": ("WDN", 3, 101), "Staff": ("STF", 4, 2001)}
admin = require_roles("CampusAdmin")


class PersonCreate(BaseModel):
    kind: Literal["Faculty", "Warden", "Staff"]
    name: str = Field(min_length=3, max_length=80, pattern=r"^[A-Za-z][A-Za-z .'-]*$")
    gender: Literal["Male", "Female", "Other"]
    designation: str = Field(min_length=2, max_length=60)
    department: str = Field(min_length=2, max_length=60)
    email: str = Field(max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    school: Optional[str] = Field(default=None, max_length=20)
    office: Optional[str] = Field(default=None, max_length=80)
    extension: Optional[str] = Field(default=None, max_length=8, pattern=r"^\d*$")
    officeHours: Optional[str] = Field(default=None, max_length=60)
    courses: list[str] = Field(default_factory=list, max_length=6)
    block: Optional[Literal["A", "B", "C"]] = None
    floors: Optional[str] = Field(default=None, max_length=10)
    shift: Optional[str] = Field(default=None, max_length=20)
    dutyPhone: Optional[str] = Field(default=None, max_length=20)
    portalRole: Optional[Literal["CampusAdmin", "MessManager"]] = None  # staff only; faculty and wardens always have portal access
    phone: Optional[str] = Field(default=None, max_length=20)
    dateOfBirth: Optional[str] = Field(default=None, max_length=10, pattern=r"^$|^\d{4}-\d{2}-\d{2}$")
    homeAddress: Optional[str] = Field(default=None, max_length=200)
    emergencyContact: Optional[str] = Field(default=None, max_length=100)


class PersonUpdate(BaseModel):
    status: Literal["Active", "Inactive"]


def _next_id(services: Services, kind: str) -> str:
    prefix, width, start = PREFIX[kind]
    used = [int(p["id"][len(prefix):]) for p in services.personnel.all() if p["id"].startswith(prefix)]
    return f"{prefix}{max(used + [start - 1]) + 1:0{width}d}"


def _new_pin() -> str:
    return f"{secrets.randbelow(900000) + 100000}"


@router.post("")
def add_person(body: PersonCreate, services: Services = Depends(get_services), user: SessionUser = Depends(admin)) -> dict:
    if body.kind == "Warden" and not body.block:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "block: a warden must be assigned to a block")
    email = body.email.strip().lower()
    with _id_lock:
        if any(p.get("email") == email for p in services.personnel.all()):
            raise HTTPException(status.HTTP_409_CONFLICT, f"{email} is already registered")
        profile = {k: v for k, v in body.model_dump().items() if v not in (None, "", [])}
        profile["email"] = email
        profile["id"] = _next_id(services, body.kind)
        profile["portalRole"] = {"Faculty": "Faculty", "Warden": "HostelAdmin"}.get(body.kind, body.portalRole)
        pin = _new_pin() if profile.get("portalRole") else None
        doc = services.store.put(P.COLLECTION, P.build_record(profile, pin, services.cipher))
    emailed = bool(pin) and services.aws.send_notification_email(
        email, "Demeure AI: Your staff sign-in", emails.staff_pin_issued(doc["name"], doc["id"], pin))
    services.aws.log_event("Encryption", "Encrypt PII", "SUCCESS", f"{user.name} registered {doc['kind'].lower()} {doc['name']} ({doc['id']})")
    return {"person": P.public_view(doc), "pin": pin, "emailed": emailed}


@router.patch("/{ref}")
def update_person(ref: str, body: PersonUpdate, services: Services = Depends(get_services), user: SessionUser = Depends(admin)) -> dict:
    doc = services.personnel.get(ref)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staff member with that ID")
    doc["status"] = body.status
    services.store.put(P.COLLECTION, doc)
    services.aws.log_event("Auth", "Staff status", "SUCCESS", f"{user.name} set {doc['id']} to {body.status}")
    return P.public_view(doc)


@router.post("/{ref}/reset-pin")
def reset_pin(ref: str, services: Services = Depends(get_services), user: SessionUser = Depends(admin)) -> dict:
    doc = services.personnel.get(ref)
    if not doc or not doc.get("portalRole"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No staff member with portal access has that ID")
    pin = _new_pin()
    doc["credential"] = hash_code(pin)
    services.store.put(P.COLLECTION, doc)
    emailed = services.aws.send_notification_email(doc.get("email", ""), "Demeure AI: Your PIN was reset",
                                                   emails.staff_pin_issued(doc["name"], doc["id"], pin, reset=True))
    services.aws.log_event("Auth", "Reset staff PIN", "SUCCESS", f"{user.name} reset the PIN for {doc['id']}")
    return {"pin": pin, "emailed": emailed}


# --- profiles ---------------------------------------------------------------------------------
@router.get("/{ref}")
def profile(ref: str, services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> dict:
    allowed = SEARCH_SCOPE.get(user.role, ())
    person = services.personnel.get(ref)
    if person:
        if person["kind"] not in allowed and user.ref != person["id"]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view this record")
        if user.role == "CampusAdmin" or user.ref == person["id"]:
            view = P.decrypt_view(person, services.cipher)
            if user.ref != person["id"]:
                services.aws.log_event("Encryption", "Decrypt PII", "SUCCESS", f"{user.name} opened the staff record of {person['name']} ({person['id']})")
        else:
            view = P.public_view(person)
        if user.role == "Student":
            view.pop("portalRole", None)
        all_students = services.store.list(STUDENTS)
        if person["kind"] == "Faculty":
            view["proctees"] = sum(1 for s in all_students if s.get("proctorId") == person["id"])
        if person["kind"] == "Warden":
            view["residents"] = sum(1 for s in all_students if s.get("block") == person.get("block") and s.get("status", "Active") == "Active")
        return view

    student = _find_student(services, ref)
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No one with that ID")
    if "Student" not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view student records")
    full = decrypt_record(student, services.cipher)
    if user.role in STAFF_ROLES:
        view = full
        services.aws.log_event("Encryption", "Decrypt PII", "SUCCESS", f"{user.name} opened the encrypted profile of {student['name']} ({student.get('regNo', '')})")
    elif user.role == "Faculty":
        keys = ("id", "regNo", "name", "email", "gender", "course", "branch", "yearOfStudy", "block", "room", "status", "proctorId")
        view = {k: full.get(k) for k in keys if k in full}
        if student.get("proctorId") == user.ref:  # a proctor may contact their proctee and the guardian
            view.update({k: full.get(k) for k in ("phone", "guardianName", "guardianRelation", "guardianPhone")})
            services.aws.log_event("Encryption", "Decrypt PII", "SUCCESS", f"Proctor {user.name} opened the contacts of {student['name']}")
    else:  # mess manager
        view = {k: full.get(k) for k in ("regNo", "name", "block", "room", "dietaryPref", "status")}
    view["kind"] = "Student"
    view["proctor"] = _proctor_summary(services, student.get("proctorId"))
    view["wardens"] = _wardens_for_student(services, student)
    return view
