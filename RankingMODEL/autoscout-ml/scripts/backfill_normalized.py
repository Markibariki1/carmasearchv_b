#!/usr/bin/env python3
"""
Backfill normalized columns — final pass using a temporary partial index.

1. Creates a temporary partial index on rows where fuel_type_norm IS NULL
   (this makes the UPDATE near-instant by avoiding a full table scan)
2. Runs the UPDATE in batches of 50k rows
3. Drops the temporary index when done
"""

import os
import time
import psycopg2
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
)

BATCH_SIZE = 50_000
INDEX_NAME = 'idx_backfill_null_fuel_tmp'


def get_conn(statement_timeout_ms=300_000):
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"SET statement_timeout = {statement_timeout_ms}")
    conn.autocommit = False
    return conn


def create_index(conn):
    print(f"Creating temporary partial index {INDEX_NAME} (may take 2-5 min)...", flush=True)
    t0 = time.time()
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME}
            ON vehicle_marketplace.vehicle_data (vehicle_id)
            WHERE fuel_type_norm IS NULL
        """)
    conn.autocommit = False
    print(f"  Index created in {time.time()-t0:.0f}s", flush=True)


def drop_index(conn):
    print(f"Dropping temporary index {INDEX_NAME}...", flush=True)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"DROP INDEX CONCURRENTLY IF EXISTS vehicle_marketplace.{INDEX_NAME}")
    conn.autocommit = False


def run_batch(conn) -> int:
    """Update up to BATCH_SIZE rows. Returns rowcount."""
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE vehicle_marketplace.vehicle_data
            SET
                fuel_type_norm    = vehicle_marketplace.normalize_fuel_type(fuel_type),
                body_type_norm    = vehicle_marketplace.normalize_body_type(body_type),
                transmission_norm = vehicle_marketplace.normalize_transmission(transmission),
                color_norm        = vehicle_marketplace.normalize_color(color),
                is_private_seller = vehicle_marketplace.detect_private_seller(seller_name, data_source)
            WHERE vehicle_id IN (
                SELECT vehicle_id FROM vehicle_marketplace.vehicle_data
                WHERE fuel_type_norm IS NULL
                LIMIT {BATCH_SIZE}
            )
        """)
        updated = cur.rowcount
    conn.commit()
    return updated


def main():
    conn = get_conn(statement_timeout_ms=600_000)  # 10 min per statement
    print("Connected.", flush=True)

    create_index(conn)

    total = 0
    start = time.time()
    batch = 0

    while True:
        batch += 1
        t0 = time.time()
        updated = run_batch(conn)
        elapsed = time.time() - t0
        total += updated

        if updated == 0:
            break

        rate = updated / elapsed if elapsed > 0 else 0
        print(f"  batch {batch}: {updated:,} rows in {elapsed:.1f}s ({rate:,.0f} rows/s) | total={total:,}", flush=True)

    drop_index(conn)
    total_time = time.time() - start
    print(f"\nDone. {total:,} rows updated in {total_time:.0f}s.", flush=True)
    conn.close()


if __name__ == '__main__':
    main()
