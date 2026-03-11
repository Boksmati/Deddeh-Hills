import {
  Lot,
  DevelopmentType,
  LotFinancials,
  LotGroup,
  PhaseFinancials,
  Phase,
  SimulationSummary,
  LotAssignment,
  MassingSummary,
  MassingTypeBreakdown,
  TypeAssumption,
  InvestorScenarioResult,
  PhaseTicketInfo,
} from "@/types";
import { DEVELOPMENT_TYPES } from "@/data/development-types";

export function calculateLotFinancials(
  lot: Lot,
  devType: DevelopmentType,
  assumption?: TypeAssumption
): LotFinancials {
  const staticConfig = DEVELOPMENT_TYPES[devType];
  // Merge: assumption overrides static config fields
  const config = assumption ? { ...staticConfig, ...assumption } : staticConfig;

  if (devType === "unassigned") {
    return {
      lotId: lot.id,
      landCost: 0,
      sellableArea: 0,
      totalBUA: 0,
      numUnits: 0,
      constructionCost: 0,
      revenue: 0,
      grossProfit: 0,
      netProfit: 0,
      grossMargin: 0,
    };
  }

  const landCost = lot.area_sqm * lot.zone_price_discounted;

  if (devType === "lot_sale") {
    const revenue = lot.area_sqm * lot.zone_price_retail;
    return {
      lotId: lot.id,
      landCost,
      sellableArea: lot.area_sqm,
      totalBUA: 0,
      numUnits: 1,
      constructionCost: 0,
      revenue,
      grossProfit: revenue - landCost,
      netProfit: revenue - landCost,
      grossMargin: revenue > 0 ? (revenue - landCost) / revenue : 0,
    };
  }

  // For built development types
  const typeMaxFloors = assumption?.maxFloors
    ?? (devType === "villa_3f" || devType === "apartments" ? 3 : 2);
  const floors = Math.min(typeMaxFloors, lot.max_floors);

  const footprint = lot.area_sqm * lot.exploitation_ratio;
  const netFootprint = footprint * (1 - config.commonAreaPct);

  const baseBUA = netFootprint * floors;
  const balconies = baseBUA * 0.25;       // fixed 25% per floor
  const roofBUA = netFootprint;           // roof = same as exploitation footprint
  const ougArea = lot.oug_allowed ? netFootprint : 0;  // any oug_allowed lot
  const grossBUA = baseBUA + balconies + roofBUA + ougArea;
  const totalBUA = grossBUA;
  const sellableArea = grossBUA;
  const numUnits =
    (assumption?.unitsPerLot ?? 0) > 0
      ? Math.round(assumption!.unitsPerLot)
      : config.avgUnitSize > 0
      ? Math.max(1, Math.round(sellableArea / config.avgUnitSize))
      : 1;

  const constructionCost = sellableArea * config.constructionCostPerM;
  const revenue = sellableArea * config.sellingPricePerM;
  const grossProfit = revenue - constructionCost;
  const netProfit = grossProfit - landCost;

  return {
    lotId: lot.id,
    landCost,
    sellableArea: Math.round(sellableArea),
    totalBUA: Math.round(totalBUA),
    numUnits,
    constructionCost: Math.round(constructionCost),
    revenue: Math.round(revenue),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
  };
}

/** Calculates financials for a lot group by merging all member lots' geometry */
export function calculateGroupFinancials(
  lots: Lot[],
  group: LotGroup,
  assumptionsMap?: Partial<Record<DevelopmentType, TypeAssumption>>,
): LotFinancials {
  if (lots.length === 0) {
    return {
      lotId: group.id,
      isGroup: true,
      groupLotIds: group.lotIds,
      landCost: 0,
      sellableArea: 0,
      totalBUA: 0,
      numUnits: 0,
      constructionCost: 0,
      revenue: 0,
      grossProfit: 0,
      netProfit: 0,
      grossMargin: 0,
    };
  }

  const assumption = assumptionsMap?.[group.devType];

  // Merge lot geometry into a synthetic lot
  const mergedArea = lots.reduce((s, l) => s + l.area_sqm, 0);
  const mergedBUA = lots.reduce((s, l) => s + l.total_bua_sqm, 0);
  const avgExploitation = lots.reduce((s, l) => s + l.exploitation_ratio, 0) / lots.length;
  const anyOUG = lots.some((l) => l.oug_allowed);
  const minMaxFloors = Math.min(...lots.map((l) => l.max_floors));
  const avgZoneRetail = lots.reduce((s, l) => s + l.zone_price_retail, 0) / lots.length;
  const avgZoneDisc = lots.reduce((s, l) => s + l.zone_price_discounted, 0) / lots.length;

  const syntheticLot: Lot = {
    ...lots[0],
    area_sqm: mergedArea,
    total_bua_sqm: mergedBUA,
    exploitation_ratio: avgExploitation,
    max_floors: minMaxFloors,
    oug_allowed: anyOUG,
    zone_price_retail: avgZoneRetail,
    zone_price_discounted: avgZoneDisc,
  };

  // If custom units specified, build a fully-typed TypeAssumption with units overridden
  const staticConfig = DEVELOPMENT_TYPES[group.devType];
  const assumptionWithUnits: TypeAssumption | undefined =
    group.customUnits !== undefined
      ? {
          constructionCostPerM: assumption?.constructionCostPerM ?? staticConfig.constructionCostPerM,
          sellingPricePerM: assumption?.sellingPricePerM ?? staticConfig.sellingPricePerM,
          avgUnitSize: assumption?.avgUnitSize ?? staticConfig.avgUnitSize,
          commonAreaPct: assumption?.commonAreaPct ?? staticConfig.commonAreaPct,
          maxFloors: assumption?.maxFloors ?? syntheticLot.max_floors,
          gardenAreaM: assumption?.gardenAreaM ?? 0,
          unitsPerLot: group.customUnits,
        }
      : assumption;

  const result = calculateLotFinancials(syntheticLot, group.devType, assumptionWithUnits);
  return {
    ...result,
    lotId: group.id,
    isGroup: true,
    groupLotIds: group.lotIds,
  };
}

export function calculatePhaseFinancials(
  lots: Lot[],
  assignments: LotAssignment[],
  phase: Phase,
  assumptionsMap?: Partial<Record<DevelopmentType, TypeAssumption>>,
  lotGroups: LotGroup[] = []
): PhaseFinancials {
  const phaseLots = assignments.filter((a) => a.phase === phase);
  const lotMap = new Map(lots.map((l) => [l.id, l]));

  // Lots that belong to a group are handled separately
  const groupedLotIds = new Set(lotGroups.flatMap((g) => g.lotIds));

  let totalArea = 0;
  let totalUnits = 0;
  let totalLandCost = 0;
  let totalConstructionCost = 0;
  let totalRevenue = 0;
  let totalGrossProfit = 0;
  let totalNetProfit = 0;
  let marginSum = 0;
  let marginCount = 0;
  let lotCount = 0;

  // Individual (non-grouped) lots
  for (const assignment of phaseLots) {
    if (groupedLotIds.has(assignment.lotId)) continue; // handled by group
    const lot = lotMap.get(assignment.lotId);
    if (!lot || assignment.developmentType === "unassigned") continue;

    const assumption = assumptionsMap?.[assignment.developmentType];
    const financials = calculateLotFinancials(lot, assignment.developmentType, assumption);
    totalArea += lot.area_sqm;
    totalUnits += financials.numUnits;
    totalLandCost += financials.landCost;
    totalConstructionCost += financials.constructionCost;
    totalRevenue += financials.revenue;
    totalGrossProfit += financials.grossProfit;
    totalNetProfit += financials.netProfit;
    lotCount++;
    if (financials.grossMargin > 0) {
      marginSum += financials.grossMargin;
      marginCount++;
    }
  }

  // Groups in this phase
  for (const group of lotGroups) {
    if (group.phase !== phase || group.devType === "unassigned") continue;
    const groupLots = group.lotIds.map((id) => lotMap.get(id)).filter(Boolean) as Lot[];
    if (groupLots.length === 0) continue;
    const gf = calculateGroupFinancials(groupLots, group, assumptionsMap);
    totalArea += groupLots.reduce((s, l) => s + l.area_sqm, 0);
    totalUnits += gf.numUnits;
    totalLandCost += gf.landCost;
    totalConstructionCost += gf.constructionCost;
    totalRevenue += gf.revenue;
    totalGrossProfit += gf.grossProfit;
    totalNetProfit += gf.netProfit;
    lotCount++;
    if (gf.grossMargin > 0) {
      marginSum += gf.grossMargin;
      marginCount++;
    }
  }

  const totalInvestment = totalLandCost + totalConstructionCost;

  return {
    phase,
    lotCount,
    totalArea: Math.round(totalArea),
    totalUnits,
    totalLandCost: Math.round(totalLandCost),
    totalConstructionCost: Math.round(totalConstructionCost),
    totalInvestment: Math.round(totalInvestment),
    totalRevenue: Math.round(totalRevenue),
    totalGrossProfit: Math.round(totalGrossProfit),
    totalNetProfit: Math.round(totalNetProfit),
    avgGrossMargin: marginCount > 0 ? marginSum / marginCount : 0,
    roi: totalInvestment > 0 ? totalNetProfit / totalInvestment : 0,
  };
}

export function calculateSimulationSummary(
  lots: Lot[],
  assignments: LotAssignment[],
  investorSharePct: number,
  assumptionsMap?: Partial<Record<DevelopmentType, TypeAssumption>>,
  lotGroups: LotGroup[] = []
): SimulationSummary {
  const phase0 = calculatePhaseFinancials(lots, assignments, 0, assumptionsMap, lotGroups);
  const phase1 = calculatePhaseFinancials(lots, assignments, 1, assumptionsMap, lotGroups);
  const phase2 = calculatePhaseFinancials(lots, assignments, 2, assumptionsMap, lotGroups);
  const phase3 = calculatePhaseFinancials(lots, assignments, 3, assumptionsMap, lotGroups);

  const assigned = assignments.filter(
    (a) => a.developmentType !== "unassigned"
  );
  const totalInvestment =
    phase0.totalInvestment + phase1.totalInvestment + phase2.totalInvestment + phase3.totalInvestment;
  const totalRevenue =
    phase0.totalRevenue + phase1.totalRevenue + phase2.totalRevenue + phase3.totalRevenue;
  const totalProfit =
    phase0.totalNetProfit + phase1.totalNetProfit + phase2.totalNetProfit + phase3.totalNetProfit;

  const investorReturn = totalProfit * (investorSharePct / 100);
  const totalLandCost =
    phase0.totalLandCost + phase1.totalLandCost + phase2.totalLandCost + phase3.totalLandCost;
  const totalConstructionCost =
    phase0.totalConstructionCost + phase1.totalConstructionCost + phase2.totalConstructionCost + phase3.totalConstructionCost;

  return {
    totalLots: lots.length,
    assignedLots: assigned.length,
    totalArea: phase0.totalArea + phase1.totalArea + phase2.totalArea + phase3.totalArea,
    totalUnits: phase0.totalUnits + phase1.totalUnits + phase2.totalUnits + phase3.totalUnits,
    totalLandCost: Math.round(totalLandCost),
    totalConstructionCost: Math.round(totalConstructionCost),
    totalInvestment,
    totalRevenue,
    totalProfit,
    overallROI: totalInvestment > 0 ? totalProfit / totalInvestment : 0,
    investorShare: investorSharePct,
    investorReturn: Math.round(investorReturn),
    investorROI:
      totalInvestment > 0
        ? investorReturn / (totalInvestment * (investorSharePct / 100))
        : 0,
    phaseBreakdown: [phase1, phase2, phase3],
  };
}

export function calculateMassingSummary(
  lots: Lot[],
  assignments: LotAssignment[],
  assumptionsMap?: Partial<Record<DevelopmentType, TypeAssumption>>
): MassingSummary {
  const lotMap = new Map(lots.map((l) => [l.id, l]));
  const assignMap = new Map(assignments.map((a) => [a.lotId, a]));

  // Group by development type
  const groups = new Map<DevelopmentType, { lots: Lot[]; assignments: LotAssignment[] }>();

  for (const lot of lots) {
    const assignment = assignMap.get(lot.id);
    if (!assignment || assignment.developmentType === "unassigned") continue;

    const dt = assignment.developmentType;
    if (!groups.has(dt)) {
      groups.set(dt, { lots: [], assignments: [] });
    }
    const g = groups.get(dt)!;
    g.lots.push(lot);
    g.assignments.push(assignment);
  }

  const typeBreakdown: MassingTypeBreakdown[] = [];
  let totalLots = 0;
  let totalLandArea = 0;
  let totalSellableBUA = 0;
  let totalGrossBUA = 0;
  let totalUnits = 0;
  let totalLandCost = 0;
  let totalConstructionCost = 0;
  let totalRevenue = 0;
  let totalNetProfit = 0;
  let marginSum = 0;
  let marginCount = 0;

  for (const [dt, group] of Array.from(groups.entries())) {
    let groupLandArea = 0;
    let groupSellableBUA = 0;
    let groupUnits = 0;
    let groupRevenue = 0;
    let groupProfit = 0;

    for (const lot of group.lots) {
      const f = calculateLotFinancials(lot, dt, assumptionsMap?.[dt]);
      groupLandArea += lot.area_sqm;
      groupSellableBUA += f.sellableArea;
      groupUnits += f.numUnits;
      groupRevenue += f.revenue;
      groupProfit += f.netProfit;

      totalLandCost += f.landCost;
      totalConstructionCost += f.constructionCost;
      totalGrossBUA += f.totalBUA;

      if (f.grossMargin > 0) {
        marginSum += f.grossMargin;
        marginCount++;
      }
    }

    typeBreakdown.push({
      developmentType: dt,
      lotCount: group.lots.length,
      landArea: Math.round(groupLandArea),
      sellableBUA: Math.round(groupSellableBUA),
      unitCount: groupUnits,
      revenue: Math.round(groupRevenue),
      profit: Math.round(groupProfit),
    });

    totalLots += group.lots.length;
    totalLandArea += groupLandArea;
    totalSellableBUA += groupSellableBUA;
    totalUnits += groupUnits;
    totalRevenue += groupRevenue;
    totalNetProfit += groupProfit;
  }

  // Sort breakdown by lot count descending
  typeBreakdown.sort((a, b) => b.lotCount - a.lotCount);

  return {
    totalLots,
    totalLandArea: Math.round(totalLandArea),
    totalSellableBUA: Math.round(totalSellableBUA),
    totalGrossBUA: Math.round(totalGrossBUA),
    totalUnits,
    typeBreakdown,
    totalLandCost: Math.round(totalLandCost),
    totalConstructionCost: Math.round(totalConstructionCost),
    totalRevenue: Math.round(totalRevenue),
    totalNetProfit: Math.round(totalNetProfit),
    avgGrossMargin: marginCount > 0 ? marginSum / marginCount : 0,
  };
}

export function calculateInvestorScenario(
  summary: SimulationSummary,
  model: "share" | "land-equity" | "priority",
  params: {
    investorSharePct: number;
    landSharePct: number;
    cashToStartPct: number;
    priorityReturnRate: number;
    holdPeriodYears: number;
  }
): InvestorScenarioResult {
  const {
    investorSharePct,
    landSharePct,
    cashToStartPct,
    priorityReturnRate,
    holdPeriodYears,
  } = params;
  const shareFrac = investorSharePct / 100;
  const landFrac = landSharePct / 100;
  const cashFrac = cashToStartPct / 100;

  let investorCapital = 0;
  let investorReturn = 0;

  if (model === "share") {
    investorCapital = summary.totalInvestment * shareFrac;
    investorReturn = summary.totalProfit * shareFrac;
  } else if (model === "land-equity") {
    investorCapital =
      summary.totalLandCost * landFrac +
      summary.totalConstructionCost * shareFrac * cashFrac;
    investorReturn = summary.totalProfit * shareFrac;
  } else {
    // priority
    investorCapital = summary.totalInvestment * shareFrac;
    const preferredHurdle = investorCapital * (priorityReturnRate / 100) * holdPeriodYears;
    const priorityReturn = Math.min(summary.totalProfit, preferredHurdle);
    const upside = Math.max(summary.totalProfit - preferredHurdle, 0) * shareFrac;
    investorReturn = priorityReturn + upside;
  }

  const investorROI = investorCapital > 0 ? investorReturn / investorCapital : 0;
  const cashToStartCapital = investorCapital * cashFrac;
  const cashToStartROI = cashToStartCapital > 0 ? investorReturn / cashToStartCapital : 0;

  return {
    investorCapital: Math.round(investorCapital),
    investorReturn: Math.round(investorReturn),
    investorROI,
    cashToStartROI,
    investorProfitPct: summary.totalProfit > 0 ? investorReturn / summary.totalProfit : shareFrac,
    landCostCovered: Math.round(
      model === "land-equity"
        ? summary.totalLandCost * landFrac
        : summary.totalLandCost * shareFrac
    ),
    constructionCoverage: Math.round(
      model === "land-equity"
        ? summary.totalConstructionCost * shareFrac * cashFrac
        : summary.totalConstructionCost * shareFrac
    ),
  };
}

export function calculateTicketModel(
  summary: SimulationSummary,
  ticketSize: number
): PhaseTicketInfo[] {
  return summary.phaseBreakdown.map((phase) => {
    const phaseInvestment = phase.totalInvestment;
    const ticketsAvailable =
      phaseInvestment > 0 ? Math.floor(phaseInvestment / ticketSize) : 0;
    const returnPerTicket =
      phaseInvestment > 0
        ? (ticketSize / phaseInvestment) * phase.totalNetProfit
        : 0;
    const roiPerTicket = ticketSize > 0 ? returnPerTicket / ticketSize : 0;
    return {
      phase: phase.phase,
      phaseInvestment,
      phaseNetProfit: phase.totalNetProfit,
      phaseLandCost: phase.totalLandCost,
      phaseConstructionCost: phase.totalConstructionCost,
      ticketSize,
      ticketsAvailable,
      returnPerTicket: Math.round(returnPerTicket),
      roiPerTicket,
    };
  });
}

// ─── IRR / Exit Scenarios ────────────────────────────────────────────────────

/**
 * Annualized IRR for a simple 2-cashflow model (outflow t=0, inflow t=N).
 * Uses CAGR formula: (1 + totalROI)^(1/N) - 1
 */
export function calculateIRR(totalROI: number, holdYears: number): number {
  if (holdYears <= 0 || totalROI <= -1) return 0;
  return Math.pow(1 + totalROI, 1 / holdYears) - 1;
}

export interface ExitScenario {
  years: number;
  totalReturn: number;
  roi: number;
  irr: number;
}

/**
 * Returns exit scenarios for Year 3–6 hold periods given investor capital and return.
 */
export function calculateExitScenarios(
  investorCapital: number,
  investorReturn: number
): ExitScenario[] {
  const roi = investorCapital > 0 ? investorReturn / investorCapital : 0;
  return [3, 4, 5, 6].map((years) => ({
    years,
    totalReturn: investorCapital + investorReturn,
    roi,
    irr: calculateIRR(roi, years),
  }));
}
