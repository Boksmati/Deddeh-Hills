"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { LOT_POLYGONS, SVG_VIEWBOX } from "@/data/lot-polygons";
import { DEVELOPMENT_TYPES } from "@/data/development-types";
import { LotAssignment, LotStatus, LotGroup } from "@/types";

// Stroke color indicates availability status (fill = dev type color)
const STATUS_STROKE: Record<LotStatus, string> = {
  available:      "white",
  reserved:       "#f59e0b",
  under_contract: "#f97316",
  sold:           "#ef4444",
};
const STATUS_STROKE_WIDTH: Record<LotStatus, number> = {
  available:      1.5,
  reserved:       2.5,
  under_contract: 2.5,
  sold:           2.5,
};
const STATUS_OPACITY: Record<LotStatus, number> = {
  available:      1,
  reserved:       0.9,
  under_contract: 0.85,
  sold:           0.5,
};

// Human-readable labels for each dev type (customer-facing)
const DEV_TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  villa_2f:   { en: "Standalone Villa",      ar: "فيلا مستقلة"       },
  villa_3f:   { en: "Luxury Villa",          ar: "فيلا فاخرة"         },
  twin_villa: { en: "Twin Villa",            ar: "فيلا توأم"          },
  apartments: { en: "Apartments & Duplexes", ar: "شقق ودوبلكس"        },
  lot_sale:   { en: "Lot Sale",              ar: "بيع قطعة"           },
};

interface Props {
  filteredLotIds: Set<number>;
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, LotStatus>;
  onSelectLot: (lotId: number) => void;
  selectedLotId: number | null;
  lang: string;
  compact?: boolean;
  lotGroups?: LotGroup[];
}

// Pre-build a centroid lookup for fast access
const CENTROID_MAP = new Map(LOT_POLYGONS.map((p) => [p.id, p.center]));

export default function CustomerMap({
  filteredLotIds,
  assignments,
  lotStatuses,
  onSelectLot,
  selectedLotId,
  lang,
  compact = false,
  lotGroups = [],
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
      className="relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 select-none transition-all duration-300"
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

        {/* Group connectors — dashed lines between grouped lot centroids */}
        {mounted && lotGroups.map((group) => {
          const centers = group.lotIds
            .map((id) => CENTROID_MAP.get(id))
            .filter((c): c is [number, number] => c !== undefined);
          if (centers.length < 2) return null;
          return (
            <g key={group.id} pointerEvents="none">
              {centers.slice(0, -1).map((c, i) => {
                const next = centers[i + 1];
                return (
                  <line
                    key={i}
                    x1={c[0]} y1={c[1]}
                    x2={next[0]} y2={next[1]}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    strokeOpacity={0.85}
                  />
                );
              })}
              {/* Group badge at midpoint of first pair */}
              {(() => {
                const mx = (centers[0][0] + centers[centers.length - 1][0]) / 2;
                const my = (centers[0][1] + centers[centers.length - 1][1]) / 2;
                return (
                  <g>
                    <circle cx={mx} cy={my} r={7} fill="white" fillOpacity={0.9} />
                    <text
                      x={mx} y={my}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize="7"
                      fontWeight="700"
                      fill="#059669"
                      pointerEvents="none"
                    >
                      G
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Lot dots — client-only to avoid hydration mismatch */}
        {mounted && LOT_POLYGONS.map((polygon) => {
          const assignment = assignments.get(polygon.id);
          if (!assignment || assignment.developmentType === "unassigned") return null;

          const status: LotStatus = lotStatuses.get(polygon.id) ?? "available";
          // Fill = dev type colour; stroke = status indicator
          const fill = DEVELOPMENT_TYPES[assignment.developmentType]?.color ?? "#9CA3AF";
          const strokeColor = STATUS_STROKE[status];
          const strokeWidth = STATUS_STROKE_WIDTH[status];
          const dotOpacity = STATUS_OPACITY[status];
          const [cx, cy] = polygon.center;
          const inFilter = filteredLotIds.has(polygon.id);
          const isSelected = selectedLotId === polygon.id;
          const isHovered = hoveredId === polygon.id;
          const r = isSelected ? 15 : isHovered ? 13 : 11;

          return (
            <g
              key={polygon.id}
              opacity={inFilter ? dotOpacity : 0.15}
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
              {/* Main dot — fill = dev type colour */}
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={strokeColor} strokeWidth={strokeWidth} />
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

      {/* Legend — dev type colours */}
      <div className="absolute bottom-4 start-4 bg-white/90 backdrop-blur-sm rounded-xl p-2.5 shadow-md z-10">
        {Object.entries(DEV_TYPE_LABELS).map(([key, label]) => {
          const color = DEVELOPMENT_TYPES[key]?.color ?? "#9CA3AF";
          return (
            <div key={key} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-stone-600">
                {lang === "ar" ? label.ar : label.en}
              </span>
            </div>
          );
        })}
        {/* Status stroke key */}
        <div className="mt-1.5 pt-1.5 border-t border-stone-200 space-y-1">
          {([
            { status: "reserved",       color: "#f59e0b", en: "Reserved",       ar: "محجوز"       },
            { status: "under_contract", color: "#f97316", en: "Under Contract",  ar: "تحت العقد"   },
            { status: "sold",           color: "#ef4444", en: "Sold",            ar: "مباع"        },
          ] as const).map((s) => (
            <div key={s.status} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: "#d6d3d1", outline: `2px solid ${s.color}`, outlineOffset: "1px" }} />
              <span className="text-[10px] text-stone-500">{lang === "ar" ? s.ar : s.en}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hint pill */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-700/70 text-white text-[10px] px-3 py-1 rounded-full z-10 pointer-events-none backdrop-blur-sm">
        {lang === "ar"
          ? "قم بالتمرير للتكبير · اسحب للتنقل · انقر على قطعة للتفاصيل"
          : "Scroll to zoom · Drag to pan · Click a lot for details"}
      </div>

      {/* Hover tooltip */}
      {hoveredId && (() => {
        const assignment = assignments.get(hoveredId);
        const devCfg = assignment ? DEVELOPMENT_TYPES[assignment.developmentType] : null;
        const fill = devCfg?.color ?? "#9CA3AF";
        const label = assignment ? DEV_TYPE_LABELS[assignment.developmentType] : null;
        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{ left: tooltipScreen.x + 14, top: tooltipScreen.y - 36 }}
          >
            <div className="bg-stone-900 text-white text-[11px] px-3 py-2 rounded-xl shadow-xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: fill }} />
              <div>
                <div className="font-bold">{lang === "ar" ? "قطعة" : "Lot"} {hoveredId}</div>
                {label && <div className="text-stone-300">{lang === "ar" ? label.ar : label.en}</div>}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
