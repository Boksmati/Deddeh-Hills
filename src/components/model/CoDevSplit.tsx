"use client";

import {
  computeCoDevSplit, scenarioConstrPct, annualizedByExit,
  type CoDevScenarioKey,
} from "@/lib/codev";

/* ── formatting ─────────────────────────────────────────────── */
const usd = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

export type CoDevScenarioState = CoDevScenarioKey | "custom";

export interface CoDevControlValues {
  scenario: CoDevScenarioState;
  manualPct: number;      // Mahmoud construction-funding %, used when scenario === "custom"
  mgmtFeePct: number;
  salesCommPct: number;
}

const SCENARIOS: { key: CoDevScenarioKey; label: string; sub: string }[] = [
  { key: "land_only",      label: "S1 · Land only",     sub: "Mahmoud: land · HD: 100% build" },
  { key: "fifty_fifty",    label: "S2 · True 50/50",    sub: "Each funds 50% of capital" },
  { key: "land_plus_half", label: "S3 · Land + ½ build", sub: "Mahmoud: land + 50% build" },
];

/* ── global control bar ─────────────────────────────────────── */
export function CoDevControls({
  value, onChange,
}: {
  value: CoDevControlValues;
  onChange: (v: CoDevControlValues) => void;
}) {
  const set = (patch: Partial<CoDevControlValues>) => onChange({ ...value, ...patch });
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Co-Development Split — Tilal × HD</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">Profit divided by contribution ratio. Applied to every typology, phase and the project total below.</p>
        </div>
      </div>

      {/* Scenario tabs */}
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map(s => (
          <button
            key={s.key}
            onClick={() => set({ scenario: s.key })}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold text-left transition-colors ${
              value.scenario === s.key ? "bg-dh-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title={s.sub}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => set({ scenario: "custom" })}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
            value.scenario === "custom" ? "bg-dh-hills text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Slider + fee inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
        <div className="sm:col-span-1">
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
            <span>Mahmoud funds of construction</span>
            <span className="font-semibold tabular-nums text-gray-700">{pct(value.manualPct, 0)}</span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round(value.manualPct * 100)}
            onChange={e => set({ scenario: "custom", manualPct: parseInt(e.target.value) / 100 })}
            className="w-full accent-dh-hills"
          />
        </div>
        <FeeInput label="Management fee (% constr. → HD)" value={value.mgmtFeePct} onChange={v => set({ mgmtFeePct: v })} />
        <FeeInput label="Sales commission (% revenue → HD)" value={value.salesCommPct} onChange={v => set({ salesCommPct: v })} />
      </div>
    </div>
  );
}

function FeeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="flex items-center gap-1">
        <input
          type="number" min={0} max={50} step={0.5}
          value={+(value * 100).toFixed(1)}
          onChange={e => onChange((parseFloat(e.target.value) || 0) / 100)}
          className="w-16 text-xs text-right px-2 py-1 border border-gray-200 rounded tabular-nums"
        />
        <span className="text-[10px] text-gray-400">%</span>
      </div>
    </div>
  );
}

/* ── split card (full or compact) ───────────────────────────── */
export interface CoDevDealInputs {
  landValue: number;
  buildCost: number;
  revenue: number;
  retailLandValue: number;
}

export function CoDevSplitCard({
  label, deal, controls, variant = "full", equityPct = 0.30,
}: {
  label: string;
  deal: CoDevDealInputs;
  controls: CoDevControlValues;
  variant?: "full" | "compact";
  equityPct?: number;
}) {
  const mahmoudConstrPct = controls.scenario === "custom"
    ? controls.manualPct
    : scenarioConstrPct(controls.scenario, deal.landValue, deal.buildCost);

  const s = computeCoDevSplit({
    landValue: deal.landValue,
    buildCost: deal.buildCost,
    revenue: deal.revenue,
    retailLandValue: deal.retailLandValue,
    mgmtFeePct: controls.mgmtFeePct,
    salesCommPct: controls.salesCommPct,
    mahmoudConstrPct,
    equityPct,
  });

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <PartyMini name="Mahmoud (Tilal)" net={s.mahmoudNet} roc={s.mahmoudROC} accent="#1A3810" />
        <PartyMini name="HD Group" net={s.hdNet} roc={s.hdROC} accent="#2E5A8C" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-800">{label}</span>
        <span className="text-[10px] text-gray-400 tabular-nums">
          gross {usd(s.grossProfit)} · pool {usd(s.netPool)}
        </span>
      </div>

      {/* fee breakdown */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2 text-[10px] border-b border-gray-100">
        <Mini label="Gross profit" value={usd(s.grossProfit)} />
        <Mini label="− Mgmt fee" value={`−${usd(s.mgmtFee)}`} color="#E53E3E" />
        <Mini label="− Sales comm" value={`−${usd(s.salesComm)}`} color="#E53E3E" />
      </div>

      {/* two-party table */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr] text-[11px]">
        <HeadCell />
        <HeadCell label="Mahmoud (Tilal)" accent="#1A3810" />
        <HeadCell label="HD Group" accent="#2E5A8C" />

        <Cell label="Contribution" />
        <Cell value={usd(s.mahmoudContrib)} />
        <Cell value={usd(s.hdContrib)} />

        <Cell label="Contribution %" />
        <Cell value={pct(s.mahmoudShare)} />
        <Cell value={pct(s.hdShare)} />

        <Cell label="Net profit" bold />
        <Cell value={usd(s.mahmoudNet)} bold color="#1A3810" />
        <Cell value={usd(s.hdNet)} bold color="#2E5A8C" />

        <Cell label="Return on capital" />
        <Cell value={pct(s.mahmoudROC)} />
        <Cell value={pct(s.hdROC)} />

        <Cell label={`Cash to start (${pct(equityPct,0)})`} />
        <Cell value={usd(s.mahmoudCash)} />
        <Cell value={usd(s.hdCash)} />

        <Cell label="Cash-on-cash ROI" />
        <Cell value={pct(s.mahmoudCashROI)} />
        <Cell value={pct(s.hdCashROI)} />

        <Cell label="Annualized — exit Y2" subtle />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 2))} subtle />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 2))} subtle />

        <Cell label="Annualized — exit Y3" subtle />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 3))} subtle />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 3))} subtle />
      </div>

      {/* insight footer */}
      <div className={`px-4 py-2 text-[10px] border-t ${s.discountExceedsProfit ? "bg-red-50 border-red-100" : "bg-amber-50/60 border-amber-100"}`}>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Land discount you grant</span>
          <span className="font-semibold tabular-nums text-gray-800">{usd(s.discountGiven)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Your net profit</span>
          <span className="font-semibold tabular-nums text-gray-800">{usd(s.mahmoudNet)}</span>
        </div>
        {s.discountExceedsProfit && (
          <div className="mt-1 text-red-600 font-medium">
            ⚠ The discount you give exceeds your profit — land-only participation loses value here.
          </div>
        )}
      </div>
    </div>
  );
}

function PartyMini({ name, net, roc, accent }: { name: string; net: number; roc: number; accent: string }) {
  return (
    <div className="bg-gray-50/70 rounded-lg p-2">
      <div className="text-[9px] uppercase tracking-wider text-gray-400">{name}</div>
      <div className="text-sm font-bold tabular-nums" style={{ color: accent }}>{usd(net)}</div>
      <div className="text-[9px] text-gray-400 tabular-nums">ROC {pct(roc)}</div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-gray-400">{label}</div>
      <div className="font-bold tabular-nums" style={{ color: color ?? "#374151" }}>{value}</div>
    </div>
  );
}

function HeadCell({ label, accent }: { label?: string; accent?: string }) {
  return (
    <div className="px-3 py-1.5 bg-gray-50/50 border-b border-gray-100 text-[9px] uppercase tracking-wider font-semibold text-right first:text-left"
      style={{ color: accent ?? "#9CA3AF" }}>
      {label ?? ""}
    </div>
  );
}

function Cell({ label, value, bold, color, subtle }: { label?: string; value?: string; bold?: boolean; color?: string; subtle?: boolean }) {
  const isLabel = label !== undefined;
  return (
    <div className={`px-3 py-1 border-b border-gray-50 tabular-nums ${isLabel ? "text-left text-gray-500" : "text-right"} ${bold ? "font-bold" : ""} ${subtle ? "text-gray-400" : ""}`}
      style={!isLabel && color ? { color } : undefined}>
      {isLabel ? label : value}
    </div>
  );
}
