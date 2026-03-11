"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_LAYER_PARAMS,
  calculateLayer1,
  calculateLayer2,
  calculateCombined,
  generateLayer1Tickets,
  generateLayer2Tickets,
  layer1SensitivityMatrix,
  layer2SensitivityMatrix,
  type LayerParams,
  type Layer1Metrics,
  type Layer2Metrics,
  type CombinedMetrics,
  type TicketOption,
  type VillaTicket,
} from "@/lib/investment-layers";

interface UseInvestmentLayersReturn {
  params: LayerParams;
  layer1: Layer1Metrics;
  layer2: Layer2Metrics;
  combined: CombinedMetrics;
  layer1Tickets: TicketOption[];
  layer2Tickets: VillaTicket[];
  l1Matrix: ReturnType<typeof layer1SensitivityMatrix>;
  l2Matrix: ReturnType<typeof layer2SensitivityMatrix>;
  setParams: (patch: Partial<LayerParams>) => void;
  saveParams: () => Promise<void>;
  loading: boolean;
}

export function useInvestmentLayers(): UseInvestmentLayersReturn {
  const [params, setParamsState] = useState<LayerParams>(DEFAULT_LAYER_PARAMS);
  const [loading, setLoading] = useState(true);

  // Fetch layer config from API on mount
  useEffect(() => {
    fetch("/api/investment/layers")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          // Strip metadata key before applying
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _updated, ...rest } = data as LayerParams & { _updated?: string };
          setParamsState((prev) => ({ ...prev, ...rest }));
        }
      })
      .catch(() => {/* use defaults on network error */})
      .finally(() => setLoading(false));
  }, []);

  const setParams = useCallback((patch: Partial<LayerParams>) => {
    setParamsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const saveParams = useCallback(async () => {
    await fetch("/api/investment/layers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }, [params]);

  // Derived calculations (memo-like: recomputed on every params change)
  const layer1 = calculateLayer1(params);
  const layer2 = calculateLayer2(params);
  const combined = calculateCombined(params);
  const layer1Tickets = generateLayer1Tickets(params);
  const layer2Tickets = generateLayer2Tickets(params);
  const l1Matrix = layer1SensitivityMatrix(params);
  const l2Matrix = layer2SensitivityMatrix(params);

  return {
    params,
    layer1,
    layer2,
    combined,
    layer1Tickets,
    layer2Tickets,
    l1Matrix,
    l2Matrix,
    setParams,
    saveParams,
    loading,
  };
}
