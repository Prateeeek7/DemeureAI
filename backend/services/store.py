"""Document store with two interchangeable backends.

* SQLiteStore  - durable local storage, used when AWS credentials are absent.
* DynamoStore  - one DynamoDB table per collection (``demeure-<collection>``).

Every document is a JSON-compatible dict with a string ``id``.
"""
import decimal
import json
import os
import sqlite3
import threading
from datetime import datetime, timezone
from typing import Any, Callable, Optional, Protocol

LogFn = Callable[[str, str, str, str], None]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Store(Protocol):
    backend: str

    def list(self, collection: str) -> list[dict]: ...
    def get(self, collection: str, doc_id: str) -> Optional[dict]: ...
    def put(self, collection: str, doc: dict) -> dict: ...
    def delete(self, collection: str, doc_id: str) -> bool: ...


def _sort_newest_first(docs: list[dict]) -> list[dict]:
    return sorted(docs, key=lambda d: d.get("createdAt", ""), reverse=True)


class SQLiteStore:
    backend = "sqlite"

    def __init__(self, db_path: str, log: Optional[LogFn] = None):
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS documents ("
            " collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,"
            " PRIMARY KEY (collection, id))"
        )
        self._conn.commit()
        self._lock = threading.Lock()
        self._log = log or (lambda *a: None)

    def list(self, collection: str) -> list[dict]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT data FROM documents WHERE collection = ?", (collection,)
            ).fetchall()
        return _sort_newest_first([json.loads(r[0]) for r in rows])

    def get(self, collection: str, doc_id: str) -> Optional[dict]:
        with self._lock:
            row = self._conn.execute(
                "SELECT data FROM documents WHERE collection = ? AND id = ?", (collection, doc_id)
            ).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, collection: str, doc: dict) -> dict:
        doc.setdefault("createdAt", now_iso())
        with self._lock:
            self._conn.execute(
                "INSERT OR REPLACE INTO documents (collection, id, data) VALUES (?, ?, ?)",
                (collection, doc["id"], json.dumps(doc)),
            )
            self._conn.commit()
        if not collection.startswith("_"):
            self._log("DynamoDB", f"PutItem: {collection}", "MOCK", f"Saved {doc['id']} to local SQLite store")
        return doc

    def delete(self, collection: str, doc_id: str) -> bool:
        with self._lock:
            cur = self._conn.execute(
                "DELETE FROM documents WHERE collection = ? AND id = ?", (collection, doc_id)
            )
            self._conn.commit()
        self._log("DynamoDB", f"DeleteItem: {collection}", "MOCK", f"Deleted {doc_id} from local SQLite store")
        return cur.rowcount > 0


def _to_dynamo(value: Any) -> Any:
    if isinstance(value, float):
        return decimal.Decimal(str(value))
    if isinstance(value, dict):
        return {k: _to_dynamo(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [_to_dynamo(v) for v in value]
    return value


def _from_dynamo(value: Any) -> Any:
    if isinstance(value, decimal.Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: _from_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_from_dynamo(v) for v in value]
    return value


class DynamoStore:
    backend = "dynamodb"
    # The billing table predates this store and is keyed by "billingId".
    KEY_OVERRIDES = {"billing": "billingId"}

    def __init__(self, resource: Any, log: LogFn, table_prefix: str = "demeure-"):
        self._db = resource
        self._log = log
        self._prefix = table_prefix
        self._ready: set[str] = set()
        self._lock = threading.Lock()

    def _key(self, collection: str) -> str:
        return self.KEY_OVERRIDES.get(collection, "id")

    def _table(self, collection: str):
        name = f"{self._prefix}{collection}"
        table = self._db.Table(name)
        with self._lock:
            if name in self._ready:
                return table
            from botocore.exceptions import ClientError
            try:
                table.load()
            except ClientError as e:
                if e.response["Error"]["Code"] != "ResourceNotFoundException":
                    raise
                self._log("DynamoDB", f"CreateTable: {name}", "PENDING", "Table not found. Creating...")
                key = self._key(collection)
                table = self._db.create_table(
                    TableName=name,
                    KeySchema=[{"AttributeName": key, "KeyType": "HASH"}],
                    AttributeDefinitions=[{"AttributeName": key, "AttributeType": "S"}],
                    BillingMode="PAY_PER_REQUEST",
                )
                table.wait_until_exists()
                self._log("DynamoDB", f"CreateTable: {name}", "SUCCESS", f"Created with key {key}")
            self._ready.add(name)
            return table

    def _decode(self, collection: str, item: dict) -> dict:
        doc = _from_dynamo(item)
        key = self._key(collection)
        if key != "id":
            doc["id"] = doc.pop(key)
        return doc

    def list(self, collection: str) -> list[dict]:
        table = self._table(collection)
        items, kwargs = [], {}
        while True:
            resp = table.scan(**kwargs)
            items.extend(resp.get("Items", []))
            if "LastEvaluatedKey" not in resp:
                break
            kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        return _sort_newest_first([self._decode(collection, i) for i in items])

    def get(self, collection: str, doc_id: str) -> Optional[dict]:
        resp = self._table(collection).get_item(Key={self._key(collection): doc_id})
        item = resp.get("Item")
        return self._decode(collection, item) if item else None

    def put(self, collection: str, doc: dict) -> dict:
        doc.setdefault("createdAt", now_iso())
        item = _to_dynamo(dict(doc))
        key = self._key(collection)
        if key != "id":
            item[key] = item.pop("id")
        try:
            self._table(collection).put_item(Item=item)
        except Exception as e:
            self._log("DynamoDB", f"PutItem: {collection}", "FAILED", str(e))
            raise
        if not collection.startswith("_"):
            self._log("DynamoDB", f"PutItem: {collection}", "SUCCESS", f"Saved {doc['id']}")
        return doc

    def delete(self, collection: str, doc_id: str) -> bool:
        resp = self._table(collection).delete_item(
            Key={self._key(collection): doc_id}, ReturnValues="ALL_OLD"
        )
        self._log("DynamoDB", f"DeleteItem: {collection}", "SUCCESS", f"Deleted {doc_id}")
        return "Attributes" in resp
