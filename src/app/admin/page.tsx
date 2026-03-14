"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { calculateLotFinancials } from "@/engine/financial-engine";
import { DevelopmentType, LotStatus } from "@/types";
import ProjectSpecsEditor from "@/components/admin/ProjectSpecsEditor";
import AppHeader from "@/components/ui/AppHeader";
import type { InviteToken } from "@/app/api/admin/invites/route";
import type { CrmContact, CrmPayment } from "@/app/api/admin/contacts/route";
import type { TicketPurchase } from "@/lib/tickets";
import { DEFAULT_LAYER_PARAMS, type LayerParams, computeWaterfall, DEFAULT_INVESTMENT_CONFIG, type InvestmentConfig } from "@/lib/investment-layers";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F9EF",
  white: "#FFFFFF",
  ink: "#1A1F16",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#3D7A24",
  greenBg: "rgba(61,122,36,0.08)",
  gold: "#A18A44",
  amber: "#F59E0B",
  red: "#EF4444",
  orange: "#F97316",
  emerald: "#10B981",
} as const;

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = "crm" | "invites" | "specs" | "overview" | "settings" | "analytics";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "crm",       label: "CRM",       icon: "👥" },
  { id: "invites",   label: "Invites",   icon: "🔗" },
  { id: "specs",     label: "Finishings",icon: "📋" },
  { id: "overview",  label: "Overview",  icon: "📊" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "settings",  label: "Settings",  icon: "⚙️" },
];

// ── Invites Tab ───────────────────────────────────────────────────────────────
function InvitesTab() {
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ role: "customer" as "investor" | "customer", label: "", expiresAt: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      if (res.ok) setInvites(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) { setError("Label is required."); return; }
    setCreating(true);
    setError("");
    try {
      const body: Record<string, string> = { role: form.role, label: form.label.trim() };
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setForm({ role: "customer", label: "", expiresAt: "" });
        await load();
      }
    } catch {}
    setCreating(false);
  }

  async function revoke(token: string) {
    await fetch(`/api/admin/invites?token=${token}`, { method: "DELETE" });
    await load();
  }

  function copy(token: string) {
    const inv = invites.find(i => i.token === token);
    const label = inv?.label ? `?for=${encodeURIComponent(inv.label)}` : "";
    const url = `${origin}/invite/${token}${label}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(token);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const active = invites.filter((i) => !i.revokedAt && (!i.expiresAt || new Date(i.expiresAt) > new Date()));
  const inactive = invites.filter((i) => i.revokedAt || (i.expiresAt && new Date(i.expiresAt) <= new Date()));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Create form */}
      <div style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 16 }}>Generate Invite Link</h2>
        <form onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 500, display: "block", marginBottom: 4 }}>ROLE</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as "investor" | "customer" }))}
                style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, background: C.white, outline: "none" }}
              >
                <option value="customer">Customer</option>
                <option value="investor">Investor</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, fontWeight: 500, display: "block", marginBottom: 4 }}>LABEL (internal)</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => { setForm((f) => ({ ...f, label: e.target.value })); setError(""); }}
                placeholder="e.g. Karim — investor"
                style={{ width: "100%", border: `1px solid ${error ? C.red : C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, background: C.white, outline: "none", boxSizing: "border-box" }}
              />
              {error && <p style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</p>}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, fontWeight: 500, display: "block", marginBottom: 4 }}>EXPIRY DATE (optional)</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, background: C.white, outline: "none" }}
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            style={{
              alignSelf: "flex-start",
              padding: "9px 20px",
              background: creating ? "rgba(61,122,36,0.4)" : C.green,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
            }}
          >
            {creating ? "Generating…" : "Generate Link"}
          </button>
        </form>
      </div>

      {/* Active invites */}
      {loading ? (
        <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          <h3 style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Active ({active.length})
          </h3>
          {active.length === 0 && (
            <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>No active invites yet.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {active.map((inv) => (
              <InviteRow
                key={inv.token}
                invite={inv}
                origin={origin}
                copied={copied === inv.token}
                onCopy={() => copy(inv.token)}
                onRevoke={() => revoke(inv.token)}
              />
            ))}
          </div>

          {inactive.length > 0 && (
            <>
              <h3 style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Expired / Revoked ({inactive.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {inactive.map((inv) => (
                  <InviteRow key={inv.token} invite={inv} origin={origin} copied={false} onCopy={() => copy(inv.token)} onRevoke={() => {}} disabled />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function InviteRow({ invite, origin, copied, onCopy, onRevoke, disabled }: {
  invite: InviteToken; origin: string; copied: boolean; onCopy: () => void; onRevoke: () => void; disabled?: boolean;
}) {
  const url = `${origin}/invite/${invite.token}?for=${encodeURIComponent(invite.label)}`;
  const roleBg = invite.role === "investor" ? "#EFF6FF" : C.greenBg;
  const roleColor = invite.role === "investor" ? "#1D4ED8" : C.green;

  return (
    <div style={{
      background: disabled ? "#F9FAFB" : C.white,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      gap: 12,
      opacity: disabled ? 0.6 : 1,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "3px 8px", borderRadius: 6, background: roleBg, color: roleColor }}>
        {invite.role}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {invite.label}
        </p>
        <p style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url}
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        {invite.usedAt && <span style={{ fontSize: 10, color: C.emerald }}>Used</span>}
        {invite.expiresAt && <span style={{ fontSize: 10, color: C.muted }}>Exp {new Date(invite.expiresAt).toLocaleDateString()}</span>}
        {invite.revokedAt && <span style={{ fontSize: 10, color: C.red }}>Revoked</span>}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onCopy}
            style={{ padding: "6px 12px", background: copied ? "#D1FAE5" : C.greenBg, color: copied ? "#065F46" : C.green, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={onRevoke}
            style={{ padding: "6px 10px", background: "#FEF2F2", color: C.red, border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}

// ── CRM Tab ───────────────────────────────────────────────────────────────────
type CrmSubTab = "pipeline" | "contacts" | "clients" | "registry";

const STAGE_CFG: Record<CrmContact["stage"], { label: string; color: string; bg: string; border: string }> = {
  lead:           { label: "Lead",           color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  prospect:       { label: "Prospect",       color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  reserved:       { label: "Reserved",       color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  under_contract: { label: "Under Contract", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  sold:           { label: "Sold",           color: "#059669", bg: "#D1FAE5", border: "#6EE7B7" },
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website", referral: "Referral", agent: "Agent",
  social: "Social", direct: "Direct", other: "Other",
};

function StageBadge({ stage }: { stage: CrmContact["stage"] }) {
  const cfg = STAGE_CFG[stage];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
      padding: "2px 7px", borderRadius: 5,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Contact Form Modal ─────────────────────────────────────────────────────────
function ContactModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<CrmContact>;
  onSave: (data: Partial<CrmContact>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<CrmContact>>(initial ?? { stage: "lead", payments: [] });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const set = (k: keyof CrmContact, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name?.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    setErr("");
    try { await onSave(form); onClose(); }
    catch { setErr("Failed to save. Try again."); setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "8px 10px", fontSize: 13, color: C.ink, background: C.white,
    outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, color: C.muted, fontWeight: 500, display: "block", marginBottom: 4 };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: C.white, borderRadius: 16, width: "100%", maxWidth: 520,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{initial?.id ? "Edit Contact" : "Add Contact"}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted, lineHeight: 1 }}>×</button>
        </div>
        <form onSubmit={submit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>NAME *</label>
              <input style={{ ...inputStyle, borderColor: err && !form.name ? C.red : C.border }}
                value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input style={inputStyle} type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="email@example.com" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>PHONE</label>
              <input style={inputStyle} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+961 ..." />
            </div>
            <div>
              <label style={labelStyle}>NATIONALITY</label>
              <input style={inputStyle} value={form.nationality ?? ""} onChange={(e) => set("nationality", e.target.value)} placeholder="e.g. Lebanese" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>STAGE</label>
              <select style={inputStyle} value={form.stage ?? "lead"} onChange={(e) => set("stage", e.target.value)}>
                {Object.entries(STAGE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SOURCE</label>
              <select style={inputStyle} value={form.source ?? ""} onChange={(e) => set("source", e.target.value)}>
                <option value="">—</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>INTERESTED LOT</label>
              <input style={inputStyle} type="number" min={1} max={101}
                value={form.assignedLotId ?? ""} onChange={(e) => set("assignedLotId", e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Lot #" />
            </div>
          </div>

          {form.assignedLotId && (form.stage === "reserved" || form.stage === "under_contract" || form.stage === "sold") && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <span style={{ fontSize: 12, color: "#1D4ED8" }}>
                Lot #{form.assignedLotId} status will be updated to <strong>{form.stage === "under_contract" ? "Under Contract" : form.stage.charAt(0).toUpperCase() + form.stage.slice(1)}</strong> on save.
              </span>
            </div>
          )}

          <div>
            <label style={labelStyle}>BUDGET (USD)</label>
            <input style={inputStyle} type="number"
              value={form.budget ?? ""} onChange={(e) => set("budget", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="e.g. 450000" />
          </div>

          <div>
            <label style={labelStyle}>NOTES</label>
            <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 72, fontFamily: "inherit" }}
              value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              placeholder="Any notes about this contact..." />
          </div>

          {err && <p style={{ color: C.red, fontSize: 12 }}>{err}</p>}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", color: C.ink }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ padding: "9px 20px", background: saving ? "rgba(61,122,36,0.4)" : C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Payment Modal ──────────────────────────────────────────────────────────────
function PaymentModal({
  contactName,
  payments,
  onSave,
  onClose,
}: {
  contactName: string;
  payments: CrmPayment[];
  onSave: (payments: CrmPayment[]) => Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState<CrmPayment[]>(payments.length ? [...payments] : []);
  const [saving, setSaving] = useState(false);

  function addRow() {
    setList((l) => [...l, { id: crypto.randomUUID(), label: "", amount: 0, dueDate: "", status: "pending" }]);
  }
  function updateRow(idx: number, key: keyof CrmPayment, val: string | number) {
    setList((l) => l.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  }
  function removeRow(idx: number) {
    setList((l) => l.filter((_, i) => i !== idx));
  }
  function togglePaid(idx: number) {
    setList((l) => l.map((p, i) => {
      if (i !== idx) return p;
      if (p.status === "paid") return { ...p, status: "pending" as const, paidDate: undefined };
      return { ...p, status: "paid" as const, paidDate: new Date().toISOString().slice(0, 10) };
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(list); onClose(); }
    catch { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px",
    fontSize: 12, color: C.ink, background: C.white, outline: "none",
  };

  const totalPaid = list.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalDue = list.reduce((s, p) => s + p.amount, 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 680, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 4 }}>Payment Schedule</h2>
            <p style={{ fontSize: 12, color: C.muted }}>{contactName}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: C.muted, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ padding: 24 }}>
          {/* Summary bar */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: "12px 16px", background: C.bg, borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{fmtUSD(totalDue)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Paid</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.emerald }}>{fmtUSD(totalPaid)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Balance</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: totalDue - totalPaid > 0 ? C.amber : C.emerald }}>{fmtUSD(totalDue - totalPaid)}</div>
            </div>
          </div>

          {/* Payment rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {list.map((p, idx) => (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8, alignItems: "center", padding: "8px 10px", background: p.status === "paid" ? "#F0FDF4" : C.white, border: `1px solid ${p.status === "paid" ? "#BBF7D0" : C.border}`, borderRadius: 9 }}>
                <input
                  style={{ ...inputStyle, width: "100%" }}
                  value={p.label} onChange={(e) => updateRow(idx, "label", e.target.value)}
                  placeholder="e.g. Deposit (30%)"
                />
                <input
                  style={{ ...inputStyle, width: 100, textAlign: "right" }}
                  type="number" value={p.amount || ""}
                  onChange={(e) => updateRow(idx, "amount", Number(e.target.value))}
                  placeholder="Amount $"
                />
                <input
                  style={{ ...inputStyle, width: 120 }}
                  type="date" value={p.dueDate}
                  onChange={(e) => updateRow(idx, "dueDate", e.target.value)}
                />
                <button type="button" onClick={() => togglePaid(idx)} style={{
                  padding: "5px 10px", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: p.status === "paid" ? "#D1FAE5" : "#F3F4F6",
                  color: p.status === "paid" ? "#065F46" : C.muted,
                  whiteSpace: "nowrap",
                }}>
                  {p.status === "paid" ? "✓ Paid" : "Mark Paid"}
                </button>
                <button type="button" onClick={() => removeRow(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addRow} style={{ background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 8, width: "100%", padding: "8px", fontSize: 12, color: C.muted, cursor: "pointer", marginBottom: 16 }}>
            + Add Payment Milestone
          </button>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 18px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", color: C.ink }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "9px 20px", background: saving ? "rgba(61,122,36,0.4)" : C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Payments"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pipeline Kanban ─────────────────────────────────────────────────────────────
function PipelineView({
  contacts,
  onEdit,
  onStageChange,
}: {
  contacts: CrmContact[];
  onEdit: (c: CrmContact) => void;
  onStageChange: (id: string, stage: CrmContact["stage"]) => void;
}) {
  const stages: CrmContact["stage"][] = ["lead", "prospect", "reserved", "under_contract", "sold"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, overflowX: "auto" }}>
      {stages.map((stage) => {
        const cfg = STAGE_CFG[stage];
        const cards = contacts.filter((c) => c.stage === stage);
        return (
          <div key={stage} style={{ minWidth: 160 }}>
            {/* Column header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "8px 10px", background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>{cfg.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cards.length}</span>
            </div>
            {/* Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {cards.map((c) => (
                <div key={c.id} style={{
                  background: C.white, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "10px 12px", cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }} onClick={() => onEdit(c)}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 3, lineHeight: 1.3 }}>{c.name}</p>
                  {c.email && <p style={{ fontSize: 11, color: C.muted, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.email}</p>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {c.assignedLotId && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", background: C.greenBg, color: C.green, borderRadius: 4 }}>Lot {c.assignedLotId}</span>
                    )}
                    {c.source && (
                      <span style={{ fontSize: 9, padding: "2px 5px", background: C.bg, color: C.muted, borderRadius: 4 }}>{SOURCE_LABELS[c.source] || c.source}</span>
                    )}
                    {c.budget && (
                      <span style={{ fontSize: 9, padding: "2px 5px", background: C.bg, color: C.muted, borderRadius: 4 }}>{fmtUSD(c.budget)}</span>
                    )}
                  </div>
                  {/* Move forward/back */}
                  <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                    {stage !== "lead" && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); const prev = stages[stages.indexOf(stage) - 1]; onStageChange(c.id, prev); }}
                        style={{ flex: 1, padding: "3px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, fontSize: 10, color: C.muted, cursor: "pointer" }}>
                        ←
                      </button>
                    )}
                    {stage !== "sold" && (
                      <button type="button" onClick={(e) => { e.stopPropagation(); const next = stages[stages.indexOf(stage) + 1]; onStageChange(c.id, next); }}
                        style={{ flex: 1, padding: "3px", background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 5, fontSize: 10, color: cfg.color, cursor: "pointer" }}>
                        →
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {cards.length === 0 && (
                <div style={{ padding: "16px 12px", textAlign: "center", color: C.muted, fontSize: 11, background: C.bg, borderRadius: 8, border: `1.5px dashed ${C.border}` }}>
                  No contacts
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Contacts List View ──────────────────────────────────────────────────────────
function ContactsListView({
  contacts,
  onEdit,
  onDelete,
  onPayments,
  stageFilter,
}: {
  contacts: CrmContact[];
  onEdit: (c: CrmContact) => void;
  onDelete: (id: string) => void;
  onPayments: (c: CrmContact) => void;
  stageFilter?: CrmContact["stage"][];
}) {
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<CrmContact["stage"] | "all">(stageFilter ? "all" : "all");

  const filtered = contacts.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stage === "all" || c.stage === stage;
    const matchFilter = !stageFilter || stageFilter.includes(c.stage);
    return matchSearch && matchStage && matchFilter;
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          style={{ flex: 1, minWidth: 160, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 13, color: C.ink, background: C.white, outline: "none" }}
        />
        {!stageFilter && (
          <select value={stage} onChange={(e) => setStage(e.target.value as CrmContact["stage"] | "all")}
            style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: C.ink, background: C.white, outline: "none" }}>
            <option value="all">All Stages</option>
            {Object.entries(STAGE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bg }}>
              {["Name", "Email / Phone", "Stage", "Lot", "Budget", "Source", "Payments", "Actions"].map((h) => (
                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${C.border}` }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 13 }}>No contacts found.</td></tr>
            )}
            {filtered.map((c, i) => {
              const totalPaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
              const totalDue = c.payments.reduce((s, p) => s + p.amount, 0);
              return (
                <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", background: i % 2 === 0 ? C.white : C.bg }}>
                  <td style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{c.name}</p>
                    {c.nationality && <p style={{ fontSize: 11, color: C.muted }}>{c.nationality}</p>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <p style={{ fontSize: 12, color: C.ink }}>{c.email || "—"}</p>
                    <p style={{ fontSize: 11, color: C.muted }}>{c.phone || ""}</p>
                  </td>
                  <td style={{ padding: "10px 14px" }}><StageBadge stage={c.stage} /></td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.ink }}>{c.assignedLotId ? `#${c.assignedLotId}` : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: C.ink }}>{c.budget ? fmtUSD(c.budget) : "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: C.muted }}>{c.source ? SOURCE_LABELS[c.source] : "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.payments.length > 0 ? (
                      <div>
                        <p style={{ fontSize: 12, color: C.emerald, fontWeight: 600 }}>{fmtUSD(totalPaid)} paid</p>
                        {totalDue > totalPaid && <p style={{ fontSize: 11, color: C.amber }}>{fmtUSD(totalDue - totalPaid)} due</p>}
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: C.muted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => onEdit(c)} style={{ padding: "4px 10px", background: C.greenBg, color: C.green, border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => onPayments(c)} style={{ padding: "4px 10px", background: "#EFF6FF", color: "#1D4ED8", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>💳</button>
                      <button onClick={() => { if (confirm(`Delete ${c.name}?`)) onDelete(c.id); }} style={{ padding: "4px 8px", background: "#FEF2F2", color: C.red, border: "none", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>×</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Buyer Registry ─────────────────────────────────────────────────────────────
const PAYMENT_MILESTONES = [
  { key: "signing",    label: "Signing",    pct: 0.30 },
  { key: "foundation", label: "Foundation", pct: 0.20 },
  { key: "structure",  label: "Structure",  pct: 0.20 },
  { key: "handover",   label: "Handover",   pct: 0.30 },
];

const DEV_TYPE_LABELS: Record<string, string> = {
  twin_villa: "Twin Villa", villa_2f: "Villa 2F", villa_3f: "Villa 3F",
  apartments: "Apartments", lot_sale: "Land Plot", unassigned: "—",
};

const MILESTONE_STATUS_CFG = {
  paid:    { label: "Paid",    bg: "#D1FAE5", color: "#065F46", border: "#6EE7B7", dot: "#10B981" },
  pending: { label: "Pending", bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF" },
  overdue: { label: "Overdue", bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5", dot: "#EF4444" },
};

function BuyerRegistryView({
  contacts,
  onPayments,
}: {
  contacts: CrmContact[];
  onPayments: (c: CrmContact) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const assignments = useSimulationStore((s) => s.assignments);
  const buyers = contacts.filter((c) =>
    (["reserved", "under_contract", "sold"] as CrmContact["stage"][]).includes(c.stage)
  );

  // Summary KPIs
  const totalExpected = buyers.reduce((s, b) => {
    const pTotal = b.payments.reduce((t, p) => t + p.amount, 0);
    return s + (b.budget ?? pTotal);
  }, 0);
  const totalPaid = buyers.flatMap((b) => b.payments).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = buyers.flatMap((b) => b.payments).filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const totalOverdue = buyers.flatMap((b) => b.payments).filter((p) => p.status === "overdue").reduce((s, p) => s + p.amount, 0);
  const collectionPct = totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

  function getDevType(lotId?: number): string {
    if (!lotId) return "—";
    const asgn = assignments.get(lotId);
    return asgn ? (DEV_TYPE_LABELS[asgn.developmentType] ?? asgn.developmentType) : "—";
  }

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total Buyers",       val: String(buyers.length),        color: C.ink    },
          { label: "Expected Revenue",   val: fmtUSD(totalExpected),        color: C.ink    },
          { label: "Collected",          val: fmtUSD(totalPaid),            color: "#059669" },
          { label: "Outstanding",        val: fmtUSD(totalPending + totalOverdue), color: C.amber },
          { label: "Overdue",            val: fmtUSD(totalOverdue),         color: C.red    },
          { label: "Collection Rate",    val: `${collectionPct.toFixed(0)}%`, color: collectionPct >= 50 ? "#059669" : C.amber },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Collection progress bar */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>Overall Collection Progress</span>
          <span style={{ fontSize: 11, color: C.muted }}>{fmtUSD(totalPaid)} / {fmtUSD(totalExpected)}</span>
        </div>
        <div style={{ height: 10, background: "#F3F4F6", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, collectionPct)}%`, background: "#059669", borderRadius: 5, transition: "width 0.5s ease" }} />
        </div>
      </div>

      {buyers.length === 0 ? (
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "40px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>
          No buyers yet. Contacts move here when their stage reaches Reserved / Under Contract / Sold.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {buyers.map((buyer) => {
            const totalPrice = buyer.budget ?? buyer.payments.reduce((s, p) => s + p.amount, 0);
            const paid = buyer.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
            const paidPct = totalPrice > 0 ? Math.round((paid / totalPrice) * 100) : 0;
            const isExpanded = expanded === buyer.id;
            const lotRow = buyer.assignedLotId ? LOTS.find((l) => l.id === buyer.assignedLotId) : null;

            // Build milestone rows from payments or synthesize from budget
            const milestoneRows: Array<{
              label: string; pct: number; expected: number;
              payment?: CrmPayment; status: "paid" | "pending" | "overdue";
            }> = PAYMENT_MILESTONES.map((m, i) => {
              const expected = Math.round(totalPrice * m.pct);
              const payment = buyer.payments[i];
              const status: "paid" | "pending" | "overdue" = payment
                ? payment.status
                : "pending";
              return { label: m.label, pct: m.pct, expected, payment, status };
            });

            return (
              <div key={buyer.id} style={{
                background: C.white, border: `1px solid ${C.border}`, borderRadius: 12,
                overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}>
                {/* Buyer header row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : buyer.id)}
                  style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 180px 80px 36px", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer" }}
                >
                  {/* Name + contact */}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{buyer.name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{buyer.email}{buyer.phone ? ` · ${buyer.phone}` : ""}</div>
                  </div>
                  {/* Lot + stage */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: C.ink }}>
                      {buyer.assignedLotId ? `Lot ${buyer.assignedLotId}` : "No lot"}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {lotRow ? DEV_TYPE_LABELS[lotRow.id.toString()] || "—" : "—"}
                    </div>
                  </div>
                  {/* Price + paid */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.ink }}>{fmtUSD(totalPrice)}</div>
                    <div style={{ fontSize: 11, color: "#059669" }}>{fmtUSD(paid)} paid ({paidPct}%)</div>
                  </div>
                  {/* Milestone chips */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {milestoneRows.map((m) => {
                      const cfg = MILESTONE_STATUS_CFG[m.status];
                      return (
                        <div key={m.label} title={`${m.label}: ${fmtUSD(m.expected)} · ${m.status}`}
                          style={{ flex: 1, textAlign: "center", padding: "3px 2px", borderRadius: 5, fontSize: 8, fontWeight: 700,
                            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                          {m.label.slice(0, 4).toUpperCase()}
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, margin: "2px auto 0" }} />
                        </div>
                      );
                    })}
                  </div>
                  {/* Stage badge */}
                  <StageBadge stage={buyer.stage} />
                  {/* Expand chevron */}
                  <span style={{ color: C.muted, fontSize: 14, textAlign: "center", userSelect: "none" }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>

                {/* Expanded payment detail */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "14px 16px", background: "#F9FBF7" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>Payment Milestones</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPayments(buyer); }}
                        style={{ padding: "5px 12px", background: C.green, color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                      >
                        Edit Payments
                      </button>
                    </div>
                    {/* Milestone table */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {milestoneRows.map((m, idx) => {
                        const cfg = MILESTONE_STATUS_CFG[m.status];
                        return (
                          <div key={idx} style={{ display: "grid", gridTemplateColumns: "110px 1fr 90px 120px 90px", gap: 10, alignItems: "center",
                            background: C.white, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: "8px 12px" }}>
                            {/* Milestone label */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink }}>{m.label}</div>
                              <div style={{ fontSize: 9, color: C.muted }}>{(m.pct * 100).toFixed(0)}% of total</div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 6, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: m.status === "paid" ? "100%" : "0%",
                                background: cfg.dot, borderRadius: 3, transition: "width 0.4s ease" }} />
                            </div>
                            {/* Expected */}
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.ink }}>{fmtUSD(m.expected)}</div>
                            {/* Dates */}
                            <div>
                              {m.payment?.dueDate && (
                                <div style={{ fontSize: 10, color: C.muted }}>Due: {m.payment.dueDate}</div>
                              )}
                              {m.payment?.paidDate && (
                                <div style={{ fontSize: 10, color: "#059669" }}>Paid: {m.payment.paidDate}</div>
                              )}
                              {!m.payment && <div style={{ fontSize: 10, color: C.muted }}>Not scheduled</div>}
                            </div>
                            {/* Status badge */}
                            <div style={{ padding: "3px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700, textAlign: "center",
                              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                              {cfg.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Notes */}
                    {buyer.notes && (
                      <div style={{ marginTop: 10, fontSize: 11, color: C.muted, background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px" }}>
                        📝 {buyer.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── CRM Tab main ───────────────────────────────────────────────────────────────
function CrmTab() {
  const [subTab, setSubTab] = useState<CrmSubTab>("pipeline");
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editContact, setEditContact] = useState<CrmContact | null | "new">(null);
  const [paymentsContact, setPaymentsContact] = useState<CrmContact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/contacts");
      if (res.ok) setContacts(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveContact(data: Partial<CrmContact>) {
    if (editContact && editContact !== "new" && editContact.id) {
      await fetch("/api/admin/contacts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, id: editContact.id }) });
    } else {
      await fetch("/api/admin/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    }
    await load();
  }

  async function deleteContact(id: string) {
    await fetch(`/api/admin/contacts?id=${id}`, { method: "DELETE" });
    await load();
  }

  async function changeStage(id: string, stage: CrmContact["stage"]) {
    await fetch("/api/admin/contacts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, stage }) });
    await load();
  }

  async function savePayments(payments: CrmPayment[]) {
    if (!paymentsContact) return;
    await fetch("/api/admin/contacts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: paymentsContact.id, payments }) });
    await load();
  }

  const clientStages: CrmContact["stage"][] = ["reserved", "under_contract", "sold"];
  const clients = contacts.filter((c) => clientStages.includes(c.stage));
  const buyers = clients; // alias — same set, used for registry tab label

  // KPIs
  const totalRevenue = clients.flatMap((c) => c.payments).reduce((s, p) => s + p.amount, 0);
  const totalPaid = clients.flatMap((c) => c.payments).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

  const SUB_TABS: { id: CrmSubTab; label: string }[] = [
    { id: "pipeline", label: "Pipeline" },
    { id: "contacts", label: `All Contacts (${contacts.length})` },
    { id: "clients",  label: `Clients (${clients.length})` },
    { id: "registry", label: `Registry (${buyers.length})` },
  ];

  return (
    <div>
      {/* Sub-tab nav */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: 4, width: "fit-content" }}>
        {SUB_TABS.map((s) => (
          <button key={s.id} onClick={() => setSubTab(s.id)} style={{
            padding: "7px 16px", border: "none", borderRadius: 7, fontSize: 12, fontWeight: subTab === s.id ? 600 : 400,
            background: subTab === s.id ? C.green : "transparent", color: subTab === s.id ? "#fff" : C.muted, cursor: "pointer",
            transition: "all 0.15s",
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {(["lead", "prospect", "reserved", "under_contract", "sold"] as CrmContact["stage"][]).map((stage) => {
          const cfg = STAGE_CFG[stage];
          const count = contacts.filter((c) => c.stage === stage).length;
          return (
            <div key={stage} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{cfg.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.ink }}>{count}</div>
            </div>
          );
        })}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Collected</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.emerald }}>{fmtUSD(totalPaid)}</div>
          <div style={{ fontSize: 10, color: C.muted }}>of {fmtUSD(totalRevenue)}</div>
        </div>
      </div>

      {/* Add contact button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setEditContact("new")} style={{
          padding: "9px 18px", background: C.green, color: "#fff", border: "none", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          + Add Contact
        </button>
      </div>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 13 }}>Loading…</p>
      ) : (
        <>
          {subTab === "pipeline" && (
            <PipelineView contacts={contacts} onEdit={setEditContact} onStageChange={changeStage} />
          )}
          {subTab === "contacts" && (
            <ContactsListView contacts={contacts} onEdit={setEditContact} onDelete={deleteContact} onPayments={setPaymentsContact} />
          )}
          {subTab === "clients" && (
            <ContactsListView
              contacts={contacts}
              onEdit={setEditContact}
              onDelete={deleteContact}
              onPayments={setPaymentsContact}
              stageFilter={clientStages}
            />
          )}
          {subTab === "registry" && (
            <BuyerRegistryView contacts={contacts} onPayments={setPaymentsContact} />
          )}
        </>
      )}

      {/* Modals */}
      {editContact !== null && (
        <ContactModal
          initial={editContact === "new" ? undefined : editContact}
          onSave={saveContact}
          onClose={() => setEditContact(null)}
        />
      )}
      {paymentsContact && (
        <PaymentModal
          contactName={paymentsContact.name}
          payments={paymentsContact.payments}
          onSave={savePayments}
          onClose={() => setPaymentsContact(null)}
        />
      )}
    </div>
  );
}

// ── Layer Fund Status ─────────────────────────────────────────────────────────
// ── Progress Bar helper ────────────────────────────────────────────────────────
function ProgressBar({ pct, color, bg }: { pct: number; color: string; bg: string }) {
  return (
    <div style={{ height: 8, background: bg, borderRadius: 4, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: pct >= 100 ? "#059669" : color, borderRadius: 4, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ── Investment Tracker (replaces LayerFundStatus) ──────────────────────────────
function InvestmentTracker() {
  const [summary, setSummary] = useState<{ layer1: { totalRaised: number }; layer2: { totalVillas: number } } | null>(null);
  const [tickets, setTickets] = useState<TicketPurchase[]>([]);
  const [invConfig, setInvConfig] = useState<InvestmentConfig>(DEFAULT_INVESTMENT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tickets/summary").then((r) => r.ok ? r.json() : null),
      fetch("/api/tickets/all").then((r) => r.ok ? r.json() : []),
      fetch("/api/investment/config").then((r) => r.ok ? r.json() : null),
    ]).then(([s, t, c]) => {
      if (s) setSummary(s);
      if (Array.isArray(t)) setTickets(t);
      if (c) setInvConfig((prev) => ({ ...prev, ...c }));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Derived values
  const l1Raised   = summary?.layer1.totalRaised ?? 0;
  const l2Villas   = summary?.layer2.totalVillas ?? 0;
  const l1Target   = invConfig.l1FundSize;
  const l2Total    = invConfig.investorFundedVillas;
  const l1Pct      = l1Target > 0 ? (l1Raised / l1Target) * 100 : 0;
  const l2Pct      = l2Total  > 0 ? (l2Villas / l2Total)  * 100 : 0;

  const l1Tickets  = tickets.filter((t) => t.layer === "layer1");
  const l2Tickets  = tickets.filter((t) => t.layer === "layer2");
  const completedTickets = tickets.filter((t) => t.status === "exited");

  // Phase breakdown from ticket.phase field
  const byPhase: Record<number, { l1: number; l2: number; completed: number }> = {
    1: { l1: 0, l2: 0, completed: 0 },
    2: { l1: 0, l2: 0, completed: 0 },
    3: { l1: 0, l2: 0, completed: 0 },
  };
  for (const t of tickets) {
    const ph = t.phase ?? 1;
    if (ph === 1 || ph === 2 || ph === 3) {
      if (t.layer === "layer1") byPhase[ph].l1++;
      else byPhase[ph].l2++;
      if (t.status === "exited") byPhase[ph].completed++;
    }
  }

  // L1 Exit Tracker — sqm monetized via completed exits
  const landPerVilla = invConfig.landPerVilla;
  const l1SharePerVilla = landPerVilla * invConfig.l1InvestorShare;
  const sqmMonetized = completedTickets.reduce((acc, t) => {
    const villas = t.villaCount ?? (t.layer === "layer1" ? 0 : 1);
    return acc + villas * l1SharePerVilla;
  }, 0);
  const totalSqmToMonetize = invConfig.l1FundSize / invConfig.l1EntryPrice; // total sqm in fund
  const sqmRemaining = Math.max(0, totalSqmToMonetize - sqmMonetized);
  const sqmExitPct = totalSqmToMonetize > 0 ? (sqmMonetized / totalSqmToMonetize) * 100 : 0;

  // Waterfall Running Totals (completed tickets only)
  const waterfallPhase1 = computeWaterfall(invConfig, 0);
  const l2Distributed  = completedTickets.reduce((acc, t) => acc + (t.villaCount ?? 0) * waterfallPhase1.l2InvestorProfit, 0);
  const ownerDistributed = completedTickets.reduce((acc, t) => acc + (t.villaCount ?? 0) * waterfallPhase1.ownerProfit, 0);
  const l1Distributed  = completedTickets.reduce((acc, t) => acc + (t.villaCount ?? 0) * waterfallPhase1.l1LandPayment, 0);

  // Continuation Decision — Phase 1 vs Phase 2
  const wfP1 = computeWaterfall(invConfig, 0);
  const wfP2 = computeWaterfall(invConfig, 1);
  const villasPhase1 = invConfig.investorFundedVillas;
  const exitTotalL2   = wfP1.l2InvestorTotal * villasPhase1;
  const stayTotalL2   = wfP2.l2InvestorTotal * villasPhase1;
  const p2LandPrice   = invConfig.phaseLandPrices[1]?.pricePerSqm ?? invConfig.phaseLandPrices[0]?.pricePerSqm ?? 275;

  if (loading) {
    return (
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <p style={{ color: C.muted, fontSize: 13 }}>Loading investment tracker…</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "20px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>Investment Tracker</h2>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, background: "#F3F4F6", padding: "3px 8px", borderRadius: 5 }}>ADMIN VIEW</span>
      </div>

      {/* ── A. Fund Progress ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          A — Fund Progress
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* L1 */}
          <div style={{ padding: "14px 16px", background: "#EFF6FF", borderRadius: 10, border: "1px solid #BFDBFE" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#1565C0", textTransform: "uppercase", letterSpacing: "0.07em" }}>L1 — Land Fund</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#1565C0", background: "#DBEAFE", padding: "2px 8px", borderRadius: 5 }}>
                {l1Tickets.length} investor{l1Tickets.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#1D4ED8" }}>{fmtUSD(l1Raised)}</span>
              <span style={{ fontSize: 11, color: "#93C5FD" }}>of {fmtUSD(l1Target)}</span>
            </div>
            <ProgressBar pct={l1Pct} color="#3B82F6" bg="#DBEAFE" />
            <div style={{ fontSize: 10, color: "#93C5FD", marginTop: 4, textAlign: "right" }}>{l1Pct.toFixed(1)}% funded</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column" as const, gap: 3 }}>
              {l1Tickets.slice(0, 4).map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#DBEAFE", borderRadius: 5 }}>
                  <span style={{ fontSize: 11, color: "#1E40AF", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "65%" }}>{t.investorName}</span>
                  <span style={{ fontSize: 11, color: "#3B82F6", fontWeight: 700 }}>{fmtUSD(t.amount ?? 0)}</span>
                </div>
              ))}
              {l1Tickets.length === 0 && <p style={{ fontSize: 11, color: "#93C5FD", fontStyle: "italic" }}>No tickets yet.</p>}
              {l1Tickets.length > 4 && <p style={{ fontSize: 10, color: "#93C5FD", textAlign: "right" as const }}>+{l1Tickets.length - 4} more</p>}
            </div>
          </div>

          {/* L2 */}
          <div style={{ padding: "14px 16px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.07em" }}>L2 — Villa Dev</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#C2410C", background: "#FED7AA", padding: "2px 8px", borderRadius: 5 }}>
                {l2Tickets.length} investor{l2Tickets.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#EA580C" }}>{l2Villas} villa{l2Villas !== 1 ? "s" : ""}</span>
              <span style={{ fontSize: 11, color: "#FDBA74" }}>of {l2Total} total</span>
            </div>
            <ProgressBar pct={l2Pct} color="#F97316" bg="#FED7AA" />
            <div style={{ fontSize: 10, color: "#FDBA74", marginTop: 4, textAlign: "right" }}>{l2Pct.toFixed(1)}% allocated</div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column" as const, gap: 3 }}>
              {l2Tickets.slice(0, 4).map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#FED7AA", borderRadius: 5 }}>
                  <span style={{ fontSize: 11, color: "#9A3412", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: "65%" }}>{t.investorName}</span>
                  <span style={{ fontSize: 11, color: "#EA580C", fontWeight: 700 }}>{t.villaCount ?? 0}v</span>
                </div>
              ))}
              {l2Tickets.length === 0 && <p style={{ fontSize: 11, color: "#FDBA74", fontStyle: "italic" }}>No tickets yet.</p>}
              {l2Tickets.length > 4 && <p style={{ fontSize: 10, color: "#FDBA74", textAlign: "right" as const }}>+{l2Tickets.length - 4} more</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── B. Phase Status ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          B — Phase Status
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {([1, 2, 3] as const).map((ph) => {
            const data = byPhase[ph];
            const phColors = ph === 1 ? ["#1D4ED8", "#EFF6FF", "#BFDBFE"] : ph === 2 ? ["#059669", "#ECFDF5", "#A7F3D0"] : ["#7C3AED", "#F5F3FF", "#DDD6FE"];
            return (
              <div key={ph} style={{ padding: "12px 14px", background: phColors[1], borderRadius: 10, border: `1px solid ${phColors[2]}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: phColors[0], textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Phase {ph}</div>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: phColors[0] }}>L1 tickets</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: phColors[0] }}>{data.l1}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: phColors[0] }}>L2 tickets</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: phColors[0] }}>{data.l2}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${phColors[2]}`, paddingTop: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: phColors[0] }}>Completed</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{data.completed}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── C. L1 Exit Tracker ─────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          C — L1 Exit Tracker
        </div>
        <div style={{ padding: "14px 16px", background: "#F5F3FF", borderRadius: 10, border: "1px solid #DDD6FE" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600, marginBottom: 4 }}>Sqm Monetized</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#7C3AED" }}>{sqmMonetized.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqm</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600, marginBottom: 4 }}>Sqm Remaining</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#7C3AED" }}>{sqmRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqm</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "#7C3AED", fontWeight: 600, marginBottom: 4 }}>Exit Progress</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#7C3AED" }}>{sqmExitPct.toFixed(1)}%</div>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar pct={sqmExitPct} color="#8B5CF6" bg="#DDD6FE" />
          </div>
          <p style={{ fontSize: 10, color: "#A78BFA", marginTop: 6 }}>
            Total fund sqm: {totalSqmToMonetize.toLocaleString(undefined, { maximumFractionDigits: 0 })} sqm @ ${invConfig.l1EntryPrice}/sqm entry, ${invConfig.l1ExitPriceCap}/sqm exit cap
          </p>
        </div>
      </div>

      {/* ── D. Waterfall Summary (running totals) ─────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          D — Waterfall Summary (Completed Exits)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "L2 Investor Distributed", value: l2Distributed, projection: waterfallPhase1.l2InvestorProfit * villasPhase1, color: "#EA580C" },
            { label: "Owner Distributed", value: ownerDistributed, projection: waterfallPhase1.ownerProfit * villasPhase1, color: "#1565C0" },
            { label: "L1 Land Exits", value: l1Distributed, projection: waterfallPhase1.l1LandPayment * villasPhase1, color: "#7C3AED" },
          ].map((item) => (
            <div key={item.label} style={{ padding: "12px 14px", background: C.white, borderRadius: 10, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{fmtUSD(item.value)}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                vs proj. {fmtUSD(item.projection)}
              </div>
              {item.projection > 0 && (
                <div style={{ marginTop: 5 }}>
                  <ProgressBar pct={(item.value / item.projection) * 100} color={item.color} bg={item.color + "20"} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── E. Continuation Decision ──────────────────────────────── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          E — Continuation Decision
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {/* Exit after Phase 1 */}
          <div style={{ padding: "14px 16px", background: "#FFF7ED", borderRadius: 10, border: "1px solid #FED7AA" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#C2410C", marginBottom: 10 }}>🚪 Exit After Phase 1</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>L2 Investor Total</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>{fmtUSD(exitTotalL2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>L2 ROI on cash</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>{(wfP1.l2InvestorROI * 100).toFixed(1)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>Land price used</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EA580C" }}>${invConfig.phaseLandPrices[0]?.pricePerSqm ?? 275}/sqm</span>
              </div>
            </div>
          </div>

          {/* Stay Phase 2 */}
          <div style={{ padding: "14px 16px", background: "#ECFDF5", borderRadius: 10, border: "1px solid #A7F3D0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#065F46", marginBottom: 10 }}>⬆️ Stay — Phase 2</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>L2 Investor Total</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{fmtUSD(stayTotalL2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>L2 ROI on cash</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{(wfP2.l2InvestorROI * 100).toFixed(1)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: C.muted }}>Land price used</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>${p2LandPrice}/sqm</span>
              </div>
            </div>
            <div style={{ marginTop: 8, padding: "6px 10px", background: stayTotalL2 > exitTotalL2 ? "#D1FAE5" : "#FEF3C7", borderRadius: 6, fontSize: 10, fontWeight: 600, color: stayTotalL2 > exitTotalL2 ? "#065F46" : "#92400E", textAlign: "center" as const }}>
              {stayTotalL2 > exitTotalL2
                ? `+${fmtUSD(stayTotalL2 - exitTotalL2)} extra by staying`
                : `${fmtUSD(exitTotalL2 - stayTotalL2)} lost by staying`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const assignments = useSimulationStore((s) => s.assignments);
  const lotStatuses = useSimulationStore((s) => s.lotStatuses);
  const setLotStatus = useSimulationStore((s) => s.setLotStatus);

  const summary = useMemo(() => {
    let totalRevenue = 0;
    let assignedCount = 0;
    const statusCounts: Record<LotStatus, number> = { available: 0, reserved: 0, under_contract: 0, sold: 0 };
    const byPhase: Record<number, { count: number; revenue: number }> = { 0: { count: 0, revenue: 0 }, 1: { count: 0, revenue: 0 }, 2: { count: 0, revenue: 0 }, 3: { count: 0, revenue: 0 } };

    for (const lot of LOTS) {
      const a = assignments.get(lot.id);
      const dt = a?.developmentType ?? "unassigned";
      const ph = a?.phase ?? 0;
      const status = lotStatuses.get(lot.id) ?? "available";
      statusCounts[status]++;
      if (dt !== "unassigned") {
        assignedCount++;
        const fin = calculateLotFinancials(lot, dt as DevelopmentType);
        totalRevenue += fin.revenue;
        byPhase[ph] = { count: (byPhase[ph]?.count ?? 0) + 1, revenue: (byPhase[ph]?.revenue ?? 0) + fin.revenue };
      }
    }
    return { totalRevenue, assignedCount, statusCounts, byPhase };
  }, [assignments, lotStatuses]);

  const STATUS_CFG: Record<LotStatus, { label: string; color: string; bg: string }> = {
    available:      { label: "Available",      color: C.emerald,  bg: "#D1FAE5" },
    reserved:       { label: "Reserved",       color: C.amber,    bg: "#FEF3C7" },
    under_contract: { label: "Under Contract", color: C.orange,   bg: "#FFEDD5" },
    sold:           { label: "Sold",           color: C.red,      bg: "#FEE2E2" },
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {(["available", "reserved", "under_contract", "sold"] as LotStatus[]).map((s) => {
          const cfg = STATUS_CFG[s];
          return (
            <div key={s} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{cfg.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{summary.statusCounts[s]}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>lots</div>
            </div>
          );
        })}
      </div>

      {/* Revenue & assigned */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Projected Revenue</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.green, marginTop: 4 }}>{fmtUSD(summary.totalRevenue)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>Lots Configured</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.ink, marginTop: 4 }}>{summary.assignedCount} / {LOTS.length}</div>
          </div>
        </div>
      </div>

      {/* Investment Tracker */}
      <InvestmentTracker />

      {/* Lot status management */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>Lot Status Management</h2>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Click a status chip on any lot to update it.</p>
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {LOTS.filter((lot) => {
            const a = assignments.get(lot.id);
            return a && a.developmentType !== "unassigned";
          }).map((lot) => {
            const a = assignments.get(lot.id)!;
            const status = lotStatuses.get(lot.id) ?? "available";
            return (
              <div key={lot.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, width: 36 }}>#{lot.id}</span>
                <span style={{ fontSize: 12, color: C.ink, flex: 1, textTransform: "capitalize" }}>{a.developmentType.replace(/_/g, " ")}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["available", "reserved", "under_contract", "sold"] as LotStatus[]).map((s) => {
                    const cfg = STATUS_CFG[s];
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setLotStatus([lot.id], s)}
                        style={{
                          padding: "3px 8px",
                          border: active ? `1.5px solid ${cfg.color}` : `1px solid ${C.border}`,
                          borderRadius: 6,
                          background: active ? cfg.bg : "transparent",
                          color: active ? cfg.color : C.muted,
                          fontSize: 10,
                          fontWeight: active ? 700 : 400,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {LOTS.filter((lot) => { const a = assignments.get(lot.id); return !a || a.developmentType === "unassigned"; }).length > 0 && (
            <p style={{ fontSize: 12, color: C.muted, padding: "10px 0" }}>
              {LOTS.filter((lot) => { const a = assignments.get(lot.id); return !a || a.developmentType === "unassigned"; }).length} unassigned lots — assign types in the Simulator first.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────
function SettingsTab() {
  const router = useRouter();
  const investorFeatureFlags = useSimulationStore((s) => s.investorFeatureFlags);
  const setInvestorFeatureFlag = useSimulationStore((s) => s.setInvestorFeatureFlag);

  async function logout() {
    await fetch("/api/gate/logout", { method: "POST" }).catch(() => {});
    document.cookie = "dh_access=; Max-Age=0; path=/";
    document.cookie = "dh_role=; Max-Age=0; path=/";
    router.replace("/gate");
  }

  const vars = [
    { key: "ACCESS_CODE", desc: "General site access (required)", required: true },
    { key: "ADMIN_CODE", desc: "Admin access — type this at /gate to get admin role", required: true },
    { key: "KV_REST_API_URL", desc: "Vercel KV endpoint — enables persistent database (optional: falls back to local fs)", required: false },
    { key: "KV_REST_API_TOKEN", desc: "Vercel KV auth token (required with KV_REST_API_URL)", required: false },
  ];

  const investorFlags: {
    key: keyof typeof investorFeatureFlags;
    label: string;
    desc: string;
  }[] = [
    { key: "showModelB",            label: "Model B — Priority + Split",     desc: "Shows alternative waterfall model toggle on investor returns tab" },
    { key: "showSensitivity",       label: "Sensitivity Analysis section",    desc: "Shows the ROI matrix & cash sensitivity panels on investor page" },
    { key: "showTermSheet",         label: "Term Sheet link",                 desc: "Shows 'View Term Sheet' link in hero and navigation" },
    { key: "showPhasedPricing",     label: "Phased Pricing Simulator",        desc: "Shows Phase C pricing simulator inside the Sensitivity section" },
    { key: "showPhaseBreakdown",    label: "Phase Breakdown charts",          desc: "Shows per-phase bar chart and phase summary cards (project overview)" },
    { key: "showL1ExitMechanisms",  label: "L1 Exit Mechanisms table",        desc: "Shows the Land Fund exit scenarios table on the Deal tab" },
    { key: "showCashFlowHorizon",   label: "Cash Flow Horizon scenarios",     desc: "Shows 3-scenario cash flow projection table on the Deal tab" },
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>

      {/* ── Investor View Controls ── */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 4 }}>Investor View Controls</h2>
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
          Toggle which sections are visible to investors on the <code style={{ background: C.bg, padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>/investor</code> page.
          Changes take effect immediately and are saved to local state.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {investorFlags.map((flag) => {
            const enabled = investorFeatureFlags[flag.key] as boolean;
            return (
              <div key={flag.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: enabled ? C.greenBg : C.bg, borderRadius: 8, border: `1px solid ${enabled ? C.border : C.border}` }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 2 }}>{flag.label}</p>
                  <p style={{ fontSize: 11, color: C.muted }}>{flag.desc}</p>
                </div>
                <button
                  onClick={() => setInvestorFeatureFlag(flag.key, !enabled)}
                  style={{
                    position: "relative",
                    width: 42,
                    height: 24,
                    borderRadius: 12,
                    border: "none",
                    background: enabled ? C.green : "#D1D5DB",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                  title={enabled ? "Click to disable" : "Click to enable"}
                >
                  <span style={{
                    position: "absolute",
                    top: 3,
                    left: enabled ? 21 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    transition: "left 0.2s",
                  }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>Environment Variables</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vars.map((v) => (
            <div key={v.key} style={{ display: "flex", gap: 10, padding: "10px 12px", background: C.bg, borderRadius: 8 }}>
              <code style={{ fontSize: 12, fontFamily: "monospace", color: C.green, fontWeight: 600, flexShrink: 0 }}>{v.key}</code>
              <div>
                <p style={{ fontSize: 12, color: C.ink, marginBottom: 2 }}>{v.desc}</p>
                <span style={{
                  fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: v.required ? "#9CA3AF" : "#6B7280",
                }}>
                  {v.required ? "required" : "optional"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 14 }}>Quick Links</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {["/simulator", "/status", "/assumptions", "/investor", "/customer"].map((href) => (
            <a key={href} href={href} style={{ fontSize: 13, color: C.green, textDecoration: "none", padding: "8px 12px", background: C.greenBg, borderRadius: 8, display: "block" }}>
              {href}
            </a>
          ))}
        </div>
        <button
          onClick={logout}
          style={{ marginTop: 20, padding: "9px 18px", background: "#FEF2F2", color: C.red, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}

// ── Analytics Tab ─────────────────────────────────────────────────────────────
interface StoredEvent {
  id: string;
  event: string;
  page: string;
  sessionId: string;
  data?: Record<string, unknown>;
  ts: number;
  ip: string;
  ua: string;
  inviteToken?: string;
  inviteLabel?: string;
}

const EVENT_COLORS: Record<string, string> = {
  page_view:        "#3B82F6",
  time_on_page:     "#8B5CF6",
  typology_view:    "#10B981",
  unit_open:        "#F59E0B",
  enquire_open:     "#EF4444",
  view_mode_change: "#6B7280",
  tab_change:       "#6366F1",
};

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function InviteBreakdown({ events, invites, filterToken, onFilterToken }: {
  events: StoredEvent[];
  invites: InviteToken[];
  filterToken: string;
  onFilterToken: (t: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const inviteEvents = events.filter(e => e.inviteToken);
  if (inviteEvents.length === 0 && invites.length === 0) return null;

  // Build lookup: token → label from actual invites list (authoritative)
  const inviteMap = new Map<string, string>(invites.map(i => [i.token, i.label]));

  // Group events by token
  const tokenMap = new Map<string, { label: string; events: StoredEvent[] }>();
  for (const e of inviteEvents) {
    const t = e.inviteToken!;
    const label = inviteMap.get(t) ?? e.inviteLabel ?? t.slice(0, 10);
    if (!tokenMap.has(t)) tokenMap.set(t, { label, events: [] });
    tokenMap.get(t)!.events.push(e);
  }

  const rows = Array.from(tokenMap.entries()).map(([token, { label, events: evs }]) => {
    const sessionIds = Array.from(new Set(evs.map(e => e.sessionId)));
    const pages = Array.from(new Set(evs.filter(e => e.event === "page_view").map(e => e.page)));
    const unitOpens = evs.filter(e => e.event === "unit_open");
    const topUnitsMap: Record<string, number> = {};
    for (const e of unitOpens) {
      const k = `Lot ${(e.data as Record<string,unknown>)?.lotId} · ${(e.data as Record<string,unknown>)?.devType}`;
      topUnitsMap[k] = (topUnitsMap[k] ?? 0) + 1;
    }
    const topUnits = Object.entries(topUnitsMap).sort((a, b) => b[1] - a[1]);
    const enquiries = evs.filter(e => e.event === "enquire_open").length;
    const timeSecs = evs
      .filter(e => e.event === "time_on_page")
      .reduce((s, e) => s + ((e.data as Record<string,unknown>)?.seconds as number ?? 0), 0);
    const firstSeen = Math.min(...evs.map(e => e.ts));
    const lastSeen  = Math.max(...evs.map(e => e.ts));
    const ips = Array.from(new Set(evs.map(e => e.ip).filter(ip => ip && ip !== "unknown")));
    // chronological event timeline (newest first for display)
    const timeline = [...evs].sort((a, b) => b.ts - a.ts);
    return { token, label, sessions: sessionIds, pages, topUnits, enquiries, timeSecs, firstSeen, lastSeen, ips, timeline, totalEvents: evs.length };
  }).sort((a, b) => b.lastSeen - a.lastSeen);

  return (
    <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>
          Per Invite Link ({rows.length})
        </h3>
        {filterToken !== "all" && (
          <button onClick={() => onFilterToken("all")}
            style={{ fontSize: 11, padding: "4px 10px", background: "#EEF2FF", color: "#6366F1", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
            ✕ Clear filter
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: C.muted }}>No attributed events yet. Events will appear here once someone visits via an invite link.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map(r => {
            const isExpanded = expanded === r.token;
            const isFiltered = filterToken === r.token;
            return (
              <div key={r.token} style={{
                background: isFiltered ? "#EEF2FF" : "#F9FAFB",
                border: `1px solid ${isFiltered ? "#6366F1" : C.border}`,
                borderRadius: 10,
              }}>
                {/* Header row */}
                <div style={{ padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{r.label || "Unnamed"}</span>
                      <span style={{ fontSize: 10, fontFamily: "monospace", color: C.muted, background: "#F3F4F6", borderRadius: 4, padding: "1px 5px" }}>
                        {r.token.slice(0, 14)}…
                      </span>
                      {r.ips.map(ip => (
                        <span key={ip} style={{ fontSize: 10, fontFamily: "monospace", color: "#6B7280", background: "#F3F4F6", borderRadius: 4, padding: "1px 6px" }}>{ip}</span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 10, color: C.muted }}>First: {fmtTs(r.firstSeen)}</span>
                      <span style={{ fontSize: 10, color: C.muted }}>Last: {fmtTs(r.lastSeen)}</span>
                    </div>
                  </div>

                  {/* KPI pills */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    {[
                      { label: "Sessions",  val: r.sessions.length, color: "#6366F1" },
                      { label: "Events",    val: r.totalEvents,     color: C.ink },
                      { label: "Time",      val: r.timeSecs ? fmtDuration(r.timeSecs) : "—", color: "#8B5CF6" },
                      { label: "Units Opened", val: r.topUnits.reduce((s, [,c]) => s + c, 0), color: C.amber },
                      ...(r.enquiries > 0 ? [{ label: "Enquiries", val: r.enquiries, color: C.red }] : []),
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", fontSize: 11 }}>
                        <span style={{ color: C.muted }}>{label}: </span>
                        <strong style={{ color }}>{val}</strong>
                      </div>
                    ))}
                  </div>

                  {/* Pages visited */}
                  {r.pages.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: C.muted, alignSelf: "center", marginRight: 2 }}>Pages:</span>
                      {r.pages.map(p => (
                        <span key={p} style={{ fontSize: 10, background: "#EEF2FF", color: "#6366F1", borderRadius: 4, padding: "2px 7px" }}>{p}</span>
                      ))}
                    </div>
                  )}

                  {/* Top units */}
                  {r.topUnits.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                      <span style={{ fontSize: 10, color: C.muted, alignSelf: "center", marginRight: 2 }}>Units:</span>
                      {r.topUnits.slice(0, 5).map(([key, count]) => (
                        <span key={key} style={{ fontSize: 10, background: "#FFFBEB", color: "#92400E", borderRadius: 4, padding: "2px 7px" }}>
                          {key}{count > 1 ? ` ×${count}` : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button onClick={() => onFilterToken(isFiltered ? "all" : r.token)}
                      style={{ fontSize: 11, padding: "4px 10px", background: isFiltered ? "#6366F1" : "#EEF2FF", color: isFiltered ? "#fff" : "#6366F1", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                      {isFiltered ? "✓ Filtering" : "Filter events"}
                    </button>
                    <button onClick={() => setExpanded(isExpanded ? null : r.token)}
                      style={{ fontSize: 11, padding: "4px 10px", background: "#F3F4F6", color: C.ink, border: "none", borderRadius: 6, cursor: "pointer" }}>
                      {isExpanded ? "Hide timeline ▲" : `Show timeline (${r.totalEvents}) ▼`}
                    </button>
                  </div>
                </div>

                {/* Expanded event timeline */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px", maxHeight: 280, overflowY: "auto" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Event Timeline</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {r.timeline.map(ev => {
                        const color = EVENT_COLORS[ev.event] ?? "#9CA3AF";
                        return (
                          <div key={ev.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 8px", background: "#F9FAFB", borderRadius: 6, borderLeft: `3px solid ${color}` }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color }}>{ev.event}</span>
                                <span style={{ fontSize: 10, color: C.muted }}>{ev.page}</span>
                                {ev.data && Object.entries(ev.data).map(([k, v]) => (
                                  <span key={k} style={{ fontSize: 9, background: "#E5E7EB", color: "#374151", borderRadius: 3, padding: "1px 4px" }}>{k}: {String(v)}</span>
                                ))}
                              </div>
                              <span style={{ fontSize: 9, color: C.muted }}>{fmtTs(ev.ts)} · {ev.ip}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsTab() {
  const [events, setEvents] = useState<StoredEvent[]>([]);
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [inviteFilter, setInviteFilter] = useState<string>("all"); // "all" or token
  const [clearing, setClearing] = useState(false);

  // Build token→name map for lookups everywhere
  const inviteNameMap = useMemo(() =>
    new Map<string, string>(invites.map(i => [i.token, i.label])),
  [invites]);

  function nameForEvent(ev: StoredEvent): string | undefined {
    if (!ev.inviteToken) return undefined;
    return inviteNameMap.get(ev.inviteToken) ?? ev.inviteLabel ?? undefined;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, invRes] = await Promise.all([
        fetch("/api/analytics/events"),
        fetch("/api/admin/invites"),
      ]);
      if (evRes.ok) setEvents(await evRes.json());
      if (invRes.ok) setInvites(await invRes.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function clearAll() {
    if (!confirm("Clear all analytics events? This cannot be undone.")) return;
    setClearing(true);
    await fetch("/api/analytics/events", { method: "DELETE" });
    setEvents([]);
    setClearing(false);
  }

  // Derived stats
  const sessions = useMemo(() => {
    const map = new Map<string, StoredEvent[]>();
    for (const e of events) {
      if (!map.has(e.sessionId)) map.set(e.sessionId, []);
      map.get(e.sessionId)!.push(e);
    }
    return map;
  }, [events]);

  const pageViews     = events.filter(e => e.event === "page_view").length;
  const enquireOpens  = events.filter(e => e.event === "enquire_open").length;
  const unitOpens     = events.filter(e => e.event === "unit_open").length;

  const avgTime = useMemo(() => {
    const times = events
      .filter(e => e.event === "time_on_page" && typeof (e.data as Record<string,unknown>)?.seconds === "number")
      .map(e => (e.data as Record<string,unknown>).seconds as number);
    if (!times.length) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }, [events]);

  // Unique IPs
  const uniqueIPs = useMemo(() => new Set(events.map(e => e.ip)).size, [events]);

  // Event-type breakdown
  const eventCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events) m[e.event] = (m[e.event] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const eventTypes = useMemo(() => ["all", ...Array.from(new Set(events.map(e => e.event)))], [events]);
  const filtered = useMemo(() =>
    events
      .filter(e => filter === "all" || e.event === filter)
      .filter(e => inviteFilter === "all" || e.inviteToken === inviteFilter),
  [events, filter, inviteFilter]);

  // Top units opened
  const topUnits = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of events.filter(e => e.event === "unit_open")) {
      const key = `Lot ${(e.data as Record<string,unknown>)?.lotId} · ${(e.data as Record<string,unknown>)?.devType}`;
      m[key] = (m[key] ?? 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [events]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: C.muted, fontSize: 14 }}>
      Loading analytics…
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.ink, margin: 0 }}>Investor Analytics</h2>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Tracks activity on /customer and /investor pages
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load}
            style={{ padding: "7px 14px", background: C.greenBg, color: C.green, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Refresh
          </button>
          <button onClick={clearAll} disabled={clearing}
            style={{ padding: "7px 14px", background: "#FEF2F2", color: C.red, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Clear All
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
        {[
          { label: "Total Events",      val: String(events.length),       color: C.ink        },
          { label: "Sessions",          val: String(sessions.size),       color: "#6366F1"    },
          { label: "Unique IPs",        val: String(uniqueIPs),           color: "#6B7280"    },
          { label: "Page Views",        val: String(pageViews),           color: "#3B82F6"    },
          { label: "Units Opened",      val: String(unitOpens),           color: C.amber      },
          { label: "Enquiries",         val: String(enquireOpens),        color: C.red        },
          { label: "Avg Time on Page",  val: avgTime ? fmtDuration(avgTime) : "—", color: "#8B5CF6" },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Two-column: event breakdown + top units */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Event type breakdown */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Event Breakdown</h3>
          {eventCounts.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted }}>No events yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {eventCounts.map(([ev, count]) => {
                const pct = events.length > 0 ? Math.round((count / events.length) * 100) : 0;
                const color = EVENT_COLORS[ev] ?? "#9CA3AF";
                return (
                  <div key={ev}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: C.ink, fontWeight: 500 }}>{ev}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{count} ({pct}%)</span>
                    </div>
                    <div style={{ height: 5, background: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top units */}
        <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 12 }}>Top Units Viewed</h3>
          {topUnits.length === 0 ? (
            <p style={{ fontSize: 12, color: C.muted }}>No unit opens yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topUnits.map(([key, count], i) => (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, width: 16, textAlign: "right" }}>#{i + 1}</span>
                  <span style={{ fontSize: 12, color: C.ink, flex: 1 }}>{key}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.amber }}>{count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sessions list */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>
            Sessions
            {inviteFilter !== "all" && (
              <span style={{ fontSize: 11, fontWeight: 500, color: "#6366F1", marginLeft: 8 }}>
                — filtered by {inviteNameMap.get(inviteFilter) ?? inviteFilter.slice(0, 8)}
              </span>
            )}
          </h3>
        </div>
        {sessions.size === 0 ? (
          <p style={{ fontSize: 12, color: C.muted }}>No sessions yet.</p>
        ) : (() => {
          const filteredSessions = Array.from(sessions.entries()).filter(([, evs]) =>
            inviteFilter === "all" || evs.some((e: StoredEvent) => e.inviteToken === inviteFilter)
          );
          if (filteredSessions.length === 0) return (
            <p style={{ fontSize: 12, color: C.muted }}>No sessions match the current filter.</p>
          );
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {filteredSessions.map(([sid, evs]) => {
                const pv = evs.find((e: StoredEvent) => e.event === "page_view");
                const top = evs.find((e: StoredEvent) => e.event === "time_on_page");
                const secs = top ? (top.data as Record<string,unknown>)?.seconds as number : undefined;
                const enquiries = evs.filter((e: StoredEvent) => e.event === "enquire_open").length;
                const units = evs.filter((e: StoredEvent) => e.event === "unit_open").length;
                const ip = evs[0]?.ip ?? "—";
                const name = nameForEvent(evs.find((e: StoredEvent) => e.inviteToken) ?? evs[0]);
                return (
                  <div key={sid} style={{ padding: "10px 12px", background: "#F9FAFB", borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {name && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", borderRadius: 5, padding: "2px 7px" }}>
                            {name}
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: C.muted }}>{ip}</span>
                        <span style={{ fontSize: 10, color: C.muted }}>
                          {pv ? fmtTs(pv.ts) : "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "#3B82F6" }}>{evs.length} events</span>
                        {units > 0 && <span style={{ fontSize: 11, color: C.amber }}>{units} unit{units !== 1 ? "s" : ""}</span>}
                        {enquiries > 0 && <span style={{ fontSize: 11, color: C.red, fontWeight: 600 }}>{enquiries} enquir{enquiries !== 1 ? "ies" : "y"}</span>}
                        {secs && <span style={{ fontSize: 11, color: "#8B5CF6" }}>{fmtDuration(secs)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Per invite link breakdown */}
      <InviteBreakdown
        events={events}
        invites={invites}
        filterToken={inviteFilter}
        onFilterToken={setInviteFilter}
      />

      {/* Event feed */}
      <div style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: C.ink, margin: 0 }}>
            Event Feed
            {filtered.length !== events.length && (
              <span style={{ fontSize: 11, fontWeight: 500, color: C.muted, marginLeft: 8 }}>
                ({filtered.length} of {events.length})
              </span>
            )}
          </h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Person filter */}
            <select
              value={inviteFilter}
              onChange={e => setInviteFilter(e.target.value)}
              style={{ fontSize: 12, padding: "5px 10px", border: `1px solid ${inviteFilter !== "all" ? "#6366F1" : C.border}`, borderRadius: 6, background: inviteFilter !== "all" ? "#EEF2FF" : C.white, color: inviteFilter !== "all" ? "#6366F1" : C.ink, cursor: "pointer", fontWeight: inviteFilter !== "all" ? 600 : 400 }}
            >
              <option value="all">All people</option>
              {invites.filter(i => !i.revokedAt).map(i => (
                <option key={i.token} value={i.token}>{i.label}</option>
              ))}
            </select>
            {/* Event type filter */}
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ fontSize: 12, padding: "5px 10px", border: `1px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.ink, cursor: "pointer" }}
            >
              {eventTypes.map(t => (
                <option key={t} value={t}>{t === "all" ? "All events" : t}</option>
              ))}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: C.muted }}>No events match the current filters.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 400, overflowY: "auto" }}>
            {filtered.slice(0, 200).map(ev => {
              const color = EVENT_COLORS[ev.event] ?? "#9CA3AF";
              const name = nameForEvent(ev);
              return (
                <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", background: "#F9FAFB", borderRadius: 7, borderLeft: `3px solid ${color}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{ev.event}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{ev.page}</span>
                      {ev.data && Object.entries(ev.data).map(([k, v]) => (
                        <span key={k} style={{ fontSize: 10, background: "#E5E7EB", color: "#374151", borderRadius: 4, padding: "1px 5px" }}>
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, color: C.muted }}>{fmtTs(ev.ts)}</span>
                      <span style={{ fontSize: 10, color: C.muted, fontFamily: "monospace" }}>{ev.ip}</span>
                      {name && (
                        <span style={{ fontSize: 10, background: "#EEF2FF", color: "#6366F1", borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>
                          🔗 {name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length > 200 && (
              <p style={{ fontSize: 11, color: C.muted, textAlign: "center", padding: 8 }}>
                Showing 200 of {filtered.length} events
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("crm");

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Shared Navigation Header */}
      <AppHeader currentPage="admin" />

      {/* Tabs */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", paddingLeft: 20 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                borderBottom: tab === t.id ? `2px solid ${C.green}` : "2px solid transparent",
                background: "none",
                color: tab === t.id ? C.green : C.muted,
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        {tab === "crm"      && <CrmTab />}
        {tab === "invites"  && <InvitesTab />}
        {tab === "specs"    && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <ProjectSpecsEditor />
          </div>
        )}
        {tab === "overview"  && <OverviewTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "settings"  && <SettingsTab />}
      </main>
    </div>
  );
}
