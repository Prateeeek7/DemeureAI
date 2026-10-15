"""Hostel operations: leaves, visitors, gate ledger, welfare, surveys, rooms."""
import re
import secrets
import threading
from datetime import date, datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from deps import STAFF_ROLES, Services, current_user, get_or_404, get_services, new_id, require_roles
from services import emails
from services.auth import SessionUser
from services.domain import GENESIS_HASH, ledger_hash, rank_roommates, verify_ledger

router = APIRouter(tags=["hostel"])
warden = require_roles("HostelAdmin")
FILE_URL = re.compile(r"^/api/files/[A-Za-z0-9._-]+$")


# --- Leaves ------------------------------------------------------------------
class LeaveRequest(BaseModel):
    startDate: date
    endDate: date
    reason: str = Field(min_length=3, max_length=500)
    proofUrl: Optional[str] = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def check_dates(self):
        if self.endDate < self.startDate:
            raise ValueError("End date cannot be before start date")
        if self.startDate < date.today() - timedelta(days=1):
            raise ValueError("Start date cannot be in the past")
        if (self.endDate - self.startDate).days > 90:
            raise ValueError("Leave cannot exceed 90 days")
        if self.proofUrl and not FILE_URL.match(self.proofUrl):
            raise ValueError("Attachment must be uploaded through Demeure")
        return self


@router.get("/api/leaves")
def list_leaves(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    leaves = services.store.list("leaves")
    if user.role in STAFF_ROLES:
        return leaves
    if user.role == "Student":
        return [l for l in leaves if l.get("studentId") == user.id]
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot view leave requests")


@router.post("/api/leaves/submit")
def submit_leave(req: LeaveRequest, services: Services = Depends(get_services),
                 user: SessionUser = Depends(require_roles("Student"))) -> dict:
    if req.proofUrl:
        meta = services.store.get("files", req.proofUrl.rsplit("/", 1)[-1])
        if not meta or meta["ownerId"] != user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Attachment not found")

    parent_email = services.auth.parent_email_for(user)
    fmt = "%d %b %Y"
    leave = services.store.put("leaves", {
        "id": new_id("L"),
        "studentId": user.id,
        "studentEmail": user.email,
        "name": user.name,
        "room": user.room,
        "startDate": req.startDate.isoformat(),
        "endDate": req.endDate.isoformat(),
        "duration": f"{req.startDate.strftime(fmt)} to {req.endDate.strftime(fmt)}",
        "reason": req.reason.strip(),
        "consent": "Parent Notified (Email)" if parent_email else "Pending Parent Auth",
        "status": "Pending",
        "proofUrl": req.proofUrl,
    })
    if parent_email:
        services.aws.send_notification_email(
            parent_email, f"Demeure AI: Leave Request Notification for {user.name}",
            emails.leave_submitted(leave, req.proofUrl or ""),
        )
    return leave


def _resolve_leave(leave_id: str, approved: bool, services: Services) -> dict:
    leave = get_or_404(services.store, "leaves", leave_id, "Leave")
    if leave["status"] != "Pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Leave is already {leave['status']}")
    leave["status"] = "Approved" if approved else "Denied"
    services.store.put("leaves", leave)
    services.aws.send_notification_email(
        leave.get("studentEmail", ""),
        f"Demeure AI: Leave Request {'APPROVED' if approved else 'DENIED'}",
        emails.leave_resolved(leave, approved),
    )
    return leave


@router.post("/api/leaves/{leave_id}/approve")
def approve_leave(leave_id: str, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    return _resolve_leave(leave_id, True, services)


@router.post("/api/leaves/{leave_id}/deny")
def deny_leave(leave_id: str, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    return _resolve_leave(leave_id, False, services)


# --- Visitors ------------------------------------------------------------------
class VisitorRequest(BaseModel):
    visitor: str = Field(min_length=2, max_length=80)
    visitAt: datetime
    purpose: str = Field(min_length=2, max_length=120)


@router.get("/api/visitors")
def list_visitors(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    visitors = services.store.list("visitors")
    if user.role == "HostelAdmin":
        return visitors
    if user.role == "Student":
        return [v for v in visitors if v.get("hostId") == user.id]
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot view visitor requests")


@router.post("/api/visitors")
def request_visitor(req: VisitorRequest, services: Services = Depends(get_services),
                    user: SessionUser = Depends(require_roles("Student"))) -> dict:
    if req.visitAt.replace(tzinfo=None) < datetime.now() - timedelta(hours=1):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Visit time cannot be in the past")
    return services.store.put("visitors", {
        "id": new_id("V"),
        "visitor": req.visitor.strip(),
        "host": f"{user.name} ({user.room})",
        "hostId": user.id,
        "hostEmail": user.email,
        "date": req.visitAt.strftime("%d %b %Y, %H:%M"),
        "purpose": req.purpose.strip(),
        "status": "Pending",
    })


def _resolve_visitor(visitor_id: str, approved: bool, services: Services) -> dict:
    visitor = get_or_404(services.store, "visitors", visitor_id, "Visitor")
    if visitor["status"] != "Pending":
        raise HTTPException(status.HTTP_409_CONFLICT, f"Visitor request is already {visitor['status']}")
    visitor["status"] = "Approved" if approved else "Denied"
    if approved:
        visitor["passCode"] = f"GP-{secrets.token_hex(3).upper()}"
    services.store.put("visitors", visitor)
    services.aws.send_notification_email(
        visitor.get("hostEmail", ""), f"Demeure AI: Visitor Pass {visitor['status'].upper()}",
        emails.visitor_resolved(visitor),
    )
    return visitor


@router.post("/api/visitors/{visitor_id}/approve")
def approve_visitor(visitor_id: str, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    return _resolve_visitor(visitor_id, True, services)


@router.post("/api/visitors/{visitor_id}/deny")
def deny_visitor(visitor_id: str, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    return _resolve_visitor(visitor_id, False, services)


# --- Gate ledger (SHA-256 hash chain) -----------------------------------------
_ledger_lock = threading.Lock()


class GateEvent(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    type: Literal["Resident", "Visitor", "Staff"]
    roomOrPurpose: str = Field(min_length=1, max_length=120)
    status: Literal["GRANTED", "DENIED", "REVOKED"]


def _ledger(services: Services) -> list[dict]:
    return sorted(services.store.list("gate_ledger"), key=lambda e: e.get("seq", 0))


@router.get("/api/gate/ledger")
def gate_ledger(services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    entries = _ledger(services)
    return {"verified": verify_ledger(entries), "entries": entries[::-1]}


@router.post("/api/gate/events")
def gate_event(event: GateEvent, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    with _ledger_lock:
        entries = _ledger(services)
        prev = entries[-1]["hash"] if entries else GENESIS_HASH
        seq = (entries[-1]["seq"] + 1) if entries else 1
        entry = {**event.model_dump(), "id": f"G-{seq:06d}", "seq": seq,
                 "time": datetime.now().strftime("%H:%M:%S"), "prevHash": prev}
        entry["hash"] = ledger_hash(prev, entry)
        return services.store.put("gate_ledger", entry)


# --- Welfare alerts -------------------------------------------------------------
class WelfareResolution(BaseModel):
    status: Literal["Checked", "False Positive"]


@router.get("/api/welfare/alerts")
def welfare_alerts(services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> list[dict]:
    return services.store.list("welfare_alerts")


@router.post("/api/welfare/alerts/{alert_id}/resolve")
def resolve_welfare(alert_id: str, body: WelfareResolution, services: Services = Depends(get_services),
                    _: SessionUser = Depends(warden)) -> dict:
    alert = get_or_404(services.store, "welfare_alerts", alert_id, "Alert")
    alert["status"] = body.status
    return services.store.put("welfare_alerts", alert)


# --- Room preference survey -----------------------------------------------------
def _field(max_length: int = 80, required: bool = True):
    return Field(min_length=1 if required else 0, max_length=max_length, default=... if required else "")


class SurveyBody(BaseModel):
    fullName: str = _field()
    rollNumber: str = _field(30)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    gender: str = _field(30)
    course: str = _field(30)
    branch: str = _field(40)
    yearOfStudy: str = _field(20)
    preferredBlock: str = _field(5)
    preferredFloor: str = _field(5)
    roomTypePref: str = _field(20)
    sleepHabit: str = _field(40)
    studyEnv: str = _field(40)
    cleanliness: str = _field(40)
    socialPref: str = _field(40)
    dietaryPref: str = _field(40)
    specialNeeds: str = _field(300, required=False)


@router.get("/api/surveys")
def list_surveys(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    surveys = services.store.list("surveys")
    if user.role == "HostelAdmin":
        return surveys
    if user.role == "Student":
        return [s for s in surveys if s.get("ownerId") == user.id]
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot view surveys")


@router.put("/api/surveys/me")
def upsert_survey(body: SurveyBody, services: Services = Depends(get_services),
                  user: SessionUser = Depends(require_roles("Student"))) -> dict:
    existing = next((s for s in services.store.list("surveys") if s.get("ownerId") == user.id), None)
    doc = {
        **(existing or {}),
        **body.model_dump(),
        "ownerId": user.id,
        "id": existing["id"] if existing else new_id("SRV"),
        "studentId": existing["studentId"] if existing else f"STU-{secrets.token_hex(2).upper()}",
        "submittedAt": existing["submittedAt"] if existing else datetime.now().strftime("%d/%m/%Y, %H:%M:%S"),
    }
    if existing:
        doc["updatedAt"] = datetime.now().strftime("%d/%m/%Y, %H:%M:%S")
    return services.store.put("surveys", doc)


@router.delete("/api/surveys/{survey_id}")
def delete_survey(survey_id: str, services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    if not services.store.delete("surveys", survey_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Survey not found")
    return {"status": "deleted"}


# --- Room allocation --------------------------------------------------------------
class AllocationRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    currentOccupants: list[str] = Field(default_factory=list, max_length=8)
    maxOccupants: int = Field(ge=1, le=8)


@router.get("/api/rooms/allocations")
def allocations(services: Services = Depends(get_services), _: SessionUser = Depends(warden)) -> dict:
    return {doc["id"]: doc["occupants"] for doc in services.store.list("room_allocations")}


@router.post("/api/rooms/{room_id}/allocate")
def allocate(room_id: str, req: AllocationRequest, services: Services = Depends(get_services),
             _: SessionUser = Depends(warden)) -> dict:
    # Room ids are <block><floor><room 1-10>, e.g. "A110" = Block A, floor 1, room 10.
    if not re.fullmatch(r"[A-C][1-5](10|[1-9])", room_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown room")
    stored = services.store.get("room_allocations", room_id)
    occupants = stored["occupants"] if stored else req.currentOccupants
    if len(occupants) >= req.maxOccupants:
        raise HTTPException(status.HTTP_409_CONFLICT, "Room is already full")
    name = req.name.strip()
    if name in occupants:
        raise HTTPException(status.HTTP_409_CONFLICT, f"{name} is already in this room")
    doc = {"id": room_id, "occupants": [*occupants, name], "maxOccupants": req.maxOccupants}
    return services.store.put("room_allocations", doc)


class CompatibilityRequest(BaseModel):
    sleep: str = Field(max_length=20)
    study: str = Field(max_length=20)
    clean: str = Field(max_length=20)
    social: str = Field(max_length=20)
    block: str = Field(default="", max_length=5)


@router.post("/api/rooms/compatibility")
def compatibility(req: CompatibilityRequest, services: Services = Depends(get_services),
                  _: SessionUser = Depends(warden)) -> dict:
    surveys = services.store.list("surveys")
    return {
        "candidates": len(surveys),
        "results": rank_roommates(req.model_dump(), surveys, block=req.block),
    }
