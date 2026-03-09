"use client";

import { useState, useCallback } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { ProjectSpecs, SpecItem } from "@/data/project-specs";
import { useTranslations } from "@/i18n/useTranslations";

// ─── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: {
  key: keyof Omit<ProjectSpecs, "amenities" | "amenitiesAr">;
  icon: string;
  tkEn: string;
  tkAr: string;
}[] = [
  { key: "structure",  icon: "🏗️", tkEn: "Structure",  tkAr: "الهيكل الإنشائي" },
  { key: "flooring",   icon: "🪵", tkEn: "Flooring",   tkAr: "الأرضيات"          },
  { key: "kitchen",    icon: "🍳", tkEn: "Kitchen",    tkAr: "المطبخ"             },
  { key: "bathrooms",  icon: "🚿", tkEn: "Bathrooms",  tkAr: "الحمامات"           },
  { key: "electrical", icon: "⚡", tkEn: "Electrical", tkAr: "الكهرباء"           },
  { key: "energy",     icon: "☀️", tkEn: "Energy",     tkAr: "الطاقة"             },
  { key: "outdoor",    icon: "🌿", tkEn: "Outdoor",    tkAr: "الخارجي"            },
];

// ─── Row editor ───────────────────────────────────────────────────────────────
function SpecRow({
  item,
  idx,
  catKey,
  onChange,
  onRemove,
}: {
  item: SpecItem;
  idx: number;
  catKey: string;
  onChange: (idx: number, field: keyof SpecItem, val: string) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 mb-2 group relative">
      {/* EN label */}
      <input
        value={item.label}
        onChange={(e) => onChange(idx, "label", e.target.value)}
        placeholder="Label (EN)"
        className="col-span-1 border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40"
      />
      {/* EN value */}
      <input
        value={item.value}
        onChange={(e) => onChange(idx, "value", e.target.value)}
        placeholder="Value (EN)"
        className="col-span-1 border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40"
      />
      {/* AR label */}
      <input
        value={item.labelAr}
        onChange={(e) => onChange(idx, "labelAr", e.target.value)}
        placeholder="التسمية (ع)"
        dir="rtl"
        className="col-span-1 border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40 text-right"
      />
      {/* AR value */}
      <input
        value={item.valueAr}
        onChange={(e) => onChange(idx, "valueAr", e.target.value)}
        placeholder="القيمة (ع)"
        dir="rtl"
        className="col-span-1 border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40 text-right"
      />
      {/* Remove button */}
      <button
        onClick={() => onRemove(idx)}
        title="Remove row"
        className="absolute -right-5 top-2 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Category accordion ────────────────────────────────────────────────────────
function CategorySection({
  catKey,
  icon,
  titleEn,
  items,
  onItemChange,
  onItemRemove,
  onItemAdd,
}: {
  catKey: string;
  icon: string;
  titleEn: string;
  items: SpecItem[];
  onItemChange: (idx: number, field: keyof SpecItem, val: string) => void;
  onItemRemove: (idx: number) => void;
  onItemAdd: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-stone-100 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <span>{icon}</span>
          <span>{titleEn}</span>
          <span className="text-stone-400 font-normal">({items.length})</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-3">
          {/* Column headers */}
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <span className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold">Label EN / AR</span>
            <span className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold">Value EN / AR</span>
          </div>
          {items.map((item, idx) => (
            <SpecRow
              key={idx}
              item={item}
              idx={idx}
              catKey={catKey}
              onChange={onItemChange}
              onRemove={onItemRemove}
            />
          ))}
          <button
            onClick={onItemAdd}
            className="mt-1 flex items-center gap-1 text-[11px] text-dh-green hover:text-dh-green/80 font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span> Add row
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Amenities editor ─────────────────────────────────────────────────────────
function AmenitiesSection({
  amenities,
  amenitiesAr,
  onChange,
}: {
  amenities: string[];
  amenitiesAr: string[];
  onChange: (en: string[], ar: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleEn(idx: number, val: string) {
    const next = [...amenities]; next[idx] = val; onChange(next, amenitiesAr);
  }
  function handleAr(idx: number, val: string) {
    const next = [...amenitiesAr]; next[idx] = val; onChange(amenities, next);
  }
  function addRow() {
    onChange([...amenities, ""], [...amenitiesAr, ""]);
  }
  function removeRow(idx: number) {
    onChange(amenities.filter((_, i) => i !== idx), amenitiesAr.filter((_, i) => i !== idx));
  }

  return (
    <div className="border border-stone-100 rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
          <span>✅</span>
          <span>Amenities</span>
          <span className="text-stone-400 font-normal">({amenities.length})</span>
        </span>
        <svg
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-3">
          <div className="grid grid-cols-2 gap-1.5 mb-1.5">
            <span className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold">English</span>
            <span className="text-[9px] uppercase tracking-wide text-stone-400 font-semibold">Arabic (ع)</span>
          </div>
          {amenities.map((item, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-1.5 mb-1.5 group relative">
              <input
                value={item}
                onChange={(e) => handleEn(idx, e.target.value)}
                placeholder="Amenity (EN)"
                className="border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40"
              />
              <input
                value={amenitiesAr[idx] ?? ""}
                onChange={(e) => handleAr(idx, e.target.value)}
                placeholder="المرفق (ع)"
                dir="rtl"
                className="border border-stone-200 rounded-md px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-dh-green/40 text-right"
              />
              <button
                onClick={() => removeRow(idx)}
                title="Remove"
                className="absolute -right-5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 text-xs leading-none"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addRow}
            className="mt-1 flex items-center gap-1 text-[11px] text-dh-green hover:text-dh-green/80 font-medium transition-colors"
          >
            <span className="text-base leading-none">+</span> Add amenity
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ProjectSpecsEditor() {
  const specs = useSimulationStore((s) => s.projectSpecs);
  const setProjectSpecs = useSimulationStore((s) => s.setProjectSpecs);
  const { t } = useTranslations();
  const [panelOpen, setPanelOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Generic SpecItem array updater ──────────────────────────────────────────
  const handleItemChange = useCallback(
    (catKey: keyof Omit<ProjectSpecs, "amenities" | "amenitiesAr">) =>
      (idx: number, field: keyof SpecItem, val: string) => {
        const current = specs[catKey] as SpecItem[];
        const updated = current.map((item, i) =>
          i === idx ? { ...item, [field]: val } : item
        );
        setProjectSpecs({ ...specs, [catKey]: updated });
      },
    [specs, setProjectSpecs]
  );

  const handleItemRemove = useCallback(
    (catKey: keyof Omit<ProjectSpecs, "amenities" | "amenitiesAr">) =>
      (idx: number) => {
        const current = specs[catKey] as SpecItem[];
        setProjectSpecs({ ...specs, [catKey]: current.filter((_, i) => i !== idx) });
      },
    [specs, setProjectSpecs]
  );

  const handleItemAdd = useCallback(
    (catKey: keyof Omit<ProjectSpecs, "amenities" | "amenitiesAr">) => () => {
      const current = specs[catKey] as SpecItem[];
      setProjectSpecs({
        ...specs,
        [catKey]: [...current, { label: "", labelAr: "", value: "", valueAr: "" }],
      });
    },
    [specs, setProjectSpecs]
  );

  const handleAmenitiesChange = useCallback(
    (en: string[], ar: string[]) => {
      setProjectSpecs({ ...specs, amenities: en, amenitiesAr: ar });
    },
    [specs, setProjectSpecs]
  );

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      {/* Panel header */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-100 rounded-t-xl transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {t("finishings")}
          </h2>
          <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide">
            Admin
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${panelOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {panelOpen && (
        <div className="px-3 pt-3 pb-4">
          <p className="text-[10px] text-stone-400 mb-3 px-1">
            Edit finishings & specs displayed to customers and investors. Changes auto-save to session.
          </p>

          {/* Category sections */}
          {CATEGORIES.map((cat) => (
            <CategorySection
              key={cat.key}
              catKey={cat.key}
              icon={cat.icon}
              titleEn={cat.tkEn}
              items={specs[cat.key] as SpecItem[]}
              onItemChange={handleItemChange(cat.key)}
              onItemRemove={handleItemRemove(cat.key)}
              onItemAdd={handleItemAdd(cat.key)}
            />
          ))}

          {/* Amenities */}
          <AmenitiesSection
            amenities={specs.amenities}
            amenitiesAr={specs.amenitiesAr}
            onChange={handleAmenitiesChange}
          />

          {/* Save confirmation button */}
          <button
            onClick={handleSave}
            className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-all ${
              saved
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-dh-green text-white hover:bg-dh-green/90"
            }`}
          >
            {saved ? "✓ Saved to session" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
