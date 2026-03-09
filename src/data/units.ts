import { Lot, DevelopmentType } from "@/types";

export interface Unit {
  /** Unique unit ID — e.g. "81A", "81B", "42" (lot_sale uses string of lotId) */
  id: string;
  /** Parent lot */
  lotId: number;
  /** English label */
  label: string;
  /** Arabic label */
  labelAr: string;
  /**
   * Floors this unit occupies.
   * Used to render floor-plan tab selectors.
   * 0 = Ground / OUG, 1 = First, 2 = Second / Roof
   */
  floors: number[];
  /** Sellable internal area (m²) */
  areaSqm: number;
  /** Private garden / outdoor space (m²) — ground-floor units */
  gardenSqm: number;
  /** Private terrace / balcony / roof deck (m²) — upper-floor units */
  terraceSqm: number;
  /** Number of bedrooms */
  bedroomCount: number;
  /** Asking price (USD) */
  price: number;
}

// Selling prices per m² (must match DEVELOPMENT_TYPES to stay in sync with financial engine)
const SELL_PRICE: Partial<Record<DevelopmentType, number>> = {
  twin_villa: 1400,
  villa_2f:   1500,
  villa_3f:   1300,
  apartments: 1100,
};

/** Common-area deduction per typology (fraction of BUA that is not sellable) */
const COMMON_PCT: Partial<Record<DevelopmentType, number>> = {
  twin_villa: 0.10,
  villa_2f:   0.10,
  villa_3f:   0.10,
  apartments: 0.30,
};

/**
 * Generates the sellable units for a lot given its assigned development type.
 * Pure function — no store dependency.
 *
 * @param lot       The lot object from LOTS
 * @param devType   The assigned development type (must not be "unassigned")
 */
export function generateUnitsForLot(lot: Lot, devType: DevelopmentType): Unit[] {
  const { id: lotId, total_bua_sqm, area_sqm, zone_price_retail } = lot;
  const ppm   = SELL_PRICE[devType] ?? 0;
  const comPct = COMMON_PCT[devType] ?? 0;
  const sellable = Math.round(total_bua_sqm * (1 - comPct));

  switch (devType) {
    // ─── Land plot ────────────────────────────────────────────────────────────
    case "lot_sale":
      return [
        {
          id:           `${lotId}`,
          lotId,
          label:        "Land Plot",
          labelAr:      "قطعة أرض",
          floors:       [0],
          areaSqm:      Math.round(area_sqm),
          gardenSqm:    0,
          terraceSqm:   0,
          bedroomCount: 0,
          price:        Math.round(area_sqm * zone_price_retail),
        },
      ];

    // ─── Twin Villa — 2 mirror units (A + B) ─────────────────────────────────
    case "twin_villa": {
      const unitArea = Math.round(sellable / 2);
      const garden   = Math.round(area_sqm * 0.20); // ~20 % of land as private garden each
      const priceEach = Math.round(unitArea * ppm);
      return [
        {
          id: `${lotId}A`, lotId,
          label: "Unit A", labelAr: "وحدة أ",
          floors: [0, 1],
          areaSqm: unitArea, gardenSqm: garden, terraceSqm: 0,
          bedroomCount: 4, price: priceEach,
        },
        {
          id: `${lotId}B`, lotId,
          label: "Unit B", labelAr: "وحدة ب",
          floors: [0, 1],
          areaSqm: unitArea, gardenSqm: garden, terraceSqm: 0,
          bedroomCount: 4, price: priceEach,
        },
      ];
    }

    // ─── Villa 2F — single stand-alone 2-floor villa ──────────────────────────
    case "villa_2f": {
      const unitArea = sellable;
      const garden   = Math.round(area_sqm * 0.28);
      return [
        {
          id: `${lotId}`, lotId,
          label: "Villa", labelAr: "فيلا",
          floors: [0, 1],
          areaSqm: unitArea, gardenSqm: garden, terraceSqm: 65,
          bedroomCount: 5, price: Math.round(unitArea * ppm),
        },
      ];
    }

    // ─── Villa 3F — single stand-alone 3-floor villa with roof terrace ────────
    case "villa_3f": {
      const unitArea = sellable;
      const garden   = Math.round(area_sqm * 0.22);
      return [
        {
          id: `${lotId}`, lotId,
          label: "Villa", labelAr: "فيلا",
          floors: [0, 1, 2],
          areaSqm: unitArea, gardenSqm: garden, terraceSqm: 85,
          bedroomCount: 6, price: Math.round(unitArea * ppm),
        },
      ];
    }

    // ─── Apartments — 4 units across 3 levels ────────────────────────────────
    case "apartments": {
      // Split sellable BUA: G 30 %, 1A 22.5 %, 1B 22.5 %, PH 25 %
      const areaG   = Math.round(sellable * 0.30);
      const area1A  = Math.round(sellable * 0.225);
      const area1B  = Math.round(sellable * 0.225);
      const areaPH  = sellable - areaG - area1A - area1B; // remainder = ~25 %

      const gardenG = Math.round(area_sqm * 0.25);

      return [
        {
          id: `${lotId}G`, lotId,
          label: "Ground Duplex", labelAr: "دوبلكس أرضي",
          floors: [0, 1],
          areaSqm: areaG, gardenSqm: gardenG, terraceSqm: 0,
          bedroomCount: 3, price: Math.round(areaG * ppm),
        },
        {
          id: `${lotId}1A`, lotId,
          label: "Apt 1A", labelAr: "شقة 1 – أ",
          floors: [1],
          areaSqm: area1A, gardenSqm: 0, terraceSqm: 22,
          bedroomCount: 2, price: Math.round(area1A * ppm),
        },
        {
          id: `${lotId}1B`, lotId,
          label: "Apt 1B", labelAr: "شقة 1 – ب",
          floors: [1],
          areaSqm: area1B, gardenSqm: 0, terraceSqm: 22,
          bedroomCount: 2, price: Math.round(area1B * ppm),
        },
        {
          id: `${lotId}PH`, lotId,
          label: "Penthouse", labelAr: "بنتهاوس",
          floors: [2],
          areaSqm: areaPH, gardenSqm: 0, terraceSqm: 55,
          bedroomCount: 3,
          // Penthouse carries a 10 % premium
          price: Math.round(areaPH * ppm * 1.10),
        },
      ];
    }

    default:
      return [];
  }
}
