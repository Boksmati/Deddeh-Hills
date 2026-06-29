"use client";

import {
  computeCoDevSplit, aggregateCoDevSplit, annualizedByExit,
  type CoDevLine,
} from "@/lib/codev";

/* ── formatting ─────────────────────────────────────────────── */
const usd = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (a >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};
const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;

export interface CoDevFees {
  mgmtFeePct: number;
  salesCommPct: number;
}

/** A typology row for the allocation panel / inline funding sliders. */
export interface TypologyAlloc {
  key: string;
  label: string;
  color: string;
  plots: number;
  mahmoudConstrPct: number;  // 0..1 — Mahmoud's share of this typology's construction
}

const PRESETS: { label: string; pct: number; sub: string }[] = [
  { label: "HD builds all", pct: 0,    sub: "Mahmoud: land only · HD funds 100% construction" },
  { label: "Split 50 / 50", pct: 0.5,  sub: "Each funds half of every typology's construction" },
  { label: "Mahmoud builds all", pct: 1, sub: "Mahmoud develops every typology alone · HD out" },
];

/* ── global controls: presets + fees ────────────────────────── */
export function CoDevControls({
  fees, onFees, onPreset, activePct,
}: {
  fees: CoDevFees;
  onFees: (f: CoDevFees) => void;
  onPreset: (pct: number) => void;
  /** If every typology shares one funding %, that value — else null (mixed). */
  activePct: number | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Co-Development Split — Tilal × HD</h3>
        <p className="text-[10px] text-gray-400 mt-0.5">Construction funding is set per typology below. Profit splits by contribution; fees scale with HD&apos;s construction share.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mr-1">Presets:</span>
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onPreset(p.pct)}
            title={p.sub}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              activePct !== null && Math.abs(activePct - p.pct) < 0.001
                ? "bg-dh-dark text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="flex-1" />
        <FeeInput label="Mgmt fee (% constr.)" value={fees.mgmtFeePct} onChange={v => onFees({ ...fees, mgmtFeePct: v })} />
        <FeeInput label="Sales comm (% rev.)" value={fees.salesCommPct} onChange={v => onFees({ ...fees, salesCommPct: v })} />
      </div>
    </div>
  );
}

function FeeInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-gray-500">{label}</span>
      <input
        type="number" min={0} max={50} step={0.5}
        value={+(value * 100).toFixed(1)}
        onChange={e => onChange((parseFloat(e.target.value) || 0) / 100)}
        className="w-14 text-xs text-right px-2 py-1 border border-gray-200 rounded tabular-nums"
      />
      <span className="text-[10px] text-gray-400">%</span>
    </div>
  );
}

/* ── allocation panel: a funding slider per typology ────────── */
export function AllocationPanel({
  rows, onChange,
}: {
  rows: TypologyAlloc[];
  onChange: (key: string, pct: number) => void;
}) {
  const active = rows.filter(r => r.plots > 0);
  if (active.length === 0) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Construction funding by typology — Mahmoud&apos;s share</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {active.map(r => (
          <div key={r.key} className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-32 flex-shrink-0">
              <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              <span className="text-[11px] font-medium text-gray-700 truncate">{r.label}</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={Math.round(r.mahmoudConstrPct * 100)}
              onChange={e => onChange(r.key, parseInt(e.target.value) / 100)}
              className="flex-1 accent-dh-hills min-w-[80px]"
            />
            <span className="text-[11px] font-semibold tabular-nums text-gray-700 w-20 text-right">
              M {pct(r.mahmoudConstrPct, 0)} · HD {pct(1 - r.mahmoudConstrPct, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── inline single-typology funding slider ──────────────────── */
export function FundingSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] uppercase tracking-wider font-semibold text-gray-400 whitespace-nowrap">Mahmoud funds</span>
      <input
        type="range" min={0} max={100} step={5}
        value={Math.round(value * 100)}
        onChange={e => onChange(parseInt(e.target.value) / 100)}
        className="flex-1 accent-dh-hills min-w-[80px]"
      />
      <span className="text-[10px] font-semibold tabular-nums text-gray-700 w-9 text-right">{pct(value, 0)}</span>
    </div>
  );
}

/* ── split card (full or compact), driven by per-typology lines ─ */
export function CoDevSplitCard({
  label, lines, fees, variant = "full", plots, units,
}: {
  label: string;
  lines: CoDevLine[];
  fees: CoDevFees;
  variant?: "full" | "compact";
  plots?: number;
  units?: number;
}) {
  const s = aggregateCoDevSplit(lines, fees.mgmtFeePct, fees.salesCommPct);
  const revenue = lines.reduce((a, l) => a + l.revenue, 0);
  const landValue = lines.reduce((a, l) => a + l.landValue, 0);
  const buildCost = lines.reduce((a, l) => a + l.buildCost, 0);
  const retailLand = lines.reduce((a, l) => a + l.retailLandValue, 0);

  // Cumulative (whole-scope) column — Tilal + HD combined.
  const totalNet = s.mahmoudNet + s.hdNet;
  const totalCash = s.mahmoudCash + s.hdCash;
  const totalROC = s.totalContrib > 0 ? totalNet / s.totalContrib : 0;
  const totalCashROI = totalCash > 0 ? totalNet / totalCash : 0;
  // Blended cash-to-start % (lines may carry different equity assumptions).
  const equityPct = s.totalContrib > 0 ? totalCash / s.totalContrib : 0;

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <PartyMini name="Total" net={totalNet} roc={totalROC} accent="#374151" />
        <PartyMini name="Mahmoud (Tilal)" net={s.mahmoudNet} roc={s.mahmoudROC} accent="#1A3810" />
        <PartyMini name="HD Group" net={s.hdNet} roc={s.hdROC} accent="#2E5A8C" />
      </div>
    );
  }

  const mgmtPctLbl = pct(fees.mgmtFeePct, 1);
  const salesPctLbl = pct(fees.salesCommPct, 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-800">{label}</span>
          {plots !== undefined && (
            <span className="text-[10px] text-gray-400 tabular-nums" title="Number of plots in this scope">
              {plots} plots{units !== undefined ? ` · ${Math.round(units)} units` : ""}
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 tabular-nums">
          gross {usd(s.grossProfit)} · pool {usd(s.netPool)}
        </span>
      </div>

      {/* economics waterfall — revenue → gross */}
      <div className="px-4 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] border-b border-gray-100">
        <Mini label="Total sales" value={usd(revenue)} color="#1A3810"
          tip={`Total sale revenue across ${plots ?? "all"} plots = ${usd(revenue)} (from the build & P&L model)`} />
        <Mini label="− Land cost" value={`−${usd(landValue)}`} color="#E53E3E"
          tip={`Discounted land value (retail − discount) = ${usd(landValue)}. Retail land was ${usd(retailLand)}.`} />
        <Mini label="− Construction" value={`−${usd(buildCost)}`} color="#E53E3E"
          tip={`Construction cost = ${usd(buildCost)} (BUA × build $/m² from the model)`} />
        <Mini label="Gross profit" value={usd(s.grossProfit)} color="#374151"
          tip={`Revenue − land − construction (${usd(revenue)} − ${usd(landValue)} − ${usd(buildCost)} = ${usd(s.grossProfit)})`} />
      </div>

      {/* fee breakdown */}
      <div className="px-4 py-2 grid grid-cols-3 gap-2 text-[10px] border-b border-gray-100">
        <Mini label={`− Mgmt fee (${mgmtPctLbl})`} value={`−${usd(s.mgmtFee)}`} color="#E53E3E"
          tip={`HD-funded construction × ${mgmtPctLbl}, summed per typology = ${usd(s.mgmtFee)}. Scales down where Mahmoud self-funds; paid to HD.`} />
        <Mini label={`− Sales comm (${salesPctLbl})`} value={`−${usd(s.salesComm)}`} color="#E53E3E"
          tip={`HD-funded revenue × ${salesPctLbl}, summed per typology = ${usd(s.salesComm)}. Scales down where Mahmoud self-funds; paid to HD.`} />
        <Mini label="= Pool to split" value={usd(s.netPool)} color="#374151"
          tip={`Gross profit − mgmt fee − sales commission (${usd(s.grossProfit)} − ${usd(s.mgmtFee)} − ${usd(s.salesComm)} = ${usd(s.netPool)})`} />
      </div>

      {/* total + two-party table */}
      <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] text-[11px]">
        <HeadCell />
        <HeadCell label="Total" accent="#374151" />
        <HeadCell label="Mahmoud (Tilal)" accent="#1A3810" />
        <HeadCell label="HD Group" accent="#2E5A8C" />

        <Cell label="Contribution" tip="Capital each party puts in (land and/or construction), summed across typologies." />
        <Cell value={usd(s.totalContrib)} totalCol tip={`Land ${usd(landValue)} + construction ${usd(buildCost)} = ${usd(s.totalContrib)}`} />
        <Cell value={usd(s.mahmoudContrib)} tip={`Land ${usd(landValue)} + Mahmoud's funded construction (per-typology) = ${usd(s.mahmoudContrib)}`} />
        <Cell value={usd(s.hdContrib)} tip={`HD's funded construction (per-typology) = ${usd(s.hdContrib)}`} />

        <Cell label="Contribution %" tip="Each party's share of total capital — the blended profit-split ratio across typologies." />
        <Cell value={pct(1)} totalCol tip="Land + construction = 100% of capital deployed" />
        <Cell value={pct(s.mahmoudShare)} tip={`${usd(s.mahmoudContrib)} ÷ ${usd(s.totalContrib)} = ${pct(s.mahmoudShare)}`} />
        <Cell value={pct(s.hdShare)} tip={`${usd(s.hdContrib)} ÷ ${usd(s.totalContrib)} = ${pct(s.hdShare)}`} />

        <Cell label="Net profit" bold tip="Sum of each typology's split: pool × contribution share, plus the fees for HD." />
        <Cell value={usd(totalNet)} bold totalCol tip={`Mahmoud ${usd(s.mahmoudNet)} + HD ${usd(s.hdNet)} = ${usd(totalNet)} (= gross profit)`} />
        <Cell value={usd(s.mahmoudNet)} bold color="#1A3810" tip={`Σ per typology of pool × Mahmoud share = ${usd(s.mahmoudNet)}`} />
        <Cell value={usd(s.hdNet)} bold color="#2E5A8C" tip={`Σ per typology of pool × HD share + HD-funded fees = ${usd(s.hdNet)}`} />

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
        <Cell value={pct(annualizedByExit(totalCashROI, 2))} subtle totalCol tip={`(1 + ${pct(totalCashROI)})^(1/2) − 1`} />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 2))} subtle tip={`(1 + ${pct(s.mahmoudCashROI)})^(1/2) − 1`} />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 2))} subtle tip={`(1 + ${pct(s.hdCashROI)})^(1/2) − 1`} />

        <Cell label="Annualized — exit Y3" subtle tip="Cash-on-cash ROI annualized over a 3-year hold: (1 + ROI)^(1/3) − 1." />
        <Cell value={pct(annualizedByExit(totalCashROI, 3))} subtle totalCol tip={`(1 + ${pct(totalCashROI)})^(1/3) − 1`} />
        <Cell value={pct(annualizedByExit(s.mahmoudCashROI, 3))} subtle tip={`(1 + ${pct(s.mahmoudCashROI)})^(1/3) − 1`} />
        <Cell value={pct(annualizedByExit(s.hdCashROI, 3))} subtle tip={`(1 + ${pct(s.hdCashROI)})^(1/3) − 1`} />
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
            ⚠ The discount you give exceeds your profit — revisit the funding allocation.
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
