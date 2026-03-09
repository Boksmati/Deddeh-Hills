"use client";

import { useSimulationStore } from "@/store/simulation-store";
import { DEVELOPMENT_TYPES, PHASE_COLORS } from "@/data/development-types";
import { DevelopmentType, Phase } from "@/types";
import { useState } from "react";
import { useTranslations } from "@/i18n/useTranslations";
import { TranslationKey } from "@/i18n/translations";

const DT_LABEL_KEYS: Record<string, TranslationKey> = {
  lot_sale: "dt_lot_sale",
  twin_villa: "dt_twin_villa",
  villa_2f: "dt_villa_2f",
  villa_3f: "dt_villa_3f",
  apartments: "dt_apartments",
  unassigned: "dt_unassigned",
};

export default function SelectionToolbar() {
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const selectLotsByPhase = useSimulationStore((s) => s.selectLotsByPhase);
  const selectLotsByType = useSimulationStore((s) => s.selectLotsByType);
  const selectAll = useSimulationStore((s) => s.selectAll);
  const deselectAll = useSimulationStore((s) => s.deselectAll);
  const setDevelopmentType = useSimulationStore((s) => s.setDevelopmentType);
  const setPhase = useSimulationStore((s) => s.setPhase);
  const { t } = useTranslations();

  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);

  const count = selectedLotIds.size;
  if (count === 0) return null;

  const selectedIds = Array.from(selectedLotIds);

  const devTypes = Object.values(DEVELOPMENT_TYPES).filter(
    (dt) => dt.id !== "unassigned"
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-dh-green/5 border border-dh-green/20 rounded-lg text-xs">
      {/* Count */}
      <span className="font-semibold text-dh-green whitespace-nowrap">
        {count} {count !== 1 ? t("lots_selected_count") : t("lot_selected_count")}
      </span>

      <div className="w-px h-4 bg-gray-200" />

      {/* Quick Select */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{t("select_label")}</span>
        <button
          onClick={selectAll}
          className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
        >
          {t("all")}
        </button>
        <div className="relative">
          <button
            onClick={() => { setShowSelectMenu(!showSelectMenu); setShowTypeMenu(false); }}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            {t("by_phase_label")} &#9662;
          </button>
          {showSelectMenu && (
            <div className="absolute top-full start-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[100px]">
              {([1, 2, 3] as Phase[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { selectLotsByPhase(p); setShowSelectMenu(false); }}
                  className="w-full text-start px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: PHASE_COLORS[p] }}
                  />
                  {t("phase_label")} {p}
                </button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              {devTypes.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => { selectLotsByType(dt.id as DevelopmentType); setShowSelectMenu(false); }}
                  className="w-full text-start px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: dt.color }}
                  />
                  {DT_LABEL_KEYS[dt.id] ? t(DT_LABEL_KEYS[dt.id]) : dt.shortLabel}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* Quick Assign Phase */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400">{t("phase_label")}:</span>
        {([1, 2, 3] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(selectedIds, p)}
            className="w-7 h-6 rounded text-[10px] font-semibold text-white transition-colors hover:opacity-80"
            style={{ backgroundColor: PHASE_COLORS[p] }}
          >
            P{p}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-gray-200" />

      {/* Quick Assign Type */}
      <div className="relative flex items-center gap-1.5">
        <span className="text-gray-400">{t("type_label")}</span>
        <button
          onClick={() => { setShowTypeMenu(!showTypeMenu); setShowSelectMenu(false); }}
          className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
        >
          {t("assign_btn")} &#9662;
        </button>
        {showTypeMenu && (
          <div className="absolute top-full start-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[160px]">
            {devTypes.map((dt) => (
              <button
                key={dt.id}
                onClick={() => { setDevelopmentType(selectedIds, dt.id as DevelopmentType); setShowTypeMenu(false); }}
                className="w-full text-start px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: dt.color }}
                />
                {DT_LABEL_KEYS[dt.id] ? t(DT_LABEL_KEYS[dt.id]) : dt.label}
              </button>
            ))}
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setDevelopmentType(selectedIds, "unassigned"); setShowTypeMenu(false); }}
              className="w-full text-start px-3 py-1.5 hover:bg-gray-50 text-gray-400"
            >
              {t("clear_assignment")}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Deselect */}
      <button
        onClick={deselectAll}
        className="px-2 py-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {t("deselect_all")}
      </button>
    </div>
  );
}
