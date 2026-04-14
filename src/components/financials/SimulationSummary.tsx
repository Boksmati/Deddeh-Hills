"use client";

import { useMemo, useState, useEffect } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { calculateSimulationSummary } from "@/engine/financial-engine";
import { useTranslations } from "@/i18n/useTranslations";

function formatUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default function SimulationSummaryBar() {
  const assignments = useSimulationStore((s) => s.assignments);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const lotGroups = useSimulationStore((s) => s.lotGroups);
  const { t } = useTranslations();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const summary = useMemo(() => {
    const assignmentsArr = Array.from(assignments.values());
    return calculateSimulationSummary(LOTS, assignmentsArr, investorSharePct, typeAssumptions, lotGroups);
  }, [assignments, investorSharePct, typeAssumptions, lotGroups]);

  const cards = [
    {
      label: t("assigned"),
      value: `${summary.assignedLots} / ${summary.totalLots}`,
      sub: t("lots"),
    },
    {
      label: t("total_units"),
      value: summary.totalUnits.toLocaleString(),
      sub: t("residential"),
    },
    {
      label: t("land_cost"),
      value: formatUSD(summary.totalLandCost),
      sub: t("discounted_acquisition"),
    },
    {
      label: t("construction"),
      value: formatUSD(summary.totalConstructionCost),
      sub: t("bua_cost_sqm"),
    },
    {
      label: t("revenue"),
      value: formatUSD(summary.totalRevenue),
      sub: t("projected_sales"),
      accent: true,
    },
    {
      label: t("net_profit"),
      value: formatUSD(summary.totalProfit),
      sub: `${t("roi")}: ${(summary.overallROI * 100).toFixed(1)}%`,
      positive: summary.totalProfit >= 0,
    },
    {
      label: `${t("investor_label").replace(":", "")} (${investorSharePct}%)`,
      value: formatUSD(summary.investorReturn),
      sub: `${t("roi")}: ${(summary.investorROI * 100).toFixed(1)}%`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100"
        >
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
            {card.label}
          </div>
          <div
            dir="ltr"
            className={`text-lg font-bold tabular-nums mt-0.5 ${
              card.accent
                ? "text-dh-green"
                : card.positive !== undefined
                ? card.positive
                  ? "text-emerald-600"
                  : "text-red-500"
                : "text-gray-900"
            }`}
          >
            {mounted ? card.value : "—"}
          </div>
          <div dir="ltr" className="text-[10px] text-gray-400">{mounted ? card.sub : ""}</div>
        </div>
      ))}
    </div>
  );
}
