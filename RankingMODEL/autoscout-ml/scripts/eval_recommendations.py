#!/usr/bin/env python3
"""
CARMA Recommendation Evaluator
================================
A local tool to test recommendation quality against real vehicle IDs.

Usage:
    # Test a single vehicle by AutoScout24 URL or vehicle UUID:
    python3 scripts/eval_recommendations.py <url_or_id>

    # Test with custom candidate limit:
    python3 scripts/eval_recommendations.py <url_or_id> --top 20 --candidates 500

    # Run against the live API instead of direct DB:
    python3 scripts/eval_recommendations.py <url_or_id> --api

    # Batch test multiple IDs from a file (one ID/URL per line):
    python3 scripts/eval_recommendations.py --batch ids.txt

Examples:
    python3 scripts/eval_recommendations.py 3f8a1c2e-1234-5678-abcd-ef0123456789
    python3 scripts/eval_recommendations.py https://www.autoscout24.de/angebote/bmw-3er-...-3f8a1c2e-...
"""

import argparse
import json
import math
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional

import numpy as np
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.optimized'))

DB_CONFIG = dict(
    host=os.getenv('DATABASE_HOST', 'carma.postgres.database.azure.com'),
    port=int(os.getenv('DATABASE_PORT', 5432)),
    dbname=os.getenv('DATABASE_NAME', 'postgres'),
    user=os.getenv('DATABASE_USER', 'carmaadmin'),
    password=os.getenv('DATABASE_PASSWORD', 'CarmaDB2026!Secure'),
    sslmode='require',
    connect_timeout=30,
    options='-c statement_timeout=15000',
)

API_BASE = os.getenv('API_BASE_URL', 'https://carma-ml-api.greenwater-7817a41f.northeurope.azurecontainerapps.io')

# ─── Helpers ────────────────────────────────────────────────────────────────

UUID_RE = re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', re.I)

def extract_id(input_str: str) -> Optional[str]:
    m = UUID_RE.search(input_str)
    return m.group(0).lower() if m else input_str.strip()

def fmt_price(v):
    return f"€{v:,.0f}" if v else "N/A"

def fmt_km(v):
    return f"{v:,.0f} km" if v else "N/A"

def colorize(text, code):
    return f"\033[{code}m{text}\033[0m"

def green(t):  return colorize(t, "32")
def yellow(t): return colorize(t, "33")
def red(t):    return colorize(t, "31")
def bold(t):   return colorize(t, "1")
def dim(t):    return colorize(t, "2")

def deal_label(score: float) -> str:
    if score >= 0.72:   return green(f"Great deal   ({score:.2f})")
    if score >= 0.58:   return green(f"Good deal    ({score:.2f})")
    if score >= 0.45:   return yellow(f"Fair value   ({score:.2f})")
    if score >= 0.30:   return red(f"Slightly over({score:.2f})")
    return red(f"Overpriced   ({score:.2f})")

def sim_label(score: float) -> str:
    bar = "█" * int(score * 10) + "░" * (10 - int(score * 10))
    return f"{bar} {score:.2f}"

# ─── DB direct mode ─────────────────────────────────────────────────────────

NUMERIC_PRICE   = "CAST(NULLIF(REGEXP_REPLACE(price,'[^0-9]','','g'),'') AS DOUBLE PRECISION)"
NUMERIC_MILEAGE = "CAST(NULLIF(REGEXP_REPLACE(COALESCE(CAST(mileage_km AS TEXT),''),'[^0-9]','','g'),'') AS DOUBLE PRECISION)"

RANK_FIELDS = f"""
    vehicle_id, listing_url, price, mileage_km, first_registration_raw,
    make, model, fuel_type, fuel_type_norm, transmission, transmission_norm,
    body_type, body_type_norm, data_source, power_kw, color, color_norm,
    interior_color, model_generation_id, is_private_seller, seller_name,
    condition, previous_owners,
    {NUMERIC_PRICE}   AS price_num,
    {NUMERIC_MILEAGE} AS mileage_num
"""

def get_conn():
    return psycopg2.connect(**DB_CONFIG)

def fetch_target(conn, vehicle_id: str) -> Optional[Dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT {RANK_FIELDS}
            FROM vehicle_marketplace.vehicle_data
            WHERE vehicle_id = %s AND is_vehicle_available = true
            LIMIT 1
        """, (vehicle_id,))
        return cur.fetchone()

def fetch_candidates(conn, target: Dict, candidate_limit: int) -> tuple:
    make       = target['make']
    model      = target['model']
    vid        = target['vehicle_id']
    body_norm  = target.get('body_type_norm')
    trans_norm = target.get('transmission_norm')
    fuel_norm  = target.get('fuel_type_norm')

    attempts = []
    if body_norm and trans_norm:
        if fuel_norm:
            attempts.append(('strict',
                "make=%s AND model=%s AND body_type_norm=%s AND transmission_norm=%s AND fuel_type_norm=%s",
                [make, model, body_norm, trans_norm, fuel_norm]))
        attempts.append(('no_fuel',
            "make=%s AND model=%s AND body_type_norm=%s AND transmission_norm=%s",
            [make, model, body_norm, trans_norm]))
    else:
        attempts.append(('make_model_only', "make=%s AND model=%s", [make, model]))

    for name, where_extra, params in attempts:
        full_where = f"is_vehicle_available=true AND vehicle_id!=%s AND {where_extra}"
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"SELECT {RANK_FIELDS} FROM vehicle_marketplace.vehicle_data "
                    f"WHERE {full_where} LIMIT %s",
                    [vid] + params + [candidate_limit]
                )
                rows = cur.fetchall()
                if rows:
                    return list(rows), name
        except Exception as e:
            print(f"  [warn] attempt {name} failed: {e}")
    return [], 'none'

def normalise(row: Dict) -> Dict:
    def _num(v):
        if v is None: return None
        if isinstance(v, (int, float)): return float(v)
        d = ''.join(c for c in str(v) if c.isdigit())
        return float(d) if d else None
    def _year(raw):
        if raw is None: return None
        for t in str(raw).replace('/', '-').split('-'):
            if t.isdigit() and len(t) == 4: return int(t)
        return None

    price   = _num(row.get('price_num')) or _num(row.get('price'))
    mileage = _num(row.get('mileage_num')) or _num(row.get('mileage_km'))
    return {**row,
        'price_eur':   price,
        'mileage_km':  mileage,
        'year':        _year(row.get('first_registration_raw')),
        'generation_id': row.get('model_generation_id'),
    }

def regression_coeffs(candidates):
    valid = [(c['price_eur'], c['year'], c['mileage_km'])
             for c in candidates
             if c.get('price_eur') and c.get('year') and c.get('mileage_km')
             and c['price_eur'] > 0]
    if len(valid) < 6: return None
    lp = np.array([math.log(v[0]) for v in valid])
    yr = np.array([float(v[1]) for v in valid])
    lm = np.array([math.log(v[2]+1) for v in valid])
    X  = np.column_stack([np.ones(len(valid)), yr, lm])
    try:
        c, *_ = np.linalg.lstsq(X, lp, rcond=None)
        return c
    except:
        return None

def deal_score(v, coeffs):
    if coeffs is None or not v.get('price_eur') or not v.get('year') or v.get('mileage_km') is None:
        return 0.5
    try:
        lp_actual   = math.log(v['price_eur'])
        lp_expected = coeffs[0] + coeffs[1]*float(v['year']) + coeffs[2]*math.log(v['mileage_km']+1)
        return max(0.0, min(1.0, 0.5 + (lp_expected - lp_actual) / 0.6))
    except:
        return 0.5

def year_sim(a, b):
    if a is None or b is None: return 0.5
    return max(0.0, 1.0 - abs(a-b)*0.2)

def mile_sim(target_km, cand_km):
    if target_km is None or cand_km is None or target_km <= 0: return 0.5
    diff = cand_km - target_km
    penalty = diff / target_km if diff > 0 else abs(diff) / target_km * 0.5
    return max(0.0, 1.0 - penalty)

def power_sim(a, b):
    if not a or not b or a <= 0 or b <= 0: return 0.5
    return max(0.0, 1.0 - abs(a-b) / (a*0.25))

def fuel_match(t, c):
    tn, cn = t.get('fuel_type_norm'), c.get('fuel_type_norm')
    if not tn or not cn: return 0.5
    return 1.0 if tn == cn else 0.0

def score(target, cand):
    y = year_sim(target.get('year'), cand.get('year'))
    m = mile_sim(target.get('mileage_km'), cand.get('mileage_km'))
    p = power_sim(
        float(target['power_kw']) if target.get('power_kw') else None,
        float(cand['power_kw'])   if cand.get('power_kw')   else None,
    )
    f = fuel_match(target, cand)
    sim = 0.40*y + 0.35*m + 0.15*p + 0.10*f
    gen_t, gen_c = target.get('generation_id'), cand.get('generation_id')
    if gen_t and gen_c and gen_t == gen_c:
        sim = min(1.0, sim + 0.08)
    return sim, {'year': y, 'mileage': m, 'power': p, 'fuel': f}


# ─── Display ─────────────────────────────────────────────────────────────────

def print_vehicle(v: Dict, label: str = "TARGET"):
    print(f"\n{bold(label)}: {v.get('make','')} {v.get('model','')} "
          f"| {v.get('year','?')} | {fmt_km(v.get('mileage_km'))} | {fmt_price(v.get('price_eur'))}")
    print(f"  Body: {v.get('body_type_norm','?') or v.get('body_type','?')}"
          f"  Trans: {v.get('transmission_norm','?') or v.get('transmission','?')}"
          f"  Fuel: {v.get('fuel_type_norm','?') or v.get('fuel_type','?')}"
          f"  Color: {v.get('color_norm','?') or v.get('color','?')}"
          f"  Power: {v.get('power_kw','?')} kW"
          f"  Gen: {v.get('generation_id','–')}"
          f"  Source: {v.get('data_source','?')}")
    print(f"  Seller: {v.get('seller_name','?')} "
          f"({'private' if v.get('is_private_seller') else 'dealer' if v.get('is_private_seller') is False else '?'})")

def print_result(rank: int, cand: Dict, target: Dict, sim: float, d_score: float,
                 final: float, components: Dict):
    delta = (target.get('price_eur') or 0) - (cand.get('price_eur') or 0)
    delta_str = (green(f"-€{abs(delta):,.0f}") if delta > 0
                 else red(f"+€{abs(delta):,.0f}") if delta < 0 else "±€0")

    gen_t, gen_c = target.get('generation_id'), cand.get('generation_id')
    same_gen = "✓ same gen" if gen_t and gen_c and gen_t == gen_c else ""
    private  = "👤 private" if cand.get('is_private_seller') else ""

    print(f"\n  {bold(f'#{rank}')}  {cand.get('make','')} {cand.get('model','')} {cand.get('year','?')} "
          f"| {fmt_km(cand.get('mileage_km'))} | {fmt_price(cand.get('price_eur'))} {delta_str}")
    print(f"      Similarity: {sim_label(sim)}  |  Deal: {deal_label(d_score)}  |  "
          f"Final: {bold(f'{final:.3f}')}")
    print(f"      year={components['year']:.2f} mi={components['mileage']:.2f} "
          f"pwr={components['power']:.2f} fuel={components['fuel']:.2f}  "
          f"{dim(same_gen)} {dim(private)}")
    print(f"      {cand.get('body_type_norm','?')} | {cand.get('transmission_norm','?')} | "
          f"{cand.get('fuel_type_norm','?')} | {cand.get('color_norm','?')} | "
          f"{cand.get('data_source','?')}")
    if cand.get('listing_url'):
        print(f"      {dim(cand['listing_url'])}")

def print_quality_summary(results: List[Dict], target: Dict):
    """Print aggregate quality metrics for the result set."""
    if not results:
        return
    prices   = [r['price_eur'] for r in results if r.get('price_eur')]
    mileages = [r['mileage_km'] for r in results if r.get('mileage_km')]
    years    = [r['year'] for r in results if r.get('year')]
    deal_scores   = [r['deal_score'] for r in results]
    sim_scores    = [r['sim_score'] for r in results]
    final_scores  = [r['final_score'] for r in results]

    target_price = target.get('price_eur')
    cheaper = [r for r in results if r.get('price_eur') and target_price and r['price_eur'] < target_price]

    print(f"\n{'─'*70}")
    print(bold("QUALITY SUMMARY"))
    print(f"  Results returned:   {len(results)}")
    print(f"  Cheaper than target: {len(cheaper)}/{len(results)} ({len(cheaper)/len(results)*100:.0f}%)")
    if prices:
        print(f"  Price range:        {fmt_price(min(prices))} – {fmt_price(max(prices))}")
    if mileages:
        print(f"  Mileage range:      {fmt_km(min(mileages))} – {fmt_km(max(mileages))}")
    if years:
        print(f"  Year range:         {min(years)} – {max(years)}")
    print(f"  Avg similarity:     {sum(sim_scores)/len(sim_scores):.3f}")
    print(f"  Avg deal score:     {sum(deal_scores)/len(deal_scores):.3f}")
    print(f"  Avg final score:    {sum(final_scores)/len(final_scores):.3f}")

    # Flag potential issues
    issues = []
    body_mismatch = [r for r in results if r.get('body_type_norm') != target.get('body_type_norm') and r.get('body_type_norm') and target.get('body_type_norm')]
    trans_mismatch = [r for r in results if r.get('transmission_norm') != target.get('transmission_norm') and r.get('transmission_norm') and target.get('transmission_norm')]
    year_diff_3plus = [r for r in results if r.get('year') and target.get('year') and abs(r['year'] - target['year']) >= 3]

    if body_mismatch:
        issues.append(red(f"⚠ {len(body_mismatch)} results have different body type"))
    if trans_mismatch:
        issues.append(red(f"⚠ {len(trans_mismatch)} results have different transmission"))
    if year_diff_3plus:
        issues.append(yellow(f"~ {len(year_diff_3plus)} results are 3+ years from target year"))

    if issues:
        print("\n  Issues detected:")
        for issue in issues:
            print(f"    {issue}")
    else:
        print(f"\n  {green('✓ No obvious quality issues detected')}")


# ─── Main ────────────────────────────────────────────────────────────────────

def run_eval(vehicle_id: str, top: int = 12, candidate_limit: int = 400, use_api: bool = False):
    if use_api:
        import urllib.request
        print(f"Fetching from API: {API_BASE}/listings/{vehicle_id}/comparables?top={top}")
        t0 = time.time()
        url = f"{API_BASE}/listings/{vehicle_id}/comparables?top={top}"
        with urllib.request.urlopen(url, timeout=30) as r:
            data = json.loads(r.read())
        elapsed = time.time() - t0
        print(f"API response in {elapsed:.2f}s")
        print(json.dumps(data.get('metadata', {}), indent=2))
        return

    conn = get_conn()
    t0 = time.time()

    target_raw = fetch_target(conn, vehicle_id)
    if not target_raw:
        print(red(f"Vehicle {vehicle_id} not found (or not available)."))
        conn.close()
        return

    target = normalise(dict(target_raw))
    t_fetch = time.time()

    candidates_raw, attempt = fetch_candidates(conn, target, candidate_limit)
    t_cand = time.time()

    if not candidates_raw:
        print(red("No candidates found."))
        conn.close()
        return

    candidates_all = [normalise(dict(r)) for r in candidates_raw]

    # Deduplicate: same (year, price±100, mileage±500) = same car scraped twice
    seen_keys, candidates = set(), []
    for c in candidates_all:
        key = (c.get('year'),
               round(c['price_eur'] / 100) if c.get('price_eur') else None,
               round(c['mileage_km'] / 500) if c.get('mileage_km') else None)
        if key not in seen_keys:
            seen_keys.add(key)
            candidates.append(c)

    coeffs = regression_coeffs(candidates)
    target_price = target.get('price_eur')

    scored = []
    for c in candidates:
        sim, comp = score(target, c)
        d = deal_score(c, coeffs)
        final = 0.65 * sim + 0.35 * d
        savings = (target_price - c['price_eur']) if target_price and c.get('price_eur') else 0
        scored.append({**c,
            'sim_score': sim, 'deal_score': d, 'final_score': final,
            'components': comp, 'savings': savings})

    scored.sort(key=lambda x: x['final_score'], reverse=True)
    top_results = scored[:top]
    t_score = time.time()

    # Print target
    print_vehicle(target)

    print(f"\n{bold('NORMALISED FILTERS USED')}: "
          f"body={target.get('body_type_norm','–')} "
          f"trans={target.get('transmission_norm','–')} "
          f"fuel={target.get('fuel_type_norm','–')} "
          f"[attempt: {attempt}]")
    print(f"\n{bold(f'TOP {top} COMPARABLES')} (from {len(candidates)} candidates):\n{'─'*70}")

    for i, r in enumerate(top_results, 1):
        print_result(i, r, target, r['sim_score'], r['deal_score'],
                     r['final_score'], r['components'])

    print_quality_summary(top_results, target)

    total = time.time() - t0
    print(f"\n{dim(f'Timing: target={t_fetch-t0:.2f}s  candidates={t_cand-t_fetch:.2f}s  scoring={t_score-t_cand:.3f}s  total={total:.2f}s')}")
    print(dim(f"Pool regression coeffs: {coeffs}"))

    conn.close()


def main():
    parser = argparse.ArgumentParser(description='CARMA Recommendation Evaluator')
    parser.add_argument('vehicle_id', nargs='?', help='Vehicle UUID or AutoScout24 URL')
    parser.add_argument('--top', type=int, default=12, help='Number of results (default: 12)')
    parser.add_argument('--candidates', type=int, default=400, help='Candidate pool size (default: 400)')
    parser.add_argument('--api', action='store_true', help='Use live API instead of direct DB')
    parser.add_argument('--batch', type=str, help='File with one ID/URL per line')
    args = parser.parse_args()

    if args.batch:
        with open(args.batch) as f:
            ids = [line.strip() for line in f if line.strip()]
        for raw in ids:
            vid = extract_id(raw)
            print(f"\n{'='*70}\nEvaluating: {vid}")
            run_eval(vid, args.top, args.candidates, args.api)
    elif args.vehicle_id:
        vid = extract_id(args.vehicle_id)
        run_eval(vid, args.top, args.candidates, args.api)
    else:
        parser.print_help()
        print("\nExample vehicle IDs to try:")
        print("  python3 scripts/eval_recommendations.py <paste a UUID here>")


if __name__ == '__main__':
    main()
