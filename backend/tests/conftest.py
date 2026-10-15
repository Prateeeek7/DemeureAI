import os
import sys
import tempfile

# Configure before the app (and its settings) are imported.
os.environ.update({
    "APP_ENV": "test",
    "RAG_ENABLED": "false",
    "SEED_DEMO_DATA": "true",
    "SECRET_KEY": "test-secret-key-test-secret-key-0000",
    "DATA_ENCRYPTION_KEY": "",  # tests use the key derived from SECRET_KEY, never a local .env key
    "AWS_ACCESS_KEY_ID": "",
    "AWS_SECRET_ACCESS_KEY": "",
    "DATA_DIR": tempfile.mkdtemp(prefix="demeure-test-"),
    "STUDENT_ACCOUNTS": (
        "student@test.edu|CODE1|Test Student|RM-101|parent@test.edu;"
        "other@test.edu|CODE2|Other Student|RM-102|"
    ),
})
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

CREDENTIALS = {
    "CampusAdmin": {"role": "CampusAdmin", "secret": "0000-0000-0000"},
    "HostelAdmin": {"role": "HostelAdmin", "secret": "1111-1111-1111"},
    "MessManager": {"role": "MessManager", "secret": "2222-2222-2222"},
    "Student": {"role": "Student", "email": "student@test.edu", "secret": "code1"},
    "OtherStudent": {"role": "Student", "email": "other@test.edu", "secret": "CODE2"},
}


@pytest.fixture(scope="session")
def app():
    with TestClient(main.app) as client:  # runs lifespan once
        yield client.app


@pytest.fixture
def login(app):
    def _login(who: str) -> TestClient:
        client = TestClient(app)
        resp = client.post("/api/auth/login", json=CREDENTIALS[who])
        assert resp.status_code == 200, resp.text
        return client
    return _login


@pytest.fixture
def anon(app):
    return TestClient(app)
