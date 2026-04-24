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
