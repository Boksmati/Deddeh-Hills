"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_COLORS } from "@/data/development-types";
import { DevelopmentType, TypeAssumption } from "@/types";
import { calculateSimulationSummary, calculateLotFinancials } from "@/engine/financial-engine";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useTranslations } from "@/i18n/useTranslations";
import { useInvestmentConfig } from "@/hooks/useInvestmentConfig";
import { computeContinuationCost, computeWaterfall } from "@/lib/investment-layers";

const EDITABLE_TYPES: DevelopmentType[] = ["twin_villa", "villa_2f", "villa_3f", "apartments", "lot_sale"];

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
function fmtUSD(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

interface FieldDef {
  key: keyof TypeAssumption;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  isPercent?: boolean;
  hint?: string;
}

const FIELDS: FieldDef[] = [
  { key: "sellingPricePerM",     label: "Selling Price",       unit: "$/m²",   step: 50,  min: 0, max: 10000 },
  { key: "constructionCostPerM", label: "Construction Cost",   unit: "$/m²",   step: 50,  min: 0, max: 5000  },
  { key: "avgUnitSize",          label: "Avg Unit Size",       unit: "m²",     step: 10,  min: 0, max: 2000  },
  { key: "commonAreaPct",        label: "Common Area",         unit: "%",      step: 1,   min: 0, max: 80, isPercent: true },
  { key: "maxFloors",            label: "Max Floors",          unit: "floors", step: 1,   min: 1, max: 6    },
  { key: "unitsPerLot",          label: "Units / Lot",         unit: "0=auto", step: 0.5, min: 0, max: 20,  hint: "0 = derive from area" },
  { key: "gardenAreaM",          label: "Garden",              unit: "m²/unit",step: 10,  min: 0, max: 2000, hint: "Outdoor area per unit" },
];

export default function AssumptionsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const setTypeAssumption = useSimulationStore((s) => s.setTypeAssumption);
  const resetTypeAssumptions = useSimulationStore((s) => s.resetTypeAssumptions);
  const assignments = useSimulationStore((s) => s.assignments);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const { t } = useTranslations();

  // ── Three-Party Investment Config
  const { config, setConfig, saveConfig, l1Returns, waterfall, phasedPricing, isLoading: configLoading } = useInvestmentConfig();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showInsights, setShowInsights] = useState(false);

  const continuationCost = useMemo(
    () => computeContinuationCost(config, 30),
    [config]
  );

  const waterfallWithPriority = useMemo(
    () => computeWaterfall({ ...config, priorityEnabled: true }, 0),
    [config]
  );

  async function handleSaveInvestmentConfig() {
    setSaveStatus("saving");
    await saveConfig();
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function updatePhaseLandPrice(phaseIdx: number, newPrice: number) {
    const updated = config.phaseLandPrices.map((p, i) =>
      i === phaseIdx ? { ...p, pricePerSqm: newPrice } : p
    );
    setConfig({ phaseLandPrices: updated });
  }

  const summary = useMemo(() => {
    const arr = Array.from(assignments.values());
    return calculateSimulationSummary(LOTS, arr, investorSharePct, typeAssumptions);
  }, [assignments, investorSharePct, typeAssumptions]);

  const phaseBUA = useMemo(() => {
    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const a of Array.from(assignments.values())) {
      if (a.developmentType === "unassigned" || a.phase === 0) continue;
      const lot = LOTS.find((l) => l.id === a.lotId);
      if (!lot) continue;
      const f = calculateLotFinancials(lot, a.developmentType, typeAssumptions[a.developmentType]);
      result[a.phase] = (result[a.phase] ?? 0) + f.sellableArea;
    }
    return result;
  }, [assignments, typeAssumptions]);

  function handleChange(type: DevelopmentType, field: FieldDef, raw: string) {
    let val = parseFloat(raw);
    if (isNaN(val)) return;
    if (field.isPercent) val = val / 100;
    val = Math.max(field.min / (field.isPercent ? 100 : 1), Math.min(field.max / (field.isPercent ? 100 : 1), val));
    setTypeAssumption(type, field.key, val);
  }

  function displayValue(type: DevelopmentType, field: FieldDef) {
    const v = typeAssumptions[type][field.key] as number;
    if (field.isPercent) return String(Math.round(v * 100));
    return String(v);
  }

  const isDisabledField = (type: DevelopmentType, field: FieldDef) =>
    type === "lot_sale" &&
    ["constructionCostPerM", "avgUnitSize", "commonAreaPct", "maxFloors", "unitsPerLot", "gardenAreaM"].includes(field.key);

  // Derived metrics per type (read-only)
  function getDerived(type: DevelopmentType) {
    const a = typeAssumptions[type];
    const grossPerM = a.sellingPricePerM - a.constructionCostPerM;
    const marginPct = a.sellingPricePerM > 0 ? grossPerM / a.sellingPricePerM : 0;
    const unitPrice = a.sellingPricePerM * a.avgUnitSize;
    const totalLotM = (a.unitsPerLot > 0 ? a.unitsPerLot : 1) * (a.avgUnitSize + a.gardenAreaM);
    return { grossPerM, marginPct, unitPrice, totalLotM };
  }

  const header = (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-dh-green rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">DH</span>
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">Development Assumptions</h1>
          <p className="text-[10px] text-gray-400">Edit financial parameters per typology</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a href="/simulator" className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          ← {t("nav_simulator")}
        </a>
        <a href="/investor" className="px-3 py-1.5 text-xs text-white bg-dh-green hover:bg-dh-green/90 rounded-lg transition-colors">
          {t("nav_investor")}
        </a>
        <a href="/customer" className="px-3 py-1.5 text-xs text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition-colors">
          {t("nav_customer")}
        </a>
        <LanguageToggle />
      </div>
    </header>
  );

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50">
        {header}
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="h-64 bg-white rounded-xl shadow-sm border border-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {header}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">

        {/* ── Assumptions Table ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Typology Assumptions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Changes apply instantly to all financial projections</p>
            </div>
            <button
              onClick={resetTypeAssumptions}
              className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wide w-40 sticky left-0 bg-gray-50 z-10">
                    Typology
                  </th>

                  {/* Editable: Pricing */}
                  <th colSpan={2} className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-l border-gray-100 bg-blue-50/30">
                    Pricing
                  </th>
                  {/* Editable: Product */}
                  <th colSpan={5} className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-l border-gray-100 bg-emerald-50/30">
                    Product
                  </th>
                  {/* Derived */}
                  <th colSpan={3} className="text-center px-4 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-l border-gray-200 bg-amber-50/40">
                    Derived Metrics
                  </th>
                </tr>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px]">
                  <th className="sticky left-0 bg-gray-50/70 z-10" />
                  {/* Pricing cols */}
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100 bg-blue-50/30">
                    Selling Price<div className="font-normal text-gray-400">$/m²</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap bg-blue-50/30">
                    Construction<div className="font-normal text-gray-400">$/m²</div>
                  </th>
                  {/* Product cols */}
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap border-l border-gray-100 bg-emerald-50/30">
                    Avg Unit Size<div className="font-normal text-gray-400">m²</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap bg-emerald-50/30">
                    Common Area<div className="font-normal text-gray-400">%</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap bg-emerald-50/30">
                    Max Floors<div className="font-normal text-gray-400">floors</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap bg-emerald-50/30">
                    Units / Lot<div className="font-normal text-gray-400">0=auto</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-gray-500 whitespace-nowrap bg-emerald-50/30">
                    Garden<div className="font-normal text-gray-400">m²/unit</div>
                  </th>
                  {/* Derived cols */}
                  <th className="text-center px-4 py-2 font-semibold text-amber-600 whitespace-nowrap border-l border-gray-200 bg-amber-50/40">
                    Unit Price<div className="font-normal text-amber-400">avg $</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-amber-600 whitespace-nowrap bg-amber-50/40">
                    Gross/m²<div className="font-normal text-amber-400">$</div>
                  </th>
                  <th className="text-center px-4 py-2 font-semibold text-amber-600 whitespace-nowrap bg-amber-50/40">
                    Margin<div className="font-normal text-amber-400">%</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {EDITABLE_TYPES.map((type) => {
                  const cfg = DEVELOPMENT_TYPES[type];
                  const a = typeAssumptions[type];
                  const d = getDerived(type);
                  const pricingFields = FIELDS.slice(0, 2);
                  const productFields = FIELDS.slice(2, 7);

                  return (
                    <tr key={type} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                          <span className="font-medium text-gray-800 whitespace-nowrap">{cfg.label}</span>
                        </div>
                      </td>

                      {/* Pricing fields */}
                      {pricingFields.map((field, i) => {
                        const disabled = isDisabledField(type, field);
                        return (
                          <td key={field.key} className={`px-4 py-3 text-center ${i === 0 ? "border-l border-gray-100 bg-blue-50/10" : "bg-blue-50/10"}`}>
                            {disabled ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <InputCell field={field} value={displayValue(type, field)} onChange={(v) => handleChange(type, field, v)} />
                            )}
                          </td>
                        );
                      })}

                      {/* Product fields */}
                      {productFields.map((field, i) => {
                        const disabled = isDisabledField(type, field);
                        return (
                          <td key={field.key} className={`px-4 py-3 text-center ${i === 0 ? "border-l border-gray-100 bg-emerald-50/10" : "bg-emerald-50/10"}`}>
                            {disabled ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <InputCell field={field} value={displayValue(type, field)} onChange={(v) => handleChange(type, field, v)} />
                                {field.hint && <span className="text-[9px] text-gray-300 whitespace-nowrap">{field.hint}</span>}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Derived: Unit Price */}
                      <td className="px-4 py-3 text-center border-l border-gray-200 bg-amber-50/20">
                        <span className="font-semibold text-amber-700 tabular-nums">
                          {type === "lot_sale" ? "—" : fmtUSD(d.unitPrice)}
                        </span>
                      </td>
                      {/* Derived: Gross/m² */}
                      <td className="px-4 py-3 text-center bg-amber-50/20">
                        <span className={`font-medium tabular-nums ${d.grossPerM >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                          {type === "lot_sale" ? "—" : `$${d.grossPerM.toFixed(0)}`}
                        </span>
                      </td>
                      {/* Derived: Margin % */}
                      <td className="px-4 py-3 text-center bg-amber-50/20">
                        <span className={`font-bold tabular-nums text-sm ${d.marginPct >= 0.3 ? "text-emerald-600" : d.marginPct >= 0.15 ? "text-amber-600" : "text-gray-800"}`}>
                          {type === "lot_sale" ? "—" : pct(d.marginPct)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-100 flex items-center gap-6 text-[10px] text-gray-400">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-100" />
              <span>Pricing inputs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-100" />
              <span>Product inputs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-100" />
              <span>Derived (read-only)</span>
            </div>
            <span className="ml-auto">Units/Lot = 0 means unit count is auto-derived from sellable area ÷ avg unit size</span>
          </div>
        </div>

        {/* ── Phase Financial Summary ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Projected Financials by Phase</h2>
            <p className="text-xs text-gray-400 mt-0.5">Based on current lot assignments and assumptions above</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wide">Phase</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Lots</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Units</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Sellable BUA m²</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Land Area m²</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Land Cost</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Construction</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">Net Profit</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide">ROI</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((phaseNum) => {
                  const p = summary.phaseBreakdown.find((x) => x.phase === phaseNum);
                  if (!p) return null;
                  return (
                    <tr key={phaseNum} className={`border-b border-gray-50 ${p.lotCount === 0 ? "opacity-40" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PHASE_COLORS[phaseNum] }} />
                          <span className="font-medium text-gray-800">Phase {phaseNum}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{p.lotCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(p.totalUnits)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(phaseBUA[phaseNum] ?? 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(p.totalArea)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUSD(p.totalLandCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtUSD(p.totalConstructionCost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-dh-green">{fmtUSD(p.totalRevenue)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums font-bold ${p.totalNetProfit >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                        {fmtUSD(p.totalNetProfit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-700">
                        {p.totalInvestment > 0 ? pct(p.roi) : "—"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{summary.assignedLots}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(summary.totalUnits)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(Object.values(phaseBUA).reduce((s, v) => s + v, 0))}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmt(summary.totalArea)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {fmtUSD(summary.phaseBreakdown.reduce((s, p) => s + p.totalLandCost, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {fmtUSD(summary.phaseBreakdown.reduce((s, p) => s + p.totalConstructionCost, 0))}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-dh-green">{fmtUSD(summary.totalRevenue)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-bold ${summary.totalProfit >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                    {fmtUSD(summary.totalProfit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-700">
                    {summary.totalInvestment > 0 ? pct(summary.overallROI) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Typology × Phase Matrix ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Typology × Phase Matrix</h2>
            <p className="text-xs text-gray-400 mt-0.5">BUA, units and revenue per development type per phase</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-semibold text-gray-500 uppercase tracking-wide">Typology</th>
                  {[1, 2, 3].map((p) => (
                    <th key={p} colSpan={4} className="text-center px-4 py-3 font-semibold text-gray-500 uppercase tracking-wide border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PHASE_COLORS[p] }} />
                        Phase {p}
                      </div>
                    </th>
                  ))}
                </tr>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-5 py-2" />
                  {[1, 2, 3].map((p) => (
                    <Fragment key={p}>
                      <th className="text-right px-3 py-2 font-medium text-gray-400 border-l border-gray-100">Lots</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-400">BUA m²</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-400">Units</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-400">Revenue</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EDITABLE_TYPES.map((type) => {
                  const cfg = DEVELOPMENT_TYPES[type];
                  const allZero = [1, 2, 3].every((phaseNum) => {
                    return Array.from(assignments.values()).filter(
                      (a) => a.phase === phaseNum && a.developmentType === type
                    ).length === 0;
                  });
                  if (allZero) return null;
                  return (
                    <tr key={type} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg.color }} />
                          <span className="font-medium text-gray-700">{cfg.label}</span>
                        </div>
                      </td>
                      {[1, 2, 3].map((phaseNum) => {
                        const phaseLots = Array.from(assignments.values()).filter(
                          (a) => a.phase === phaseNum && a.developmentType === type
                        );
                        const lotIds = phaseLots.map((a) => a.lotId);
                        const lots = LOTS.filter((l) => lotIds.includes(l.id));
                        const assumption = typeAssumptions[type];
                        const { totalUnits, totalRevenue, totalBUA } = lots.reduce(
                          (acc, lot) => {
                            const f = calculateLotFinancials(lot, type, assumption);
                            return { totalUnits: acc.totalUnits + f.numUnits, totalRevenue: acc.totalRevenue + f.revenue, totalBUA: acc.totalBUA + f.sellableArea };
                          },
                          { totalUnits: 0, totalRevenue: 0, totalBUA: 0 }
                        );
                        return (
                          <Fragment key={phaseNum}>
                            <td className="px-3 py-3 text-right tabular-nums text-gray-600 border-l border-gray-50">
                              {phaseLots.length || "—"}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                              {totalBUA > 0 ? fmt(totalBUA) : "—"}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-gray-600">
                              {totalUnits || "—"}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums text-gray-700 font-medium">
                              {totalRevenue > 0 ? fmtUSD(totalRevenue) : "—"}
                            </td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Three-Party Investment Config ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{t("inv_config_section_title")}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{t("inv_config_section_desc")}</p>
            </div>
            <button
              onClick={() => setShowInsights((s) => !s)}
              className="px-3 py-1.5 text-xs text-dh-green border border-dh-green/30 bg-dh-green/5 hover:bg-dh-green/10 rounded-lg transition-colors"
            >
              {showInsights ? "▲" : "▼"} {t("inv_config_insight_title")}
            </button>
          </div>

          {configLoading ? (
            <div className="p-6 text-xs text-gray-400 animate-pulse">Loading config…</div>
          ) : (
            <div className="p-6 space-y-8">

              {/* Ownership */}
              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">{t("inv_config_ownership")}</h3>
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <ConfigField
                    label={t("inv_config_owner_share")} unit="%"
                    value={+(config.ownerSharePerPlot * 100).toFixed(2)}
                    step={0.5} min={50} max={99}
                    onChange={(v) => setConfig({ ownerSharePerPlot: +(v / 100).toFixed(4), l1InvestorShare: +(1 - v / 100).toFixed(4) })}
                  />
                  <ConfigField
                    label={t("inv_config_l1_share")} unit="%"
                    value={+(config.l1InvestorShare * 100).toFixed(2)}
                    step={0.5} min={1} max={50}
                    onChange={(v) => setConfig({ l1InvestorShare: +(v / 100).toFixed(4), ownerSharePerPlot: +(1 - v / 100).toFixed(4) })}
                  />
                </div>
                {Math.abs(config.ownerSharePerPlot + config.l1InvestorShare - 1) > 0.001 && (
                  <p className="mt-2 text-xs text-red-500">⚠ Ownership shares must sum to 100%</p>
                )}
              </section>

              {/* Layer 1 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">{t("inv_config_l1_section")}</h3>
                <div className="grid grid-cols-3 gap-4 max-w-2xl">
                  <ConfigField label={t("inv_config_l1_fund_size")} unit="$" value={config.l1FundSize} step={100000} min={0} max={20000000}
                    onChange={(v) => setConfig({ l1FundSize: v })} />
                  <ConfigField label={t("inv_config_l1_entry")} unit="$/m²" value={config.l1EntryPrice} step={5} min={100} max={500}
                    onChange={(v) => setConfig({ l1EntryPrice: v })} />
                  <ConfigField label={t("inv_config_l1_exit_cap")} unit="$/m²" value={config.l1ExitPriceCap} step={5} min={100} max={600}
                    onChange={(v) => setConfig({ l1ExitPriceCap: v })} />
                  <ConfigField label={t("inv_config_l1_timeline")} unit="yrs" value={config.l1Timeline} step={0.5} min={1} max={10}
                    onChange={(v) => setConfig({ l1Timeline: v })} />
                  <ConfigField label={t("inv_config_l1_exit_cap_years")} unit="yrs" value={config.l1ExitCapYears} step={1} min={1} max={10}
                    onChange={(v) => setConfig({ l1ExitCapYears: v })} />
                </div>
              </section>

              {/* Layer 2 */}
              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">{t("inv_config_l2_section")}</h3>
                <div className="grid grid-cols-3 gap-4 max-w-2xl">
                  <ConfigField label={t("inv_config_cash_pct_const")} unit="%" value={+(config.cashPctOfConstruction * 100).toFixed(0)} step={5} min={20} max={100}
                    onChange={(v) => setConfig({ cashPctOfConstruction: v / 100 })} />
                  <ConfigField label={t("inv_config_priority_pct")} unit="%" value={+(config.priorityReturnPct * 100).toFixed(0)} step={1} min={0} max={30}
                    onChange={(v) => setConfig({ priorityReturnPct: v / 100 })} />
                  <ConfigField label={t("inv_config_profit_investor")} unit="%" value={+(config.profitSplitInvestor * 100).toFixed(0)} step={5} min={10} max={90}
                    onChange={(v) => setConfig({ profitSplitInvestor: +(v / 100).toFixed(2), profitSplitOwner: +(1 - v / 100).toFixed(2) })} />
                  <ConfigField label={t("inv_config_profit_owner")} unit="%" value={+(config.profitSplitOwner * 100).toFixed(0)} step={5} min={10} max={90}
                    onChange={(v) => setConfig({ profitSplitOwner: +(v / 100).toFixed(2), profitSplitInvestor: +(1 - v / 100).toFixed(2) })} />
                  <ConfigField label={t("inv_config_villas_total")} unit="" value={config.investorFundedVillas} step={1} min={1} max={50}
                    onChange={(v) => setConfig({ investorFundedVillas: v })} />
                  <ConfigField label={t("inv_config_villas_min")} unit="" value={config.minVillasToBuild} step={1} min={1} max={20}
                    onChange={(v) => setConfig({ minVillasToBuild: v })} />
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.priorityEnabled}
                    onChange={(e) => setConfig({ priorityEnabled: e.target.checked })}
                    className="w-4 h-4 accent-dh-green"
                  />
                  <span className="text-xs text-gray-700">{t("inv_config_priority_enabled")}</span>
                </label>
              </section>

              {/* Phased Land Pricing */}
              <section>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">{t("inv_config_phase_pricing")}</h3>
                <table className="text-xs border border-gray-100 rounded-lg overflow-hidden w-full max-w-2xl">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-semibold text-gray-500">Phase</th>
                      <th className="text-center px-4 py-2 font-semibold text-gray-500">Land Price ($/m²)</th>
                      <th className="text-center px-4 py-2 font-semibold text-gray-500">Villa Profit (L2)</th>
                      <th className="text-center px-4 py-2 font-semibold text-gray-500">L2 ROI on Cash</th>
                      <th className="text-center px-4 py-2 font-semibold text-gray-500">Owner Take / Villa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {config.phaseLandPrices.map((p, i) => {
                      const pp = phasedPricing[i];
                      return (
                        <tr key={p.phase} className="border-t border-gray-100">
                          <td className="px-4 py-2.5 font-medium text-gray-700">Phase {p.phase}</td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="number"
                              value={p.pricePerSqm}
                              step={5} min={100} max={1000}
                              onChange={(e) => updatePhaseLandPrice(i, parseFloat(e.target.value) || p.pricePerSqm)}
                              className="w-24 text-center px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-dh-green focus:ring-1 focus:ring-dh-green/20 tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-emerald-700 font-medium">
                            {pp ? fmtUSD(pp.villaProfit) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums font-bold text-dh-green">
                            {pp ? pct(pp.investorROI) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-gray-600">
                            {pp ? fmtUSD(pp.ownerTake) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              {/* Admin Live Insights */}
              {showInsights && (
                <section className="bg-dh-green/5 border border-dh-green/20 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-dh-green uppercase tracking-wide mb-4">
                    {t("inv_config_insight_title")}
                  </h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <InsightCard
                      label={t("inv_config_l1_roi")}
                      value={pct(l1Returns.roi)}
                      sub={`IRR ${pct(l1Returns.irr)} · ${l1Returns.sqmAcquired.toLocaleString()} m²`}
                    />
                    <InsightCard
                      label={t("inv_config_l2_roi_a")}
                      value={pct(waterfall.l2InvestorROI)}
                      sub={`Cash ${fmtUSD(waterfall.l2InvestorCash)} · Profit ${fmtUSD(waterfall.l2InvestorProfit)}`}
                    />
                    <InsightCard
                      label={t("inv_config_l2_roi_b")}
                      value={pct(waterfallWithPriority.l2InvestorROI)}
                      sub={`Priority ${fmtUSD(waterfallWithPriority.priorityAmount)}`}
                    />
                    <InsightCard
                      label={t("inv_config_owner_per_villa")}
                      value={fmtUSD(waterfall.ownerTotal)}
                      sub={`Land ${fmtUSD(waterfall.ownerLandEquity)} + Profit ${fmtUSD(waterfall.ownerProfit)}`}
                    />
                    <InsightCard
                      label={t("inv_config_continuation_cost")}
                      value={fmtUSD(continuationCost.costOfKeeping)}
                      sub={`Exit ${fmtUSD(continuationCost.exitTotal)} vs Stay ${fmtUSD(continuationCost.stayTotal)}`}
                    />
                  </div>
                </section>
              )}

              {/* Save */}
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={handleSaveInvestmentConfig}
                  disabled={saveStatus === "saving"}
                  className="px-5 py-2 text-xs font-semibold text-white bg-dh-green hover:bg-dh-green/90 disabled:opacity-50 rounded-lg transition-colors"
                >
                  {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? t("inv_config_saved") : t("inv_config_save")}
                </button>
                <span className="text-xs text-gray-400">Saved to Redis — applies to all connected users</span>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function InputCell({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      step={field.step}
      min={field.min}
      max={field.max}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 text-center px-2 py-1 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-dh-green focus:ring-1 focus:ring-dh-green/20 tabular-nums"
    />
  );
}

function ConfigField({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-gray-500 font-medium leading-tight">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-24 text-center px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-dh-green focus:ring-1 focus:ring-dh-green/20 tabular-nums"
        />
        {unit && <span className="text-[10px] text-gray-400 whitespace-nowrap">{unit}</span>}
      </div>
    </div>
  );
}

function InsightCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white border border-dh-green/15 rounded-lg p-3">
      <p className="text-[10px] text-gray-500 font-medium mb-1 leading-tight">{label}</p>
      <p className="text-lg font-bold text-dh-green tabular-nums">{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{sub}</p>
    </div>
  );
}
