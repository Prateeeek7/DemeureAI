def derive_key(secret: str) -> bytes:
    """Development fallback: a data key derived from SECRET_KEY with HKDF-SHA256."""
    return HKDF(algorithm=SHA256(), length=32, salt=b"demeure-ai/pii", info=b"field-encryption-v1").derive(
        secret.encode("utf-8"))


class FieldCipher:
    def __init__(self, key: bytes, key_source: str):
        self._aead = AESGCM(key)
        self.key_source = key_source
        # Short, non-reversible fingerprint so operators can tell which key encrypted the data.
        self.key_id = hashlib.sha256(b"demeure-key-id" + key).hexdigest()[:12]

    @staticmethod
    def is_encrypted(value: object) -> bool:
        return isinstance(value, str) and value.startswith(PREFIX)

    def encrypt(self, plaintext: str, record_id: str, field: str) -> str:
        nonce = os.urandom(12)
        ct = self._aead.encrypt(nonce, plaintext.encode("utf-8"), f"{record_id}|{field}".encode("utf-8"))
        return PREFIX + _b64(nonce + ct)

    def decrypt(self, token: str, record_id: str, field: str) -> str:
        blob = _unb64(token[len(PREFIX):])
        return self._aead.decrypt(blob[:12], blob[12:], f"{record_id}|{field}".encode("utf-8")).decode("utf-8")
