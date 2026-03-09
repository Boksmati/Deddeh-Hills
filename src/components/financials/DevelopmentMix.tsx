"use client";

import { useMemo } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { DEVELOPMENT_TYPES } from "@/data/development-types";
import { DevelopmentType } from "@/types";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
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

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        <div
          className="w-2 h-2 rounded-sm"
          style={{ backgroundColor: data.color }}
        />
        <span className="font-medium">{data.label}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5" dir="ltr">
        {data.count} lots ({data.pct}%)
      </div>
    </div>
  );
};

export default function DevelopmentMix() {
  const assignments = useSimulationStore((s) => s.assignments);
  const { t } = useTranslations();

  const { pieData, total } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of Array.from(assignments.values())) {
      const type = a.developmentType;
      if (type === "unassigned") continue;
      counts[type] = (counts[type] || 0) + 1;
    }
    const total = Object.values(counts).reduce((s, c) => s + c, 0);

    const pieData = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => {
        const config = DEVELOPMENT_TYPES[type];
        return {
          name: type,
          label: config?.label ?? type,
          count,
          value: count,
          pct: total > 0 ? ((count / total) * 100).toFixed(0) : "0",
          color: config?.color ?? "#ccc",
        };
      });

    return { pieData, total };
  }, [assignments]);

  if (total === 0) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          {t("development_mix")}
        </h3>
        <p className="text-sm text-gray-400 text-center py-4">
          {t("no_lots_assigned_yet")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {t("development_mix")}
      </h3>

      {/* Pie Chart */}
      <div className="relative">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={65}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{total}</div>
            <div className="text-[9px] text-gray-400">{t("lots")}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-1.5 mt-2">
        {pieData.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-gray-600">
                {DT_LABEL_KEYS[entry.name] ? t(DT_LABEL_KEYS[entry.name]) : entry.label}
              </span>
            </div>
            <span dir="ltr" className="text-xs font-medium tabular-nums text-gray-900">
              {entry.count}{" "}
              <span className="text-gray-400">({entry.pct}%)</span>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
        <span className="text-xs text-gray-500">{t("total_assigned")}</span>
        <span dir="ltr" className="text-xs font-semibold tabular-nums">
          {total} {t("lots")}
        </span>
      </div>
    </div>
  );
}
