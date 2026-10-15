"""AWS integrations (S3, SES, Polly, DynamoDB resource) with a local fallback.

When credentials are missing every call is simulated: uploads go to local disk,
emails and speech requests are only logged. All activity is recorded in an
in-memory ring buffer that the Admin "AWS Console Hub" polls.
"""
import base64
import logging
import os
import threading
from collections import deque
from datetime import datetime
from typing import Any, Optional

try:
    import boto3
    HAS_BOTO3 = True
except ImportError:  # pragma: no cover - boto3 is in requirements
    HAS_BOTO3 = False

logger = logging.getLogger("demeure.aws")

POLLY_MAX_CHARS = 3000
POLLY_VOICES = {"Joanna", "Matthew", "Kajal", "Aditi", "Raveena", "Amy", "Brian"}


class AWSService:
    def __init__(self, uploads_dir: str):
        self.access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        self.secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        self.region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")
        self.s3_bucket_name = os.environ.get("AWS_S3_BUCKET", "demeure-assets")
        self.ses_sender = os.environ.get("AWS_SES_SENDER", "noreply@demeureai.com")
        self.uploads_dir = uploads_dir
        os.makedirs(self.uploads_dir, exist_ok=True)

        self.logs: deque = deque(maxlen=100)
        self._log_lock = threading.Lock()

        self.is_live = False
        self.services_status = {
            "DynamoDB": "Mock Mode (Local SQLite)",
            "S3": "Mock Mode (Local Disk)",
            "SES": "Mock Mode (Simulated Logs)",
            "Polly": "Mock Mode (Browser Speech Fallback)",
        }
        self.dynamodb_resource: Any = None
        self.s3_client: Any = None
        self.ses_client: Any = None
        self.polly_client: Any = None

        if HAS_BOTO3 and self.access_key and self.secret_key:
            try:
                session = boto3.Session(
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    region_name=self.region,
                )
                self.dynamodb_resource = session.resource("dynamodb")
                self.s3_client = session.client("s3")
                self.ses_client = session.client("ses")
                self.polly_client = session.client("polly")
                self.is_live = True
                self.services_status = {
                    "DynamoDB": "Connected (AWS Live)",
                    "S3": f"Connected (Bucket: {self.s3_bucket_name})",
                    "SES": f"Connected (Sender: {self.ses_sender})",
                    "Polly": "Connected (AWS Live)",
                }
                self.log_event("SYSTEM", "Initialization", "SUCCESS", f"Connected to AWS in {self.region}")
            except Exception as e:
                self.log_event("SYSTEM", "Initialization", "ERROR", f"Failed to init AWS SDK: {e}")
        else:
            reason = "Missing credentials" if HAS_BOTO3 else "boto3 not installed"
            self.log_event("SYSTEM", "Initialization", "MOCK", f"Starting in Mock Local Mode ({reason})")

    def log_event(self, service: str, action: str, status: str, details: str) -> None:
        entry = {
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "service": service,
            "action": action,
            "status": status,
            "details": details,
        }
        with self._log_lock:
            self.logs.append(entry)
        level = logging.WARNING if status in {"FAILED", "ERROR"} else logging.INFO
        logger.log(level, "%s %s %s: %s", service, action, status, details)

    def get_status_summary(self) -> dict:
        with self._log_lock:
            logs = list(self.logs)[::-1]
        return {
            "isLive": self.is_live,
            "region": self.region,
            "s3Bucket": self.s3_bucket_name,
            "sesSender": self.ses_sender,
            "services": self.services_status,
            "logs": logs,
        }

    # --- S3 -----------------------------------------------------------------
    def upload_file(self, content: bytes, key: str, content_type: str) -> None:
        """Stores an object privately under ``key`` (S3, or local disk in mock mode)."""
        if not self.is_live:
            with open(self._local_path(key), "wb") as f:
                f.write(content)
            self.log_event("S3", "PutObject", "MOCK", f"Stored {key} on local disk")
            return
        try:
            self.s3_client.put_object(
                Bucket=self.s3_bucket_name, Key=key, Body=content, ContentType=content_type,
            )
            self.log_event("S3", "PutObject", "SUCCESS", f"Uploaded s3://{self.s3_bucket_name}/{key}")
        except Exception as e:
            self.log_event("S3", "PutObject", "FAILED", f"Upload failed: {e}")
            raise

    def presigned_url(self, key: str, expires_seconds: int = 300) -> str:
        url = self.s3_client.generate_presigned_url(
            "get_object", Params={"Bucket": self.s3_bucket_name, "Key": key}, ExpiresIn=expires_seconds,
        )
        self.log_event("S3", "GetObject (Presign)", "SUCCESS", f"Issued {expires_seconds}s link for {key}")
        return url

    def _local_path(self, key: str) -> str:
        path = os.path.realpath(os.path.join(self.uploads_dir, key))
        if not path.startswith(os.path.realpath(self.uploads_dir) + os.sep):
            raise ValueError("Invalid object key")
        return path

    def local_file(self, key: str) -> Optional[str]:
        path = self._local_path(key)
        return path if os.path.isfile(path) else None

    # --- SES ----------------------------------------------------------------
    def send_notification_email(self, recipient: str, subject: str, html_body: str) -> bool:
        if not recipient:
            self.log_event("SES", "SendEmail", "SKIPPED", f"No recipient configured for '{subject}'")
            return False
        if not self.is_live:
            self.log_event("SES", "SendEmail", "MOCK", f"Simulated email to <{recipient}>. Subject: '{subject}'")
            return True
        try:
            response = self.ses_client.send_email(
                Source=self.ses_sender,
                Destination={"ToAddresses": [recipient]},
                Message={
                    "Subject": {"Data": subject, "Charset": "UTF-8"},
                    "Body": {"Html": {"Data": html_body, "Charset": "UTF-8"}},
                },
            )
            self.log_event("SES", "SendEmail", "SUCCESS",
                           f"Email sent to <{recipient}> (ID: {response.get('MessageId', 'N/A')})")
            return True
        except Exception as e:
            self.log_event("SES", "SendEmail", "FAILED", f"Error sending to <{recipient}>: {e}")
            return False

    # --- Polly --------------------------------------------------------------
    def synthesize_speech(self, text: str, voice_id: str = "Joanna") -> str:
        """Returns base64 MP3 audio, or "" so the client falls back to browser TTS."""
        text = text[:POLLY_MAX_CHARS]
        if voice_id not in POLLY_VOICES:
            voice_id = "Joanna"
        if not self.is_live:
            self.log_event("Polly", "SynthesizeSpeech", "MOCK", f"'{text[:40]}...' - browser TTS fallback")
            return ""
        try:
            response = self.polly_client.synthesize_speech(Text=text, OutputFormat="mp3", VoiceId=voice_id)
            audio = response["AudioStream"].read()
            self.log_event("Polly", "SynthesizeSpeech", "SUCCESS", f"'{text[:40]}...' with voice {voice_id}")
            return base64.b64encode(audio).decode("ascii")
        except Exception as e:
            self.log_event("Polly", "SynthesizeSpeech", "FAILED", f"{e}. Falling back to browser TTS.")
            return ""
