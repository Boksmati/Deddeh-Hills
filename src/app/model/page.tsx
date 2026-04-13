"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import AppHeader from "@/components/ui/AppHeader";
import AppFooter from "@/components/ui/AppFooter";
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
  /** Land cost at L1 (−35% off retail) — early investor scenario */
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
    maxUnitsPerPlot: 2, avgUnitSize: 300, constructionCost: 600, sellingPrice: 1400, profitMargin: 450, buaPerPlot: 900, equityPct: 0.30,
  },
  villa_2f: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 2,
    jamalonPct: 0, undergroundPct: 0, balconyPct: 0.25,
    maxUnitsPerPlot: 2, avgUnitSize: 600, constructionCost: 600, sellingPrice: 1500, profitMargin: 450, buaPerPlot: 900, equityPct: 0.30,
  },
  villa_3f: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 3,
    jamalonPct: 0, undergroundPct: 0.50, balconyPct: 0.25,
    maxUnitsPerPlot: 2, avgUnitSize: 600, constructionCost: 600, sellingPrice: 1300, profitMargin: 450, buaPerPlot: 900, equityPct: 0.30,
  },
  apartments: {
    commonAreaPct: 0.10, exploitPct: 0.20, floors: 3,
    jamalonPct: 0, undergroundPct: 0, balconyPct: 0.25,
    maxUnitsPerPlot: 6, avgUnitSize: 150, constructionCost: 600, sellingPrice: 1100, profitMargin: 450, buaPerPlot: 900, equityPct: 0.30,
  },
};

/* ────────────────────────────────────────────────────────────
   CALCULATION ENGINE
   ──────────────────────────────────────────────────────────── */

const L2_DISCOUNT = 0.20; // Layer 2: 20% off retail
const L1_DISCOUNT = 0.35; // Layer 1: 35% off retail

type PricingMode = "average" | "by_location";

function calculateTypology(inputs: TypologyInputs, lots: typeof LOTS, pricingMode: PricingMode): TypologyResult {
  const numPlots = lots.length;
  const totalArea = lots.reduce((s, l) => s + l.area_sqm, 0);
  // Retail price from lot-prices.json (per-lot actual market price)
  const retailLandCost = lots.reduce((s, l) => s + l.area_sqm * (LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail), 0);
  const avgRetailLandSqm = totalArea > 0 ? retailLandCost / totalArea : 0;
  // Land cost at L2 (−20% off retail)
  const landCost = retailLandCost * (1 - L2_DISCOUNT);
  const avgLandPriceSqm = totalArea > 0 ? landCost / totalArea : 0;
  // Land cost at L1 (−35% off retail) — early investor scenario
  const landCostL1 = retailLandCost * (1 - L1_DISCOUNT);

  const commonArea = totalArea * inputs.commonAreaPct;
  const netArea = totalArea - commonArea;

  // Footprint = max buildable ground area (fixed by regulation)
  const footprint = totalArea * inputs.exploitPct;
  // Floor area = footprint × number of above-ground floors
  const regularFloorArea = footprint * inputs.floors;
  const jamalonArea = footprint * inputs.jamalonPct;
  const undergroundArea = footprint * inputs.undergroundPct;
  // BUG FIX: balconies only on above-ground area, not underground
  const aboveGroundArea = regularFloorArea + jamalonArea;
  const totalBuiltArea = aboveGroundArea * (1 + inputs.balconyPct) + undergroundArea;

  const rawUnitsExact = inputs.avgUnitSize > 0 ? totalBuiltArea / inputs.avgUnitSize : 0;
  const totalUnits = rawUnitsExact;
  const unitsPerPlot = numPlots > 0 ? totalUnits / numPlots : 0;
  // Villa footprint = actual building ground area per unit
  // Unit size includes balconies, so strip them out, then divide by floors
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
      avgUnitPrice: 0, grossProfitPerSqm: 0, avgLandPriceSqm, landCost,
      grossCostPerSqm: 0, netProfitPerSqm: 0, totalSellableArea: 0,
      totalConstructionCost: 0, totalSales: 0, grossProfit: 0, netProfit: -landCost,
      effectiveSellingPrice: inputs.sellingPrice, sellingPriceMin: inputs.sellingPrice, sellingPriceMax: inputs.sellingPrice,
      landCostL1, netProfitL1: -landCostL1,
      roiOnEquityL2: 0, roiOnEquityL1: 0, totalInvestmentL2: landCost, cashEquityL2: landCost * inputs.equityPct, cashEquityL1: landCostL1 * inputs.equityPct,
    };
  }

  // Sellable area = what's actually built (capped by max units)
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
      const l2Sqm = (LOT_RETAIL_MAP.get(lot.id) ?? lot.zone_price_retail) * (1 - L2_DISCOUNT);
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

  // Construction cost always uses actual sellable area (units × unit size)
  const costBasis = totalSellableArea;

  const avgUnitPrice = inputs.avgUnitSize * effectiveSellingPrice;
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
    totalUnits, unitsPerPlot, villaFootprint, lotPerVilla, garden,
    avgUnitPrice, grossProfitPerSqm, avgLandPriceSqm, landCost,
    grossCostPerSqm, netProfitPerSqm, totalSellableArea,
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
}: {
  typKey: TypologyKey; inputs: TypologyInputs; result: TypologyResult;
  onInputChange: (f: keyof TypologyInputs, v: number) => void;
  lang: string; pricingMode: PricingMode; defaultOpen?: boolean;
}) {
  const meta = TYPOLOGY_META[typKey];
  const [open, setOpen] = useState(defaultOpen);

  if (result.numPlots === 0) return null;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Header bar */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: meta.color }} />
          <span className="text-xs font-semibold text-gray-800">{lang === "ar" ? meta.labelAr : meta.label}</span>
          <span className="text-[10px] text-gray-400">{result.numPlots} plots · {fmtN(result.totalArea, 0)} m²</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tabular-nums text-gray-500">{result.totalUnits.toFixed(2)} units</span>
          <span className="text-[10px] tabular-nums font-semibold text-dh-green">{fmt(result.totalSales)}</span>
          <span className={`text-[10px] tabular-nums font-bold ${result.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmt(result.netProfit)}
          </span>
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
                <Row label={`+ ${(inputs.balconyPct*100).toFixed(0)}% balconies`} value={`${fmtN(result.totalBuiltArea, 0)} m²`} bold tip={`(Floor area + jamalon) × (1 + ${(inputs.balconyPct*100).toFixed(0)}% balconies) + underground (${fmtN(result.regularFloorArea + result.jamalonArea,0)} × ${(1+inputs.balconyPct).toFixed(2)} + ${fmtN(result.undergroundArea,0)} = ${fmtN(result.totalBuiltArea,0)} m²)`} />
              </div>
            </div>

            {/* Col 2: Geometry + Per-m² */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Unit Geometry</div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                <Row label="Total units" value={fmtU(result.totalUnits)} bold tip={`BUA ÷ unit size (${fmtN(result.totalBuiltArea, 0)} ÷ ${inputs.avgUnitSize} = ${fmtU(result.totalUnits)} units)`} />
                <Row label="Sellable area / unit" value={`${inputs.avgUnitSize} m²`} tip={`Unit size input — each villa's sellable built-up area`} />
                <Row label="Units / plot" value={fmtN(result.unitsPerPlot, 2)} tip={`Total units ÷ number of plots (${fmtN(result.totalUnits,1)} ÷ ${result.numPlots} = ${fmtN(result.unitsPerPlot,2)})`} />
                <Row label="Villa footprint" value={`${fmtN(result.villaFootprint, 0)} m²`} tip={`Unit size ÷ (floors × (1 + balcony%)) = ${inputs.avgUnitSize} ÷ (${inputs.floors} × ${(1+inputs.balconyPct).toFixed(2)}) = ${fmtN(result.villaFootprint,0)} m²`} />
                <Row label="Lot / villa" value={`${fmtN(result.lotPerVilla, 0)} m²`} tip={`Net area ÷ total units (${fmtN(result.netArea,0)} ÷ ${fmtN(result.totalUnits,1)} = ${fmtN(result.lotPerVilla,0)} m²)`} />
                <Row label="Garden" value={`${fmtN(Math.max(0, result.garden), 0)} m²`} color="#00B050" tip={`Lot per villa − villa footprint (${fmtN(result.lotPerVilla,0)} − ${fmtN(result.villaFootprint,0)} = ${fmtN(Math.max(0,result.garden),0)} m²)`} />
              </div>
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400 pt-1">Per Unit</div>
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
                {/* Per-unit P&L */}
                {(() => {
                  const revenuePerUnit = result.avgUnitPrice;
                  const constructionPerUnit = inputs.constructionCost * inputs.avgUnitSize;
                  const landPerUnit = result.totalUnits > 0 ? result.landCost / result.totalUnits : 0;
                  const grossPerUnit = revenuePerUnit - constructionPerUnit;
                  const netPerUnit = grossPerUnit - landPerUnit;
                  return (
                    <>
                      <div className="border-t border-gray-200 my-0.5" />
                      <Row label="Revenue/unit" value={fmt(revenuePerUnit)} bold tip={`Sell $/m² × unit size (${fmtN(result.effectiveSellingPrice,0)} × ${inputs.avgUnitSize} m² = ${fmt(revenuePerUnit)})`} />
                      <Row label="Construction/unit" value={`−${fmt(constructionPerUnit)}`} color="#E53E3E" tip={`Build $/m² × unit size ($${inputs.constructionCost} × ${inputs.avgUnitSize} m² = ${fmt(constructionPerUnit)})`} />
                      <Row label="Land/unit" value={`−${fmt(landPerUnit)}`} color="#E53E3E" tip={`Total land cost ÷ units (${fmt(result.landCost)} ÷ ${fmtN(result.totalUnits,0)} = ${fmt(landPerUnit)})`} />
                      <div className="border-t border-gray-200 my-0.5" />
                      <Row label="Net profit/unit" value={fmt(netPerUnit)} bold color={netPerUnit >= 0 ? "#00B050" : "#E53E3E"} tip={`Revenue − construction − land (${fmt(revenuePerUnit)} − ${fmt(constructionPerUnit)} − ${fmt(landPerUnit)} = ${fmt(netPerUnit)})`} />
                      <Row label="Margin/unit" value={`${revenuePerUnit > 0 ? ((netPerUnit / revenuePerUnit) * 100).toFixed(1) : 0}%`} color={netPerUnit >= 0 ? "#00B050" : "#E53E3E"} tip={`Net profit ÷ revenue per unit (${fmt(netPerUnit)} ÷ ${fmt(revenuePerUnit)} = ${revenuePerUnit > 0 ? ((netPerUnit / revenuePerUnit) * 100).toFixed(1) : 0}%)`} />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Col 3: Totals P&L */}
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">Totals &amp; P&amp;L</div>
              <div className="bg-gray-50/60 rounded-lg p-2 space-y-0.5">
                <Row label="Sellable area" value={`${fmtN(result.totalSellableArea, 0)} m²`} tip={`Total units × unit size (${result.totalUnits.toFixed(2)} × ${inputs.avgUnitSize} m² = ${fmtN(result.totalSellableArea,0)} m²)`} />
                <Row label="Construction" value={fmt(result.totalConstructionCost)} color="#E53E3E" tip={`Sellable area × construction $/m² (${fmtN(result.totalSellableArea,0)} × $${inputs.constructionCost} = ${fmt(result.totalConstructionCost)})`} />
                <Row label="Total sales" value={fmt(result.totalSales)} bold tip={`Sellable area × avg selling $/m² (${fmtN(result.totalSellableArea,0)} × $${fmtN(result.effectiveSellingPrice,0)} = ${fmt(result.totalSales)})`} />
                <Row label="Gross profit" value={fmt(result.grossProfit)} tip={`Total sales − construction (${fmt(result.totalSales)} − ${fmt(result.totalConstructionCost)} = ${fmt(result.grossProfit)})`} />
                <Row label={`Land cost`} value={fmt(result.landCost)} color="#E53E3E" tip={`Sum of (lot area × retail $/m²) × (1 − 20% L2 discount) = ${fmt(result.landCost)}`} />
              </div>
              {/* Per Villa breakdown */}
              {result.totalUnits > 0 && (
                <div className="bg-blue-50/60 rounded-lg p-2 space-y-0.5">
                  <div className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">Per Villa</div>
                  <Row label="BUA" value={`${inputs.avgUnitSize} m²`} tip={`Unit size input`} />
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
                <div className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">At L1 (−35%) early entry</div>
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
  const l1Sqm = retailSqm * (1 - L1_DISCOUNT);
  const l2Sqm = retailSqm * (1 - L2_DISCOUNT);
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
          <div className="text-[8px] text-blue-500">L1 (−35%)</div>
          <div className="text-[11px] font-bold text-blue-700">${fmtN(l1Sqm, 0)}</div>
          <div className="text-[8px] text-blue-400">{fmt(l1Sqm * lot.area_sqm)}</div>
        </div>
        <div className="bg-emerald-50 rounded p-1.5 border border-emerald-100">
          <div className="text-[8px] text-emerald-500">L2 (−25%)</div>
          <div className="text-[11px] font-bold text-emerald-700">${fmtN(l2Sqm, 0)}</div>
          <div className="text-[8px] text-emerald-400">{fmt(l2Sqm * lot.area_sqm)}</div>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({
  phaseNum, lots, inputs, onInputChange, assignments, lotStatuses, lang, pricingMode,
}: {
  phaseNum: 1 | 2 | 3;
  lots: typeof LOTS;
  inputs: Record<TypologyKey, TypologyInputs>;
  onInputChange: (typ: TypologyKey, f: keyof TypologyInputs, v: number) => void;
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, any>;
  lang: string;
  pricingMode: PricingMode;
}) {
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());

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

  // Calculate results per typology
  const results = useMemo(() => {
    const r: Record<TypologyKey, TypologyResult> = {} as any;
    for (const k of TYPOLOGY_KEYS) r[k] = calculateTypology(inputs[k], lotsByType[k], pricingMode);
    return r;
  }, [inputs, lotsByType, pricingMode]);

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
    return {
      avgRetail,
      avgL1: avgRetail * (1 - L1_DISCOUNT),
      avgL2: avgRetail * (1 - L2_DISCOUNT),
      totalArea,
    };
  }, [activeLots]);

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

            {/* Avg land prices + Typology mix in two columns on larger screens */}
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Avg land prices */}
              <div className="flex-1 space-y-1.5">
                <div className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">
                  Avg Land Price / m²
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-[9px] text-gray-400">Retail</div>
                    <div className="text-xs font-bold text-gray-700">${fmtN(landPricing.avgRetail, 0)}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center border border-blue-100">
                    <div className="text-[9px] text-blue-500">L1 (−35%)</div>
                    <div className="text-xs font-bold text-blue-700">${fmtN(landPricing.avgL1, 0)}</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
                    <div className="text-[9px] text-emerald-500">L2 (−25%)</div>
                    <div className="text-xs font-bold text-emerald-700">${fmtN(landPricing.avgL2, 0)}</div>
                  </div>
                </div>
              </div>

              {/* Typology mix */}
              <div className="flex-1 space-y-1">
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

export default function ModelPage() {
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
    // Working scenario
    fetch("/api/model-inputs")
      .then(r => r.json())
      .then(data => {
        if (data && data[1] && data[2] && data[3]) setPhaseInputs(mergeWithDefaults(data));
      })
      .catch(() => {});
    // Default scenario
    fetch("/api/model-inputs?scenario=default")
      .then(r => r.json())
      .then(data => {
        if (data && data[1] && data[2] && data[3]) setDefaultInputs(mergeWithDefaults(data));
      })
      .catch(() => {});
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

  // Save current working inputs as the locked default baseline
  const saveAsDefault = () => {
    setDefaultSaveStatus("saving");
    fetch("/api/model-inputs?scenario=default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phaseInputs),
    }).then(() => {
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
        const r = calculateTypology(phInputs[k], byType[k], pricingMode);
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
  }, [lotsByPhase, visibleInputs, assignments, pricingMode]);

  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: "#F4F9EF" }}>
        <AppHeader currentPage="simulator" />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F4F9EF" }}>
      <AppHeader currentPage="simulator" />

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
            {/* Pricing mode toggle */}
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2 flex-shrink-0">
              <span className="text-[10px] text-white/60 whitespace-nowrap">Selling price:</span>
              <button
                onClick={() => setPricingMode("average")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  pricingMode === "average" ? "bg-white text-dh-dark" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                Average
              </button>
              <button
                onClick={() => setPricingMode("by_location")}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  pricingMode === "by_location" ? "bg-white text-dh-dark" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                By Location
              </button>
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
          />
        ))}
      </div>
      <AppFooter />
    </div>
  );
}






