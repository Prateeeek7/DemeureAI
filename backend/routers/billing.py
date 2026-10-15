"""Hostel billing. Amounts are always computed server-side.

Each "Dispatch Monthly Bills" action starts a new billing cycle; a student is
paid up when a payment exists for the current cycle.
"""
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from deps import Services, current_user, get_services, require_roles
from services.auth import SessionUser
from services.store import Store

router = APIRouter(tags=["billing"])

DEFAULT_BILLING = {"id": "current", "powerRate": 8.5, "baseFee": 75000, "cycleId": "2026-S2-01"}
# Metered usage and fines per student; these would come from the meter/mess systems.
METERED_UNITS_KWH = 210
MESS_FINE_COUNT = 2
MESS_FINE_EACH = 50


def load_billing(store: Store) -> dict:
    billing = store.get("billing", "current")
    if not billing:
        billing = store.put("billing", dict(DEFAULT_BILLING))
    return billing


def _public(billing: dict) -> dict:
    return {k: billing[k] for k in ("powerRate", "baseFee", "cycleId") if k in billing}


@router.get("/api/billing")
def get_billing(services: Services = Depends(get_services), _: SessionUser = Depends(current_user)) -> dict:
    return _public(load_billing(services.store))


class BillingUpdate(BaseModel):
    powerRate: float = Field(gt=0, le=100)


@router.post("/api/billing/update")
def update_billing(update: BillingUpdate, services: Services = Depends(get_services),
                   _: SessionUser = Depends(require_roles("CampusAdmin"))) -> dict:
    billing = load_billing(services.store)
    billing["powerRate"] = round(update.powerRate, 2)
    billing["cycleId"] = f"{datetime.now(timezone.utc):%Y%m%d}-{secrets.token_hex(3).upper()}"
    billing["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return _public(services.store.put("billing", billing))


def _statement(services: Services, user: SessionUser) -> dict:
    billing = load_billing(services.store)
    electricity = round(METERED_UNITS_KWH * billing["powerRate"], 2)
    fines = MESS_FINE_COUNT * MESS_FINE_EACH
    payment = services.store.get("payments", f"{user.id}|{billing['cycleId']}")
    return {
        "cycleId": billing["cycleId"],
        "baseFee": billing["baseFee"],
        "powerRate": billing["powerRate"],
        "units": METERED_UNITS_KWH,
        "electricity": electricity,
        "messFineCount": MESS_FINE_COUNT,
        "messFines": fines,
        "total": round(billing["baseFee"] + electricity + fines, 2),
        "payment": payment,
    }


@router.get("/api/billing/statement")
def statement(services: Services = Depends(get_services),
              user: SessionUser = Depends(require_roles("Student"))) -> dict:
    return _statement(services, user)


class PaymentRequest(BaseModel):
    upiId: str = Field(pattern=r"^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$")


@router.post("/api/payments")
def pay(req: PaymentRequest, services: Services = Depends(get_services),
        user: SessionUser = Depends(require_roles("Student"))) -> dict:
    stmt = _statement(services, user)
    if stmt["payment"]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Dues for this billing cycle are already paid")
    # NOTE: no payment gateway is integrated; this records a simulated UPI collection.
    payment = services.store.put("payments", {
        "id": f"{user.id}|{stmt['cycleId']}",
        "receiptId": f"RCP-{secrets.randbelow(900000) + 100000}",
        "studentId": user.id,
        "cycleId": stmt["cycleId"],
        "amount": stmt["total"],
        "method": "UPI (simulated)",
        "upiId": req.upiId,
    })
    services.aws.log_event("Payments", "Collect", "MOCK", f"Recorded {payment['receiptId']} for {user.name}")
    return {**stmt, "payment": payment}
