/**
 * Deddeh Hills — Two-Layer Investment Model
 *
 * Layer 1: Land & Infrastructure Fund
 *   – Buys land at entry price, exits at appreciation price (or sells to Layer 2)
 *
 * Layer 2: Villa Development Fund
 *   – Buys land from Layer 1, constructs villas, sells them at market
 *
 * Pure calculation functions — no side effects, safe on server & client.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LayerParams {
  /** Layer 1: total fund size in USD */
  l1_fund: number;
  /** Layer 1: land entry price per sqm (USD) */
  l1_entry: number;
  /** Layer 1: land exit / appreciation price per sqm (USD) */
  l1_exit: number;
  /** Layer 1: hold timeline in years */
  l1_timeline: number;

  /** Layer 2: number of plots (each plot can hold multiple villas) */
  plots: number;
  /** Layer 2: villas per plot */
  villas_per_plot: number;
  /** Layer 2: built-up area per villa in sqm */
  bua_per_villa: number;
  /** Layer 2: land area per villa in sqm */
  land_per_villa: number;
  /** Layer 2: construction cost per sqm (USD) */
  construction_sqm: number;
  /** Layer 2: target selling price per sqm (USD) */
  selling_sqm: number;
  /** Layer 2: soft costs as fraction of construction cost (e.g. 0.10 = 10%) */
  soft_cost_pct: number;
  /** Layer 2: total timeline in years */
  l2_timeline: number;
  /** Layer 2: land transfer price per sqm paid to Layer 1 (USD) */
  land_transfer: number;
  /** Layer 2: cash equity fraction (remainder is financed / staged) */
  cash_pct: number;
}

export interface Layer1Metrics {
  /** Total land area acquired (sqm) */
  sqm_acquired: number;
  /** Exit value of the land portfolio */
  exit_value: number;
  /** Gross profit from land appreciation */
  profit: number;
  /** ROI as decimal (e.g. 0.24 = 24%) */
  roi: number;
  /** Annualised IRR as decimal */
  irr: number;
  /** Timeline in years */
  timeline: number;
}

export interface Layer2Villa {
  construction_cost: number;
  soft_cost: number;
  land_cost: number;
  total_cost: number;
  cash_required: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface Layer2Metrics {
  total_villas: number;
  per_villa: Layer2Villa;
  total_cost: number;
  total_cash: number;
  total_revenue: number;
  total_profit: number;
  roi_on_cash: number;
  irr: number;
  timeline: number;
}

export interface CombinedMetrics {
  layer1: Layer1Metrics;
  layer2: Layer2Metrics;
  /** Total cash deployed across both layers */
  total_cash_deployed: number;
  /** Combined profit */
  total_profit: number;
}

// Ticket option for Layer 1 (land fund)
export interface TicketOption {
  label: string;
  amount: number;
  sqm: number;
  profit: number;
  roi: number;
}

// Ticket option for Layer 2 (villa development)
export interface VillaTicket {
  villas: number;
  total_cost: number;
  cash_required: number;
  projected_revenue: number;
  profit: number;
  roi_on_cash: number;
}

export interface LayerConfig extends LayerParams {
  _updated?: string;
}

// ─── Default Parameters ───────────────────────────────────────────────────────

export const DEFAULT_LAYER_PARAMS: LayerParams = {
  l1_fund: 2_300_000,
  l1_entry: 250,
  l1_exit: 310,
  l1_timeline: 2,

  plots: 5,
  villas_per_plot: 2,
  bua_per_villa: 300,
  land_per_villa: 600,
  construction_sqm: 600,
  selling_sqm: 1_350,
  soft_cost_pct: 0.1,
  l2_timeline: 3,
  land_transfer: 250,
  cash_pct: 0.3,
};

// Layer 1 ticket sizes (USD)
export const LAYER1_TICKET_SIZES = [50_000, 100_000, 200_000, 500_000, 1_000_000] as const;

// Layer 2 villa counts per ticket
export const LAYER2_VILLA_COUNTS = [1, 2, 3, 5] as const;

// ─── Pure Calculation Functions ───────────────────────────────────────────────

/**
 * Simple CAGR-based IRR approximation:
 *   IRR = (final / initial)^(1/years) − 1
 */
function calcIRR(initial: number, final: number, years: number): number {
  if (initial <= 0 || years <= 0) return 0;
  return Math.pow(final / initial, 1 / years) - 1;
}

/**
 * Calculate Layer 1 (Land Fund) metrics.
 */
export function calculateLayer1(p: LayerParams): Layer1Metrics {
  const sqm_acquired = p.l1_entry > 0 ? Math.floor(p.l1_fund / p.l1_entry) : 0;
  const exit_value = sqm_acquired * p.l1_exit;
  const profit = exit_value - p.l1_fund;
  const roi = p.l1_fund > 0 ? profit / p.l1_fund : 0;
  const irr = calcIRR(p.l1_fund, exit_value, p.l1_timeline);

  return {
    sqm_acquired,
    exit_value,
    profit,
    roi,
    irr,
    timeline: p.l1_timeline,
  };
}

/**
 * Calculate Layer 2 (Villa Development) metrics.
 */
export function calculateLayer2(p: LayerParams): Layer2Metrics {
  const total_villas = p.plots * p.villas_per_plot;

  // Per-villa economics
  const construction_cost = p.bua_per_villa * p.construction_sqm;
  const soft_cost = construction_cost * p.soft_cost_pct;
  const land_cost = p.land_per_villa * p.land_transfer;
  const total_cost = construction_cost + soft_cost + land_cost;
  const cash_required = total_cost * p.cash_pct;
  const revenue = p.bua_per_villa * p.selling_sqm;
  const profit = revenue - total_cost;
  const margin = revenue > 0 ? profit / revenue : 0;

  const per_villa: Layer2Villa = {
    construction_cost,
    soft_cost,
    land_cost,
    total_cost,
    cash_required,
    revenue,
    profit,
    margin,
  };

  // Portfolio totals
  const total_cost_all = total_cost * total_villas;
  const total_cash = cash_required * total_villas;
  const total_revenue = revenue * total_villas;
  const total_profit = total_revenue - total_cost_all;
  const roi_on_cash = total_cash > 0 ? total_profit / total_cash : 0;
  const irr = calcIRR(total_cash, total_cash + total_profit, p.l2_timeline);

  return {
    total_villas,
    per_villa,
    total_cost: total_cost_all,
    total_cash,
    total_revenue,
    total_profit,
    roi_on_cash,
    irr,
    timeline: p.l2_timeline,
  };
}

/**
 * Calculate combined metrics for both layers.
 */
export function calculateCombined(p: LayerParams): CombinedMetrics {
  const layer1 = calculateLayer1(p);
  const layer2 = calculateLayer2(p);

  return {
    layer1,
    layer2,
    total_cash_deployed: p.l1_fund + layer2.total_cash,
    total_profit: layer1.profit + layer2.total_profit,
  };
}

/**
 * Generate Layer 1 ticket options (various fund sizes → land portions).
 */
export function generateLayer1Tickets(p: LayerParams): TicketOption[] {
  const total_sqm = p.l1_entry > 0 ? Math.floor(p.l1_fund / p.l1_entry) : 0;
  return LAYER1_TICKET_SIZES.map((amount) => {
    const pct = p.l1_fund > 0 ? amount / p.l1_fund : 0;
    const sqm = Math.floor(total_sqm * pct);
    const l1 = calculateLayer1(p);
    const profit = l1.roi * amount;
    return {
      label: `$${(amount / 1000).toFixed(0)}K`,
      amount,
      sqm,
      profit: Math.round(profit),
      roi: l1.roi,
    };
  });
}

/**
 * Generate Layer 2 villa ticket options (buy 1/2/3/5 villas).
 */
export function generateLayer2Tickets(p: LayerParams): VillaTicket[] {
  const l2 = calculateLayer2(p);
  return LAYER2_VILLA_COUNTS.map((villas) => {
    const total_cost = l2.per_villa.total_cost * villas;
    const cash_required = l2.per_villa.cash_required * villas;
    const projected_revenue = l2.per_villa.revenue * villas;
    const profit = l2.per_villa.profit * villas;
    const roi_on_cash = cash_required > 0 ? profit / cash_required : 0;
    return {
      villas,
      total_cost: Math.round(total_cost),
      cash_required: Math.round(cash_required),
      projected_revenue: Math.round(projected_revenue),
      profit: Math.round(profit),
      roi_on_cash,
    };
  });
}

/**
 * Generate Layer 1 sensitivity matrix: entry price (rows) vs exit price (cols).
 * Returns a 2D array of roi values.
 */
export function layer1SensitivityMatrix(
  p: LayerParams,
  entryDeltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15],
  exitDeltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15],
): { entryDeltas: number[]; exitDeltas: number[]; cells: number[][] } {
  const cells = entryDeltas.map((de) => {
    return exitDeltas.map((dx) => {
      const entry = p.l1_entry * (1 + de);
      const exit = p.l1_exit * (1 + dx);
      const sqm = entry > 0 ? Math.floor(p.l1_fund / entry) : 0;
      const exitVal = sqm * exit;
      return exitVal - p.l1_fund;
    });
  });
  return { entryDeltas, exitDeltas, cells };
}

/**
 * Generate Layer 2 sensitivity matrix: construction cost (rows) vs selling price (cols).
 * Returns a 2D array of total_profit values.
 */
export function layer2SensitivityMatrix(
  p: LayerParams,
  constDeltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15],
  sellDeltas = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15],
): { constDeltas: number[]; sellDeltas: number[]; cells: number[][] } {
  const total_villas = p.plots * p.villas_per_plot;
  const cells = constDeltas.map((dc) => {
    return sellDeltas.map((ds) => {
      const construction_sqm = p.construction_sqm * (1 + dc);
      const selling_sqm = p.selling_sqm * (1 + ds);
      const c = p.bua_per_villa * construction_sqm;
      const soft = c * p.soft_cost_pct;
      const land = p.land_per_villa * p.land_transfer;
      const cost_per_villa = c + soft + land;
      const rev_per_villa = p.bua_per_villa * selling_sqm;
      const profit_per_villa = rev_per_villa - cost_per_villa;
      return profit_per_villa * total_villas;
    });
  });
  return { constDeltas, sellDeltas, cells };
}

// ─── Three-Party Investment Model ────────────────────────────────────────────
//
// THREE-PARTY INVESTMENT MODEL — Deddeh Hills
//
// PARTIES:
//   Owner (Landowner):     88.5% of each plot → contributes land as equity
//   Layer 1 Investor:      11.5% of each plot → buys land stake at $225/sqm
//   Layer 2 Investor:      Cash for construction → 50% of build cost + soft costs
//
// PER VILLA (300 sqm BUA on 600 sqm land, Phase 1 land = $275/sqm):
//   Construction:          300 × $600 = $180,000
//   Soft costs:            $180,000 × 10% = $18,000
//   Land (full):           600 × $275 = $165,000
//     → Owner's share:     $165,000 × 88.5% = $146,025
//     → L1's share:        $165,000 × 11.5% = $18,975
//   L2 investor cash:      50% × $180,000 + $18,000 = $108,000
//
// WATERFALL (per villa sale at $1,350/sqm = $405,000):
//   1. Return L2 cash:     $108,000
//   2. L1 land payment:    $18,975
//   3. Owner land equity:  $146,025
//   4. Remaining profit:   $132,000
//   5. [Optional] Priority: 10% × $108,000 = $10,800 to L2
//   6. Split remaining 50/50
//
// L1 FUND ($2.3M at $225/sqm):
//   Sqm acquired: 10,222 | Exit at $275 cap | Profit: $511K | ROI: 22.2%
//
// CONTINUATION: Phase 1 only. Phase 2+ at $312-350/sqm market rates.

/**
 * Per-lot retail pricing record — loaded from src/data/lot-prices.json.
 * villa_selling_sqm = price_sqm + 1000 (the "+$1,000 premium rule")
 */
export interface LotPricing {
  /** Lot number (1–103) */
  lot: number;
  /** Retail land price per sqm (from master plan) */
  price_sqm: number;
  /** Villa selling price = price_sqm + 1000 */
  villa_selling_sqm: number;
  /** CRM/sales status */
  status: "available" | "sold" | "booked";
  /** Primary view category */
  view: "sea_view" | "sea_mountain" | "mountain_sea" | "partial_sea" | "mountain";
  /** Zone label */
  zone: string;
  /** Development phase assigned by admin (1/2/3) */
  phase?: 1 | 2 | 3;
}

export interface InvestmentConfig {
  /** Landowner's share of each plot (e.g. 0.885) */
  ownerSharePerPlot: number;
  /** Layer 1 investor's share of each plot (e.g. 0.115) */
  l1InvestorShare: number;

  /** Layer 1: total fund size in USD */
  l1FundSize: number;
  /** Layer 1: land entry price per sqm (USD) */
  l1EntryPrice: number;
  /** Layer 1: exit price cap per sqm (USD) */
  l1ExitPriceCap: number;
  /** Layer 1: investment timeline in years */
  l1Timeline: number;
  /** Layer 1: max years within which exit cap is guaranteed */
  l1ExitCapYears: number;

  /** Layer 2: number of plots */
  plots: number;
  /** Layer 2: villas per plot */
  villasPerPlot: number;
  /** Layer 2: built-up area per villa in sqm */
  buaPerVilla: number;
  /** Layer 2: land area per villa in sqm */
  landPerVilla: number;
  /** Layer 2: construction cost per sqm (USD) */
  constructionCostSqm: number;
  /** Layer 2: target selling price per sqm (USD) */
  sellingPriceSqm: number;
  /** Layer 2: soft costs as fraction of construction cost */
  softCostPct: number;
  /** Layer 2: total timeline in years */
  l2Timeline: number;
  /**
   * Layer 2: cash % applied to construction cost ONLY (NOT land).
   * e.g. 0.50 means L2 investor pays 50% of (construction + soft) in cash.
   * Land transfer is always paid in full from villa sale proceeds.
   */
  cashPctOfConstruction: number;
  /** Total villas to be funded by L2 investors */
  investorFundedVillas: number;
  /** Minimum villas committed regardless of sales */
  minVillasToBuild: number;

  /** Phased land pricing (escalates per phase) */
  phaseLandPrices: { phase: number; pricePerSqm: number }[];

  /**
   * Land transfer pricing mode (ADMIN-ONLY — never show formula to investor).
   * "discount": transfer_price = lot.price_sqm − landTransferDiscount
   * "flat":     transfer_price = landTransferFlat (same for all lots)
   */
  landTransferMode: "flat" | "discount";
  /** Flat transfer price per sqm (used when landTransferMode = "flat") */
  landTransferFlat: number;
  /** Discount off retail price per sqm (used when landTransferMode = "discount") */
  landTransferDiscount: number;

  /** L2 investor's share of remaining profit (e.g. 0.50) */
  profitSplitInvestor: number;
  /** Owner's share of remaining profit (e.g. 0.50) */
  profitSplitOwner: number;
  /** Priority return as fraction of L2 cash (e.g. 0.10) */
  priorityReturnPct: number;
  /** Whether priority return is active */
  priorityEnabled: boolean;
}

export interface WaterfallResult {
  revenue: number;
  /** Full construction + soft cost for the villa */
  totalConstructionCost: number;
  /** L2 investor's initial cash (their equity portion of construction) */
  l2InvestorCash: number;
  /** Construction financing NOT funded by L2 investor (repaid from proceeds) */
  unfundedConstruction: number;
  /** Total land cost (L1 + owner shares combined) */
  totalLandCost: number;
  /** L1 investor's land stake payment from sale proceeds */
  l1LandPayment: number;
  /** Owner's land equity from sale proceeds */
  ownerLandEquity: number;
  /** Priority return amount (0 if not enabled) */
  priorityAmount: number;
  /** Remaining after ALL costs and priority — this is true project profit */
  remainingForSplit: number;
  /** L2 investor's profit (priority + split share of remaining) */
  l2InvestorProfit: number;
  /** L2 investor's total received (cash + profit) */
  l2InvestorTotal: number;
  /** L2 investor's ROI on cash deployed */
  l2InvestorROI: number;
  /** Owner's profit (split share of remaining) */
  ownerProfit: number;
  /** Owner's total (land equity + profit) — ADMIN ONLY */
  ownerTotal: number;
  /** L1 investor's total received (equals l1LandPayment) */
  l1Received: number;
}

export interface L1ExitOption {
  name: string;
  nameAr: string;
  trigger: string;
  exitPrice: number;
  totalReturn: number;
  profit: number;
  roi: number;
  irr: number;
  /** Cost to owner/project of facilitating this exit — ADMIN ONLY */
  ownerCost: number;
}

export interface L1Returns {
  sqmAcquired: number;
  exitValue: number;
  profit: number;
  roi: number;
  irr: number;
}

export const DEFAULT_INVESTMENT_CONFIG: InvestmentConfig = {
  ownerSharePerPlot: 0.885,
  l1InvestorShare: 0.115,

  l1FundSize: 2_300_000,
  l1EntryPrice: 225,
  l1ExitPriceCap: 275,
  l1Timeline: 2,
  l1ExitCapYears: 3,

  plots: 5,
  villasPerPlot: 2,
  buaPerVilla: 300,
  landPerVilla: 600,
  constructionCostSqm: 600,
  sellingPriceSqm: 1_350,
  softCostPct: 0.10,
  l2Timeline: 3,
  cashPctOfConstruction: 0.50,
  investorFundedVillas: 10,
  minVillasToBuild: 5,

  phaseLandPrices: [
    { phase: 1, pricePerSqm: 275 },
    { phase: 2, pricePerSqm: 312 },
    { phase: 3, pricePerSqm: 350 },
  ],

  profitSplitInvestor: 0.50,
  profitSplitOwner: 0.50,
  priorityReturnPct: 0.10,
  priorityEnabled: false,

  landTransferMode: "discount",
  landTransferFlat: 275,
  landTransferDiscount: 100,
};

// ─── Three-Party Calculation Functions ────────────────────────────────────────

/**
 * Resolve per-lot land transfer price from config + lot.
 * ADMIN-ONLY formula — never expose to investor.
 */
function resolveLandTransferPrice(
  config: InvestmentConfig,
  lot?: LotPricing,
  phaseIndex = 0,
): number {
  if (lot) {
    return config.landTransferMode === "discount"
      ? lot.price_sqm - config.landTransferDiscount
      : config.landTransferFlat;
  }
  return (
    config.phaseLandPrices[phaseIndex]?.pricePerSqm ??
    config.phaseLandPrices[0].pricePerSqm
  );
}

/**
 * Compute per-villa waterfall distribution across all three parties.
 *
 * CRITICAL FIX: cashPctOfConstruction applies to construction cost ONLY,
 * not to land transfer. Land transfer is settled from sale proceeds.
 *
 * @param phaseIndex — 0-based index into config.phaseLandPrices (ignored when lot provided)
 * @param lot        — optional per-lot pricing for per-lot calculations
 */
export function computeWaterfall(
  config: InvestmentConfig,
  phaseIndex = 0,
  lot?: LotPricing,
): WaterfallResult {
  const landPrice = resolveLandTransferPrice(config, lot, phaseIndex);
  // Villa selling price: per-lot if available, else config default
  const sellingPriceSqm = lot ? lot.villa_selling_sqm : config.sellingPriceSqm;

  // ── Land costs ──
  const totalLandCost = config.landPerVilla * landPrice;
  const l1LandPayment = totalLandCost * config.l1InvestorShare;
  const ownerLandEquity = totalLandCost * config.ownerSharePerPlot;

  // ── Construction costs ──
  const constructionCost = config.buaPerVilla * config.constructionCostSqm;
  const softCost = constructionCost * config.softCostPct;
  const totalConstructionCost = constructionCost + softCost;

  // L2 investor's cash equity = their % of construction + all soft costs
  const l2InvestorCash = constructionCost * config.cashPctOfConstruction + softCost;
  // Remaining construction NOT funded by L2 investor (financed, repaid from proceeds)
  const unfundedConstruction = totalConstructionCost - l2InvestorCash;

  // ── Revenue & profit ──
  const revenue = config.buaPerVilla * sellingPriceSqm;

  // Subtract ALL costs: investor cash + unfunded construction + land (L1 + owner)
  const afterAllCosts = revenue - l2InvestorCash - unfundedConstruction - l1LandPayment - ownerLandEquity;

  const priorityAmount = config.priorityEnabled
    ? l2InvestorCash * config.priorityReturnPct
    : 0;
  const remainingForSplit = afterAllCosts - priorityAmount;

  const l2InvestorProfit =
    priorityAmount + remainingForSplit * config.profitSplitInvestor;
  const ownerProfit = remainingForSplit * config.profitSplitOwner;

  const l2InvestorTotal = l2InvestorCash + l2InvestorProfit;
  const l2InvestorROI =
    l2InvestorCash > 0 ? l2InvestorProfit / l2InvestorCash : 0;
  const ownerTotal = ownerLandEquity + ownerProfit;

  return {
    revenue,
    totalConstructionCost,
    l2InvestorCash,
    unfundedConstruction,
    totalLandCost,
    l1LandPayment,
    ownerLandEquity,
    priorityAmount,
    remainingForSplit,
    l2InvestorProfit,
    l2InvestorTotal,
    l2InvestorROI,
    ownerProfit,
    ownerTotal,
    l1Received: l1LandPayment,
  };
}

/**
 * Compute Layer 1 fund returns.
 */
export function computeL1Returns(config: InvestmentConfig): L1Returns {
  const sqmAcquired =
    config.l1EntryPrice > 0
      ? Math.floor(config.l1FundSize / config.l1EntryPrice)
      : 0;
  const exitValue = sqmAcquired * config.l1ExitPriceCap;
  const profit = exitValue - config.l1FundSize;
  const roi = config.l1FundSize > 0 ? profit / config.l1FundSize : 0;
  const irr = calcIRR(config.l1FundSize, exitValue, config.l1Timeline);
  return { sqmAcquired, exitValue, profit, roi, irr };
}

/**
 * Compute Layer 1 exit option comparison (4 mechanisms).
 */
export function computeL1ExitOptions(config: InvestmentConfig): L1ExitOption[] {
  const l1 = computeL1Returns(config);
  return [
    {
      name: "Retail Lot Sales",
      nameAr: "مبيعات الأراضي بالتجزئة",
      trigger: "Direct land sales to retail buyers at market price",
      exitPrice: config.l1ExitPriceCap,
      totalReturn: l1.exitValue,
      profit: l1.profit,
      roi: l1.roi,
      irr: calcIRR(config.l1FundSize, l1.exitValue, config.l1ExitCapYears),
      ownerCost: 0,
    },
    {
      name: "Layer 2 Land Transfer",
      nameAr: "نقل الأراضي إلى المرحلة الثانية",
      trigger: "Layer 2 developer purchases L1 land stake at cap price for villa development",
      exitPrice: config.l1ExitPriceCap,
      totalReturn: l1.exitValue,
      profit: l1.profit,
      roi: l1.roi,
      irr: calcIRR(config.l1FundSize, l1.exitValue, 2.5),
      ownerCost: l1.profit * config.l1InvestorShare,
    },
    {
      name: "Accelerated Buyout",
      nameAr: "الاسترداد المتسارع",
      trigger: "Project allocates 2× villa sale proceeds to repurchase L1 stake",
      exitPrice: config.l1ExitPriceCap,
      totalReturn: l1.exitValue,
      profit: l1.profit,
      roi: l1.roi,
      irr: calcIRR(config.l1FundSize, l1.exitValue, 1.5),
      ownerCost: l1.profit,
    },
    {
      name: "Third-Party Sale",
      nameAr: "البيع لطرف ثالث",
      trigger: "L1 investor assigns their land stake to a new investor at any time",
      exitPrice: config.l1ExitPriceCap,
      totalReturn: l1.exitValue,
      profit: l1.profit,
      roi: l1.roi,
      irr: calcIRR(config.l1FundSize, l1.exitValue, 1),
      ownerCost: 0,
    },
  ];
}

/**
 * Compute cash sufficiency across 3 funding scenarios.
 * Each array has one entry per villa showing cumulative external cash required.
 */
export function computeCashSufficiency(config: InvestmentConfig): {
  noSales: number[];
  buildAndSell: number[];
  build5Stop: number[];
} {
  const n = config.investorFundedVillas;
  const wf = computeWaterfall(config, 0);
  const cashPerVilla = wf.l2InvestorCash;
  const returnPerVilla = wf.l2InvestorTotal;

  // Scenario 1: Fund all villas upfront — no sales revenue offsets cost
  const noSales = Array.from({ length: n }, (_, i) => cashPerVilla * (i + 1));

  // Scenario 2: Build one, sell one — sale revenue funds the next villa
  const buildAndSell: number[] = [];
  let externalTotal = 0;
  let pool = 0;
  for (let i = 0; i < n; i++) {
    const fromPool = Math.min(cashPerVilla, pool);
    const fresh = cashPerVilla - fromPool;
    externalTotal += fresh;
    pool = pool - fromPool + returnPerVilla;
    buildAndSell.push(Math.round(externalTotal));
  }

  // Scenario 3: Fund exactly minVillasToBuild then stop
  const build5Stop = Array.from({ length: n }, (_, i) =>
    Math.min(i + 1, config.minVillasToBuild) * cashPerVilla,
  );

  return { noSales, buildAndSell, build5Stop };
}

/**
 * Compute owner's cost of keeping the Layer 2 investor through Phase 2.
 * ADMIN-ONLY — never render this on the investor page.
 */
export function computeContinuationCost(
  config: InvestmentConfig,
  phase2Villas: number,
): {
  exitTotal: number;
  stayTotal: number;
  costOfKeeping: number;
} {
  // Phase 2 waterfall (index 1)
  const wf2 = computeWaterfall(config, 1);

  // If investor EXITS after Phase 1:
  // Owner builds Phase 2 with new/no investors — keeps all remaining profit
  const exitTotal = (wf2.ownerLandEquity + wf2.remainingForSplit) * phase2Villas;

  // If investor STAYS for Phase 2:
  // Owner shares profit 50/50 per waterfall
  const stayTotal = (wf2.ownerLandEquity + wf2.ownerProfit) * phase2Villas;

  // Cost = what owner gives up by keeping investor = investor's profit
  const costOfKeeping = exitTotal - stayTotal;

  return { exitTotal, stayTotal, costOfKeeping };
}

/**
 * Compute per-phase economics across all land price phases.
 * NOTE: ownerTake is ADMIN-ONLY — do not render on investor pages.
 */
export function computePhasedLandPricing(config: InvestmentConfig): Array<{
  phase: number;
  landPrice: number;
  villaProfit: number;
  investorROI: number;
  ownerTake: number;
}> {
  return config.phaseLandPrices.map((p, idx) => {
    const wf = computeWaterfall(config, idx);
    return {
      phase: p.phase,
      landPrice: p.pricePerSqm,
      villaProfit: wf.l2InvestorProfit + wf.ownerProfit,
      investorROI: wf.l2InvestorROI,
      ownerTake: wf.ownerTotal, // ADMIN-ONLY
    };
  });
}

export interface PhaseMetrics {
  /** Average retail land price ($/sqm) of lots in this phase */
  avgLandRetail: number;
  /** Average land transfer price (after discount/flat) */
  avgLandTransfer: number;
  /** Average villa selling price ($/sqm) */
  avgVillaSell: number;
  /** Average profit to L2 investor per villa */
  avgL2Profit: number;
  /** Average L2 ROI on cash */
  avgL2ROI: number;
  /** Total villa count (lots × villasPerPlot) */
  totalVillas: number;
  /** Total L2 cash required */
  totalCashNeeded: number;
  /** Total villa revenue */
  totalRevenue: number;
  /** Total L2 profit */
  totalProfit: number;
}

/**
 * Aggregate per-lot waterfall results for a phase.
 * Each lot produces config.villasPerPlot villas.
 * NOTE: avgLandTransfer and per-lot margins are ADMIN-ONLY.
 */
export function computePhaseMetrics(
  config: InvestmentConfig,
  lots: LotPricing[],
): PhaseMetrics {
  if (lots.length === 0) {
    return {
      avgLandRetail: 0,
      avgLandTransfer: 0,
      avgVillaSell: 0,
      avgL2Profit: 0,
      avgL2ROI: 0,
      totalVillas: 0,
      totalCashNeeded: 0,
      totalRevenue: 0,
      totalProfit: 0,
    };
  }

  const villasPerLot = config.villasPerPlot;

  const results = lots.map((lot) => computeWaterfall(config, 0, lot));

  const avgLandRetail =
    lots.reduce((s, l) => s + l.price_sqm, 0) / lots.length;
  const avgLandTransfer =
    lots.reduce((s, l) => s + resolveLandTransferPrice(config, l), 0) /
    lots.length;
  const avgVillaSell =
    lots.reduce((s, l) => s + l.villa_selling_sqm, 0) / lots.length;
  const avgL2Profit =
    results.reduce((s, wf) => s + wf.l2InvestorProfit, 0) / results.length;
  const avgL2ROI =
    results.reduce((s, wf) => s + wf.l2InvestorROI, 0) / results.length;

  const totalVillas = lots.length * villasPerLot;
  const totalCashNeeded =
    results.reduce((s, wf) => s + wf.l2InvestorCash, 0) * villasPerLot;
  const totalRevenue =
    results.reduce((s, wf) => s + wf.revenue, 0) * villasPerLot;
  const totalProfit =
    results.reduce((s, wf) => s + wf.l2InvestorProfit, 0) * villasPerLot;

  return {
    avgLandRetail,
    avgLandTransfer,
    avgVillaSell,
    avgL2Profit,
    avgL2ROI,
    totalVillas,
    totalCashNeeded,
    totalRevenue,
    totalProfit,
  };
}
