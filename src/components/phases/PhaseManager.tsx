"use client";

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { PHASE_COLORS, PHASE_LABELS } from "@/data/development-types";
import { calculatePhaseFinancials } from "@/engine/financial-engine";
import { Phase } from "@/types";
import { useTranslations } from "@/i18n/useTranslations";

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function PhaseManager() {
  const assignments = useSimulationStore((s) => s.assignments);
  const selectLotsByPhase = useSimulationStore((s) => s.selectLotsByPhase);
  const setPhase = useSimulationStore((s) => s.setPhase);
  const typeAssumptions = useSimulationStore((s) => s.typeAssumptions);
  const lotGroups = useSimulationStore((s) => s.lotGroups);
  const { t } = useTranslations();

  const phaseData = useMemo(() => {
    const assignArr = Array.from(assignments.values());

    const phases = ([1, 2, 3] as Phase[]).map((p) => {
      const pf = calculatePhaseFinancials(LOTS, assignArr, p, typeAssumptions, lotGroups);
      const lotIds = assignArr.filter((a) => a.phase === p).map((a) => a.lotId);
      return { phase: p, financials: pf, lotIds };
    });

    const unassignedCount = assignArr.filter(
      (a) => a.phase === 0 && a.developmentType !== "unassigned"
    ).length;

    const totalUnphased = assignArr.filter((a) => a.phase === 0).length;

    return { phases, unassignedCount, totalUnphased };
  }, [assignments, typeAssumptions, lotGroups]);

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {t("phase_overview")}
      </h3>

      <div className="space-y-2">
        {phaseData.phases.map(({ phase, financials, lotIds }) => (
          <div
            key={phase}
            className="bg-gray-50 rounded-lg p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: PHASE_COLORS[phase] }}
                />
                <span className="text-xs font-semibold text-gray-700">
                  {PHASE_LABELS[phase]}
                </span>
                <span className="text-[10px] bg-white rounded px-1.5 py-0.5 text-gray-500 font-medium">
                  {financials.lotCount} {t("lots")}
                </span>
              </div>
              <button
                onClick={() => selectLotsByPhase(phase)}
                className="text-[10px] text-dh-green hover:text-dh-green/80 font-medium transition-colors"
                disabled={financials.lotCount === 0}
              >
                {t("select")}
              </button>
            </div>

            {financials.lotCount > 0 && (
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-400">{t("area")}</span>
                  <div dir="ltr" className="font-semibold text-gray-700">
                    {formatNum(financials.totalArea)} m&sup2;
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">{t("units")}</span>
                  <div dir="ltr" className="font-semibold text-gray-700">
                    {financials.totalUnits}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">{t("revenue")}</span>
                  <div dir="ltr" className="font-semibold text-dh-green">
                    {formatUSD(financials.totalRevenue)}
                  </div>
                </div>
              </div>
            )}

            {financials.lotCount === 0 && (
              <p className="text-[10px] text-gray-400">
                {t("no_lots_in_phase")}
              </p>
            )}
          </div>
        ))}

        {/* Unassigned row */}
        <div className="bg-gray-50/50 rounded-lg p-3 border border-dashed border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-gray-300" />
              <span className="text-xs font-medium text-gray-400">
                {t("unphased")}
              </span>
              <span className="text-[10px] bg-white rounded px-1.5 py-0.5 text-gray-400 font-medium">
                {phaseData.totalUnphased} {t("lots")}
              </span>
            </div>
            {phaseData.unassignedCount > 0 && (
              <span className="text-[10px] text-amber-500 font-medium">
                {phaseData.unassignedCount} {t("assigned_unphased")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
