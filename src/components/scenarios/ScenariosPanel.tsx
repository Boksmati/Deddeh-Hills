"use client";

import { useState } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { useTranslations } from "@/i18n/useTranslations";

export default function ScenariosPanel({ onClose }: { onClose: () => void }) {
  const scenarios = useSimulationStore((s) => s.scenarios);
  const activeScenarioId = useSimulationStore((s) => s.activeScenarioId);
  const saveScenario = useSimulationStore((s) => s.saveScenario);
  const loadScenario = useSimulationStore((s) => s.loadScenario);
  const deleteScenario = useSimulationStore((s) => s.deleteScenario);
  const assignments = useSimulationStore((s) => s.assignments);
  const { t } = useTranslations();

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const assignedCount = Array.from(assignments.values()).filter(
    (a) => a.developmentType !== "unassigned"
  ).length;

  async function handleSave() {
    const name = newName.trim() || `Scenario ${scenarios.length + 1}`;
    setSaving(true);
    await saveScenario(name);
    setNewName("");
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteScenario(id);
    setDeletingId(null);
  }

  function handleLoad(id: string) {
    loadScenario(id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{t("saved_scenarios")}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {scenarios.length} {scenarios.length !== 1 ? t("scenarios_count_plural") : t("scenarios_count_singular")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          >
            &times;
          </button>
        </div>

        {/* Save new */}
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">
            {t("save_current")} ({assignedCount} {t("lots_configured_label")})
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t("scenario_name_placeholder")}
              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-dh-green"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-dh-green text-white text-xs font-medium rounded-lg hover:bg-dh-green/90 disabled:opacity-50 transition-colors"
            >
              {saving ? t("saving") : t("save")}
            </button>
          </div>
        </div>

        {/* Scenario list */}
        <div className="max-h-80 overflow-y-auto">
          {scenarios.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              {t("no_scenarios")}
            </div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {[...scenarios].reverse().map((sc) => {
                const isActive = sc.id === activeScenarioId;
                const date = new Date(sc.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric", month: "short", year: "numeric",
                });
                const lotsCount = sc.assignments.filter(
                  (a) => a.developmentType !== "unassigned"
                ).length;
                return (
                  <li
                    key={sc.id}
                    className={`flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors ${
                      isActive ? "bg-dh-green/5" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {sc.name}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-semibold text-dh-green bg-dh-green/10 px-1.5 py-0.5 rounded">
                            {t("active")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {date} &middot; {lotsCount} {t("lots_configured_label")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                      <button
                        onClick={() => handleLoad(sc.id)}
                        className="px-3 py-1.5 text-xs font-medium text-dh-green hover:bg-dh-green/10 rounded-lg transition-colors"
                      >
                        {t("load")}
                      </button>
                      <button
                        onClick={() => handleDelete(sc.id)}
                        disabled={deletingId === sc.id}
                        className="px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="Delete scenario"
                      >
                        {deletingId === sc.id ? "…" : "✕"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
