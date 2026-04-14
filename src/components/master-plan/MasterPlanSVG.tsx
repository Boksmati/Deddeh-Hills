"use client";

import { useState, useRef, useCallback, createContext } from "react";
import { LOT_POLYGONS, SVG_VIEWBOX } from "@/data/lot-polygons";
import LotPolygonComponent from "./LotPolygon";
import { useSimulationStore } from "@/store/simulation-store";

// Context to share SVG element ref with child components (for coordinate conversion)
export const SvgRefContext = createContext<React.RefObject<SVGSVGElement | null> | null>(null);

export function screenToSVG(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number
): [number, number] {
  const pt = svgEl.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return [0, 0];
  const svgPt = pt.matrixTransform(ctm.inverse());
  return [svgPt.x, svgPt.y];
}

// Pre-build a centroid lookup (same as CustomerMap)
const MASTER_CENTROID_MAP = new Map(LOT_POLYGONS.map((p) => [p.id, p.center]));

export default function MasterPlanSVG() {
  const deselectAll = useSimulationStore((s) => s.deselectAll);
  const selectLotsByIds = useSimulationStore((s) => s.selectLotsByIds);
  const calibrationMode = useSimulationStore((s) => s.calibrationMode);
  const lotCenterOverrides = useSimulationStore((s) => s.lotCenterOverrides);
  const lotGroups = useSimulationStore((s) => s.lotGroups);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  // Only middle-click or alt+click pans; regular left-click selects/deselects
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffset = useRef({ x: 0, y: 0 });

  // Lasso state
  const [isLassoing, setIsLassoing] = useState(false);
  const [lassoStart, setLassoStart] = useState<[number, number] | null>(null);
  const [lassoEnd, setLassoEnd] = useState<[number, number] | null>(null);
  const lassoJustEnded = useRef(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.5, Math.min(5, z * delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // In calibration mode, only allow alt+pan
      if (calibrationMode && !(e.button === 1 || (e.button === 0 && e.altKey))) {
        return;
      }

      // Middle-click or alt+click → pan
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanningRef.current = true;
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
        panOffset.current = { ...pan };
        return;
      }

      // Shift+drag on background → lasso select
      if (e.button === 0 && e.shiftKey && !calibrationMode && svgRef.current) {
        const [sx, sy] = screenToSVG(svgRef.current, e.clientX, e.clientY);
        setIsLassoing(true);
        setLassoStart([sx, sy]);
        setLassoEnd([sx, sy]);
        e.preventDefault();
        return;
      }
    },
    [pan, calibrationMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        setPan({
          x: panOffset.current.x + (e.clientX - panStart.current.x) / zoom,
          y: panOffset.current.y + (e.clientY - panStart.current.y) / zoom,
        });
        return;
      }

      if (isLassoing && svgRef.current) {
        const [sx, sy] = screenToSVG(svgRef.current, e.clientX, e.clientY);
        setLassoEnd([sx, sy]);
      }
    },
    [isLassoing, zoom]
  );

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      return;
    }

    if (isLassoing && lassoStart && lassoEnd) {
      // Compute bounding box
      const minX = Math.min(lassoStart[0], lassoEnd[0]);
      const maxX = Math.max(lassoStart[0], lassoEnd[0]);
      const minY = Math.min(lassoStart[1], lassoEnd[1]);
      const maxY = Math.max(lassoStart[1], lassoEnd[1]);

      // Only select if drag was meaningful (> 5 SVG units)
      if (maxX - minX > 5 || maxY - minY > 5) {
        const matchingIds: number[] = [];
        for (const p of LOT_POLYGONS) {
          const override = lotCenterOverrides.get(p.id);
          const [cx, cy] = override ?? p.center;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) {
            matchingIds.push(p.id);
          }
        }
        if (matchingIds.length > 0) {
          selectLotsByIds(matchingIds);
        }
        lassoJustEnded.current = true;
        setTimeout(() => { lassoJustEnded.current = false; }, 50);
      }

      setIsLassoing(false);
      setLassoStart(null);
      setLassoEnd(null);
    }
  }, [isLassoing, lassoStart, lassoEnd, lotCenterOverrides, selectLotsByIds]);

  const handleClick = useCallback(() => {
    if (lassoJustEnded.current) return;
    if (calibrationMode) return;
    deselectAll();
  }, [deselectAll, calibrationMode]);

  // Lasso rectangle geometry
  let lassoRect = null;
  if (isLassoing && lassoStart && lassoEnd) {
    const x = Math.min(lassoStart[0], lassoEnd[0]);
    const y = Math.min(lassoStart[1], lassoEnd[1]);
    const w = Math.abs(lassoEnd[0] - lassoStart[0]);
    const h = Math.abs(lassoEnd[1] - lassoStart[1]);
    lassoRect = { x, y, w, h };
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-xl ${
        calibrationMode ? "bg-amber-50 ring-2 ring-amber-400" : "bg-gray-100"
      }`}
      {/* onWheel zoom disabled — zoom locked at 100% */}
    >
      {/* Calibration mode indicator */}
      {calibrationMode && (
        <div className="absolute top-3 left-3 z-10 bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md">
          CALIBRATION MODE — Drag circles to reposition
        </div>
      )}

      {/* Reset pan button only — zoom locked */}
      <div className="absolute bottom-3 right-3 z-10">
        <button
          onClick={() => setPan({ x: 0, y: 0 })}
          className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
          title="Reset pan"
        >
          R
        </button>
      </div>

      <SvgRefContext.Provider value={svgRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SVG_VIEWBOX.width} ${SVG_VIEWBOX.height}`}
          className="w-full h-full"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: "center center",
            cursor: isPanning
              ? "grabbing"
              : isLassoing
              ? "crosshair"
              : calibrationMode
              ? "default"
              : "default",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
        >
          {/* Background master plan image */}
          <image
            href="/master-plan.png"
            x="0"
            y="0"
            width={SVG_VIEWBOX.width}
            height={SVG_VIEWBOX.height}
            opacity="1"
            preserveAspectRatio="xMidYMid meet"
          />

          {/* Lot polygons */}
          {LOT_POLYGONS.map((polygon) => (
            <LotPolygonComponent key={polygon.id} polygon={polygon} />
          ))}

          {/* Group connectors — dashed lines between grouped lot centroids */}
          {lotGroups.map((group) => {
            const centers = group.lotIds
              .map((id) => {
                const ov = lotCenterOverrides.get(id);
                if (ov) return [ov[0], ov[1]] as [number, number];
                return MASTER_CENTROID_MAP.get(id) ?? null;
              })
              .filter((c): c is [number, number] => c !== null);
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
                      stroke="white"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.9}
                    />
                  );
                })}
                {/* Group badge at midpoint */}
                {(() => {
                  const mx = centers.reduce((s, c) => s + c[0], 0) / centers.length;
                  const my = centers.reduce((s, c) => s + c[1], 0) / centers.length;
                  return (
                    <g>
                      <circle cx={mx} cy={my} r={9} fill="#059669" fillOpacity={0.9} />
                      <text
                        x={mx} y={my}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize="8"
                        fontWeight="800"
                        fill="white"
                      >
                        G
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          })}

          {/* Lasso selection rectangle */}
          {lassoRect && (
            <rect
              x={lassoRect.x}
              y={lassoRect.y}
              width={lassoRect.w}
              height={lassoRect.h}
              fill="rgba(45, 90, 39, 0.1)"
              stroke="#2D5A27"
              strokeWidth={1}
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}

          {/* Title */}
          <text
            x="50"
            y="30"
            fontSize="18"
            fontWeight="700"
            fill="#2D5A27"
            className="select-none"
          >
            DEDDEH HILLS
          </text>
          <text
            x="50"
            y="48"
            fontSize="10"
            fill="#666"
            className="select-none"
          >
            Koura, Lebanon — Master Plan
          </text>
        </svg>
      </SvgRefContext.Provider>
    </div>
  );
}
