export interface Lot {
  id: number;
  area_sqm: number;
  setback_m: number;
  levels: string;
  road_level: string;
  road_width_m: number;
  max_floors: number;
  oug_allowed: boolean;
  max_height_m: string;
  parking_spots: number;
  guest_parking: number;
  exploitation_ratio: number;
  total_exploited_area: number;
  superficial_ratio: number;
  superficial_area_sqm: number;
  balcony_wall_ratio: number;
  total_additional_area: number;
  total_bua_sqm: number;
  oug_area_sqm: number;
  zone_price_retail: number;
  zone_price_discounted: number;
}

export type DevelopmentType =
  | "unassigned"
  | "lot_sale"
  | "twin_villa"
  | "villa_2f"
  | "villa_3f"
  | "apartments";

export type Phase = 0 | 1 | 2 | 3; // 0 = unassigned

export interface DevelopmentTypeConfig {
  id: DevelopmentType;
  label: string;
  shortLabel: string;
  color: string;
  constructionCostPerM: number;
  sellingPricePerM: number;
  avgUnitSize: number;
  commonAreaPct: number;
  description: string;
}

export interface LotAssignment {
  lotId: number;
  developmentType: DevelopmentType;
  phase: Phase;
}

export interface LotFinancials {
  lotId: number | string; // number for individual lots, string group.id for groups
  isGroup?: boolean;
  groupLotIds?: number[]; // populated when isGroup=true
  landCost: number;
  sellableArea: number;
  totalBUA: number;
  numUnits: number;
  constructionCost: number;
  revenue: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
}

/** A cluster of 2+ lots treated as one development unit */
export interface LotGroup {
  id: string;               // "grp_<timestamp>"
  lotIds: number[];         // 2+ lot IDs merged into this group
  devType: DevelopmentType; // shared development type for the group
  phase: Phase;             // shared phase
  customUnits?: number;     // optional override; undefined = auto-derive
  label?: string;           // display label, e.g. "Lots 5+6"
}

export interface PhaseFinancials {
  phase: Phase;
  lotCount: number;
  totalArea: number;
  totalUnits: number;
  totalLandCost: number;
  totalConstructionCost: number;
  totalInvestment: number;
  totalRevenue: number;
  totalGrossProfit: number;
  totalNetProfit: number;
  avgGrossMargin: number;
  roi: number;
}

export interface SimulationSummary {
  totalLots: number;
  assignedLots: number;
  totalArea: number;
  totalUnits: number;
  totalLandCost: number;
  totalConstructionCost: number;
  totalInvestment: number;
  totalRevenue: number;
  totalProfit: number;
  overallROI: number;
  investorShare: number;
  investorReturn: number;
  investorROI: number;
  phaseBreakdown: PhaseFinancials[];
}

export type InvestorModel = "share" | "land-equity" | "priority" | "ticket";

export interface InvestorScenarioResult {
  investorCapital: number;
  investorReturn: number;
  investorROI: number;
  cashToStartROI: number;
  investorProfitPct: number;
  landCostCovered: number;
  constructionCoverage: number;
}

export interface PhaseTicketInfo {
  phase: Phase;
  phaseInvestment: number;
  phaseNetProfit: number;
  phaseLandCost: number;
  phaseConstructionCost: number;
  ticketSize: number;
  ticketsAvailable: number;
  returnPerTicket: number;
  roiPerTicket: number;
}

export interface Scenario {
  id: string;
  name: string;
  createdAt: string;
  assignments: LotAssignment[];
  investorSharePct: number;
}

export interface MassingSummary {
  totalLots: number;
  totalLandArea: number;
  totalSellableBUA: number;
  totalGrossBUA: number;
  totalUnits: number;
  typeBreakdown: MassingTypeBreakdown[];
  totalLandCost: number;
  totalConstructionCost: number;
  totalRevenue: number;
  totalNetProfit: number;
  avgGrossMargin: number;
}

export interface MassingTypeBreakdown {
  developmentType: DevelopmentType;
  lotCount: number;
  landArea: number;
  sellableBUA: number;
  unitCount: number;
  revenue: number;
  profit: number;
}

export interface TypeAssumption {
  constructionCostPerM: number;
  sellingPricePerM: number;
  avgUnitSize: number;
  commonAreaPct: number;
  maxFloors: number;
  /** Units per lot override (0 = auto-derive from sellable area ÷ avgUnitSize) */
  unitsPerLot: number;
  /** Garden / outdoor area per unit in m² (informational, used in lot-size reference) */
  gardenAreaM: number;
}

export type LotStatus = "available" | "reserved" | "under_contract" | "sold";

export type ViewMode = "development" | "phase" | "financial";
export type MapColorMode = "type" | "phase" | "price" | "area" | "status";
