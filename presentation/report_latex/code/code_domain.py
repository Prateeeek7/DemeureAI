# --- Complaint triage ---------------------------------------------------------
# The category with the most keyword hits wins; ties go to the earlier (more
# safety-critical) category, so "water on the socket" is Electrical, not Structural.
_CATEGORY_RULES = [
    ("Electrical", "HIGH", "8 Hours", ("electric", "power", "fuse", "shock", "wire", "light", "fan",
                                       "switch", "socket", "spark")),
    ("Plumbing", "HIGH", "12 Hours", ("water", "leak", "pipe", "clog", "drain", "tap", "flush", "drip")),
    ("Structural", "MEDIUM", "24 Hours", ("ceiling", "crack", "door", "lock", "window", "wall", "bed")),
    ("IT / WiFi", "MEDIUM", "24 Hours", ("wifi", "wi-fi", "router", "internet", "connection", "lan", "network")),
]
_CRITICAL_TERMS = ("socket", "dripping", "fuse board", "fire", "smoke", "spark", "shock", "emergency", "flood", "gas")


def _has(term: str, text: str) -> bool:
    # Terms match at the start of a word ("leak" -> "leaking"), never inside one
    # ("lock" must not match "Block", "lan" must not match "blanket").
    return re.search(r"\b" + re.escape(term), text) is not None


def triage_complaint(text: str) -> dict:
    lower = text.lower()
    result = {"category": "General", "priority": "LOW", "eta": "48 Hours"}
    best_hits = 0
    for category, priority, eta, terms in _CATEGORY_RULES:
        hits = sum(_has(term, lower) for term in terms)
        if hits > best_hits:
            best_hits = hits
            result = {"category": category, "priority": priority, "eta": eta}
    if any(_has(term, lower) for term in _CRITICAL_TERMS):
        result["priority"] = "CRITICAL (IMMEDIATE)"
        result["eta"] = "2 Hours"
    return result


# --- Roommate compatibility ---------------------------------------------------
# Both the allocation form (short codes) and the survey (labels) map onto the
# same 0..2 ordinal scale so the two vocabularies are comparable.
_SCALES = {
    "sleep": {"early": 0, "early riser": 0, "flexible": 1, "night": 2, "night owl": 2},
    "study": {"silent": 0, "absolute silence": 0, "external": 1, "library preferred": 1,
              "ambient": 2, "ambient / music ok": 2},
    "clean": {"strict": 0, "strict / scheduled": 0, "moderate": 1, "moderate / weekends": 1,
              "relaxed": 2, "relaxed / minimal": 2},
    "social": {"quiet": 0, "quiet sanctuary": 0, "moderate": 1, "moderate / occasional": 1,
               "active": 2, "active hub": 2},
}
_WEIGHTS = {"sleep": 0.30, "study": 0.25, "clean": 0.25, "social": 0.20}
_SURVEY_FIELDS = {"sleep": "sleepHabit", "study": "studyEnv", "clean": "cleanliness", "social": "socialPref"}


def _ordinal(dimension: str, value: str):
    return _SCALES[dimension].get((value or "").strip().lower())


def compatibility_score(prefs: dict, survey: dict) -> int:
    """Weighted similarity (0-100) between requested preferences and one survey entry."""
    total, weight_seen = 0.0, 0.0
    for dim, weight in _WEIGHTS.items():
        a = _ordinal(dim, prefs.get(dim, ""))
        b = _ordinal(dim, survey.get(_SURVEY_FIELDS[dim], ""))
        if a is None or b is None:
            continue
        total += weight * (1 - abs(a - b) / 2)
        weight_seen += weight
    return round(100 * total / weight_seen) if weight_seen else 0


# Block A houses men and Block B women; Block C is mixed / PG scholars.
GENDERED_BLOCKS = {"A", "B"}


def rank_roommates(prefs: dict, surveys: list[dict], block: str = "", limit: int = 3) -> list[dict]:
    ranked = []
    if block in GENDERED_BLOCKS:
        # Only residents who chose this single-gender block are eligible roommates there.
        surveys = [s for s in surveys if s.get("preferredBlock") == block]
    for s in surveys:
        score = compatibility_score(prefs, s)
        if block and s.get("preferredBlock") == block:
            score = min(100, score + 5)  # small bonus for wanting the same block
        ranked.append({
            "name": s.get("fullName", "Unknown"),
            "score": score,
            "room": s.get("allocatedRoom") or f"Pref {s.get('preferredBlock', '?')}-{s.get('preferredFloor', '?')}",
            "studentId": s.get("studentId", ""),
        })
    ranked.sort(key=lambda r: r["score"], reverse=True)
    return ranked[:limit]


# --- Gate ledger ----------------------------------------------------------------
GENESIS_HASH = "0" * 64


def ledger_hash(prev_hash: str, entry: dict) -> str:
    """SHA-256 over the previous hash and the entry's canonical fields (a hash chain)."""
    fields = {k: entry[k] for k in ("time", "name", "type", "roomOrPurpose", "status")}
    payload = prev_hash + json.dumps(fields, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def verify_ledger(entries_oldest_first: list[dict]) -> bool:
    prev = GENESIS_HASH
    for entry in entries_oldest_first:
        if entry.get("prevHash") != prev or ledger_hash(prev, entry) != entry.get("hash"):
            return False
        prev = entry["hash"]
    return True
