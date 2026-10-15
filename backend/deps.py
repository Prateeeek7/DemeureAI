"""Service container and FastAPI dependencies shared by all routers."""
import secrets
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from config import Settings
from services.auth import AuthService, SessionUser
from services.aws_service import AWSService
from services.crypto import FieldCipher, derive_key, parse_key
from services.rag_service import RAGService
from services.store import DynamoStore, SQLiteStore, Store
from services.personnel import PersonnelRegistry
from services.students import StudentRegistry

SESSION_COOKIE = "demeure_session"
STAFF_ROLES = ("CampusAdmin", "HostelAdmin")


class Services:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.aws = AWSService(settings.uploads_dir)
        self.store: Store
        if self.aws.is_live:
            self.store = DynamoStore(self.aws.dynamodb_resource, self.aws.log_event)
        else:
            self.store = SQLiteStore(settings.db_path, self.aws.log_event)
        if settings.data_encryption_key:
            self.cipher = FieldCipher(parse_key(settings.data_encryption_key), "DATA_ENCRYPTION_KEY")
        else:
            self.cipher = FieldCipher(derive_key(settings.secret_key), "derived from SECRET_KEY (development)")
        self.students = StudentRegistry(self.store, self.cipher)
        self.personnel = PersonnelRegistry(self.store, self.cipher)
        self.auth = AuthService(settings, self.students, self.personnel)
        self.rag = RAGService(settings.rulebooks_dir)


def get_services(request: Request) -> Services:
    return request.app.state.services


def current_user(request: Request, services: Services = Depends(get_services)) -> SessionUser:
    token = request.cookies.get(SESSION_COOKIE)
    user = services.auth.verify_token(token) if token else None
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in or session expired")
    return user


def require_roles(*roles: str) -> Callable[..., SessionUser]:
    def dependency(user: SessionUser = Depends(current_user)) -> SessionUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
        return user
    return dependency


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(3).upper()}"


def get_or_404(store: Store, collection: str, doc_id: str, label: str) -> dict:
    doc = store.get(collection, doc_id)
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{label} not found")
    return doc
