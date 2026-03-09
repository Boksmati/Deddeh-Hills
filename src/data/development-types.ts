import { DevelopmentTypeConfig } from "@/types";

export const DEVELOPMENT_TYPES: Record<string, DevelopmentTypeConfig> = {
  unassigned: {
    id: "unassigned",
    label: "Unassigned",
    shortLabel: "—",
    color: "#E5E7EB",
    constructionCostPerM: 0,
    sellingPricePerM: 0,
    avgUnitSize: 0,
    commonAreaPct: 0,
    description: "No development type assigned",
  },
  lot_sale: {
    id: "lot_sale",
    label: "Sell as Lot",
    shortLabel: "LOT",
    color: "#FCD34D",
    constructionCostPerM: 0,
    sellingPricePerM: 0, // uses zone price
    avgUnitSize: 0,
    commonAreaPct: 0,
    description: "Sell the raw lot to a buyer at zone price",
  },
  twin_villa: {
    id: "twin_villa",
    label: "Twin Villa",
    shortLabel: "TWIN",
    color: "#60A5FA",
    constructionCostPerM: 600,
    sellingPricePerM: 1400,
    avgUnitSize: 300,
    commonAreaPct: 0.1,
    description: "Semi-detached twin villas sharing a party wall",
  },
  villa_2f: {
    id: "villa_2f",
    label: "Villa (2 Floors)",
    shortLabel: "V2F",
    color: "#34D399",
    constructionCostPerM: 600,
    sellingPricePerM: 1500,
    avgUnitSize: 300,
    commonAreaPct: 0.1,
    description: "Standalone 2-floor villa with garden",
  },
  villa_3f: {
    id: "villa_3f",
    label: "Villa (3 Floors)",
    shortLabel: "V3F",
    color: "#A78BFA",
    constructionCostPerM: 600,
    sellingPricePerM: 1300,
    avgUnitSize: 500,
    commonAreaPct: 0.1,
    description: "Standalone 3-floor villa with garden and OUG",
  },
  apartments: {
    id: "apartments",
    label: "Apartments & Duplexes",
    shortLabel: "APT",
    color: "#F472B6",
    constructionCostPerM: 600,
    sellingPricePerM: 1100,
    avgUnitSize: 200,
    commonAreaPct: 0.3,
    description: "Multi-unit apartment building with duplexes",
  },
};

export const PHASE_COLORS: Record<number, string> = {
  0: "#E5E7EB",
  1: "#34D399",
  2: "#60A5FA",
  3: "#A78BFA",
};

export const PHASE_LABELS: Record<number, string> = {
  0: "Unassigned",
  1: "Phase 1",
  2: "Phase 2",
  3: "Phase 3",
};
