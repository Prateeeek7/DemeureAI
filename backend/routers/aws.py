"""AWS console endpoints plus private file upload/download (S3 or local disk)."""
import os
import secrets

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from deps import STAFF_ROLES, Services, current_user, get_services, require_roles
from services import emails
from services.auth import SessionUser
from services.domain import safe_filename
from services.aws_service import POLLY_MAX_CHARS

router = APIRouter(tags=["aws"])

# Extension -> (content type, magic-byte prefix)
ALLOWED_UPLOADS = {
    ".pdf": ("application/pdf", b"%PDF"),
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n"),
    ".jpg": ("image/jpeg", b"\xff\xd8\xff"),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff"),
}


@router.get("/api/aws/status")
def aws_status(services: Services = Depends(get_services),
               _: SessionUser = Depends(require_roles("CampusAdmin"))) -> dict:
    return services.aws.get_status_summary()


class PollyRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20_000)
    voiceId: str = "Joanna"


@router.post("/api/aws/polly/synthesize")
def polly_synthesize(req: PollyRequest, services: Services = Depends(get_services),
                     _: SessionUser = Depends(current_user)) -> dict:
    # Long answers are truncated to Polly's per-request limit.
    return {"audioContent": services.aws.synthesize_speech(req.text[:POLLY_MAX_CHARS], req.voiceId)}


class EmailRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$", max_length=254)
    subject: str = Field(default="Demeure AI Security Alert", min_length=1, max_length=200)
    body: str = Field(default="This is a security check log from Demeure AI system.", max_length=5000)


@router.post("/api/aws/ses/test")
def ses_test(req: EmailRequest, services: Services = Depends(get_services),
             _: SessionUser = Depends(require_roles("CampusAdmin"))) -> dict:
    if not services.aws.send_notification_email(req.email, req.subject, emails.test_dispatch(req.body)):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "SES send failed. Check the AWS console log.")
    return {"status": "success"}


@router.post("/api/aws/s3/upload")
async def upload(file: UploadFile = File(...), services: Services = Depends(get_services),
                 user: SessionUser = Depends(current_user)) -> dict:
    filename = safe_filename(file.filename or "upload")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_UPLOADS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Only PDF, PNG and JPG files are accepted")

    max_bytes = services.settings.max_upload_mb * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE,
                            f"File exceeds the {services.settings.max_upload_mb} MB limit")
    content_type, magic = ALLOWED_UPLOADS[ext]
    if not content.startswith(magic):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "File contents do not match its extension")

    key = f"{secrets.token_hex(8)}_{filename}"
    services.aws.upload_file(content, key, content_type)
    services.store.put("files", {"id": key, "ownerId": user.id, "filename": filename, "contentType": content_type})
    return {"url": f"/api/files/{key}", "filename": filename, "key": key}


@router.get("/api/files/{key}")
def download(key: str, services: Services = Depends(get_services),
             user: SessionUser = Depends(current_user)):
    meta = services.store.get("files", key)
    if not meta:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    if meta["ownerId"] != user.id and user.role not in STAFF_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view this file")

    if services.aws.is_live:
        return RedirectResponse(services.aws.presigned_url(key), status_code=status.HTTP_302_FOUND)
    path = services.aws.local_file(key)
    if not path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found")
    return FileResponse(path, media_type=meta["contentType"], filename=meta["filename"],
                        content_disposition_type="inline")
