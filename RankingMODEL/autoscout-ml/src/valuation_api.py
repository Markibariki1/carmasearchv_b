#!/usr/bin/env python3
"""
CARMA Valuation API  ·  v1
===========================
Standalone service for market value estimation.
Accuracy over speed — 15-30s response times are acceptable.
"""

from __future__ import annotations

import logging
import math
import os
import time
from datetime import datetime
from typing import Optional

import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

from src.shared import (
    NUMERIC_MILEAGE_SQL,
    NUMERIC_PRICE_SQL,
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


@app.before_request
def _bootstrap_once():
    ensure_indexes()


# ---------------------------------------------------------------------------
# Normalisation maps: user-facing values → DB norm values
# ---------------------------------------------------------------------------

_BODY_NORM_MAP = {
    "sedan": "sedan", "limousine": "sedan",
    "suv": "suv", "suv/geländewagen/pickup": "suv",
    "wagon": "wagon", "kombi": "wagon", "combi": "wagon",
    "hatchback": "compact", "compact": "compact", "kleinwagen": "compact",
    "coupe": "coupe", "coupé": "coupe",
    "convertible": "convertible", "cabrio": "convertible", "cabriolet": "convertible",
    "van": "van", "minivan": "van",
    "pickup": "pickup",
}

_TRANS_NORM_MAP = {
    "manual": "manual", "schaltgetriebe": "manual",
    "automatic": "automatic", "automatik": "automatic", "automaat": "automatic",
}

_FUEL_NORM_MAP = {
    "petrol": "petrol", "benzin": "petrol", "benzine": "petrol",
    "diesel": "diesel",
    "electric": "electric", "elektro": "electric", "elektrisch": "electric",
    "hybrid": "hybrid", "elektro/benzin": "hybrid",
    "plugin hybrid": "plugin_hybrid", "plugin_hybrid": "plugin_hybrid",
    "lpg": "lpg",
    "cng": "cng",
}


def _norm_lookup(value: Optional[str], mapping: dict) -> Optional[str]:
    if not value:
        return None
    v = value.lower().strip()
    # Exact match
    if v in mapping:
        return mapping[v]
    # Prefix match for variants like "Automatic (AM-S8)" → "automatic"
    for key, norm in mapping.items():
        if v.startswith(key):
            return norm
    return None


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

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
            "service":            "valuation",
            "database_connected": True,
            "vehicle_count":      result["vehicle_count"] if result else 0,
            "timestamp":          datetime.utcnow().isoformat(),
        }), 200
    except Exception as exc:
        logger.exception("Health check failed: %s", exc)
        return jsonify({
            "status": "unhealthy",
            "service": "valuation",
            "database_connected": False,
            "error": str(exc),
        }), 503


# ---------------------------------------------------------------------------
# Valuation endpoint
# ---------------------------------------------------------------------------

@app.route("/valuation", methods=["POST"])
def valuation_endpoint():
    """
    Estimate market value for a vehicle described by attributes.
    No speed constraint — accuracy over speed.

    Body JSON:
        make (str, required)
        model (str, required)
        year (int, required)
        mileage_km (int, required)
        body_type (str, optional)
        transmission (str, optional)
        fuel_type (str, optional)
        power_kw (float, optional)

    Returns:
        estimated_value, median_price, mean_price, p25, p75,
        min_price, max_price, sample_size, regression_estimate
    """
    body = request.get_json(silent=True) or {}

    make = body.get("make")
    model = body.get("model")
    year = body.get("year")
    mileage_km = body.get("mileage_km", 0)

    if not make or not model or not year:
        return jsonify({"error": "make, model, and year are required"}), 400

    try:
        year = int(year)
        mileage_km = int(mileage_km) if mileage_km else 0
    except (ValueError, TypeError):
        return jsonify({"error": "year and mileage_km must be integers"}), 400

    body_norm = _norm_lookup(body.get("body_type"), _BODY_NORM_MAP)
    trans_norm = _norm_lookup(body.get("transmission"), _TRANS_NORM_MAP)
    fuel_norm = _norm_lookup(body.get("fuel_type"), _FUEL_NORM_MAP)

    # Build query with progressive fallback
    attempts = []

    if body_norm and trans_norm and fuel_norm:
        attempts.append((
            "strict",
            "LOWER(make) = LOWER(%s) AND LOWER(model) = LOWER(%s) AND body_type_norm = %s "
            "AND transmission_norm = %s AND fuel_type_norm = %s",
            [make, model, body_norm, trans_norm, fuel_norm],
        ))

    if body_norm and trans_norm:
        attempts.append((
            "no_fuel",
            "LOWER(make) = LOWER(%s) AND LOWER(model) = LOWER(%s) AND body_type_norm = %s AND transmission_norm = %s",
            [make, model, body_norm, trans_norm],
        ))

    attempts.append((
        "make_model_only",
        "LOWER(make) = LOWER(%s) AND LOWER(model) = LOWER(%s)",
        [make, model],
    ))

    _EMPTY_RESULT = {
        "estimated_value": 0,
        "median_price": 0,
        "mean_price": 0,
        "p25": 0,
        "p75": 0,
        "min_price": 0,
        "max_price": 0,
        "sample_size": 0,
        "regression_estimate": None,
    }

    candidates = []
    attempt_used = "no_results"

    for attempt_name, where_extra, params in attempts:
        where = f"is_vehicle_available = true AND {where_extra}"
        try:
            with get_db_cursor(timeout_ms=30_000) as cur:
                t0 = time.time()
                cur.execute(
                    f"""
                    SELECT
                        {NUMERIC_PRICE_SQL}   AS price_num,
                        {NUMERIC_MILEAGE_SQL} AS mileage_num,
                        first_registration_raw,
                        power_kw,
                        fuel_type_norm,
                        model_generation_id
                    FROM vehicle_marketplace.vehicle_data
                    WHERE {where}
                    LIMIT 2000
                    """,
                    params,
                )
                rows = cur.fetchall()
                logger.info(
                    "Valuation candidates [%s] → %d rows in %.3fs",
                    attempt_name, len(rows), time.time() - t0,
                )
        except Exception as exc:
            logger.warning("Valuation query [%s] failed: %s", attempt_name, exc)
            rows = []

        if rows:
            candidates = rows
            attempt_used = attempt_name
            break

    if not candidates:
        return jsonify({**_EMPTY_RESULT, "attempt": "no_results"}), 200

    # Parse prices and filter to valid, year-similar candidates
    valid_prices = []
    regression_data = []

    for row in candidates:
        p = normalise_price(row.get("price_num"))
        m = normalise_mileage(row.get("mileage_num"))
        y = extract_year(row.get("first_registration_raw"))

        if p is None or p <= 0:
            continue

        # Exclude only when year IS known and outside ±5 range.
        # Unknown year → still include in price stats (just not in regression).
        if y is not None and abs(y - year) > 5:
            continue

        valid_prices.append(p)
        if y is not None and m is not None and m >= 0:
            regression_data.append((p, y, m))

    if not valid_prices:
        return jsonify({**_EMPTY_RESULT, "attempt": attempt_used}), 200

    prices = np.array(valid_prices)
    median_price = float(np.median(prices))
    mean_price = float(np.mean(prices))
    p25 = float(np.percentile(prices, 25))
    p75 = float(np.percentile(prices, 75))
    min_price = float(np.min(prices))
    max_price = float(np.max(prices))

    # Regression estimate for this specific year + mileage
    regression_estimate = None
    if len(regression_data) >= 6:
        try:
            log_prices = np.array([math.log(d[0]) for d in regression_data])
            years_arr = np.array([float(d[1]) for d in regression_data])
            log_miles = np.array([math.log(d[2] + 1) for d in regression_data])
            X = np.column_stack([np.ones(len(regression_data)), years_arr, log_miles])
            coeffs, _, _, _ = np.linalg.lstsq(X, log_prices, rcond=None)
            predicted_log = coeffs[0] + coeffs[1] * float(year) + coeffs[2] * math.log(mileage_km + 1)
            regression_estimate = float(math.exp(predicted_log))
        except Exception as exc:
            logger.warning("Valuation regression failed: %s", exc)

    # Best estimate: prefer regression if available, otherwise median
    estimated_value = regression_estimate if regression_estimate else median_price

    return jsonify({
        "estimated_value": round(estimated_value, 2),
        "median_price": round(median_price, 2),
        "mean_price": round(mean_price, 2),
        "p25": round(p25, 2),
        "p75": round(p75, 2),
        "min_price": round(min_price, 2),
        "max_price": round(max_price, 2),
        "sample_size": len(valid_prices),
        "regression_estimate": round(regression_estimate, 2) if regression_estimate else None,
        "attempt": attempt_used,
    }), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ensure_indexes()
    port = int(os.getenv("PORT", "8001"))
    logger.info("Starting CARMA Valuation API v1 on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=False)
