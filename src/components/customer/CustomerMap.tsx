"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { LOT_POLYGONS, SVG_VIEWBOX } from "@/data/lot-polygons";
import { DEVELOPMENT_TYPES } from "@/data/development-types";
import { LotAssignment, LotStatus } from "@/types";

const STATUS_FILL: Record<LotStatus, string> = {
  available: "#22c55e",
  reserved: "#f59e0b",
  under_contract: "#f97316",
  sold: "#ef4444",
};

const LEGEND = [
  { status: "available",      color: "#22c55e", label_en: "Available",      label_ar: "متاح"       },
  { status: "reserved",       color: "#f59e0b", label_en: "Reserved",       label_ar: "محجوز"      },
  { status: "under_contract", color: "#f97316", label_en: "Under Contract", label_ar: "تحت العقد"  },
  { status: "sold",           color: "#ef4444", label_en: "Sold",           label_ar: "مباع"        },
];

interface Props {
  filteredLotIds: Set<number>;
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, LotStatus>;
  onSelectLot: (lotId: number) => void;
  selectedLotId: number | null;
  lang: string;
  compact?: boolean;
}

export default function CustomerMap({
  filteredLotIds,
  assignments,
  lotStatuses,
  onSelectLot,
  selectedLotId,
  lang,
  compact = false,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [zoom, setZoom] = useState(1.2);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipScreen, setTooltipScreen] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.88 : 1.14;
    setZoom((z) => Math.max(0.6, Math.min(10, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isPanningRef.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffset.current = { ...pan };
    },
    [pan]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    setPan({
      x: panOffset.current.x + (e.clientX - panStart.current.x),
      y: panOffset.current.y + (e.clientY - panStart.current.y),
    });
  }, []);

  const stopPan = useCallback(() => { isPanningRef.current = false; }, []);

  const resetView = useCallback(() => {
    setZoom(1.2);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-900 select-none transition-all duration-300"
      style={{ height: compact ? "300px" : "580px", cursor: "grab" }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={stopPan}
      onMouseLeave={stopPan}
    >
      {/* SVG canvas */}
      <svg
        viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
        style={{
          width: "100%",
          height: "100%",
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        {/* Master plan background */}
        <image
          href="/master-plan.png"
          x="0"
          y="0"
          width={SVG_VIEWBOX.width}
          height={SVG_VIEWBOX.height}
        />

        {/* Lot dots — client-only to avoid hydration mismatch */}
        {mounted && LOT_POLYGONS.map((polygon) => {
          const assignment = assignments.get(polygon.id);
          if (!assignment || assignment.developmentType === "unassigned") return null;

          const status: LotStatus = lotStatuses.get(polygon.id) ?? "available";
          const fill = STATUS_FILL[status];
          const [cx, cy] = polygon.center;
          const inFilter = filteredLotIds.has(polygon.id);
          const isSelected = selectedLotId === polygon.id;
          const isHovered = hoveredId === polygon.id;
          const r = isSelected ? 15 : isHovered ? 13 : 11;

          return (
            <g
              key={polygon.id}
              opacity={inFilter ? 1 : 0.18}
              onClick={(e) => {
                e.stopPropagation();
                if (inFilter) onSelectLot(polygon.id);
              }}
              onMouseEnter={(e) => {
                setHoveredId(polygon.id);
                setTooltipScreen({ x: e.clientX, y: e.clientY });
              }}
              onMouseMove={(e) => setTooltipScreen({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: inFilter ? "pointer" : "default" }}
            >
              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={cx} cy={cy}
                  r={r + 5}
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
              )}
              {/* Glow for hover */}
              {isHovered && !isSelected && (
                <circle cx={cx} cy={cy} r={r + 4} fill={fill} fillOpacity={0.3} />
              )}
              {/* Main dot */}
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke="white" strokeWidth={1.5} />
              {/* Lot number */}
              <text
                x={cx} y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="7"
                fontWeight="700"
                fill="white"
                pointerEvents="none"
              >
                {polygon.id}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 end-4 flex flex-col gap-1 z-10">
        <button
          onClick={() => setZoom((z) => Math.min(10, z * 1.35))}
          className="w-8 h-8 bg-white/90 shadow-md rounded-lg text-stone-700 font-bold text-lg leading-none hover:bg-white flex items-center justify-center"
        >+</button>
        <button
          onClick={resetView}
          className="w-8 h-8 bg-white/90 shadow-md rounded-lg text-stone-500 text-xs hover:bg-white flex items-center justify-center"
          title="Reset view"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M8 3a5 5 0 100 10A5 5 0 008 3zm0 1.5a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" opacity=".4"/>
            <path d="M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 1a1.5 1.5 0 110 3 1.5 1.5 0 010-3z"/>
          </svg>
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.6, z / 1.35))}
          className="w-8 h-8 bg-white/90 shadow-md rounded-lg text-stone-700 font-bold text-lg leading-none hover:bg-white flex items-center justify-center"
        >−</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 start-4 bg-white/90 backdrop-blur-sm rounded-xl p-2.5 shadow-md z-10">
        {LEGEND.map((item) => (
          <div key={item.status} className="flex items-center gap-2 mb-1 last:mb-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-stone-600">
              {lang === "ar" ? item.label_ar : item.label_en}
            </span>
          </div>
        ))}
      </div>

      {/* Hint pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-3 py-1 rounded-full z-10 pointer-events-none">
        {lang === "ar"
          ? "قم بالتمرير للتكبير · اسحب للتنقل · انقر على قطعة للتفاصيل"
          : "Scroll to zoom · Drag to pan · Click a lot for details"}
      </div>

      {/* Hover tooltip */}
      {hoveredId && (() => {
        const assignment = assignments.get(hoveredId);
        const status = lotStatuses.get(hoveredId) ?? "available";
        const devCfg = assignment ? DEVELOPMENT_TYPES[assignment.developmentType] : null;
        const fill = STATUS_FILL[status];
        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: tooltipScreen.x + 14, top: tooltipScreen.y - 36 }}
          >
            <div className="bg-stone-900 text-white text-[11px] px-3 py-2 rounded-xl shadow-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fill }} />
              <div>
                <div className="font-bold">{lang === "ar" ? "قطعة" : "Lot"} {hoveredId}</div>
                {devCfg && <div className="text-stone-300">{devCfg.label}</div>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
