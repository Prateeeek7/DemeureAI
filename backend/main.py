import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from deps import Services, get_services
from routers import auth, aws, billing, campus, chat, hostel, students
from services.seed import seed_demo_data

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("demeure")


@asynccontextmanager
async def lifespan(app: FastAPI):
    services = Services(settings)
    app.state.services = services
    if settings.seed_demo_data:
        seeded = seed_demo_data(services.store, services.cipher)
        if seeded:
            logger.info("Seeded demo data: %s", ", ".join(seeded))
    if settings.rag_enabled:
        services.rag.start_background_load()
    logger.info("Demeure AI backend started (env=%s, storage=%s)", settings.env, services.store.backend)
    yield


app = FastAPI(
    title="Demeure AI Backend",
    version="1.1.0",
    lifespan=lifespan,
    # Interactive docs are useful locally but expose the full API surface in production.
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
    )

CSP = (
    "default-src 'self'; "
    "img-src 'self' data: blob:; "
    "media-src 'self' data: blob:; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers.setdefault("Content-Security-Policy", CSP)
        if settings.cookie_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    # Return the first human-readable message so the UI can show it directly.
    errors = exc.errors()
    first = errors[0] if errors else {}
    msg = str(first.get("msg", "Invalid request")).removeprefix("Value error, ")
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}" if field else msg})


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


for module in (auth, chat, aws, billing, hostel, campus, students):
    app.include_router(module.router)


@app.get("/api/health")
def health(services: Services = Depends(get_services)) -> dict:
    """Liveness/readiness probe. Always 200 while the process can serve requests."""
    return {
        "status": "ok",
        "env": settings.env,
        "storage": services.store.backend,
        "awsLive": services.aws.is_live,
        "assistant": services.rag.status,
        "llm": "groq" if os.environ.get("GROQ_API_KEY") else "gemini" if os.environ.get("GEMINI_API_KEY") else "none",
    }


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    return JSONResponse(status_code=404, content={"detail": "Not found"})


# --- Single-container deploys: serve the built React app -------------------------
if os.path.isdir(settings.frontend_dist):
    dist = settings.frontend_dist
    assets_dir = os.path.join(dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        candidate = os.path.realpath(os.path.join(dist, path))
        if path and candidate.startswith(os.path.realpath(dist) + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(dist, "index.html"), headers={"Cache-Control": "no-cache"})
