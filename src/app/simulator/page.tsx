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
  const sidebarRef = useRef<HTMLDivElement>(null);
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const initCenterOverrides = useSimulationStore((s) => s.initCenterOverrides);
  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);
  const loadScenariosFromServer = useSimulationStore((s) => s.loadScenariosFromServer);
  const { t } = useTranslations();
  const role = useRole();
  // Treat loading (null) as admin to avoid flash of hidden controls for admin users.
  // Investor controls will disappear once role loads (~50ms).
  const isAdmin = role !== "investor";
  const isInvestor = role === "investor";

  useEffect(() => {
    initCenterOverrides();
    initStateFromServer();
    loadScenariosFromServer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedLotIds.size > 0 && sidebarRef.current) {
      sidebarRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedLotIds]);

  return (
    <div className="flex flex-col" style={{ background: "#F4F9EF", minHeight: "100vh" }}>
      {/* Shared navigation header */}
      <AppHeader currentPage="simulator" />

      {/* Toolbar — admin only */}
      {isAdmin && (
        <div className="px-3 sm:px-6 py-2 sm:py-2.5 border-b border-gray-200 flex-shrink-0 overflow-x-auto" style={{ background: "#fff" }}>
          <Toolbar />
        </div>
      )}

      {/* Selection Toolbar — admin only */}
      {isAdmin && selectedLotIds.size > 0 && (
        <div className="px-3 sm:px-6 py-2 flex-shrink-0">
          <SelectionToolbar />
        </div>
      )}

      {/* Financial Summary Bar */}
      <div className="px-3 sm:px-6 py-3 flex-shrink-0">
        <SimulationSummaryBar />
      </div>

      {/* Main Content — stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row px-3 sm:px-6 pb-4 gap-4 lg:items-start">
        {/* Master Plan Map — full width on mobile, natural aspect ratio */}
        <div className="w-full lg:flex-1 lg:min-w-0" style={{ aspectRatio: "1000 / 795" }}>
          <MasterPlanSVG />
        </div>

        {/* Right Sidebar — full width below map on mobile, fixed 320px on desktop */}
        <div ref={sidebarRef} className="w-full lg:w-80 lg:flex-shrink-0 flex flex-col gap-4 lg:overflow-y-auto" style={{ alignSelf: "stretch" }}>
          {/* Lot Configuration Panel — admin only */}
          {isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {t("lot_config_header")}
                </h2>
              </div>
              <LotConfigPanel />
            </div>
          )}

          {/* Phase Manager — admin only */}
          {isAdmin && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <PhaseManager />
            </div>
          )}

          {/* Development Mix */}
          <DevelopmentMix />

          {/* Phase Comparison */}
          <ProfitBreakdown />

          {/* Project Specs Editor — admin only */}
          {isAdmin && <ProjectSpecsEditor />}
        </div>
      </div>
      <AppFooter />
    </div>
  );
}
