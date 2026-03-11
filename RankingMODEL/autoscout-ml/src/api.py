#!/usr/bin/env python3
"""
CARMA Vehicle API  ·  v5
========================

Key changes over v4:
    - Hard SQL filters now use normalised columns (body_type_norm,
      transmission_norm, fuel_type_norm) so cross-source matching works.
      Body type and transmission NEVER drop from the query.
      Fuel type is the only soft SQL filter (one fallback level).
    - Candidate pool increased 100 → 400 for popular models so we
      don't miss deals that lay outside the random first-100.
    - Mileage similarity is now directional: fewer km than target
      incurs half the penalty of more km than target.
    - Price tolerance scales with price level (expensive cars can
      show a wider absolute range and still be comparable).
    - Deal score is computed from a within-pool log-price regression
      (log(price) ~ year + log(mileage)) — no extra DB query.
      A positive residual means the candidate is underpriced for its
      age and mileage relative to the rest of the pool.
    - model_generation_id same-gen bonus (+10% on similarity).
    - is_private_seller surfaced in payload for display.
    - 10-second hard budget: SQL timeout 7s, total target <10s.
"""

from __future__ import annotations

import json
import logging
import math
import os
import threading
import time
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import psycopg2
import psycopg2.pool
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from psycopg2.extras import RealDictCursor

# ---------------------------------------------------------------------------
# Env / logging
# ---------------------------------------------------------------------------

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

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


_cache = TTLCache()

STATS_TTL       = 300    # 5 min
COMPARABLES_TTL = 3600   # 1 hr

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
# Normalisation helpers
# ---------------------------------------------------------------------------

NUMERIC_PRICE_SQL = (
    "CAST(NULLIF(REGEXP_REPLACE(price, '[^0-9]', '', 'g'), '') AS DOUBLE PRECISION)"
)
NUMERIC_MILEAGE_SQL = (
    "CAST(NULLIF(REGEXP_REPLACE(COALESCE(CAST(mileage_km AS TEXT), ''), "
    "'[^0-9]', '', 'g'), '') AS DOUBLE PRECISION)"
)


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


def parse_images(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(i) for i in raw if i]
    if isinstance(raw, str):
        try:
            decoded = json.loads(raw)
            if isinstance(decoded, list):
                return [str(i) for i in decoded if i]
        except json.JSONDecodeError:
            pass
    return []


def format_vehicle_payload(row: Dict[str, Any]) -> Dict[str, Any]:
    price   = normalise_price(row.get("price_num")) or normalise_price(row.get("price"))
    mileage = normalise_mileage(row.get("mileage_num")) or normalise_mileage(row.get("mileage_km"))
    year    = extract_year(row.get("first_registration_raw"))

    return {
        "id":                     row.get("id") or row.get("vehicle_id"),
        "url":                    row.get("listing_url"),
        "price_eur":              float(price) if price is not None else None,
        "price_raw":              row.get("price"),
        "mileage_km":             float(mileage) if mileage is not None else None,
        "mileage_raw":            row.get("mileage_km"),
        "year":                   year,
        "make":                   row.get("make"),
        "model":                  row.get("model"),
        "fuel_group":             row.get("fuel_type"),
        "fuel_type_norm":         row.get("fuel_type_norm"),
        "transmission_group":     row.get("transmission"),
        "transmission_norm":      row.get("transmission_norm"),
        "body_group":             row.get("body_type"),
        "body_type_norm":         row.get("body_type_norm"),
        "color":                  row.get("color"),
        "color_norm":             row.get("color_norm"),
        "interior_color":         row.get("interior_color"),
        "upholstery_color":       row.get("upholstery_color"),
        "description":            row.get("description") or "",
        "data_source":            row.get("data_source"),
        "power_kw":               float(row["power_kw"]) if row.get("power_kw") is not None else None,
        "images":                 parse_images(row.get("images")),
        "first_registration_raw": row.get("first_registration_raw"),
        "created_at":             row.get("created_at"),
        "generation_id":          row.get("model_generation_id"),
        "is_private_seller":      row.get("is_private_seller"),
        "seller_name":            row.get("seller_name"),
        "condition":              row.get("condition"),
        "previous_owners":        row.get("previous_owners"),
    }


# ---------------------------------------------------------------------------
# Deal score: within-pool log-price regression
# ---------------------------------------------------------------------------

def compute_pool_regression(
    candidates: List[Dict[str, Any]],
) -> Optional[np.ndarray]:
    """
    Fit log(price) ~ intercept + year + log(mileage + 1) on the candidate pool.
    Returns coefficient array [intercept, year_coeff, log_mileage_coeff]
    or None if fewer than 6 candidates have valid data.
    """
    valid = [
        (c["price_eur"], c["year"], c["mileage_km"])
        for c in candidates
        if c.get("price_eur") and c.get("year") and c.get("mileage_km")
        and c["price_eur"] > 0 and c["mileage_km"] >= 0
    ]
    if len(valid) < 6:
        return None

    try:
        log_prices    = np.array([math.log(v[0]) for v in valid])
        years         = np.array([float(v[1])     for v in valid])
        log_mileages  = np.array([math.log(v[2] + 1) for v in valid])
        X = np.column_stack([np.ones(len(valid)), years, log_mileages])
        coeffs, _, _, _ = np.linalg.lstsq(X, log_prices, rcond=None)
        return coeffs
    except Exception as exc:
        logger.warning("Pool regression failed: %s", exc)
        return None


def deal_score_from_regression(
    vehicle: Dict[str, Any], coeffs: Optional[np.ndarray]
) -> float:
    """
    Returns a 0–1 deal score.
    0.5 = fair value  |  1.0 = heavily underpriced  |  0.0 = heavily overpriced
    A log-residual of ±0.3 (≈30% price difference) maps to score ≈ 1.0 or 0.0.
    """
    if coeffs is None:
        return 0.5
    price   = vehicle.get("price_eur")
    year    = vehicle.get("year")
    mileage = vehicle.get("mileage_km")
    if not price or not year or mileage is None or price <= 0:
        return 0.5

    try:
        log_price_actual   = math.log(price)
        log_price_expected = (
            coeffs[0]
            + coeffs[1] * float(year)
            + coeffs[2] * math.log(mileage + 1)
        )
        # Positive residual = actual cheaper than expected = good deal
        residual = log_price_expected - log_price_actual
        # Scale: residual of 0.3 → score 1.0; residual of -0.3 → score 0.0
        return float(max(0.0, min(1.0, 0.5 + residual / 0.6)))
    except Exception:
        return 0.5


# ---------------------------------------------------------------------------
# Similarity engine
# ---------------------------------------------------------------------------

def _year_similarity(a: Optional[float], b: Optional[float]) -> float:
    """−0.2 per year difference, 0.0 at 5+ years apart."""
    if a is None or b is None:
        return 0.5
    return max(0.0, 1.0 - abs(a - b) * 0.2)


def _mileage_similarity_directional(
    target_km: Optional[float], candidate_km: Optional[float]
) -> float:
    """
    Lower-mileage candidates get half the penalty of higher-mileage ones.
    Target 90k: candidate 50k → score 0.78, candidate 130k → score 0.56.
    """
    if target_km is None or candidate_km is None or target_km <= 0:
        return 0.5
    diff = candidate_km - target_km
    if diff > 0:
        penalty = diff / target_km          # more km than target — full penalty
    else:
        penalty = abs(diff) / target_km * 0.5  # fewer km — half penalty
    return max(0.0, 1.0 - penalty)


def _power_similarity(a: Optional[float], b: Optional[float]) -> float:
    """±25% of target power = zero similarity."""
    if a is None or b is None or a <= 0 or b <= 0:
        return 0.5
    return max(0.0, 1.0 - abs(a - b) / (a * 0.25))


def _price_tolerance(price_eur: Optional[float]) -> float:
    """
    Dynamic price tolerance: cheap cars accept a wider % spread.
    €10k → 40%,  €30k → 35%,  €60k → 28%,  €100k+ → 20%.
    """
    if not price_eur or price_eur <= 0:
        return 0.35
    return max(0.20, 0.40 - price_eur / 333_000)


def score_similarity(
    target: Dict[str, Any],
    candidate: Dict[str, Any],
) -> Tuple[float, Dict[str, float]]:
    """
    Returns (similarity_score 0–1, components dict).
    Weights: year 40%, mileage 35%, power 15%, fuel_match 10%.
    Bonus: +0.08 if same model_generation_id (capped at 1.0).
    """
    fuel_match = (
        1.0 if (
            target.get("fuel_type_norm")
            and target["fuel_type_norm"] == candidate.get("fuel_type_norm")
        )
        else 0.0 if (
            target.get("fuel_type_norm") and candidate.get("fuel_type_norm")
        )
        else 0.5   # one or both unknown — neutral
    )

    components = {
        "year":    _year_similarity(
            float(target["year"]) if target.get("year") else None,
            float(candidate["year"]) if candidate.get("year") else None,
        ),
        "mileage": _mileage_similarity_directional(
            target.get("mileage_km"), candidate.get("mileage_km")
        ),
        "power":   _power_similarity(
            target.get("power_kw"), candidate.get("power_kw")
        ),
        "fuel":    fuel_match,
    }

    weights = {"year": 0.40, "mileage": 0.35, "power": 0.15, "fuel": 0.10}
    score = sum(weights[k] * components[k] for k in weights)

    # Same-generation bonus (autoscout24 only, ~70% coverage)
    gen_t = target.get("generation_id")
    gen_c = candidate.get("generation_id")
    same_gen = bool(gen_t and gen_c and gen_t == gen_c)
    if same_gen:
        score = min(1.0, score + 0.08)

    components["same_generation"] = 1.0 if same_gen else 0.0
    return score, components


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

SELECT_BASE_FIELDS = f"""
    vehicle_id,
    listing_url,
    price,
    mileage_km,
    first_registration_raw,
    make,
    model,
    fuel_type,
    fuel_type_norm,
    transmission,
    transmission_norm,
    body_type,
    body_type_norm,
    description,
    data_source,
    power_kw,
    images,
    color,
    color_norm,
    interior_color,
    upholstery_color,
    created_at,
    model_generation_id,
    is_private_seller,
    seller_name,
    condition,
    previous_owners,
    {NUMERIC_PRICE_SQL}   AS price_num,
    {NUMERIC_MILEAGE_SQL} AS mileage_num
"""

# Lean fields for candidate ranking — no TOAST columns
SELECT_RANK_FIELDS = f"""
    vehicle_id,
    listing_url,
    price,
    mileage_km,
    first_registration_raw,
    make,
    model,
    fuel_type,
    fuel_type_norm,
    transmission,
    transmission_norm,
    body_type,
    body_type_norm,
    data_source,
    power_kw,
    color,
    color_norm,
    interior_color,
    model_generation_id,
    is_private_seller,
    seller_name,
    condition,
    previous_owners,
    {NUMERIC_PRICE_SQL}   AS price_num,
    {NUMERIC_MILEAGE_SQL} AS mileage_num
"""


def fetch_vehicle(vehicle_id: str) -> Optional[Dict[str, Any]]:
    with get_db_cursor() as cur:
        cur.execute(
            f"""
            SELECT {SELECT_BASE_FIELDS}
            FROM vehicle_marketplace.vehicle_data
            WHERE vehicle_id = %s
              AND is_vehicle_available = true
            LIMIT 1
            """,
            (vehicle_id,),
        )
        return cur.fetchone()


def fetch_vehicles_detail(vehicle_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """Fetch TOAST-heavy display fields for the top-N results only."""
    if not vehicle_ids:
        return {}
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT vehicle_id, description, images, upholstery_color, created_at
            FROM vehicle_marketplace.vehicle_data
            WHERE vehicle_id = ANY(%s)
            """,
            (vehicle_ids,),
        )
        rows = cur.fetchall()
    return {r["vehicle_id"]: r for r in rows}


def find_candidate_rows(
    target_row: Dict[str, Any],
    filters: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], str]:
    """
    Fetch up to CANDIDATE_LIMIT rows for scoring.

    Hard SQL filters (never dropped): make, model, body_type_norm, transmission_norm
    Soft SQL filter (one fallback):   fuel_type_norm
    Optional user filters: colors, interior_colors, year_from, year_until,
                           mileage_from, mileage_until

    Returns (rows, attempt_name_used).
    """
    candidate_limit = int(os.getenv("CANDIDATE_LIMIT", "400"))
    filters = filters or {}

    make        = target_row.get("make")
    model       = target_row.get("model")
    body_norm   = target_row.get("body_type_norm")
    trans_norm  = target_row.get("transmission_norm")
    fuel_norm   = target_row.get("fuel_type_norm")
    vehicle_id  = target_row.get("vehicle_id")

    # Build optional filter clauses from user-supplied params
    extra_clauses: List[str] = []
    extra_params: List[Any] = []

    colors = filters.get("colors")  # list of color_norm values e.g. ["black","white"]
    if colors:
        placeholders = ",".join(["%s"] * len(colors))
        extra_clauses.append(f"color_norm IN ({placeholders})")
        extra_params.extend(colors)

    interior_colors = filters.get("interior_colors")
    if interior_colors:
        placeholders = ",".join(["%s"] * len(interior_colors))
        extra_clauses.append(f"LOWER(interior_color) IN ({placeholders})")
        extra_params.extend([c.lower() for c in interior_colors])

    year_from = filters.get("year_from")
    if year_from:
        extra_clauses.append("year_extracted >= %s")
        extra_params.append(int(year_from))

    year_until = filters.get("year_until")
    if year_until:
        extra_clauses.append("year_extracted <= %s")
        extra_params.append(int(year_until))

    mileage_from = filters.get("mileage_from")
    if mileage_from is not None:
        extra_clauses.append(f"({NUMERIC_MILEAGE_SQL}) >= %s")
        extra_params.append(float(mileage_from))

    mileage_until = filters.get("mileage_until")
    if mileage_until is not None:
        extra_clauses.append(f"({NUMERIC_MILEAGE_SQL}) <= %s")
        extra_params.append(float(mileage_until))

    extra_sql = (" AND " + " AND ".join(extra_clauses)) if extra_clauses else ""

    # Build attempt list.  Body + transmission are ALWAYS in the WHERE clause.
    # If we don't have normalised values for them we fall back to make+model only
    # but that's a last resort (rare cars / missing scraper data).
    if body_norm and trans_norm:
        attempts = []
        if fuel_norm:
            attempts.append((
                "strict",
                "make = %s AND model = %s AND body_type_norm = %s "
                "AND transmission_norm = %s AND fuel_type_norm = %s",
                [make, model, body_norm, trans_norm, fuel_norm],
            ))
        attempts.append((
            "no_fuel",
            "make = %s AND model = %s AND body_type_norm = %s AND transmission_norm = %s",
            [make, model, body_norm, trans_norm],
        ))
    else:
        attempts = [(
            "make_model_only",
            "make = %s AND model = %s",
            [make, model],
        )]

    for attempt_name, where_extra, params in attempts:
        where = f"is_vehicle_available = true AND vehicle_id != %s AND {where_extra}{extra_sql}"
        full_params = [vehicle_id] + params + extra_params

        try:
            with get_db_cursor(timeout_ms=7_000) as cur:
                t0 = time.time()
                cur.execute(
                    f"""
                    SELECT {SELECT_RANK_FIELDS}
                    FROM vehicle_marketplace.vehicle_data
                    WHERE {where}
                    LIMIT %s
                    """,
                    (*full_params, candidate_limit),
                )
                rows = cur.fetchall()
                logger.info(
                    "Candidates [%s] → %d rows in %.3fs",
                    attempt_name, len(rows), time.time() - t0,
                )
        except Exception as exc:
            logger.warning("Candidate query [%s] failed: %s", attempt_name, exc)
            rows = []

        if rows:
            return list(rows), attempt_name

    return [], "no_results"


def deduplicate_candidates(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove near-duplicate listings: same car scraped multiple times.
    Keeps the first occurrence when (year, mileage_km_rounded, price_num_rounded) match.
    """
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for row in candidates:
        price   = normalise_price(row.get("price_num")) or normalise_price(row.get("price"))
        mileage = normalise_mileage(row.get("mileage_num")) or normalise_mileage(row.get("mileage_km"))
        year    = extract_year(row.get("first_registration_raw"))
        # Round to nearest 100 for price and 500 for mileage to catch near-dupes
        key = (
            year,
            round(price / 100) if price else None,
            round(mileage / 500) if mileage else None,
        )
        if key not in seen:
            seen.add(key)
            out.append(row)
    return out


def _dedup_key(price: Optional[float], mileage: Optional[float], year: Optional[int]):
    return (
        year,
        round(price / 100) if price else None,
        round(mileage / 500) if mileage else None,
    )


def score_and_rank(
    target_payload: Dict[str, Any],
    candidates_raw: List[Dict[str, Any]],
    target_price: Optional[float],
) -> List[Dict[str, Any]]:
    """
    Score all candidates, integrate deal score, return sorted list.
    Final score = 0.65 × similarity + 0.35 × deal_score.
    """
    # Deduplicate before scoring
    candidates_raw = deduplicate_candidates(candidates_raw)

    # Also remove any candidate that is a near-duplicate of the target itself
    # (same car scraped twice: same year/price/mileage but different UUID)
    target_key = _dedup_key(
        target_payload.get("price_eur"),
        target_payload.get("mileage_km"),
        target_payload.get("year"),
    )
    if target_key != (None, None, None):
        before = len(candidates_raw)
        candidates_raw = [
            c for c in candidates_raw
            if _dedup_key(
                normalise_price(c.get("price_num")) or normalise_price(c.get("price_eur")),
                normalise_mileage(c.get("mileage_num")) or normalise_mileage(c.get("mileage_km")),
                extract_year(c.get("first_registration_raw")),
            ) != target_key
        ]
        removed = before - len(candidates_raw)
        if removed:
            logger.info("Filtered %d target-duplicate listings", removed)

    # Build payloads first (needed for regression input)
    payloads: List[Dict[str, Any]] = []
    for row in candidates_raw:
        p = format_vehicle_payload(
            {**row, "vehicle_id": row.get("id") or row.get("vehicle_id")}
        )
        payloads.append(p)

    # Fit within-pool price regression
    coeffs = compute_pool_regression(payloads)

    scored: List[Tuple[float, Dict[str, Any]]] = []

    for p in payloads:
        sim_score, components = score_similarity(target_payload, p)
        d_score = deal_score_from_regression(p, coeffs)

        final = 0.65 * sim_score + 0.35 * d_score

        candidate_price = p.get("price_eur")
        savings = (
            float(target_price - candidate_price)
            if target_price and candidate_price else 0.0
        )
        savings_pct = (
            savings / target_price * 100
            if target_price and target_price > 0 else None
        )

        p.update({
            "score":           final,
            "final_score":     final,
            "similarity_score": sim_score,
            "deal_score":      d_score,
            "savings":         savings,
            "savings_percent": savings_pct,
            "ranking_details": {
                "similarity_components": components,
                "weights": {"similarity": 0.65, "deal": 0.35},
                "attempt": None,  # filled in by caller
            },
        })
        scored.append((final, p))

    scored.sort(key=lambda e: e[0], reverse=True)
    return [p for _, p in scored]


# ---------------------------------------------------------------------------
# Flask endpoints
# ---------------------------------------------------------------------------

@app.before_request
def _bootstrap_once():
    ensure_indexes()


@app.route("/health", methods=["GET"])
def health():
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT reltuples::bigint AS vehicle_count
                FROM pg_class
                JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
                WHERE nspname = 'vehicle_marketplace'
                  AND relname = 'vehicle_data'
            """)
            result = cur.fetchone()
        return jsonify({
            "status":             "healthy",
            "database_connected": True,
            "vehicle_count":      result["vehicle_count"] if result else 0,
            "timestamp":          datetime.utcnow().isoformat(),
        }), 200
    except Exception as exc:
        logger.exception("Health check failed: %s", exc)
        return jsonify({"status": "unhealthy", "database_connected": False, "error": str(exc)}), 503


@app.route("/stats", methods=["GET"])
def stats():
    cached = _cache.get("stats")
    if cached:
        return jsonify(cached), 200

    try:
        with get_db_cursor(timeout_ms=5_000) as cur:
            cur.execute("""
                SELECT reltuples::bigint AS total_vehicles
                FROM pg_class
                JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
                WHERE nspname = 'vehicle_marketplace'
                  AND relname = 'vehicle_data'
            """)
            row = cur.fetchone()

        result = {
            "total_vehicles": int(row["total_vehicles"]) if row and row["total_vehicles"] else 0,
            "unique_makes":   50,
            "data_sources":   3,
            "timestamp":      datetime.utcnow().isoformat(),
        }
        _cache.set("stats", result, STATS_TTL)
        return jsonify(result), 200
    except Exception as exc:
        logger.exception("Stats failed: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/listings/<vehicle_id>", methods=["GET"])
def get_vehicle_endpoint(vehicle_id: str):
    row = fetch_vehicle(vehicle_id)
    if not row:
        return jsonify({"error": f"Vehicle {vehicle_id} not found"}), 404
    return jsonify(format_vehicle_payload({**row, "vehicle_id": vehicle_id})), 200


@app.route("/listings/<vehicle_id>/comparables", methods=["GET"])
def comparables_endpoint(vehicle_id: str):
    top_param = request.args.get("top", default="10")
    try:
        top = max(1, min(int(top_param), 50))
    except ValueError:
        return jsonify({"error": "Invalid 'top' parameter"}), 400

    # Parse optional pre-search filters
    filters: Dict[str, Any] = {}
    colors_param = request.args.get("colors")
    if colors_param:
        filters["colors"] = [c.strip().lower() for c in colors_param.split(",") if c.strip()]
    interior_colors_param = request.args.get("interior_colors")
    if interior_colors_param:
        filters["interior_colors"] = [c.strip() for c in interior_colors_param.split(",") if c.strip()]
    if request.args.get("year_from"):
        filters["year_from"] = request.args.get("year_from")
    if request.args.get("year_until"):
        filters["year_until"] = request.args.get("year_until")
    if request.args.get("mileage_from"):
        filters["mileage_from"] = request.args.get("mileage_from")
    if request.args.get("mileage_until"):
        filters["mileage_until"] = request.args.get("mileage_until")

    # Cache key includes filters so different filter combos are cached separately.
    # Skip cache entirely when filters are active (user expects fresh results).
    has_filters = bool(filters)
    filter_key = "&".join(f"{k}={v}" for k, v in sorted(filters.items())) if filters else ""
    cache_key = f"comparables_v5b:{vehicle_id}:{top}:{filter_key}"
    if not has_filters:
        cached = _cache.get(cache_key)
        if cached:
            logger.info("Cache hit: %s", cache_key)
            return jsonify(cached), 200

    t_start = time.time()

    target_row = fetch_vehicle(vehicle_id)
    if not target_row:
        return jsonify({"error": f"Vehicle {vehicle_id} not found"}), 404

    target_payload = format_vehicle_payload({**target_row, "vehicle_id": vehicle_id})
    target_price   = target_payload.get("price_eur")

    candidates_raw, attempt_used = find_candidate_rows(target_row, filters)
    if not candidates_raw:
        return jsonify({"error": "No comparable vehicles found"}), 404

    ranked = score_and_rank(target_payload, candidates_raw, target_price)

    # Stamp the attempt used into ranking_details
    for p in ranked:
        p["ranking_details"]["attempt"] = attempt_used

    top_results = ranked[:top]

    # Phase 2: TOAST fetch only for top-N
    top_ids = [p["id"] for p in top_results if p.get("id")]
    if top_ids:
        t_detail = time.time()
        detail_map = fetch_vehicles_detail(top_ids)
        logger.info("Detail fetch %d vehicles: %.3fs", len(top_ids), time.time() - t_detail)
        for p in top_results:
            detail = detail_map.get(p["id"], {})
            p["description"]      = detail.get("description") or ""
            p["images"]           = parse_images(detail.get("images"))
            p["upholstery_color"] = detail.get("upholstery_color")

    total_ms = int((time.time() - t_start) * 1000)
    logger.info("comparables [%s] → top=%d candidates=%d attempt=%s total=%dms",
                vehicle_id, top, len(ranked), attempt_used, total_ms)

    response = {
        "vehicle":     target_payload,
        "comparables": top_results,
        "metadata": {
            "requested_top":    top,
            "returned":         len(top_results),
            "total_candidates": len(ranked),
            "attempt":          attempt_used,
            "elapsed_ms":       total_ms,
        },
    }
    _cache.set(cache_key, response, COMPARABLES_TTL)
    return jsonify(response), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ensure_indexes()
    port = int(os.getenv("PORT", "8000"))
    logger.info("Starting CARMA API v5 on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
