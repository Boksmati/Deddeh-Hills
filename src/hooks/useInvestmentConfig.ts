"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type InvestmentConfig,
  type WaterfallResult,
  type L1ExitOption,
  type L1Returns,
  DEFAULT_INVESTMENT_CONFIG,
  computeWaterfall,
  computeL1Returns,
  computeL1ExitOptions,
  computeCashSufficiency,
  computePhasedLandPricing,
} from "@/lib/investment-layers";

export type { WaterfallResult, L1ExitOption, L1Returns };

export interface PhasedPricingEntry {
  phase: number;
  landPrice: number;
  villaProfit: number;
  investorROI: number;
  /** ADMIN-ONLY — do not render on investor pages */
  ownerTake: number;
}

export interface CashSufficiency {
  noSales: number[];
  buildAndSell: number[];
  build5Stop: number[];
}

export interface UseInvestmentConfigReturn {
  config: InvestmentConfig;
  waterfall: WaterfallResult;
  l1Returns: L1Returns;
  l1ExitOptions: L1ExitOption[];
  phasedPricing: PhasedPricingEntry[];
  cashSufficiency: CashSufficiency;
  isLoading: boolean;
  setConfig: (update: Partial<InvestmentConfig>) => void;
  saveConfig: () => Promise<void>;
}

export function useInvestmentConfig(): UseInvestmentConfigReturn {
  const [config, setConfigState] = useState<InvestmentConfig>(DEFAULT_INVESTMENT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/investment/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: InvestmentConfig | null) => {
        if (data) setConfigState(data);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setConfig = useCallback((update: Partial<InvestmentConfig>) => {
    setConfigState((prev) => ({ ...prev, ...update }));
  }, []);

  const saveConfig = useCallback(async () => {
    await fetch("/api/investment/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  }, [config]);

  // Derive all computed values reactively from config
  const waterfall = computeWaterfall(config, 0);
  const l1Returns = computeL1Returns(config);
  const l1ExitOptions = computeL1ExitOptions(config);
  const phasedPricing = computePhasedLandPricing(config);
  const cashSufficiency = computeCashSufficiency(config);

  return {
    config,
    waterfall,
    l1Returns,
    l1ExitOptions,
    phasedPricing,
    cashSufficiency,
    isLoading,
    setConfig,
    saveConfig,
  };
}
