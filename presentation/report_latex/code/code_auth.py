    # --- tokens ------------------------------------------------------------
    def issue_token(self, user: SessionUser) -> str:
        payload = {**user.public(), "exp": int(time.time()) + self._ttl}
        body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        sig = _b64(hmac.new(self._key, body.encode("ascii"), hashlib.sha256).digest())
        return f"{body}.{sig}"

    def verify_token(self, token: str) -> Optional[SessionUser]:
        try:
            body, sig = token.split(".", 1)
            expected = _b64(hmac.new(self._key, body.encode("ascii"), hashlib.sha256).digest())
            if not hmac.compare_digest(sig, expected):
                return None
            payload = json.loads(_unb64(body))
            if int(payload.pop("exp", 0)) < time.time():
                return None
            if payload.get("role") not in ROLES:
                return None
            return SessionUser(**payload)
        except (ValueError, TypeError, json.JSONDecodeError):
            return None
