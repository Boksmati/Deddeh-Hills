import { create } from "zustand";
import {
  DevelopmentType,
  Phase,
  LotAssignment,
  LotGroup,
  ViewMode,
  MapColorMode,
  Scenario,
  TypeAssumption,
  InvestorModel,
  LotStatus,
} from "@/types";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES } from "@/data/development-types";
import { ProjectSpecs, DEFAULT_PROJECT_SPECS } from "@/data/project-specs";

interface SimulationState {
  // Lot assignments
  assignments: Map<number, LotAssignment>;

  // Selection
  selectedLotIds: Set<number>;

  // View state
  viewMode: ViewMode;
  mapColorMode: MapColorMode;
  investorSharePct: number;

  // Scenarios
  scenarios: Scenario[];
  activeScenarioId: string | null;

  // Lot statuses
  lotStatuses: Map<number, LotStatus>;

  // Assumptions (editable per development type)
  typeAssumptions: Record<DevelopmentType, TypeAssumption>;

  // Investor model
  investorModel: InvestorModel;
  landSharePct: number;
  cashToStartPct: number;
  priorityReturnRate: number;
  holdPeriodYears: number;
  ticketSize: number;
  investorTickets: Record<1 | 2 | 3, number>;

  // Project Specs (finishings, amenities — editable by admin, display-only for customer/investor)
  projectSpecs: ProjectSpecs;

  // Calibration
  calibrationMode: boolean;
  lotCenterOverrides: Map<number, [number, number]>;

  // Lot groups
  lotGroups: LotGroup[];

  // Actions — Assignment
  setDevelopmentType: (lotIds: number[], type: DevelopmentType) => void;
  setPhase: (lotIds: number[], phase: Phase) => void;

  // Actions — Lot Groups
  addLotGroup: (lotIds: number[]) => string;
  removeLotGroup: (groupId: string) => void;
  setGroupDevType: (groupId: string, type: DevelopmentType) => void;
  setGroupPhase: (groupId: string, phase: Phase) => void;
  setGroupCustomUnits: (groupId: string, units: number | undefined) => void;
  setGroupLabel: (groupId: string, label: string) => void;
  getGroupForLot: (lotId: number) => LotGroup | undefined;

  // Actions — Selection
  selectLot: (lotId: number, multi?: boolean) => void;
  selectLotsByIds: (lotIds: number[]) => void;
  selectLotsByPhase: (phase: Phase) => void;
  selectLotsByType: (type: DevelopmentType) => void;
  selectAll: () => void;
  deselectAll: () => void;

  // Actions — View
  setViewMode: (mode: ViewMode) => void;
  setMapColorMode: (mode: MapColorMode) => void;
  setInvestorSharePct: (pct: number) => void;

  // Actions — Scenarios
  saveScenario: (name: string) => Promise<void>;
  loadScenario: (id: string) => void;
  deleteScenario: (id: string) => Promise<void>;
  loadScenariosFromServer: () => Promise<void>;
  getAssignment: (lotId: number) => LotAssignment;

  // Actions — Server sync
  initStateFromServer: () => Promise<void>;
  getAssignmentsArray: () => LotAssignment[];
  resetAll: () => void;

  // Actions — Assumptions
  setTypeAssumption: (type: DevelopmentType, field: keyof TypeAssumption, value: number) => void;
  resetTypeAssumptions: () => void;

  // Actions — Lot Status
  setLotStatus: (lotIds: number[], status: LotStatus) => void;
  /** @deprecated Use setLotStatus instead */
  toggleLotSold: (lotIds: number[]) => void;

  // Actions — Investor model
  setInvestorModel: (model: InvestorModel) => void;
  setLandSharePct: (pct: number) => void;
  setCashToStartPct: (pct: number) => void;
  setPriorityReturnRate: (rate: number) => void;
  setHoldPeriodYears: (years: number) => void;
  setTicketSize: (size: number) => void;
  setInvestorTickets: (tickets: Record<1 | 2 | 3, number>) => void;

  // Phase revenue targets (admin-set, shown on /status alongside projection)
  phaseRevenueTargets: { 1: number; 2: number; 3: number };

  // Actions — Project Specs
  setProjectSpecs: (specs: ProjectSpecs) => void;

  // Actions — Phase Revenue Targets
  setPhaseRevenueTarget: (phase: 1 | 2 | 3, target: number) => void;

  // Actions — Calibration
  initCenterOverrides: () => Promise<void>;
  toggleCalibrationMode: () => void;
  setLotCenterOverride: (lotId: number, center: [number, number]) => void;
  resetCenterOverrides: () => void;

  // Investor view feature flags (admin-controlled)
  investorFeatureFlags: {
    showModelB: boolean;
    showSensitivity: boolean;
    showTermSheet: boolean;
    showPhasedPricing: boolean;
    showPhaseBreakdown: boolean;
    showL1ExitMechanisms: boolean;
    showCashFlowHorizon: boolean;
  };
  setInvestorFeatureFlag: (key: keyof SimulationState["investorFeatureFlags"], val: boolean) => void;
}

const DEFAULT_MAX_FLOORS: Record<DevelopmentType, number> = {
  unassigned: 0,
  lot_sale: 0,
  twin_villa: 2,
  villa_2f: 2,
  villa_3f: 3,
  apartments: 3,
};

const DEFAULT_UNITS_PER_LOT: Record<DevelopmentType, number> = {
  unassigned: 0,
  lot_sale: 0,
  twin_villa: 0, // auto-derive from avg lot BUA ÷ avgUnitSize
  villa_2f: 0,
  villa_3f: 0,
  apartments: 0,
};

const DEFAULT_GARDEN_AREA: Record<DevelopmentType, number> = {
  unassigned: 0,
  lot_sale: 0,
  twin_villa: 150,
  villa_2f: 390,
  villa_3f: 260,
  apartments: 100,
};

function createDefaultTypeAssumptions(): Record<DevelopmentType, TypeAssumption> {
  const result = {} as Record<DevelopmentType, TypeAssumption>;
  for (const [key, cfg] of Object.entries(DEVELOPMENT_TYPES)) {
    const dt = key as DevelopmentType;
    result[dt] = {
      constructionCostPerM: cfg.constructionCostPerM,
      sellingPricePerM: cfg.sellingPricePerM,
      avgUnitSize: cfg.avgUnitSize,
      commonAreaPct: cfg.commonAreaPct,
      maxFloors: DEFAULT_MAX_FLOORS[dt],
      unitsPerLot: DEFAULT_UNITS_PER_LOT[dt],
      gardenAreaM: DEFAULT_GARDEN_AREA[dt],
    };
  }
  return result;
}

const LS_ASSIGNMENTS_KEY = "dh-assignments";
const LS_SOLD_KEY = "dh-sold-lots"; // legacy key for migration
const LS_LOT_STATUSES_KEY = "dh-lot-statuses";
const LS_INVESTOR_PCT_KEY = "dh-investor-pct";
const LS_ASSUMPTIONS_KEY = "dh-type-assumptions";
const LS_INVESTOR_MODEL_KEY = "dh-investor-model";
const LS_PROJECT_SPECS_KEY = "dh-project-specs";
const LS_PHASE_TARGETS_KEY = "dh-phase-targets";
const LS_LOT_GROUPS_KEY = "dh-lot-groups";
const LS_INVESTOR_FLAGS_KEY = "dh-investor-flags";

type InvestorFeatureFlags = SimulationState["investorFeatureFlags"];

const DEFAULT_INVESTOR_FLAGS: InvestorFeatureFlags = {
  showModelB: false,
  showSensitivity: true,
  showTermSheet: true,
  showPhasedPricing: true,
  showPhaseBreakdown: false,
  showL1ExitMechanisms: false,
  showCashFlowHorizon: false,
};

function loadInvestorFlags(): InvestorFeatureFlags {
  if (typeof window === "undefined") return DEFAULT_INVESTOR_FLAGS;
  try {
    const str = localStorage.getItem(LS_INVESTOR_FLAGS_KEY);
    if (!str) return DEFAULT_INVESTOR_FLAGS;
    return { ...DEFAULT_INVESTOR_FLAGS, ...JSON.parse(str) };
  } catch {
    return DEFAULT_INVESTOR_FLAGS;
  }
}

function saveInvestorFlags(flags: InvestorFeatureFlags) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_INVESTOR_FLAGS_KEY, JSON.stringify(flags));
  } catch { /* ignore */ }
}

const DEFAULT_PHASE_TARGETS: { 1: number; 2: number; 3: number } = { 1: 0, 2: 0, 3: 0 };

function loadPhaseTargets(): { 1: number; 2: number; 3: number } {
  if (typeof window === "undefined") return DEFAULT_PHASE_TARGETS;
  try {
    const str = localStorage.getItem(LS_PHASE_TARGETS_KEY);
    if (!str) return DEFAULT_PHASE_TARGETS;
    return { ...DEFAULT_PHASE_TARGETS, ...JSON.parse(str) };
  } catch {
    return DEFAULT_PHASE_TARGETS;
  }
}

function savePhaseTargets(targets: { 1: number; 2: number; 3: number }) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS_PHASE_TARGETS_KEY, JSON.stringify(targets)); } catch { /* ignore */ }
}

const DEFAULT_INVESTOR_MODEL_STATE = {
  investorModel: "share" as InvestorModel,
  landSharePct: 20,
  cashToStartPct: 30,
  priorityReturnRate: 12,
  holdPeriodYears: 3,
  ticketSize: 300000,
  investorTickets: { 1: 0, 2: 0, 3: 0 } as Record<1 | 2 | 3, number>,
};

function loadInvestorModel() {
  if (typeof window === "undefined") return DEFAULT_INVESTOR_MODEL_STATE;
  try {
    const str = localStorage.getItem(LS_INVESTOR_MODEL_KEY);
    if (!str) return DEFAULT_INVESTOR_MODEL_STATE;
    const stored = JSON.parse(str);
    return { ...DEFAULT_INVESTOR_MODEL_STATE, ...stored };
  } catch {
    return DEFAULT_INVESTOR_MODEL_STATE;
  }
}

function saveInvestorModel(state: typeof DEFAULT_INVESTOR_MODEL_STATE) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_INVESTOR_MODEL_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function loadFromLocalStorage(): {
  assignments: Map<number, LotAssignment>;
  lotStatuses: Map<number, LotStatus>;
  investorSharePct: number;
  typeAssumptions: Record<DevelopmentType, TypeAssumption>;
} {
  const defaults = createDefaultAssignments();
  const defaultAssumptions = createDefaultTypeAssumptions();
  if (typeof window === "undefined") {
    return { assignments: defaults, lotStatuses: new Map(), investorSharePct: 20, typeAssumptions: defaultAssumptions };
  }
  try {
    const assignStr = localStorage.getItem(LS_ASSIGNMENTS_KEY);
    let assignments = defaults;
    if (assignStr) {
      const arr: LotAssignment[] = JSON.parse(assignStr);
      assignments = new Map(arr.map((a) => [a.lotId, a]));
    }

    // Load lot statuses — migrate from legacy sold-lots key if needed
    let lotStatuses = new Map<number, LotStatus>();
    const statusStr = localStorage.getItem(LS_LOT_STATUSES_KEY);
    if (statusStr) {
      const arr: [number, LotStatus][] = JSON.parse(statusStr);
      lotStatuses = new Map(arr);
    } else {
      // Migrate from legacy soldLotIds
      const soldStr = localStorage.getItem(LS_SOLD_KEY);
      if (soldStr) {
        const soldIds: number[] = JSON.parse(soldStr);
        soldIds.forEach((id) => lotStatuses.set(id, "sold"));
      }
    }

    const pctStr = localStorage.getItem(LS_INVESTOR_PCT_KEY);
    const investorSharePct = pctStr ? Number(pctStr) : 20;

    const assumptionsStr = localStorage.getItem(LS_ASSUMPTIONS_KEY);
    let typeAssumptions = defaultAssumptions;
    if (assumptionsStr) {
      const stored: Partial<Record<DevelopmentType, Partial<TypeAssumption>>> = JSON.parse(assumptionsStr);
      typeAssumptions = {} as Record<DevelopmentType, TypeAssumption>;
      for (const [type, defaultVal] of Object.entries(defaultAssumptions)) {
        const dt = type as DevelopmentType;
        typeAssumptions[dt] = { ...defaultVal, ...(stored[dt] ?? {}) };
      }
    }

    return { assignments, lotStatuses, investorSharePct, typeAssumptions };
  } catch {
    return { assignments: defaults, lotStatuses: new Map(), investorSharePct: 20, typeAssumptions: defaultAssumptions };
  }
}

function saveAssignments(assignments: Map<number, LotAssignment>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_ASSIGNMENTS_KEY, JSON.stringify(Array.from(assignments.values())));
  } catch { /* ignore */ }
}

function saveLotStatuses(lotStatuses: Map<number, LotStatus>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_LOT_STATUSES_KEY, JSON.stringify(Array.from(lotStatuses.entries())));
  } catch { /* ignore */ }
}

function saveInvestorPct(pct: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_INVESTOR_PCT_KEY, String(pct));
  } catch { /* ignore */ }
}

function saveTypeAssumptions(assumptions: Record<DevelopmentType, TypeAssumption>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_ASSUMPTIONS_KEY, JSON.stringify(assumptions));
  } catch { /* ignore */ }
}

function loadProjectSpecs(): ProjectSpecs | null {
  if (typeof window === "undefined") return null;
  try {
    const str = localStorage.getItem(LS_PROJECT_SPECS_KEY);
    if (!str) return null;
    return JSON.parse(str) as ProjectSpecs;
  } catch {
    return null;
  }
}

function saveProjectSpecs(specs: ProjectSpecs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PROJECT_SPECS_KEY, JSON.stringify(specs));
  } catch { /* ignore */ }
}

function loadLotGroups(): LotGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const str = localStorage.getItem(LS_LOT_GROUPS_KEY);
    if (!str) return [];
    return JSON.parse(str) as LotGroup[];
  } catch {
    return [];
  }
}

function saveLotGroups(groups: LotGroup[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_LOT_GROUPS_KEY, JSON.stringify(groups));
  } catch { /* ignore */ }
}

function createDefaultAssignments(): Map<number, LotAssignment> {
  const map = new Map<number, LotAssignment>();
  for (const lot of LOTS) {
    map.set(lot.id, {
      lotId: lot.id,
      developmentType: "unassigned",
      phase: 0,
    });
  }
  return map;
}

function parseOverridesResponse(parsed: Record<string, [number, number]>): Map<number, [number, number]> {
  const map = new Map<number, [number, number]>();
  for (const [key, val] of Object.entries(parsed)) {
    const id = Number(key);
    if (!isNaN(id) && Array.isArray(val) && val.length === 2) {
      map.set(id, val as [number, number]);
    }
  }
  return map;
}

// ── Server Sync Helpers ───────────────────────────────────────────────────────

interface PersistedServerState {
  assignments: LotAssignment[];
  lotStatuses: [number, LotStatus][];
  investorSharePct: number;
  typeAssumptions: Record<DevelopmentType, TypeAssumption>;
  investorModel: typeof DEFAULT_INVESTOR_MODEL_STATE;
  projectSpecs?: ProjectSpecs;
  phaseRevenueTargets?: { 1: number; 2: number; 3: number };
  lotGroups?: LotGroup[];
  investorFeatureFlags?: SimulationState["investorFeatureFlags"];
}

function buildServerState(s: SimulationState): PersistedServerState {
  return {
    assignments: Array.from(s.assignments.values()),
    lotStatuses: Array.from(s.lotStatuses.entries()),
    investorSharePct: s.investorSharePct,
    typeAssumptions: s.typeAssumptions,
    investorModel: {
      investorModel: s.investorModel,
      landSharePct: s.landSharePct,
      cashToStartPct: s.cashToStartPct,
      priorityReturnRate: s.priorityReturnRate,
      holdPeriodYears: s.holdPeriodYears,
      ticketSize: s.ticketSize,
      investorTickets: s.investorTickets,
    },
    projectSpecs: s.projectSpecs,
    phaseRevenueTargets: s.phaseRevenueTargets,
    lotGroups: s.lotGroups,
    investorFeatureFlags: s.investorFeatureFlags,
  };
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function queueServerSave(state: PersistedServerState) {
  if (typeof window === "undefined") return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => { /* ignore */ });
  }, 600);
}

async function fetchCenterOverrides(): Promise<Map<number, [number, number]>> {
  try {
    const res = await fetch("/api/calibration");
    if (!res.ok) return new Map();
    const parsed = await res.json();
    return parseOverridesResponse(parsed);
  } catch {
    return new Map();
  }
}

async function persistCenterOverrides(overrides: Map<number, [number, number]>) {
  try {
    const obj: Record<string, [number, number]> = {};
    for (const [id, center] of Array.from(overrides.entries())) {
      obj[String(id)] = center;
    }
    await fetch("/api/calibration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(obj),
    });
  } catch {
    // silently fail
  }
}

const _initial = loadFromLocalStorage();
const _initialInvestorModel = loadInvestorModel();

export const useSimulationStore = create<SimulationState>((set, get) => ({
  assignments: _initial.assignments,
  selectedLotIds: new Set<number>(),
  viewMode: "development",
  mapColorMode: "type",
  investorSharePct: _initial.investorSharePct,
  scenarios: [],
  activeScenarioId: null,
  lotStatuses: _initial.lotStatuses,
  typeAssumptions: _initial.typeAssumptions,
  investorModel: _initialInvestorModel.investorModel,
  landSharePct: _initialInvestorModel.landSharePct,
  cashToStartPct: _initialInvestorModel.cashToStartPct,
  priorityReturnRate: _initialInvestorModel.priorityReturnRate,
  holdPeriodYears: _initialInvestorModel.holdPeriodYears,
  ticketSize: _initialInvestorModel.ticketSize,
  investorTickets: _initialInvestorModel.investorTickets,
  projectSpecs: loadProjectSpecs() ?? DEFAULT_PROJECT_SPECS,
  phaseRevenueTargets: loadPhaseTargets(),
  calibrationMode: false,
  lotCenterOverrides: new Map(),
  lotGroups: loadLotGroups(),
  investorFeatureFlags: loadInvestorFlags(),

  setDevelopmentType: (lotIds, type) => {
    set((state) => {
      const newAssignments = new Map(state.assignments);
      for (const id of lotIds) {
        const current = newAssignments.get(id);
        if (current) {
          newAssignments.set(id, { ...current, developmentType: type });
        }
      }
      saveAssignments(newAssignments);
      return { assignments: newAssignments };
    });
  },

  setPhase: (lotIds, phase) => {
    set((state) => {
      const newAssignments = new Map(state.assignments);
      for (const id of lotIds) {
        const current = newAssignments.get(id);
        if (current) {
          newAssignments.set(id, { ...current, phase });
        }
      }
      saveAssignments(newAssignments);
      return { assignments: newAssignments };
    });
  },

  selectLot: (lotId, multi = false) => {
    set((state) => {
      // If the lot belongs to a group, expand selection to the whole group
      const group = state.lotGroups.find((g) => g.lotIds.includes(lotId));
      const idsToToggle = group ? group.lotIds : [lotId];

      const newSelected = multi ? new Set(state.selectedLotIds) : new Set<number>();
      const alreadyAllSelected = idsToToggle.every((id) => newSelected.has(id));
      if (alreadyAllSelected) {
        idsToToggle.forEach((id) => newSelected.delete(id));
      } else {
        idsToToggle.forEach((id) => newSelected.add(id));
      }
      return { selectedLotIds: newSelected };
    });
  },

  selectLotsByIds: (lotIds) => {
    set({ selectedLotIds: new Set(lotIds) });
  },

  selectLotsByPhase: (phase) => {
    const { assignments } = get();
    const matching: number[] = [];
    for (const [id, a] of Array.from(assignments.entries())) {
      if (a.phase === phase) matching.push(id);
    }
    set({ selectedLotIds: new Set(matching) });
  },

  selectLotsByType: (type) => {
    const { assignments } = get();
    const matching: number[] = [];
    for (const [id, a] of Array.from(assignments.entries())) {
      if (a.developmentType === type) matching.push(id);
    }
    set({ selectedLotIds: new Set(matching) });
  },

  selectAll: () => {
    set({ selectedLotIds: new Set(LOTS.map((l) => l.id)) });
  },

  deselectAll: () => {
    set({ selectedLotIds: new Set() });
  },

  setViewMode: (mode) => {
    set({
      viewMode: mode,
      mapColorMode: mode === "phase" ? "phase" : mode === "financial" ? "price" : "type",
    });
  },

  setMapColorMode: (mode) => {
    set({ mapColorMode: mode });
  },

  setInvestorSharePct: (pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    saveInvestorPct(clamped);
    set({ investorSharePct: clamped });
  },

  saveScenario: async (name) => {
    const state = get();
    const scenario: Scenario = {
      id: Date.now().toString(),
      name,
      createdAt: new Date().toISOString(),
      assignments: Array.from(state.assignments.values()),
      investorSharePct: state.investorSharePct,
    };
    set((s) => ({
      scenarios: [...s.scenarios, scenario],
      activeScenarioId: scenario.id,
    }));
    // Persist to server
    try {
      await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...scenario,
          lotStatuses: Array.from(state.lotStatuses.entries()),
          typeAssumptions: state.typeAssumptions,
          investorModel: buildServerState(state).investorModel,
        }),
      });
    } catch { /* ignore */ }
  },

  loadScenario: (id) => {
    const state = get();
    const scenario = state.scenarios.find((s) => s.id === id);
    if (!scenario) return;

    const newAssignments = new Map<number, LotAssignment>();
    for (const a of scenario.assignments) {
      newAssignments.set(a.lotId, a);
    }
    set({
      assignments: newAssignments,
      investorSharePct: scenario.investorSharePct,
      activeScenarioId: id,
    });
  },

  deleteScenario: async (id) => {
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== id) }));
    try {
      await fetch(`/api/scenarios?id=${id}`, { method: "DELETE" });
    } catch { /* ignore */ }
  },

  loadScenariosFromServer: async () => {
    try {
      const res = await fetch("/api/scenarios");
      if (!res.ok) return;
      const data: Scenario[] = await res.json();
      if (data.length > 0) {
        set({ scenarios: data });
      }
    } catch { /* ignore */ }
  },

  initStateFromServer: async () => {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) return;
      const data = await res.json() as Partial<PersistedServerState>;
      // Only override if server has actual assignment data
      if (!data.assignments || data.assignments.length === 0) return;

      const defaultAssumptions = createDefaultTypeAssumptions();
      const assignments = new Map<number, LotAssignment>(
        (data.assignments ?? []).map((a) => [a.lotId, a])
      );
      const lotStatuses = new Map<number, LotStatus>(data.lotStatuses ?? []);
      const investorSharePct = data.investorSharePct ?? 20;
      const typeAssumptions: Record<DevelopmentType, TypeAssumption> = data.typeAssumptions
        ? (() => {
            const result = {} as Record<DevelopmentType, TypeAssumption>;
            for (const [type, def] of Object.entries(defaultAssumptions)) {
              const dt = type as DevelopmentType;
              result[dt] = { ...def, ...((data.typeAssumptions as Record<DevelopmentType, Partial<TypeAssumption>>)[dt] ?? {}) };
            }
            return result;
          })()
        : defaultAssumptions;
      const im = { ...DEFAULT_INVESTOR_MODEL_STATE, ...(data.investorModel ?? {}) };

      // Sync localStorage too
      saveAssignments(assignments);
      saveLotStatuses(lotStatuses);
      saveInvestorPct(investorSharePct);
      saveTypeAssumptions(typeAssumptions);
      saveInvestorModel(im);
      if (data.projectSpecs) saveProjectSpecs(data.projectSpecs);
      const phaseRevenueTargets = data.phaseRevenueTargets
        ? { ...DEFAULT_PHASE_TARGETS, ...data.phaseRevenueTargets }
        : undefined;
      if (phaseRevenueTargets) savePhaseTargets(phaseRevenueTargets);
      const lotGroups = data.lotGroups ?? [];
      saveLotGroups(lotGroups);
      const investorFeatureFlags = data.investorFeatureFlags
        ? { ...DEFAULT_INVESTOR_FLAGS, ...data.investorFeatureFlags }
        : undefined;
      if (investorFeatureFlags) saveInvestorFlags(investorFeatureFlags);

      set({
        assignments,
        lotStatuses,
        investorSharePct,
        typeAssumptions,
        investorModel: im.investorModel,
        landSharePct: im.landSharePct,
        cashToStartPct: im.cashToStartPct,
        priorityReturnRate: im.priorityReturnRate,
        holdPeriodYears: im.holdPeriodYears,
        ticketSize: im.ticketSize,
        investorTickets: im.investorTickets,
        lotGroups,
        ...(data.projectSpecs ? { projectSpecs: data.projectSpecs } : {}),
        ...(phaseRevenueTargets ? { phaseRevenueTargets } : {}),
        ...(investorFeatureFlags ? { investorFeatureFlags } : {}),
      });
    } catch { /* server unavailable, localStorage already loaded */ }
  },

  getAssignment: (lotId) => {
    const state = get();
    return (
      state.assignments.get(lotId) ?? {
        lotId,
        developmentType: "unassigned",
        phase: 0,
      }
    );
  },

  getAssignmentsArray: () => {
    return Array.from(get().assignments.values());
  },

  setLotStatus: (lotIds, status) => {
    set((state) => {
      const newStatuses = new Map(state.lotStatuses);
      for (const id of lotIds) {
        if (status === "available") {
          newStatuses.delete(id); // "available" is the default, no need to store
        } else {
          newStatuses.set(id, status);
        }
      }
      saveLotStatuses(newStatuses);
      return { lotStatuses: newStatuses };
    });
  },

  toggleLotSold: (lotIds) => {
    // Legacy: toggles between "sold" and "available"
    const state = get();
    const allSold = lotIds.every((id) => state.lotStatuses.get(id) === "sold");
    const newStatus: LotStatus = allSold ? "available" : "sold";
    set((s) => {
      const newStatuses = new Map(s.lotStatuses);
      for (const id of lotIds) {
        if (newStatus === "available") {
          newStatuses.delete(id);
        } else {
          newStatuses.set(id, newStatus);
        }
      }
      saveLotStatuses(newStatuses);
      return { lotStatuses: newStatuses };
    });
  },

  setTypeAssumption: (type, field, value) => {
    set((state) => {
      const newAssumptions = {
        ...state.typeAssumptions,
        [type]: { ...state.typeAssumptions[type], [field]: value },
      };
      saveTypeAssumptions(newAssumptions);
      return { typeAssumptions: newAssumptions };
    });
  },

  resetTypeAssumptions: () => {
    const defaults = createDefaultTypeAssumptions();
    saveTypeAssumptions(defaults);
    set({ typeAssumptions: defaults });
  },

  resetAll: () => {
    const assignments = createDefaultAssignments();
    const lotStatuses = new Map<number, LotStatus>();
    saveAssignments(assignments);
    saveLotStatuses(lotStatuses);
    saveLotGroups([]);
    set({
      assignments,
      selectedLotIds: new Set(),
      lotStatuses,
      activeScenarioId: null,
      lotGroups: [],
    });
  },

  // ── Lot Group Actions ─────────────────────────────────────────────────────

  addLotGroup: (lotIds) => {
    const id = `grp_${Date.now()}`;
    set((state) => {
      // Derive devType + phase from the first lot's assignment
      const firstAssignment = state.assignments.get(lotIds[0]);
      const devType = firstAssignment?.developmentType ?? "unassigned";
      const phase = firstAssignment?.phase ?? 0;
      const label = `Lots ${lotIds.join("+")}`;
      const newGroup: LotGroup = { id, lotIds, devType, phase, label };
      const newGroups = [...state.lotGroups, newGroup];
      saveLotGroups(newGroups);
      return { lotGroups: newGroups, selectedLotIds: new Set<number>() };
    });
    return id;
  },

  removeLotGroup: (groupId) => {
    set((state) => {
      const newGroups = state.lotGroups.filter((g) => g.id !== groupId);
      saveLotGroups(newGroups);
      return { lotGroups: newGroups };
    });
  },

  setGroupDevType: (groupId, type) => {
    set((state) => {
      const newGroups = state.lotGroups.map((g) =>
        g.id === groupId ? { ...g, devType: type } : g
      );
      // Keep individual lot assignments in sync
      const group = state.lotGroups.find((g) => g.id === groupId);
      if (group) {
        const newAssignments = new Map(state.assignments);
        for (const lotId of group.lotIds) {
          const cur = newAssignments.get(lotId);
          if (cur) newAssignments.set(lotId, { ...cur, developmentType: type });
        }
        saveAssignments(newAssignments);
        saveLotGroups(newGroups);
        return { lotGroups: newGroups, assignments: newAssignments };
      }
      saveLotGroups(newGroups);
      return { lotGroups: newGroups };
    });
  },

  setGroupPhase: (groupId, phase) => {
    set((state) => {
      const newGroups = state.lotGroups.map((g) =>
        g.id === groupId ? { ...g, phase } : g
      );
      const group = state.lotGroups.find((g) => g.id === groupId);
      if (group) {
        const newAssignments = new Map(state.assignments);
        for (const lotId of group.lotIds) {
          const cur = newAssignments.get(lotId);
          if (cur) newAssignments.set(lotId, { ...cur, phase });
        }
        saveAssignments(newAssignments);
        saveLotGroups(newGroups);
        return { lotGroups: newGroups, assignments: newAssignments };
      }
      saveLotGroups(newGroups);
      return { lotGroups: newGroups };
    });
  },

  setGroupCustomUnits: (groupId, units) => {
    set((state) => {
      const newGroups = state.lotGroups.map((g) =>
        g.id === groupId ? { ...g, customUnits: units } : g
      );
      saveLotGroups(newGroups);
      return { lotGroups: newGroups };
    });
  },

  setGroupLabel: (groupId, label) => {
    set((state) => {
      const newGroups = state.lotGroups.map((g) =>
        g.id === groupId ? { ...g, label } : g
      );
      saveLotGroups(newGroups);
      return { lotGroups: newGroups };
    });
  },

  getGroupForLot: (lotId) => {
    return get().lotGroups.find((g) => g.lotIds.includes(lotId));
  },

  setInvestorModel: (model) => {
    set((s) => {
      const next = { ...s, investorModel: model };
      saveInvestorModel({ investorModel: model, landSharePct: s.landSharePct, cashToStartPct: s.cashToStartPct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: s.holdPeriodYears, ticketSize: s.ticketSize, investorTickets: s.investorTickets });
      return { investorModel: model };
    });
  },

  setLandSharePct: (pct) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: pct, cashToStartPct: s.cashToStartPct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: s.holdPeriodYears, ticketSize: s.ticketSize, investorTickets: s.investorTickets });
      return { landSharePct: pct };
    });
  },

  setCashToStartPct: (pct) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: s.landSharePct, cashToStartPct: pct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: s.holdPeriodYears, ticketSize: s.ticketSize, investorTickets: s.investorTickets });
      return { cashToStartPct: pct };
    });
  },

  setPriorityReturnRate: (rate) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: s.landSharePct, cashToStartPct: s.cashToStartPct, priorityReturnRate: rate, holdPeriodYears: s.holdPeriodYears, ticketSize: s.ticketSize, investorTickets: s.investorTickets });
      return { priorityReturnRate: rate };
    });
  },

  setHoldPeriodYears: (years) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: s.landSharePct, cashToStartPct: s.cashToStartPct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: years, ticketSize: s.ticketSize, investorTickets: s.investorTickets });
      return { holdPeriodYears: years };
    });
  },

  setTicketSize: (size) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: s.landSharePct, cashToStartPct: s.cashToStartPct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: s.holdPeriodYears, ticketSize: size, investorTickets: s.investorTickets });
      return { ticketSize: size };
    });
  },

  setInvestorTickets: (tickets) => {
    set((s) => {
      saveInvestorModel({ investorModel: s.investorModel, landSharePct: s.landSharePct, cashToStartPct: s.cashToStartPct, priorityReturnRate: s.priorityReturnRate, holdPeriodYears: s.holdPeriodYears, ticketSize: s.ticketSize, investorTickets: tickets });
      return { investorTickets: tickets };
    });
  },

  setProjectSpecs: (specs) => {
    saveProjectSpecs(specs);
    set({ projectSpecs: specs });
  },

  setPhaseRevenueTarget: (phase, target) => {
    set((s) => {
      const next = { ...s.phaseRevenueTargets, [phase]: target };
      savePhaseTargets(next);
      return { phaseRevenueTargets: next };
    });
  },

  initCenterOverrides: async () => {
    const overrides = await fetchCenterOverrides();
    set({ lotCenterOverrides: overrides });
  },

  toggleCalibrationMode: () => {
    set((state) => ({
      calibrationMode: !state.calibrationMode,
      selectedLotIds: !state.calibrationMode ? new Set() : state.selectedLotIds,
    }));
  },

  setLotCenterOverride: (lotId, center) => {
    set((state) => {
      const newOverrides = new Map(state.lotCenterOverrides);
      newOverrides.set(lotId, center);
      persistCenterOverrides(newOverrides);
      return { lotCenterOverrides: newOverrides };
    });
  },

  resetCenterOverrides: () => {
    const empty = new Map<number, [number, number]>();
    persistCenterOverrides(empty);
    set({ lotCenterOverrides: empty });
  },

  setInvestorFeatureFlag: (key, val) => {
    set((state) => {
      const next = { ...state.investorFeatureFlags, [key]: val };
      saveInvestorFlags(next);
      return { investorFeatureFlags: next };
    });
  },
}));

// ── Auto-save to server on relevant state changes ─────────────────────────────
if (typeof window !== "undefined") {
  useSimulationStore.subscribe((state, prevState) => {
    if (
      state.assignments !== prevState.assignments ||
      state.lotStatuses !== prevState.lotStatuses ||
      state.typeAssumptions !== prevState.typeAssumptions ||
      state.investorSharePct !== prevState.investorSharePct ||
      state.investorModel !== prevState.investorModel ||
      state.landSharePct !== prevState.landSharePct ||
      state.cashToStartPct !== prevState.cashToStartPct ||
      state.priorityReturnRate !== prevState.priorityReturnRate ||
      state.holdPeriodYears !== prevState.holdPeriodYears ||
      state.ticketSize !== prevState.ticketSize ||
      state.projectSpecs !== prevState.projectSpecs ||
      state.phaseRevenueTargets !== prevState.phaseRevenueTargets ||
      state.lotGroups !== prevState.lotGroups
    ) {
      queueServerSave(buildServerState(state));
    }
  });
}
