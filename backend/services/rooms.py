"""Hostel floor layout and bed assignment, shared by the demo seed and resident onboarding.

Each block (A, B, C) has 5 floors of 10 rooms. Room ids are <block><floor><room>, e.g. "A110";
labels are "A-110". Blocks A and B are single-gender; Block C (PG scholars) is mixed, but no
single room ever mixes genders.
"""
import re
from typing import Optional

ROOM_TYPES = ["Double", "Single", "Double", "Suite", "Double", "Single", "Double", "Suite", "Single", "Double"]
CAPACITY = {"Single": 1, "Double": 2, "Suite": 4}
MAINTENANCE_ROOM = 5  # out of service on even floors
BLOCK_GENDER = {"A": "Male", "B": "Female"}
_ROOM_ID = re.compile(r"^([A-C])([1-5])(10|[1-9])$")
UNKNOWN = "?"  # an occupant without a resident record (allocated by name only)

Key = tuple[str, int, int]


def room_id(block: str, floor: int, n: int) -> str:
    return f"{block}{floor}{n}"


def room_label(block: str, floor: int, n: int) -> str:
    return f"{block}-{floor}{n:02d}"


def parse_room(rid: str) -> Optional[Key]:
    m = _ROOM_ID.match(rid or "")
    return (m.group(1), int(m.group(2)), int(m.group(3))) if m else None


_ROOM_LABEL = re.compile(r"^([A-C])-?([1-5])(0[1-9]|10)$")


def parse_room_text(text: str) -> Optional[Key]:
    """Accepts a label as people write it ("B-204", "b204") or an internal id ("B24", "A110")."""
    t = (text or "").strip().upper()
    m = _ROOM_LABEL.match(t)
    if m:
        return m.group(1), int(m.group(2)), int(m.group(3))
    return parse_room(t)


def in_service(key: Key) -> bool:
    return not (key[1] % 2 == 0 and key[2] == MAINTENANCE_ROOM)


def capacity(key: Key) -> int:
    return CAPACITY[ROOM_TYPES[key[2] - 1]]


def block_allows(block: str, gender: str) -> bool:
    required = BLOCK_GENDER.get(block)
    return required is None or required == gender


class Hostel:
    """Occupancy of every bed, built from the stored allocations."""

    def __init__(self, allocations: Optional[dict[str, list[str]]] = None, genders: Optional[dict[str, str]] = None):
        genders = genders or {}
        self.rooms: dict[Key, list[tuple[str, str]]] = {}
        for rid, names in (allocations or {}).items():
            key = parse_room(rid)
            if key:
                self.rooms[key] = [(n, genders.get(n, UNKNOWN)) for n in names]
        self.changed: set[Key] = set()

    def occupants(self, key: Key) -> list[tuple[str, str]]:
        return self.rooms.get(key, [])

    def problem(self, key: Key, gender: str) -> Optional[str]:
        """Why a resident of ``gender`` cannot take a bed in ``key`` (None if they can)."""
        if not in_service(key):
            return "Room is under maintenance"
        if not block_allows(key[0], gender):
            return f"Block {key[0]} is reserved for {BLOCK_GENDER[key[0]].lower()} residents"
        occ = self.occupants(key)
        if len(occ) >= capacity(key):
            return "Room is already full"
        if any(g not in (gender, UNKNOWN) for _, g in occ):
            return "Room is occupied by residents of another gender"
        return None

    def place(self, name: str, gender: str, block: str, floor: int = 1, room_type: str = "", fixed: Optional[Key] = None) -> Key:
        if fixed:
            err = self.problem(fixed, gender)
            if err:
                raise ValueError(err)
            key = fixed
        else:
            floors = sorted(range(1, 6), key=lambda f: (abs(f - floor), f))
            order = [(f, t) for f in floors for t in ((room_type, None) if room_type else (None,))]
            # Rooms holding anyone without a resident record are skipped: their gender is unknown.
            key = next(((block, f, n) for f, t in order for n in range(1, 11)
                        if (t is None or ROOM_TYPES[n - 1] == t) and self.problem((block, f, n), gender) is None
                        and all(g != UNKNOWN for _, g in self.occupants((block, f, n)))), None)
            if key is None:
                raise ValueError(f"No free bed for a {gender.lower()} resident in Block {block}")
        self.rooms.setdefault(key, []).append((name, gender))
        self.changed.add(key)
        return key

    def remove(self, name: str, key: Key) -> None:
        self.rooms[key] = [(n, g) for n, g in self.occupants(key) if n != name]
        self.changed.add(key)

    def allocation_docs(self, only_changed: bool = False) -> list[dict]:
        keys = self.changed if only_changed else [k for k, v in self.rooms.items() if v]
        return [{"id": room_id(*k), "occupants": [n for n, _ in self.rooms.get(k, [])], "maxOccupants": capacity(k)}
                for k in keys]
