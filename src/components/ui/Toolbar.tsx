"use client";

import { useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { DEVELOPMENT_TYPES, PHASE_COLORS, PHASE_LABELS } from "@/data/development-types";
import { ViewMode, MapColorMode } from "@/types";
import ScenariosPanel from "@/components/scenarios/ScenariosPanel";
import { useTranslations } from "@/i18n/useTranslations";

export default function Toolbar() {
  const [showScenarios, setShowScenarios] = useState(false);
  const scenarios = useSimulationStore((s) => s.scenarios);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);
  const mapColorMode = useSimulationStore((s) => s.mapColorMode);
  const setMapColorMode = useSimulationStore((s) => s.setMapColorMode);
  const investorSharePct = useSimulationStore((s) => s.investorSharePct);
  const setInvestorSharePct = useSimulationStore((s) => s.setInvestorSharePct);
  const resetAll = useSimulationStore((s) => s.resetAll);
  const calibrationMode = useSimulationStore((s) => s.calibrationMode);
  const toggleCalibrationMode = useSimulationStore((s) => s.toggleCalibrationMode);
  const resetCenterOverrides = useSimulationStore((s) => s.resetCenterOverrides);
  const { t } = useTranslations();

  const viewModes: { id: ViewMode; label: string }[] = [
    { id: "development", label: t("view_development") },
    { id: "phase", label: t("view_phases") },
    { id: "financial", label: t("view_financial") },
  ];

  const colorModes: { id: MapColorMode; label: string }[] = [
    { id: "type", label: t("color_type") },
    { id: "phase", label: t("color_phase") },
    { id: "price", label: t("color_price") },
    { id: "area", label: t("color_area") },
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-6">
        {/* View mode tabs */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {viewModes.map((vm) => (
            <button
              key={vm.id}
              onClick={() => setViewMode(vm.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                viewMode === vm.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {vm.label}
            </button>
          ))}
        </div>

        {/* Color mode */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{t("color_label")}</span>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {colorModes.map((cm) => (
              <button
                key={cm.id}
                onClick={() => setMapColorMode(cm.id)}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  mapColorMode === cm.id
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {cm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        {mapColorMode === "type" && (
          <div className="flex items-center gap-3">
            {Object.values(DEVELOPMENT_TYPES)
              .filter((t) => t.id !== "unassigned")
              .map((dt) => (
                <div key={dt.id} className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ backgroundColor: dt.color }}
                  />
                  <span className="text-[10px] text-gray-500">
                    {dt.shortLabel}
                  </span>
                </div>
              ))}
          </div>
        )}

        {mapColorMode === "phase" && (
          <div className="flex items-center gap-3">
            {[1, 2, 3].map((p) => (
              <div key={p} className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: PHASE_COLORS[p] }}
                />
                <span className="text-[10px] text-gray-500">
                  {PHASE_LABELS[p]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Investor share slider */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{t("investor_label")}</span>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={investorSharePct}
            onChange={(e) => setInvestorSharePct(Number(e.target.value))}
            className="w-20 accent-dh-green"
          />
          <span className="text-xs font-medium text-gray-700 tabular-nums w-8">
            {investorSharePct}%
          </span>
        </div>

        {/* Calibration */}
        {calibrationMode ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => resetCenterOverrides()}
              className="px-3 py-1.5 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-all"
            >
              {t("reset_positions")}
            </button>
            <button
              onClick={() => toggleCalibrationMode()}
              className="px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all"
            >
              {t("save_exit")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => toggleCalibrationMode()}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
          >
            {t("calibrate")}
          </button>
        )}

        {/* Scenarios */}
        <button
          onClick={() => setShowScenarios(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
        >
          <span>{t("scenarios")}</span>
          {scenarios.length > 0 && (
            <span className="bg-dh-green text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {scenarios.length}
            </span>
          )}
        </button>

        {/* Reset */}
        <button
          onClick={resetAll}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          {t("reset_all")}
        </button>
      </div>

      {showScenarios && <ScenariosPanel onClose={() => setShowScenarios(false)} />}
    </div>
  );
}
