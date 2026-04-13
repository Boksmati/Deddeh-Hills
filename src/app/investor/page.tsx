"use client";

import { useEffect, useMemo, useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_COLORS } from "@/data/development-types";
import {
  calculateSimulationSummary,
  calculateMassingSummary,
} from "@/engine/financial-engine";
import { useInvestmentConfig } from "@/hooks/useInvestmentConfig";
import { computeWaterfall, computePhaseMetrics, type InvestmentConfig, type LotPricing } from "@/lib/investment-layers";
import LOT_PRICES_RAW from "@/data/lot-prices.json";

const LOT_PRICES = LOT_PRICES_RAW as LotPricing[];
import CustomerMap from "@/components/customer/CustomerMap";
import DhLogo from "@/components/ui/DhLogo";
import AppHeader from "@/components/ui/AppHeader";
import AppFooter from "@/components/ui/AppFooter";
import { useTranslations } from "@/i18n/useTranslations";
import { useRole } from "@/hooks/useRole";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart,
} from "recharts";

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatAxisUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function KPICard({
  label,
  value,
  sub,
  sub2,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  sub2?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100">
      <div className="text-[10px] sm:text-xs text-gray-400 font-medium uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`text-xl sm:text-3xl font-bold mt-1.5 sm:mt-2 tabular-nums ${
          accent ? "text-dh-green" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] sm:text-xs text-gray-400 mt-1">{sub}</div>}
      {sub2 && <div className="text-[10px] sm:text-xs text-gray-400">{sub2}</div>}
    </div>
  );
}

const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
      <p className="text-xs font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500">{entry.name}:</span>
          <span className="font-medium tabular-nums">
            {formatUSD(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function InvestorPage() {
  const assignments = useSimulationStore((s) => s.assignments);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const lotGroups = useSimulationStore((s) => s.lotGroups);
  const investorFeatureFlags = useSimulationStore((s) => s.investorFeatureFlags);
  const { t, lang } = useTranslations();
  const role = useRole();

  // Three-Party Investment Model
  const {
    config, setConfig,
    waterfall, l1Returns, l1ExitOptions, phasedPricing, cashSufficiency,
  } = useInvestmentConfig();

  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);
  const [mounted, setMounted] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  useEffect(() => { setMounted(true); initStateFromServer().finally(() => setServerReady(true)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [activeTab, setActiveTab] = useState<"returns" | "deal">("returns");
  const [waterfallModel, setWaterfallModel] = useState<"split" | "priority">("split");

  const summary = useMemo(() => {
    const assignmentsArr = Array.from(assignments.values());
    return calculateSimulationSummary(LOTS, assignmentsArr, investorSharePct, typeAssumptions, lotGroups);
  }, [assignments, investorSharePct, typeAssumptions, lotGroups]);

  const massing = useMemo(() => {
    const assignmentsArr = Array.from(assignments.values());
    return calculateMassingSummary(LOTS, assignmentsArr, typeAssumptions);
  }, [assignments, typeAssumptions]);

  const phases = summary.phaseBreakdown.filter((p) => p.lotCount > 0);

  const phaseChartData = [1, 2, 3]
    .map((phaseNum) => {
      const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
      if (!phase || phase.lotCount === 0) return null;
      return {
        name: lang === "ar" ? `مرحلة ${phaseNum}` : `Phase ${phaseNum}`,
        "Land Cost": phase.totalLandCost,
        Construction: phase.totalConstructionCost,
        Revenue: phase.totalRevenue,
        Profit: phase.totalNetProfit,
        roi: phase.roi,
      };
    })
    .filter(Boolean);

  // Waterfall with priority model (for toggle)
  const waterfallPriority = useMemo(
    () => computeWaterfall({ ...config, priorityEnabled: true }, 0),
    [config]
  );
  const activeWaterfall = waterfallModel === "priority" ? waterfallPriority : waterfall;

  // Per-lot phase assignments (investor-visible: retail prices + averages only)
  const [lotPhases, setLotPhases] = useState<Record<number, 1 | 2 | 3>>({});
  useEffect(() => {
    fetch("/api/lots/phases")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, number>) => {
        const parsed: Record<number, 1 | 2 | 3> = {};
        for (const [k, v] of Object.entries(data)) {
          const n = parseInt(k, 10);
          if ([1, 2, 3].includes(v)) parsed[n] = v as 1 | 2 | 3;
        }
        setLotPhases(parsed);
      })
      .catch(() => {});
  }, []);

  // Phase-level lot metrics (investor sees avg retail + sell price, no transfer formula)
  const lotPhaseMetrics = useMemo(() => {
    const out: Partial<Record<1 | 2 | 3, ReturnType<typeof computePhaseMetrics>>> = {};
    ([1, 2, 3] as const).forEach((ph) => {
      const phLots = LOT_PRICES.map((l) => ({
        ...l,
        phase: lotPhases[l.lot] as 1 | 2 | 3 | undefined,
      })).filter((l) => l.phase === ph);
      if (phLots.length > 0) {
        out[ph] = computePhaseMetrics(config, phLots);
      }
    });
    return out;
  }, [lotPhases, config]);

  // ─── Per-typology profitability (reference lot = 1200 m²) ───
  // Matches Excel model: footprint → floor stacking → +25% balconies → ÷ avg unit size
  const REF_LAND = 1200;           // Reference lot area (m²)
  const COMMON_AREA_PCT = 0.10;    // 10% common/facilities area deducted from land
  const EXPLOIT_PCT = 0.20;        // 20% surface exploration (building footprint)
  const BALCONY_PCT = 0.25;        // +25% balconies/terraces
  const LAND_COST_SQM = 360;      // Land cost $/m²
  const BUILD_COST = 600;          // Construction cost $/m²
  const villaTypologyData = useMemo(() => {
    // Each type has its own floor stacking: above-ground floors, jamalon%, underground%
    const types = [
      { key: "twin_villa",  label: "Twin Villa",  labelAr: "فيلا مزدوجة",  aboveFloors: 2, jamalonPct: 0, undergroundPct: 0,   avgUnitSize: 300, sell: 1400, color: "#1E88E5" },
      { key: "villa_2f",    label: "Villa 2F",    labelAr: "فيلا طابقين",  aboveFloors: 2, jamalonPct: 0, undergroundPct: 0,   avgUnitSize: 600, sell: 1500, color: "#43A047" },
      { key: "villa_3f",    label: "Villa 3F",    labelAr: "فيلا 3 طوابق", aboveFloors: 2, jamalonPct: 0, undergroundPct: 0.5, avgUnitSize: 600, sell: 1300, color: "#F4511E" },
      { key: "apartments",  label: "Apartments",  labelAr: "شقق",          aboveFloors: 3, jamalonPct: 0, undergroundPct: 0,   avgUnitSize: 150, sell: 1100, color: "#FDD835" },
    ] as const;

    // Excel formula flow:
    // footprint = totalArea × 20%
    // floorArea = footprint × aboveFloors + footprint × jamalonPct + footprint × undergroundPct
    // totalSellable = floorArea × (1 + 25% balconies)
    // units = totalSellable / avgUnitSize
    const netLand = REF_LAND * (1 - COMMON_AREA_PCT);  // 1,080 m² net after common area
    const footprint = REF_LAND * EXPLOIT_PCT;            // 240 m² building footprint

    return types.map(t => {
      const floorArea = footprint * t.aboveFloors + footprint * t.jamalonPct + footprint * t.undergroundPct;
      const totalLotBUA = Math.round(floorArea * (1 + BALCONY_PCT));
      const unitsPerLot = totalLotBUA / t.avgUnitSize;  // can be fractional (e.g. 1.25)
      // Per-villa figures
      const buaPerVilla = t.avgUnitSize;  // input — the target unit size
      const landPerVilla = Math.round(netLand / unitsPerLot);
      const buildCost = buaPerVilla * BUILD_COST;
      const landCost = landPerVilla * LAND_COST_SQM;
      const revenue = buaPerVilla * t.sell;
      const profit = revenue - buildCost - landCost;
      const margin = revenue > 0 ? profit / revenue : 0;
      const garden = landPerVilla - Math.round(buaPerVilla / (t.aboveFloors + (t.undergroundPct > 0 ? 1 : 0)));
      return { ...t, totalLotBUA, unitsPerLot, buaPerVilla, landPerVilla, buildCost, landCost, revenue, profit, margin, garden };
    });
  }, []);

  const TABS = [
    { id: "returns" as const, label: t("inv_tab_returns"), sub: t("inv_tab_sub_returns") },
    { id: "deal" as const, label: t("inv_tab_deal"), sub: t("inv_tab_sub_deal") },
  ];

  // Mount guard: prevent hydration mismatch from Zustand store differences
  if (!mounted) {
    return (
      <div className="min-h-screen" style={{ background: "#F4F9EF" }}>
        <AppHeader currentPage="investor" />
        <div className="bg-dh-dark text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
            <div className="flex-1">
              <h1 className="text-xl font-serif font-semibold text-white mb-4 leading-snug">
                {t("inv_hero_headline")}
              </h1>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 text-center text-gray-400 text-sm">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F4F9EF" }}>
      {/* Shared Navigation Header */}
      <AppHeader currentPage="investor" />

      {/* Hero — Investment Narrative */}
      <div className="bg-dh-dark text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 sm:gap-8">
            <div className="flex-1">
              <h1 className="text-xl font-serif font-semibold text-white mb-4 leading-snug">
                {t("inv_hero_headline")}
              </h1>
              <ul className="space-y-2 mb-6">
                {[
                  { icon: "🏗️", text: t("inv_bullet_1") },
                  { icon: "🏠", text: t("inv_bullet_2") },
                  { icon: "📈", text: t("inv_bullet_3") },
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                    <span className="text-base leading-5 flex-shrink-0">{b.icon}</span>
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/customer"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
                style={{ background: "#78BF42", color: "#fff" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#67AA34")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#78BF42")}
              >
                {t("inv_browse_units")} →
              </a>
            </div>
            {/* Right side — quick project stats */}
            <div className="hidden md:flex flex-col gap-3 flex-shrink-0 text-right" dir="ltr">
              {[
                { val: serverReady ? summary.phaseBreakdown.filter(p => [1,2,3].includes(p.phase)).reduce((s, p) => s + p.lotCount, 0) || "—" : "—", unit: "lots", label: lang === "ar" ? "قطعة أرض" : "in 3 phases" },
                { val: "80,000", unit: "m²", label: lang === "ar" ? "مساحة إجمالية" : "total land area" },
                { val: serverReady ? formatPct(waterfall.l2InvestorROI) : "—", unit: "", label: lang === "ar" ? "عائد على النقد" : "projected ROI on cash" },
              ].map((s, i) => (
                <div key={i} className="text-right">
                  <div className="text-white font-bold text-lg tabular-nums">
                    {s.val}{s.unit && <span className="text-sm font-normal text-gray-400 ml-1">{s.unit}</span>}
                  </div>
                  <div className="text-gray-400 text-xs">{s.label}</div>
                </div>
              ))}
              <a
                href="/investor/term-sheet"
                className="text-xs underline mt-2 transition-colors"
                style={{ color: "#95CC58" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#78BF42")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#95CC58")}
              >
                {t("term_sheet_nav")} →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Assumption knobs strip */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-4 mb-1">
        <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl px-5 py-3 shadow-sm border border-gray-100 text-xs">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{lang === "ar" ? "الافتراضات" : "Assumptions"}</span>
          {/* Cash % of construction */}
          <label className="flex items-center gap-2 text-gray-500">
            {lang === "ar" ? "نقد من التشييد" : "Cash % of construction"}
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={10} max={100} step={5}
                value={Math.round(config.cashPctOfConstruction * 100)}
                onChange={(e) => setConfig({ cashPctOfConstruction: Math.min(1, Math.max(0.1, Number(e.target.value) / 100)) })}
                className="w-14 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-dh-green focus:outline-none focus:ring-1 focus:ring-dh-hills"
              />
              <span className="text-gray-400">%</span>
            </div>
          </label>
          {/* Selling price */}
          <label className="flex items-center gap-2 text-gray-500">
            {lang === "ar" ? "سعر البيع" : "Sell price"}
            <div className="flex items-center gap-1">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min={800} max={3000} step={50}
                value={config.sellingPriceSqm}
                onChange={(e) => setConfig({ sellingPriceSqm: Number(e.target.value) })}
                className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-dh-green focus:outline-none focus:ring-1 focus:ring-dh-hills"
              />
              <span className="text-gray-400">/m²</span>
            </div>
          </label>
          {/* Construction cost */}
          <label className="flex items-center gap-2 text-gray-500">
            {lang === "ar" ? "تكلفة البناء" : "Construction"}
            <div className="flex items-center gap-1">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min={300} max={1200} step={50}
                value={config.constructionCostSqm}
                onChange={(e) => setConfig({ constructionCostSqm: Number(e.target.value) })}
                className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold text-dh-green focus:outline-none focus:ring-1 focus:ring-dh-hills"
              />
              <span className="text-gray-400">/m²</span>
            </div>
          </label>
        </div>
      </div>

      {/* ── 5-Tab Investment Walkthrough ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        {/* Tab Navigation — walkthrough style with step numbers + subtitles */}
        <div className="mb-6">
          <div className="flex gap-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-1.5">
            {TABS.map((tab, idx) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-3 rounded-xl text-center transition-all ${
                  activeTab === tab.id
                    ? "bg-dh-dark text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${
                  activeTab === tab.id ? "text-white/60" : "text-gray-300"
                }`}>
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div className="text-xs font-semibold leading-tight">{tab.label}</div>
                <div className={`text-[9px] mt-0.5 leading-tight hidden sm:block ${
                  activeTab === tab.id ? "text-white/60" : "text-gray-400"
                }`}>
                  {tab.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab 1: Your Returns ── */}
        {activeTab === "returns" && (
          <div className="space-y-5">
            {/* Pitch hero */}
            <div className="bg-dh-dark text-white rounded-2xl p-5 sm:p-6">
              <div className="text-[10px] uppercase tracking-widest text-white/50 mb-2">
                {lang === "ar" ? "فرصتك الاستثمارية" : "Your investment opportunity"}
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-semibold leading-snug mb-3">
                {lang === "ar"
                  ? `استثمر من $350K. احصل على ${formatPct(waterfall.l2InvestorROI)} على رأس المال — في أقل من 3 سنوات.`
                  : `Invest from $350K. Earn ${formatPct(waterfall.l2InvestorROI)} on cash — in under 3 years.`}
              </h2>
              <p className="text-sm text-gray-300 leading-relaxed">
                {lang === "ar"
                  ? "أنت تموّل بناء الفلل. يُعاد رأس مالك أولاً عند بيع كل فيلا — ثم تحصل على 50% من الربح المتبقي. بلا أولويات للآخرين. بلا تجميد طويل للأموال."
                  : "You fund villa construction. Your capital is returned first when each villa sells — then you receive 50% of the remaining profit. No subordination. No long lock-ups."}
              </p>
            </div>

            {/* Model toggle */}
            <div className="flex items-center gap-2">
              <button onClick={() => setWaterfallModel("split")}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${waterfallModel === "split" ? "bg-dh-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {t("inv_waterfall_model_a")}
              </button>
              {mounted && investorFeatureFlags.showModelB && (
                <button onClick={() => setWaterfallModel("priority")}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${waterfallModel === "priority" ? "bg-dh-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {t("inv_waterfall_model_b")}
                </button>
              )}
            </div>

            {/* ── Layer 2: Villa Development ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-[#E65100] mb-0.5">
                  {lang === "ar" ? "الطبقة الثانية — تطوير الفلل" : "Layer 2 — Villa Development"}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {lang === "ar"
                    ? <>أنت تموّل البناء. بعد بيع الفيلا، يُعاد رأس مالك أولاً — ثم تحصل على <strong className="text-gray-700">50% من الربح المتبقي</strong>.</>
                    : <>You fund construction. After the villa sells, your capital is returned first — then you receive <strong className="text-gray-700">50% of the remaining profit</strong>.</>}
                </p>
              </div>

              {/* $350K / $450K / $550K ticket cards */}
              <div className="grid grid-cols-3 gap-3">
                {([350_000, 450_000, 550_000] as const).map((ticketSize) => {
                  const ratio = activeWaterfall.l2InvestorCash > 0 ? ticketSize / activeWaterfall.l2InvestorCash : 0;
                  const profit = Math.round(activeWaterfall.l2InvestorProfit * ratio);
                  const total = ticketSize + profit;
                  const roi = ticketSize > 0 ? profit / ticketSize : 0;
                  return (
                    <div key={ticketSize} className="rounded-xl border border-dh-hills/40 bg-green-50/40 p-4 space-y-3">
                      <div className="text-sm font-bold text-gray-900">
                        {lang === "ar" ? `${formatUSD(ticketSize)} استثمار` : `${formatUSD(ticketSize)} ticket`}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "فلل ممولة" : "Villas funded"}</span>
                          <span className="tabular-nums font-medium text-gray-800">{ratio.toFixed(1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "ربحك (50%)" : "Your profit (50%)"}</span>
                          <span className="tabular-nums font-bold text-emerald-700">{formatUSD(profit)}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5">
                          <span className="text-gray-700 font-semibold">{lang === "ar" ? "إجمالي العائد" : "Total return"}</span>
                          <span className="tabular-nums font-bold text-dh-green">{formatUSD(total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "العائد على النقد" : "ROI on cash"}</span>
                          <span className="tabular-nums font-bold text-emerald-700">{formatPct(roi)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-villa breakdown confirming the 50% split */}
              <div className="border-t border-gray-100 pt-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-3">
                  {lang === "ar" ? "تفاصيل ربح كل فيلا" : "Per-villa profit breakdown"}
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr>
                      <td className="py-1.5 text-gray-600 font-medium">{lang === "ar" ? "سعر بيع الفيلا" : "Villa sale price"}</td>
                      <td className="py-1.5 text-right tabular-nums text-dh-green font-bold">{formatUSD(activeWaterfall.revenue)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-400 pl-3">{lang === "ar" ? "− تكلفة البناء الكاملة" : "− Construction + soft costs"}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-400">({formatUSD(activeWaterfall.totalConstructionCost)})</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-400 pl-3">{lang === "ar" ? "− تكلفة الأرض" : "− Land cost"}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-400">({formatUSD(activeWaterfall.totalLandCost)})</td>
                    </tr>
                    {waterfallModel === "priority" && activeWaterfall.priorityAmount > 0 && (
                      <tr>
                        <td className="py-1.5 text-emerald-600 pl-3">{lang === "ar" ? "+ عائد الأولوية (10%)" : "+ Priority return (10%)"}</td>
                        <td className="py-1.5 text-right tabular-nums text-emerald-600">{formatUSD(activeWaterfall.priorityAmount)}</td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-200">
                      <td className="py-1.5 text-gray-700 font-medium">{lang === "ar" ? "صافي الربح (تقسيم 50/50)" : "Net profit (50/50 split)"}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold text-gray-800">{formatUSD(activeWaterfall.remainingForSplit)}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-400 pl-5 text-[10px]">{lang === "ar" ? "رأس مالك المسترد" : "Your capital returned"}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-400 text-[10px]">{formatUSD(activeWaterfall.l2InvestorCash)}</td>
                    </tr>
                    <tr className="bg-emerald-50/70 rounded-lg">
                      <td className="py-2 text-emerald-700 font-bold pl-1">{lang === "ar" ? "✓ حصتك 50%" : "✓ Your 50% share"}</td>
                      <td className="py-2 text-right tabular-nums font-bold text-emerald-700">{formatUSD(activeWaterfall.l2InvestorProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Per-Typology Profitability ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-0.5">
                  {lang === "ar" ? "ربحية كل فيلا حسب النوع" : "Per-Villa Profitability by Type"}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {lang === "ar"
                    ? <>قطعة <strong className="text-gray-700">{REF_LAND.toLocaleString()} م²</strong> · بناء <strong className="text-gray-700">${BUILD_COST}/م²</strong> · أرض <strong className="text-gray-700">${LAND_COST_SQM}/م²</strong> · استغلال <strong className="text-gray-700">{(EXPLOIT_PCT * 100).toFixed(0)}%</strong> · +<strong className="text-gray-700">{(BALCONY_PCT * 100).toFixed(0)}%</strong> شرفات</>
                    : <>Lot <strong className="text-gray-700">{REF_LAND.toLocaleString()} m²</strong> · Build <strong className="text-gray-700">${BUILD_COST}/m²</strong> · Land <strong className="text-gray-700">${LAND_COST_SQM}/m²</strong> · Exploitation <strong className="text-gray-700">{(EXPLOIT_PCT * 100).toFixed(0)}%</strong> · +<strong className="text-gray-700">{(BALCONY_PCT * 100).toFixed(0)}%</strong> balconies</>}
                </p>
              </div>

              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-xs border-collapse min-w-[540px]">
                  <thead>
                    <tr className="text-left text-gray-400 text-[10px] uppercase tracking-wider">
                      <th className="pb-2 font-medium"></th>
                      {villaTypologyData.map(t => (
                        <th key={t.key} className="pb-2 font-semibold text-center" style={{ color: t.color }}>
                          {lang === "ar" ? t.labelAr : t.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "مساحة بناء / قطعة" : "BUA / lot"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-gray-700">{t.totalLotBUA.toLocaleString()} m²</td>)}
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "وحدات / قطعة" : "Units / lot"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-gray-700">{t.unitsPerLot % 1 === 0 ? t.unitsPerLot : t.unitsPerLot.toFixed(2)}</td>)}
                    </tr>
                    <tr className="bg-gray-50/30">
                      <td className="py-1.5 text-gray-500 font-medium">{lang === "ar" ? "م² بناء / فيلا" : "BUA / villa"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-gray-700">{t.buaPerVilla.toLocaleString()} m²</td>)}
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "أرض / فيلا" : "Land / villa"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-gray-700">{t.landPerVilla.toLocaleString()} m²</td>)}
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "حديقة" : "Garden"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-emerald-600">{t.garden.toLocaleString()} m²</td>)}
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="py-1.5 text-gray-500 font-medium">{lang === "ar" ? "تكلفة البناء" : "Build cost"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-medium text-red-600">{formatUSD(t.buildCost)}</td>)}
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "تكلفة الأرض" : "Land cost"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums text-gray-600">{formatUSD(t.landCost)}</td>)}
                    </tr>
                    <tr className="bg-gray-50/50">
                      <td className="py-1.5 text-gray-500 font-medium">{lang === "ar" ? "إيرادات البيع" : "Revenue"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-bold text-dh-green">{formatUSD(t.revenue)}</td>)}
                    </tr>
                    <tr className="border-t-2 border-gray-200">
                      <td className="py-2 text-gray-700 font-bold">{lang === "ar" ? "صافي الربح / فيلا" : "Profit / villa"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-2 text-center tabular-nums font-bold text-emerald-700">{formatUSD(t.profit)}</td>)}
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">{lang === "ar" ? "هامش الربح" : "Margin"}</td>
                      {villaTypologyData.map(t => <td key={t.key} className="py-1.5 text-center tabular-nums font-bold" style={{ color: t.color }}>{formatPct(t.margin)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Layer 1: Land Fund ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-[#1565C0] mb-0.5">Layer 1 — Land Fund</div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Buy a fractional land stake at <strong className="text-gray-700">${config.l1EntryPrice}/m²</strong> today. Exit at <strong className="text-gray-700">${config.l1ExitPriceCap}/m²</strong> upon land transfer or direct sale.
                </p>
              </div>

              {/* $350K / $450K / $550K ticket cards */}
              <div className="grid grid-cols-3 gap-3">
                {([350_000, 450_000, 550_000] as const).map((ticketSize) => {
                  const pct = config.l1FundSize > 0 ? ticketSize / config.l1FundSize : 0;
                  const sqm = Math.floor(l1Returns.sqmAcquired * pct);
                  const profit = Math.round(l1Returns.profit * pct);
                  const total = ticketSize + profit;
                  const roi = ticketSize > 0 ? profit / ticketSize : 0;
                  return (
                    <div key={ticketSize} className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 space-y-3">
                      <div className="text-sm font-bold text-gray-900">
                        {lang === "ar" ? `${formatUSD(ticketSize)} استثمار` : `${formatUSD(ticketSize)} ticket`}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "أرض مكتسبة" : "Land acquired"}</span>
                          <span className="tabular-nums font-medium text-gray-800">{sqm.toLocaleString()} m²</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "ربحك" : "Your profit"}</span>
                          <span className="tabular-nums font-bold text-[#1565C0]">{formatUSD(profit)}</span>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5">
                          <span className="text-gray-700 font-semibold">{lang === "ar" ? "إجمالي العائد" : "Total return"}</span>
                          <span className="tabular-nums font-bold text-[#1565C0]">{formatUSD(total)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">{lang === "ar" ? "العائد على الاستثمار" : "ROI"}</span>
                          <span className="tabular-nums font-bold text-[#1565C0]">{formatPct(roi)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* L1 mechanics strip */}
              <div className="border-t border-gray-100 pt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">{lang === "ar" ? "سعر الدخول" : "Entry price"}</div>
                  <div className="text-sm font-bold text-gray-700">${config.l1EntryPrice}/m²</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">{lang === "ar" ? "سقف الخروج" : "Exit cap"}</div>
                  <div className="text-sm font-bold text-gray-700">${config.l1ExitPriceCap}/m²</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-400 mb-1">{lang === "ar" ? "معدل العائد الداخلي" : "Fund IRR"}</div>
                  <div className="text-sm font-bold text-[#1565C0]">{formatPct(l1Returns.irr)}</div>
                </div>
              </div>
            </div>

            {/* Combine both layers note */}
            <div className="bg-dh-dark text-white rounded-2xl p-5">
              <div className="text-xs font-semibold text-dh-light uppercase tracking-wide mb-2">
                {lang === "ar" ? "ملاحظة: يمكنك الجمع بين الطبقتين" : "Note: You can combine both layers"}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {lang === "ar"
                  ? "يمكن للمستثمر المشاركة في الطبقة الأولى (صندوق الأرض) والطبقة الثانية (تطوير الفلل) في آنٍ واحد، مما يتيح تنويع العوائد."
                  : "You can participate in Layer 1 (land fund) and Layer 2 (villa development) simultaneously, diversifying your return profile across both timelines."}
              </p>
            </div>
          </div>
        )}

        {/* ── Tab 2: The Deal ── */}
        {activeTab === "deal" && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* L1 Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 text-white" style={{ background: "linear-gradient(135deg, #1565C0 0%, #1976D2 100%)" }}>
                  <div className="text-white/70 text-[10px] uppercase tracking-widest mb-1">{t("inv_l1_label")}</div>
                  <div className="text-2xl font-bold tabular-nums">{formatUSD(config.l1FundSize)}</div>
                  <div className="text-blue-200 text-xs mt-1">{t("fund_size")}</div>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <Row label={t("entry_price")} value={`$${config.l1EntryPrice}/m²`} />
                  <Row label={t("exit_price")} value={`$${config.l1ExitPriceCap}/m² (cap)`} />
                  <Row label={t("timeline")} value={`${config.l1Timeline} ${lang === "ar" ? "سنة" : "years"}`} />
                  <Row label={t("sqm_acquired")} value={`${l1Returns.sqmAcquired.toLocaleString()} m²`} />
                  <div className="h-px bg-gray-100" />
                  <Row label={t("inv_your_roi")} value={formatPct(l1Returns.roi)} highlight />
                  <Row label={t("irr")} value={formatPct(l1Returns.irr)} highlight />
                </div>
              </div>

              {/* L2 Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 text-white" style={{ background: "linear-gradient(135deg, #BF360C 0%, #E65100 100%)" }}>
                  <div className="text-white/70 text-[10px] uppercase tracking-widest mb-1">{t("inv_l2_label")}</div>
                  <div className="text-2xl font-bold tabular-nums">{formatUSD(waterfall.l2InvestorCash)}</div>
                  <div className="text-orange-200 text-xs mt-1">{lang === "ar" ? "نقد لكل فيلا" : "cash per villa"}</div>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <Row label={t("construction_cost")} value={`$${config.constructionCostSqm}/m²`} />
                  <Row label={t("bua_per_villa") || "BUA/villa"} value={`${config.buaPerVilla} m²`} />
                  <Row label={t("soft_cost_pct")} value={formatPct(config.softCostPct)} />
                  <Row label={t("cash_pct")} value={`${(config.cashPctOfConstruction * 100).toFixed(0)}% ${lang === "ar" ? "من التشييد" : "of construction"}`} />
                  <div className="h-px bg-gray-100" />
                  <Row label={t("inv_your_roi")} value={formatPct(waterfall.l2InvestorROI)} highlight />
                  <Row label={t("inv_your_profit")} value={formatUSD(waterfall.l2InvestorProfit)} highlight />
                </div>
              </div>
            </div>

            {/* Capital Stack Bar */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="text-xs font-semibold text-gray-700 mb-3">{lang === "ar" ? "هيكل رأس المال — لكل فيلا" : "Capital Stack — per villa"}</h3>
              {(() => {
                const total = waterfall.revenue;
                if (total <= 0) return null;
                const segments = [
                  { label: lang === "ar" ? "نقد المستثمر ل2" : "L2 Cash", value: waterfall.l2InvestorCash, color: "#E65100" },
                  ...(waterfall.unfundedConstruction > 0 ? [{ label: lang === "ar" ? "تمويل البناء" : "Constr. Finance", value: waterfall.unfundedConstruction, color: "#BF360C" }] : []),
                  { label: lang === "ar" ? "أرض ل1" : "L1 Land", value: waterfall.l1LandPayment, color: "#1565C0" },
                  { label: lang === "ar" ? "أرض المالك" : "Owner Land", value: waterfall.ownerLandEquity, color: "#78909C" },
                  { label: lang === "ar" ? "ربح ل2" : "L2 Profit", value: waterfall.l2InvestorProfit, color: "#059669" },
                  { label: lang === "ar" ? "ربح المالك" : "Owner Profit", value: waterfall.ownerProfit, color: "#4CAF50" },
                ];
                return (
                  <div>
                    <div className="flex rounded-lg overflow-hidden h-8">
                      {segments.map((seg) => (
                        <div key={seg.label} className="flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ width: `${(seg.value / total * 100).toFixed(1)}%`, backgroundColor: seg.color }}>
                          {seg.value / total > 0.1 ? `${(seg.value / total * 100).toFixed(0)}%` : ""}
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {segments.map((seg) => (
                        <div key={seg.label} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
                          <span className="text-[10px] text-gray-500">{seg.label}</span>
                          <span className="text-[10px] font-semibold text-gray-700 tabular-nums">{formatUSD(seg.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Interlock Callout */}
            <div className="rounded-2xl p-5 border border-purple-200 bg-purple-50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-purple-700">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-purple-900 mb-1">{t("inv_interlock_title")}</div>
                  <p className="text-xs text-purple-700 leading-relaxed">{t("inv_interlock_desc")}</p>
                </div>
              </div>
            </div>

            {/* Phase Pricing — Entry Advantage */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-900">{t("inv_phase_advantage")}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{t("inv_phase_advantage_desc")}</p>
              </div>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500">{lang === "ar" ? "المرحلة" : "Phase"}</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">
                      {t("phase_avg_land_retail")}
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">
                      {t("phase_avg_villa_sell")}
                    </th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500">{t("inv_your_profit")}</th>
                    <th className="text-center px-4 py-3 font-semibold text-dh-green">{t("phase_avg_l2_roi")}</th>
                  </tr>
                </thead>
                <tbody>
                  {config.phaseLandPrices.map((p, i) => {
                    const pp = phasedPricing[i];
                    const pm = lotPhaseMetrics[p.phase as 1 | 2 | 3];
                    return (
                      <tr key={p.phase} className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {lang === "ar" ? `مرحلة ${p.phase}` : `Phase ${p.phase}`}
                          {i === 0 && <span className="ml-2 px-1.5 py-0.5 bg-dh-green/10 text-dh-green rounded text-[9px] font-bold">{lang === "ar" ? "أفضل دخول" : "BEST ENTRY"}</span>}
                          {pm && (
                            <div className="text-[9px] text-gray-400 mt-0.5 font-normal">
                              {pm.totalVillas} {lang === "ar" ? "فيلا" : "villas"} · {formatUSD(pm.totalCashNeeded)} {lang === "ar" ? "نقداً إجمالاً" : "total cash"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-gray-600">
                          {pm ? (
                            <span className="font-medium">${pm.avgLandRetail.toFixed(0)}/m²</span>
                          ) : (
                            <span className="text-gray-400">${p.pricePerSqm}/m²</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums text-gray-600">
                          {pm ? (
                            <span className="font-medium">${pm.avgVillaSell.toFixed(0)}/m²</span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-medium text-emerald-700">
                          {pm ? formatUSD(pm.avgL2Profit) : (pp ? formatUSD(pp.villaProfit) : "—")}
                        </td>
                        <td className="px-4 py-3 text-center tabular-nums font-bold text-dh-green">
                          {pm ? formatPct(pm.avgL2ROI) : (pp ? formatPct(pp.investorROI) : "—")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* L1 Exit Mechanisms — hidden by default, toggle in admin */}
            {mounted && investorFeatureFlags.showL1ExitMechanisms && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("inv_exit_mechanisms")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-3 font-semibold text-gray-500">{lang === "ar" ? "آلية الخروج" : "Exit Mechanism"}</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500">{lang === "ar" ? "الزناد" : "Trigger"}</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500">{t("exit_price")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500">{t("net_profit")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-dh-green">{t("inv_your_roi")}</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500">{t("irr")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l1ExitOptions.map((opt) => (
                      <tr key={opt.name} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="px-3 py-3 font-medium text-gray-800">{lang === "ar" ? opt.nameAr : opt.name}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{opt.trigger}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{formatUSD(opt.exitPrice)}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-emerald-700 font-medium">{formatUSD(opt.profit)}</td>
                        <td className="px-3 py-3 text-center tabular-nums font-bold text-dh-green">{formatPct(opt.roi)}</td>
                        <td className="px-3 py-3 text-center tabular-nums text-gray-600">{formatPct(opt.irr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Cash Flow Horizon — hidden by default, toggle in admin */}
            {mounted && investorFeatureFlags.showCashFlowHorizon && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {lang === "ar" ? "أفق التدفق النقدي" : "Cash Flow Horizon"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
                {([
                  { label: lang === "ar" ? "بدون مبيعات" : "No Sales", data: cashSufficiency.noSales, color: "#ef4444" },
                  { label: lang === "ar" ? "بناء وبيع" : "Build & Sell", data: cashSufficiency.buildAndSell, color: "#059669" },
                  { label: lang === "ar" ? "بناء 5 وتوقف" : "Build 5, Stop", data: cashSufficiency.build5Stop, color: "#f59e0b" },
                ] as { label: string; data: number[]; color: string }[]).map((scenario) => (
                  <div key={scenario.label} className="bg-gray-50 rounded-xl p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: scenario.color }}>{scenario.label}</div>
                    <div className="space-y-1">
                      {scenario.data.slice(0, 4).map((v, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-gray-400">{lang === "ar" ? `السنة ${i + 1}` : `Year ${i + 1}`}</span>
                          <span className={`font-medium tabular-nums ${v >= 0 ? "text-emerald-600" : "text-red-500"}`}>{formatUSD(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}
          </div>
        )}

      </div>

      {/* ── Sensitivity Analysis ── */}
      {/* ── Interactive Lot Map with L1/L2 Pricing ── */}
      <InvestorMap lang={lang} assignments={assignments} />

      {/* <SensitivitySection config={config} setConfig={setConfig} lang={lang} /> */}

      <AppFooter />

      {/* Phase Breakdown Charts — hidden by default, toggle in admin */}
      {mounted && investorFeatureFlags.showPhaseBreakdown && (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900">{t("phase_breakdown")}</h2>
          {phaseChartData.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] text-gray-400">
              {[["#64748b", t("land_cost")], ["#94a3b8", t("construction")], ["#2D6A4F", t("revenue")], ["#059669", t("net_profit")]].map(([color, label]) => (
                <span key={label as string} className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color as string }} /> {label}</span>
              ))}
            </div>
          )}
        </div>

        {phaseChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={phaseChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                <YAxis tickFormatter={formatAxisUSD} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip content={<BarTooltip />} />
                <Bar dataKey="Land Cost" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Construction" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Revenue" fill="#2D6A4F" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Profit" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {phaseChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.Profit >= 0 ? "#059669" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {phases.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center text-gray-400 text-sm">
            {t("no_phases_assigned")}
            <br />
            {role === "admin" && (
              <a href="/simulator" className="text-dh-green underline mt-2 inline-block">
                {t("go_simulator_configure")}
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-12">
            {[1, 2, 3].map((phaseNum) => {
              const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
              if (!phase || phase.lotCount === 0) {
                return (
                  <div key={phaseNum} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 opacity-40">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS[phaseNum] }} />
                      <h3 className="text-sm font-semibold text-gray-400">{t("phase_label")} {phaseNum}</h3>
                    </div>
                    <p className="text-xs text-gray-400">{t("not_configured")}</p>
                  </div>
                );
              }
              return (
                <div key={phaseNum} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS[phaseNum] }} />
                    <h3 className="text-sm font-semibold text-gray-900">{t("phase_label")} {phaseNum}</h3>
                    <span className="ml-auto text-xs text-gray-400">{phase.lotCount} {t("lots")}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("units")}</span>
                      <span className="font-medium tabular-nums">{phase.totalUnits}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("revenue")}</span>
                      <span className="font-semibold text-dh-green tabular-nums">{formatUSD(phase.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-700">{t("net_profit")}</span>
                      <span className={`font-bold tabular-nums ${phase.totalNetProfit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {formatUSD(phase.totalNetProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("roi")}</span>
                      <span className="font-semibold tabular-nums">{formatPct(phase.roi)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ── Investor Map with L1/L2 Pricing ─────────────────────────────────────────

const LOT_RETAIL_MAP = new Map(LOT_PRICES.map(lp => [lp.lot, lp.price_sqm]));
const L1_DISCOUNT = 0.35;
const L2_DISCOUNT_MAP = 0.20;

function InvestorMap({ lang, assignments }: { lang: string; assignments: Map<number, any> }) {
  const lotStatuses = useSimulationStore((s) => s.lotStatuses);
  const [phaseFilter, setPhaseFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [selectedLotIds, setSelectedLotIds] = useState<Set<number>>(new Set());
  const [lassoMode, setLassoMode] = useState(false);

  // Filter lots by phase (include all for display, sold lots shown but dimmed)
  const filteredLotIds = useMemo(() => {
    const ids = new Set<number>();
    for (const lot of LOTS) {
      const a = assignments.get(lot.id);
      if (!a || a.developmentType === "unassigned") continue;
      if (phaseFilter === "all" || a.phase === phaseFilter) ids.add(lot.id);
    }
    return ids;
  }, [assignments, phaseFilter]);

  // Handle lot selection (toggle) — skip sold lots
  const handleSelectLot = (lotId: number) => {
    const status = lotStatuses.get(lotId);
    if (status === "sold") return;
    setSelectedLotIds(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      return next;
    });
  };

  // Lasso selection — replace current selection with lassoed lots (excl. sold)
  const handleLassoSelect = (lotIds: number[]) => {
    const selectable = lotIds.filter(id =>
      filteredLotIds.has(id) && lotStatuses.get(id) !== "sold"
    );
    if (selectable.length > 0) setSelectedLotIds(new Set(selectable));
  };

  // Compute pricing for selected lots (exclude sold)
  const selectionPricing = useMemo(() => {
    const ids = selectedLotIds.size > 0 ? selectedLotIds : filteredLotIds;
    const lots = LOTS.filter(l => ids.has(l.id) && lotStatuses.get(l.id) !== "sold");
    if (lots.length === 0) return null;

    const totalArea = lots.reduce((s, l) => s + l.area_sqm, 0);
    const weightedRetail = lots.reduce((s, l) => {
      const retail = LOT_RETAIL_MAP.get(l.id) ?? l.zone_price_retail;
      return s + l.area_sqm * retail;
    }, 0);
    const avgRetail = weightedRetail / totalArea;

    return {
      count: lots.length,
      totalArea,
      avgRetail,
      avgL1: avgRetail * (1 - L1_DISCOUNT),
      avgL2: avgRetail * (1 - L2_DISCOUNT_MAP),
      isSelection: selectedLotIds.size > 0,
    };
  }, [selectedLotIds, filteredLotIds, lotStatuses]);

  const fmtP = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
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
                  phaseFilter === ph
                    ? "bg-dh-dark text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
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
          <div className="flex-1 h-[580px] relative overflow-hidden">
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
            />
          </div>

          {/* Pricing sidebar */}
          <div className="lg:w-[280px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 p-4 space-y-4">
            {/* Selection info */}
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
                {/* Retail */}
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
                    {lang === "ar" ? "سعر التجزئة" : "Retail Price"}
                  </div>
                  <div className="text-xl font-bold text-gray-800">{fmtP(selectionPricing.avgRetail)}/m²</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgRetail * selectionPricing.totalArea)}
                  </div>
                </div>

                {/* L1 */}
                <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                  <div className="text-[9px] uppercase tracking-wider text-blue-500 mb-0.5">
                    Layer 1 (−35%)
                  </div>
                  <div className="text-xl font-bold text-blue-700">{fmtP(selectionPricing.avgL1)}/m²</div>
                  <div className="text-[10px] text-blue-400 mt-0.5">
                    {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgL1 * selectionPricing.totalArea)}
                  </div>
                </div>

                {/* L2 */}
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                  <div className="text-[9px] uppercase tracking-wider text-emerald-500 mb-0.5">
                    Layer 2 (−20%)
                  </div>
                  <div className="text-xl font-bold text-emerald-700">{fmtP(selectionPricing.avgL2)}/m²</div>
                  <div className="text-[10px] text-emerald-400 mt-0.5">
                    {lang === "ar" ? "إجمالي" : "total"} {fmtP(selectionPricing.avgL2 * selectionPricing.totalArea)}
                  </div>
                </div>
              </div>
            )}

            {/* Clear selection */}
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
    </div>
  );
}

// ── Sensitivity Section ─────────────────────────────────────────────────────

// Inline ROI computation for matrix cells (avoids calling computeWaterfall for every cell)
function cellROI(
  cfg: InvestmentConfig,
  landSqm: number,
  sellSqm: number,
  cashPct?: number
): number {
  const cp = cashPct ?? cfg.cashPctOfConstruction;
  const totalLand = cfg.landPerVilla * landSqm;
  const construction = cfg.buaPerVilla * cfg.constructionCostSqm;
  const soft = construction * cfg.softCostPct;
  const totalConstructionCost = construction + soft;
  const l2Cash = construction * cp + soft;
  const revenue = cfg.buaPerVilla * sellSqm;
  // Subtract ALL costs: full construction + full land
  const after = revenue - totalConstructionCost - totalLand;
  const priority = cfg.priorityEnabled ? l2Cash * cfg.priorityReturnPct : 0;
  const remaining = after - priority;
  const profit = priority + remaining * cfg.profitSplitInvestor;
  return l2Cash > 0 ? profit / l2Cash : 0;
}

function SensitivitySection({
  config,
  setConfig,
  lang,
}: {
  config: InvestmentConfig;
  setConfig: (u: Partial<InvestmentConfig>) => void;
  lang: string;
}) {
  const isAr = lang === "ar";

  // Panel B state
  const [cashPctSlider, setCashPctSlider] = useState(config.cashPctOfConstruction);

  // Panel C — local editable phase prices (initialised from config)
  const [phasePrices, setPhasePrices] = useState<number[]>(
    config.phaseLandPrices.map((p) => p.pricePerSqm)
  );

  // Matrix rows / cols
  const LAND_PRICES = [200, 225, 250, 275, 300, 325, 350];
  const SELL_PRICES = [1100, 1200, 1300, 1400, 1500, 1600, 1700];

  // Base case
  const baseLand = config.phaseLandPrices[0]?.pricePerSqm ?? 275;
  const baseSell = config.sellingPriceSqm;

  // ROI cell colour
  function roiColor(roi: number): { bg: string; text: string } {
    if (roi > 0.25) return { bg: "#dcfce7", text: "#166534" };
    if (roi > 0.15) return { bg: "#fefce8", text: "#713f12" };
    if (roi > 0)    return { bg: "#fee2e2", text: "#991b1b" };
    return { bg: "#f3f4f6", text: "#6b7280" };
  }

  // Panel B: live stats from slider
  const construction = config.buaPerVilla * config.constructionCostSqm;
  const soft = construction * config.softCostPct;
  const l2CashAtSlider = construction * cashPctSlider + soft;
  const roi_B = cellROI(config, baseLand, baseSell, cashPctSlider);
  const villasPerMillion_B = l2CashAtSlider > 0 ? Math.floor(1_000_000 / l2CashAtSlider) : 0;

  // Panel B bar data
  const cashBarData = [30, 40, 50, 60, 70, 80, 90, 100].map((pct) => ({
    name: `${pct}%`,
    roi: +(cellROI(config, baseLand, baseSell, pct / 100) * 100).toFixed(1),
  }));

  // Panel C: per-phase row data (no owner take)
  function phaseRow(phaseIdx: number) {
    const lp = phasePrices[phaseIdx] ?? baseLand;
    const totalLand = config.landPerVilla * lp;
    const construction2 = config.buaPerVilla * config.constructionCostSqm;
    const soft2 = construction2 * config.softCostPct;
    const totalConstructionCost = construction2 + soft2;
    const l2Cash2 = construction2 * config.cashPctOfConstruction + soft2;
    const villaCost = l2Cash2; // investor's out-of-pocket
    const revenue = config.buaPerVilla * config.sellingPriceSqm;
    // Subtract ALL costs: full construction + full land
    const after = revenue - totalConstructionCost - totalLand;
    const priority = config.priorityEnabled ? l2Cash2 * config.priorityReturnPct : 0;
    const remaining = after - priority;
    const profit = priority + remaining * config.profitSplitInvestor;
    const roi = l2Cash2 > 0 ? profit / l2Cash2 : 0;
    return { lp, villaCost, revenue, roi };
  }

  const fmtU = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toFixed(0)}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6 sm:mt-8">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          {isAr ? "تحليل الحساسية" : "Sensitivity Analysis"}
        </h2>
        <span className="text-[10px] text-gray-400">{isAr ? "تفاعلي — يتحدث فورياً" : "Interactive — updates live"}</span>
      </div>

      <div className="space-y-5">
        {/* ── Panel A: Your Return Matrix ─────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {isAr ? "أ — مصفوفة عائدك" : "A — Your Return Matrix"}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {isAr
              ? "العائد على نقدك (٪) بحسب سعر الأرض × سعر البيع. الخلية الحضراء = الإعداد الحالي."
              : "Your ROI on cash (%) across land price × selling price. Green border = current base case."}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr>
                  <th className="px-2 py-1.5 text-left text-gray-500 font-medium">
                    {isAr ? "أرض \\ بيع" : "Land \\ Sell"}
                  </th>
                  {SELL_PRICES.map((sp) => (
                    <th key={sp} className={`px-2 py-1.5 text-center font-semibold ${sp === baseSell ? "text-dh-green" : "text-gray-500"}`}>
                      ${sp}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LAND_PRICES.map((lp) => (
                  <tr key={lp}>
                    <td className={`px-2 py-1.5 font-semibold ${lp === baseLand ? "text-dh-green" : "text-gray-500"}`}>
                      ${lp}
                    </td>
                    {SELL_PRICES.map((sp) => {
                      const roi = cellROI(config, lp, sp);
                      const c = roiColor(roi);
                      const isBase = lp === baseLand && sp === baseSell;
                      return (
                        <td
                          key={sp}
                          className="px-1 py-1"
                          title={`Land $${lp}/sqm · Sell $${sp}/sqm → ROI ${(roi * 100).toFixed(1)}%`}
                        >
                          <div
                            className="text-center font-bold rounded-md py-1.5 transition-all"
                            style={{
                              background: c.bg,
                              color: c.text,
                              outline: isBase ? `2px solid #2D5A27` : "none",
                              outlineOffset: 1,
                            }}
                          >
                            {(roi * 100).toFixed(0)}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px]">
            {[
              { bg: "#dcfce7", text: "#166534", label: isAr ? ">25% ممتاز" : ">25% Excellent" },
              { bg: "#fefce8", text: "#713f12", label: isAr ? "15–25% جيد" : "15–25% Good" },
              { bg: "#fee2e2", text: "#991b1b", label: isAr ? "<15% ضعيف" : "<15% Weak" },
            ].map(({ bg, text, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded inline-block" style={{ background: bg, border: `1px solid ${text}40` }} />
                <span style={{ color: text }}>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Panel B: Cash Requirement Sensitivity ───────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {isAr ? "ب — حساسية متطلبات النقد" : "B — Cash Requirement Sensitivity"}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {isAr
              ? "كيف تتغير عائداتك مع تغيُّر نسبة التمويل النقدي للتشييد."
              : "How your returns shift as the cash % of construction changes."}
          </p>

          {/* Slider */}
          <div className="mb-5">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-500">
                {isAr ? "نسبة النقد من التشييد" : "Cash % of construction"}
              </span>
              <span className="text-xs font-bold text-dh-green">{Math.round(cashPctSlider * 100)}%</span>
            </div>
            <input
              type="range" min={0.30} max={1.0} step={0.05}
              value={cashPctSlider}
              onChange={(e) => setCashPctSlider(Number(e.target.value))}
              className="w-full accent-dh-green"
            />
            <div className="flex justify-between text-[9px] text-gray-300 mt-0.5">
              <span>30%</span><span>50% ({isAr ? "أساس" : "base"})</span><span>100%</span>
            </div>
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? "نقدك لكل فيلا" : "Your Cash / Villa"}
              </div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{fmtU(l2CashAtSlider)}</div>
            </div>
            <div className={`rounded-xl p-4 ${roi_B < 0.15 ? "bg-red-50" : "bg-emerald-50"}`}>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? "عائدك على النقد" : "Your ROI on Cash"}
              </div>
              <div className={`text-xl font-bold tabular-nums ${roi_B < 0.15 ? "text-red-600" : "text-emerald-700"}`}>
                {(roi_B * 100).toFixed(1)}%
              </div>
              {roi_B < 0.15 && (
                <div className="text-[9px] text-red-500 mt-0.5">
                  {isAr ? "⚠ أقل من الحد الأدنى ١٥٪" : "⚠ Below 15% minimum"}
                </div>
              )}
            </div>
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                {isAr ? "فلل ممولة بمليون $" : "Villas / $1M"}
              </div>
              <div className="text-xl font-bold tabular-nums text-blue-700">{villasPerMillion_B}</div>
            </div>
          </div>

          {/* IRR by holding period */}
          <div className="mb-5">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
              {isAr ? "العائد الداخلي السنوي على النقد المستثمر" : "Annualised IRR on Cash Invested"}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[2, 3, 4].map((yrs) => {
                const irr = Math.pow(1 + roi_B, 1 / yrs) - 1;
                const good = irr >= 0.12;
                const ok   = irr >= 0.08;
                return (
                  <div key={yrs} className={`rounded-xl p-3 text-center ${good ? "bg-emerald-50 border border-emerald-100" : ok ? "bg-amber-50 border border-amber-100" : "bg-red-50 border border-red-100"}`}>
                    <div className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
                      {yrs} {isAr ? "سنوات" : "yr IRR"}
                    </div>
                    <div className={`text-lg font-bold tabular-nums ${good ? "text-emerald-700" : ok ? "text-amber-700" : "text-red-600"}`}>
                      {(irr * 100).toFixed(1)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bar chart */}
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => [`${v}%`, isAr ? "العائد" : "ROI"]} />
                <Bar dataKey="roi" radius={[3, 3, 0, 0]} maxBarSize={28}>
                  {cashBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.roi < 15 ? "#ef4444" : entry.roi > 25 ? "#059669" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Panel C: Phase Pricing Simulator ────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            {isAr ? "ج — محاكاة تسعير المراحل" : "C — Phase Pricing Simulator"}
          </h3>
          <p className="text-xs text-gray-400 mb-4">
            {isAr
              ? "تعديل أسعار الأرض لكل مرحلة لرؤية تأثيرها على عوائدك."
              : "Edit land prices per phase to see the impact on your returns."}
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{isAr ? "المرحلة" : "Phase"}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{isAr ? "سعر الأرض" : "Land Price"}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{isAr ? "نقدك" : "Your Cash"}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{isAr ? "إيراد الفيلا" : "Villa Revenue"}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">{isAr ? "عائدك" : "Your ROI"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[0, 1, 2].map((idx) => {
                  const row = phaseRow(idx);
                  return (
                    <tr key={idx} className={idx === 0 ? "bg-green-50/50" : "bg-white"}>
                      <td className="px-4 py-3 font-semibold text-gray-800">
                        {isAr ? `المرحلة ${idx + 1}` : `Phase ${idx + 1}`}
                        {idx === 0 && <span className="ml-1 text-[9px] text-green-600">({isAr ? "الأفضل" : "Best"})</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            value={phasePrices[idx] ?? 275}
                            min={100} max={600} step={25}
                            onChange={(e) => {
                              const newPrices = [...phasePrices];
                              newPrices[idx] = Number(e.target.value);
                              setPhasePrices(newPrices);
                            }}
                            className="w-20 text-sm font-semibold text-gray-800 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-dh-green"
                          />
                          <span className="text-xs text-gray-400">{isAr ? "/م²" : "/sqm"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800">
                        {fmtU(row.villaCost)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-dh-green">
                        {fmtU(row.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                          row.roi > 0.25 ? "bg-green-100 text-green-700"
                          : row.roi > 0.15 ? "bg-yellow-50 text-yellow-700"
                          : "bg-red-50 text-red-600"
                        }`}>
                          {(row.roi * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600">
                    {isAr ? "متوسط الثلاث مراحل" : "3-Phase Average"}
                  </td>
                  <td />
                  <td />
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const avg = [0, 1, 2].reduce((s, i) => s + phaseRow(i).roi, 0) / 3;
                      return (
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
                          avg > 0.25 ? "bg-green-100 text-green-700" : avg > 0.15 ? "bg-yellow-50 text-yellow-700" : "bg-red-50 text-red-600"
                        }`}>
                          {(avg * 100).toFixed(1)}%
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">
            {isAr
              ? "* تُستخدم الأسعار المُعدَّلة لعرض محاكاة محلية فقط — لحفظها اذهب إلى صفحة الافتراضات."
              : "* Edited prices are for local simulation only — save changes from the Assumptions page."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`tabular-nums font-${highlight ? "bold text-dh-green" : "medium text-gray-800"}`}>{value}</span>
    </div>
  );
}

function WaterfallRow({ label, l2, l1, owner, isRevenue }: {
  label: string;
  l2: number | null;
  l1: number | null;
  owner: number | string | null;
  isRevenue?: boolean;
}) {
  const fmt = (v: number | null) => v === null ? "—" : (v < 0 ? `(${formatUSD(-v)})` : formatUSD(v));
  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50/50">
      <td className="px-4 py-2.5 text-gray-700 font-medium">{label}</td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${isRevenue ? "text-dh-green font-semibold" : l2 !== null && l2 < 0 ? "text-gray-500" : "text-emerald-700"}`}>
        {l2 === null ? "—" : isRevenue ? formatUSD(l2) : (l2 < 0 ? `(${formatUSD(-l2)})` : formatUSD(l2))}
      </td>
      <td className={`px-4 py-2.5 text-right tabular-nums ${l1 !== null && l1 < 0 ? "text-gray-500" : "text-[#1565C0]"}`}>
        {l1 === null ? "—" : (l1 < 0 ? `(${formatUSD(-l1)})` : formatUSD(l1))}
      </td>
      <td className="px-4 py-2.5 text-right text-gray-400 text-[10px]">
        {typeof owner === "string" ? owner : owner === null ? "—" : fmt(owner)}
      </td>
    </tr>
  );
}

function ResultBar({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(pct * 100, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function SliderField({
  label, value, min, max, step, onChange, suffix,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-xs font-semibold">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-dh-green" />
    </div>
  );
}

function NumberField({
  label, value, min, max, onChange, suffix,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(Math.max(min, value - 1))}
          className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold flex items-center justify-center">−</button>
        <span className="text-xs font-semibold w-8 text-center tabular-nums">{value}{suffix}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))}
          className="w-6 h-6 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 text-sm font-bold flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color = "text-gray-900" }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

