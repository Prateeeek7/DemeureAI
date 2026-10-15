"""Demo data, written once per collection when SEED_DEMO_DATA is enabled.

The 100 residents come from data/student_survey_100.xlsx (converted to data/seed/student_surveys_100.json).
Their contact, family, health and address details are generated deterministically, so every run
produces the same dataset, and are encrypted with the runtime data key before they are stored.
Every other collection (rooms, leaves, visitors, complaints, payments, reviews, gate ledger) refers
to these real student records rather than to placeholder names.
"""
import json
import os
import random
from datetime import datetime, timedelta, timezone

from services.crypto import FieldCipher
from services.domain import GENESIS_HASH, ledger_hash
from services.store import Store
from services.students import COLLECTION as STUDENTS, build_record, student_id

SEED_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "seed")
SURVEY_FIXTURE = os.path.join(SEED_DIR, "student_surveys_100.json")

DEMO_STUDENT_EMAIL = "pratik2024@vit.student.ac.in"
DEMO_STUDENT_ID = student_id(DEMO_STUDENT_EMAIL)
DEMO_ACCESS_CODE = "VIT2024"        # the README demo student
DATASET_ACCESS_CODE = "VIT2026"     # every seeded resident (development / demo deployments only)
BILLING_CYCLE = "2026-S2-01"
BASE_FEE, POWER_RATE, UNITS, FINES = 75000, 8.5, 210, 100

# Floor layout shared with the Room Allocation screen: 10 rooms per floor, 5 floors per block.
ROOM_TYPES = ["Double", "Single", "Double", "Suite", "Double", "Single", "Double", "Suite", "Single", "Double"]
CAPACITY = {"Single": 1, "Double": 2, "Suite": 4}
MAINTENANCE_ROOM = 5  # out of service on even floors


def room_id(block: str, floor: int, n: int) -> str:
    return f"{block}{floor}{n}"


def room_label(block: str, floor: int, n: int) -> str:
    return f"{block}-{floor}{n:02d}"


def _load_surveys() -> list[dict]:
    with open(SURVEY_FIXTURE, encoding="utf-8") as f:
        return json.load(f)


# --- deterministic demo personal details -------------------------------------------------
_FATHERS = ["Rajesh", "Suresh", "Ramesh", "Anil", "Sunil", "Vijay", "Manoj", "Prakash", "Ashok", "Sanjay",
            "Deepak", "Arun", "Mahesh", "Ravi", "Naresh", "Dinesh", "Mukesh", "Satish", "Girish", "Harish"]
_MOTHERS = ["Sunita", "Anita", "Kavita", "Rekha", "Meena", "Lakshmi", "Geeta", "Usha", "Asha", "Seema",
            "Poonam", "Nirmala", "Shanti", "Radha", "Savita"]
_CITIES = [("Vellore", "Tamil Nadu", "632"), ("Chennai", "Tamil Nadu", "600"), ("Bengaluru", "Karnataka", "560"),
           ("Hyderabad", "Telangana", "500"), ("Pune", "Maharashtra", "411"), ("Mumbai", "Maharashtra", "400"),
           ("Jaipur", "Rajasthan", "302"), ("Lucknow", "Uttar Pradesh", "226"), ("Patna", "Bihar", "800"),
           ("Kolkata", "West Bengal", "700"), ("Bhopal", "Madhya Pradesh", "462"), ("Kochi", "Kerala", "682"),
           ("Ahmedabad", "Gujarat", "380"), ("Chandigarh", "Punjab", "160"), ("Guwahati", "Assam", "781"),
           ("Bhubaneswar", "Odisha", "751"), ("Visakhapatnam", "Andhra Pradesh", "530"), ("Indore", "Madhya Pradesh", "452")]
_STREETS = ["MG Road", "Gandhi Nagar", "Nehru Street", "Station Road", "Lake View Colony", "Anna Salai",
            "Park Avenue", "Shastri Nagar", "Civil Lines", "Rajaji Street", "Temple Road", "Green Park"]
_BLOOD = ["O+"] * 9 + ["B+"] * 8 + ["A+"] * 6 + ["AB+"] * 2 + ["O-", "B-", "A-"]
_BASE_AGE = {"B.Tech": 18, "MCA": 21, "MBA": 22, "M.Tech": 22, "PhD": 24}


def _phone(rng: random.Random) -> str:
    return f"+91 {rng.choice('6789')}{rng.randint(0, 999999999):09d}"


def _personal_details(survey: dict, rng: random.Random) -> dict:
    surname = survey["fullName"].split()[-1]
    roll = rng.random()
    if roll < 0.7:
        relation, guardian = "Father", f"{rng.choice(_FATHERS)} {surname}"
    elif roll < 0.95:
        relation, guardian = "Mother", f"{rng.choice(_MOTHERS)} {surname}"
    else:
        relation, guardian = "Local Guardian", f"{rng.choice(_FATHERS)} {rng.choice(['Iyer', 'Menon', 'Rao', 'Pillai'])}"
    year = int(survey["yearOfStudy"].split()[-1])
    age = _BASE_AGE.get(survey["course"], 19) + year - 1
    dob = datetime(2026 - age - 1, 1, 1) + timedelta(days=rng.randint(0, 364))
    city, state, pin = rng.choice(_CITIES)
    first = guardian.split()[0].lower()
    return {
        "phone": _phone(rng),
        "dateOfBirth": dob.strftime("%Y-%m-%d"),
        "bloodGroup": rng.choice(_BLOOD),
        "guardianName": guardian,
        "guardianRelation": relation,
        "guardianPhone": _phone(rng),
        # example.com is reserved for documentation, so demo e-mails never reach a real inbox.
        "guardianEmail": f"{first}.{surname.lower()}@example.com",
        "homeAddress": f"{rng.randint(1, 240)}, {rng.choice(_STREETS)}, {city}, {state} {pin}{rng.randint(0, 99):03d}",
        "medicalNotes": survey.get("specialNeeds") or "None declared",
    }


# --- rooms -----------------------------------------------------------------------------------
class _Hostel:
    """Assigns beds by preferred block/floor/room type without mixing genders in a room."""

    def __init__(self):
        self.rooms = {}
        for block in "ABC":
            for floor in range(1, 6):
                for n, rtype in enumerate(ROOM_TYPES, start=1):
                    if floor % 2 == 0 and n == MAINTENANCE_ROOM:
                        continue
                    self.rooms[(block, floor, n)] = {"type": rtype, "cap": CAPACITY[rtype], "occ": [], "gender": None}

    def _fits(self, key, gender: str) -> bool:
        room = self.rooms.get(key)
        return bool(room) and len(room["occ"]) < room["cap"] and room["gender"] in (None, gender)

    def place(self, name: str, gender: str, block: str, floor: int, rtype: str, fixed=None) -> tuple:
        if fixed:
            key = fixed
        else:
            floors = sorted(range(1, 6), key=lambda f: (abs(f - floor), f))
            order = [(f, t) for f in floors for t in (rtype, None)]
            key = next(((block, f, n) for f, t in order for n in range(1, 11)
                        if (t is None or ROOM_TYPES[n - 1] == t) and self._fits((block, f, n), gender)), None)
            if key is None:
                raise RuntimeError(f"No free bed in block {block} for {name}")
        room = self.rooms[key]
        room["occ"].append(name)
        room["gender"] = gender
        return key

    def allocations(self) -> list[dict]:
        return [{"id": room_id(*key), "occupants": r["occ"], "maxOccupants": r["cap"]}
                for key, r in self.rooms.items() if r["occ"]]


# --- dataset ---------------------------------------------------------------------------------
def _stamp(docs: list[dict]) -> list[dict]:
    """Gives seed docs strictly decreasing createdAt so list order is stable."""
    base = datetime(2026, 10, 1, tzinfo=timezone.utc)
    for i, doc in enumerate(docs):
        doc.setdefault("createdAt", (base - timedelta(minutes=i)).isoformat(timespec="seconds"))
    return docs


def _gate_ledger(people: list[dict]) -> list[dict]:
    raw = [  # oldest first so the chain can be built
        {"time": "07:58:12", "name": "Sunita Sharma", "type": "Staff", "roomOrPurpose": "Housekeeping (Block B)", "status": "GRANTED"},
        {"time": "09:14:40", "name": people[1]["name"], "type": "Resident", "roomOrPurpose": people[1]["room"], "status": "GRANTED"},
        {"time": "10:02:05", "name": people[2]["name"], "type": "Resident", "roomOrPurpose": people[2]["room"], "status": "GRANTED"},
        {"time": "11:59:10", "name": "Unknown Subject", "type": "Visitor", "roomOrPurpose": "Tailgating Attempt", "status": "DENIED"},
        {"time": "12:18:44", "name": "Rajesh Patel", "type": "Visitor", "roomOrPurpose": f"Parent Visit ({people[3]['room']})", "status": "GRANTED"},
        {"time": "12:25:02", "name": people[0]["name"], "type": "Resident", "roomOrPurpose": people[0]["room"], "status": "GRANTED"},
        {"time": "18:47:31", "name": people[4]["name"], "type": "Resident", "roomOrPurpose": people[4]["room"], "status": "GRANTED"},
        {"time": "22:41:09", "name": people[5]["name"], "type": "Resident", "roomOrPurpose": f"{people[5]['room']} (after curfew)", "status": "DENIED"},
    ]
    prev, out = GENESIS_HASH, []
    base = datetime(2026, 10, 1, tzinfo=timezone.utc)
    for i, entry in enumerate(raw):
        entry.update(id=f"G-{i + 1:06d}", seq=i + 1, prevHash=prev,
                     createdAt=(base + timedelta(minutes=i)).isoformat(timespec="seconds"))
        entry["hash"] = ledger_hash(prev, entry)
        prev = entry["hash"]
        out.append(entry)
    return out


def build_demo_dataset(cipher: FieldCipher) -> dict[str, list[dict]]:
    rng = random.Random(2026)
    surveys = _load_surveys()
    hostel = _Hostel()

    # The README demo student, in a single room on Block A, floor 3.
    demo = {
        "studentId": "STU-000", "regNo": "24BML0027", "name": "Pratik Kumar", "email": DEMO_STUDENT_EMAIL,
        "gender": "Male", "course": "B.Tech", "branch": "ECE", "yearOfStudy": "Year 3", "dietaryPref": "Vegetarian",
        "status": "Active",
        **_personal_details({"fullName": "Pratik Kumar", "yearOfStudy": "Year 3", "course": "B.Tech"}, rng),
        "guardianEmail": "",  # the demo account's guardian address comes from STUDENT_ACCOUNTS
    }
    key = hostel.place(demo["name"], "Male", "A", 3, "Single", fixed=("A", 3, 2))
    demo.update(block="A", room=room_label(*key), roomId=room_id(*key))
    profiles = [(demo, DEMO_ACCESS_CODE)]

    for s in surveys:
        profile = {
            "studentId": s["studentId"], "regNo": s["rollNumber"], "name": s["fullName"], "email": s["email"],
            "gender": s["gender"], "course": s["course"], "branch": s["branch"], "yearOfStudy": s["yearOfStudy"],
            "dietaryPref": s["dietaryPref"], "status": "Active", **_personal_details(s, rng),
        }
        key = hostel.place(s["fullName"], s["gender"], s["preferredBlock"], int(s["preferredFloor"]), s["roomTypePref"])
        profile.update(block=key[0], room=room_label(*key), roomId=room_id(*key))
        s["ownerId"] = student_id(s["email"])
        s["allocatedRoom"] = profile["room"]
        profiles.append((profile, DATASET_ACCESS_CODE))

    people = [{"id": student_id(p["email"]), **p} for p, _ in profiles]
    by_id = {p["id"]: p for p in people}
    p = people  # p[0] is the demo student; p[1..100] follow the survey order

    def who(i: int) -> dict:
        return p[i]

    leaves = [
        {"id": "L-101", "s": who(0), "start": "2026-10-24", "end": "2026-10-27", "reason": "Sister's wedding in Patna",
         "status": "Pending", "consent": "Parent Notified (Email)"},
        {"id": "L-102", "s": who(4), "start": "2026-10-18", "end": "2026-10-18", "reason": "Dental appointment in Vellore town",
         "status": "Pending", "consent": "Parent Notified (Email)"},
        {"id": "L-103", "s": who(12), "start": "2026-10-20", "end": "2026-10-23", "reason": "Inter-university hackathon, Bengaluru",
         "status": "Pending", "consent": "Parent Notified (Email)"},
        {"id": "L-104", "s": who(23), "start": "2026-10-09", "end": "2026-10-12", "reason": "Family function at home",
         "status": "Approved", "consent": "Parent Verified (OTP)"},
        {"id": "L-105", "s": who(37), "start": "2026-10-05", "end": "2026-10-06", "reason": "Medical check-up",
         "status": "Approved", "consent": "Parent Verified (OTP)"},
        {"id": "L-106", "s": who(58), "start": "2026-10-16", "end": "2026-10-30", "reason": "Personal travel",
         "status": "Denied", "consent": "Pending Parent Auth"},
    ]
    leave_docs = []
    for l in leaves:
        st = l["s"]
        start, end = datetime.fromisoformat(l["start"]), datetime.fromisoformat(l["end"])
        leave_docs.append({
            "id": l["id"], "studentId": st["id"], "studentEmail": st["email"], "name": st["name"], "room": st["room"],
            "startDate": l["start"], "endDate": l["end"],
            "duration": f"{start:%d %b %Y} to {end:%d %b %Y}", "reason": l["reason"],
            "consent": l["consent"], "status": l["status"], "proofUrl": None,
        })

    visitors = [
        ("V-001", who(0), "Suresh Kumar", "18 Oct 2026, 14:00", "Parental Visit", "Pending", None),
        ("V-002", who(9), "Amit Patel", "17 Oct 2026, 10:00", "Local Guardian", "Pending", None),
        ("V-003", who(41), "Kavita Nair", "16 Oct 2026, 16:30", "Delivering winter clothes", "Approved", "GP-7F3A21"),
        ("V-004", who(66), "Rohit Verma", "12 Oct 2026, 11:00", "Project discussion", "Denied", None),
        ("V-005", who(83), "Meena Iyer", "19 Oct 2026, 09:30", "Parental Visit", "Pending", None),
    ]
    visitor_docs = [{"id": vid, "visitor": name, "host": f"{st['name']} ({st['room']})", "hostId": st["id"],
                     "hostEmail": st["email"], "date": when, "purpose": purpose, "status": status,
                     **({"passCode": code} if code else {})}
                    for vid, st, name, when, purpose, status, code in visitors]

    complaints = [
        ("T-984", who(7), "Water leakage from the ceiling dripping on electrical sockets.", "Plumbing", "CRITICAL (IMMEDIATE)", "2 Hours", "Dispatched"),
        ("T-983", who(15), "Switch board near the study table gives a shock when touched.", "Electrical", "CRITICAL (IMMEDIATE)", "2 Hours", "Open"),
        ("T-982", who(46), "WiFi keeps disconnecting every few minutes on the second floor.", "IT / WiFi", "MEDIUM", "24 Hours", "Open"),
        ("T-981", who(52), "Bathroom tap is leaking continuously and the drain is clogged.", "Plumbing", "HIGH", "12 Hours", "Dispatched"),
        ("T-980", who(71), "Door lock of the room is jammed and does not close properly.", "Structural", "MEDIUM", "24 Hours", "Open"),
        ("T-979", who(27), "Main tube light flickering during evening study hours.", "Electrical", "HIGH", "8 Hours", "Resolved"),
        ("T-978", who(90), "Crack in the wall near the window, plaster falling off.", "Structural", "MEDIUM", "24 Hours", "Resolved"),
        ("T-977", who(33), "LAN port in the room is not working.", "IT / WiFi", "MEDIUM", "24 Hours", "Resolved"),
    ]
    complaint_docs = [{"id": cid, "room": st["room"], "originalText": text, "category": cat, "priority": prio,
                       "eta": eta, "status": status, "filedBy": st["id"]}
                      for cid, st, text, cat, prio, eta, status in complaints]

    grievances = [
        ("GRV-101", who(0), "Late Night Library AC Noise Issue", "Infrastructure / Study Area", "Sep 30, 2026", "MEDIUM", "RESOLVED", False),
        ("GRV-102", who(44), "Hostel Block B Hot Water Geyser Fault", "Hostel Facility", "Oct 02, 2026", "HIGH", "IN INVESTIGATION", False),
        ("GRV-103", who(19), "Seniors forcing juniors to run errands after curfew", "Anti-Ragging", "Oct 06, 2026", "HIGH", "UNDER ESCALATION REVIEW", True),
        ("GRV-104", who(77), "Repeated verbal harassment in the common room", "Harassment", "Oct 09, 2026", "HIGH", "IN INVESTIGATION", True),
    ]
    grievance_docs = [{"id": gid, "subject": subj, "category": cat, "date": date, "priority": prio, "status": status,
                       "isAnonymous": anon, "filedBy": st["id"]}
                      for gid, st, subj, cat, date, prio, status, anon in grievances]

    review_text = [
        (5, "Dinner", "Loved the lentil curry today! Very home-like flavour."),
        (2, "Lunch", "The quinoa bowl was a bit dry. Can we get some sauce on the side?"),
        (4, "Breakfast", "Oatmeal breakfast is great, but could we add fresh cut fruits?"),
        (3, "Snacks", "The samosa could be crispier. Loved the chutney though!"),
        (5, "Dinner", "Saturday biryani is legendary. Please keep it on the menu!"),
        (4, "Lunch", "Good variety this week. More Jain options would help."),
        (2, "Dinner", "Rotis were cold by 8:30 PM."),
        (5, "Breakfast", "Idli and sambar were perfect."),
        (3, "Lunch", "Too much oil in the paneer gravy."),
        (4, "Snacks", "Fresh lime soda in the evening was a nice touch."),
    ]
    stamps = ["08:30 PM", "01:15 PM", "Yesterday", "Yesterday", "2 days ago", "2 days ago", "3 days ago",
              "3 days ago", "4 days ago", "5 days ago"]
    reviewers = [who(i) for i in (3, 11, 28, 39, 50, 61, 70, 81, 92, 99)]
    review_docs = [{"id": f"MR-{i + 1}", "studentName": st["name"], "studentId": st["id"], "rating": r, "meal": meal,
                    "suggestion": text, "timestamp": stamps[i]}
                   for i, ((r, meal, text), st) in enumerate(zip(review_text, reviewers))]

    welfare = [
        ("W-01", who(21), "Zero Gate Swipe & Zero Mess Log", "36 Hours", "Unresolved"),
        ("W-02", who(48), "Consecutive Absenteeism Pattern", "48 Hours", "Unresolved"),
        ("W-03", who(64), "High Complaint Stress Words", "Completed Check", "Checked"),
        ("W-04", who(88), "Missed 6 consecutive mess meals", "52 Hours", "Unresolved"),
    ]
    welfare_docs = [{"id": wid, "name": st["name"], "room": st["room"], "studentId": st["id"],
                     "triggerCondition": cond, "durationTime": dur, "status": status}
                    for wid, st, cond, dur, status in welfare]

    # About 60% of residents have already paid the current cycle; the demo student has not.
    total = round(BASE_FEE + UNITS * POWER_RATE + FINES, 2)
    payment_docs = [{"id": f"{st['id']}|{BILLING_CYCLE}", "receiptId": f"RCP-{rng.randint(100000, 999999)}",
                     "studentId": st["id"], "cycleId": BILLING_CYCLE, "amount": total, "method": "UPI (simulated)",
                     "upiId": f"{st['email'].split('@')[0].replace('.', '')}@okaxis"}
                    for st in people[1:] if rng.random() < 0.6]

    bookings = [
        {"id": "BK-401", "facility": "Main Auditorium (1,200 Seats)", "type": "Auditorium",
         "slot": "Oct 20 • 02:00 PM - 06:00 PM", "requestedBy": "ACM Student Chapter", "status": "APPROVED"},
        {"id": "BK-402", "facility": "Advanced Robotics & AI Lab", "type": "Laboratory",
         "slot": "Oct 22 • 10:00 AM - 01:00 PM", "requestedBy": "Robotics Club", "status": "PENDING"},
        {"id": "BK-403", "facility": "Indoor Badminton Court 2", "type": "Sports Facility",
         "slot": "Oct 17 • 05:00 PM - 07:00 PM", "requestedBy": f"{who(0)['name']} (Student)", "status": "APPROVED",
         "filedBy": who(0)["id"]},
        {"id": "BK-404", "facility": "Seminar Hall 3", "type": "Seminar Hall",
         "slot": "Oct 25 • 09:00 AM - 12:00 PM", "requestedBy": f"{who(18)['name']} (IEEE Student Branch)",
         "status": "PENDING", "filedBy": who(18)["id"]},
    ]
    maintenance = [
        {"id": "MNT-881", "location": f"Block {who(7)['block']} - Room {who(7)['room']}", "issue": "Ceiling Fan Noise & AC Cooling Issue",
         "type": "AC/Fan Maintenance", "priority": "HIGH", "status": "IN PROGRESS", "date": "Oct 01, 2026"},
        {"id": "MNT-882", "location": "Mess Hall Kitchen", "issue": "Exhaust Fan Duct Cleaning",
         "type": "Cleaning Request", "priority": "MEDIUM", "status": "COMPLETED", "date": "Sep 29, 2026"},
        {"id": "MNT-883", "location": "Academic Block 2 - Floor 3", "issue": "Washroom Water Leakage",
         "type": "Plumbing Complaint", "priority": "URGENT", "status": "PENDING ASSIGNMENT", "date": "Oct 02, 2026"},
    ]
    power = [
        {"id": "PA-1", "time": "12:14:05", "location": f"{who(31)['room']}, Block {who(31)['block']}", "zone": f"Block {who(31)['block']}",
         "deviceType": "Heavy Inductive Load (Heater)", "loadSpike": "+1.8 kW", "confidence": 94.6, "status": "Investigating"},
        {"id": "PA-2", "time": "09:44:12", "location": "Elevator Shaft 2", "zone": "Block B",
         "deviceType": "Motor Voltage Oscillation", "loadSpike": "+4.2 kW", "confidence": 88.2, "status": "Resolved"},
        {"id": "PA-3", "time": "Yesterday", "location": "Kitchen Oven C", "zone": "Mess Hall",
         "deviceType": "Thermocouple Failure", "loadSpike": "Leakage Current", "confidence": 91.0, "status": "Resolved"},
    ]

    assert len(by_id) == len(people), "duplicate student e-mail in the dataset"
    return {
        STUDENTS: [build_record(prof, code, cipher) for prof, code in profiles],
        "surveys": surveys,
        "room_allocations": hostel.allocations(),
        "billing": [{"id": "current", "powerRate": POWER_RATE, "baseFee": BASE_FEE, "cycleId": BILLING_CYCLE}],
        "payments": payment_docs,
        "leaves": leave_docs,
        "visitors": visitor_docs,
        "complaints": complaint_docs,
        "grievances": grievance_docs,
        "mess_reviews": review_docs,
        "welfare_alerts": welfare_docs,
        "bookings": bookings,
        "maintenance": maintenance,
        "power_anomalies": power,
        "gate_ledger": _gate_ledger(people),
    }


def seed_demo_data(store: Store, cipher: FieldCipher) -> list[str]:
    """Seeds each collection exactly once; returns the collections that were seeded."""
    seeded = []
    dataset = None
    for collection in ("students", "surveys", "room_allocations", "billing", "payments", "leaves", "visitors",
                       "complaints", "grievances", "mess_reviews", "welfare_alerts", "bookings", "maintenance",
                       "power_anomalies", "gate_ledger"):
        marker = f"seeded:{collection}"
        if store.get("_meta", marker):
            continue
        if not store.list(collection):
            dataset = dataset or build_demo_dataset(cipher)
            for doc in _stamp([dict(d) for d in dataset[collection]]):
                store.put(collection, doc)
            seeded.append(collection)
        store.put("_meta", {"id": marker})
    return seeded
