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
  plots?: number;
  units?: number;
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

  // Cumulative (whole-project) column — Tilal + HD combined.
  const totalNet = s.mahmoudNet + s.hdNet;          // = gross profit (fees redistribute to HD)
  const totalCash = s.mahmoudCash + s.hdCash;
  const totalROC = s.totalContrib > 0 ? totalNet / s.totalContrib : 0;
  const totalCashROI = totalCash > 0 ? totalNet / totalCash : 0;

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <PartyMini name="Total" net={totalNet} roc={totalROC} accent="#374151" />
        <PartyMini name="Mahmoud (Tilal)" net={s.mahmoudNet} roc={s.mahmoudROC} accent="#1A3810" />
        <PartyMini name="HD Group" net={s.hdNet} roc={s.hdROC} accent="#2E5A8C" />
      </div>
    );
  }

  const mgmtPctLbl = pct(controls.mgmtFeePct, 1);
  const salesPctLbl = pct(controls.salesCommPct, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-800">{label}</span>
          {deal.plots !== undefined && (
            <span className="text-[10px] text-gray-400 tabular-nums" title="Number of plots in this scope">
              {deal.plots} plots{deal.units !== undefined ? ` · ${Math.round(deal.units)} units` : ""}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 tabular-nums">
          gross {usd(s.grossProfit)} · pool {usd(s.netPool)}
        </span>
      </div>

      {/* economics waterfall — revenue → gross */}
      <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] border-b border-gray-100">
        <Mini label="Total sales" value={usd(deal.revenue)} color="#1A3810"
          tip={`Total sale revenue across ${deal.plots ?? "all"} plots = ${usd(deal.revenue)} (from the build & P&L model)`} />
        <Mini label="− Land cost" value={`−${usd(deal.landValue)}`} color="#E53E3E"
          tip={`Discounted land value (retail − discount) = ${usd(deal.landValue)}. Retail land was ${usd(deal.retailLandValue)}.`} />
        <Mini label="− Construction" value={`−${usd(deal.buildCost)}`} color="#E53E3E"
          tip={`Construction cost = ${usd(deal.buildCost)} (BUA × build $/m² from the model)`} />
        <Mini label="Gross profit" value={usd(s.grossProfit)} color="#374151"
          tip={`Revenue − land − construction (${usd(deal.revenue)} − ${usd(deal.landValue)} − ${usd(deal.buildCost)} = ${usd(s.grossProfit)})`} />
      </div>

      {/* fee breakdown */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2 text-[10px] border-b border-gray-100">
        <Mini label={`− Mgmt fee (${mgmtPctLbl})`} value={`−${usd(s.mgmtFee)}`} color="#E53E3E"
          tip={`Construction × management fee % (${usd(deal.buildCost)} × ${mgmtPctLbl} = ${usd(s.mgmtFee)}). Paid to HD.`} />
        <Mini label={`− Sales comm (${salesPctLbl})`} value={`−${usd(s.salesComm)}`} color="#E53E3E"
          tip={`Revenue × sales commission % (${usd(deal.revenue)} × ${salesPctLbl} = ${usd(s.salesComm)}). Paid to HD.`} />
        <Mini label="= Pool to split" value={usd(s.netPool)} color="#374151"
          tip={`Gross profit − mgmt fee − sales commission (${usd(s.grossProfit)} − ${usd(s.mgmtFee)} − ${usd(s.salesComm)} = ${usd(s.netPool)})`} />
      </div>

      {/* total + two-party table */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] text-[11px]">
        <HeadCell />
        <HeadCell label="Total" accent="#374151" />
        <HeadCell label="Mahmoud (Tilal)" accent="#1A3810" />
        <HeadCell label="HD Group" accent="#2E5A8C" />

        <Cell label="Contribution" tip="Capital each party puts in (land and/or construction). Returned as capital; the split divides the profit on top." />
        <Cell value={usd(s.totalContrib)} totalCol tip={`Land ${usd(deal.landValue)} + construction ${usd(deal.buildCost)} = ${usd(s.totalContrib)}`} />
        <Cell value={usd(s.mahmoudContrib)} tip={`Land ${usd(deal.landValue)} + Mahmoud's build share (${pct(mahmoudConstrPct,0)} × ${usd(deal.buildCost)}) = ${usd(s.mahmoudContrib)}`} />
        <Cell value={usd(s.hdContrib)} tip={`HD's build share (${pct(1-mahmoudConstrPct,0)} × ${usd(deal.buildCost)}) = ${usd(s.hdContrib)}`} />

        <Cell label="Contribution %" tip="Each party's share of total capital — this is the profit-split ratio." />
        <Cell value={pct(1)} totalCol tip="Land + construction = 100% of capital deployed" />
        <Cell value={pct(s.mahmoudShare)} tip={`${usd(s.mahmoudContrib)} ÷ ${usd(s.totalContrib)} = ${pct(s.mahmoudShare)}`} />
        <Cell value={pct(s.hdShare)} tip={`${usd(s.hdContrib)} ÷ ${usd(s.totalContrib)} = ${pct(s.hdShare)}`} />

        <Cell label="Net profit" bold tip="Each party's profit after the pool is split by contribution; HD also collects the mgmt fee + sales commission." />
        <Cell value={usd(totalNet)} bold totalCol tip={`Mahmoud ${usd(s.mahmoudNet)} + HD ${usd(s.hdNet)} = ${usd(totalNet)} (equals gross profit — fees just move to HD)`} />
        <Cell value={usd(s.mahmoudNet)} bold color="#1A3810" tip={`Pool × Mahmoud share (${usd(s.netPool)} × ${pct(s.mahmoudShare)} = ${usd(s.mahmoudNet)})`} />
        <Cell value={usd(s.hdNet)} bold color="#2E5A8C" tip={`Pool × HD share + fees (${usd(s.netPool)} × ${pct(s.hdShare)} + ${usd(s.mgmtFee)} + ${usd(s.salesComm)} = ${usd(s.hdNet)})`} />

        <Cell label="Return on capital" tip="Net profit ÷ capital contributed." />
        <Cell value={pct(totalROC)} totalCol tip={`${usd(totalNet)} ÷ ${usd(s.totalContrib)} = ${pct(totalROC)}`} />
        <Cell value={pct(s.mahmoudROC)} tip={`${usd(s.mahmoudNet)} ÷ ${usd(s.mahmoudContrib)} = ${pct(s.mahmoudROC)}`} />
        <Cell value={pct(s.hdROC)} tip={`${usd(s.hdNet)} ÷ ${usd(s.hdContrib)} = ${pct(s.hdROC)}`} />

        <Cell label={`Cash to start (${pct(equityPct,0)})`} tip={`Upfront equity = ${pct(equityPct,0)} of capital; the rest assumed financed.`} />
        <Cell value={usd(totalCash)} totalCol tip={`${pct(equityPct,0)} × ${usd(s.totalContrib)} = ${usd(totalCash)}`} />
        <Cell value={usd(s.mahmoudCash)} tip={`${pct(equityPct,0)} × ${usd(s.mahmoudContrib)} = ${usd(s.mahmoudCash)}`} />
        <Cell value={usd(s.hdCash)} tip={`${pct(equityPct,0)} × ${usd(s.hdContrib)} = ${usd(s.hdCash)}`} />

        <Cell label="Cash-on-cash ROI" tip="Net profit ÷ cash-to-start — return on the equity actually deployed." />
        <Cell value={pct(totalCashROI)} totalCol tip={`${usd(totalNet)} ÷ ${usd(totalCash)} = ${pct(totalCashROI)}`} />
        <Cell value={pct(s.mahmoudCashROI)} tip={`${usd(s.mahmoudNet)} ÷ ${usd(s.mahmoudCash)} = ${pct(s.mahmoudCashROI)}`} />
        <Cell value={pct(s.hdCashROI)} tip={`${usd(s.hdNet)} ÷ ${usd(s.hdCash)} = ${pct(s.hdCashROI)}`} />

        <Cell label="Annualized — exit Y2" subtle tip="Cash-on-cash ROI annualized over a 2-year hold: (1 + ROI)^(1/2) − 1." />
        <Cell value={pct(annualizedByExit(totalCashROI, 2))} subtle totalCol tip={`(1 + ${pct(totalCashROI)})^(1/2) − 1 = ${pct(annualizedByExit(totalCashROI,2))}`} />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 2))} subtle tip={`(1 + ${pct(s.mahmoudCashROI)})^(1/2) − 1 = ${pct(annualizedByExit(s.mahmoudCashROI,2))}`} />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 2))} subtle tip={`(1 + ${pct(s.hdCashROI)})^(1/2) − 1 = ${pct(annualizedByExit(s.hdCashROI,2))}`} />

        <Cell label="Annualized — exit Y3" subtle tip="Cash-on-cash ROI annualized over a 3-year hold: (1 + ROI)^(1/3) − 1." />
        <Cell value={pct(annualizedByExit(totalCashROI, 3))} subtle totalCol tip={`(1 + ${pct(totalCashROI)})^(1/3) − 1 = ${pct(annualizedByExit(totalCashROI,3))}`} />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 3))} subtle tip={`(1 + ${pct(s.mahmoudCashROI)})^(1/3) − 1 = ${pct(annualizedByExit(s.mahmoudCashROI,3))}`} />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 3))} subtle tip={`(1 + ${pct(s.hdCashROI)})^(1/3) − 1 = ${pct(annualizedByExit(s.hdCashROI,3))}`} />
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

function Mini({ label, value, color, tip }: { label: string; value: string; color?: string; tip?: string }) {
  return (
    <div className="text-center" title={tip}>
      <div className={`text-gray-400 ${tip ? "border-b border-dotted border-gray-300 inline-block cursor-help" : ""}`}>{label}</div>
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

function Cell({ label, value, bold, color, subtle, totalCol, tip }: { label?: string; value?: string; bold?: boolean; color?: string; subtle?: boolean; totalCol?: boolean; tip?: string }) {
  const isLabel = label !== undefined;
  return (
    <div title={tip}
      className={`px-3 py-1 border-b border-gray-50 tabular-nums ${isLabel ? "text-left text-gray-500" : "text-right"} ${bold ? "font-bold" : ""} ${subtle ? "text-gray-400" : ""} ${totalCol ? "bg-gray-50/70 text-gray-700" : ""} ${tip ? "cursor-help" : ""}`}
      style={!isLabel && color ? { color } : undefined}>
      {isLabel && tip ? <span className="border-b border-dotted border-gray-300">{label}</span> : (isLabel ? label : value)}
    </div>
  );
}
