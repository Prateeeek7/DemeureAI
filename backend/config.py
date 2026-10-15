"""Runtime configuration, read once from the environment (and backend/.env)."""
import logging
import os
from dataclasses import dataclass, field

from dotenv import load_dotenv

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

logger = logging.getLogger("demeure.config")

# Demo credentials match the README. They are refused when APP_ENV=production.
DEMO_STAFF_PINS = {
    "CampusAdmin": "000000000000",
    "HostelAdmin": "111111111111",
    "MessManager": "222222222222",
}
DEMO_STUDENT_ACCOUNTS = (
    "pratik2024@vit.student.ac.in|VIT2024|Pratik Kumar|A-302|;"
    "pratik2024@vitstudent.ac.in|VIT2024|Pratik Kumar|A-302|"
)
DEV_SECRET_KEY = "dev-insecure-secret-change-me"


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    return int(raw) if raw else default


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class StudentAccount:
    email: str
    code: str
    name: str
    room: str
    parent_email: str = ""


@dataclass(frozen=True)
class Settings:
    env: str
    secret_key: str
    session_ttl_hours: int
    cookie_secure: bool
    cors_origins: list[str]
    data_dir: str
    db_path: str
    uploads_dir: str
    max_upload_mb: int
    seed_demo_data: bool
    rag_enabled: bool
    rulebooks_dir: str
    frontend_dist: str
    data_encryption_key: str = ""
    staff_pins: dict[str, str] = field(default_factory=dict)
    students: list[StudentAccount] = field(default_factory=list)

    @property
    def is_production(self) -> bool:
        return self.env == "production"


def _parse_students(raw: str) -> list[StudentAccount]:
    accounts = []
    for entry in raw.split(";"):
        parts = [p.strip() for p in entry.split("|")]
        if len(parts) < 4 or not parts[0]:
            continue
        accounts.append(StudentAccount(
            email=parts[0].lower(),
            code=parts[1],
            name=parts[2],
            room=parts[3],
            parent_email=parts[4] if len(parts) > 4 else "",
        ))
    return accounts


def load_settings() -> Settings:
    env = os.environ.get("APP_ENV", "development").strip().lower()
    is_prod = env == "production"

    data_dir = os.environ.get("DATA_DIR", os.path.join(BACKEND_DIR, "data", "runtime"))
    secret_key = os.environ.get("SECRET_KEY", "").strip()

    staff_pins = {}
    for role, env_name in (("CampusAdmin", "CAMPUS_ADMIN_PIN"),
                           ("HostelAdmin", "HOSTEL_ADMIN_PIN"),
                           ("MessManager", "MESS_MANAGER_PIN")):
        pin = "".join(ch for ch in os.environ.get(env_name, "") if ch.isdigit())
        staff_pins[role] = pin or ("" if is_prod else DEMO_STAFF_PINS[role])

    students_raw = os.environ.get("STUDENT_ACCOUNTS", "").strip()
    students = _parse_students(students_raw or ("" if is_prod else DEMO_STUDENT_ACCOUNTS))

    data_key = os.environ.get("DATA_ENCRYPTION_KEY", "").strip()

    if is_prod:
        problems = []
        if not data_key:
            problems.append("DATA_ENCRYPTION_KEY must be set (32 random bytes, base64)")
        if len(secret_key) < 32:
            problems.append("SECRET_KEY must be set to at least 32 random characters")
        missing = [role for role, pin in staff_pins.items() if len(pin) != 12]
        if missing:
            problems.append(f"12-digit PINs are required for: {', '.join(missing)}")
        if any(pin == DEMO_STAFF_PINS[role] for role, pin in staff_pins.items()):
            problems.append("demo staff PINs may not be used in production")
        if problems:
            raise RuntimeError("Invalid production configuration: " + "; ".join(problems))
    elif not secret_key:
        secret_key = DEV_SECRET_KEY
        logger.warning("SECRET_KEY not set; using an insecure development key")

    return Settings(
        env=env,
        secret_key=secret_key,
        session_ttl_hours=_int("SESSION_TTL_HOURS", 12),
        cookie_secure=_bool("COOKIE_SECURE", is_prod),
        cors_origins=_list("CORS_ORIGINS", [] if is_prod else ["http://localhost:5173", "http://127.0.0.1:5173"]),
        data_dir=data_dir,
        db_path=os.path.join(data_dir, "demeure.db"),
        uploads_dir=os.path.join(data_dir, "uploads"),
        max_upload_mb=_int("MAX_UPLOAD_MB", 5),
        seed_demo_data=_bool("SEED_DEMO_DATA", not is_prod),
        rag_enabled=_bool("RAG_ENABLED", True),
        rulebooks_dir=os.path.join(BACKEND_DIR, "data", "rulebooks"),
        frontend_dist=os.environ.get("FRONTEND_DIST", os.path.join(os.path.dirname(BACKEND_DIR), "dist")),
        staff_pins=staff_pins,
        students=students,
        data_encryption_key=data_key,
    )


settings = load_settings()
