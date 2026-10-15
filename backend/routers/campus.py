"""Campus operations: facilities, maintenance, grievances, complaints, mess, power."""
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from deps import STAFF_ROLES, Services, current_user, get_or_404, get_services, new_id, require_roles
from services.auth import SessionUser
from services.domain import triage_complaint

router = APIRouter(tags=["campus"])
campus_admin = require_roles("CampusAdmin")
staff = require_roles(*STAFF_ROLES)


def _today() -> str:
    return datetime.now().strftime("%b %d, %Y")


def _set_status(services: Services, collection: str, doc_id: str, label: str, new_status: str) -> dict:
    doc = get_or_404(services.store, collection, doc_id, label)
    doc["status"] = new_status
    return services.store.put(collection, doc)


# --- Facility bookings ------------------------------------------------------------
class BookingRequest(BaseModel):
    facility: str = Field(min_length=2, max_length=120)
    type: str = Field(min_length=2, max_length=60)
    slot: str = Field(min_length=2, max_length=80)
    requestedBy: str = Field(min_length=2, max_length=80)


class BookingStatus(BaseModel):
    status: Literal["APPROVED", "REJECTED"]


@router.get("/api/facilities/bookings")
def list_bookings(services: Services = Depends(get_services), _: SessionUser = Depends(current_user)) -> list[dict]:
    return services.store.list("bookings")


@router.post("/api/facilities/book")
def book_facility(req: BookingRequest, services: Services = Depends(get_services),
                  user: SessionUser = Depends(current_user)) -> dict:
    return services.store.put("bookings", {
        **req.model_dump(), "id": new_id("BK"), "status": "PENDING", "filedBy": user.id,
    })


@router.post("/api/facilities/bookings/{booking_id}/status")
def booking_status(booking_id: str, body: BookingStatus, services: Services = Depends(get_services),
                   _: SessionUser = Depends(campus_admin)) -> dict:
    return _set_status(services, "bookings", booking_id, "Booking", body.status)


# --- Maintenance work orders -----------------------------------------------------
class TicketRequest(BaseModel):
    location: str = Field(min_length=2, max_length=120)
    issue: str = Field(min_length=3, max_length=500)
    type: str = Field(min_length=2, max_length=60)
    priority: Literal["LOW", "MEDIUM", "HIGH", "URGENT"] = "HIGH"


class TicketStatus(BaseModel):
    status: Literal["PENDING ASSIGNMENT", "IN PROGRESS", "COMPLETED"]


@router.get("/api/maintenance/tickets")
def list_tickets(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    tickets = services.store.list("maintenance")
    if user.role in STAFF_ROLES:
        return tickets
    return [t for t in tickets if t.get("filedBy") == user.id]  # residents track their own work orders


@router.post("/api/maintenance/ticket")
def create_ticket(req: TicketRequest, services: Services = Depends(get_services),
                  user: SessionUser = Depends(current_user)) -> dict:
    return services.store.put("maintenance", {
        **req.model_dump(), "id": new_id("MNT"), "status": "PENDING ASSIGNMENT",
        "date": _today(), "filedBy": user.id,
    })


@router.post("/api/maintenance/tickets/{ticket_id}/status")
def ticket_status(ticket_id: str, body: TicketStatus, services: Services = Depends(get_services),
                  _: SessionUser = Depends(campus_admin)) -> dict:
    return _set_status(services, "maintenance", ticket_id, "Ticket", body.status)


# --- Grievances (optionally anonymous) ---------------------------------------------
class GrievanceRequest(BaseModel):
    subject: str = Field(min_length=3, max_length=1000)
    category: str = Field(min_length=2, max_length=80)
    isAnonymous: bool = False


class GrievanceStatus(BaseModel):
    status: Literal["UNDER ESCALATION REVIEW", "IN INVESTIGATION", "RESOLVED"]


def _grievance_view(doc: dict, user: SessionUser) -> dict:
    view = {k: v for k, v in doc.items() if k != "filedBy"}
    view["isMine"] = doc.get("filedBy") == user.id
    if doc.get("isAnonymous"):
        view["category"] = f"{doc['category']} (ANONYMOUS)"
    return view


@router.get("/api/grievances")
def list_grievances(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    docs = services.store.list("grievances")
    if user.role not in STAFF_ROLES:
        docs = [d for d in docs if d.get("filedBy") == user.id]
    return [_grievance_view(d, user) for d in docs]


@router.post("/api/grievances/file")
def file_grievance(req: GrievanceRequest, services: Services = Depends(get_services),
                   user: SessionUser = Depends(require_roles("Student"))) -> dict:
    # The filer is kept so they can track the case, but never shown to staff when anonymous.
    doc = services.store.put("grievances", {
        **req.model_dump(), "id": new_id("GRV"), "date": _today(), "priority": "HIGH",
        "status": "UNDER ESCALATION REVIEW", "filedBy": user.id,
    })
    return _grievance_view(doc, user)


@router.post("/api/grievances/{grievance_id}/status")
def grievance_status(grievance_id: str, body: GrievanceStatus, services: Services = Depends(get_services),
                     user: SessionUser = Depends(staff)) -> dict:
    return _grievance_view(_set_status(services, "grievances", grievance_id, "Grievance", body.status), user)


# --- NLP complaint desk ----------------------------------------------------------
class ComplaintText(BaseModel):
    text: str = Field(min_length=3, max_length=1000)


class ComplaintRequest(ComplaintText):
    room: Optional[str] = Field(default=None, max_length=20)


class ComplaintStatus(BaseModel):
    status: Literal["Open", "Dispatched", "Resolved"]


@router.post("/api/complaints/classify")
def classify(req: ComplaintText, _: SessionUser = Depends(current_user)) -> dict:
    return triage_complaint(req.text)


@router.get("/api/complaints")
def list_complaints(services: Services = Depends(get_services), user: SessionUser = Depends(current_user)) -> list[dict]:
    docs = services.store.list("complaints")
    if user.role in STAFF_ROLES:
        return docs
    return [d for d in docs if d.get("filedBy") == user.id]


@router.post("/api/complaints")
def file_complaint(req: ComplaintRequest, services: Services = Depends(get_services),
                   user: SessionUser = Depends(current_user)) -> dict:
    room = user.room if user.role == "Student" else (req.room or "").strip()
    if not room:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Room is required")
    return services.store.put("complaints", {
        **triage_complaint(req.text), "id": new_id("T"), "room": room,
        "originalText": req.text.strip(), "status": "Open", "filedBy": user.id,
    })


class AssignRequest(BaseModel):
    staffId: str = Field(min_length=6, max_length=12)


@router.post("/api/complaints/{complaint_id}/assign")
def assign_complaint(complaint_id: str, body: AssignRequest, services: Services = Depends(get_services),
                     user: SessionUser = Depends(staff)) -> dict:
    """Dispatches a complaint to a named technician; an open complaint moves to Dispatched."""
    doc = get_or_404(services.store, "complaints", complaint_id, "Complaint")
    tech = services.personnel.get(body.staffId)
    if not tech or tech.get("kind") != "Staff" or tech.get("status", "Active") != "Active":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active staff member with that ID")
    if doc["status"] == "Resolved":
        raise HTTPException(status.HTTP_409_CONFLICT, "Complaint is already resolved")
    doc["assignedTo"] = {"id": tech["id"], "name": tech["name"], "designation": tech["designation"],
                         "extension": tech.get("extension", "")}
    doc["status"] = "Dispatched"
    doc["dispatchedBy"] = user.name
    services.aws.log_event("Dispatch", "Assign technician", "SUCCESS", f"{complaint_id} assigned to {tech['name']} ({tech['id']})")
    return services.store.put("complaints", doc)


@router.post("/api/complaints/{complaint_id}/status")
def complaint_status(complaint_id: str, body: ComplaintStatus, services: Services = Depends(get_services),
                     _: SessionUser = Depends(staff)) -> dict:
    return _set_status(services, "complaints", complaint_id, "Complaint", body.status)


# --- Mess menu & reviews ----------------------------------------------------------
class MenuDay(BaseModel):
    day: str = Field(min_length=1, max_length=20)
    breakfast: str = Field(max_length=200)
    lunch: str = Field(max_length=200)
    snacks: str = Field(max_length=200)
    dinner: str = Field(max_length=200)


class MenuBody(BaseModel):
    days: list[MenuDay] = Field(min_length=1, max_length=7)


class ReviewBody(BaseModel):
    rating: int = Field(ge=1, le=5)
    meal: Literal["Breakfast", "Lunch", "Snacks", "Dinner"]
    suggestion: str = Field(min_length=2, max_length=500)


@router.get("/api/mess/menu")
def get_menu(services: Services = Depends(get_services), _: SessionUser = Depends(current_user)) -> dict:
    doc = services.store.get("mess_menu", "weekly")
    return {"days": doc["days"], "updatedAt": doc.get("updatedAt")} if doc else {"days": None, "updatedAt": None}


@router.put("/api/mess/menu")
def put_menu(body: MenuBody, services: Services = Depends(get_services),
             _: SessionUser = Depends(require_roles("MessManager"))) -> dict:
    doc = {"id": "weekly", "days": [d.model_dump() for d in body.days],
           "updatedAt": datetime.now().strftime("%d %b %Y, %H:%M")}
    services.store.put("mess_menu", doc)
    return {"days": doc["days"], "updatedAt": doc["updatedAt"]}


@router.get("/api/mess/reviews")
def list_reviews(services: Services = Depends(get_services), _: SessionUser = Depends(current_user)) -> list[dict]:
    return [{k: v for k, v in r.items() if k != "studentId"} for r in services.store.list("mess_reviews")]


@router.post("/api/mess/reviews")
def add_review(body: ReviewBody, services: Services = Depends(get_services),
               user: SessionUser = Depends(require_roles("Student"))) -> dict:
    doc = services.store.put("mess_reviews", {
        **body.model_dump(), "id": new_id("MR"), "studentName": user.name, "studentId": user.id,
        "timestamp": datetime.now().strftime("%d %b, %I:%M %p"),
    })
    return {k: v for k, v in doc.items() if k != "studentId"}


# --- Power anomalies --------------------------------------------------------------
@router.get("/api/power/anomalies")
def anomalies(services: Services = Depends(get_services), _: SessionUser = Depends(campus_admin)) -> list[dict]:
    return services.store.list("power_anomalies")


@router.post("/api/power/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(anomaly_id: str, services: Services = Depends(get_services),
                    _: SessionUser = Depends(campus_admin)) -> dict:
    return _set_status(services, "power_anomalies", anomaly_id, "Anomaly", "Resolved")
