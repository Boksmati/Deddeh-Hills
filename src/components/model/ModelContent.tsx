"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import CustomerMap from "@/components/customer/CustomerMap";
import { useTranslations } from "@/i18n/useTranslations";
import type { DevelopmentType, Phase, LotAssignment } from "@/types";
import type { LotPricing } from "@/lib/investment-layers";
import LOT_PRICES_RAW from "@/data/lot-prices.json";

const LOT_PRICES = LOT_PRICES_RAW as LotPricing[];
// Build a lookup: lot ID → retail price per sqm from lot-prices.json
const LOT_RETAIL_MAP = new Map(LOT_PRICES.map(lp => [lp.lot, lp.price_sqm]));

/* ────────────────────────────────────────────────────────────
   TYPES & CONSTANTS
   ──────────────────────────────────────────────────────────── */

interface TypologyInputs {
  commonAreaPct: number;
  exploitPct: number;
  floors: number;
  jamalonPct: number;
  undergroundPct: number;
  balconyPct: number;
  maxUnitsPerPlot: number;
  avgUnitSize: number;
  constructionCost: number;
  sellingPrice: number;   // used only in "average" mode
  profitMargin: number;   // used only in "by_location" cost-plus mode
  buaPerPlot: number;     // fixed allowable BUA per plot (e.g., 900 m²) for cost-plus
  equityPct: number;      // % of total investment the investor puts forward in cash (e.g. 0.30)
}

interface TypologyResult {
  numPlots: number;
  totalArea: number;
  commonArea: number;
  netArea: number;
  footprint: number;
  regularFloorArea: number;
  jamalonArea: number;
  undergroundArea: number;
  totalBuiltArea: number;
  totalUnits: number;
  unitsPerPlot: number;
  villaFootprint: number;
  lotPerVilla: number;
  garden: number;
  avgUnitPrice: number;
  grossProfitPerSqm: number;
  avgLandPriceSqm: number;
  landCost: number;
  grossCostPerSqm: number;
  netProfitPerSqm: number;
  totalSellableArea: number;
  /** Regulation maximum BUA (exploit × floors × land area) — before applying unit cap */
  potentialBUA: number;
  /** Total BUA per unit including underground share */
  sellableAreaPerUnit: number;
  totalConstructionCost: number;
  totalSales: number;
  grossProfit: number;
  netProfit: number;
  /** Weighted average selling price after per-lot adjustment */
  effectiveSellingPrice: number;
  /** Lowest per-lot adjusted selling price */
  sellingPriceMin: number;
  /** Highest per-lot adjusted selling price */
  sellingPriceMax: number;
  /** Land cost at L1 (−33% off retail) — early investor scenario */
  landCostL1: number;
  /** Net profit if land acquired at L1 */
  netProfitL1: number;
  /** ROI on equity at L2 land price (net profit ÷ equity deployed) */
  roiOnEquityL2: number;
  /** ROI on equity at L1 land price */
  roiOnEquityL1: number;
  /** Total investment (land + construction) at L2 */
  totalInvestmentL2: number;
  /** Cash equity deployed at L2 */
  cashEquityL2: number;
  /** Cash equity deployed at L1 (lower, since land is cheaper) */
  cashEquityL1: number;
}

type TypologyKey = "twin_villa" | "villa_2f" | "villa_3f" | "apartments";
const TYPOLOGY_KEYS: TypologyKey[] = ["twin_villa", "villa_2f", "villa_3f", "apartments"];

const TYPOLOGY_META: Record<TypologyKey, { label: string; labelAr: string; color: string }> = {
  twin_villa: { label: "Twin Villa", labelAr: "فيلا مزدوجة", color: "#1E88E5" },
  villa_2f:   { label: "Villa 2F",   labelAr: "فيلا طابقين", color: "#43A047" },
  villa_3f:   { label: "Villa 3F",   labelAr: "فيلا 3 طوابق", color: "#F4511E" },
  apartments: { label: "Apartments", labelAr: "شقق", color: "#FDD835" },
};

const DEFAULT_INPUTS: Record<TypologyKey, TypologyInputs> = {
  twin_villa: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 2,
    jamalonPct: 0, undergroundPct: 0, balconyPct: 0.25,
    maxUnitsPerPlot: 2, avgUnitSize: 300, constructionCost: 600, sellingPrice: 1400, profitMargin: 300, buaPerPlot: 900, equityPct: 0.30,
  },
  villa_2f: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 2,
    jamalonPct: 0, undergroundPct: 0, balconyPct: 0.25,
    maxUnitsPerPlot: 2, avgUnitSize: 600, constructionCost: 600, sellingPrice: 1500, profitMargin: 300, buaPerPlot: 900, equityPct: 0.30,
  },
  villa_3f: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 3,
    jamalonPct: 0, undergroundPct: 0.50, balconyPct: 0.25,
    maxUnitsPerPlot: 2, avgUnitSize: 600, constructionCost: 600, sellingPrice: 1300, profitMargin: 300, buaPerPlot: 900, equityPct: 0.30,
  },
  apartments: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 3,
    jamalonPct: 0, undergroundPct: 0, balconyPct: 0.25,
    maxUnitsPerPlot: 6, avgUnitSize: 150, constructionCost: 600, sellingPrice: 1100, profitMargin: 300, buaPerPlot: 900, equityPct: 0.30,
  },
};

/* ────────────────────────────────────────────────────────────
   CALCULATION ENGINE
   ──────────────────────────────────────────────────────────── */

const DEFAULT_L2_DISCOUNT = 0.20;
const DEFAULT_L1_DISCOUNT = 0.33;

type PricingMode = "average" | "by_location";

function calculateTypology(inputs: TypologyInputs, lots: typeof LOTS, pricingMode: PricingMode, l1Discount = DEFAULT_L1_DISCOUNT, l2Discount = DEFAULT_L2_DISCOUNT): TypologyResult {
  const numPlots = lots.length;
  const totalArea = lots.reduce((s, l) => s + l.area_sqm, 0);
  // Retail price from lot-prices.json (per-lot actual market price)
  const retailLandCost = lots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0);
  const avgRetailLandSqm = totalArea > 0 ? retailLandCost / totalArea : 0;
  // Land cost at L2 (off retail)
  const landCost = retailLandCost * (1 - l2Discount);
  const avgLandPriceSqm = totalArea > 0 ? landCost / totalArea : 0;
  // Land cost at L1 (early investor) — off retail
  const landCostL1 = retailLandCost * (1 - l1Discount);

  const commonArea = totalArea * inputs.commonAreaPct;
  const netArea = totalArea - commonArea;

  // Footprint = max buildable ground area (fixed by regulation)
  const footprint = totalArea * inputs.exploitPct;
  // Floor area = footprint × number of above-ground floors
  const regularFloorArea = footprint * inputs.floors;
  const jamalonArea = footprint * inputs.jamalonPct;
  const undergroundArea = footprint * inputs.undergroundPct;
  // Balconies only on above-ground area, not underground
  const aboveGroundArea = regularFloorArea + jamalonArea;
  const aboveGroundBUA = aboveGroundArea * (1 + inputs.balconyPct);
  const totalBuiltArea = aboveGroundBUA + undergroundArea;

  // ── Potential vs Actual ──────────────────────────────────────────────────
  // Potential BUA = regulation maximum (exploit × floors × land area)
  const potentialBUA = totalBuiltArea;

  // Actual units = capped by architectural design intent (max units per plot)
  const potentialUnitsFloat = inputs.avgUnitSize > 0 ? potentialBUA / inputs.avgUnitSize : 0;
  const maxAllowedUnits = numPlots * inputs.maxUnitsPerPlot;
  const totalUnits = Math.min(potentialUnitsFloat, maxAllowedUnits);

  // Per-unit BUA always = the input unit size (what each unit is designed to be)
  const sellableAreaPerUnit = inputs.avgUnitSize;
  const unitsPerPlot = numPlots > 0 ? totalUnits / numPlots : 0;
  // Villa footprint = actual building ground area per unit
  // Unit size (above-ground portion) includes balconies, so strip them out, then divide by floors
  const villaFootprint = inputs.floors > 0
    ? inputs.avgUnitSize / ((1 + inputs.balconyPct) * inputs.floors)
    : 0;
  // Land per villa = share of the net area (after common) each unit gets
  const lotPerVilla = totalUnits > 0 ? netArea / totalUnits : 0;
  const garden = lotPerVilla - villaFootprint;

  // ── If no units can be built, zero out all financials ──
  if (totalUnits <= 0) {
    return {
      numPlots, totalArea, commonArea, netArea, footprint,
      regularFloorArea, jamalonArea, undergroundArea, totalBuiltArea,
      totalUnits: 0, unitsPerPlot: 0, villaFootprint: 0, lotPerVilla: 0, garden: 0,
      potentialBUA: 0, avgUnitPrice: 0, grossProfitPerSqm: 0, avgLandPriceSqm, landCost,
      grossCostPerSqm: 0, netProfitPerSqm: 0, totalSellableArea: 0, sellableAreaPerUnit: inputs.avgUnitSize,
      totalConstructionCost: 0, totalSales: 0, grossProfit: 0, netProfit: -landCost,
      effectiveSellingPrice: inputs.sellingPrice, sellingPriceMin: inputs.sellingPrice, sellingPriceMax: inputs.sellingPrice,
      landCostL1, netProfitL1: -landCostL1,
      roiOnEquityL2: 0, roiOnEquityL1: 0, totalInvestmentL2: landCost, cashEquityL2: landCost * inputs.equityPct, cashEquityL1: landCostL1 * inputs.equityPct,
    };
  }

  // Actual sellable area = actual units built × unit size (capped by maxUnitsPerPlot)
  const totalSellableArea = totalUnits * inputs.avgUnitSize;

  // ── Selling price: average vs by-location (cost-plus) ──
  //
  // Cost-plus formula per lot:
  //   BUA per lot       = lot.area × exploitPct × floors
  //   Land cost / BUA m² = (l2_sqm × lot.area) / BUA = l2_sqm / (exploitPct × floors)
  //   Selling price /m²  = land_cost_per_bua + constructionCost + profitMargin
  //   Revenue per lot    = selling_price × BUA
  //   Net profit per lot = profitMargin × BUA  (guaranteed)
  //
  // regularFloorArea = totalArea × exploitPct × floors = total cost-plus BUA across all lots
  let totalSales = 0;
  let sellingPriceMin = inputs.sellingPrice;
  let sellingPriceMax = inputs.sellingPrice;
  let effectiveSellingPrice = inputs.sellingPrice;

  // Sellable area per plot = total sellable area ÷ number of plots
  const sellableAreaPerPlot = numPlots > 0 ? totalSellableArea / numPlots : 0;

  if (pricingMode === "by_location" && numPlots > 0 && sellableAreaPerPlot > 0) {
    sellingPriceMin = Infinity;
    sellingPriceMax = -Infinity;
    let weightedPriceSum = 0;
    for (const lot of lots) {
      const l2Sqm = (LOT_RETAIL_MAP.get(lot.id) ?? lot.zone_price_retail) * (1 - l2Discount);
      // Land cost per sellable m² = (l2_price_sqm × lot_area) / sellable area per plot
      const landCostPerSqm = (l2Sqm * lot.area_sqm) / sellableAreaPerPlot;
      const lotSellingPrice = landCostPerSqm + inputs.constructionCost + inputs.profitMargin;
      weightedPriceSum += lotSellingPrice;
      sellingPriceMin = Math.min(sellingPriceMin, lotSellingPrice);
      sellingPriceMax = Math.max(sellingPriceMax, lotSellingPrice);
    }
    if (!isFinite(sellingPriceMin)) sellingPriceMin = inputs.constructionCost + inputs.profitMargin;
    if (!isFinite(sellingPriceMax)) sellingPriceMax = inputs.constructionCost + inputs.profitMargin;
    // Effective selling price = simple avg across lots
    effectiveSellingPrice = numPlots > 0 ? weightedPriceSum / numPlots : inputs.constructionCost + inputs.profitMargin;
    // Revenue = sellable area × avg selling $/m²
    totalSales = totalSellableArea * effectiveSellingPrice;
  } else {
    totalSales = totalSellableArea * inputs.sellingPrice;
  }

  // Construction cost uses total BUA (sellable area per unit × units)
  const costBasis = totalSellableArea;

  const avgUnitPrice = sellableAreaPerUnit * effectiveSellingPrice;
  const grossProfitPerSqm = effectiveSellingPrice - inputs.constructionCost;
  const grossCostPerSqm = inputs.constructionCost + (costBasis > 0 ? landCost / costBasis : 0);
  const netProfitPerSqm = effectiveSellingPrice - grossCostPerSqm;

  const totalConstructionCost = costBasis * inputs.constructionCost;
  const grossProfit = totalSales - totalConstructionCost;
  const netProfit = grossProfit - landCost;

  const netProfitL1 = grossProfit - landCostL1;
  // ROI on equity = net profit ÷ cash deployed
  // Cash deployed = (land + construction) × equity%
  const totalInvestmentL2 = landCost + totalConstructionCost;
  const cashEquityL2 = totalInvestmentL2 * inputs.equityPct;
  const roiOnEquityL2 = cashEquityL2 > 0 ? (netProfit / cashEquityL2) * 100 : 0;
  const totalInvestmentL1 = landCostL1 + totalConstructionCost;
  const cashEquityL1 = totalInvestmentL1 * inputs.equityPct;
  const roiOnEquityL1 = cashEquityL1 > 0 ? (netProfitL1 / cashEquityL1) * 100 : 0;

  return {
    numPlots, totalArea, commonArea, netArea, footprint,
    regularFloorArea, jamalonArea, undergroundArea, totalBuiltArea,
    potentialBUA,
    totalUnits, unitsPerPlot, villaFootprint, lotPerVilla, garden,
    avgUnitPrice, grossProfitPerSqm, avgLandPriceSqm, landCost,
    grossCostPerSqm, netProfitPerSqm, totalSellableArea, sellableAreaPerUnit,
    totalConstructionCost, totalSales, grossProfit, netProfit,
    effectiveSellingPrice, sellingPriceMin, sellingPriceMax,
    landCostL1, netProfitL1,
    roiOnEquityL2, roiOnEquityL1, totalInvestmentL2, cashEquityL2, cashEquityL1,
  };
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000   ? `$${(n / 1_000).toFixed(0)}K`
  :                `$${n.toFixed(0)}`;

const fmtN = (n: number, d = 0) => n.toLocaleString("en-US", { maximumFractionDigits: d });
const fmtU = (n: number) => Number.isInteger(n)
  ? n.toLocaleString("en-US")
  : n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const PHASE_COLORS: Record<number, string> = { 1: "#2563eb", 2: "#7c3aed", 3: "#ea580c" };

/** Input that commits only on blur/Enter to avoid value getting clobbered mid-type */
function CommitInput({ value, onChange, className, min, max, step }: {
  value: number; onChange: (v: number) => void;
  className?: string; min?: number; max?: number; step?: number;
}) {
  const [local, setLocal] = useState(String(value));
  const [focused, setFocused] = useState(false);
  // Sync external value when not focused
  useEffect(() => { if (!focused) setLocal(String(value)); }, [value, focused]);
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(n);
  };
  return (
    <input
      type="number" min={min} max={max} step={step}
      className={className}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

/* ────────────────────────────────────────────────────────────
   SMALL COMPONENTS
   ──────────────────────────────────────────────────────────── */

function InputCell({
  label, value, onChange, suffix = "", step = 1, min = 0, isPct = false,
}: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; step?: number; min?: number; isPct?: boolean;
}) {
  const display = isPct ? (value ?? 0) * 100 : (value ?? 0);
  return (
    <div className="flex items-center justify-between gap-1 py-0.5">
      <span className="text-[10px] text-gray-500 truncate">{label}</span>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <input
          type="number"
          className="w-14 text-right text-[11px] font-medium bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={display}
          step={isPct ? step * 100 : step}
          min={isPct ? min * 100 : min}
          onChange={(e) => {
            const raw = parseFloat(e.target.value) || 0;
            onChange(isPct ? raw / 100 : raw);
          }}
        />
        {suffix && <span className="text-[9px] text-gray-400 w-4">{suffix}</span>}
      </div>
    </div>
  );
}

function Row({ label, value, bold, color, indent, tip }: {
  label: string; value: string; bold?: boolean; color?: string; indent?: boolean; tip?: string;
}) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${indent ? "pl-3" : ""}`} title={tip}>
      <span className={`text-[11px] ${bold ? "font-semibold text-gray-800" : "text-gray-500"} ${tip ? "border-b border-dotted border-gray-300 cursor-help" : ""}`}>{label}</span>
      <span className={`text-[11px] tabular-nums ${bold ? "font-bold" : "font-medium"}`}
        style={{ color: color ?? (bold ? "#1A3810" : "#374151") }}>{value}</span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   TYPOLOGY BREAKDOWN (compact, within a phase)
   ──────────────────────────────────────────────────────────── */

function TypologySection({
  typKey, inputs, result, onInputChange, lang, pricingMode, defaultOpen = false,
  avgL1Sqm = 0, avgL2Sqm = 0,
}: {
  typKey: TypologyKey; inputs: TypologyInputs; result: TypologyResult;
  onInputChange: (f: keyof TypologyInputs, v: number) => void;
  lang: string; pricingMode: PricingMode; defaultOpen?: boolean;
  avgL1Sqm?: number; avgL2Sqm?: number;
}) {
  const meta = TYPOLOGY_META[typKey];
  const [open, setOpen] = useState(defaultOpen);
  const [landScenario, setLandScenario] = useState<"L1" | "L2">("L2");

  // Derived net profit for the active land scenario
  const activeNetProfit = landScenario === "L1" ? result.netProfitL1 : result.netProfit;
  const activeLandCost  = landScenario === "L1" ? result.landCostL1  : result.landCost;

  if (result.numPlots === 0) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
      >
        {/* Left: identity + land context */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
            <span className="text-xs font-semibold text-gray-800">{lang === "ar" ? meta.labelAr : meta.label}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-gray-400 flex-wrap">
            <span><span className="text-gray-300 mr-0.5">plots</span>{result.numPlots}</span>
            <span><span className="text-gray-300 mr-0.5">area</span>{fmtN(result.totalArea, 0)} m²</span>
            <span title="Avg land price per m² at L2 (user-set or default discount)">
              <span className="text-gray-300 mr-0.5">L2</span>${fmtN(avgL2Sqm || result.avgLandPriceSqm, 0)}/m²
            </span>
            <span className="text-blue-300" title="Avg land price per m² at L1 (user-set or default discount)">
              <span className="mr-0.5">L1</span>${fmtN(avgL1Sqm || (result.totalArea > 0 ? result.landCostL1 / result.totalArea : 0), 0)}/m²
            </span>
          </div>
        </div>
        {/* Right: unit economics */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[9px] text-gray-300 leading-none mb-0.5">units</div>
            <div className="text-[10px] tabular-nums text-gray-500">{fmtU(result.totalUnits)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-300 leading-none mb-0.5">BUA</div>
            <div className="text-[10px] tabular-nums text-gray-500">{fmtN(result.totalSellableArea, 0)} m²</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-300 leading-none mb-0.5">revenue</div>
            <div className="text-[10px] tabular-nums font-semibold text-dh-green">{fmt(result.totalSales)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-300 leading-none mb-0.5">net profit <span className="text-[8px] opacity-60">({landScenario})</span></div>
            <div className={`text-[10px] tabular-nums font-bold ${activeNetProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {fmt(activeNetProfit)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-300 leading-none mb-0.5">margin</div>
            <div className={`text-[10px] tabular-nums ${activeNetProfit >= 0 ? "text-emerald-500" : "text-red-400"}`}>
              {result.totalSales > 0 ? ((activeNetProfit / result.totalSales) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <span className="text-gray-400 text-xs">{open ? "▼" : "▶"}</span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Inputs grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 bg-blue-50/30 rounded-lg p-2.5 border border-blue-100/60">
            <InputCell label="Common" value={inputs.commonAreaPct} onChange={v => onInputChange("commonAreaPct", v)} suffix="%" isPct step={0.01} />
            <InputCell label="Exploit" value={inputs.exploitPct} onChange={v => onInputChange("exploitPct", v)} suffix="%" isPct step={0.01} />
            <InputCell label="Floors" value={inputs.floors} onChange={v => onInputChange("floors", v)} min={1} />
            <InputCell label="Underground" value={inputs.undergroundPct} onChange={v => onInputChange("undergroundPct", v)} suffix="%" isPct step={0.01} />
            <InputCell label="Balconies" value={inputs.balconyPct} onChange={v => onInputChange("balconyPct", v)} suffix="%" isPct step={0.01} />
            <InputCell label="Unit size" value={inputs.avgUnitSize} onChange={v => onInputChange("avgUnitSize", v)} suffix="m²" step={10} />
            <InputCell label="Max units/plot" value={inputs.maxUnitsPerPlot} onChange={v => onInputChange("maxUnitsPerPlot", v)} min={1} />
            <InputCell label="Build $/m²" value={inputs.constructionCost} onChange={v => onInputChange("constructionCost", v)} suffix="$" step={50} />
            {pricingMode === "average"
              ? <InputCell label="Sell $/m²" value={inputs.sellingPrice} onChange={v => onInputChange("sellingPrice", v)} suffix="$" step={50} />
              : <InputCell label="Margin $/m²" value={inputs.profitMargin} onChange={v => onInputChange("profitMargin", v)} suffix="$" step={25} />
            }
            <InputCell label="Cash equity" value={inputs.equityPct} onChange={v => onInputChange("equityPct", v)} suffix="%" isPct step={0.05} />
            {inputs.jamalonPct > 0 && (
              <InputCell label="Jamalon" value={inputs.jamalonPct} onChange={v => onInputChange("jamalonPct", v)} suffix="%" isPct step={0.01} />
            )}
          </div>

          {/* 5-step calculation — compact 3-column layout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
            {/* Col 1: Land + Filla */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Land &amp; Filla</div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                <Row label="Total area" value={`${fmtN(result.totalArea, 0)} m²`} tip={`Sum of all lot areas in this typology (${result.numPlots} plots)`} />
                <Row label={`− Common (${(inputs.commonAreaPct*100).toFixed(0)}%)`} value={`${fmtN(result.commonArea, 0)} m²`} tip={`Total area × ${(inputs.commonAreaPct*100).toFixed(0)}% (${fmtN(result.totalArea,0)} × ${(inputs.commonAreaPct*100).toFixed(0)}% = ${fmtN(result.commonArea,0)} m²)`} />
                <Row label="Net area" value={`${fmtN(result.netArea, 0)} m²`} bold tip={`Total area − common area (${fmtN(result.totalArea,0)} − ${fmtN(result.commonArea,0)} = ${fmtN(result.netArea,0)} m²)`} />
              </div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                <Row label={`Footprint (${(inputs.exploitPct*100).toFixed(0)}%)`} value={`${fmtN(result.footprint, 0)} m²`} tip={`Total area × ${(inputs.exploitPct*100).toFixed(0)}% exploitation ratio (${fmtN(result.totalArea,0)} × ${(inputs.exploitPct*100).toFixed(0)}% = ${fmtN(result.footprint,0)} m²)`} />
                <Row label={`× ${inputs.floors} floors`} value={`${fmtN(result.regularFloorArea, 0)} m²`} indent tip={`Footprint × ${inputs.floors} floors (${fmtN(result.footprint,0)} × ${inputs.floors} = ${fmtN(result.regularFloorArea,0)} m²)`} />
                {inputs.undergroundPct > 0 && (
                  <Row label={`+ Underground (${(inputs.undergroundPct*100).toFixed(0)}%)`} value={`${fmtN(result.undergroundArea, 0)} m²`} indent tip={`Footprint × ${(inputs.undergroundPct*100).toFixed(0)}% (${fmtN(result.footprint,0)} × ${(inputs.undergroundPct*100).toFixed(0)}% = ${fmtN(result.undergroundArea,0)} m²)`} />
                )}
                <Row label="= Potential BUA" value={`${fmtN(result.potentialBUA, 0)} m²`} bold tip={`Regulation maximum: (floor area + jamalon) × (1 + ${(inputs.balconyPct*100).toFixed(0)}% balconies) + underground = ${fmtN(result.potentialBUA,0)} m². Actual build may be less if capped by max units/plot.`} />
              </div>
            </div>

            {/* Col 2: Geometry + Per-m² */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Unit Geometry</div>
              {(() => {
                const potentialUnits = inputs.avgUnitSize > 0 ? result.potentialBUA / inputs.avgUnitSize : 0;
                const isCapped = result.totalUnits < potentialUnits - 0.01;
                return (
                  <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                    <Row label="Actual units" value={fmtU(result.totalUnits)} bold tip={isCapped ? `Capped at ${inputs.maxUnitsPerPlot} units/plot × ${result.numPlots} plots = ${result.totalUnits} (potential ${fmtN(potentialUnits,1)} from BUA ÷ unit size)` : `Potential BUA ÷ unit size (${fmtN(result.potentialBUA, 0)} ÷ ${inputs.avgUnitSize} = ${fmtU(result.totalUnits)} units) — not capped`} />
                    {isCapped && (
                      <Row label={`  of ${fmtN(potentialUnits, 1)} potential`} value={`cap: ${inputs.maxUnitsPerPlot}/plot`} color="#9CA3AF" tip={`Design cap: ${inputs.maxUnitsPerPlot} units × ${result.numPlots} plots = ${result.totalUnits}. The regulation allows ${fmtN(potentialUnits,1)} units (${fmtN(result.potentialBUA,0)} m² ÷ ${inputs.avgUnitSize} m²/unit), but design limits each plot to ${inputs.maxUnitsPerPlot} units.`} />
                    )}
                    <Row label="Unit size" value={`${fmtN(result.sellableAreaPerUnit, 0)} m²`} tip={`Designed unit size input: ${inputs.avgUnitSize} m² per unit`} />
                    <Row label="Units / plot" value={fmtN(result.unitsPerPlot, 2)} tip={`Actual units ÷ number of plots (${fmtN(result.totalUnits,1)} ÷ ${result.numPlots} = ${fmtN(result.unitsPerPlot,2)})`} />
                    <Row label="Villa footprint" value={`${fmtN(result.villaFootprint, 0)} m²`} tip={`Unit size ÷ (floors × (1 + balcony%)) = ${inputs.avgUnitSize} ÷ (${inputs.floors} × ${(1+inputs.balconyPct).toFixed(2)}) = ${fmtN(result.villaFootprint,0)} m²`} />
                    <Row label="Lot / villa" value={`${fmtN(result.lotPerVilla, 0)} m²`} tip={`Net area ÷ actual units (${fmtN(result.netArea,0)} ÷ ${fmtN(result.totalUnits,1)} = ${fmtN(result.lotPerVilla,0)} m²)`} />
                    <Row label="Garden" value={`${fmtN(Math.max(0, result.garden), 0)} m²`} color="#00B050" tip={`Lot per villa − villa footprint (${fmtN(result.lotPerVilla,0)} − ${fmtN(result.villaFootprint,0)} = ${fmtN(Math.max(0,result.garden),0)} m²)`} />
                  </div>
                );
              })()}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Per Unit</div>
                {/* Land scenario toggle */}
                <div className="flex items-center rounded-full border border-gray-200 overflow-hidden text-[9px] font-semibold">
                  {(["L2", "L1"] as const).map(s => (
                    <button
                      key={s}
                      onClick={e => { e.stopPropagation(); setLandScenario(s); }}
                      className={`px-2 py-0.5 transition-colors ${landScenario === s
                        ? s === "L2" ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                        : "text-gray-400 hover:bg-gray-100"}`}
                    >
                      {s === "L2" ? "L2 −20%" : "L1 −33%"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                {/* Pricing reference row — market comparison */}
                <Row
                  label={pricingMode === "by_location" ? "Sell $/m² (avg)" : "Sell $/m²"}
                  value={`$${fmtN(result.effectiveSellingPrice, 0)}`}
                  tip={pricingMode === "by_location"
                    ? `Weighted avg: (L2 land $/m² × lot area ÷ sellable area/plot ${fmtN(result.totalSellableArea / result.numPlots, 0)}m²) + $${inputs.constructionCost} + $${inputs.profitMargin} margin → avg $${fmtN(result.effectiveSellingPrice,0)}/m²`
                    : `Flat selling price: $${fmtN(result.effectiveSellingPrice,0)}/m² (average mode)`}
                />
                {result.sellingPriceMin !== result.sellingPriceMax && (
                  <Row
                    label="Sell $/m² range"
                    value={`$${fmtN(result.sellingPriceMin, 0)} – $${fmtN(result.sellingPriceMax, 0)}`}
                    color="#6366f1"
                    tip={`Per-lot selling price range driven by location-based land cost: $${fmtN(result.sellingPriceMin,0)} – $${fmtN(result.sellingPriceMax,0)}/m²`}
                  />
                )}
                {/* L1 sell price: same margin/construction, but land cheaper → lower cost-plus price */}
                {pricingMode === "by_location" && result.totalSellableArea > 0 && avgL2Sqm > 0 && (() => {
                  const landRatio = result.totalArea / result.totalSellableArea;
                  const sellAtL1 = result.effectiveSellingPrice + (avgL1Sqm - avgL2Sqm) * landRatio;
                  return (
                    <Row
                      label="→ Sell $/m² at L1"
                      value={`$${fmtN(sellAtL1, 0)}`}
                      color="#3B82F6"
                      tip={`At L1 land ($${fmtN(avgL1Sqm,0)}/m²): land cost/BUA = $${fmtN(avgL1Sqm * landRatio,0)}/m² vs L2 $${fmtN(avgL2Sqm * landRatio,0)}/m² → sell at $${fmtN(sellAtL1,0)}/m² (same $${inputs.profitMargin} margin)`}
                    />
                  );
                })()}
                {/* Per-unit P&L */}
                {(() => {
                  const revenuePerUnit = result.avgUnitPrice;
                  const constructionPerUnit = inputs.constructionCost * result.sellableAreaPerUnit;
                  const landPerUnit = result.totalUnits > 0 ? activeLandCost / result.totalUnits : 0;
                  const grossPerUnit = revenuePerUnit - constructionPerUnit;
                  const netPerUnit = grossPerUnit - landPerUnit;
                  const scenarioLabel = landScenario === "L1" ? "L1 (−33%)" : "L2 (−20%)";
                  return (
                    <>
                      <div className="border-t border-gray-200 my-0.5" />
                      <Row label="Revenue/unit" value={fmt(revenuePerUnit)} bold tip={`Sell $/m² × unit size (${fmtN(result.effectiveSellingPrice,0)} × ${fmtN(result.sellableAreaPerUnit,0)} m² = ${fmt(revenuePerUnit)})`} />
                      <Row label="Construction/unit" value={`−${fmt(constructionPerUnit)}`} color="#E53E3E" tip={`Build $/m² × unit size ($${inputs.constructionCost} × ${fmtN(result.sellableAreaPerUnit,0)} m² = ${fmt(constructionPerUnit)})`} />
                      <Row label={`Land/unit (${scenarioLabel})`} value={`−${fmt(landPerUnit)}`} color="#E53E3E" tip={`${scenarioLabel} total land ÷ units (${fmt(activeLandCost)} ÷ ${fmtN(result.totalUnits,0)} = ${fmt(landPerUnit)})`} />
                      <div className="border-t border-gray-200 my-0.5" />
                      <Row label="Net profit/unit" value={fmt(netPerUnit)} bold color={netPerUnit >= 0 ? "#00B050" : "#E53E3E"} tip={`Revenue − construction − land@${scenarioLabel} (${fmt(revenuePerUnit)} − ${fmt(constructionPerUnit)} − ${fmt(landPerUnit)} = ${fmt(netPerUnit)})`} />
                      <Row label="Margin/unit" value={`${revenuePerUnit > 0 ? ((netPerUnit / revenuePerUnit) * 100).toFixed(1) : 0}%`} color={netPerUnit >= 0 ? "#00B050" : "#E53E3E"} tip={`Net profit ÷ revenue per unit (${fmt(netPerUnit)} ÷ ${fmt(revenuePerUnit)} = ${revenuePerUnit > 0 ? ((netPerUnit / revenuePerUnit) * 100).toFixed(1) : 0}%)`} />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Col 3: Totals P&L */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Actual Build &amp; P&amp;L</div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                {(() => {
                  const potentialUnits = inputs.avgUnitSize > 0 ? result.potentialBUA / inputs.avgUnitSize : 0;
                  const isCapped = result.totalUnits < potentialUnits - 0.01;
                  return (
                    <>
                      {isCapped && (
                        <Row label="Potential BUA" value={`${fmtN(result.potentialBUA, 0)} m²`} color="#9CA3AF" tip={`Regulation maximum: ${fmtN(potentialUnits,1)} potential units × ${inputs.avgUnitSize} m² = ${fmtN(result.potentialBUA,0)} m² — capped by ${inputs.maxUnitsPerPlot} units/plot design limit`} />
                      )}
                      <Row label="Actual BUA" value={`${fmtN(result.totalSellableArea, 0)} m²`} bold tip={`Actual units built × unit size (${fmtN(result.totalUnits,2)} × ${fmtN(result.sellableAreaPerUnit,0)} m² = ${fmtN(result.totalSellableArea,0)} m²)${isCapped ? ` — capped from ${fmtN(result.potentialBUA,0)} m² potential` : ""}`} />
                    </>
                  );
                })()}
                <Row label="Construction" value={fmt(result.totalConstructionCost)} color="#E53E3E" tip={`Actual BUA × construction $/m² (${fmtN(result.totalSellableArea,0)} × $${inputs.constructionCost} = ${fmt(result.totalConstructionCost)})`} />
                <Row label="Total sales" value={fmt(result.totalSales)} bold tip={`Actual BUA × avg selling $/m² (${fmtN(result.totalSellableArea,0)} × $${fmtN(result.effectiveSellingPrice,0)} = ${fmt(result.totalSales)})`} />
                <Row label="Gross profit" value={fmt(result.grossProfit)} tip={`Total sales − construction (${fmt(result.totalSales)} − ${fmt(result.totalConstructionCost)} = ${fmt(result.grossProfit)})`} />
                <Row label="Land cost (L2 −20%)" value={fmt(result.landCost)} color="#E53E3E" tip={`Sum of (lot area × retail $/m²) × (1 − 20%) = ${fmt(result.landCost)}`} />
                <Row label="Land cost (L1 −33%)" value={fmt(result.landCostL1)} color="#C05621" indent tip={`Sum of (lot area × retail $/m²) × (1 − 33%) = ${fmt(result.landCostL1)}`} />
              </div>
              {/* Per Villa breakdown */}
              {result.totalUnits > 0 && (
                <div className="bg-blue-50/60 rounded-lg p-2 space-y-0.5">
                  <div className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">Per Villa</div>
                  <Row label="BUA" value={`${fmtN(result.sellableAreaPerUnit, 0)} m²`} tip={`Designed unit size: ${inputs.avgUnitSize} m² per unit`} />
                  <Row label="Land cost" value={fmt(result.landCost / result.totalUnits)} color="#E53E3E" tip={`Total land ÷ units (${fmt(result.landCost)} ÷ ${result.totalUnits.toFixed(2)} = ${fmt(result.landCost / result.totalUnits)})`} />
                  <Row label="Construction" value={fmt(result.totalConstructionCost / result.totalUnits)} color="#E53E3E" tip={`Unit size × build $/m² (${inputs.avgUnitSize} × $${inputs.constructionCost} = ${fmt(inputs.avgUnitSize * inputs.constructionCost)})`} />
                  <Row label="Sale price" value={fmt(result.totalSales / result.totalUnits)} bold tip={`Total sales ÷ units (${fmt(result.totalSales)} ÷ ${result.totalUnits.toFixed(2)} = ${fmt(result.totalSales / result.totalUnits)})`} />
                  <Row label="Net profit" value={fmt(result.netProfit / result.totalUnits)} bold color={result.netProfit >= 0 ? "#00B050" : "#E53E3E"} tip={`Total net profit ÷ units (${fmt(result.netProfit)} ÷ ${result.totalUnits.toFixed(2)} = ${fmt(result.netProfit / result.totalUnits)})`} />
                </div>
              )}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 space-y-0.5">
                <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 mb-0.5">At L2 (−20%)</div>
                <Row label="Net profit" value={fmt(result.netProfit)} bold color={result.netProfit >= 0 ? "#00B050" : "#E53E3E"} tip={`Gross profit − land cost L2 (${fmt(result.grossProfit)} − ${fmt(result.landCost)} = ${fmt(result.netProfit)})`} />
                <Row label="Margin" value={`${result.totalSales > 0 ? ((result.netProfit / result.totalSales) * 100).toFixed(1) : 0}%`} color={result.netProfit >= 0 ? "#00B050" : "#E53E3E"} tip={`Net profit ÷ total sales (${fmt(result.netProfit)} ÷ ${fmt(result.totalSales)} = ${result.totalSales > 0 ? ((result.netProfit / result.totalSales) * 100).toFixed(1) : 0}%)`} />
                <Row label={`ROI on ${(inputs.equityPct*100).toFixed(0)}% equity`} value={`${result.roiOnEquityL2.toFixed(1)}%`} bold color={result.roiOnEquityL2 >= 0 ? "#00B050" : "#E53E3E"} tip={`Net profit ÷ cash equity (${fmt(result.netProfit)} ÷ ${fmt(result.cashEquityL2)} = ${result.roiOnEquityL2.toFixed(1)}%) — equity = ${(inputs.equityPct*100).toFixed(0)}% × (land ${fmt(result.landCost)} + construction ${fmt(result.totalConstructionCost)}) = ${fmt(result.cashEquityL2)}`} />
                <div className="border-t border-emerald-200 my-0.5" />
                <div className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">At L1 (−33%) early entry</div>
                <Row label="Net profit" value={fmt(result.netProfitL1)} bold color={result.netProfitL1 >= 0 ? "#1D6FA4" : "#E53E3E"} tip={`Gross profit − land cost L1 (${fmt(result.grossProfit)} − ${fmt(result.landCostL1)} = ${fmt(result.netProfitL1)})`} />
                <Row label="Margin" value={`${result.totalSales > 0 ? ((result.netProfitL1 / result.totalSales) * 100).toFixed(1) : 0}%`} color={result.netProfitL1 >= 0 ? "#1D6FA4" : "#E53E3E"} tip={`L1 net profit ÷ total sales (${fmt(result.netProfitL1)} ÷ ${fmt(result.totalSales)} = ${result.totalSales > 0 ? ((result.netProfitL1 / result.totalSales) * 100).toFixed(1) : 0}%)`} />
                <Row label={`ROI on ${(inputs.equityPct*100).toFixed(0)}% equity`} value={`${result.roiOnEquityL1.toFixed(1)}%`} bold color={result.roiOnEquityL1 >= 0 ? "#1D6FA4" : "#E53E3E"} tip={`L1 net profit ÷ cash equity at L1 (${fmt(result.netProfitL1)} ÷ ${fmt(result.cashEquityL1)} = ${result.roiOnEquityL1.toFixed(1)}%) — equity = ${(inputs.equityPct*100).toFixed(0)}% × (land ${fmt(result.landCostL1)} + construction ${fmt(result.totalConstructionCost)}) = ${fmt(result.cashEquityL1)}`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PHASE CARD
   ──────────────────────────────────────────────────────────── */

function LotPricingCard({ lotId, lang }: { lotId: number; lang: string }) {
  const lot = LOTS.find(l => l.id === lotId);
  if (!lot) return null;
  const retailSqm = LOT_RETAIL_MAP.get(lotId) ?? lot.zone_price_retail;
  const l1Sqm = retailSqm * (1 - DEFAULT_L1_DISCOUNT);
  const l2Sqm = retailSqm * (1 - DEFAULT_L2_DISCOUNT);
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-800">Lot {lotId}</span>
        <span className="text-[10px] text-gray-400">{fmtN(lot.area_sqm, 0)} m²</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-50 rounded p-1.5">
          <div className="text-[8px] text-gray-400">Retail</div>
          <div className="text-[11px] font-bold text-gray-700">${fmtN(retailSqm, 0)}</div>
          <div className="text-[8px] text-gray-400">{fmt(retailSqm * lot.area_sqm)}</div>
        </div>
        <div className="bg-blue-50 rounded p-1.5 border border-blue-100">
          <div className="text-[8px] text-blue-500">L1 (−33%)</div>
          <div className="text-[11px] font-bold text-blue-700">${fmtN(l1Sqm, 0)}</div>
          <div className="text-[8px] text-blue-400">{fmt(l1Sqm * lot.area_sqm)}</div>
        </div>
        <div className="bg-emerald-50 rounded p-1.5 border border-emerald-100">
          <div className="text-[8px] text-emerald-500">L2 (−20%)</div>
          <div className="text-[11px] font-bold text-emerald-700">${fmtN(l2Sqm, 0)}</div>
          <div className="text-[8px] text-emerald-400">{fmt(l2Sqm * lot.area_sqm)}</div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   LAND MAP & PRICING  (mirrored from investor page)
   ──────────────────────────────────────────────────────────── */

function LandMapPricing({ lang, assignments, lotStatuses }: {
  lang: string;
  assignments: Map<number, any>;
  lotStatuses: Map<number, any>;
}) {
  const [phaseFilter, setPhaseFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [lassoMode, setLassoMode] = useState(false);

  const filteredLotIds = useMemo(() => {
    const ids = new Set<number>();
    for (const lot of LOTS) {
      const a = assignments.get(lot.id);
      if (!a || a.developmentType === "unassigned") continue;
      if (phaseFilter === "all" || a.phase === phaseFilter) ids.add(lot.id);
    }
    return ids;
  }, [assignments, phaseFilter]);

  const handleSelectLot = useCallback((lotId: number) => {
    const status = lotStatuses.get(lotId);
    if (status === "sold") return;
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId); else next.add(lotId);
      return next;
    });
  }, [lotStatuses]);

  const handleLassoSelect = useCallback((lotIds: number[]) => {
    const selectable = lotIds.filter(id => filteredLotIds.has(id) && lotStatuses.get(id) !== "sold");
    if (selectable.length > 0) setSelectedLotIds(new Set(selectable));
  }, [filteredLotIds, lotStatuses]);

  const selectionPricing = useMemo(() => {
    const ids = selectedLotIds.size > 0 ? selectedLotIds : filteredLotIds;
    const lots = LOTS.filter(l => ids.has(l.id) && lotStatuses.get(l.id) !== "sold");
    if (lots.length === 0) return null;
    const totalArea = lots.reduce((s, l) => s + l.area_sqm, 0);
    const weightedRetail = lots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0);
    const avgRetail = weightedRetail / totalArea;
    return {
      count: lots.length, totalArea, avgRetail,
      avgL1: avgRetail * (1 - DEFAULT_L1_DISCOUNT),
      avgL2: avgRetail * (1 - DEFAULT_L2_DISCOUNT),
      isSelection: selectedLotIds.size > 0,
    };
  }, [selectedLotIds, filteredLotIds, lotStatuses]);

  const fmtP = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header + phase filters */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {lang === "ar" ? "خريطة الأراضي والتسعير" : "Land Map & Pricing"}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {lang === "ar" ? "اضغط على القطع لمعرفة الأسعار" : "Click lots to see pricing — multi-select supported"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", 1, 2, 3] as const).map(ph => (
            <button
              key={ph}
              onClick={() => { setPhaseFilter(ph); setSelectedLotIds(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                phaseFilter === ph ? "bg-dh-dark text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {ph === "all" ? (lang === "ar" ? "الكل" : "All") : `${lang === "ar" ? "م" : "P"}${ph}`}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <button
            onClick={() => setLassoMode(m => !m)}
            title={lang === "ar" ? "وضع التحديد بالسحب" : "Lasso select mode"}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 ${
              lassoMode ? "bg-dh-hills text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M3 3 Q8 1 13 3 Q15 8 13 13 Q8 15 3 13 Q1 8 3 3Z" strokeDasharray="3 2"/>
            </svg>
            {lang === "ar" ? "تحديد" : "Lasso"}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Map */}
        <div className="flex-1 h-[464px] relative overflow-hidden">
          <CustomerMap
            filteredLotIds={filteredLotIds}
            assignments={assignments}
            lotStatuses={lotStatuses}
            onSelectLot={handleSelectLot}
            selectedLotId={null}
            selectedLotIds={selectedLotIds}
            lang={lang}
            hideLegend
            lassoMode={lassoMode}
            onLassoSelect={handleLassoSelect}
            initialZoom={0.96}
            height="100%"
          />
        </div>

        {/* Pricing sidebar */}
        <div className="lg:w-[280px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 p-4 space-y-4">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 mb-1">
              {selectionPricing?.isSelection
                ? (lang === "ar" ? "القطع المحددة" : "Selected Lots")
                : (lang === "ar" ? "جميع القطع" : "All Lots")}
            </div>
            <div className="text-lg font-bold text-gray-800">
              {selectionPricing?.count ?? 0} {lang === "ar" ? "قطعة" : "lots"}
            </div>
            <div className="text-[10px] text-gray-400">
              {selectionPricing ? `${selectionPricing.totalArea.toLocaleString("en-US", { maximumFractionDigits: 0 })} m²` : "—"}
            </div>
          </div>

          {selectionPricing && (
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
                  {lang === "ar" ? "سعر التجزئة" : "Retail Price"}
                </div>
                <div className="text-xl font-bold text-gray-800">{fmtP(selectionPricing.avgRetail)}/m²</div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgRetail * selectionPricing.totalArea)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                <div className="text-[9px] uppercase tracking-wider text-blue-500 mb-0.5">Layer 1 (−33%)</div>
                <div className="text-xl font-bold text-blue-700">{fmtP(selectionPricing.avgL1)}/m²</div>
                <div className="text-[10px] text-blue-400 mt-0.5">
                  {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgL1 * selectionPricing.totalArea)}
                </div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                <div className="text-[9px] uppercase tracking-wider text-emerald-500 mb-0.5">Layer 2 (−20%)</div>
                <div className="text-xl font-bold text-emerald-700">{fmtP(selectionPricing.avgL2)}/m²</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">
                  {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgL2 * selectionPricing.totalArea)}
                </div>
              </div>
            </div>
          )}

          {selectedLotIds.size > 0 && (
            <button
              onClick={() => setSelectedLotIds(new Set())}
              className="w-full text-[11px] text-gray-400 hover:text-gray-600 py-1"
            >
              {lang === "ar" ? "مسح التحديد" : "Clear selection"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseCard({
  phaseNum, lots, inputs, onInputChange, assignments, lotStatuses, lang, pricingMode,
  l1Price, l2Price, onL1PriceChange, onL2PriceChange,
}: {
  phaseNum: 1 | 2 | 3;
  lots: typeof LOTS;
  inputs: Record<TypologyKey, TypologyInputs>;
  onInputChange: (typ: TypologyKey, f: keyof TypologyInputs, v: number) => void;
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, any>;
  lang: string;
  pricingMode: PricingMode;
  l1Price: number;
  l2Price: number;
  onL1PriceChange: (v: number) => void;
  onL2PriceChange: (v: number) => void;
}) {
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [landInputMode, setLandInputMode] = useState<"price" | "pct">("price");

  // Toggle lot selection (shift-click for multi)
  const handleSelectLot = useCallback((lotId: number) => {
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) {
        next.delete(lotId);
      } else {
        next.add(lotId);
      }
      return next;
    });
  }, []);

  // Lasso selection — replace selection with lasso'd lots
  const handleLassoSelect = useCallback((lotIds: number[]) => {
    setSelectedLotIds(new Set(lotIds));
  }, []);

  const clearSelection = useCallback(() => setSelectedLotIds(new Set()), []);

  const hasSelection = selectedLotIds.size > 0;

  // When selection changes, reset manual land price overrides → revert to defaults
  useEffect(() => {
    onL1PriceChange(0);
    onL2PriceChange(300);
  }, [selectedLotIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // The lots to use for the breakdown: selected lots if any, otherwise all phase lots
  const activeLots = useMemo(() => {
    if (!hasSelection) return lots;
    return lots.filter(l => selectedLotIds.has(l.id));
  }, [lots, selectedLotIds, hasSelection]);

  // Group active lots by typology
  const lotsByType = useMemo(() => {
    const map: Record<TypologyKey, typeof LOTS> = { twin_villa: [], villa_2f: [], villa_3f: [], apartments: [] };
    for (const lot of activeLots) {
      const a = assignments.get(lot.id);
      const dt = a?.developmentType as TypologyKey;
      if (dt && dt in map) map[dt].push(lot);
    }
    return map;
  }, [activeLots, assignments]);

  // Calculate results per typology — derive effective discounts from absolute prices + active lot retail
  const results = useMemo(() => {
    const r: Record<TypologyKey, TypologyResult> = {} as any;
    const totalArea = activeLots.reduce((s, l) => s + l.area_sqm, 0);
    const avgRetail = totalArea > 0
      ? activeLots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0) / totalArea
      : 0;
    const avgL1 = l1Price > 0 ? l1Price : avgRetail * (1 - DEFAULT_L1_DISCOUNT);
    const avgL2 = l2Price > 0 ? l2Price : avgRetail * (1 - DEFAULT_L2_DISCOUNT);
    const effL1 = avgRetail > 0 ? Math.max(0, 1 - avgL1 / avgRetail) : DEFAULT_L1_DISCOUNT;
    const effL2 = avgRetail > 0 ? Math.max(0, 1 - avgL2 / avgRetail) : DEFAULT_L2_DISCOUNT;
    for (const k of TYPOLOGY_KEYS) r[k] = calculateTypology(inputs[k], lotsByType[k], pricingMode, effL1, effL2);
    return r;
  }, [inputs, lotsByType, pricingMode, activeLots, l1Price, l2Price]);

  // Phase totals
  const totals = useMemo(() => {
    const active = TYPOLOGY_KEYS.filter(k => results[k].numPlots > 0);
    return {
      plots: active.reduce((s, k) => s + results[k].numPlots, 0),
      area: active.reduce((s, k) => s + results[k].totalArea, 0),
      units: active.reduce((s, k) => s + results[k].totalUnits, 0),
      bua: active.reduce((s, k) => s + results[k].totalSellableArea, 0),
      revenue: active.reduce((s, k) => s + results[k].totalSales, 0),
      construction: active.reduce((s, k) => s + results[k].totalConstructionCost, 0),
      land: active.reduce((s, k) => s + results[k].landCost, 0),
      netProfit: active.reduce((s, k) => s + results[k].netProfit, 0),
      typBreakdown: active.map(k => ({ key: k, ...results[k] })),
    };
  }, [results]);

  // Filtered lot IDs for the mini-map
  const phaseLotIds = useMemo(() => new Set(lots.map(l => l.id)), [lots]);

  // Land pricing averages — scoped to active (selected or all) lots
  const landPricing = useMemo(() => {
    if (activeLots.length === 0) return { avgRetail: 0, avgL1: 0, avgL2: 0, totalArea: 0 };
    const totalArea = activeLots.reduce((s, l) => s + l.area_sqm, 0);
    const weightedRetail = activeLots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0);
    const avgRetail = weightedRetail / totalArea;
    // If user set an absolute price, use it directly; otherwise derive from default discount
    const avgL1 = l1Price > 0 ? l1Price : avgRetail * (1 - DEFAULT_L1_DISCOUNT);
    const avgL2 = l2Price > 0 ? l2Price : avgRetail * (1 - DEFAULT_L2_DISCOUNT);
    return { avgRetail, avgL1, avgL2, totalArea };
  }, [activeLots, l1Price, l2Price]);

  if (lots.length === 0) return null;

  const color = PHASE_COLORS[phaseNum];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Phase header */}
      <div className="px-5 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-800">
                {lang === "ar" ? `المرحلة ${phaseNum}` : `Phase ${phaseNum}`}
              </h2>
              {hasSelection && (
                <button
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium hover:bg-blue-200 transition-colors"
                >
                  {selectedLotIds.size} {lang === "ar" ? "قطع محددة" : "lots selected"} ✕
                </button>
              )}
            </div>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {totals.plots} plots · {fmtN(totals.area, 0)} m² · {fmtN(totals.units, 0)} units
              {hasSelection && <span className="text-blue-500 ml-1">(filtered)</span>}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs tabular-nums">
            <div className="text-center">
              <div className="text-[9px] text-gray-400">BUA</div>
              <div className="font-medium text-gray-700">{fmtN(totals.bua, 0)} m²</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">Revenue</div>
              <div className="font-bold text-gray-800">{fmt(totals.revenue)}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">Cost</div>
              <div className="font-medium text-red-600">{fmt(totals.construction + totals.land)}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-gray-400">Net Profit</div>
              <div className={`font-bold ${totals.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(totals.netProfit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map + Pricing + Typology breakdowns */}
      <div className="flex flex-col">
        {/* Map + Pricing row */}
        <div className="flex flex-col lg:flex-row border-b border-gray-100">
          {/* Map section */}
          <div className="lg:w-[320px] flex-shrink-0 bg-gray-50/30 p-2">
            <div className="h-[280px] relative overflow-hidden rounded-lg">
              <CustomerMap
                filteredLotIds={phaseLotIds}
                assignments={assignments}
                lotStatuses={lotStatuses}
                onSelectLot={handleSelectLot}
                selectedLotId={null}
                selectedLotIds={selectedLotIds}
                onLassoSelect={handleLassoSelect}
                lang={lang}
                compact
                hideLegend
              />
            </div>
          </div>

          {/* Pricing section - to the right of map */}
          <div className="flex-1 flex flex-col gap-4 p-4">
            {/* Selected lot pricing cards */}
            {hasSelection && selectedLotIds.size <= 3 && (
              <div className="space-y-2">
                {Array.from(selectedLotIds).map(id => (
                  <LotPricingCard key={id} lotId={id} lang={lang} />
                ))}
              </div>
            )}

            {/* Avg land prices + Typology mix in three rows */}
            <div className="flex flex-col gap-4">
              {/* Avg land prices */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">
                    Avg Land Price / m²
                  </div>
                  <button
                    onClick={() => setLandInputMode(m => m === "price" ? "pct" : "price")}
                    className="text-[9px] text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded px-1.5 py-0.5 transition-colors"
                  >
                    {landInputMode === "price" ? "switch to %" : "switch to $"}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-gray-400">Retail</div>
                    <div className="text-xs font-bold text-gray-700">${fmtN(landPricing.avgRetail, 0)}</div>
                  </div>
                  {(() => {
                    const effL1Pct = landPricing.avgRetail > 0 ? Math.max(0, 1 - landPricing.avgL1 / landPricing.avgRetail) : DEFAULT_L1_DISCOUNT;
                    const effL2Pct = landPricing.avgRetail > 0 ? Math.max(0, 1 - landPricing.avgL2 / landPricing.avgRetail) : DEFAULT_L2_DISCOUNT;
                    return (<>
                  <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
                    <div className="text-[9px] text-blue-500 mb-1">
                      L1 {landInputMode === "price"
                        ? `(−${Math.round(effL1Pct * 100)}%)`
                        : `($${fmtN(landPricing.avgL1, 0)})`}
                    </div>
                    {landInputMode === "price" ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-[9px] font-semibold text-blue-600">$</span>
                        <CommitInput
                          value={Math.round(landPricing.avgL1)}
                          onChange={v => onL1PriceChange(v > 0 ? v : 0)}
                          min={1} step={1}
                          className="w-14 text-center text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        <CommitInput
                          value={Math.round(effL1Pct * 100)}
                          onChange={v => onL1PriceChange(landPricing.avgRetail * (1 - Math.min(0.99, Math.max(0.01, v / 100))))}
                          min={1} max={99} step={1}
                          className="w-10 text-center text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        <span className="text-[9px] font-semibold text-blue-600">%</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                    <div className="text-[9px] text-emerald-500 mb-1">
                      L2 {landInputMode === "price"
                        ? `(−${Math.round(effL2Pct * 100)}%)`
                        : `($${fmtN(landPricing.avgL2, 0)})`}
                    </div>
                    {landInputMode === "price" ? (
                      <div className="flex items-center justify-center gap-0.5">
                        <span className="text-[9px] font-semibold text-emerald-600">$</span>
                        <CommitInput
                          value={Math.round(landPricing.avgL2)}
                          onChange={v => onL2PriceChange(v > 0 ? v : 0)}
                          min={1} step={1}
                          className="w-14 text-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-0.5">
                        <CommitInput
                          value={Math.round(effL2Pct * 100)}
                          onChange={v => onL2PriceChange(landPricing.avgRetail * (1 - Math.min(0.99, Math.max(0.01, v / 100))))}
                          min={1} max={99} step={1}
                          className="w-10 text-center text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded px-1 py-0 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                        />
                        <span className="text-[9px] font-semibold text-emerald-600">%</span>
                      </div>
                    )}
                  </div>
                    </>);
                  })()}
                </div>
              </div>

              {/* Typology mix */}
              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">
                  Typology Mix
                </div>
                {totals.typBreakdown.map(tb => {
                  const meta = TYPOLOGY_META[tb.key];
                  const pct = totals.units > 0 ? (tb.totalUnits / totals.units * 100) : 0;
                  return (
                    <div key={tb.key} className="flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                        <span className="text-gray-600">{meta.label}</span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums text-gray-500">
                        <span>{tb.numPlots} plots</span>
                        <span>{fmtU(tb.totalUnits)} units</span>
                        <span className="font-medium text-gray-700">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Typology breakdowns below */}
        <div className="p-4 space-y-2">
          {TYPOLOGY_KEYS.map(k => (
            <TypologySection
              key={k}
              typKey={k}
              inputs={inputs[k]}
              result={results[k]}
              onInputChange={(f, v) => onInputChange(k, f, v)}
              lang={lang}
              pricingMode={pricingMode}
              defaultOpen={k === TYPOLOGY_KEYS.find(tk => results[tk].numPlots > 0)}
              avgL1Sqm={landPricing.avgL1}
              avgL2Sqm={landPricing.avgL2}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   MAIN PAGE
   ──────────────────────────────────────────────────────────── */

export function ModelContent() {
  const { t, lang } = useTranslations();
  const assignments = useSimulationStore((s) => s.assignments);
  const lotStatuses = useSimulationStore((s) => s.lotStatuses);
  const [mounted, setMounted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  // Scenario management
  type ScenarioKey = "working" | "default";
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("working");
  const [defaultInputs, setDefaultInputs] = useState<Record<1 | 2 | 3, Record<TypologyKey, TypologyInputs>> | null>(null);
  const [defaultSaveStatus, setDefaultSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const defaultPhaseInputs = (): Record<1 | 2 | 3, Record<TypologyKey, TypologyInputs>> => {
    const copy = (): Record<TypologyKey, TypologyInputs> => ({
      twin_villa:  { ...DEFAULT_INPUTS.twin_villa },
      villa_2f:    { ...DEFAULT_INPUTS.villa_2f },
      villa_3f:    { ...DEFAULT_INPUTS.villa_3f },
      apartments:  { ...DEFAULT_INPUTS.apartments },
    });
    return { 1: copy(), 2: copy(), 3: copy() };
  };

  const [pricingMode, setPricingMode] = useState<PricingMode>("by_location");
  // Stored as absolute $/sqm (0 = unset, use default discount)
  const [l1Price, setL1Price] = useState(0);
  const [l2Price, setL2Price] = useState(300);
  const [phaseInputs, setPhaseInputs] = useState<Record<1 | 2 | 3, Record<TypologyKey, TypologyInputs>>>(defaultPhaseInputs);

  // Merge saved data with defaults (handles newly-added fields)
  const mergeWithDefaults = (data: any) => {
    const merged: Record<number, any> = {};
    for (const phase of [1, 2, 3] as const) {
      merged[phase] = {};
      for (const k of TYPOLOGY_KEYS) {
        merged[phase][k] = { ...DEFAULT_INPUTS[k], ...data[phase][k] };
      }
    }
    return merged as Record<1 | 2 | 3, Record<TypologyKey, TypologyInputs>>;
  };

  // Load both working and default scenarios on mount
  useEffect(() => {
    setMounted(true);
    // Load default scenario first — this is the authoritative baseline that
    // "Save as Default" writes to. Fresh page loads always start from here.
    Promise.all([
      fetch("/api/model-inputs").then(r => r.json()).catch(() => null),
      fetch("/api/model-inputs?scenario=default").then(r => r.json()).catch(() => null),
    ]).then(([working, def]) => {
      // If a saved default exists, use it as the initial displayed inputs
      if (def && def[1] && def[2] && def[3]) {
        setPhaseInputs(mergeWithDefaults(def));
        setDefaultInputs(mergeWithDefaults(def));
      } else if (working && working[1] && working[2] && working[3]) {
        // No default saved yet — fall back to working copy
        setPhaseInputs(mergeWithDefaults(working));
      }
    });
  }, []);

  // Auto-save with debounce whenever inputs change
  useEffect(() => {
    if (!mounted) return;
    setSaveStatus("saving");
    const t = setTimeout(() => {
      fetch("/api/model-inputs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(phaseInputs),
      }).then(() => {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      }).catch(() => setSaveStatus("idle"));
    }, 800);
    return () => clearTimeout(t);
  }, [phaseInputs, mounted]);

  // Save current working inputs as the locked default baseline.
  // Writes to BOTH model-inputs (so fresh page loads see it) and
  // model-inputs?scenario=default (for the scenario comparison toggle).
  const saveAsDefault = () => {
    setDefaultSaveStatus("saving");
    const body = JSON.stringify(phaseInputs);
    Promise.all([
      fetch("/api/model-inputs?scenario=default", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      }),
      fetch("/api/model-inputs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body,
      }),
    ]).then(() => {
      setDefaultInputs(phaseInputs);
      setDefaultSaveStatus("saved");
      setTimeout(() => setDefaultSaveStatus("idle"), 2500);
    }).catch(() => setDefaultSaveStatus("idle"));
  };

  // Reset working inputs back to the saved default
  const resetToDefault = () => {
    if (!defaultInputs) return;
    setPhaseInputs(defaultInputs);
  };

  const updateInput = (phase: 1 | 2 | 3, typ: TypologyKey, field: keyof TypologyInputs, value: number) => {
    setPhaseInputs(prev => ({
      ...prev,
      [phase]: { ...prev[phase], [typ]: { ...prev[phase][typ], [field]: value } },
    }));
  };

  // Group lots by phase
  const lotsByPhase = useMemo(() => {
    const map: Record<1 | 2 | 3, typeof LOTS> = { 1: [], 2: [], 3: [] };
    for (const lot of LOTS) {
      const a = assignments.get(lot.id);
      const ph = a?.phase as 1 | 2 | 3;
      if (ph >= 1 && ph <= 3 && a?.developmentType !== "unassigned" && a?.developmentType !== "lot_sale") {
        map[ph].push(lot);
      }
    }
    return map;
  }, [assignments]);

  // Inputs visible in phase cards — default scenario shows the locked baseline (read-only)
  const visibleInputs = activeScenario === "default" && defaultInputs ? defaultInputs : phaseInputs;
  const isReadOnly = activeScenario === "default";

  // Per-phase average retail land price (for grand total pct derivation)
  const phaseAvgRetail = useMemo(() => {
    const result: Record<1|2|3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const ph of [1,2,3] as const) {
      const lots = lotsByPhase[ph];
      const totalArea = lots.reduce((s,l) => s + l.area_sqm, 0);
      if (totalArea === 0) continue;
      result[ph] = lots.reduce((s,l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0) / totalArea;
    }
    return result;
  }, [lotsByPhase]);

  // Grand totals (computed from all phases)
  const grand = useMemo(() => {
    let plots = 0, area = 0, bua = 0, units = 0, revenue = 0, cost = 0, land = 0, net = 0;
    for (const ph of [1, 2, 3] as const) {
      const phInputs = visibleInputs[ph];
      const byType: Record<TypologyKey, typeof LOTS> = { twin_villa: [], villa_2f: [], villa_3f: [], apartments: [] };
      for (const lot of lotsByPhase[ph]) {
        const dt = assignments.get(lot.id)?.developmentType as TypologyKey;
        if (dt && dt in byType) byType[dt].push(lot);
      }
      for (const k of TYPOLOGY_KEYS) {
        const avgRetail = phaseAvgRetail[ph];
        const avgL1 = l1Price > 0 ? l1Price : avgRetail * (1 - DEFAULT_L1_DISCOUNT);
        const avgL2 = l2Price > 0 ? l2Price : avgRetail * (1 - DEFAULT_L2_DISCOUNT);
        const effL1 = avgRetail > 0 ? Math.max(0, 1 - avgL1 / avgRetail) : DEFAULT_L1_DISCOUNT;
        const effL2 = avgRetail > 0 ? Math.max(0, 1 - avgL2 / avgRetail) : DEFAULT_L2_DISCOUNT;
        const r = calculateTypology(phInputs[k], byType[k], pricingMode, effL1, effL2);
        plots += r.numPlots;
        area += r.totalArea;
        bua += r.totalSellableArea;
        units += r.totalUnits;
        revenue += r.totalSales;
        cost += r.totalConstructionCost;
        land += r.landCost;
        net += r.netProfit;
      }
    }
    return { plots, area, bua, units, revenue, cost, land, net };
  }, [lotsByPhase, visibleInputs, assignments, pricingMode, l1Price, l2Price, phaseAvgRetail]);

  // Per-typology aggregate across all phases (L2 land for phase cards, L1 land for the summary card)
  const aggByTypology = useMemo(() => {
    const acc: Record<TypologyKey, { plots: number; area: number; bua: number; units: number; revenue: number; cost: number; land: number; net: number; landL1: number; netL1: number }> = {
      twin_villa:  { plots: 0, area: 0, bua: 0, units: 0, revenue: 0, cost: 0, land: 0, net: 0, landL1: 0, netL1: 0 },
      villa_2f:    { plots: 0, area: 0, bua: 0, units: 0, revenue: 0, cost: 0, land: 0, net: 0, landL1: 0, netL1: 0 },
      villa_3f:    { plots: 0, area: 0, bua: 0, units: 0, revenue: 0, cost: 0, land: 0, net: 0, landL1: 0, netL1: 0 },
      apartments:  { plots: 0, area: 0, bua: 0, units: 0, revenue: 0, cost: 0, land: 0, net: 0, landL1: 0, netL1: 0 },
    };
    for (const ph of [1, 2, 3] as const) {
      const phInputs = visibleInputs[ph];
      const byType: Record<TypologyKey, typeof LOTS> = { twin_villa: [], villa_2f: [], villa_3f: [], apartments: [] };
      for (const lot of lotsByPhase[ph]) {
        const dt = assignments.get(lot.id)?.developmentType as TypologyKey;
        if (dt && dt in byType) byType[dt].push(lot);
      }
      const avgRetail = phaseAvgRetail[ph];
      const avgL1 = l1Price > 0 ? l1Price : avgRetail * (1 - DEFAULT_L1_DISCOUNT);
      const avgL2 = l2Price > 0 ? l2Price : avgRetail * (1 - DEFAULT_L2_DISCOUNT);
      const effL1 = avgRetail > 0 ? Math.max(0, 1 - avgL1 / avgRetail) : DEFAULT_L1_DISCOUNT;
      const effL2 = avgRetail > 0 ? Math.max(0, 1 - avgL2 / avgRetail) : DEFAULT_L2_DISCOUNT;
      for (const k of TYPOLOGY_KEYS) {
        const r = calculateTypology(phInputs[k], byType[k], pricingMode, effL1, effL2);
        acc[k].plots   += r.numPlots;
        acc[k].area    += r.totalArea;
        acc[k].bua     += r.totalSellableArea;
        acc[k].units   += r.totalUnits;
        acc[k].revenue += r.totalSales;
        acc[k].cost    += r.totalConstructionCost;
        acc[k].land    += r.landCost;
        acc[k].net     += r.netProfit;
        acc[k].landL1  += r.landCostL1;
        acc[k].netL1   += r.netProfitL1;
      }
    }
    return acc;
  }, [lotsByPhase, visibleInputs, assignments, pricingMode, l1Price, l2Price, phaseAvgRetail]);

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-400 text-sm">Loading…</div>
    );
  }

  return (
    <div style={{ background: "#F4F9EF" }}>

      {/* Hero */}
      <div className="bg-dh-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-serif font-semibold">
                  {lang === "ar" ? "نموذج المحاكاة المالية" : "Financial Simulation Model"}
                </h1>
                {activeScenario === "working" && saveStatus === "saving" && <span className="text-[10px] text-white/40">Saving…</span>}
                {activeScenario === "working" && saveStatus === "saved"  && <span className="text-[10px] text-dh-light">✓ Saved</span>}
              </div>
              <p className="text-[11px] text-white/50 mt-0.5">
                {lang === "ar" ? "تقسيم حسب المراحل — أرض بسعر مخفض 25% عن سعر التجزئة لكل قطعة" : "Phase-by-phase breakdown — land at L2 (20% off retail)"}
              </p>
            </div>
          </div>

          {/* Scenario bar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Scenario toggle */}
            <div className="flex items-center bg-white/10 rounded-lg p-0.5">
              <button
                onClick={() => setActiveScenario("working")}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  activeScenario === "working" ? "bg-white text-dh-dark" : "text-white/70 hover:text-white"
                }`}
              >
                ✏️ Working
              </button>
              <button
                onClick={() => { if (defaultInputs) setActiveScenario("default"); }}
                disabled={!defaultInputs}
                className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeScenario === "default" ? "bg-amber-400 text-dh-dark" : "text-white/70 hover:text-white"
                }`}
              >
                🔒 Default {!defaultInputs && "(not set)"}
              </button>
            </div>

            {/* Default scenario actions */}
            {activeScenario === "working" && (
              <>
                {defaultInputs && (
                  <button
                    onClick={resetToDefault}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-white/80 hover:text-white transition-colors"
                  >
                    ↩ Reset to Default
                  </button>
                )}
                <button
                  onClick={saveAsDefault}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-[11px] text-amber-300 hover:text-amber-200 transition-colors"
                >
                  {defaultSaveStatus === "saving" ? "Saving…" : defaultSaveStatus === "saved" ? "✓ Default Saved" : "💾 Save as Default"}
                </button>
              </>
            )}
            {activeScenario === "default" && (
              <span className="text-[11px] text-amber-300/80 italic">Viewing locked baseline — switch to Working to edit</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Grand total bar */}
        <div className="bg-dh-dark text-white rounded-2xl p-5">
          <div className="text-[9px] uppercase tracking-widest font-semibold text-white/40 mb-2">
            {lang === "ar" ? "الإجمالي العام — جميع المراحل" : "Grand Total — All Phases"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { lbl: "Plots", val: `${grand.plots}` },
              { lbl: "Land", val: `${fmtN(grand.area, 0)} m²` },
              { lbl: "BUA", val: `${fmtN(grand.bua, 0)} m²` },
              { lbl: "Units", val: `${fmtN(grand.units, 0)}` },
              { lbl: "Revenue", val: fmt(grand.revenue), cls: "text-dh-light" },
              { lbl: "Construction", val: fmt(grand.cost), cls: "text-red-300" },
              { lbl: "Land Cost", val: fmt(grand.land), cls: "text-red-300" },
              { lbl: "Net Profit", val: fmt(grand.net), cls: grand.net >= 0 ? "text-emerald-300" : "text-red-300" },
            ].map(s => (
              <div key={s.lbl}>
                <div className="text-[9px] text-white/40">{s.lbl}</div>
                <div className={`text-sm font-bold ${s.cls ?? ""}`}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Phase 1, 2, 3 */}
        {([1, 2, 3] as const).map(ph => (
          <PhaseCard
            key={ph}
            phaseNum={ph}
            lots={lotsByPhase[ph]}
            inputs={visibleInputs[ph]}
            onInputChange={isReadOnly ? () => {} : (typ, f, v) => updateInput(ph, typ, f, v)}
            assignments={assignments}
            lotStatuses={lotStatuses}
            lang={lang}
            pricingMode={pricingMode}
            l1Price={l1Price}
            l2Price={l2Price}
            onL1PriceChange={setL1Price}
            onL2PriceChange={setL2Price}
          />
        ))}

        {/* Land Map & Pricing */}
        <LandMapPricing lang={lang} assignments={assignments} lotStatuses={lotStatuses} />

        {/* ── Full-Project Aggregate by Typology ── (hidden for now) */}
        {false && (() => {
          // Aggregate L1 grand totals across all typologies
          const grandL1 = TYPOLOGY_KEYS.reduce((acc, k) => ({
            revenue: acc.revenue + aggByTypology[k].revenue,
            cost:    acc.cost    + aggByTypology[k].cost,
            land:    acc.land    + aggByTypology[k].landL1,
            net:     acc.net     + aggByTypology[k].netL1,
            bua:     acc.bua     + aggByTypology[k].bua,
          }), { revenue: 0, cost: 0, land: 0, net: 0, bua: 0 });

          return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100" style={{ borderLeftWidth: 4, borderLeftColor: "#1A3810" }}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-800">All Phases — Full Project</h2>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700">L1 pricing</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{grand.plots} plots · {fmtN(grand.area, 0)} m² · {fmtN(grand.units, 1)} units · land at L1 (−33% off retail)</p>
              </div>
              <div className="flex items-center gap-4 text-xs tabular-nums">
                {[
                  { lbl: "BUA",        val: `${fmtN(grandL1.bua, 0)} m²`, cls: "text-gray-700" },
                  { lbl: "Revenue",    val: fmt(grandL1.revenue),          cls: "font-bold text-gray-800" },
                  { lbl: "Land (L1)",  val: fmt(grandL1.land),             cls: "text-red-500" },
                  { lbl: "Net Profit", val: fmt(grandL1.net),              cls: `font-bold ${grandL1.net >= 0 ? "text-emerald-600" : "text-red-600"}` },
                ].map(s => (
                  <div key={s.lbl} className="text-center">
                    <div className="text-[9px] text-gray-400">{s.lbl}</div>
                    <div className={s.cls}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Per-typology rows */}
          <div className="divide-y divide-gray-50">
            {TYPOLOGY_KEYS.map(k => {
              const meta = TYPOLOGY_META[k];
              const d = aggByTypology[k];
              if (d.plots === 0) return null;
              const margin = d.revenue > 0 ? (d.netL1 / d.revenue) * 100 : 0;
              return (
                <div key={k} className="px-5 py-4">
                  {/* Typology label + top-line KPIs */}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                      <span className="text-xs font-semibold text-gray-800">{lang === "ar" ? meta.labelAr : meta.label}</span>
                      <span className="text-[10px] text-gray-400">{d.plots} plots · {fmtN(d.area, 0)} m² · {fmtU(d.units)} units</span>
                    </div>
                    <div className="flex items-center gap-5 text-xs tabular-nums">
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">BUA</div>
                        <div className="font-medium text-gray-700">{fmtN(d.bua, 0)} m²</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">Revenue</div>
                        <div className="font-bold text-gray-800">{fmt(d.revenue)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">Construction</div>
                        <div className="font-medium text-red-500">{fmt(d.cost)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">Land (L1)</div>
                        <div className="font-medium text-blue-600">{fmt(d.landL1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">Net Profit</div>
                        <div className={`font-bold ${d.netL1 >= 0 ? "text-emerald-600" : "text-red-600"}`}>{fmt(d.netL1)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[9px] text-gray-400">Margin</div>
                        <div className={`font-bold ${margin >= 20 ? "text-emerald-600" : margin >= 10 ? "text-amber-500" : "text-red-500"}`}>{margin.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Mini stat bar */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { lbl: "Avg sell $/m²",  val: d.bua > 0   ? `$${fmtN(d.revenue / d.bua, 0)}`    : "—" },
                      { lbl: "Land L1 $/m²",   val: d.area > 0  ? `$${fmtN(d.landL1 / d.area, 0)}`    : "—" },
                      { lbl: "Revenue/unit",   val: d.units > 0 ? fmt(d.revenue / d.units)              : "—" },
                      { lbl: "Profit/unit",    val: d.units > 0 ? fmt(d.netL1 / d.units)               : "—" },
                      { lbl: "BUA/unit",       val: d.units > 0 ? `${fmtN(d.bua / d.units, 0)} m²`    : "—" },
                      { lbl: "Land/unit",      val: d.units > 0 ? `${fmtN(d.area / d.units, 0)} m²`   : "—" },
                    ].map(s => (
                      <div key={s.lbl} className="bg-gray-50 rounded-lg px-3 py-2">
                        <div className="text-[9px] text-gray-400 uppercase tracking-wide">{s.lbl}</div>
                        <div className="text-xs font-semibold text-gray-700 mt-0.5">{s.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Project-level margin summary */}
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-6 text-xs flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-blue-600">L1 project totals</span>
            {[
              { lbl: "Revenue",     val: fmt(grandL1.revenue) },
              { lbl: "Land (L1)",   val: fmt(grandL1.land) },
              { lbl: "Construction",val: fmt(grandL1.cost) },
              { lbl: "Net Profit",  val: fmt(grandL1.net), green: true },
              { lbl: "Margin",      val: `${grandL1.revenue > 0 ? ((grandL1.net / grandL1.revenue) * 100).toFixed(1) : 0}%`, green: true },
              { lbl: "Avg $/m²",    val: grandL1.bua > 0 ? `$${fmtN(grandL1.revenue / grandL1.bua, 0)}` : "—" },
            ].map(s => (
              <div key={s.lbl} className="flex items-center gap-1.5">
                <span className="text-gray-400">{s.lbl}</span>
                <span className={`font-bold tabular-nums ${s.green ? "text-emerald-700" : "text-gray-800"}`}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
          );
        })()}

      </div>
    </div>
  );
}






