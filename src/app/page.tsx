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
import DhLogo from "@/components/ui/DhLogo";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useSimulationStore } from "@/store/simulation-store";
import { useTranslations } from "@/i18n/useTranslations";
import ProjectSpecsEditor from "@/components/admin/ProjectSpecsEditor";

export default function Home() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const initCenterOverrides = useSimulationStore((s) => s.initCenterOverrides);
  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);
  const loadScenariosFromServer = useSimulationStore((s) => s.loadScenariosFromServer);
  const { t } = useTranslations();

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
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <DhLogo className="h-10" />
        <div className="flex items-center gap-2">
          <a
            href="/status"
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t("nav_status")}
          </a>
          <a
            href="/assumptions"
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t("nav_assumptions")}
          </a>
          <a
            href="/investor"
            className="px-3 py-1.5 bg-dh-green text-white text-xs font-medium rounded-lg hover:bg-dh-green/90 transition-colors"
          >
            {t("nav_investor")}
          </a>
          <a
            href="/customer"
            className="px-3 py-1.5 bg-slate-700 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            {t("nav_customer")}
          </a>
          <LanguageToggle />
        </div>
      </header>

      {/* Toolbar */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <Toolbar />
      </div>

      {/* Selection Toolbar */}
      {selectedLotIds.size > 0 && (
        <div className="px-6 py-2 flex-shrink-0">
          <SelectionToolbar />
        </div>
      )}

      {/* Financial Summary Bar */}
      <div className="px-6 py-3 flex-shrink-0">
        <SimulationSummaryBar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 px-6 pb-4 gap-4">
        {/* Master Plan Map */}
        <div className="flex-1 min-w-0">
          <MasterPlanSVG />
        </div>

        {/* Right Sidebar */}
        <div ref={sidebarRef} className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Lot Configuration Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 rounded-t-xl">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {t("lot_config_header")}
              </h2>
            </div>
            <LotConfigPanel />
          </div>

          {/* Phase Manager */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <PhaseManager />
          </div>

          {/* Development Mix */}
          <DevelopmentMix />

          {/* Phase Comparison */}
          <ProfitBreakdown />

          {/* Project Specs Editor (admin) */}
          <ProjectSpecsEditor />
        </div>
      </div>
    </div>
  );
}
