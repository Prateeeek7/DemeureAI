from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from deps import SESSION_COOKIE, Services, current_user, get_services
from services.auth import SessionUser

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    role: Literal["CampusAdmin", "HostelAdmin", "MessManager", "Faculty", "Student"]
    secret: str = Field(min_length=1, max_length=64)
    email: Optional[str] = Field(default=None, max_length=254)
    employeeId: Optional[str] = Field(default=None, max_length=12)


@router.post("/login")
def login(body: LoginRequest, request: Request, response: Response,
          services: Services = Depends(get_services)) -> dict:
    client = request.client.host if request.client else "unknown"
    if services.auth.is_throttled(client):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 5 minutes.")

    if body.role == "Faculty" and not body.employeeId:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Faculty sign in with their employee ID")
    user = services.auth.authenticate(body.role, body.secret, body.email, body.employeeId)
    if not user:
        services.auth.record_failure(client)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    services.auth.clear_failures(client)
    response.set_cookie(
        SESSION_COOKIE, services.auth.issue_token(user),
        max_age=services.auth.ttl_seconds, httponly=True, samesite="strict",
        secure=services.settings.cookie_secure, path="/",
    )
    return user.public()


@router.post("/logout")
def logout(response: Response, services: Services = Depends(get_services)) -> dict:
    response.delete_cookie(SESSION_COOKIE, path="/", samesite="strict",
                           secure=services.settings.cookie_secure, httponly=True)
    return {"status": "signed_out"}


@router.get("/session")
def session(request: Request, services: Services = Depends(get_services)) -> dict:
    """Non-failing session probe for app start-up: returns {"user": null} when signed out."""
    token = request.cookies.get(SESSION_COOKIE)
    user = services.auth.verify_token(token) if token else None
    return {"user": user.public() if user else None}


@router.get("/me")
def me(user: SessionUser = Depends(current_user)) -> dict:
    return user.public()
