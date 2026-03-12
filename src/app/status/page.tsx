"use client";

import { useMemo, useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_COLORS, PHASE_LABELS } from "@/data/development-types";
import { calculateLotFinancials } from "@/engine/financial-engine";
import { DevelopmentType, LotStatus, Phase } from "@/types";
import AppHeader from "@/components/ui/AppHeader";
import { useTranslations } from "@/i18n/useTranslations";

function fmtUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

const STATUS_COLORS: Record<LotStatus, string> = {
  available: "#10B981",
  reserved: "#F59E0B",
  under_contract: "#F97316",
  sold: "#EF4444",
};

const STATUS_TEXT: Record<LotStatus, string> = {
  available: "text-emerald-700",
  reserved: "text-amber-700",
  under_contract: "text-orange-700",
  sold: "text-red-700",
};

const STATUSES: LotStatus[] = ["available", "reserved", "under_contract", "sold"];

export default function StatusPage() {
  const assignments = useSimulationStore((s) => s.assignments);
  const lotStatuses = useSimulationStore((s) => s.lotStatuses);
  const phaseRevenueTargets = useSimulationStore((s) => s.phaseRevenueTargets);
  const setPhaseRevenueTarget = useSimulationStore((s) => s.setPhaseRevenueTarget);
  const { t, lang } = useTranslations();

  // Track which phase is being edited (target input open)
  const [editingPhase, setEditingPhase] = useState<1 | 2 | 3 | null>(null);
  const [targetDraft, setTargetDraft] = useState("");

  // Build STATUS_META with translated labels
  const STATUS_META: Record<LotStatus, { label: string; color: string; bg: string; text: string }> = {
    available:      { label: t("status_available"),      color: STATUS_COLORS.available,      bg: "bg-emerald-50",  text: STATUS_TEXT.available      },
    reserved:       { label: t("status_reserved"),       color: STATUS_COLORS.reserved,       bg: "bg-amber-50",    text: STATUS_TEXT.reserved       },
    under_contract: { label: t("status_under_contract"), color: STATUS_COLORS.under_contract, bg: "bg-orange-50",   text: STATUS_TEXT.under_contract  },
    sold:           { label: t("status_sold"),           color: STATUS_COLORS.sold,           bg: "bg-red-50",      text: STATUS_TEXT.sold            },
  };

  const data = useMemo(() => {
    const lotData = LOTS.map((lot) => {
      const assignment = assignments.get(lot.id);
      const devType = assignment?.developmentType ?? "unassigned";
      const phase = assignment?.phase ?? 0;
      const status: LotStatus = lotStatuses.get(lot.id) ?? "available";
      const financials =
        devType !== "unassigned"
          ? calculateLotFinancials(lot, devType)
          : null;
      return { lot, devType, phase, status, financials };
    });

    const statusCounts: Record<LotStatus, number> = {
      available: 0, reserved: 0, under_contract: 0, sold: 0,
    };
    const statusRevenue: Record<LotStatus, number> = {
      available: 0, reserved: 0, under_contract: 0, sold: 0,
    };

    let projectedRevenue = 0;
    let assignedCount = 0;

    for (const d of lotData) {
      statusCounts[d.status]++;
      if (d.financials) {
        statusRevenue[d.status] += d.financials.revenue;
        projectedRevenue += d.financials.revenue;
        assignedCount++;
      }
    }

    const committedRevenue =
      statusRevenue.reserved + statusRevenue.under_contract + statusRevenue.sold;
    const soldRevenue = statusRevenue.sold;

    const phases = ([1, 2, 3] as Phase[]).map((p) => {
      const phaseLots = lotData.filter((d) => d.phase === p && d.devType !== "unassigned");
      const phaseCounts: Record<LotStatus, number> = {
        available: 0, reserved: 0, under_contract: 0, sold: 0,
      };
      let phaseRevenue = 0;
      let phaseUnits = 0;
      for (const d of phaseLots) {
        phaseCounts[d.status]++;
        if (d.financials) {
          phaseRevenue += d.financials.revenue;
          phaseUnits += d.financials.numUnits;
        }
      }
      const committed = phaseCounts.reserved + phaseCounts.under_contract + phaseCounts.sold;
      return {
        phase: p,
        lotCount: phaseLots.length,
        phaseCounts,
        phaseRevenue,
        phaseUnits,
        committed,
        commitPct: phaseLots.length > 0 ? committed / phaseLots.length : 0,
        soldPct: phaseLots.length > 0 ? phaseCounts.sold / phaseLots.length : 0,
      };
    });

    const typeIds = Object.keys(DEVELOPMENT_TYPES).filter((t) => t !== "unassigned") as DevelopmentType[];
    const typeBreakdown = typeIds.map((dt) => {
      const dLots = lotData.filter((d) => d.devType === dt);
      if (dLots.length === 0) return null;
      const typeCounts: Record<LotStatus, number> = {
        available: 0, reserved: 0, under_contract: 0, sold: 0,
      };
      let typeRevenue = 0;
      let typeUnits = 0;
      for (const d of dLots) {
        typeCounts[d.status]++;
        if (d.financials) {
          typeRevenue += d.financials.revenue;
          typeUnits += d.financials.numUnits;
        }
      }
      return {
        dt,
        lotCount: dLots.length,
        typeCounts,
        typeRevenue,
        typeUnits,
        cfg: DEVELOPMENT_TYPES[dt],
      };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      lotData,
      statusCounts,
      statusRevenue,
      projectedRevenue,
      committedRevenue,
      soldRevenue,
      assignedCount,
      phases,
      typeBreakdown,
      totalLots: LOTS.length,
    };
  }, [assignments, lotStatuses]);

  const commitPct = data.projectedRevenue > 0 ? data.committedRevenue / data.projectedRevenue : 0;
  const soldPct   = data.projectedRevenue > 0 ? data.soldRevenue / data.projectedRevenue : 0;
  const assignPct = data.totalLots > 0 ? data.assignedCount / data.totalLots : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader currentPage="status" />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("project_status")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data.assignedCount} of {data.totalLots} {t("lots_configured")} &middot; {fmtPct(assignPct)} {t("assigned")}
          </p>
        </div>

        {/* ── Status Pipeline Tiles ────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-4">
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const count = data.statusCounts[s];
            const rev = data.statusRevenue[s];
            const pct = data.totalLots > 0 ? count / data.totalLots : 0;
            return (
              <div key={s} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${meta.text}`}>
                    {meta.label}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                </div>
                <div className="text-3xl font-bold text-gray-900 tabular-nums">{count}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {fmtPct(pct)} of {data.totalLots} {t("lots")}
                </div>
                {rev > 0 && (
                  <div className={`mt-3 text-sm font-semibold tabular-nums ${meta.text}`}>
                    {fmtUSD(rev)}
                  </div>
                )}
                <div className="mt-3 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct * 100}%`, backgroundColor: meta.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Revenue Pipeline Bar ─────────────────────────────────────────── */}
        {data.projectedRevenue > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("revenue_pipeline")}</h2>
            <div className="flex items-end gap-8 mb-4">
              <div>
                <div className="text-xs text-gray-400 mb-0.5">{t("projected_total")}</div>
                <div className="text-2xl font-bold text-gray-900 tabular-nums">
                  {fmtUSD(data.projectedRevenue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">{t("committed")}</div>
                <div className="text-xl font-semibold text-amber-600 tabular-nums">
                  {fmtUSD(data.committedRevenue)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-0.5">{t("status_sold")}</div>
                <div className="text-xl font-semibold text-red-500 tabular-nums">
                  {fmtUSD(data.soldRevenue)}
                </div>
              </div>
            </div>

            <div className="h-3 rounded-full bg-gray-100 overflow-hidden flex">
              <div
                className="h-full bg-red-400 transition-all"
                style={{ width: `${soldPct * 100}%` }}
                title={`Sold: ${fmtUSD(data.soldRevenue)}`}
              />
              <div
                className="h-full bg-amber-300 transition-all"
                style={{ width: `${(commitPct - soldPct) * 100}%` }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{t("sold_pct")} {fmtPct(soldPct)}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />{t("committed_pct")} {fmtPct(Math.max(0, commitPct - soldPct))}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />{t("status_available")} {fmtPct(1 - commitPct)}</span>
            </div>
          </div>
        )}

        {/* ── Phase Progress ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">{t("phase_progress")}</h2>
          <div className="space-y-5">
            {data.phases.map((p) => {
              const phaseColor = PHASE_COLORS[p.phase] === "#E5E7EB" ? "#6B7280" : PHASE_COLORS[p.phase];
              const target = phaseRevenueTargets[p.phase as 1 | 2 | 3] ?? 0;
              const hasTarget = target > 0 && p.phaseRevenue > 0;
              const deltaPct = hasTarget ? (p.phaseRevenue - target) / target : 0;
              const onTrack = deltaPct >= 0;
              const isEditing = editingPhase === p.phase;
              return (
                <div key={p.phase}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: phaseColor }}
                      />
                      <span className="text-sm font-semibold text-gray-800">
                        {PHASE_LABELS[p.phase]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {p.lotCount} {t("lots")} &middot; {p.phaseUnits} units &middot; {fmtUSD(p.phaseRevenue)}
                      </span>
                      {/* ── Target badge / editor ── */}
                      {isEditing ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseFloat(targetDraft.replace(/[$,MmKk]/g, "")) * (
                              /[Mm]/.test(targetDraft) ? 1_000_000 : /[Kk]/.test(targetDraft) ? 1_000 : 1
                            );
                            if (!isNaN(val)) setPhaseRevenueTarget(p.phase as 1 | 2 | 3, val);
                            setEditingPhase(null);
                          }}
                        >
                          <input
                            autoFocus
                            value={targetDraft}
                            onChange={(e) => setTargetDraft(e.target.value)}
                            onBlur={() => setEditingPhase(null)}
                            className="w-24 px-2 py-0.5 text-xs border border-blue-300 rounded-md bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder={lang === "ar" ? "مثال: 12M" : "e.g. 12M"}
                          />
                          <button type="submit" className="text-blue-600 text-xs font-semibold hover:text-blue-800">✓</button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetDraft(target > 0 ? fmtUSD(target).replace("$", "") : "");
                            setEditingPhase(p.phase as 1 | 2 | 3);
                          }}
                          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
                          title={t("set_target")}
                        >
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          {target > 0 ? (
                            <span>{t("revenue_target")}: {fmtUSD(target)}</span>
                          ) : (
                            <span className="italic">{t("set_target")}</span>
                          )}
                        </button>
                      )}
                      {/* ── Delta vs projection ── */}
                      {hasTarget && !isEditing && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${onTrack ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                          {onTrack ? "+" : ""}{(deltaPct * 100).toFixed(1)}% {onTrack ? t("on_track") : t("below_target")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {STATUSES.map((s) => (
                        <span key={s} className={`flex items-center gap-1 ${STATUS_TEXT[s]}`}>
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[s] }}
                          />
                          {p.phaseCounts[s]}
                        </span>
                      ))}
                    </div>
                  </div>
                  {p.lotCount > 0 ? (
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
                      <div
                        className="h-full bg-red-400"
                        style={{ width: `${p.soldPct * 100}%` }}
                      />
                      <div
                        className="h-full bg-amber-300"
                        style={{ width: `${(p.commitPct - p.soldPct) * 100}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-full w-0" />
                    </div>
                  )}
                  {p.lotCount > 0 && (
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{fmtPct(p.commitPct)} {t("committed_pct")}</span>
                      <span>{fmtPct(p.soldPct)} {t("sold_pct")}</span>
                    </div>
                  )}
                  {p.lotCount === 0 && (
                    <p className="text-xs text-gray-300 italic">{t("no_lots_yet")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Typology Mix ─────────────────────────────────────────────────── */}
        {data.typeBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{t("typology_mix")}</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left font-medium text-gray-400">{t("type")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400">{t("lots")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400">{t("units")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400">{t("revenue")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400 w-32">{t("status_available")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400 w-20">{t("status_reserved")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400 w-20">{t("status_under_contract")}</th>
                  <th className="pb-2 text-right font-medium text-gray-400 w-20">{t("status_sold")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.typeBreakdown.map((tb) => (
                  <tr key={tb.dt} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: tb.cfg.color }}
                        />
                        <span className="font-medium text-gray-800">{tb.cfg.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{tb.lotCount}</td>
                    <td className="py-2.5 text-right tabular-nums text-gray-500">{tb.typeUnits}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtUSD(tb.typeRevenue)}</td>
                    {STATUSES.map((s) => (
                      <td key={s} className={`py-2.5 text-right tabular-nums ${STATUS_TEXT[s]}`}>
                        {tb.typeCounts[s] > 0 ? tb.typeCounts[s] : <span className="text-gray-200">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td className="pt-2.5 font-semibold text-gray-700">Total</td>
                  <td className="pt-2.5 text-right tabular-nums font-semibold">{data.assignedCount}</td>
                  <td className="pt-2.5 text-right tabular-nums font-semibold text-gray-600">
                    {data.typeBreakdown.reduce((sum, tb) => sum + tb.typeUnits, 0)}
                  </td>
                  <td className="pt-2.5 text-right tabular-nums font-semibold text-gray-800">{fmtUSD(data.projectedRevenue)}</td>
                  {STATUSES.map((s) => (
                    <td key={s} className={`pt-2.5 text-right tabular-nums font-semibold ${STATUS_TEXT[s]}`}>
                      {data.statusCounts[s]}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Empty state */}
        {data.assignedCount === 0 && (
          <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
            <div className="text-5xl mb-4 opacity-20">&#9634;</div>
            <p className="text-sm text-gray-500 font-medium">{t("no_lots_yet")}</p>
            <p className="text-xs text-gray-400 mt-1">
              <a href="/simulator" className="text-dh-green underline underline-offset-2">{t("go_simulator")}</a>
            </p>
          </div>
        )}

      </main>
    </div>
  );
}
