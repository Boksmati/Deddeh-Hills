/**
 * Co-development profit split (Tilal × HD), adapted from the
 * "DeddehHills Financial Simulation" Excel model.
 *
 * Layered on top of the project feasibility model: it consumes a deal's
 * gross profit / land value / build cost and splits the profit between two
 * partners by contribution ratio, net of a management fee and sales commission.
 *
 * Scale-invariant — call it for one lot, one typology, one phase, or the whole
 * project. Only the dollar magnitudes change; the ratios follow land:build.
 */

export type CoDevScenarioKey = "land_only" | "fifty_fifty" | "land_plus_half";

export interface CoDevInputs {
  /** Discounted land value contributed by Mahmoud/Tilal ($). */
  landValue: number;
  /** Total construction (+ soft) cost ($). */
  buildCost: number;
  /** Total sale revenue ($) — base for the sales commission. */
  revenue: number;
  /** Retail (undiscounted) land value ($) — for the "discount given" insight. */
  retailLandValue: number;
  /** Management fee as a fraction of construction (e.g. 0.05). Paid to HD. */
  mgmtFeePct: number;
  /** Sales commission as a fraction of revenue (e.g. 0.025). Paid to HD. */
  salesCommPct: number;
  /** Fraction of construction Mahmoud funds (0 = land only, 0.5 = half build). */
  mahmoudConstrPct: number;
  /** Cash-to-start as a fraction of capital deployed (e.g. 0.30). */
  equityPct: number;
}

export interface CoDevSplit {
  grossProfit: number;
  mgmtFee: number;
  salesComm: number;
  /** Profit pool shared by contribution ratio (gross − mgmt − sales). */
  netPool: number;

  mahmoudContrib: number;
  hdContrib: number;
  totalContrib: number;
  mahmoudShare: number;
  hdShare: number;

  /** Net to each party (Mahmoud = pool×share; HD = pool×share + mgmt + sales). */
  mahmoudNet: number;
  hdNet: number;

  /** Return on capital = net ÷ contribution. */
  mahmoudROC: number;
  hdROC: number;

  /** Cash to start = equity% × contribution. */
  mahmoudCash: number;
  hdCash: number;

  /** Cash-on-cash ROI = net ÷ cash-to-start. */
  mahmoudCashROI: number;
  hdCashROI: number;

  /** Land discount Mahmoud is effectively giving (retail − discounted land). */
  discountGiven: number;
  /** True when Mahmoud's net profit is below the discount he's granting. */
  discountExceedsProfit: boolean;
}

/** Construction-funding % that makes Mahmoud's total contribution = 50% of capital. */
export function fiftyFiftyConstrPct(landValue: number, buildCost: number): number {
  if (buildCost <= 0) return 0;
  const pct = (0.5 * (landValue + buildCost) - landValue) / buildCost;
  return Math.min(1, Math.max(0, pct));
}

/** Map a named scenario to Mahmoud's construction-funding fraction. */
export function scenarioConstrPct(
  scenario: CoDevScenarioKey,
  landValue: number,
  buildCost: number,
): number {
  switch (scenario) {
    case "land_only":      return 0;
    case "fifty_fifty":    return fiftyFiftyConstrPct(landValue, buildCost);
    case "land_plus_half": return 0.5;
  }
}

export function computeCoDevSplit(inp: CoDevInputs): CoDevSplit {
  const grossProfit = inp.revenue - inp.landValue - inp.buildCost;
  const mgmtFee = inp.buildCost * inp.mgmtFeePct;
  const salesComm = inp.revenue * inp.salesCommPct;
  const netPool = grossProfit - mgmtFee - salesComm;

  const mahmoudConstrib = inp.mahmoudConstrPct * inp.buildCost;
  const mahmoudContrib = inp.landValue + mahmoudConstrib;
  const hdContrib = (1 - inp.mahmoudConstrPct) * inp.buildCost;
  const totalContrib = mahmoudContrib + hdContrib;

  const mahmoudShare = totalContrib > 0 ? mahmoudContrib / totalContrib : 0;
  const hdShare = totalContrib > 0 ? hdContrib / totalContrib : 0;

  // Pool split by contribution; the two fees are paid to HD (manager + seller).
  const mahmoudNet = netPool * mahmoudShare;
  const hdNet = netPool * hdShare + mgmtFee + salesComm;

  const mahmoudROC = mahmoudContrib > 0 ? mahmoudNet / mahmoudContrib : 0;
  const hdROC = hdContrib > 0 ? hdNet / hdContrib : 0;

  const mahmoudCash = inp.equityPct * mahmoudContrib;
  const hdCash = inp.equityPct * hdContrib;
  const mahmoudCashROI = mahmoudCash > 0 ? mahmoudNet / mahmoudCash : 0;
  const hdCashROI = hdCash > 0 ? hdNet / hdCash : 0;

  const discountGiven = inp.retailLandValue - inp.landValue;

  return {
    grossProfit, mgmtFee, salesComm, netPool,
    mahmoudContrib, hdContrib, totalContrib, mahmoudShare, hdShare,
    mahmoudNet, hdNet,
    mahmoudROC, hdROC,
    mahmoudCash, hdCash, mahmoudCashROI, hdCashROI,
    discountGiven,
    discountExceedsProfit: discountGiven > mahmoudNet,
  };
}

/** Annualized ROI by exit year: Year N = (1 + cashROI)^(1/N) − 1. */
export function annualizedByExit(cashROI: number, year: number): number {
  if (year <= 1) return cashROI;
  return Math.pow(1 + cashROI, 1 / year) - 1;
}
