#!/usr/bin/env python3
"""
CARMA Comparison API  ·  v5
============================
Speed-critical vehicle comparison and ranking service.
Hard budget: <10 seconds total, 7s SQL timeout.

Valuation endpoint has been split into a separate service
(see valuation_api.py).
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from src.shared import (
    NUMERIC_MILEAGE_SQL,
    NUMERIC_PRICE_SQL,
    TTLCache,
    ensure_indexes,
    extract_year,
    get_db_cursor,
    normalise_mileage,
    normalise_price,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

_cache = TTLCache()

STATS_TTL       = 300    # 5 min
COMPARABLES_TTL = 3600   # 1 hr


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
    target_mileage: Optional[float] = None,
) -> Optional[np.ndarray]:
    """
    Fit log(price) ~ intercept + year + log(mileage + 1) on the candidate pool.
    Returns coefficient array [intercept, year_coeff, log_mileage_coeff]
    or None if fewer than 6 candidates have valid data.

    If target_mileage is provided, the regression is fitted only on candidates
    within ±60% of the target's mileage so that high-mileage outliers don't
    distort the fair-price baseline.
    """
    valid = [
        (c["price_eur"], c["year"], c["mileage_km"])
        for c in candidates
        if c.get("price_eur") and c.get("year") and c.get("mileage_km") is not None
        and c["price_eur"] > 0 and c["mileage_km"] >= 0
    ]

    # Filter to mileage-comparable cars for regression to avoid outlier skew
    if target_mileage and target_mileage > 0:
        lo = target_mileage * 0.4
        hi = target_mileage * 1.6
        filtered = [(p, y, m) for p, y, m in valid if lo <= m <= hi]
        # Fall back to full pool only if filtered set is too small
        if len(filtered) >= 6:
            valid = filtered

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

    target_mileage = target_payload.get("mileage_km")

    # Hard mileage cap: candidates with more than 1.6× target mileage are
    # not comparable — they represent a fundamentally different ownership stage.
    if target_mileage and target_mileage > 0:
        before = len(candidates_raw)
        mileage_cap = target_mileage * 1.6
        candidates_raw = [
            c for c in candidates_raw
            if (normalise_mileage(c.get("mileage_num")) or normalise_mileage(c.get("mileage_km")) or 0) <= mileage_cap
        ]
        removed = before - len(candidates_raw)
        if removed:
            logger.info("Mileage cap (%.0fkm) removed %d candidates", mileage_cap, removed)

    # Build payloads first (needed for regression input)
    payloads: List[Dict[str, Any]] = []
    for row in candidates_raw:
        p = format_vehicle_payload(
            {**row, "vehicle_id": row.get("id") or row.get("vehicle_id")}
        )
        payloads.append(p)

    # Fit within-pool price regression (mileage-filtered to avoid outlier skew)
    coeffs = compute_pool_regression(payloads, target_mileage=target_mileage)

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

    # Minimum match threshold: drop candidates below 82% final score
    # unless there aren't enough results (keep at least 5)
    MIN_SCORE = 0.82
    above = [p for _, p in scored if _ >= MIN_SCORE]
    below = [p for _, p in scored if _ < MIN_SCORE]
    if len(above) >= 5:
        return above
    # Not enough high-quality matches — return best available with no cutoff
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
        # Distinguish: vehicle truly missing vs DB connectivity issue
        logger.warning("Vehicle not found: %s", vehicle_id)
        return jsonify({
            "error": "Vehicle not found",
            "detail": "This listing may not have been scraped yet or the URL is incorrect.",
            "vehicle_id": vehicle_id,
        }), 404

    target_payload = format_vehicle_payload({**target_row, "vehicle_id": vehicle_id})
    target_price   = target_payload.get("price_eur")

    candidates_raw, attempt_used = find_candidate_rows(target_row, filters)
    if not candidates_raw:
        # Log exactly why — helps diagnose filtering vs missing data
        logger.warning(
            "No comparables for %s | make=%s model=%s body_norm=%s trans_norm=%s fuel_norm=%s",
            vehicle_id,
            target_row.get("make"), target_row.get("model"),
            target_row.get("body_type_norm"), target_row.get("transmission_norm"),
            target_row.get("fuel_type_norm"),
        )
        return jsonify({
            "error": "No comparable vehicles found",
            "detail": {
                "make":              target_row.get("make"),
                "model":             target_row.get("model"),
                "body_type_norm":    target_row.get("body_type_norm"),
                "transmission_norm": target_row.get("transmission_norm"),
                "fuel_type_norm":    target_row.get("fuel_type_norm"),
                "hint": "Normalized columns may still be NULL (backfill in progress) or no listings match this spec.",
            },
        }), 404

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
    logger.info("Starting CARMA Comparison API v5 on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
