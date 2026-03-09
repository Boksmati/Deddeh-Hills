"use client";

import { useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_LABELS, PHASE_COLORS } from "@/data/development-types";
import { calculateLotFinancials } from "@/engine/financial-engine";
import { DevelopmentType, Phase, LotStatus } from "@/types";
import MassingPanel from "@/components/phases/MassingPanel";
import { useTranslations } from "@/i18n/useTranslations";

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function LotConfigPanel() {
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const assignments = useSimulationStore((s) => s.assignments);
  const setDevelopmentType = useSimulationStore((s) => s.setDevelopmentType);
  const setPhase = useSimulationStore((s) => s.setPhase);
  const selectLot = useSimulationStore((s) => s.selectLot);
  const lotStatuses = useSimulationStore((s) => s.lotStatuses);
  const setLotStatus = useSimulationStore((s) => s.setLotStatus);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const [showSpecSheet, setShowSpecSheet] = useState(false);
  const { t } = useTranslations();

  const selectedIds = Array.from(selectedLotIds);
  const selectedLots = selectedIds
    .map((id) => LOTS.find((l) => l.id === id))
    .filter(Boolean);

  if (selectedLots.length === 0) {
    return (
      <div className="p-5">
        <div className="text-center text-gray-400 py-8">
          <div className="text-4xl mb-3 opacity-50">&#9634;</div>
          <p className="text-sm font-medium">{t("click_lot")}</p>
          <p className="text-xs mt-1">{t("shift_click")}</p>
        </div>
      </div>
    );
  }

  const isMulti = selectedLots.length > 1;
  const firstLot = selectedLots[0]!;
  const firstAssignment = assignments.get(firstLot.id);
  const currentDevType = firstAssignment?.developmentType ?? "unassigned";
  const currentPhase = firstAssignment?.phase ?? 0;
  const firstStatus: LotStatus = lotStatuses.get(firstLot.id) ?? "available";

  // Calculate financials for single lot
  const financials = !isMulti
    ? calculateLotFinancials(firstLot, currentDevType)
    : null;

  const devTypes = Object.values(DEVELOPMENT_TYPES).filter(
    (t) => t.id !== "unassigned"
  );

  const lotStatuses4: { status: LotStatus; key: "status_available" | "status_reserved" | "status_under_contract" | "status_sold"; color: string }[] = [
    { status: "available", key: "status_available", color: "#10B981" },
    { status: "reserved", key: "status_reserved", color: "#F59E0B" },
    { status: "under_contract", key: "status_under_contract", color: "#F97316" },
    { status: "sold", key: "status_sold", color: "#EF4444" },
  ];

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-gray-900 text-sm">
          {isMulti
            ? `${selectedLots.length} ${t("lots_selected")}`
            : `${t("lot_id")} #${firstLot.id}`}
        </h3>
        {!isMulti && (
          <p className="text-xs text-gray-500 mt-0.5">
            {formatNum(firstLot.area_sqm)} {t("sqm")} &middot; {firstLot.max_floors}F
            &middot; {formatUSD(firstLot.zone_price_retail)}/{t("sqm")}
          </p>
        )}
      </div>

      {/* Lot Status */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t("lot_status")}
        </h4>
        <div className="grid grid-cols-2 gap-1.5">
          {lotStatuses4.map(({ status, key, color }) => (
            <button
              key={status}
              onClick={() => setLotStatus(selectedIds, status)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                firstStatus === status
                  ? "text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              style={firstStatus === status ? { backgroundColor: color } : {}}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: firstStatus === status ? "#fff" : color, opacity: firstStatus === status ? 0.85 : 1 }}
              />
              {t(key)}
            </button>
          ))}
        </div>
      </div>

      {/* Lot chip list (multi-select) */}
      {isMulti && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.sort((a, b) => a - b).map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600"
            >
              #{id}
              <button
                onClick={(e) => { e.stopPropagation(); selectLot(id, true); }}
                className="text-gray-400 hover:text-red-500 leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Lot Specs (single lot) */}
      {!isMulti && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("area")}</div>
            <div className="font-semibold">{formatNum(firstLot.area_sqm)} m&sup2;</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("max_bua")}</div>
            <div className="font-semibold">
              {formatNum(firstLot.total_bua_sqm)} m&sup2;
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("floors")}</div>
            <div className="font-semibold">{firstLot.max_floors}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("road")}</div>
            <div className="font-semibold">{firstLot.road_width_m}m</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("zone_price")}</div>
            <div className="font-semibold">
              ${firstLot.zone_price_retail}/m&sup2;
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <div className="text-gray-400 mb-0.5">{t("oug")}</div>
            <div className="font-semibold">
              {firstLot.oug_allowed ? t("oug_allowed") : t("oug_na")}
            </div>
          </div>
        </div>
      )}

      {/* Elevation & Site Details (single lot) */}
      {!isMulti && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t("site_details")}
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 rounded-lg p-2.5">
              <div className="text-blue-400 mb-0.5">{t("elevation")}</div>
              <div className="font-semibold text-blue-800 text-[10px] leading-tight">
                {firstLot.levels}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-2.5">
              <div className="text-blue-400 mb-0.5">{t("road_level")}</div>
              <div className="font-semibold text-blue-800">{firstLot.road_level}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("max_height")}</div>
              <div className="font-semibold">{firstLot.max_height_m}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("setback")}</div>
              <div className="font-semibold">{firstLot.setback_m}m</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("parking")}</div>
              <div className="font-semibold">
                {firstLot.parking_spots} + {firstLot.guest_parking}G
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("exploit_ratio")}</div>
              <div className="font-semibold">
                {(firstLot.exploitation_ratio * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("surface_ratio")}</div>
              <div className="font-semibold">
                {(firstLot.superficial_ratio * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-2.5">
              <div className="text-gray-400 mb-0.5">{t("oug_area")}</div>
              <div className="font-semibold">
                {formatNum(firstLot.oug_area_sqm)} m&sup2;
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spec Sheet Image (single lot) */}
      {!isMulti && (
        <div>
          <button
            onClick={() => setShowSpecSheet(!showSpecSheet)}
            className="w-full flex items-center justify-between px-3 py-2 bg-dh-green/10 rounded-lg text-xs font-medium text-dh-green hover:bg-dh-green/20 transition-colors"
          >
            <span>{t("spec_sheet")}</span>
            <span className="text-lg leading-none">{showSpecSheet ? "\u2212" : "+"}</span>
          </button>
          {showSpecSheet && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
              <img
                src={`/spec-sheets/spec-lot-${firstLot.id}.png`}
                alt={`Specification Sheet - Lot ${firstLot.id}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}
        </div>
      )}

      {/* Development Type Selector */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t("dev_type")}
        </h4>
        <div className="space-y-1.5">
          {devTypes.map((dt) => (
            <button
              key={dt.id}
              onClick={() =>
                setDevelopmentType(selectedIds, dt.id as DevelopmentType)
              }
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2.5 ${
                currentDevType === dt.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: dt.color }}
              />
              <span className="font-medium">{dt.label}</span>
              {dt.sellingPricePerM > 0 && (
                <span className="ml-auto text-gray-400 text-[10px]">
                  ${dt.sellingPricePerM}/m
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setDevelopmentType(selectedIds, "unassigned")}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2.5 ${
              currentDevType === "unassigned"
                ? "bg-gray-200 text-gray-700"
                : "bg-gray-50 text-gray-400 hover:bg-gray-100"
            }`}
          >
            <span className="w-3 h-3 rounded-sm bg-gray-300 flex-shrink-0" />
            <span>{t("clear_assignment")}</span>
          </button>
        </div>
      </div>

      {/* Phase Assignment */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {t("phase_label")}
        </h4>
        <div className="flex gap-1.5">
          {([1, 2, 3, 0] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(selectedIds, p)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                currentPhase === p
                  ? "text-white shadow-sm"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              style={
                currentPhase === p
                  ? { backgroundColor: PHASE_COLORS[p] === "#E5E7EB" ? "#6B7280" : PHASE_COLORS[p] }
                  : undefined
              }
            >
              {p === 0 ? "—" : `P${p}`}
            </button>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      {financials && currentDevType !== "unassigned" && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t("projected_financials")}
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("land_cost")}</span>
              <span className="font-medium tabular-nums">
                {formatUSD(financials.landCost)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("sellable_area")}</span>
              <span className="font-medium tabular-nums">
                {formatNum(financials.sellableArea)} m&sup2;
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("units")}</span>
              <span className="font-medium tabular-nums">
                {financials.numUnits}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("construction")}</span>
              <span className="font-medium tabular-nums">
                {formatUSD(financials.constructionCost)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("revenue")}</span>
              <span className="font-semibold text-dh-green tabular-nums">
                {formatUSD(financials.revenue)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-100">
              <span className="text-gray-500">{t("gross_profit")}</span>
              <span className="font-semibold tabular-nums">
                {formatUSD(financials.grossProfit)}
              </span>
            </div>
            <div className="flex justify-between py-2 bg-gray-50 rounded-lg px-2 -mx-2">
              <span className="font-semibold text-gray-700">{t("net_profit")}</span>
              <span
                className={`font-bold tabular-nums ${
                  financials.netProfit >= 0
                    ? "text-emerald-600"
                    : "text-red-500"
                }`}
              >
                {formatUSD(financials.netProfit)}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">{t("margin")}</span>
              <span className="font-medium tabular-nums">
                {(financials.grossMargin * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Multi-lot massing summary */}
      {isMulti && <MassingPanel />}
    </div>
  );
}
