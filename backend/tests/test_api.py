import base64
import json
from datetime import date, datetime, timedelta

import pytest

from services.domain import compatibility_score, triage_complaint, verify_ledger

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32


# --- auth ---------------------------------------------------------------------
def test_health_is_public(anon):
    body = anon.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["storage"] == "sqlite"


@pytest.mark.parametrize("path", ["/api/leaves", "/api/billing", "/api/aws/status", "/api/surveys"])
def test_protected_endpoints_require_login(anon, path):
    assert anon.get(path).status_code == 401


def test_login_rejects_bad_credentials(anon):
    assert anon.post("/api/auth/login", json={"role": "CampusAdmin", "secret": "123412341234"}).status_code == 401
    assert anon.post("/api/auth/login", json={"role": "Student", "email": "nobody@test.edu",
                                              "secret": "CODE1"}).status_code == 401


def test_me_and_logout(login):
    client = login("Student")
    me = client.get("/api/auth/me").json()
    assert me == {"id": "student:student@test.edu", "role": "Student", "name": "Test Student",
                  "email": "student@test.edu", "room": "RM-101"}
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_forged_role_is_rejected(login):
    client = login("Student")
    body, sig = client.cookies.get("demeure_session").split(".")
    payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
    payload["role"] = "CampusAdmin"
    forged = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    client.cookies.clear()
    client.cookies.set("demeure_session", f"{forged}.{sig}")
    assert client.get("/api/aws/status").status_code == 401


def test_role_guards(login):
    student = login("Student")
    assert student.get("/api/aws/status").status_code == 403
    assert student.post("/api/billing/update", json={"powerRate": 1}).status_code == 403
    assert student.post("/api/leaves/L-101/approve").status_code == 403
    assert login("MessManager").get("/api/leaves").status_code == 403


# --- leaves & files -------------------------------------------------------------
def _leave_body(**overrides):
    start = date.today() + timedelta(days=2)
    body = {"startDate": start.isoformat(), "endDate": (start + timedelta(days=3)).isoformat(),
            "reason": "Family function"}
    body.update(overrides)
    return body


def test_leave_flow_with_attachment(login):
    student = login("Student")
    up = student.post("/api/aws/s3/upload", files={"file": ("ticket.png", PNG, "image/png")})
    assert up.status_code == 200, up.text
    url = up.json()["url"]

    leave = student.post("/api/leaves/submit", json=_leave_body(proofUrl=url)).json()
    assert leave["name"] == "Test Student" and leave["room"] == "RM-101"
    assert leave["consent"] == "Parent Notified (Email)"

    # Students only see their own leaves; the warden sees all and can open the file.
    assert [l["id"] for l in student.get("/api/leaves").json()] == [leave["id"]]
    warden = login("HostelAdmin")
    assert leave["id"] in {l["id"] for l in warden.get("/api/leaves").json()}
    assert warden.get(url).content == PNG
    assert login("OtherStudent").get(url).status_code == 403

    assert warden.post(f"/api/leaves/{leave['id']}/approve").json()["status"] == "Approved"
    assert warden.post(f"/api/leaves/{leave['id']}/deny").status_code == 409


def test_leave_validation(login):
    student = login("Student")
    bad_order = _leave_body(endDate=(date.today()).isoformat(), startDate=(date.today() + timedelta(days=5)).isoformat())
    assert student.post("/api/leaves/submit", json=bad_order).status_code == 422
    assert student.post("/api/leaves/submit", json=_leave_body(proofUrl="https://evil.example/x")).status_code == 422
    # Someone else's upload cannot be attached.
    other_url = login("OtherStudent").post(
        "/api/aws/s3/upload", files={"file": ("a.png", PNG, "image/png")}).json()["url"]
    assert student.post("/api/leaves/submit", json=_leave_body(proofUrl=other_url)).status_code == 400


def test_upload_rejects_wrong_type_and_spoofed_content(login):
    student = login("Student")
    assert student.post("/api/aws/s3/upload", files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 415
    assert student.post("/api/aws/s3/upload", files={"file": ("x.pdf", b"not a pdf", "application/pdf")}).status_code == 415


def test_upload_size_limit(login):
    big = b"%PDF" + b"0" * (5 * 1024 * 1024)
    assert login("Student").post("/api/aws/s3/upload",
                                 files={"file": ("big.pdf", big, "application/pdf")}).status_code == 413


# --- visitors ---------------------------------------------------------------------
def test_visitor_pass_flow(login):
    student = login("Student")
    visit_at = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    v = student.post("/api/visitors", json={"visitor": "Asha Rao", "visitAt": visit_at, "purpose": "Parent visit"}).json()
    assert v["status"] == "Pending" and v["host"] == "Test Student (RM-101)"
    assert all(x["hostId"] == "student:student@test.edu" for x in student.get("/api/visitors").json())

    approved = login("HostelAdmin").post(f"/api/visitors/{v['id']}/approve").json()
    assert approved["passCode"].startswith("GP-")


# --- billing & payments -------------------------------------------------------------
def test_billing_cycle_and_payment(login):
    admin, student = login("CampusAdmin"), login("Student")
    admin.post("/api/billing/update", json={"powerRate": 10})
    stmt = student.get("/api/billing/statement").json()
    assert stmt["electricity"] == 2100 and stmt["payment"] is None
    assert stmt["total"] == stmt["baseFee"] + 2100 + stmt["messFines"]

    paid = student.post("/api/payments", json={"upiId": "test@okaxis"}).json()
    assert paid["payment"]["amount"] == stmt["total"]
    assert student.post("/api/payments", json={"upiId": "test@okaxis"}).status_code == 409

    # A new dispatch opens a new cycle, so dues are owed again.
    admin.post("/api/billing/update", json={"powerRate": 9})
    assert student.get("/api/billing/statement").json()["payment"] is None
    assert admin.post("/api/billing/update", json={"powerRate": -1}).status_code == 422


# --- surveys & rooms -------------------------------------------------------------------
SURVEY = {
    "fullName": "Test Student", "rollNumber": "24BCE0001", "email": "student@test.edu", "gender": "Male",
    "course": "B.Tech", "branch": "CSE", "yearOfStudy": "Year 2", "preferredBlock": "A",
    "preferredFloor": "1", "roomTypePref": "Double", "sleepHabit": "Night Owl",
    "studyEnv": "Absolute Silence", "cleanliness": "Strict / Scheduled", "socialPref": "Quiet Sanctuary",
    "dietaryPref": "Vegetarian", "specialNeeds": "",
}


def test_survey_upsert_and_warden_view(login):
    student = login("Student")
    first = student.put("/api/surveys/me", json=SURVEY).json()
    second = student.put("/api/surveys/me", json={**SURVEY, "branch": "IT"}).json()
    assert first["id"] == second["id"] and second["branch"] == "IT"
    assert len(student.get("/api/surveys").json()) == 1
    assert second["id"] in {s["id"] for s in login("HostelAdmin").get("/api/surveys").json()}


def test_compatibility_ranks_best_match_first(login):
    results = login("HostelAdmin").post("/api/rooms/compatibility", json={
        "sleep": "night", "study": "silent", "clean": "strict", "social": "quiet", "block": "A"}).json()["results"]
    assert results[0]["score"] == 100
    assert results == sorted(results, key=lambda r: r["score"], reverse=True)


def test_gendered_blocks_only_rank_residents_of_that_block(login):
    warden = login("HostelAdmin")
    for block in ("A", "B"):
        body = {"sleep": "night", "study": "silent", "clean": "strict", "social": "quiet", "block": block}
        results = warden.post("/api/rooms/compatibility", json=body).json()["results"]
        assert results and all(r["room"].startswith(f"Pref {block}-") or r["room"].startswith(block) for r in results)


def test_room_allocation_capacity(login):
    warden = login("HostelAdmin")
    taken = warden.get("/api/rooms/allocations").json()
    room = next(f"C{floor}{n}" for floor in range(5, 0, -1) for n in (2, 6, 9) if f"C{floor}{n}" not in taken)  # singles
    ok = warden.post(f"/api/rooms/{room}/allocate", json={"name": "New Resident", "currentOccupants": [], "maxOccupants": 1})
    assert ok.status_code == 200
    assert warden.post(f"/api/rooms/{room}/allocate", json={"name": "Second", "maxOccupants": 1}).status_code == 409
    assert warden.get("/api/rooms/allocations").json()[room] == ["New Resident"]


# --- campus ---------------------------------------------------------------------------
def test_anonymous_grievance_hides_filer(login):
    student = login("Student")
    g = student.post("/api/grievances/file", json={"subject": "Ragging in block C", "category": "Anti-Ragging",
                                                   "isAnonymous": True}).json()
    staff_view = next(x for x in login("HostelAdmin").get("/api/grievances").json() if x["id"] == g["id"])
    assert "filedBy" not in staff_view and staff_view["isMine"] is False
    assert staff_view["category"].endswith("(ANONYMOUS)")
    assert all(x["isMine"] for x in student.get("/api/grievances").json())


def test_complaint_triage_and_status(login):
    student = login("Student")
    c = student.post("/api/complaints", json={"text": "Sparks from the socket near my bed"}).json()
    assert c["priority"] == "CRITICAL (IMMEDIATE)" and c["room"] == "RM-101"
    assert login("HostelAdmin").post(f"/api/complaints/{c['id']}/status", json={"status": "Resolved"}).status_code == 200
    assert student.post(f"/api/complaints/{c['id']}/status", json={"status": "Resolved"}).status_code == 403


def test_bookings_and_tickets_use_server_ids(login):
    student, admin = login("Student"), login("CampusAdmin")
    b = student.post("/api/facilities/book", json={"facility": "Court 1", "type": "Sports", "slot": "Oct 9",
                                                  "requestedBy": "Badminton Club"}).json()
    assert b["id"] in {x["id"] for x in student.get("/api/facilities/bookings").json()}
    assert admin.post(f"/api/facilities/bookings/{b['id']}/status", json={"status": "APPROVED"}).json()["status"] == "APPROVED"

    t = student.post("/api/maintenance/ticket", json={"location": "A-101", "issue": "Fan broken", "type": "Electrical"}).json()
    assert admin.post(f"/api/maintenance/tickets/{t['id']}/status", json={"status": "COMPLETED"}).status_code == 200


def test_mess_menu_and_reviews(login):
    manager, student = login("MessManager"), login("Student")
    menu = {"days": [{"day": "Monday", "breakfast": "Idli", "lunch": "Rice", "snacks": "Tea", "dinner": "Roti"}]}
    assert manager.put("/api/mess/menu", json=menu).status_code == 200
    assert student.get("/api/mess/menu").json()["days"][0]["breakfast"] == "Idli"
    assert student.put("/api/mess/menu", json=menu).status_code == 403

    r = student.post("/api/mess/reviews", json={"rating": 4, "meal": "Lunch", "suggestion": "More salad"}).json()
    assert r["studentName"] == "Test Student" and "studentId" not in r


def test_gate_ledger_chain(login):
    warden = login("HostelAdmin")
    warden.post("/api/gate/events", json={"name": "Aarav Mehta", "type": "Resident", "roomOrPurpose": "RM-101",
                                          "status": "GRANTED"})
    ledger = warden.get("/api/gate/ledger").json()
    assert ledger["verified"] is True
    entries = ledger["entries"][::-1]
    entries[1] = {**entries[1], "name": "Tampered"}
    assert verify_ledger(entries) is False


def test_chat_unavailable_when_rag_disabled(login):
    assert login("Student").post("/api/chat/query", json={"query": "curfew?"}).status_code == 503


def test_unknown_api_route_is_json_404(anon):
    resp = anon.get("/api/does-not-exist")
    assert resp.status_code == 404 and resp.json() == {"detail": "Not found"}


# --- pure domain rules -----------------------------------------------------------------
def test_triage_rules():
    assert triage_complaint("wifi keeps dropping")["category"] == "IT / WiFi"
    assert triage_complaint("hello")["priority"] == "LOW"
    assert triage_complaint("Bathroom tap leaking, water pooling on the floor")["category"] == "Plumbing"
    assert triage_complaint("Crack in the wall near the window")["category"] == "Structural"
    # Whole-word matching: "Block" is not "lock", "blanket" is not "lan".
    assert triage_complaint("WiFi keeps disconnecting in Block A")["category"] == "IT / WiFi"
    assert triage_complaint("Need an extra blanket for winter")["category"] == "General"
    assert triage_complaint("The switch board gives a shock")["priority"] == "CRITICAL (IMMEDIATE)"
    hazard = triage_complaint("Water dripping from the ceiling onto the electrical socket, sparks seen")
    assert hazard == {"category": "Electrical", "priority": "CRITICAL (IMMEDIATE)", "eta": "2 Hours"}


def test_compatibility_score_bounds():
    survey = {"sleepHabit": "Early Riser", "studyEnv": "Ambient / Music OK",
              "cleanliness": "Relaxed / Minimal", "socialPref": "Active Hub"}
    assert compatibility_score({"sleep": "night", "study": "silent", "clean": "strict", "social": "quiet"}, survey) == 0
    assert compatibility_score({"sleep": "early", "study": "ambient", "clean": "relaxed", "social": "active"}, survey) == 100


# --- production configuration guard -------------------------------------------------
def test_production_refuses_insecure_config(monkeypatch):
    from config import load_settings
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("SEED_DEMO_DATA")
    monkeypatch.setenv("SECRET_KEY", "short")
    for name in ("CAMPUS_ADMIN_PIN", "HOSTEL_ADMIN_PIN", "MESS_MANAGER_PIN"):
        monkeypatch.setenv(name, "000000000000")
    with pytest.raises(RuntimeError, match="SECRET_KEY.*demo staff PINs"):
        load_settings()

    monkeypatch.setenv("SECRET_KEY", "x" * 40)
    monkeypatch.setenv("CAMPUS_ADMIN_PIN", "4821-9930-1174")
    monkeypatch.setenv("HOSTEL_ADMIN_PIN", "5502-1187-6643")
    monkeypatch.setenv("MESS_MANAGER_PIN", "9034-2261-7758")
    with pytest.raises(RuntimeError, match="DATA_ENCRYPTION_KEY"):
        load_settings()
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", "q" * 43)
    prod = load_settings()
    assert prod.cookie_secure and not prod.seed_demo_data and prod.cors_origins == []


def test_room_allocation_rejects_unknown_room(login):
    warden = login("HostelAdmin")
    for bad in ("Z11", "A-101", "A111", "A60"):
        assert warden.post(f"/api/rooms/{bad}/allocate", json={"name": "X Y", "maxOccupants": 2}).status_code == 404


def test_hundred_student_dataset_is_seeded(login):
    surveys = login("HostelAdmin").get("/api/surveys").json()
    dataset = [s for s in surveys if s["studentId"].startswith("STU-") and s.get("allocatedRoom")]
    assert len(dataset) == 100
    assert {s["studyEnv"] for s in dataset} <= {"Absolute Silence", "Ambient / Music OK", "Library Preferred"}


# --- encrypted resident records ------------------------------------------------------
SEEDED = {"role": "Student", "email": "naveen.reddy@demeure.ac.in", "secret": "VIT2026"}


def test_resident_pii_is_encrypted_at_rest(app):
    import base64
    from services.students import ENCRYPTED_FIELDS
    store = app.state.services.store
    docs = store.list("students")
    assert len(docs) == 101
    for doc in docs:
        cred = doc["credential"]
        assert cred["alg"] == "pbkdf2-sha256" and len(base64.b64decode(cred["hash"])) == 32 and cred["salt"]
        for field in ENCRYPTED_FIELDS:
            if field in doc:
                assert doc[field].startswith("enc:v1:"), (doc["id"], field)
    # The raw database file never contains a plaintext phone number or guardian e-mail.
    raw = open(app.state.services.settings.db_path, "rb").read()
    assert b"@example.com" not in raw and b"+91 " not in raw


def test_ciphertext_is_bound_to_record_and_field(app):
    services = app.state.services
    a, b = services.store.list("students")[:2]
    assert services.cipher.try_decrypt(a["phone"], a["id"], "phone")
    assert services.cipher.try_decrypt(a["phone"], b["id"], "phone") is None       # moved to another record
    assert services.cipher.try_decrypt(a["phone"], a["id"], "guardianPhone") is None  # moved to another field


def test_seeded_resident_can_sign_in_and_read_own_profile(app):
    from fastapi.testclient import TestClient
    client = TestClient(app)
    user = client.post("/api/auth/login", json=SEEDED).json()
    assert user["name"] == "Naveen Reddy" and user["room"].startswith("A-")
    me = client.get("/api/students/me").json()
    assert me["guardianEmail"].endswith("@example.com") and "credential" not in me
    assert len(client.get("/api/surveys").json()) == 1  # their own survey only
    assert client.get("/api/students").status_code == 403
    assert TestClient(app).post("/api/auth/login", json={**SEEDED, "secret": "WRONG1"}).status_code == 401


def test_directory_masks_contacts_and_audits_decryption(login):
    warden = login("HostelAdmin")
    body = warden.get("/api/students").json()
    assert len(body["students"]) == 101 and body["encryption"]["algorithm"] == "AES-256-GCM"
    row = next(s for s in body["students"] if s["email"] == SEEDED["email"])
    assert "phone" not in row and "••••••" in row["phoneMasked"] and "credential" not in row
    full = warden.get(f"/api/students/{row['id']}").json()
    assert full["phone"].startswith("+91 ") and full["homeAddress"]
    assert warden.get(f"/api/students/{row['id']}/stored").status_code == 403
    stored = login("CampusAdmin").get(f"/api/students/{row['id']}/stored").json()
    assert stored["phone"].startswith("enc:v1:") and "salt" not in stored["credential"]
    logs = login("CampusAdmin").get("/api/aws/status").json()["logs"]
    assert any(l["service"] == "Encryption" and "Naveen Reddy" in l["details"] for l in logs)


def test_rooms_are_seeded_without_mixing_genders(app):
    store = app.state.services.store
    gender = {s["name"]: s["gender"] for s in store.list("students")}
    rooms = store.list("room_allocations")
    residents = [[n for n in r["occupants"] if n in gender] for r in rooms]  # other tests add non-residents
    assert sum(map(len, residents)) == 101
    for room, names in zip(rooms, residents):
        assert len(room["occupants"]) <= room["maxOccupants"]
        assert len({gender[n] for n in names}) <= 1, room


def test_session_probe(anon, login):
    assert anon.get("/api/auth/session").json() == {"user": None}
    assert login("Student").get("/api/auth/session").json()["user"]["role"] == "Student"


# --- resident onboarding ----------------------------------------------------------------
NEW_RESIDENT = {"regNo": "25BCE0999", "name": "Meera Krishnan", "email": "Meera.K@vitstudent.ac.in", "gender": "F",
                "course": "B.Tech", "branch": "CSE", "yearOfStudy": "Year 1", "phone": "98400 12345",
                "guardianName": "Lakshmi Krishnan", "guardianEmail": "lakshmi.k@example.com",
                "bloodGroup": "o +", "dietaryPref": "veg", "dateOfBirth": "2007-04-12"}


def _resident_login(app, email, code):
    from fastapi.testclient import TestClient
    return TestClient(app).post("/api/auth/login", json={"role": "Student", "email": email, "secret": code})


def test_staff_can_onboard_a_resident(app, login, anon):
    warden = login("HostelAdmin")
    res = warden.post("/api/students", json=NEW_RESIDENT)
    assert res.status_code == 200, res.text
    body = res.json()
    student, code = body["student"], body["accessCode"]
    assert student["block"] == "B" and student["room"].startswith("B-") and len(code) == 9
    assert warden.get("/api/rooms/allocations").json()[student["roomId"]][-1] == "Meera Krishnan"
    # Stored encrypted, decrypted for staff, normalised on the way in.
    raw = app.state.services.store.get("students", student["id"])
    assert raw["phone"].startswith("enc:v1:") and raw["email"] == "meera.k@vitstudent.ac.in"
    full = warden.get(f"/api/students/{student['id']}").json()
    assert full["phone"] == "+91 9840012345" and full["bloodGroup"] == "O+" and full["dietaryPref"] == "Vegetarian"
    # The code works case-insensitively, with or without the dash, and was e-mailed.
    assert _resident_login(app, "meera.k@vitstudent.ac.in", code.lower().replace("-", "")).status_code == 200
    logs = login("CampusAdmin").get("/api/aws/status").json()["logs"]
    assert any(l["service"] == "SES" and "meera.k@vitstudent.ac.in" in l["details"] for l in logs)
    assert warden.post("/api/students", json=NEW_RESIDENT).status_code == 409  # duplicate
    assert login("Student").post("/api/students", json={**NEW_RESIDENT, "email": "x@y.in"}).status_code == 403


def test_onboarding_rejects_invalid_details(login):
    warden = login("HostelAdmin")
    assert warden.post("/api/students", json={**NEW_RESIDENT, "email": "a1@t.in", "regNo": "R1", "phone": "12345"}).status_code == 422
    blocked = warden.post("/api/students", json={**NEW_RESIDENT, "email": "a2@t.in", "regNo": "R2X", "block": "A"})
    assert blocked.status_code == 409 and "reserved for male" in blocked.json()["detail"]


def test_import_creates_valid_rows_and_reports_bad_ones(login):
    rows = [
        {**NEW_RESIDENT, "regNo": "IMP001", "email": "imp1@t.in", "name": "Rohit Menon", "gender": "Male"},
        {**NEW_RESIDENT, "regNo": "IMP002", "email": "imp2@t.in", "name": "Sara Thomas"},
        {**NEW_RESIDENT, "regNo": "IMP003", "email": "imp3@t.in", "phone": "000"},
        {**NEW_RESIDENT, "regNo": "IMP004", "email": "imp1@t.in"},
    ]
    body = login("CampusAdmin").post("/api/students/import", json={"students": rows, "sendEmails": False}).json()
    assert (body["created"], body["failed"]) == (2, 2)
    errors = {r["row"]: r["error"] for r in body["results"] if r["status"] == "error"}
    assert "phone" in errors[3] and "Duplicate" in errors[4]
    created = [r["student"] for r in body["results"] if r["status"] == "created"]
    assert created[0]["block"] == "A" and created[1]["block"] == "B"


def test_deactivate_and_reset_code(app, login):
    warden = login("HostelAdmin")
    res = warden.post("/api/students", json={**NEW_RESIDENT, "regNo": "DEA001", "email": "deact@t.in"}).json()
    sid, code = res["student"]["id"], res["accessCode"]
    warden.patch(f"/api/students/{sid}", json={"status": "Inactive"})
    assert _resident_login(app, "deact@t.in", code).status_code == 401
    updated = warden.patch(f"/api/students/{sid}", json={"status": "Active", "phone": "9123456780"}).json()
    assert updated["phone"] == "+91 9123456780"
    new_code = warden.post(f"/api/students/{sid}/reset-code").json()["accessCode"]
    assert _resident_login(app, "deact@t.in", code).status_code == 401
    assert _resident_login(app, "deact@t.in", new_code).status_code == 200
