-- ============================================================
-- Migration 001: Add normalized fields for cross-source matching
-- ============================================================
-- Run once. Safe to re-run (all steps are IF NOT EXISTS / idempotent).
-- After running: execute scripts/backfill_normalized.py to populate
-- existing rows, then the trigger handles all future inserts/updates.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Add normalized columns
-- ------------------------------------------------------------

ALTER TABLE vehicle_marketplace.vehicle_data
    ADD COLUMN IF NOT EXISTS fuel_type_norm        TEXT,
    ADD COLUMN IF NOT EXISTS body_type_norm        TEXT,
    ADD COLUMN IF NOT EXISTS transmission_norm     TEXT,
    ADD COLUMN IF NOT EXISTS color_norm            TEXT,
    ADD COLUMN IF NOT EXISTS is_private_seller     BOOLEAN;

-- ------------------------------------------------------------
-- 2. Normalization function — fuel type
-- Canonical values: petrol | diesel | electric | hybrid_petrol |
--                   hybrid_diesel | plugin_hybrid | lpg | cng |
--                   hydrogen | other
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.normalize_fuel_type(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE LOWER(TRIM(raw))
        -- petrol
        WHEN 'benzin'            THEN 'petrol'
        WHEN 'benzine'           THEN 'petrol'
        WHEN 'petrol'            THEN 'petrol'
        -- diesel
        WHEN 'diesel'            THEN 'diesel'
        -- electric
        WHEN 'elektro'           THEN 'electric'
        WHEN 'elektrisch'        THEN 'electric'
        WHEN 'electric'          THEN 'electric'
        -- hybrid petrol
        WHEN 'elektro/benzin'           THEN 'hybrid_petrol'
        WHEN 'hybrid (benzin/elektro)'  THEN 'hybrid_petrol'
        WHEN 'hybride elektrisch/benzine' THEN 'hybrid_petrol'
        WHEN 'hybrid'                   THEN 'hybrid_petrol'
        -- hybrid diesel
        WHEN 'elektro/diesel'           THEN 'hybrid_diesel'
        WHEN 'hybride elektrisch/diesel' THEN 'hybrid_diesel'
        -- plugin hybrid
        WHEN 'plugin-hybrid'     THEN 'plugin_hybrid'
        -- lpg
        WHEN 'autogas (lpg)'     THEN 'lpg'
        WHEN 'lpg'               THEN 'lpg'
        WHEN 'petrol-lpg'        THEN 'lpg'
        -- cng
        WHEN 'erdgas (cng)'      THEN 'cng'
        WHEN 'cng (aardgas)'     THEN 'cng'
        WHEN 'petrol-cng'        THEN 'cng'
        -- hydrogen
        WHEN 'wasserstoff'       THEN 'hydrogen'
        -- other / unknown
        WHEN 'andere'            THEN 'other'
        WHEN 'sonstige'          THEN 'other'
        ELSE NULL
    END
$$;

-- ------------------------------------------------------------
-- 3. Normalization function — body type
-- Canonical values: sedan | estate | suv | hatchback | coupe |
--                   convertible | minivan | van_commercial | other
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.normalize_body_type(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE LOWER(TRIM(raw))
        -- sedan
        WHEN 'limousine'                  THEN 'sedan'
        WHEN 'sedan'                      THEN 'sedan'
        -- estate / wagon
        WHEN 'kombi'                      THEN 'estate'
        WHEN 'combi'                      THEN 'estate'
        WHEN 'kombi/van'                  THEN 'estate'
        -- suv (AS24 bundles pickup into this; acceptable for passenger cars)
        WHEN 'suv/geländewagen/pickup'    THEN 'suv'
        WHEN 'suv'                        THEN 'suv'
        -- hatchback / small car
        WHEN 'kleinwagen'                 THEN 'hatchback'
        WHEN 'compact'                    THEN 'hatchback'
        WHEN 'city-car'                   THEN 'hatchback'
        WHEN 'mini'                       THEN 'hatchback'
        -- coupe
        WHEN 'coupé'                      THEN 'coupe'
        WHEN 'coupe'                      THEN 'coupe'
        -- convertible
        WHEN 'cabrio'                     THEN 'convertible'
        WHEN 'cabrio'                     THEN 'convertible'  -- accent variant
        WHEN 'cabriolet'                  THEN 'convertible'
        -- minivan / people carrier
        WHEN 'van/kleinbus'               THEN 'minivan'
        WHEN 'minivan'                    THEN 'minivan'
        -- commercial / van (excluded from passenger car comparisons)
        WHEN 'kastenwagen'                THEN 'van_commercial'
        WHEN 'kastenwagen hochdach'       THEN 'van_commercial'
        WHEN 'transporter'                THEN 'van_commercial'
        WHEN 'koffer'                     THEN 'van_commercial'
        WHEN 'pritsche/plane'             THEN 'van_commercial'
        WHEN 'pritschenwagen'             THEN 'van_commercial'
        WHEN 'dreiseitenkipper'           THEN 'van_commercial'
        WHEN 'kipper'                     THEN 'van_commercial'
        WHEN 'fahrgestell'                THEN 'van_commercial'
        WHEN 'pferde-/viehtransporter'    THEN 'van_commercial'
        WHEN 'kühl-/iso-/frischdienst'   THEN 'van_commercial'
        -- other
        WHEN 'sonstige'                   THEN 'other'
        ELSE NULL
    END
$$;

-- ------------------------------------------------------------
-- 4. Normalization function — transmission
-- Canonical values: manual | automatic | semi_automatic
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.normalize_transmission(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE
        WHEN LOWER(TRIM(raw)) IN ('schaltgetriebe', 'manual', 'handgeschakeld') THEN 'manual'
        WHEN LOWER(TRIM(raw)) LIKE 'handgeschakeld%'  THEN 'manual'
        WHEN LOWER(TRIM(raw)) IN ('automatik', 'automatic', 'automaat')         THEN 'automatic'
        WHEN LOWER(TRIM(raw)) LIKE 'automaat%'        THEN 'automatic'
        WHEN LOWER(TRIM(raw)) = 'halbautomatik'       THEN 'semi_automatic'
        ELSE NULL
    END
$$;

-- ------------------------------------------------------------
-- 5. Normalization function — exterior color
-- Canonical values: black | white | grey | silver | blue | red |
--                   green | brown | beige | orange | yellow |
--                   gold | purple | bronze | other
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.normalize_color(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
    SELECT CASE LOWER(TRIM(raw))
        -- black
        WHEN 'schwarz'           THEN 'black'
        WHEN 'black'             THEN 'black'
        WHEN 'zwart'             THEN 'black'
        -- white
        WHEN 'weiß'              THEN 'white'
        WHEN 'weiss'             THEN 'white'
        WHEN 'white'             THEN 'white'
        WHEN 'wit'               THEN 'white'
        -- grey
        WHEN 'grau'              THEN 'grey'
        WHEN 'grey'              THEN 'grey'
        WHEN 'gray'              THEN 'grey'
        -- silver
        WHEN 'silber'            THEN 'silver'
        WHEN 'silver'            THEN 'silver'
        -- blue (all shades)
        WHEN 'blau'              THEN 'blue'
        WHEN 'blue'              THEN 'blue'
        WHEN 'blauw'             THEN 'blue'
        WHEN 'navy-blue'         THEN 'blue'
        WHEN 'sky-blue'          THEN 'blue'
        -- red
        WHEN 'rot'               THEN 'red'
        WHEN 'red'               THEN 'red'
        WHEN 'rood'              THEN 'red'
        WHEN 'dark-red'          THEN 'red'
        -- green
        WHEN 'grün'              THEN 'green'
        WHEN 'grun'              THEN 'green'
        WHEN 'green'             THEN 'green'
        WHEN 'groen'             THEN 'green'
        -- brown
        WHEN 'braun'             THEN 'brown'
        WHEN 'brown'             THEN 'brown'
        WHEN 'bruin'             THEN 'brown'
        WHEN 'brown-beige'       THEN 'brown'
        -- beige
        WHEN 'beige'             THEN 'beige'
        -- orange
        WHEN 'orange'            THEN 'orange'
        -- yellow
        WHEN 'gelb'              THEN 'yellow'
        WHEN 'yellow'            THEN 'yellow'
        -- gold
        WHEN 'gold'              THEN 'gold'
        WHEN 'yellow-gold'       THEN 'gold'
        -- purple / violet
        WHEN 'violett'           THEN 'purple'
        WHEN 'purple'            THEN 'purple'
        -- bronze
        WHEN 'bronze'            THEN 'bronze'
        -- ambiguous / catch-all
        WHEN 'zilver of grijs'   THEN NULL   -- genuinely ambiguous, skip
        WHEN 'overige kleuren'   THEN 'other'
        WHEN 'other'             THEN 'other'
        ELSE NULL
    END
$$;

-- ------------------------------------------------------------
-- 6. is_private_seller heuristic
-- Returns TRUE if seller_name looks like a private individual.
-- Logic: no corporate keywords AND short enough to be a person name.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.detect_private_seller(seller TEXT, src TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    s TEXT := LOWER(COALESCE(seller, ''));
BEGIN
    -- No seller name → unknown, return NULL
    IF seller IS NULL OR TRIM(seller) = '' THEN
        RETURN NULL;
    END IF;

    -- Known dealer-generated placeholder names (autoscout24)
    IF s IN (
        'afdeling verkoop', 'ihr verkaufsteam', 'ihr vertriebsteam',
        'kundenkontaktcenter', 'contáctanos en:', 'kontaktieren sie uns'
    ) THEN RETURN FALSE; END IF;

    -- Corporate keywords in any language
    IF s LIKE '%gmbh%'         OR s LIKE '%b.v.%'          OR s LIKE '%auto%'
    OR s LIKE '%sp. z o.o.%'   OR s LIKE '%sp.z o.o%'      OR s LIKE '%s.a.%'
    OR s LIKE '%motors%'       OR s LIKE '%dealer%'         OR s LIKE '%handel%'
    OR s LIKE '%center%'       OR s LIKE '%centre%'         OR s LIKE '%centrum%'
    OR s LIKE '%salon%'        OR s LIKE '%verkoop%'        OR s LIKE '%verkauf%'
    OR s LIKE '%automotive%'   OR s LIKE '%fahrzeug%'       OR s LIKE '%group%'
    OR s LIKE '%car '%         OR s LIKE '% car'            OR s LIKE '%cars%'
    OR s LIKE '%team%'         OR s LIKE '%vertrieb%'       OR s LIKE '%showroom%'
    OR s LIKE '%studio%'       OR s LIKE '%import%'         OR s LIKE '%export%'
    OR s LIKE '%lease%'        OR s LIKE '%samochod%'       OR s LIKE '%vans%'
    OR s LIKE '%truck%'        OR s LIKE '%bedrijf%'        OR s LIKE '%bedrijven%'
    OR s LIKE '%makurat%'      OR s LIKE '%kontaktieren%'
    THEN RETURN FALSE; END IF;

    -- Heuristic: private names tend to be short (≤ 40 chars) with ≤ 3 words
    IF LENGTH(seller) > 50 THEN RETURN FALSE; END IF;
    IF array_length(regexp_split_to_array(TRIM(seller), '\s+'), 1) > 3 THEN RETURN FALSE; END IF;

    RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------
-- 7. Trigger function — populate normalized columns on insert/update
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION vehicle_marketplace.trg_normalize_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.fuel_type_norm    := vehicle_marketplace.normalize_fuel_type(NEW.fuel_type);
    NEW.body_type_norm    := vehicle_marketplace.normalize_body_type(NEW.body_type);
    NEW.transmission_norm := vehicle_marketplace.normalize_transmission(NEW.transmission);
    NEW.color_norm        := vehicle_marketplace.normalize_color(NEW.color);
    NEW.is_private_seller := vehicle_marketplace.detect_private_seller(NEW.seller_name, NEW.data_source);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_fields ON vehicle_marketplace.vehicle_data;

CREATE TRIGGER trg_normalize_fields
    BEFORE INSERT OR UPDATE OF fuel_type, body_type, transmission, color, seller_name
    ON vehicle_marketplace.vehicle_data
    FOR EACH ROW EXECUTE FUNCTION vehicle_marketplace.trg_normalize_fields();

-- ------------------------------------------------------------
-- 8. Indexes on normalized columns
-- Primary: (make, model, body_type_norm, transmission_norm) — hard filters, always used
-- Secondary: adds fuel_type_norm for the strict attempt
-- ------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_norm_strict
    ON vehicle_marketplace.vehicle_data
    (make, model, body_type_norm, transmission_norm, fuel_type_norm)
    WHERE is_vehicle_available = true
      AND body_type_norm IS NOT NULL
      AND transmission_norm IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vd_norm_no_fuel
    ON vehicle_marketplace.vehicle_data
    (make, model, body_type_norm, transmission_norm)
    WHERE is_vehicle_available = true
      AND body_type_norm IS NOT NULL
      AND transmission_norm IS NOT NULL;
