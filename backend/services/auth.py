"""Credential verification and signed, expiring session tokens (stdlib only)."""
import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from dataclasses import asdict, dataclass
from typing import Optional

from config import Settings
from services.students import StudentRegistry, verify_code

ROLES = ("CampusAdmin", "HostelAdmin", "MessManager", "Student")
STAFF_NAMES = {
    "CampusAdmin": "Campus Administrator",
    "HostelAdmin": "Hostel Administrator",
    "MessManager": "Mess Manager",
}


@dataclass
class SessionUser:
    id: str
    role: str
    name: str
    email: str = ""
    room: str = ""

    def public(self) -> dict:
        return asdict(self)


def _hash_secret(secret: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", secret.encode("utf-8"), salt, 120_000)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


class AuthService:
    def __init__(self, settings: Settings, registry: Optional[StudentRegistry] = None):
        self._registry = registry
        self._key = settings.secret_key.encode("utf-8")
        self._ttl = settings.session_ttl_hours * 3600
        # Secrets are kept only as salted PBKDF2 hashes.
        self._staff: dict[str, tuple[bytes, bytes]] = {}
        for role, pin in settings.staff_pins.items():
            if pin:
                salt = secrets.token_bytes(16)
                self._staff[role] = (salt, _hash_secret(pin, salt))
        self._students: dict[str, tuple[bytes, bytes, SessionUser, str]] = {}
        for acct in settings.students:
            salt = secrets.token_bytes(16)
            user = SessionUser(
                id=f"student:{acct.email}", role="Student", name=acct.name,
                email=acct.email, room=acct.room,
            )
            self._students[acct.email] = (salt, _hash_secret(acct.code.upper(), salt), user, acct.parent_email)

        # Simple per-client brute-force throttle.
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    # --- throttling -------------------------------------------------------
    MAX_FAILURES = 10
    WINDOW_SECONDS = 300

    def is_throttled(self, client: str) -> bool:
        now = time.time()
        with self._lock:
            recent = [t for t in self._failures.get(client, []) if now - t < self.WINDOW_SECONDS]
            self._failures[client] = recent
            return len(recent) >= self.MAX_FAILURES

    def record_failure(self, client: str) -> None:
        with self._lock:
            self._failures.setdefault(client, []).append(time.time())

    def clear_failures(self, client: str) -> None:
        with self._lock:
            self._failures.pop(client, None)

    # --- credential checks -----------------------------------------------
    def authenticate(self, role: str, secret: str, email: Optional[str] = None) -> Optional[SessionUser]:
        if role == "Student":
            email = (email or "").strip().lower()
            record = self._students.get(email)
            if record:
                salt, digest, user, _ = record
                ok = hmac.compare_digest(_hash_secret(secret.strip().upper(), salt), digest)
                return SessionUser(**asdict(user)) if ok else None
            doc = self._registry.get(email) if self._registry else None
            if doc and doc.get("status", "Active") == "Active" and "credential" in doc:
                if verify_code(doc["credential"], secret):
                    return SessionUser(id=doc["id"], role="Student", name=doc["name"],
                                       email=doc["email"], room=doc.get("room", ""))
                return None
            # Burn comparable time so unknown emails are not distinguishable.
            _hash_secret(secret, b"0" * 16)
            return None

        if role not in self._staff:
            return None
        salt, digest = self._staff[role]
        pin = "".join(ch for ch in secret if ch.isdigit())
        if not hmac.compare_digest(_hash_secret(pin, salt), digest):
            return None
        return SessionUser(id=f"staff:{role}", role=role, name=STAFF_NAMES[role])

    def parent_email_for(self, user: SessionUser) -> str:
        record = self._students.get(user.email)
        if record:
            return record[3]
        return self._registry.guardian_email(user.email) if self._registry else ""

    # --- tokens ------------------------------------------------------------
    def issue_token(self, user: SessionUser) -> str:
        payload = {**user.public(), "exp": int(time.time()) + self._ttl}
        body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        sig = _b64(hmac.new(self._key, body.encode("ascii"), hashlib.sha256).digest())
        return f"{body}.{sig}"

    def verify_token(self, token: str) -> Optional[SessionUser]:
        try:
            body, sig = token.split(".", 1)
            expected = _b64(hmac.new(self._key, body.encode("ascii"), hashlib.sha256).digest())
            if not hmac.compare_digest(sig, expected):
                return None
            payload = json.loads(_unb64(body))
            if int(payload.pop("exp", 0)) < time.time():
                return None
            if payload.get("role") not in ROLES:
                return None
            return SessionUser(**payload)
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    @property
    def ttl_seconds(self) -> int:
        return self._ttl
