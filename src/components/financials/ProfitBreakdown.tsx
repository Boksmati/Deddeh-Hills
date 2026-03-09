"use client";

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { calculateSimulationSummary } from "@/engine/financial-engine";
import { PHASE_COLORS } from "@/data/development-types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTranslations } from "@/i18n/useTranslations";

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

const CustomTooltip = ({ active, payload, label }: any) => {
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

export default function ProfitBreakdown() {
  const assignments = useSimulationStore((s) => s.assignments);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const { t } = useTranslations();

  const summary = useMemo(() => {
    const arr = Array.from(assignments.values());
    return calculateSimulationSummary(LOTS, arr, investorSharePct, typeAssumptions);
  }, [assignments, investorSharePct, typeAssumptions]);

  const phases = summary.phaseBreakdown.filter((p) => p.lotCount > 0);

  if (phases.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {t("phase_financial_comparison")}
        </h3>
        <p className="text-sm text-gray-400 text-center py-8">
          {t("assign_lots_for_comparison")}
        </p>
      </div>
    );
  }

  const chartData = [1, 2, 3]
    .map((phaseNum) => {
      const phase = summary.phaseBreakdown.find((p) => p.phase === phaseNum);
      if (!phase || phase.lotCount === 0) return null;
      return {
        name: `${t("phase_label")} ${phaseNum}`,
        Investment: phase.totalInvestment,
        Revenue: phase.totalRevenue,
        Profit: phase.totalNetProfit,
        roi: phase.roi,
        color: PHASE_COLORS[phaseNum],
      };
    })
    .filter(Boolean);

  const legendItems = [
    { key: "Investment", label: t("investment"), color: "#94a3b8" },
    { key: "Revenue", label: t("revenue"), color: "#2D6A4F" },
    { key: "Profit", label: t("profit"), color: "#059669" },
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {t("phase_financial_comparison")}
      </h3>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 5, left: -10, bottom: 5 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxisUSD}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="Investment"
            name={t("investment")}
            fill="#94a3b8"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="Revenue"
            name={t("revenue")}
            fill="#2D6A4F"
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          />
          <Bar
            dataKey="Profit"
            name={t("profit")}
            radius={[3, 3, 0, 0]}
            maxBarSize={32}
          >
            {chartData.map((entry: any, index: number) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.Profit >= 0 ? "#059669" : "#ef4444"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex justify-center gap-4 mt-2">
        {legendItems.map((item) => (
          <div key={item.key} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[10px] text-gray-500">{item.label}</span>
          </div>
        ))}
      </div>

      {/* ROI badges */}
      <div className="flex gap-2 mt-3">
        {chartData.map((entry: any) => (
          <div
            key={entry.name}
            className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-center"
          >
            <div className="text-[10px] text-gray-400">{entry.name}</div>
            <div dir="ltr" className="text-sm font-bold tabular-nums text-gray-900">
              {(entry.roi * 100).toFixed(1)}%
            </div>
            <div className="text-[9px] text-gray-400">{t("roi")}</div>
          </div>
        ))}
      </div>

      {/* Overall totals */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">{t("total_investment")}</span>
          <span dir="ltr" className="font-semibold tabular-nums">
            {formatUSD(summary.totalInvestment)}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">{t("total_revenue_label")}</span>
          <span dir="ltr" className="font-semibold text-dh-green tabular-nums">
            {formatUSD(summary.totalRevenue)}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="font-medium text-gray-700">{t("total_net_profit")}</span>
          <span
            dir="ltr"
            className={`font-bold tabular-nums ${
              summary.totalProfit >= 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {formatUSD(summary.totalProfit)}
          </span>
        </div>
      </div>
    </div>
  );
}
