"use client";

import { useState, useMemo, useEffect, Fragment } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { TYPOLOGY_KEYS, TYPOLOGY_META, type TypologyKey } from "@/data/typologies";
import {
  getLotPricing, getBaselineRetail, getBaselineL1,
  L1_DISCOUNT_DEFAULT, L2_DISCOUNT_DEFAULT,
} from "@/lib/lot-pricing";
import type { LotAssignment } from "@/types";

const L1_PCT = Math.round(L1_DISCOUNT_DEFAULT * 100);
const L2_PCT = Math.round(L2_DISCOUNT_DEFAULT * 100);

/** Small numeric input that commits on blur/Enter — avoids re-render churn while typing. */
function EditInput({ value, onChange, className, id }: { value: number; onChange: (v: number) => void; className?: string; id?: string }) {
  const [local, setLocal] = useState(String(Math.round(value)));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setLocal(String(Math.round(value))); }, [value, focused]);
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n) && n >= 0) onChange(n);
  };
  return (
    <input
      id={id}
      type="number" min={0} step={5}
      className={className}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
    />
  );
}

export function PricingCalculator({
  lang, assignments, lotStatuses,
}: {
  lang: string;
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, any>;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<TypologyKey | "all">("all");
  const [bulkDiscountPct, setBulkDiscountPct] = useState(L1_PCT);
  const [bulkFlatL1, setBulkFlatL1] = useState(200);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const lotPriceOverrides = useSimulationStore(s => s.lotPriceOverrides);
  const savedPricingDefault = useSimulationStore(s => s.savedPricingDefault);
  const setLotPriceOverride = useSimulationStore(s => s.setLotPriceOverride);
  const clearLotPriceOverride = useSimulationStore(s => s.clearLotPriceOverride);
  const bulkSetOverrides = useSimulationStore(s => s.bulkSetOverrides);
  const savePricingAsDefault = useSimulationStore(s => s.savePricingAsDefault);
  const resetToSavedDefault = useSimulationStore(s => s.resetToSavedDefault);
  const resetToBaseline = useSimulationStore(s => s.resetToBaseline);

  // Active lots = assigned to a real typology, not sold. Grouped by typology, sorted by phase then id.
  const lotsByTypology = useMemo(() => {
    const map: Record<TypologyKey, { lot: (typeof LOTS)[number]; phase: number }[]> = {
      twin_villa: [], villa_2f: [], villa_3f: [], apartments: [],
    };
    for (const lot of LOTS) {
      if (lotStatuses.get(lot.id) === "sold") continue;
      const a = assignments.get(lot.id);
      const dt = a?.developmentType as TypologyKey | undefined;
      if (!dt || !(dt in map)) continue;
      map[dt].push({ lot, phase: a?.phase ?? 0 });
    }
    for (const k of TYPOLOGY_KEYS) map[k].sort((a, b) => (a.phase - b.phase) || (a.lot.id - b.lot.id));
    return map;
  }, [assignments, lotStatuses]);

  const activeLots = useMemo(
    () => TYPOLOGY_KEYS.flatMap(k => lotsByTypology[k].map(x => x.lot)),
    [lotsByTypology]
  );

  const inScope = (typKey: TypologyKey) => scope === "all" || scope === typKey;

  // Area-weighted summary across all active lots
  const summary = useMemo(() => {
    if (activeLots.length === 0) return null;
    let area = 0, retailSum = 0, l1Sum = 0, l2Sum = 0;
    for (const lot of activeLots) {
      const p = getLotPricing(lot.id, lotPriceOverrides);
      area += lot.area_sqm;
      retailSum += lot.area_sqm * p.retail;
      l1Sum += lot.area_sqm * p.l1;
      l2Sum += lot.area_sqm * p.l2;
    }
    const avgRetail = retailSum / area, avgL1 = l1Sum / area;
    return {
      count: activeLots.length,
      avgRetail, avgL1, avgL2: l2Sum / area,
      avgDiscount: avgRetail > 0 ? (1 - avgL1 / avgRetail) * 100 : 0,
      editedCount: activeLots.filter(l => lotPriceOverrides.has(l.id)).length,
    };
  }, [activeLots, lotPriceOverrides]);

  const scopedLotIds = (): number[] =>
    TYPOLOGY_KEYS.filter(inScope).flatMap(k => lotsByTypology[k].map(x => x.lot.id));

  const applyBulkDiscount = () => {
    const ids = scopedLotIds();
    const updates = ids.map(id => {
      const retail = getLotPricing(id, lotPriceOverrides).retail;
      return { lotId: id, retail, l1: Math.round(retail * (1 - bulkDiscountPct / 100)) };
    });
    bulkSetOverrides(updates);
  };

  const applyBulkFlat = () => {
    const ids = scopedLotIds();
    const updates = ids.map(id => ({
      lotId: id, retail: getLotPricing(id, lotPriceOverrides).retail, l1: bulkFlatL1,
    }));
    bulkSetOverrides(updates);
  };

  const resetScope = () => {
    for (const id of scopedLotIds()) clearLotPriceOverride(id);
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    try {
      await savePricingAsDefault();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("idle");
    }
  };

  const handleResetBaseline = async () => {
    if (!confirm(lang === "ar"
      ? "إعادة كل الأسعار إلى القيم الافتراضية؟ سيتم مسح أي تعديلات محفوظة."
      : "Reset every lot to baseline pricing? This clears any saved default too.")) return;
    await resetToBaseline();
  };

  if (activeLots.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header — always visible summary */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/60 transition-colors text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {lang === "ar" ? "حاسبة الأسعار لكل قطعة" : "Pricing Calculator"}
          </h3>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {summary && (
              <>
                {summary.count} {lang === "ar" ? "قطعة نشطة" : "active plots"}
                {" · "}{lang === "ar" ? "متوسط التجزئة" : "avg retail"} ${Math.round(summary.avgRetail)}
                {" · "}{lang === "ar" ? "متوسط L1" : "avg L1"} ${Math.round(summary.avgL1)}
                {summary.editedCount > 0 && (
                  <span className="text-amber-600 font-medium">
                    {" · "}{summary.editedCount} {lang === "ar" ? "معدّلة" : "edited"}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <span className="text-gray-400 text-xs">{open ? "▼" : "▶"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Bulk controls */}
          <div className="bg-gray-50/70 rounded-xl p-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              {(["all", ...TYPOLOGY_KEYS] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setScope(k)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    scope === k ? "bg-dh-dark text-white" : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-200"
                  }`}
                >
                  {k === "all" ? (lang === "ar" ? "الكل" : "All") : (lang === "ar" ? TYPOLOGY_META[k].labelAr : TYPOLOGY_META[k].label)}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">{lang === "ar" ? "خصم L1" : "L1 discount"}</span>
              <input type="number" min={0} max={90} step={1} value={bulkDiscountPct}
                onChange={e => setBulkDiscountPct(parseInt(e.target.value) || 0)}
                className="w-12 text-[11px] text-right px-1.5 py-1 border border-gray-200 rounded" />
              <span className="text-[10px] text-gray-400">%</span>
              <button onClick={applyBulkDiscount} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-600 text-white hover:bg-blue-700">
                {lang === "ar" ? "تطبيق" : "Apply %"}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">{lang === "ar" ? "L1 ثابت" : "Flat L1 $"}</span>
              <input type="number" min={0} step={5} value={bulkFlatL1}
                onChange={e => setBulkFlatL1(parseInt(e.target.value) || 0)}
                className="w-16 text-[11px] text-right px-1.5 py-1 border border-gray-200 rounded" />
              <button onClick={applyBulkFlat} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-gray-600 text-white hover:bg-gray-700">
                {lang === "ar" ? "تطبيق" : "Apply flat"}
              </button>
            </div>
            <div className="flex-1" />
            <button onClick={resetScope} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white text-gray-500 hover:bg-gray-100 border border-gray-200">
              {lang === "ar" ? "إعادة تعيين النطاق" : "Reset scope to baseline"}
            </button>
          </div>

          {/* Table, grouped by typology */}
          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[480px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-gray-900 text-white z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{lang === "ar" ? "القطعة" : "Lot"}</th>
                  <th className="px-3 py-2 text-left font-medium">{lang === "ar" ? "المرحلة" : "Phase"}</th>
                  <th className="px-3 py-2 text-right font-medium">{lang === "ar" ? "تجزئة $/م²" : "Retail $/m²"}</th>
                  <th className="px-3 py-2 text-right font-medium">L1 $/m² (−{L1_PCT}%)</th>
                  <th className="px-3 py-2 text-right font-medium">L2 $/m² (−{L2_PCT}%)</th>
                  <th className="px-3 py-2 text-right font-medium">{lang === "ar" ? "خصم" : "Disc."}</th>
                  <th className="px-2 py-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {TYPOLOGY_KEYS.filter(k => lotsByTypology[k].length > 0).map(k => (
                  <Fragment key={k}>
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-3 py-1.5">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-700">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: TYPOLOGY_META[k].color }} />
                          {lang === "ar" ? TYPOLOGY_META[k].labelAr : TYPOLOGY_META[k].label}
                          <span className="text-gray-400 font-normal">({lotsByTypology[k].length})</span>
                        </span>
                      </td>
                    </tr>
                    {lotsByTypology[k].map(({ lot, phase }) => {
                      const p = getLotPricing(lot.id, lotPriceOverrides);
                      const isEdited = lotPriceOverrides.has(lot.id);
                      const discount = p.retail > 0 ? Math.round((1 - p.l1 / p.retail) * 100) : 0;
                      return (
                        <tr key={lot.id} className={`border-t border-gray-50 ${isEdited ? "bg-amber-50/50" : ""}`}>
                          <td className="px-3 py-1 font-semibold text-gray-700">
                            {lot.id}{isEdited && <span className="text-amber-500 ml-1" title={lang === "ar" ? "معدّل" : "Edited"}>●</span>}
                          </td>
                          <td className="px-3 py-1 text-gray-500">{phase >= 1 && phase <= 3 ? `P${phase}` : "TBD"}</td>
                          <td className="px-3 py-1 text-right">
                            <EditInput
                              id={`pc-retail-${lot.id}`}
                              value={p.retail}
                              onChange={v => setLotPriceOverride(lot.id, v, p.l1)}
                              className="w-16 text-right px-1.5 py-0.5 border border-gray-200 rounded tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-1 text-right">
                            <EditInput
                              id={`pc-l1-${lot.id}`}
                              value={p.l1}
                              onChange={v => setLotPriceOverride(lot.id, p.retail, v)}
                              className="w-16 text-right px-1.5 py-0.5 border border-blue-200 bg-blue-50/40 rounded tabular-nums text-blue-800"
                            />
                          </td>
                          <td className="px-3 py-1 text-right text-emerald-700 tabular-nums">${p.l2}</td>
                          <td className="px-3 py-1 text-right text-gray-400 tabular-nums">{discount}%</td>
                          <td className="px-2 py-1 text-center">
                            {isEdited && (
                              <button
                                onClick={() => clearLotPriceOverride(lot.id)}
                                title={lang === "ar" ? "إعادة تعيين" : "Reset to baseline"}
                                className="text-gray-300 hover:text-red-500 text-[13px] leading-none"
                              >×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Save / reset actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-dh-dark text-white hover:opacity-90 disabled:opacity-50"
            >
              {saveStatus === "saving" ? (lang === "ar" ? "جارٍ الحفظ…" : "Saving…")
                : saveStatus === "saved" ? (lang === "ar" ? "✓ تم الحفظ" : "✓ Saved")
                : (lang === "ar" ? "حفظ كافتراضي" : "Save as Default")}
            </button>
            <button
              onClick={resetToSavedDefault}
              disabled={!savedPricingDefault || savedPricingDefault.size === 0}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              {lang === "ar" ? "إعادة للمحفوظ" : "Reset to saved"}
            </button>
            <button
              onClick={handleResetBaseline}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white text-red-600 border border-red-200 hover:bg-red-50"
            >
              {lang === "ar" ? "إعادة للأساسي" : "Reset to baseline"}
            </button>
            <span className="text-[10px] text-gray-400 ml-auto">
              {lang === "ar"
                ? "الأسعار المعدّلة تنعكس فورًا على كل المراحل والأنماط وحساب التقاسم."
                : "Edits flow immediately into every phase, typology and the co-dev split."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
