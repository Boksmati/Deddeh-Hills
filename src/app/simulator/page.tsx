"use client";

import { useRef, useEffect } from "react";
import MasterPlanSVG from "@/components/master-plan/MasterPlanSVG";
import LotConfigPanel from "@/components/lot-config/LotConfigPanel";
import SimulationSummaryBar from "@/components/financials/SimulationSummary";
import ProfitBreakdown from "@/components/financials/ProfitBreakdown";
import DevelopmentMix from "@/components/financials/DevelopmentMix";
import Toolbar from "@/components/ui/Toolbar";
import SelectionToolbar from "@/components/ui/SelectionToolbar";
import PhaseManager from "@/components/phases/PhaseManager";
import AppHeader from "@/components/ui/AppHeader";
import AppFooter from "@/components/ui/AppFooter";
import { useSimulationStore } from "@/store/simulation-store";
import { useTranslations } from "@/i18n/useTranslations";
import ProjectSpecsEditor from "@/components/admin/ProjectSpecsEditor";
import { useRole } from "@/hooks/useRole";

export default function Home() {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const initCenterOverrides = useSimulationStore((s) => s.initCenterOverrides);
  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);
  const loadScenariosFromServer = useSimulationStore((s) => s.loadScenariosFromServer);
  const { t } = useTranslations();
  const role = useRole();
  const isAdmin = role !== "investor";

  useEffect(() => {
    initCenterOverrides();
    initStateFromServer();
    loadScenariosFromServer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll left panel to top when a lot is selected
  useEffect(() => {
    if (selectedLotIds.size > 0 && leftPanelRef.current) {
      leftPanelRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedLotIds]);

  return (
    <div className="flex flex-col" style={{ background: "#F4F9EF", minHeight: "100vh" }}>
      {/* Header */}
      <AppHeader currentPage="simulator" />

      {/* Toolbar — admin only */}
      {isAdmin && (
        <div className="px-3 sm:px-4 py-2 border-b border-gray-200 flex-shrink-0 overflow-x-auto" style={{ background: "#fff" }}>
          <Toolbar />
        </div>
      )}

      {/* Selection Toolbar — admin only */}
      {isAdmin && selectedLotIds.size > 0 && (
        <div className="px-3 sm:px-4 py-1.5 flex-shrink-0 border-b border-gray-100" style={{ background: "#fff" }}>
          <SelectionToolbar />
        </div>
      )}

      {/* KPI Summary Bar */}
      <div className="px-3 sm:px-4 py-2.5 flex-shrink-0">
        <SimulationSummaryBar />
      </div>

      {/* ── Command Center Layout ──
          Mobile:  map → left panels → right panels (vertical stack)
          Desktop: [left panel | map | right panel] (3-column grid)
      */}
      <div className="
        flex flex-col
        xl:grid xl:grid-cols-[260px_1fr_260px]
        xl:items-start
        px-3 sm:px-4 pb-4 gap-3
      ">

        {/* ── LEFT PANEL: Lot Configuration ──
            Desktop: col 1 | Mobile: order 2 (below map) */}
        {isAdmin && (
          <div
            ref={leftPanelRef}
            className="flex flex-col gap-3 order-2 xl:order-1 xl:overflow-y-auto"
            className="flex flex-col gap-3 order-2 xl:order-1 xl:overflow-y-auto xl:max-h-[72vh]"
          >
            {/* Panel label */}
            <div className="hidden xl:flex items-center gap-1.5 px-1">
              <div className="w-1 h-3 rounded-full bg-dh-hills opacity-60" />
              <span className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">
                Lot Configuration
              </span>
            </div>

            {/* Lot Config card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <LotConfigPanel />
            </div>

            {/* Phase Manager card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <PhaseManager />
            </div>
          </div>
        )}

        {/* ── CENTER: Map (hero) ──
            Desktop: col 2 | Mobile: order 1 (top) */}
        <div
          className="order-1 xl:order-2 w-full"
          style={{ aspectRatio: "1000 / 795" }}
        >
          <MasterPlanSVG />
        </div>

        {/* ── RIGHT PANEL: Analytics ──
            Desktop: col 3 | Mobile: order 3 (below left panel) */}
        <div
          ref={rightPanelRef}
          className="flex flex-col gap-3 order-3 xl:overflow-y-auto"
          style={{ maxHeight: "calc(100vw * 0.5417 * 0.795)" }}
        >
          {/* Panel label */}
          <div className="hidden xl:flex items-center gap-1.5 px-1">
            <div className="w-1 h-3 rounded-full bg-dh-hills opacity-60" />
            <span className="text-[9px] uppercase tracking-widest font-semibold text-gray-400">
              Analytics
            </span>
          </div>

          {/* Development Mix */}
          <DevelopmentMix />

          {/* Profit Breakdown */}
          <ProfitBreakdown />

          {/* Project Specs — admin only */}
          {isAdmin && <ProjectSpecsEditor />}
        </div>
      </div>

      <AppFooter />
    </div>
  );
}
