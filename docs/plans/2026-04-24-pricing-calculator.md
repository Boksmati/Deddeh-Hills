# Per-Plot Pricing Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the model page's averaged pricing with per-plot retail/L1/L2 lookups, driven by an embedded calculator UI on `/model` that persists edits to Upstash Redis.

**Architecture:** Three-tier state (CSV baseline in `lot-prices.json` → saved-default in Redis → live Zustand overrides). A new `getLotPricing(lotId)` selector is the single source of truth used by both the model and investor pages. A ported React version of the HTML calculator mockup is embedded as a collapsible accordion at the top of `/model`.

**Tech Stack:** Next.js 14 App Router, Zustand, Upstash Redis (via existing `src/lib/kv.ts`), TypeScript, Tailwind CSS.

**Design reference:** `docs/plans/2026-04-24-pricing-calculator-design.md`

**Testing approach:** Project has no Jest/Vitest. Verification uses `npm run lint`, `npm run build` (type check), and documented manual browser checks with precise expected values. Pure TypeScript helpers are verified with one-off `node --input-type=module` invocations.

---

## Task 1: Update L1 discount constant to match CSV

**Files:**
- Modify: `src/app/investor/page.tsx:971`
- Modify: `src/components/model/ModelContent.tsx:126`

**Step 1: Change investor/page.tsx**

```bash
# Verify current value
grep -n "L1_DISCOUNT = 0" /Users/mahmoudboksmati/Desktop/Deddeh\ Hills/simulator/src/app/investor/page.tsx
```
Expected output: `971:const L1_DISCOUNT = 0.33;`

Use Edit: change `const L1_DISCOUNT = 0.33;` → `const L1_DISCOUNT = 0.35;`

**Step 2: Change ModelContent.tsx**

```bash
grep -n "DEFAULT_L1_DISCOUNT = 0" /Users/mahmoudboksmati/Desktop/Deddeh\ Hills/simulator/src/components/model/ModelContent.tsx
```
Expected output: `126:const DEFAULT_L1_DISCOUNT = 0.33;`

Use Edit: change `const DEFAULT_L1_DISCOUNT = 0.33;` → `const DEFAULT_L1_DISCOUNT = 0.35;`

**Step 3: Verify build**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && npm run lint 2>&1 | tail -10
```
Expected: `✔ No ESLint warnings or errors` (or same warnings as before — no new ones).

**Step 4: Commit**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator"
git add src/app/investor/page.tsx src/components/model/ModelContent.tsx
git commit -m "fix(pricing): align L1 discount with CSV schedule (0.33 → 0.35)"
```

---

## Task 2: Create `src/lib/lot-pricing.ts` helper

**Files:**
- Create: `src/lib/lot-pricing.ts`

**Step 1: Write the helper**

Create file with:

```typescript
import LOT_PRICES_RAW from "@/data/lot-prices.json";
import { LOTS } from "@/data/lots";

interface LotPriceEntry {
  lot: number;
  price_sqm: number;
  status?: string;
  view?: string;
  zone?: string;
  villa_selling_sqm?: number;
}

export interface LotPricingValues {
  retail: number;   // $/m²
  l1: number;       // $/m²
  l2: number;       // $/m² (always retail × 0.80)
}

export interface LotPriceOverride {
  retail: number;
  l1: number;
}

export const L1_DISCOUNT_DEFAULT = 0.35;
export const L2_DISCOUNT_DEFAULT = 0.20;

const LOT_PRICES = LOT_PRICES_RAW as LotPriceEntry[];
const BASELINE_RETAIL = new Map<number, number>(
  LOT_PRICES.map(p => [p.lot, p.price_sqm])
);
const LOTS_BY_ID = new Map(LOTS.map(l => [l.id, l]));

/**
 * Single source of truth for per-lot pricing.
 * Resolution order:
 *   1. Override (user-edited, from Zustand store)
 *   2. lot-prices.json baseline
 *   3. lots.ts zone_price_retail fallback
 * L2 is always computed as retail × (1 - L2_DISCOUNT_DEFAULT).
 */
export function getLotPricing(
  lotId: number,
  overrides?: Map<number, LotPriceOverride> | null
): LotPricingValues {
  const override = overrides?.get(lotId);
  if (override) {
    return {
      retail: override.retail,
      l1: override.l1,
      l2: Math.round(override.retail * (1 - L2_DISCOUNT_DEFAULT)),
    };
  }
  const baselineRetail =
    BASELINE_RETAIL.get(lotId) ??
    LOTS_BY_ID.get(lotId)?.zone_price_retail ??
    0;
  return {
    retail: baselineRetail,
    l1: Math.round(baselineRetail * (1 - L1_DISCOUNT_DEFAULT)),
    l2: Math.round(baselineRetail * (1 - L2_DISCOUNT_DEFAULT)),
  };
}

/** Baseline (CSV) retail price for a lot. Used to detect "edited" state. */
export function getBaselineRetail(lotId: number): number {
  return (
    BASELINE_RETAIL.get(lotId) ??
    LOTS_BY_ID.get(lotId)?.zone_price_retail ??
    0
  );
}

/** Baseline L1 computed from CSV retail × 0.65. */
export function getBaselineL1(lotId: number): number {
  return Math.round(getBaselineRetail(lotId) * (1 - L1_DISCOUNT_DEFAULT));
}
```

**Step 2: Verify type-checks**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && npx tsc --noEmit 2>&1 | grep -E "lot-pricing|error" | head -20
```
Expected: no errors mentioning `lot-pricing.ts`.

**Step 3: Smoke-test the helper**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && cat > /tmp/lot-pricing-smoke.mjs <<'EOF'
import { getLotPricing, getBaselineRetail } from "./src/lib/lot-pricing.ts";
// Expected from CSV: lot 7 retail=420, l1=273, l2=336
console.log("lot 7:", getLotPricing(7));
console.log("lot 109:", getLotPricing(109));
console.log("baseline lot 1:", getBaselineRetail(1));
EOF
npx tsx /tmp/lot-pricing-smoke.mjs
```
Expected:
```
lot 7: { retail: 420, l1: 273, l2: 336 }
lot 109: { retail: 80, l1: 52, l2: 64 }
baseline lot 1: 130
```

(If `tsx` isn't installed, run `npx -y tsx /tmp/lot-pricing-smoke.mjs`.)

**Step 4: Commit**

```bash
git add src/lib/lot-pricing.ts
git commit -m "feat(pricing): add getLotPricing helper with override + baseline resolution"
```

---

## Task 3: Add `lotPriceOverrides` slice to Zustand store

**Files:**
- Modify: `src/store/simulation-store.ts`

**Step 1: Find store shape**

```bash
grep -n "lotStatuses\|setLotStatus\|lotStatusesOverrides\|investorSharePct" /Users/mahmoudboksmati/Desktop/Deddeh\ Hills/simulator/src/store/simulation-store.ts | head -20
```

Use this to understand where to add the new slice. Mimic the same Map-based persistence pattern used for `lotStatuses`.

**Step 2: Add slice to state interface**

In the `State` interface (search for `interface State` or the `type State = {...}`), add:

```typescript
  // Per-plot pricing overrides (user edits on the calculator)
  lotPriceOverrides: Map<number, { retail: number; l1: number }>;
  // The "saved default" snapshot from Redis. Loaded on init; set by savePricingAsDefault.
  savedPricingDefault: Map<number, { retail: number; l1: number }> | null;
```

Add to the actions interface:

```typescript
  setLotPriceOverride: (lotId: number, retail: number, l1: number) => void;
  clearLotPriceOverride: (lotId: number) => void;
  bulkSetOverrides: (updates: Array<{ lotId: number; retail: number; l1: number }>) => void;
  savePricingAsDefault: () => Promise<void>;
  resetToSavedDefault: () => void;
  resetToBaseline: () => Promise<void>;
```

**Step 3: Add initial values**

In the initial state object, add:

```typescript
  lotPriceOverrides: new Map(),
  savedPricingDefault: null,
```

**Step 4: Implement the actions**

Add these action implementations (place near `setLotStatus`):

```typescript
  setLotPriceOverride: (lotId, retail, l1) => {
    set((state) => {
      const next = new Map(state.lotPriceOverrides);
      next.set(lotId, { retail, l1 });
      return { lotPriceOverrides: next };
    });
  },

  clearLotPriceOverride: (lotId) => {
    set((state) => {
      const next = new Map(state.lotPriceOverrides);
      next.delete(lotId);
      return { lotPriceOverrides: next };
    });
  },

  bulkSetOverrides: (updates) => {
    set((state) => {
      const next = new Map(state.lotPriceOverrides);
      for (const u of updates) next.set(u.lotId, { retail: u.retail, l1: u.l1 });
      return { lotPriceOverrides: next };
    });
  },

  savePricingAsDefault: async () => {
    const overrides = get().lotPriceOverrides;
    const payload = Array.from(overrides.entries()).map(([lotId, v]) => ({ lotId, ...v }));
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingDefault: payload }),
    });
    set({ savedPricingDefault: new Map(overrides) });
  },

  resetToSavedDefault: () => {
    const saved = get().savedPricingDefault;
    set({ lotPriceOverrides: saved ? new Map(saved) : new Map() });
  },

  resetToBaseline: async () => {
    await fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingDefault: [] }),
    });
    set({ lotPriceOverrides: new Map(), savedPricingDefault: null });
  },
```

**Step 5: Load `pricingDefault` on store init**

Find where `lotStatuses` is hydrated from `/api/state` (search for `fetch("/api/state")` or similar). Add parallel hydration for `pricingDefault`:

```typescript
// In the hydration block (where assignments/lotStatuses are set from server):
const pricingDefaultArr = data.pricingDefault as Array<{ lotId: number; retail: number; l1: number }> | undefined;
if (pricingDefaultArr && pricingDefaultArr.length > 0) {
  const m = new Map(pricingDefaultArr.map(p => [p.lotId, { retail: p.retail, l1: p.l1 }]));
  useSimulationStore.setState({
    lotPriceOverrides: new Map(m),
    savedPricingDefault: new Map(m),
  });
}
```

**Step 6: Verify type-check**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && npx tsc --noEmit 2>&1 | grep -E "simulation-store|error" | head -20
```
Expected: no errors in `simulation-store.ts`.

**Step 7: Commit**

```bash
git add src/store/simulation-store.ts
git commit -m "feat(store): add lotPriceOverrides slice with save/reset actions"
```

---

## Task 4: Extend `/api/state` route to persist `pricingDefault`

**Files:**
- Modify: `src/app/api/state/route.ts`

**Step 1: Read current route**

```bash
cat "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator/src/app/api/state/route.ts"
```

Locate:
- The GET handler (returns the state blob).
- The POST handler (writes the state blob).

**Step 2: Extend GET**

Add `pricingDefault` to the returned JSON. The Redis key is `dh:state` (or similar — use whatever pattern the current code uses). In the existing state object, add a `pricingDefault` field populated from the KV store.

```typescript
// In GET handler, after reading the current state from KV:
const pricingDefault = await kv.get("dh:pricingDefault") ?? [];
return NextResponse.json({
  // ...existing fields...
  pricingDefault,
});
```

**Step 3: Extend POST**

```typescript
// In POST handler, after parsing body:
if (Array.isArray(body.pricingDefault)) {
  await kv.set("dh:pricingDefault", body.pricingDefault);
}
```

If `body.pricingDefault` is an empty array, that's the "reset to baseline" signal — store an empty array so next GET returns empty (triggering CSV fallback).

**Step 4: Verify via curl**

```bash
# Start dev server in another terminal: cd simulator && npm run dev
# Then:
curl -s http://localhost:3000/api/state | python3 -c "import sys,json; print(json.load(sys.stdin).get('pricingDefault'))"
```
Expected: `[]` (empty on first run).

```bash
curl -X POST http://localhost:3000/api/state \
  -H "Content-Type: application/json" \
  -d '{"pricingDefault":[{"lotId":7,"retail":420,"l1":273}]}'
curl -s http://localhost:3000/api/state | python3 -c "import sys,json; print(json.load(sys.stdin).get('pricingDefault'))"
```
Expected: `[{'lotId': 7, 'retail': 420, 'l1': 273}]`

**Step 5: Commit**

```bash
git add src/app/api/state/route.ts
git commit -m "feat(api): persist pricingDefault under dh:pricingDefault Redis key"
```

---

## Task 5: Build `PricingCalculator` — core table + summary bar

**Files:**
- Create: `src/components/model/PricingCalculator.tsx`

**Step 1: Write the component shell**

Create file:

```typescript
"use client";

import { useMemo, useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { getBaselineRetail, getBaselineL1, L2_DISCOUNT_DEFAULT } from "@/lib/lot-pricing";
import LOT_PRICES_RAW from "@/data/lot-prices.json";

interface Row {
  lot: number;
  typology: "Apartments" | "Villa 2F" | "Villa 3F" | "Twin Villa";
  phase: "Phase 1" | "Phase 2" | "Phase 3" | "TBD";
  baselineRetail: number;
}

// 61 active plots — matches CSV exactly. Typology + phase come from Zustand assignments.
const ACTIVE_LOTS = [
  1, 7, 8, 9, 10, 11, 12, 13, 20, 32, 33, 34, 35, 46, 47, 48,
  59, 60, 61, 62, 63, 64, 65,
  66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  92, 93, 94, 95, 96, 97, 98, 99, 100, 101,
  109, 110,
];

const TYPE_LABEL: Record<string, Row["typology"]> = {
  apartments: "Apartments",
  villa_2f: "Villa 2F",
  villa_3f: "Villa 3F",
  twin_villa: "Twin Villa",
};

export function PricingCalculator() {
  const [open, setOpen] = useState(false);
  const overrides = useSimulationStore((s) => s.lotPriceOverrides);
  const assignments = useSimulationStore((s) => s.assignments);
  const setLotPriceOverride = useSimulationStore((s) => s.setLotPriceOverride);

  const rows: Row[] = useMemo(() => {
    return ACTIVE_LOTS.map((lot) => {
      const a = assignments.get(lot);
      const typology = TYPE_LABEL[a?.developmentType ?? "apartments"] ?? "Apartments";
      const phase = a?.phase === 0 || a?.phase === undefined
        ? "TBD"
        : (`Phase ${a.phase}` as Row["phase"]);
      return {
        lot,
        typology,
        phase,
        baselineRetail: getBaselineRetail(lot),
      };
    });
  }, [assignments]);

  const totals = useMemo(() => {
    let retailSum = 0, l1Sum = 0, l2Sum = 0, count = 0;
    for (const row of rows) {
      const ov = overrides.get(row.lot);
      const retail = ov?.retail ?? row.baselineRetail;
      const l1 = ov?.l1 ?? getBaselineL1(row.lot);
      const l2 = Math.round(retail * (1 - L2_DISCOUNT_DEFAULT));
      retailSum += retail; l1Sum += l1; l2Sum += l2; count++;
    }
    return {
      count,
      avgRetail: Math.round(retailSum / count),
      avgL1: Math.round(l1Sum / count),
      avgL2: Math.round(l2Sum / count),
      avgDiscount: ((1 - l1Sum / retailSum) * 100).toFixed(1),
    };
  }, [rows, overrides]);

  const onL1Change = (lot: number, newL1: number) => {
    const current = overrides.get(lot);
    const retail = current?.retail ?? getBaselineRetail(lot);
    setLotPriceOverride(lot, retail, newL1);
  };
  const onRetailChange = (lot: number, newRetail: number) => {
    const current = overrides.get(lot);
    const l1 = current?.l1 ?? getBaselineL1(lot);
    setLotPriceOverride(lot, newRetail, l1);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">Pricing Calculator</span>
          {overrides.size > 0 && (
            <span className="text-[10px] uppercase tracking-wider font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {overrides.size} edited
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{open ? "Collapse ▲" : "Expand ▼"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5">
          {/* Summary bar */}
          <div className="grid grid-cols-5 gap-3 mb-5">
            <Stat label="Plots" value={`${totals.count}`} />
            <Stat label="Avg Retail" value={`$${totals.avgRetail}`} />
            <Stat label="Avg L1" value={`$${totals.avgL1}`} accent />
            <Stat label="Avg L2" value={`$${totals.avgL2}`} />
            <Stat label="Avg Disc." value={`${totals.avgDiscount}%`} />
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-[60vh] border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-900 text-white sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">Lot</th>
                  <th className="px-3 py-2 text-left">Typology</th>
                  <th className="px-3 py-2 text-left">Phase</th>
                  <th className="px-3 py-2 text-right">Retail $/m²</th>
                  <th className="px-3 py-2 text-right">L1 $/m²</th>
                  <th className="px-3 py-2 text-right">L2 $/m²</th>
                  <th className="px-3 py-2 text-right">Disc.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const ov = overrides.get(row.lot);
                  const retail = ov?.retail ?? row.baselineRetail;
                  const l1 = ov?.l1 ?? getBaselineL1(row.lot);
                  const l2 = Math.round(retail * (1 - L2_DISCOUNT_DEFAULT));
                  const disc = retail > 0 ? ((1 - l1 / retail) * 100).toFixed(1) : "0.0";
                  const edited = !!ov;
                  return (
                    <tr key={row.lot} className={`border-t border-gray-100 ${edited ? "bg-amber-50/50" : ""}`}>
                      <td className="px-3 py-1.5 font-semibold">{row.lot}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.typology}</td>
                      <td className="px-3 py-1.5 text-gray-600">{row.phase}</td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={retail}
                          onChange={(e) => onRetailChange(row.lot, parseInt(e.target.value) || 0)}
                          className="w-20 text-right px-1.5 py-0.5 border border-gray-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={l1}
                          onChange={(e) => onL1Change(row.lot, parseInt(e.target.value) || 0)}
                          className="w-20 text-right px-1.5 py-0.5 border border-gray-200 rounded"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-500">${l2}</td>
                      <td className="px-3 py-1.5 text-right text-gray-500">{disc}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center border border-gray-100 rounded-lg p-2.5">
      <div className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${accent ? "text-dh-hills" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && npx tsc --noEmit 2>&1 | grep -E "PricingCalculator|error" | head -20
```
Expected: no errors in `PricingCalculator.tsx`.

**Step 3: Commit**

```bash
git add src/components/model/PricingCalculator.tsx
git commit -m "feat(model): add PricingCalculator component (core table + summary)"
```

---

## Task 6: Mount `PricingCalculator` at the top of `/model`

**Files:**
- Modify: `src/components/model/ModelContent.tsx`

**Step 1: Import + render**

Add at the top of `ModelContent.tsx`:
```typescript
import { PricingCalculator } from "./PricingCalculator";
```

Find the main return JSX (the top-level `<div>` of the model page content). Render `<PricingCalculator />` right after the page header / before the phase cards.

**Step 2: Verify in browser**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator" && npm run dev
```

Manual check:
- Open http://localhost:3000/model
- Scroll to top: "Pricing Calculator" collapsed accordion visible
- Click to expand — 61-row table renders
- Summary bar shows: 61 plots, Avg Retail $311, Avg L1 $203, Avg L2 $249, Avg Disc. 34.8%
- Edit lot 7's L1 from 273 → 250: row highlights amber, summary avg L1 decreases

**Step 3: Commit**

```bash
git add src/components/model/ModelContent.tsx
git commit -m "feat(model): embed PricingCalculator accordion above phase cards"
```

---

## Task 7: Wire `getLotPricing()` into `ModelContent` scenario calculations

**Files:**
- Modify: `src/components/model/ModelContent.tsx`

**Step 1: Identify current LOT_RETAIL_MAP usages**

```bash
grep -n "LOT_RETAIL_MAP\|zone_price_retail\|l2Discount\|l1Discount" /Users/mahmoudboksmati/Desktop/Deddeh\ Hills/simulator/src/components/model/ModelContent.tsx | head -40
```

**Step 2: Replace retail lookups**

Import the helper at the top:
```typescript
import { getLotPricing, L2_DISCOUNT_DEFAULT } from "@/lib/lot-pricing";
```

Inside components/functions that access pricing, read the store's overrides:
```typescript
const overrides = useSimulationStore((s) => s.lotPriceOverrides);
```

Replace every `LOT_RETAIL_MAP.get(lot.id) ?? lot.zone_price_retail` with:
```typescript
getLotPricing(lot.id, overrides).retail
```

Replace every `retailLandCost * (1 - l2Discount)` where `retailLandCost` is already summed from averaged retail: rewrite to sum per-plot L2 directly. Example transformation:

Before:
```typescript
const retailLandCost = lots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0);
const landCost = retailLandCost * (1 - l2Discount);
```
After:
```typescript
const landCost = lots.reduce((s, l) => s + l.area_sqm * getLotPricing(l.id, overrides).l2, 0);
```

**Step 3: Verify scenarios still compute**

```bash
npm run build 2>&1 | tail -20
```
Expected: no type errors.

Manual browser check:
- Open `/model`, collapsed calculator, verify current scenarios show same numbers as before (since no overrides).
- Edit lot 7 retail from 420 → 300 in the calculator.
- Scroll to phase cards — Phase 1 land cost should drop.
- Note the numeric delta; verify it matches the area of lot 7 × $96 (= $120 × 0.80 decrease per m²).

**Step 4: Commit**

```bash
git add src/components/model/ModelContent.tsx
git commit -m "feat(model): use per-plot getLotPricing() in scenario calculations"
```

---

## Task 8: Wire `getLotPricing()` into `/investor` map

**Files:**
- Modify: `src/app/investor/page.tsx`

**Step 1: Locate `selectionPricing` useMemo**

```bash
grep -n "selectionPricing\|avgRetail\|LOT_RETAIL_MAP" /Users/mahmoudboksmati/Desktop/Deddeh\ Hills/simulator/src/app/investor/page.tsx | head -20
```

**Step 2: Replace retail lookup**

Import:
```typescript
import { getLotPricing } from "@/lib/lot-pricing";
```

In `InvestorMap`, read overrides:
```typescript
const overrides = useSimulationStore((s) => s.lotPriceOverrides);
```

Rewrite `selectionPricing` to sum per-plot L1 and L2 directly (not average-then-multiply):
```typescript
const selectionPricing = useMemo(() => {
  const ids = selectedLotIds.size > 0 ? selectedLotIds : filteredLotIds;
  const lots = LOTS.filter(l => ids.has(l.id) && lotStatuses.get(l.id) !== "sold");
  if (lots.length === 0) return null;

  let totalArea = 0, retailTot = 0, l1Tot = 0, l2Tot = 0;
  for (const l of lots) {
    const p = getLotPricing(l.id, overrides);
    totalArea += l.area_sqm;
    retailTot += l.area_sqm * p.retail;
    l1Tot += l.area_sqm * p.l1;
    l2Tot += l.area_sqm * p.l2;
  }
  return {
    count: lots.length,
    totalArea,
    avgRetail: retailTot / totalArea,
    avgL1: l1Tot / totalArea,
    avgL2: l2Tot / totalArea,
    isSelection: selectedLotIds.size > 0,
  };
}, [selectedLotIds, filteredLotIds, lotStatuses, overrides]);
```

**Step 3: Verify**

```bash
npm run build 2>&1 | grep -E "error|investor/page" | tail -10
```
Expected: no errors.

Manual browser:
- Open `/investor`, select all 61 plots.
- Sidebar should show: Retail $311, L1 $203, L2 $249.

**Step 4: Commit**

```bash
git add src/app/investor/page.tsx
git commit -m "feat(investor): use getLotPricing() for weighted selection averages"
```

---

## Task 9: Add bulk controls (scope + flat discount + flat L1)

**Files:**
- Modify: `src/components/model/PricingCalculator.tsx`

**Step 1: Add scope/discount/flat controls bar**

Between the summary bar and the table, insert:

```tsx
const [scope, setScope] = useState<"all"|"villa"|"apt">("all");
const [bulkDiscount, setBulkDiscount] = useState(35);
const [bulkFlat, setBulkFlat] = useState(200);

const applyBulkDiscount = () => {
  const updates = rows
    .filter(r => scope === "all" || (scope === "villa" && r.typology !== "Apartments") || (scope === "apt" && r.typology === "Apartments"))
    .map(r => {
      const current = overrides.get(r.lot);
      const retail = current?.retail ?? r.baselineRetail;
      return { lotId: r.lot, retail, l1: Math.round(retail * (1 - bulkDiscount / 100)) };
    });
  useSimulationStore.getState().bulkSetOverrides(updates);
};

const applyBulkFlat = () => {
  const updates = rows
    .filter(r => scope === "all" || (scope === "villa" && r.typology !== "Apartments") || (scope === "apt" && r.typology === "Apartments"))
    .map(r => {
      const current = overrides.get(r.lot);
      const retail = current?.retail ?? r.baselineRetail;
      return { lotId: r.lot, retail, l1: bulkFlat };
    });
  useSimulationStore.getState().bulkSetOverrides(updates);
};
```

```tsx
<div className="flex items-center gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
  <label className="text-xs text-gray-600">Scope:</label>
  <select value={scope} onChange={(e) => setScope(e.target.value as any)} className="text-xs border border-gray-200 rounded px-2 py-1">
    <option value="all">All plots</option>
    <option value="villa">Villas & Twins</option>
    <option value="apt">Apartments</option>
  </select>
  <label className="text-xs text-gray-600 ml-3">Discount:</label>
  <input type="number" value={bulkDiscount} onChange={(e) => setBulkDiscount(parseInt(e.target.value) || 0)} className="w-16 text-xs border border-gray-200 rounded px-2 py-1" />
  <span className="text-xs text-gray-500">%</span>
  <button onClick={applyBulkDiscount} className="text-xs bg-dh-dark text-white px-3 py-1 rounded">Apply %</button>

  <div className="flex-1" />

  <label className="text-xs text-gray-600">Flat L1 $:</label>
  <input type="number" value={bulkFlat} onChange={(e) => setBulkFlat(parseInt(e.target.value) || 0)} className="w-20 text-xs border border-gray-200 rounded px-2 py-1" />
  <button onClick={applyBulkFlat} className="text-xs bg-gray-600 text-white px-3 py-1 rounded">Apply flat</button>
</div>
```

**Step 2: Verify**

Manual browser:
- Set scope = "Apartments", discount = 40%, click Apply %.
- All 23 apartment rows should now show updated L1 values.

**Step 3: Commit**

```bash
git add src/components/model/PricingCalculator.tsx
git commit -m "feat(pricing): add scope + bulk discount/flat L1 controls"
```

---

## Task 10: Add apartment scenarios row (flat apt L1, reduce apt retail)

**Files:**
- Modify: `src/components/model/PricingCalculator.tsx`

**Step 1: Add second controls bar**

Below the first controls bar, add:

```tsx
const [aptFlat, setAptFlat] = useState(100);
const [aptReduceRetail, setAptReduceRetail] = useState(50);

const applyAptFlat = () => {
  const updates = rows
    .filter(r => r.typology === "Apartments")
    .map(r => {
      const current = overrides.get(r.lot);
      const retail = current?.retail ?? r.baselineRetail;
      return { lotId: r.lot, retail, l1: aptFlat };
    });
  useSimulationStore.getState().bulkSetOverrides(updates);
};

const applyAptReduce = () => {
  const discount = bulkDiscount / 100;
  const updates = rows
    .filter(r => r.typology === "Apartments")
    .map(r => {
      const newRetail = Math.max(0, r.baselineRetail - aptReduceRetail);
      return { lotId: r.lot, retail: newRetail, l1: Math.round(newRetail * (1 - discount)) };
    });
  useSimulationStore.getState().bulkSetOverrides(updates);
};

const resetAptRetail = () => {
  const updates = rows
    .filter(r => r.typology === "Apartments")
    .map(r => ({
      lotId: r.lot,
      retail: r.baselineRetail,
      l1: Math.round(r.baselineRetail * (1 - bulkDiscount / 100)),
    }));
  useSimulationStore.getState().bulkSetOverrides(updates);
};
```

```tsx
<div className="flex items-center gap-2 mb-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
  <label className="text-xs text-blue-700 font-semibold">Apartment scenarios:</label>
  <div className="flex-1" />
  <label className="text-xs text-gray-600">Set all apt L1 to $:</label>
  <input type="number" value={aptFlat} onChange={(e) => setAptFlat(parseInt(e.target.value) || 0)} className="w-16 text-xs border border-gray-200 rounded px-2 py-1" />
  <button onClick={applyAptFlat} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Apply</button>
  <div className="flex-1" />
  <label className="text-xs text-gray-600">Reduce apt retail by $:</label>
  <input type="number" value={aptReduceRetail} onChange={(e) => setAptReduceRetail(parseInt(e.target.value) || 0)} className="w-16 text-xs border border-gray-200 rounded px-2 py-1" />
  <button onClick={applyAptReduce} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">Apply</button>
  <button onClick={resetAptRetail} className="text-xs bg-gray-500 text-white px-3 py-1 rounded">Reset apt retail</button>
</div>
```

**Step 2: Verify**

Manual browser: click "Reduce apt retail by $50" — all 23 apartment rows should have retail reduced by $50 (with L1 recomputed at current bulkDiscount).

**Step 3: Commit**

```bash
git add src/components/model/PricingCalculator.tsx
git commit -m "feat(pricing): add apartment-specific scenario controls"
```

---

## Task 11: Add Save / Reset action buttons

**Files:**
- Modify: `src/components/model/PricingCalculator.tsx`

**Step 1: Add action row**

Above the table, below the two control rows, add:

```tsx
const savePricingAsDefault = useSimulationStore((s) => s.savePricingAsDefault);
const resetToSavedDefault = useSimulationStore((s) => s.resetToSavedDefault);
const resetToBaseline = useSimulationStore((s) => s.resetToBaseline);

const [saveStatus, setSaveStatus] = useState<"idle"|"saving"|"saved">("idle");
const handleSave = async () => {
  setSaveStatus("saving");
  await savePricingAsDefault();
  setSaveStatus("saved");
  setTimeout(() => setSaveStatus("idle"), 2000);
};
const handleResetBaseline = async () => {
  if (!confirm("Reset all prices to the CSV baseline? This also clears your saved default.")) return;
  await resetToBaseline();
};
```

```tsx
<div className="flex items-center gap-2 mb-3">
  <button
    onClick={handleSave}
    disabled={saveStatus === "saving"}
    className="text-xs bg-green-600 text-white px-4 py-1.5 rounded font-semibold"
  >
    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "✓ Saved" : "Save as default"}
  </button>
  <button onClick={resetToSavedDefault} className="text-xs bg-amber-500 text-white px-4 py-1.5 rounded">
    Reset to saved
  </button>
  <button onClick={handleResetBaseline} className="text-xs bg-red-600 text-white px-4 py-1.5 rounded">
    Reset to baseline
  </button>
</div>
```

**Step 2: Verify end-to-end persistence**

Manual browser:
1. Edit lot 7 L1 to 250.
2. Click "Save as default" — button shows "Saving..." then "✓ Saved".
3. Reload page (Cmd+R).
4. Open Pricing Calculator — lot 7 L1 should still be 250.
5. Click "Reset to baseline" → confirm → lot 7 should return to 273.
6. Reload page → lot 7 still 273 (saved default cleared).

**Step 3: Commit**

```bash
git add src/components/model/PricingCalculator.tsx
git commit -m "feat(pricing): add save/reset action buttons with confirmation"
```

---

## Task 12: Add Export CSV + Copy JSON buttons

**Files:**
- Modify: `src/components/model/PricingCalculator.tsx`

**Step 1: Add handlers**

```tsx
const exportCSV = () => {
  const header = "Lot,Typology,Phase,Retail_USD_sqm,L1_USD_sqm,L2_USD_sqm,Discount_pct\n";
  const lines = rows.map(r => {
    const ov = overrides.get(r.lot);
    const retail = ov?.retail ?? r.baselineRetail;
    const l1 = ov?.l1 ?? getBaselineL1(r.lot);
    const l2 = Math.round(retail * (1 - L2_DISCOUNT_DEFAULT));
    const disc = retail > 0 ? ((1 - l1 / retail) * 100).toFixed(1) : "0.0";
    return `${r.lot},${r.typology},${r.phase},${retail},${l1},${l2},${disc}`;
  }).join("\n");
  const csv = header + lines;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `deddeh_hills_pricing_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const copyJSON = () => {
  const data = rows.map(r => {
    const ov = overrides.get(r.lot);
    const retail = ov?.retail ?? r.baselineRetail;
    const l1 = ov?.l1 ?? getBaselineL1(r.lot);
    return { lot: r.lot, typology: r.typology, phase: r.phase, retail, l1, l2: Math.round(retail * (1 - L2_DISCOUNT_DEFAULT)) };
  });
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
};
```

Add buttons to the action row:
```tsx
<button onClick={exportCSV} className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded">Export CSV</button>
<button onClick={copyJSON} className="text-xs bg-gray-600 text-white px-4 py-1.5 rounded">Copy JSON</button>
```

**Step 2: Verify**

- Click Export CSV → file downloads, matches user's original CSV format.
- Click Copy JSON → paste into any editor, verify JSON is valid.

**Step 3: Commit**

```bash
git add src/components/model/PricingCalculator.tsx
git commit -m "feat(pricing): add Export CSV and Copy JSON actions"
```

---

## Task 13: End-to-end verification

**No code changes — verification only.**

**Step 1: Lint + build**

```bash
cd "/Users/mahmoudboksmati/Desktop/Deddeh Hills/simulator"
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -20
```
Expected: no new lint errors, build completes.

**Step 2: Manual browser checklist (dev server)**

```bash
npm run dev
```
Open http://localhost:3000/model:

- [ ] Pricing Calculator accordion at top, collapsed by default.
- [ ] Expand → summary bar shows **61 plots, $311 retail, $203 L1, $249 L2, 34.8% disc.**
- [ ] Edit lot 7 retail → 300. Summary avg retail drops to ~$309.
- [ ] Bulk: scope = Apartments, discount = 40%, Apply. All apt L1 rows update.
- [ ] Click Save as default. Reload. Calculator shows the same edits.
- [ ] Click Reset to baseline → confirm. Prices return to CSV. Reload — still baseline.
- [ ] Export CSV downloads a file that matches the user's original format.
- [ ] Copy JSON copies a clipboard-ready JSON array.
- [ ] Open `/investor`. Select all 61 plots. Sidebar shows **$311 retail, $203 L1, $249 L2** (weighted).
- [ ] Open `/model`. Scenario numbers on phase cards reflect per-plot pricing (not flat averages).

**Step 3: Final commit + push**

```bash
git log --oneline -15
git push
```

---

## Done

When all 13 tasks are green and the checklist passes, per-plot pricing is live in `/model`, `/investor`, and the edits persist across reloads via Redis.
