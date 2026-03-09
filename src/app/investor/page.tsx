"use client";

import { useMemo, useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_COLORS } from "@/data/development-types";
import {
  calculateSimulationSummary,
  calculateInvestorScenario,
  calculateTicketModel,
  calculateMassingSummary,
  calculateExitScenarios,
} from "@/engine/financial-engine";
import DhLogo from "@/components/ui/DhLogo";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useTranslations } from "@/i18n/useTranslations";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
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
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`text-3xl font-bold mt-2 tabular-nums ${
          accent ? "text-dh-green" : "text-gray-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      {sub2 && <div className="text-xs text-gray-400">{sub2}</div>}
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

// MODEL_TABS labels are set inside the component to use translations
const MODEL_TAB_IDS = ["share", "land-equity", "priority", "ticket"] as const;

export default function InvestorPage() {
  const assignments = useSimulationStore((s) => s.assignments);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const setInvestorSharePct = useSimulationStore((s) => s.setInvestorSharePct);
  const investorModel = useSimulationStore((s) => s.investorModel);
  const setInvestorModel = useSimulationStore((s) => s.setInvestorModel);
  const landSharePct = useSimulationStore((s) => s.landSharePct);
  const setLandSharePct = useSimulationStore((s) => s.setLandSharePct);
  const cashToStartPct = useSimulationStore((s) => s.cashToStartPct);
  const setCashToStartPct = useSimulationStore((s) => s.setCashToStartPct);
  const priorityReturnRate = useSimulationStore((s) => s.priorityReturnRate);
  const setPriorityReturnRate = useSimulationStore((s) => s.setPriorityReturnRate);
  const holdPeriodYears = useSimulationStore((s) => s.holdPeriodYears);
  const setHoldPeriodYears = useSimulationStore((s) => s.setHoldPeriodYears);
  const ticketSize = useSimulationStore((s) => s.ticketSize);
  const setTicketSize = useSimulationStore((s) => s.setTicketSize);
  const investorTickets = useSimulationStore((s) => s.investorTickets);
  const setInvestorTickets = useSimulationStore((s) => s.setInvestorTickets);
  const { t, lang } = useTranslations();

  const MODEL_TABS = [
    { id: "share" as const,       label: t("model_share")      },
    { id: "land-equity" as const, label: t("model_land_equity") },
    { id: "priority" as const,    label: t("model_priority")   },
    { id: "ticket" as const,      label: t("model_ticket")     },
  ];

  const summary = useMemo(() => {
    const assignmentsArr = Array.from(assignments.values());
    return calculateSimulationSummary(LOTS, assignmentsArr, investorSharePct, typeAssumptions);
  }, [assignments, investorSharePct, typeAssumptions]);

  const scenario = useMemo(() => {
    if (investorModel === "ticket") return null;
    return calculateInvestorScenario(summary, investorModel, {
      investorSharePct,
      landSharePct,
      cashToStartPct,
      priorityReturnRate,
      holdPeriodYears,
    });
  }, [summary, investorModel, investorSharePct, landSharePct, cashToStartPct, priorityReturnRate, holdPeriodYears]);

  const ticketPhases = useMemo(
    () => calculateTicketModel(summary, ticketSize),
    [summary, ticketSize]
  );

  const massing = useMemo(() => {
    const assignmentsArr = Array.from(assignments.values());
    return calculateMassingSummary(LOTS, assignmentsArr, typeAssumptions);
  }, [assignments, typeAssumptions]);

  const phases = summary.phaseBreakdown.filter((p) => p.lotCount > 0);

  const investorProfitPct = scenario
    ? scenario.investorReturn / (summary.totalProfit || 1)
    : investorSharePct / 100;

  // Ticket tracker derived metrics
  const ticketTrackerMetrics = useMemo(() => {
    let totalInvested = 0;
    let totalReturn = 0;
    for (const tp of ticketPhases) {
      const count = investorTickets[tp.phase as 1 | 2 | 3] ?? 0;
      totalInvested += count * tp.ticketSize;
      totalReturn += count * tp.returnPerTicket;
    }
    return {
      totalInvested,
      totalReturn,
      blendedROI: totalInvested > 0 ? totalReturn / totalInvested : 0,
    };
  }, [ticketPhases, investorTickets]);

  // Chart data
  const phaseChartData = [1, 2, 3]
    .map((phaseNum) => {
      const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
      if (!phase || phase.lotCount === 0) return null;
      return {
        name: `Phase ${phaseNum}`,
        "Land Cost": phase.totalLandCost,
        Construction: phase.totalConstructionCost,
        Revenue: phase.totalRevenue,
        Profit: phase.totalNetProfit,
        roi: phase.roi,
      };
    })
    .filter(Boolean);

  const waterfallData = [
    { name: "Land Cost", value: summary.totalLandCost, fill: "#64748b" },
    { name: "Construction", value: summary.totalConstructionCost, fill: "#94a3b8" },
    { name: "Revenue", value: summary.totalRevenue, fill: "#2D6A4F" },
    { name: "Net Profit", value: summary.totalProfit, fill: summary.totalProfit >= 0 ? "#059669" : "#ef4444" },
  ];

  const investorPieData = [
    { name: "Investor", value: investorSharePct, fill: "#2D6A4F" },
    { name: "Landowner", value: 100 - investorSharePct, fill: "#D4A574" },
  ];

  const cashFlowData = (() => {
    let cumulativeInvestment = 0;
    let cumulativeRevenue = 0;
    const data = [{ name: "Start", investment: 0, revenue: 0, net: 0 }];
    [1, 2, 3].forEach((phaseNum) => {
      const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
      if (!phase || phase.lotCount === 0) return;
      cumulativeInvestment += phase.totalInvestment;
      cumulativeRevenue += phase.totalRevenue;
      data.push({
        name: `Phase ${phaseNum}`,
        investment: -cumulativeInvestment,
        revenue: cumulativeRevenue,
        net: cumulativeRevenue - cumulativeInvestment,
      });
    });
    return data;
  })();

  const investorKpiReturn = scenario
    ? scenario.investorReturn
    : ticketTrackerMetrics.totalReturn;

  const investorKpiROI = scenario
    ? scenario.cashToStartROI
    : ticketTrackerMetrics.blendedROI;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Header */}
      <div className="bg-dh-dark text-white">
        <div className="max-w-6xl mx-auto px-8 py-12">
          <div className="mb-6">
            <DhLogo variant="light" className="h-14" />
          </div>
          <p className="text-gray-300 max-w-2xl text-sm leading-relaxed">
            A premium 80,000 m&sup2; gated residential community comprising{" "}
            {summary.totalLots} lots across three development phases. Strategic
            hilltop location in North Lebanon with panoramic views,
            full infrastructure, and mixed residential typologies.
          </p>
          <div className="flex items-center gap-4 mt-4">
            <a href="/" className="text-xs text-dh-gold hover:text-dh-gold/80 underline">
              &larr; {t("nav_simulator")}
            </a>
            <a href="/assumptions" className="text-xs text-gray-400 hover:text-gray-300 underline">
              {t("nav_assumptions")}
            </a>
            <a href="/customer" className="text-xs text-gray-400 hover:text-gray-300 underline">
              {t("nav_customer")}
            </a>
            <LanguageToggle className="border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800" />
          </div>
        </div>
      </div>

      {/* KPI Grid — 5 cards */}
      <div className="max-w-6xl mx-auto px-8 -mt-6">
        <div className="grid grid-cols-5 gap-4">
          <KPICard
            label={t("land_cost")}
            value={formatUSD(summary.totalLandCost)}
            sub={lang === "ar" ? "اقتناء بسعر مخفض" : "discounted acquisition"}
          />
          <KPICard
            label={t("construction")}
            value={formatUSD(summary.totalConstructionCost)}
            sub="BUA × cost/m²"
          />
          <KPICard
            label={t("revenue")}
            value={formatUSD(summary.totalRevenue)}
            sub={`${formatNum(summary.totalUnits)} ${lang === "ar" ? "وحدة سكنية" : "residential units"}`}
            accent
          />
          <KPICard
            label={t("net_profit")}
            value={formatUSD(summary.totalProfit)}
            sub={`${t("roi")}: ${formatPct(summary.overallROI)}`}
          />
          <KPICard
            label={t("investor_return")}
            value={formatUSD(investorKpiReturn)}
            sub={`${t("cash_to_start")} ${t("roi")}: ${formatPct(investorKpiROI)}`}
            sub2={scenario ? `${t("roi")}: ${formatPct(scenario.investorROI)}` : undefined}
            accent
          />
        </div>
      </div>

      {/* Investor Model Selector */}
      <div className="max-w-6xl mx-auto px-8 mt-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            {t("investment_structure")}
          </h2>

          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-6 gap-1">
            {MODEL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setInvestorModel(tab.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  investorModel === tab.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Model A — Profit Share */}
          {investorModel === "share" && (
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-500">{t("investor_share")}</span>
                    <span className="text-xs font-semibold">{investorSharePct}%</span>
                  </div>
                  <input type="range" min="5" max="50" step="5" value={investorSharePct}
                    onChange={(e) => setInvestorSharePct(Number(e.target.value))}
                    className="w-full accent-dh-green" />
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">5%</span>
                    <span className="text-[10px] text-gray-400">50%</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Investor contributes {investorSharePct}% of total capital and receives {investorSharePct}% of net profit proportionally.
                </p>
              </div>
              {scenario && <ModelMetrics scenario={scenario} cashToStartPct={cashToStartPct} t={t} />}
            </div>
          )}

          {/* Model B — Land Equity + Cash */}
          {investorModel === "land-equity" && (
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 space-y-4">
                <SliderField label="Land Share %" value={landSharePct} min={5} max={50} step={5}
                  onChange={setLandSharePct} suffix="%" />
                <SliderField label="Cash-to-Start %" value={cashToStartPct} min={20} max={50} step={5}
                  onChange={setCashToStartPct} suffix="%" />
                <SliderField label="Profit Share %" value={investorSharePct} min={5} max={50} step={5}
                  onChange={setInvestorSharePct} suffix="%" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Investor buys {landSharePct}% of land + covers {cashToStartPct}% of construction cash upfront per phase.
                </p>
              </div>
              {scenario && <ModelMetrics scenario={scenario} cashToStartPct={cashToStartPct} t={t} />}
            </div>
          )}

          {/* Model C — Priority Return */}
          {investorModel === "priority" && (
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 space-y-4">
                <SliderField label="Investor Share %" value={investorSharePct} min={5} max={50} step={5}
                  onChange={setInvestorSharePct} suffix="%" />
                <NumberField label="Preferred Return %" value={priorityReturnRate} min={5} max={30}
                  onChange={setPriorityReturnRate} suffix="%" />
                <NumberField label="Hold Period (years)" value={holdPeriodYears} min={1} max={10}
                  onChange={setHoldPeriodYears} />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Investor gets priority cash-out at {priorityReturnRate}%/yr over {holdPeriodYears} yrs, then {investorSharePct}% of remaining upside.
                </p>
              </div>
              {scenario && <ModelMetrics scenario={scenario} cashToStartPct={cashToStartPct} t={t} />}
            </div>
          )}

          {/* Model D — Ticket Syndicate */}
          {investorModel === "ticket" && (
            <div className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-64">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-500">{t("ticket_size")}</span>
                    <span className="text-xs font-semibold">{formatUSD(ticketSize)}</span>
                  </div>
                  <input type="range" min={300000} max={500000} step={25000} value={ticketSize}
                    onChange={(e) => setTicketSize(Number(e.target.value))}
                    className="w-full accent-dh-green" />
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">$300K</span>
                    <span className="text-[10px] text-gray-400">$500K</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 max-w-sm leading-relaxed">
                  Each ticket represents a fixed investment in a specific phase. Tickets are phase-specific and carry that phase&apos;s ROI profile.
                </p>
              </div>

              {/* Per-phase ticket table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[t("phase_label"), t("total_investment"), t("land_cost"), t("construction"), t("ticket_size"), t("tickets_available"), t("return_per_ticket"), t("roi_per_ticket")].map((h) => (
                        <th key={h} className="text-left py-2 pr-4 text-[10px] text-gray-400 uppercase tracking-wider font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ticketPhases.filter((tp) => tp.phaseInvestment > 0).map((tp) => (
                      <tr key={tp.phase} className="border-b border-gray-50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PHASE_COLORS[tp.phase] }} />
                            <span className="font-medium text-gray-900">Phase {tp.phase}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 tabular-nums font-medium">{formatUSD(tp.phaseInvestment)}</td>
                        <td className="py-3 pr-4 tabular-nums text-gray-500">{formatUSD(tp.phaseLandCost)}</td>
                        <td className="py-3 pr-4 tabular-nums text-gray-500">{formatUSD(tp.phaseConstructionCost)}</td>
                        <td className="py-3 pr-4 tabular-nums">{formatUSD(tp.ticketSize)}</td>
                        <td className="py-3 pr-4 tabular-nums font-semibold text-dh-green">{tp.ticketsAvailable}</td>
                        <td className="py-3 pr-4 tabular-nums font-medium">{formatUSD(tp.returnPerTicket)}</td>
                        <td className="py-3 pr-4">
                          <span className={`font-bold tabular-nums ${tp.roiPerTicket >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatPct(tp.roiPerTicket)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {ticketPhases.filter((tp) => tp.phaseInvestment > 0).length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-400">
                          {t("assign_lots_tickets")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Investor Tracker */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                  {t("investor_tracker")}
                </h3>
                <div className="flex flex-wrap gap-6 items-end mb-5">
                  {ticketPhases.filter((tp) => tp.phaseInvestment > 0).map((tp) => (
                    <div key={tp.phase} className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-gray-500">
                        Phase {tp.phase} tickets <span className="text-gray-400">(max {tp.ticketsAvailable})</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInvestorTickets({ ...investorTickets, [tp.phase]: Math.max(0, (investorTickets[tp.phase as 1|2|3] ?? 0) - 1) })}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-100 flex items-center justify-center"
                        >−</button>
                        <span className="w-8 text-center font-bold text-gray-900 tabular-nums">
                          {investorTickets[tp.phase as 1|2|3] ?? 0}
                        </span>
                        <button
                          onClick={() => setInvestorTickets({ ...investorTickets, [tp.phase]: Math.min(tp.ticketsAvailable, (investorTickets[tp.phase as 1|2|3] ?? 0) + 1) })}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold hover:bg-gray-100 flex items-center justify-center"
                        >+</button>
                      </div>
                      <div className="text-[10px] text-gray-400">
                        = {formatUSD((investorTickets[tp.phase as 1|2|3] ?? 0) * tp.ticketSize)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <MetricBox label={t("total_invested")} value={formatUSD(ticketTrackerMetrics.totalInvested)} />
                  <MetricBox label={t("expected_return")} value={formatUSD(ticketTrackerMetrics.totalReturn)} color="text-emerald-600" />
                  <MetricBox label={t("blended_roi")} value={formatPct(ticketTrackerMetrics.blendedROI)} color="text-dh-green" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exit Scenarios */}
      {(() => {
        const exitCapital = scenario ? scenario.investorCapital : ticketTrackerMetrics.totalInvested;
        const exitReturn = scenario ? scenario.investorReturn : ticketTrackerMetrics.totalReturn;
        if (exitCapital <= 0) return null;
        const exitScenarios = calculateExitScenarios(exitCapital, exitReturn);
        return (
          <div className="max-w-6xl mx-auto px-8 mt-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{t("exit_scenarios")}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Annualized IRR assumes capital deployed at project start, returned in full at exit year</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">{t("capital_in")}</div>
                  <div className="text-sm font-bold text-gray-900 tabular-nums">{formatUSD(exitCapital)}</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {[t("hold_period"), t("exit_year"), t("capital_out"), t("total_roi"), t("annualized_irr_cagr")].map((h) => (
                        <th key={h} className="text-left py-2 pr-6 text-[10px] text-gray-400 uppercase tracking-wider font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exitScenarios.map((s) => {
                      const irrPct = s.irr * 100;
                      const irrColor = irrPct >= 20 ? "text-emerald-600" : irrPct >= 14 ? "text-amber-600" : "text-red-500";
                      return (
                        <tr key={s.years} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="py-3 pr-6 font-medium text-gray-900">{s.years} {t("years")}</td>
                          <td className="py-3 pr-6 text-gray-500">{t("year")} {2025 + s.years}</td>
                          <td className="py-3 pr-6 tabular-nums font-medium text-dh-green">{formatUSD(s.totalReturn)}</td>
                          <td className="py-3 pr-6 tabular-nums font-medium">{formatPct(s.roi)}</td>
                          <td className="py-3 pr-6">
                            <span className={`font-bold tabular-nums ${irrColor}`}>{formatPct(s.irr)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-3">
                IRR is calculated as CAGR: (1 + Total&nbsp;ROI)^(1/N) − 1. Assumes single capital injection at t=0 and full return at t=N. Actual IRR depends on capital call schedule.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Sensitivity Analysis */}
      {summary.totalRevenue > 0 && (() => {
        const priceDeltas = [-0.20, -0.10, 0, +0.10, +0.20];
        const costDeltas  = [-0.20, -0.10, 0, +0.10, +0.20];
        const baseRevenue = summary.totalRevenue;
        const baseCost = summary.totalConstructionCost + summary.totalLandCost;
        const baseProfit = summary.totalProfit;
        // net profit = revenue*(1+dp) - totalCost*(1+dc)  where totalCost = land+construction
        // but only construction varies with dc; land is fixed
        const landCost = summary.totalLandCost;
        const constrCost = summary.totalConstructionCost;
        const cells = priceDeltas.map((dp) =>
          costDeltas.map((dc) => {
            const rev = baseRevenue * (1 + dp);
            const cost = landCost + constrCost * (1 + dc);
            return rev - cost;
          })
        );
        const allValues = cells.flat();
        const minVal = Math.min(...allValues);
        const maxVal = Math.max(...allValues);
        const normalize = (v: number) => maxVal === minVal ? 0.5 : (v - minVal) / (maxVal - minVal);
        const cellBg = (v: number) => {
          const t = normalize(v);
          if (v < 0) return "bg-red-100 text-red-700";
          if (t >= 0.75) return "bg-emerald-100 text-emerald-700";
          if (t >= 0.5) return "bg-green-50 text-green-700";
          if (t >= 0.25) return "bg-amber-50 text-amber-700";
          return "bg-orange-100 text-orange-700";
        };
        return (
          <div className="max-w-6xl mx-auto px-8 mt-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-gray-900">{t("sensitivity_analysis")}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Rows: selling price variance · Columns: construction cost variance · Base profit: {formatUSD(baseProfit)}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-[10px] text-gray-400 font-medium text-left py-1.5 pr-3 w-20">{t("price_cost_header")}</th>
                      {costDeltas.map((dc) => (
                        <th key={dc} className={`text-[10px] font-semibold text-center py-1.5 px-2 ${dc === 0 ? "text-gray-900" : dc < 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {dc === 0 ? t("base_case") : `${dc > 0 ? "+" : ""}${(dc * 100).toFixed(0)}%`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceDeltas.map((dp, ri) => (
                      <tr key={dp} className="border-t border-gray-50">
                        <td className={`text-[10px] font-semibold py-1.5 pr-3 ${dp === 0 ? "text-gray-900" : dp > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {dp === 0 ? t("base_case") : `${dp > 0 ? "+" : ""}${(dp * 100).toFixed(0)}%`}
                        </td>
                        {cells[ri].map((val, ci) => {
                          const isBase = dp === 0 && costDeltas[ci] === 0;
                          return (
                            <td key={ci} className={`text-center py-1.5 px-2 rounded font-medium tabular-nums ${cellBg(val)} ${isBase ? "ring-2 ring-inset ring-gray-400" : ""}`}>
                              {formatUSD(val)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-gray-400 mt-3">
                Construction cost variance applied to construction only (land cost fixed). Selling price variance applied to total revenue.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Typology Breakdown */}
      {massing.typeBreakdown.length > 0 && (
        <div className="max-w-6xl mx-auto px-8 mt-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("typology_breakdown")}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    {[t("typology"), t("lots"), t("bua_m2"), t("units"), t("land_cost"), t("construction"), t("revenue"), t("net_profit"), t("margin")].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 text-[10px] text-gray-400 uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {massing.typeBreakdown.map((row) => {
                    const cfg = DEVELOPMENT_TYPES[row.developmentType];
                    const landCostRow = massing.typeBreakdown.find(r => r.developmentType === row.developmentType);
                    // Re-derive land cost from massing
                    const phaseData = summary.phaseBreakdown;
                    const margin = row.revenue > 0 ? row.profit / row.revenue : 0;
                    return (
                      <tr key={row.developmentType} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: cfg?.color }} />
                            <span className="font-medium text-gray-900">{cfg?.label ?? row.developmentType}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 tabular-nums">{row.lotCount}</td>
                        <td className="py-3 pr-4 tabular-nums">{formatNum(row.sellableBUA)}</td>
                        <td className="py-3 pr-4 tabular-nums">{row.unitCount}</td>
                        <td className="py-3 pr-4 tabular-nums text-gray-500">—</td>
                        <td className="py-3 pr-4 tabular-nums text-gray-500">—</td>
                        <td className="py-3 pr-4 tabular-nums font-medium text-dh-green">{formatUSD(row.revenue)}</td>
                        <td className="py-3 pr-4">
                          <span className={`tabular-nums font-semibold ${row.profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatUSD(row.profit)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 tabular-nums font-medium">{formatPct(margin)}</td>
                      </tr>
                    );
                  })}
                  {/* Investor share footer */}
                  <tr className="bg-dh-green/5 border-t-2 border-dh-green/20">
                    <td className="py-3 pr-4 font-semibold text-dh-green text-[11px] uppercase tracking-wide">
                      {t("investor_share")} ({investorSharePct}%)
                    </td>
                    <td className="py-3 pr-4 tabular-nums font-medium">{massing.totalLots}</td>
                    <td className="py-3 pr-4 tabular-nums font-medium">{formatNum(Math.round(massing.totalSellableBUA * investorProfitPct))}</td>
                    <td className="py-3 pr-4 tabular-nums font-medium">{Math.round(massing.totalUnits * investorProfitPct)}</td>
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4" />
                    <td className="py-3 pr-4 tabular-nums font-semibold text-dh-green">{formatUSD(Math.round(massing.totalRevenue * investorProfitPct))}</td>
                    <td className="py-3 pr-4 tabular-nums font-bold text-emerald-600">{formatUSD(Math.round(massing.totalNetProfit * investorProfitPct))}</td>
                    <td className="py-3 pr-4" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Financial Charts Row */}
      <div className="max-w-6xl mx-auto px-8 mt-8">
        <div className="grid grid-cols-2 gap-6">
          {/* Waterfall: Cost Breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              {t("financial_waterfall")}
            </h2>
            {waterfallData[0].value === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                {t("assign_lots_financial")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={waterfallData} margin={{ top: 5, right: 5, left: -5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis tickFormatter={formatAxisUSD} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<BarTooltip />} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {waterfallData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cumulative Cash Flow */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              {t("cumulative_cash_flow")}
            </h2>
            {cashFlowData.length <= 1 ? (
              <p className="text-sm text-gray-400 text-center py-12">
                {t("assign_lots_cash_flow")}
              </p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={cashFlowData} margin={{ top: 5, right: 5, left: -5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                    <YAxis tickFormatter={formatAxisUSD} tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<BarTooltip />} />
                    <Area type="monotone" dataKey="revenue" stackId="1" stroke="#2D6A4F" fill="#2D6A4F" fillOpacity={0.15} name="Revenue" />
                    <Area type="monotone" dataKey="investment" stackId="2" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} name="Investment" />
                    <Area type="monotone" dataKey="net" stackId="3" stroke="#059669" fill="#059669" fillOpacity={0.2} name="Net" />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {[{ label: "Revenue", color: "#2D6A4F" }, { label: "Investment", color: "#94a3b8" }, { label: "Net", color: "#059669" }].map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-gray-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Phase Breakdown */}
      <div className="max-w-6xl mx-auto px-8 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900">{t("phase_breakdown")}</h2>
          {phases.length > 0 && phaseChartData.length > 0 && (
            <div className="flex items-center gap-3 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#64748b]" /> {t("land_cost")}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#94a3b8]" /> {t("construction")}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#2D6A4F]" /> {t("revenue")}</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#059669]" /> {t("net_profit")}</span>
            </div>
          )}
        </div>

        {phases.length > 0 && phaseChartData.length > 0 && (
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
            <a href="/" className="text-dh-green underline mt-2 inline-block">
              {t("go_simulator_configure")}
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 pb-12">
            {[1, 2, 3].map((phaseNum) => {
              const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
              const phaseTicket = ticketPhases.find((tp) => tp.phase === phaseNum);
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
              const phaseInvestorReturn = Math.round(phase.totalNetProfit * investorProfitPct);
              return (
                <div key={phaseNum} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: PHASE_COLORS[phaseNum] }} />
                    <h3 className="text-sm font-semibold text-gray-900">{t("phase_label")} {phaseNum}</h3>
                    <span className="ml-auto text-xs text-gray-400">{phase.lotCount} {t("lots")}</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("total_area")}</span>
                      <span className="font-medium tabular-nums">{formatNum(phase.totalArea)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("units")}</span>
                      <span className="font-medium tabular-nums">{phase.totalUnits}</span>
                    </div>
                    <div className="h-px bg-gray-100 my-1" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("land_cost")}</span>
                      <span className="font-medium tabular-nums text-gray-700">{formatUSD(phase.totalLandCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("construction")}</span>
                      <span className="font-medium tabular-nums text-gray-700">{formatUSD(phase.totalConstructionCost)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t("revenue")}</span>
                      <span className="font-semibold text-dh-green tabular-nums">{formatUSD(phase.totalRevenue)}</span>
                    </div>
                    <div className="h-px bg-gray-100 my-1" />
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
                    <div className="h-px bg-gray-100 my-1" />
                    <div className="flex justify-between">
                      <span className="text-dh-green font-medium">{t("investor_return")}</span>
                      <span className="font-bold text-dh-green tabular-nums">{formatUSD(phaseInvestorReturn)}</span>
                    </div>
                    {phaseTicket && phaseTicket.ticketsAvailable > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tickets ({formatUSD(ticketSize)})</span>
                        <span className="font-medium tabular-nums text-gray-500">
                          {phaseTicket.ticketsAvailable} × {formatPct(phaseTicket.roiPerTicket)} ROI
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

function ModelMetrics({ scenario, cashToStartPct, t }: { scenario: NonNullable<ReturnType<typeof calculateInvestorScenario>>; cashToStartPct: number; t: (key: import("@/i18n/translations").TranslationKey) => string }) {
  return (
    <div className="col-span-2 grid grid-cols-3 gap-4 content-start">
      <MetricBox label={t("investor_capital")} value={formatUSD(scenario.investorCapital)} />
      <MetricBox label={t("investor_return")} value={formatUSD(scenario.investorReturn)} color="text-emerald-600" />
      <MetricBox
        label={`${t("cash_to_start")} ROI (${cashToStartPct}%)`}
        value={formatPct(scenario.cashToStartROI)}
        color="text-dh-green"
      />
    </div>
  );
}
