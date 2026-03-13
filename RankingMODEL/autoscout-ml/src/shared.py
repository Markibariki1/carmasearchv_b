"""
CARMA Shared Infrastructure
============================
DB pool, TTL cache, normalisation helpers, SQL constants, and index bootstrap.
Used by both the Comparison API and the Valuation API.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Tuple

import psycopg2
import psycopg2.pool
from dotenv import load_dotenv
from psycopg2.extras import RealDictCursor

load_dotenv()

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TTL cache
# ---------------------------------------------------------------------------


class TTLCache:
    def __init__(self) -> None:
        self._store: Dict[str, Tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, expires_at = entry
            if time.time() > expires_at:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        with self._lock:
            self._store[key] = (value, time.time() + ttl_seconds)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)


# ---------------------------------------------------------------------------
# DB pool
# ---------------------------------------------------------------------------

_connection_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()


def _db_config() -> Dict[str, Any]:
    required = {
        "host":     os.getenv("DATABASE_HOST"),
        "port":     os.getenv("DATABASE_PORT", "5432"),
        "user":     os.getenv("DATABASE_USER"),
        "password": os.getenv("DATABASE_PASSWORD"),
        "dbname":   os.getenv("DATABASE_NAME", "postgres"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise RuntimeError(f"Missing DB env vars: {', '.join(missing)}")
    required["port"] = int(required["port"])
    return required


def get_connection_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _connection_pool
    if _connection_pool and not _connection_pool.closed:
        return _connection_pool

    with _pool_lock:
        if _connection_pool and not _connection_pool.closed:
            return _connection_pool

        cfg = _db_config()
        min_c = int(os.getenv("DB_MIN_CONN", "2"))
        max_c = int(os.getenv("DB_MAX_CONN", "10"))
        logger.info("Pool init host=%s db=%s min=%s max=%s",
                    cfg["host"], cfg["dbname"], min_c, max_c)

        _connection_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=min_c,
            maxconn=max_c,
            connect_timeout=int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
            keepalives=1,
            keepalives_idle=60,
            keepalives_interval=15,
            keepalives_count=5,
            sslmode="require",
            **cfg,
        )
        return _connection_pool


@contextmanager
def get_db_cursor(timeout_ms: int = 7_000):
    pool = get_connection_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SET LOCAL statement_timeout = {timeout_ms}")
            yield cur
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


# ---------------------------------------------------------------------------
# Index bootstrap (non-blocking, once per process)
# ---------------------------------------------------------------------------

_INDEXES_CREATED = False
_INDEX_LOCK = threading.Lock()

_INDEXES: List[Tuple[str, str]] = [
    (
        "idx_vd_norm_strict",
        """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_norm_strict
               ON vehicle_marketplace.vehicle_data
               (make, model, body_type_norm, transmission_norm, fuel_type_norm)
               WHERE is_vehicle_available = true
                 AND body_type_norm IS NOT NULL
                 AND transmission_norm IS NOT NULL""",
    ),
    (
        "idx_vd_norm_no_fuel",
        """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_norm_no_fuel
               ON vehicle_marketplace.vehicle_data
               (make, model, body_type_norm, transmission_norm)
               WHERE is_vehicle_available = true
                 AND body_type_norm IS NOT NULL
                 AND transmission_norm IS NOT NULL""",
    ),
    (
        "idx_vd_make_model_avail",
        """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_make_model_avail
               ON vehicle_marketplace.vehicle_data (make, model)
               WHERE is_vehicle_available = true""",
    ),
    (
        "idx_vd_year_extracted",
        """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_year_extracted
               ON vehicle_marketplace.vehicle_data (year_extracted)
               WHERE is_vehicle_available = true AND year_extracted > 0""",
    ),
    (
        "idx_vd_lower_make_model",
        """CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_lower_make_model
               ON vehicle_marketplace.vehicle_data (LOWER(make), LOWER(model))
               WHERE is_vehicle_available = true""",
    ),
]


def _exec_autocommit(pool, sql: str, label: str) -> bool:
    conn = pool.getconn()
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql)
        logger.info("DDL OK: %s", label)
        return True
    except Exception as exc:
        logger.warning("DDL skip [%s]: %s", label, exc)
        return False
    finally:
        conn.autocommit = False
        pool.putconn(conn)


def ensure_indexes() -> None:
    def _run() -> None:
        global _INDEXES_CREATED
        if _INDEXES_CREATED:
            return
        with _INDEX_LOCK:
            if _INDEXES_CREATED:
                return
            _INDEXES_CREATED = True

        pool = None
        for attempt in range(8):
            try:
                pool = get_connection_pool()
                break
            except Exception as exc:
                wait = min(30, 5 * (attempt + 1))
                logger.warning("Index bootstrap retry %d/8 in %ds: %s", attempt + 1, wait, exc)
                time.sleep(wait)

        if pool is None:
            logger.error("Index bootstrap gave up: DB unreachable")
            return

        for label, stmt in _INDEXES:
            _exec_autocommit(pool, stmt, label)

    threading.Thread(target=_run, daemon=True).start()


# ---------------------------------------------------------------------------
# SQL expression constants
# ---------------------------------------------------------------------------

NUMERIC_PRICE_SQL = (
    "CAST(NULLIF(REGEXP_REPLACE(price, '[^0-9]', '', 'g'), '') AS DOUBLE PRECISION)"
)
NUMERIC_MILEAGE_SQL = (
    "CAST(NULLIF(REGEXP_REPLACE(COALESCE(CAST(mileage_km AS TEXT), ''), "
    "'[^0-9]', '', 'g'), '') AS DOUBLE PRECISION)"
)


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def normalise_price(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return float(digits) if digits else None


def normalise_mileage(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return float(digits) if digits else None


def extract_year(raw: Any) -> Optional[int]:
    if raw is None:
        return None
    text = str(raw)
    for token in text.replace("/", "-").split("-"):
        if token.isdigit() and len(token) == 4:
            return int(token)
    return None


def safe_lower(text: Optional[str]) -> Optional[str]:
    return text.lower().strip() if isinstance(text, str) else None
