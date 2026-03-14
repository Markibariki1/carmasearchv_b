# CARMA — Open Tasks

## 1. Backfill Completion (in progress)
- [x] Normalization backfill running on CarmaScraper VM (~2.3M remaining rows)
- [ ] Verify completion in morning (`ssh CarmaUbuntuVM@52.138.207.92 "tail -20 ~/backfill.log"`)
- [ ] Run `ANALYZE vehicle_marketplace.vehicle_data` after backfill to update pg_stats

## Completed
- [x] Valuation API: case-insensitive matching (LOWER + functional index)
- [x] Valuation API: year filter fix (NULL years no longer excluded)
- [x] Valuation API: transmission prefix normalization
- [x] Valuation API: marktplaats price parsing fix (10x bug)
- [x] Frontend: sample_size=0 shows error + retry instead of infinite spinner
- [x] Frontend: add-vehicle form polish (empty defaults, no notes, text colors, etc.)
- [x] Infrastructure: min_replicas=1 (no cold starts)
- [x] Comparison API: price parsing fix deployed (v5.3)
- [x] Comparison API: case-insensitive matching deployed (v5.4-casefix)
- [x] Theme consistency: `theme-b` on all 8 DialogContent/AlertDialogContent portals
- [x] Theme consistency: replaced dark-theme input/button styles in add-alert-modal + add-payment-method-modal
- [x] Profile menu freeze: added ThemeProvider to root layout (missing next-themes provider caused crash on /settings)
- [x] Portfolio Vehicles card removed, replaced with inline sort pills + search
- [x] Profile dropdown added to portfolio + alerts page headers (Settings, Sign Out)
- [x] Photo & document upload: Supabase storage bucket + vehicle_media table + RLS policies
- [x] Photo & document upload: VehicleMediaSection component (drag & drop, preview, delete)
- [x] Photo & document upload: integrated into vehicle details modal
