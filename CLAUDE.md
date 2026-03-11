## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy to keep main context window clean

- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop

- After ANY correction from the user: update 'tasks/lessons.md' with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing

- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests -> then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to 'tasks/todo.md' with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review to 'tasks/todo.md'
6. **Capture Lessons**: Update 'tasks/lessons.md' after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## Project: CARMA — Vehicle Comparison Platform

### What it does
Buyers find a car they like and CARMA shows them the best comparable deals. Hard filters ensure same make/model/body/transmission/color. Soft scoring ranks by similarity + deal value.

### Infrastructure
- **Azure PostgreSQL Flexible Server**: `carma.postgres.database.azure.com`, user: `carmaadmin`, pw: `CarmaDB2026!Secure`
- **Container App**: `carma-ml-api` in resource group `carma` (northeurope)
- **Container Registry**: `carmaregistry.azurecr.io`
- **Current API image**: `carmaregistry.azurecr.io/carma-ml-api:v5.1-*` (latest revision)
- Connect via Python psycopg2 with `sslmode='require'` — psql has local SSL issues
- Never use `psql` directly; use Python scripts or the Bash tool with Python

### Database
- Schema: `vehicle_marketplace.vehicle_data`, ~2.94M rows
- 3 data sources: `autoscout24` (~75%, German values), `otomoto` (~19%, Polish/English), `marktplaats` (~5.5%, Dutch)
- **Normalized columns** (added via migration 001): `fuel_type_norm`, `body_type_norm`, `transmission_norm`, `color_norm`, `is_private_seller`
- Trigger `trg_normalize_fields` auto-populates normalized cols on INSERT/UPDATE
- Partial indexes: `idx_vd_norm_strict` and `idx_vd_norm_no_fuel` on normalized cols

### Ranking Logic (api.py v5)
- **Hard SQL filters**: make, model, body_type_norm, transmission_norm (never drop)
- **Soft filter**: fuel_type_norm (one fallback level)
- **Candidate pool**: 400, deduplicated by (year, price±€100, mileage±500km)
- **Similarity score**: year (40%) + mileage directional (35%) + power (15%) + fuel (10%) + same-gen bonus (+0.08)
- **Deal score**: within-pool log-price regression `log(price) ~ year + log(mileage+1)`
- **Final score**: 0.65 × similarity + 0.35 × deal score
- **10-second hard budget**: SQL timeout 7s, total target <10s

### Key Files
- `RankingMODEL/autoscout-ml/src/api.py` — main Flask API (v5)
- `RankingMODEL/autoscout-ml/migrations/001_normalize_fields.sql` — DB normalization migration
- `RankingMODEL/autoscout-ml/scripts/backfill_normalized.py` — one-time backfill script
- `RankingMODEL/autoscout-ml/scripts/eval_recommendations.py` — local testing tool
- `RankingMODEL/autoscout-ml/Dockerfile.flask` — API image (build for `linux/amd64`)
- `RankingMODEL/autoscout-ml/Dockerfile.backfill` — backfill job image
- `RankingMODEL/autoscout-ml/.env.optimized` — DB connection config

### Deployment
- Always build for `linux/amd64`: `docker buildx build --platform linux/amd64`
- Use unique tags (not `:latest`) to force Container App revision update
- `az containerapp update --resource-group carma --name carma-ml-api --image <image>`
- API endpoint: `https://carma-ml-api.greenwater-7817a41f.northeurope.azurecontainerapps.io`

### Known Gotchas
- `!` in passwords breaks shell quoting — use Python scripts or env vars loaded via dotenv
- Container App ACR login expires — run `az acr login --name carmaregistry` before building
- `pg_stats` null_frac estimates go stale — don't trust them for exact counts
- The `mutable tag` problem: pushing to same tag doesn't trigger a new revision — always use a new tag
- `COUNT(*) WHERE col IS NULL` on 2.9M rows = full table scan, takes 5-10+ min on B1ms
