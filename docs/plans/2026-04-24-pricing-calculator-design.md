# Per-Plot Pricing Calculator — Design

**Date:** 2026-04-24
**Status:** Design approved, ready for implementation planning
**Approach:** B — embed calculator in `/model` page as a collapsible panel

## Problem

Today's model page averages the retail price of all selected plots and applies flat L1/L2 discounts. This loses granularity: a scenario mixing a $450/m² villa lot with a $130/m² apartment lot gets averaged to $290/m², which hides the real economics.

The user has provided a **locked 2026-04-24 pricing schedule** (61 active plots) with per-plot retail, L1 (−35%), and L2 (−20%) values. The model page should calculate scenarios using each plot's actual price, not an average.

The user also wants a UI to edit prices per-plot — for running "what if we drop apartments by $30/m²" scenarios — with edits persisting across reloads.

## Scope

- **In:** `/model` page gets a collapsible Pricing Calculator panel; per-plot pricing flows through the model + investor pages; edits persist via Upstash Redis.
- **Out:** Customer-facing pricing changes; sold lots (55-58, 102, 103) are excluded from the calculator; multi-user concurrent edit resolution (single-admin assumption).

## Design

### Data flow

```
┌─────────────────────────────────────┐
│  src/data/lot-prices.json           │  ← CSV baseline (immutable, locked 2026-04-24)
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Upstash Redis: pricing:default     │  ← User's "saved default" snapshot
│  (from /api/state, keyed "pricingDefault") │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Zustand: lotPriceOverrides map     │  ← Live in-memory (what the calculator edits)
│  Shape: Map<lotId, {retail, l1}>    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  getLotPricing(lotId)               │  ← Unified selector
│  → { retail, l1, l2 }               │
│  L2 is always retail × 0.80         │
└──────────────┬──────────────────────┘
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
/investor   /model      /customer
 (map)      (scenarios)  (read-only)
```

### Three-tier state model

1. **Baseline** — CSV values in `lot-prices.json`. Immutable. "Reset to baseline" button restores this.
2. **Saved default** — User's last `Save as default` snapshot. Persists in Redis. Loaded on every session start. This is the "locked in on reload" behavior the user asked for.
3. **Live edits** — In-memory Zustand state. Shows immediately in the model page. Lost on reload unless saved.

Semantics:
- On page load: fetch saved default from Redis. If none, fall back to CSV baseline.
- User edits → Zustand updates → model page recalculates → edits visible instantly.
- `Save as default` → current Zustand state writes to Redis under `pricingDefault` key.
- `Reset to saved default` → revert live edits to the saved snapshot.
- `Reset to baseline` → clear Redis + revert Zustand to CSV values.

### Calculator UI (ported from HTML mockup)

Collapsible accordion at the top of `/model`, labeled "Pricing Calculator" with a badge showing the count of edited lots vs. default.

**Top summary bar** (live-updating):
- Active plots count (61)
- Avg retail ($/m²)
- Avg L1 ($/m²)
- Avg L2 ($/m²)
- Avg discount %

**Bulk controls row 1** — Scope selector (All / Villas & Twins / Apartments) + flat discount % button + flat L1 $ button.

**Bulk controls row 2** — Apartment scenarios: "Set all apt L1 to flat $X", "Reduce apt retail by $X", "Reset apt retail".

**Action buttons:**
- `Save as default` (green)
- `Reset to saved default` (gold)
- `Reset to baseline` (red, confirmation required)
- `Export CSV`
- `Copy JSON`

**Table** — 61 rows with columns: Lot (with zone badge), Typology, Phase, Retail $/m² (editable), L1 $/m² (editable), L2 $/m² (computed read-only), Discount %.

**Footer averages** — Three rows: All plots / Villas & Twins / Apartments.

### Integration points

1. **`src/data/lot-prices.json`** — stays as baseline; read-only from app code.
2. **`src/store/simulation-store.ts`** — new slice:
   ```ts
   lotPriceOverrides: Map<number, { retail: number; l1: number }>
   setLotPriceOverride: (lotId, retail, l1) => void
   clearLotPriceOverride: (lotId) => void
   savePricingAsDefault: () => Promise<void>
   resetToSavedDefault: () => Promise<void>
   resetToBaseline: () => Promise<void>
   ```
3. **`src/lib/lot-pricing.ts`** — new helper:
   ```ts
   getLotPricing(lotId): { retail, l1, l2 }
   // reads from store override → falls back to lot-prices.json → L2 always retail*0.80
   ```
4. **`src/app/api/state/route.ts`** — extend to read/write `pricingDefault`:
   ```ts
   GET: returns { assignments, lotStatuses, pricingDefault, ... }
   POST: accepts pricingDefault in payload
   ```
5. **`src/components/model/PricingCalculator.tsx`** — new component, port of the HTML mockup.
6. **`src/components/model/ModelContent.tsx`** — render PricingCalculator at top; replace inline `LOT_RETAIL_MAP.get(lot.id) ?? lot.zone_price_retail` with `getLotPricing(lot.id).retail`; replace `* (1 - l1Discount)` with `getLotPricing(lot.id).l1`.
7. **`src/app/investor/page.tsx`** — same swap to `getLotPricing()` in InvestorMap's selectionPricing calc.
8. **L1 discount constant** — change `L1_DISCOUNT = 0.33` → `0.35` in both `investor/page.tsx` and `ModelContent.tsx` (fallback for any lot not in the schedule).

### Edge cases

- **Sold lots excluded** — lots 55-58, 102, 103 don't appear in the calculator table.
- **Unassigned lots** — lot not in the 61-plot schedule but gets assigned later → fall back to `zone_price_retail` from `lots.ts` × (1 − L1_DISCOUNT).
- **Save during edit race** — simple last-write-wins; single-admin assumption holds.
- **L2 always computed** — never user-editable; always `retail × 0.80`. Avoids three-way inconsistency.

## Success criteria

1. Model page scenarios use per-plot retail/L1/L2 (weighted, not averaged).
2. Admin can edit any plot's retail or L1 and see scenario outputs update live.
3. `Save as default` persists to Redis; values survive logout/reload/new browser session.
4. `Reset to baseline` restores CSV values; `Reset to saved default` restores the saved snapshot.
5. Investor map sidebar shows accurate per-plot averages for any selection (uses same `getLotPricing`).
6. Verified: selecting all 61 plots shows avg retail $311, avg L1 $203, avg L2 $249 (matches CSV footer).

## Trade-offs

- **Pro:** Single source of truth (Zustand + Redis); model + investor + future customer view all read from `getLotPricing()`.
- **Pro:** Admin never has to leave `/model` to tweak pricing during scenario modeling.
- **Con:** `/model` page gets longer; mitigated by collapsible accordion defaulting to collapsed.
- **Con:** Two "reset" buttons risks confusion; mitigated with clear labels ("Reset to saved" vs "Reset to baseline") + confirmation on baseline reset.

## Open follow-ups (not in this phase)

- Multi-user edit resolution (if more than one admin is ever expected).
- Per-plot L2 editing (currently always retail × 0.80).
- Snapshot history (currently single "saved default" slot; no versioning).
