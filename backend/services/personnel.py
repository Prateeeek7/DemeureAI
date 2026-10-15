"""Faculty, wardens and staff: identities, encrypted personal details and portal sign-in.

Every person has an institutional ID that is also their sign-in name and the key of their record:
  * Faculty  FAC1001 ...  (portal role "Faculty")
  * Wardens  WDN101  ...  (portal role "HostelAdmin")
  * Staff    STF2001 ...  (portal role depends on the post; most staff have no portal access)
Students keep their university registration numbers (e.g. 24BML0027).

Official contact details (office, extension, institutional e-mail, warden duty phone) are public
to the people allowed to search for them; personal details are AES-256-GCM encrypted like student
records, and the sign-in PIN is stored only as a PBKDF2 hash.
"""
import random
import re
from typing import Optional

from services.crypto import FieldCipher
from services.students import hash_code

COLLECTION = "personnel"
KINDS = ("Faculty", "Warden", "Staff")
ENCRYPTED_FIELDS = ("phone", "dateOfBirth", "homeAddress", "emergencyContact")
PUBLIC_FIELDS = (
    "id", "kind", "name", "gender", "designation", "department", "school", "email", "office", "extension",
    "officeHours", "courses", "block", "floors", "shift", "dutyPhone", "portalRole", "status", "createdAt",
)
ID_PATTERN = re.compile(r"^(FAC\d{4}|WDN\d{3}|STF\d{4})$")


def normalise_id(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", value or "").upper()


def build_record(profile: dict, pin: Optional[str], cipher: FieldCipher) -> dict:
    rid = profile["id"]
    doc = {k: profile[k] for k in PUBLIC_FIELDS if k in profile}
    doc.setdefault("status", "Active")
    for field in ENCRYPTED_FIELDS:
        if profile.get(field):
            doc[field] = cipher.encrypt(str(profile[field]), rid, field)
    if pin and profile.get("portalRole"):
        doc["credential"] = hash_code(pin)
    doc["encryption"] = {"algorithm": "AES-256-GCM", "keyId": cipher.key_id}
    return doc


def public_view(doc: dict) -> dict:
    return {k: doc[k] for k in PUBLIC_FIELDS if k in doc}


def decrypt_view(doc: dict, cipher: FieldCipher) -> dict:
    out = public_view(doc)
    for field in ENCRYPTED_FIELDS:
        if field in doc:
            out[field] = cipher.try_decrypt(doc[field], doc["id"], field)
    return out


class PersonnelRegistry:
    def __init__(self, store, cipher: FieldCipher):
        self.store = store
        self.cipher = cipher

    def get(self, employee_id: str) -> Optional[dict]:
        eid = normalise_id(employee_id)
        return self.store.get(COLLECTION, eid) if ID_PATTERN.match(eid) else None

    def all(self) -> list[dict]:
        return self.store.list(COLLECTION)


def wardens_for(wardens: list[dict], block: str, floor: Optional[int]) -> list[dict]:
    """The chief warden of the block first, then the floor warden responsible for `floor`."""
    in_block = [w for w in wardens if w.get("block") == block and w.get("status", "Active") == "Active"]
    chief = [w for w in in_block if w.get("designation", "").startswith("Chief")]
    floor_wardens = [w for w in in_block if w not in chief and floor is not None
                     and floor in _floor_range(w.get("floors", ""))]
    return chief + floor_wardens


def _floor_range(text: str) -> range:
    nums = [int(n) for n in re.findall(r"\d", text)]
    return range(min(nums), max(nums) + 1) if nums else range(0)


# Branch of study -> faculty department, used to assign each student a proctor.
BRANCH_DEPARTMENT = {
    "CSE": "Computer Science & Engineering", "IT": "Information Technology", "AI & ML": "Artificial Intelligence & ML",
    "Data Science": "Data Science", "ECE": "Electronics & Communication", "EEE": "Electrical & Electronics",
    "ME": "Mechanical Engineering", "Civil": "Civil Engineering", "Chemical Engg": "Chemical Engineering",
    "Biotechnology": "Biotechnology",
}


def choose_proctor(faculty: list[dict], branch: str, load: dict[str, int]) -> Optional[str]:
    """Least-loaded active faculty member of the student's department (any department as a fallback)."""
    dept = BRANCH_DEPARTMENT.get(branch)
    active = [f for f in faculty if f.get("status", "Active") == "Active"]
    pool = [f for f in active if f.get("department") == dept] or active
    if not pool:
        return None
    best = min(pool, key=lambda f: (load.get(f["id"], 0), f["id"]))
    load[best["id"]] = load.get(best["id"], 0) + 1
    return best["id"]


# --- technicians for complaint dispatch --------------------------------------------------
TECHNICIAN_FOR = {
    "Electrical": ("Electrician",), "Plumbing": ("Plumber",), "Structural": ("Carpenter",),
    "IT / WiFi": ("Network Engineer",), "General": ("Housekeeping Supervisor", "Electrician", "Plumber", "Carpenter"),
}


def technicians(personnel: list[dict], category: str) -> list[dict]:
    wanted = TECHNICIAN_FOR.get(category, TECHNICIAN_FOR["General"])
    return [p for p in personnel if p.get("kind") == "Staff" and p.get("status", "Active") == "Active"
            and any(p.get("designation", "").startswith(w) for w in wanted)]


# --- demo roster ---------------------------------------------------------------------------
DEMO_PIN = "246810"

_FACULTY = [  # (name, gender, designation, department, school, courses)
    ("Dr. Arvind Raghavan", "Male", "Professor", "Computer Science & Engineering", "SCOPE", ["CSE3001 Operating Systems", "CSE4019 Distributed Systems"]),
    ("Dr. Meenakshi Iyer", "Female", "Associate Professor", "Computer Science & Engineering", "SCOPE", ["CSE2001 Data Structures", "CSE3002 Database Systems"]),
    ("Dr. Sanjay Kulkarni", "Male", "Associate Professor", "Information Technology", "SCOPE", ["ITE2002 Computer Networks", "ITE3001 Web Technologies"]),
    ("Ms. Ritika Bansal", "Female", "Assistant Professor (Sr.)", "Information Technology", "SCOPE", ["ITE1002 Programming in Java", "ITE2004 Software Engineering"]),
    ("Dr. Farhan Siddiqui", "Male", "Assistant Professor (Sr.)", "Artificial Intelligence & ML", "SCOPE", ["CSE3008 Machine Learning", "CSE4022 Deep Learning"]),
    ("Dr. Lavanya Krishnan", "Female", "Assistant Professor", "Artificial Intelligence & ML", "SCOPE", ["CSE3013 Artificial Intelligence", "CSE4015 NLP"]),
    ("Dr. Nikhil Agarwal", "Male", "Associate Professor", "Data Science", "SCOPE", ["CSE3020 Data Visualisation", "MAT2001 Statistics"]),
    ("Dr. Shreya Menon", "Female", "Assistant Professor (Sr.)", "Data Science", "SCOPE", ["CSE3025 Big Data Analytics", "CSE2010 Python for Data"]),
    ("Dr. Prakash Venkatesan", "Male", "Professor", "Electronics & Communication", "SENSE", ["ECE2002 Signals & Systems", "ECE3005 Digital Communication"]),
    ("Dr. Kavitha Subramanian", "Female", "Associate Professor", "Electronics & Communication", "SENSE", ["ECE2003 Digital Electronics", "ECE4008 VLSI Design"]),
    ("Dr. Rajeev Nair", "Male", "Professor", "Electrical & Electronics", "SELECT", ["EEE2001 Circuit Theory", "EEE3004 Power Systems"]),
    ("Dr. Anjali Deshpande", "Female", "Assistant Professor (Sr.)", "Electrical & Electronics", "SELECT", ["EEE2005 Electrical Machines", "EEE3010 Power Electronics"]),
    ("Dr. Harish Chandran", "Male", "Professor", "Mechanical Engineering", "SMEC", ["MEE2001 Thermodynamics", "MEE3004 Fluid Mechanics"]),
    ("Dr. Pooja Malhotra", "Female", "Assistant Professor", "Mechanical Engineering", "SMEC", ["MEE2003 Manufacturing Processes", "MEE3012 CAD/CAM"]),
    ("Dr. Suresh Babu", "Male", "Associate Professor", "Civil Engineering", "SCE", ["CLE2001 Structural Analysis", "CLE3005 Geotechnical Engg"]),
    ("Dr. Neha Joshi", "Female", "Assistant Professor (Sr.)", "Civil Engineering", "SCE", ["CLE2004 Surveying", "CLE3010 Transportation Engg"]),
    ("Dr. Vikram Saxena", "Male", "Professor", "Chemical Engineering", "SCHEME", ["CHE2001 Mass Transfer", "CHE3003 Reaction Engineering"]),
    ("Dr. Divya Ramesh", "Female", "Assistant Professor", "Chemical Engineering", "SCHEME", ["CHE2004 Process Control", "CHE3008 Polymer Technology"]),
    ("Dr. Ananya Mukherjee", "Female", "Associate Professor", "Biotechnology", "SBST", ["BIT2001 Cell Biology", "BIT3004 Genetic Engineering"]),
    ("Dr. Rohit Sharma", "Male", "Assistant Professor (Sr.)", "Biotechnology", "SBST", ["BIT2005 Biochemistry", "BIT3010 Bioprocess Engineering"]),
]
_BUILDINGS = {"SCOPE": "Tech Tower", "SENSE": "Silver Jubilee Tower", "SELECT": "Silver Jubilee Tower",
              "SMEC": "Mechanical Block", "SCE": "Civil Block", "SCHEME": "Chemical Block", "SBST": "Bio Sciences Block"}
_HOURS = ["Mon & Wed 2-4 PM", "Tue & Thu 11 AM-1 PM", "Mon & Fri 3-5 PM", "Wed & Fri 10 AM-12 PM"]

_WARDENS = [  # (name, gender, designation, block, floors, shift)
    ("Mr. Ramesh Pillai", "Male", "Chief Warden", "A", "1-5", "Day"),
    ("Mr. Ajay Thakur", "Male", "Floor Warden", "A", "1-2", "Day"),
    ("Mr. Mohan Das", "Male", "Floor Warden", "A", "3-4", "Day"),
    ("Mr. Imran Khan", "Male", "Floor & Night Warden", "A", "5", "Night"),
    ("Dr. Sunita Rao", "Female", "Chief Warden", "B", "1-5", "Day"),
    ("Ms. Geeta Nair", "Female", "Floor Warden", "B", "1-2", "Day"),
    ("Ms. Farida Begum", "Female", "Floor Warden", "B", "3-4", "Day"),
    ("Ms. Priya Chatterjee", "Female", "Floor & Night Warden", "B", "5", "Night"),
    ("Dr. Arjun Mehra", "Male", "Chief Warden", "C", "1-5", "Day"),
    ("Ms. Kalpana Reddy", "Female", "Deputy Warden", "C", "1-5", "Night"),
]

_STAFF = [  # (name, gender, designation, department, portalRole, shift)
    ("Mr. Venkat Raman", "Male", "Campus Operations Manager", "Administration", "CampusAdmin", "General"),
    ("Ms. Shalini Gupta", "Female", "Administrative Officer", "Administration", "CampusAdmin", "General"),
    ("Mr. Prakash Iyer", "Male", "Accounts Officer", "Accounts", "CampusAdmin", "General"),
    ("Ms. Rekha Menon", "Female", "Accounts Assistant", "Accounts", None, "General"),
    ("Mr. Gopal Krishnan", "Male", "Mess Manager", "Mess & Dining", "MessManager", "General"),
    ("Mr. Selvam Murugan", "Male", "Head Cook", "Mess & Dining", None, "Morning"),
    ("Mr. Ravi Shankar", "Male", "Electrician", "Maintenance", None, "Day"),
    ("Mr. Anil Yadav", "Male", "Electrician", "Maintenance", None, "Night"),
    ("Mr. Babu Raj", "Male", "Plumber", "Maintenance", None, "Day"),
    ("Mr. Kishore Kumar", "Male", "Plumber", "Maintenance", None, "Night"),
    ("Mr. Joseph Mathew", "Male", "Carpenter", "Maintenance", None, "Day"),
    ("Mr. Deepak Verma", "Male", "Network Engineer", "IT Services", None, "Day"),
    ("Ms. Swati Kapoor", "Female", "Network Engineer", "IT Services", None, "Evening"),
    ("Mr. Rajendra Singh", "Male", "Security Supervisor", "Security", None, "Day"),
    ("Mr. Balwinder Singh", "Male", "Security Guard", "Security", None, "Night"),
    ("Ms. Lakshmi Devi", "Female", "Security Guard", "Security", None, "Day"),
    ("Ms. Sunita Sharma", "Female", "Housekeeping Supervisor", "Housekeeping", None, "Day"),
    ("Ms. Meera Krishnan", "Female", "Librarian", "Library", None, "General"),
    ("Mr. Sathish Kumar", "Male", "Transport Coordinator", "Transport", None, "General"),
    ("Ms. Anitha Joseph", "Female", "Staff Nurse", "Health Centre", None, "Day"),
]

_CITIES = ["Vellore", "Chennai", "Bengaluru", "Hyderabad", "Kochi", "Pune", "Coimbatore", "Madurai", "Mysuru", "Tirupati"]
_STREETS = ["MG Road", "Gandhi Nagar", "Anna Salai", "Lake View Colony", "Civil Lines", "Park Avenue", "Temple Road"]


def _email(name: str) -> str:
    parts = [p for p in re.sub(r"^(Dr|Mr|Ms|Mrs)\.\s*", "", name).lower().split() if len(p) > 1]
    return f"{parts[0]}.{parts[-1]}@demeure.ac.in"


def _personal(rng: random.Random, age_range=(28, 62)) -> dict:
    age = rng.randint(*age_range)
    return {
        "phone": f"+91 {rng.choice('6789')}{rng.randint(0, 999999999):09d}",
        "dateOfBirth": f"{2026 - age}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
        "homeAddress": f"{rng.randint(1, 180)}, {rng.choice(_STREETS)}, {rng.choice(_CITIES)}",
        "emergencyContact": f"{rng.choice(['Spouse', 'Parent', 'Sibling'])}: +91 {rng.choice('6789')}{rng.randint(0, 999999999):09d}",
    }


def demo_roster() -> list[dict]:
    rng = random.Random(3101)
    people = []
    for i, (name, gender, desig, dept, school, courses) in enumerate(_FACULTY):
        people.append({
            "id": f"FAC{1001 + i}", "kind": "Faculty", "name": name, "gender": gender, "designation": desig,
            "department": dept, "school": school, "email": _email(name), "extension": f"{2101 + i}",
            "office": f"{_BUILDINGS[school]} {rng.randint(2, 6)}{rng.randint(1, 30):02d}",
            "officeHours": _HOURS[i % len(_HOURS)], "courses": courses, "portalRole": "Faculty",
            **_personal(rng, (32, 62)),
        })
    for i, (name, gender, desig, block, floors, shift) in enumerate(_WARDENS):
        people.append({
            "id": f"WDN{101 + i}", "kind": "Warden", "name": name, "gender": gender, "designation": desig,
            "department": "Hostel Administration", "block": block, "floors": floors, "shift": shift,
            "email": _email(name), "office": f"Block {block} Warden Office ({block}-00{1 + i % 3})",
            "dutyPhone": f"+91 416 220 {3101 + i}", "extension": f"{3101 + i}", "portalRole": "HostelAdmin",
            **_personal(rng, (35, 58)),
        })
    for i, (name, gender, desig, dept, role, shift) in enumerate(_STAFF):
        person = {
            "id": f"STF{2001 + i}", "kind": "Staff", "name": name, "gender": gender, "designation": desig,
            "department": dept, "shift": shift, "email": _email(name), "extension": f"{4101 + i}",
            "office": dept if dept not in ("Maintenance", "Security") else f"{dept} Desk, Service Block",
            **_personal(rng, (24, 58)),
        }
        if role:
            person["portalRole"] = role
        people.append(person)
    return people
