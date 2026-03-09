"use client";

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES } from "@/data/development-types";
import { calculateMassingSummary } from "@/engine/financial-engine";

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function MassingPanel() {
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const assignments = useSimulationStore((s) => s.assignments);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);

  const summary = useMemo(() => {
    const selectedIds = Array.from(selectedLotIds);
    const lots = selectedIds
      .map((id) => LOTS.find((l) => l.id === id))
      .filter(Boolean) as typeof LOTS;
    const assignArr = selectedIds
      .map((id) => assignments.get(id))
      .filter(Boolean) as NonNullable<ReturnType<typeof assignments.get>>[];

    return calculateMassingSummary(lots, assignArr, typeAssumptions);
  }, [selectedLotIds, assignments, typeAssumptions]);

  if (summary.totalLots === 0) return null;

  const totalBUA = summary.totalSellableBUA;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Massing Summary &mdash; {summary.totalLots} Lot{summary.totalLots !== 1 ? "s" : ""}
      </h4>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
          <div className="text-gray-400 mb-0.5">Land Area</div>
          <div className="font-semibold">{formatNum(summary.totalLandArea)} m&sup2;</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
          <div className="text-gray-400 mb-0.5">Sellable BUA</div>
          <div className="font-semibold">{formatNum(summary.totalSellableBUA)} m&sup2;</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
          <div className="text-gray-400 mb-0.5">Total Units</div>
          <div className="font-semibold">{summary.totalUnits}</div>
        </div>
      </div>

      {/* BUA distribution bar */}
      {summary.typeBreakdown.length > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
          {summary.typeBreakdown.map((tb) => {
            const pct = totalBUA > 0 ? (tb.sellableBUA / totalBUA) * 100 : 0;
            if (pct === 0) return null;
            const color = DEVELOPMENT_TYPES[tb.developmentType]?.color ?? "#9CA3AF";
            return (
              <div
                key={tb.developmentType}
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
                title={`${DEVELOPMENT_TYPES[tb.developmentType]?.label}: ${formatNum(tb.sellableBUA)} m\u00B2 (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Type breakdown table */}
      <div className="space-y-1">
        {summary.typeBreakdown.map((tb) => {
          const dt = DEVELOPMENT_TYPES[tb.developmentType];
          return (
            <div
              key={tb.developmentType}
              className="flex items-center gap-2 py-1.5 px-2 bg-gray-50 rounded-lg text-xs"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: dt?.color ?? "#9CA3AF" }}
              />
              <span className="font-medium flex-1 truncate">
                {dt?.label ?? tb.developmentType}
              </span>
              <span className="text-gray-400 tabular-nums w-8 text-right">
                {tb.lotCount}L
              </span>
              <span className="text-gray-600 tabular-nums w-16 text-right">
                {formatNum(tb.sellableBUA)}m&sup2;
              </span>
              <span className="text-gray-600 tabular-nums w-8 text-right">
                {tb.unitCount}U
              </span>
              <span className="text-dh-green font-medium tabular-nums w-16 text-right">
                {formatUSD(tb.revenue)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Financial totals */}
      <div className="space-y-1.5 text-xs border-t border-gray-100 pt-3">
        <div className="flex justify-between py-1">
          <span className="text-gray-500">Total Investment</span>
          <span className="font-medium tabular-nums">
            {formatUSD(summary.totalLandCost + summary.totalConstructionCost)}
          </span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-gray-500">Total Revenue</span>
          <span className="font-semibold text-dh-green tabular-nums">
            {formatUSD(summary.totalRevenue)}
          </span>
        </div>
        <div className="flex justify-between py-2 bg-gray-50 rounded-lg px-2 -mx-2">
          <span className="font-semibold text-gray-700">Net Profit</span>
          <span
            className={`font-bold tabular-nums ${
              summary.totalNetProfit >= 0
                ? "text-emerald-600"
                : "text-red-500"
            }`}
          >
            {formatUSD(summary.totalNetProfit)}
          </span>
        </div>
        {summary.avgGrossMargin > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-gray-500">Avg Margin</span>
            <span className="font-medium tabular-nums">
              {(summary.avgGrossMargin * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
