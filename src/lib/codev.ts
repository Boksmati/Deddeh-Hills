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

export function computeCoDevSplit(inp: CoDevInputs): CoDevSplit {
  const grossProfit = inp.revenue - inp.landValue - inp.buildCost;
  // Fees compensate HD for managing/selling construction, so they scale with HD's
  // construction-funding share. If Mahmoud funds 100% ("develops alone"), HD earns
  // nothing from that scope.
  const hdConstrShare = 1 - inp.mahmoudConstrPct;
  const mgmtFee = inp.buildCost * inp.mgmtFeePct * hdConstrShare;
  const salesComm = inp.revenue * inp.salesCommPct * hdConstrShare;
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

/** One scope's deal + its own Mahmoud construction-funding share + equity assumption. */
export interface CoDevLine {
  landValue: number;
  buildCost: number;
  revenue: number;
  retailLandValue: number;
  mahmoudConstrPct: number;
  /** Cash-to-start fraction for this line (e.g. 0.30). Lets cash figures stay
   *  consistent when typologies carry different equity assumptions. */
  equityPct: number;
}

/**
 * Aggregate a split across lines that each have their own funding % and equity.
 * This is the correct way to roll typology-level allocations up to a phase or
 * the whole project: compute each line's split, then sum the dollar fields and
 * re-derive the ratios. Applying one blended % to the summed land+build would be
 * wrong when typologies are funded differently.
 */
export function aggregateCoDevSplit(
  lines: CoDevLine[],
  mgmtFeePct: number,
  salesCommPct: number,
): CoDevSplit {
  let grossProfit = 0, mgmtFee = 0, salesComm = 0, netPool = 0;
  let mahmoudContrib = 0, hdContrib = 0;
  let mahmoudNet = 0, hdNet = 0;
  let mahmoudCash = 0, hdCash = 0;
  let discountGiven = 0;

  for (const ln of lines) {
    const s = computeCoDevSplit({ ...ln, mgmtFeePct, salesCommPct, equityPct: ln.equityPct });
    grossProfit += s.grossProfit;
    mgmtFee += s.mgmtFee;
    salesComm += s.salesComm;
    netPool += s.netPool;
    mahmoudContrib += s.mahmoudContrib;
    hdContrib += s.hdContrib;
    mahmoudNet += s.mahmoudNet;
    hdNet += s.hdNet;
    mahmoudCash += s.mahmoudCash;   // per-line equity × per-line contribution
    hdCash += s.hdCash;
    discountGiven += s.discountGiven;
  }

  const totalContrib = mahmoudContrib + hdContrib;
  const mahmoudShare = totalContrib > 0 ? mahmoudContrib / totalContrib : 0;
  const hdShare = totalContrib > 0 ? hdContrib / totalContrib : 0;
  const mahmoudROC = mahmoudContrib > 0 ? mahmoudNet / mahmoudContrib : 0;
  const hdROC = hdContrib > 0 ? hdNet / hdContrib : 0;
  const mahmoudCashROI = mahmoudCash > 0 ? mahmoudNet / mahmoudCash : 0;
  const hdCashROI = hdCash > 0 ? hdNet / hdCash : 0;

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
