"use client";

import { memo, useState, useCallback, useContext } from "react";
import { LotPolygon as LotPolygonType } from "@/data/lot-polygons";
import { useSimulationStore } from "@/store/simulation-store";
import { DEVELOPMENT_TYPES, PHASE_COLORS } from "@/data/development-types";
import { LOTS } from "@/data/lots";
import { SvgRefContext, screenToSVG } from "./MasterPlanSVG";

interface Props {
  polygon: LotPolygonType;
}

function LotPolygonComponent({ polygon }: Props) {
  const assignment = useSimulationStore((s) => s.assignments.get(polygon.id));
  const selectedLotIds = useSimulationStore((s) => s.selectedLotIds);
  const selectLot = useSimulationStore((s) => s.selectLot);
  const mapColorMode = useSimulationStore((s) => s.mapColorMode);
  const calibrationMode = useSimulationStore((s) => s.calibrationMode);
  const lotStatus = useSimulationStore((s) => s.lotStatuses.get(polygon.id) ?? "available");
  const isSold = lotStatus === "sold";
  const centerOverride = useSimulationStore((s) => s.lotCenterOverrides.get(polygon.id));
  const setLotCenterOverride = useSimulationStore((s) => s.setLotCenterOverride);
  const lot = LOTS.find((l) => l.id === polygon.id);
  const [isHovered, setIsHovered] = useState(false);

  // Drag state for calibration
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<[number, number] | null>(null);

  const svgRefObj = useContext(SvgRefContext);

  const isSelected = selectedLotIds.has(polygon.id);
  const devType = assignment?.developmentType ?? "unassigned";
  const phase = assignment?.phase ?? 0;
  const isAssigned = devType !== "unassigned";

  // Use override center if available, else polygon default
  const baseCenter = centerOverride ?? polygon.center;
  const [cx, cy] = isDragging && dragPos ? dragPos : baseCenter;

  // Circle color based on assignment + color mode
  let circleColor = "#9CA3AF"; // neutral gray for unassigned
  if (isAssigned) {
    if (mapColorMode === "type") {
      circleColor = DEVELOPMENT_TYPES[devType]?.color ?? "#9CA3AF";
    } else if (mapColorMode === "phase") {
      circleColor = PHASE_COLORS[phase] ?? "#9CA3AF";
    } else if (mapColorMode === "price" && lot) {
      const minPrice = 250;
      const maxPrice = 450;
      const t = (lot.zone_price_retail - minPrice) / (maxPrice - minPrice);
      const r = Math.round(255 * (1 - t));
      const g = Math.round(180 + 75 * t);
      const b = Math.round(100 * t);
      circleColor = `rgb(${r},${g},${b})`;
    } else if (mapColorMode === "area" && lot) {
      const minArea = 1097;
      const maxArea = 2255;
      const t = (lot.area_sqm - minArea) / (maxArea - minArea);
      const r = Math.round(59 + 196 * t);
      const g = Math.round(130 - 30 * t);
      const b = Math.round(246 - 146 * t);
      circleColor = `rgb(${r},${g},${b})`;
    }
  }

  // Status overrides all colors
  const STATUS_COLORS = { available: null, reserved: "#F59E0B", under_contract: "#F97316", sold: "#EF4444" };
  const statusOverride = STATUS_COLORS[lotStatus];
  const effectiveColor = statusOverride ?? circleColor;
  const circleOpacity = 1;
  const radius = calibrationMode ? 12 : isSelected ? 14 : isHovered ? 13 : 11;
  const hasStatusOverride = lotStatus !== "available";
  const textColor = hasStatusOverride || isAssigned || isSelected ? "#fff" : "#333";
  const selectedCircleColor = hasStatusOverride ? effectiveColor : isSelected && !isAssigned ? "#2D5A27" : effectiveColor;
  const hitRadius = 16;

  // Calibration drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!calibrationMode) return;
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);

      const svgEl = svgRefObj?.current;
      if (!svgEl) return;

      const onMove = (moveEvent: MouseEvent) => {
        const [sx, sy] = screenToSVG(svgEl, moveEvent.clientX, moveEvent.clientY);
        setDragPos([sx, sy]);
      };

      const onUp = (upEvent: MouseEvent) => {
        const [sx, sy] = screenToSVG(svgEl, upEvent.clientX, upEvent.clientY);
        setLotCenterOverride(polygon.id, [sx, sy]);
        setIsDragging(false);
        setDragPos(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [calibrationMode, svgRefObj, polygon.id, setLotCenterOverride]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (calibrationMode) return; // no selection during calibration
      selectLot(polygon.id, e.shiftKey || e.metaKey);
    },
    [calibrationMode, selectLot, polygon.id]
  );

  return (
    <g
      onClick={handleClick}
      onMouseDown={calibrationMode ? handleDragStart : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: calibrationMode ? (isDragging ? "grabbing" : "grab") : "pointer" }}
    >
      {/* Invisible circle hit area */}
      <circle
        cx={cx}
        cy={cy}
        r={hitRadius}
        fill="transparent"
        stroke="none"
      />

      {/* Selected ring */}
      {isSelected && !calibrationMode && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 3}
          fill="none"
          stroke="#2D5A27"
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      )}

      {/* Calibration ring */}
      {calibrationMode && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 3}
          fill="none"
          stroke="#D97706"
          strokeWidth={1.5}
          strokeDasharray="3 2"
          opacity={isDragging ? 1 : 0.6}
        />
      )}

      {/* Status ring (reserved / under_contract / sold) */}
      {hasStatusOverride && !calibrationMode && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + 3}
          fill="none"
          stroke={effectiveColor}
          strokeWidth={2}
        />
      )}

      {/* Colored circle halo */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={calibrationMode ? "#D97706" : selectedCircleColor}
        fillOpacity={calibrationMode ? (isDragging ? 0.9 : 0.7) : circleOpacity}
        stroke={calibrationMode ? "#fff" : hasStatusOverride || isAssigned || isSelected ? "#fff" : "none"}
        strokeWidth={calibrationMode ? 2 : hasStatusOverride || isAssigned || isSelected ? 1.5 : 0}
      />

      {/* Lot number */}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="8"
        fontWeight="700"
        fill={calibrationMode ? "#fff" : textColor}
        pointerEvents="none"
        className="select-none"
      >
        {polygon.id}
      </text>
    </g>
  );
}

export default memo(LotPolygonComponent);
