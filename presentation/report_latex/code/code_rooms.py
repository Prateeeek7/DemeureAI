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
