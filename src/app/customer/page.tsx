"use client";

import { useMemo, useState, useEffect } from "react";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { DEVELOPMENT_TYPES, PHASE_COLORS, PHASE_LABELS } from "@/data/development-types";
import { Phase, DevelopmentType, LotStatus } from "@/types";
import { Unit, generateUnitsForLot } from "@/data/units";
import { ProjectSpecs } from "@/data/project-specs";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useTranslations } from "@/i18n/useTranslations";
import CustomerMap from "@/components/customer/CustomerMap";
import type { LotPricing } from "@/lib/investment-layers";
import LOT_PRICES_RAW from "@/data/lot-prices.json";
const LOT_PRICES = LOT_PRICES_RAW as LotPricing[];

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     "#F4F9EF",                    // barely-green white (logo palette)
  bgAlt:  "#EAF4E1",                    // light green tint
  ink:    "#1C2010",                    // deep dark ink
  forest: "#3D7A24",                    // deep swoosh green — primary CTA
  gold:   "#78BF42",                    // "HILLS" brand green (replaces gold accent)
  goldBg: "rgba(120,191,66,0.10)",      // light green tint background
  sand:   "#C8E0B5",                    // green-tinted border
  border: "#C8E0B5",                    // green border
  muted:  "#6A7B5F",                    // greenish-gray secondary text
  white:  "#FFFFFF",                    // pure white
} as const;

// ─── Utilities ────────────────────────────────────────────────────────────────
function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
function fmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }

// All typologies now use SVG floor plans and perspectives
function floorPlanSrc(devType: string, floor: number): string {
  return `/typologies/${devType}-floor${floor}.svg`;
}
function perspectiveSrc(devType: string): string {
  return `/typologies/${devType}-perspective.svg`;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAYMENT_MILESTONES = [
  { label_en: "Signing",    label_ar: "التوقيع",  pct: 0.30 },
  { label_en: "Foundation", label_ar: "الأساسات", pct: 0.20 },
  { label_en: "Structure",  label_ar: "الهيكل",   pct: 0.20 },
  { label_en: "Handover",   label_ar: "التسليم",  pct: 0.30 },
];

const OFFPLAN_APPRECIATION: Record<string, number> = {
  lot_sale: 0.12, twin_villa: 0.15, villa_2f: 0.18, villa_3f: 0.15, apartments: 0.12,
};

const STATUS_CFG = {
  available:      { label_en: "Available",      label_ar: "متاح",      bg: "#22c55e", textColor: "#15803d", dot: "#22c55e" },
  reserved:       { label_en: "Reserved",       label_ar: "محجوز",     bg: "#f59e0b", textColor: "#b45309", dot: "#f59e0b" },
  under_contract: { label_en: "Under Contract", label_ar: "تحت العقد", bg: "#f97316", textColor: "#c2410c", dot: "#f97316" },
  sold:           { label_en: "Sold",           label_ar: "مباع",      bg: "#ef4444", textColor: "#b91c1c", dot: "#ef4444" },
};

const FLOOR_LABELS: Record<number, { en: string; ar: string }> = {
  0: { en: "Ground",  ar: "أرضي"   },
  1: { en: "Floor 1", ar: "طابق 1" },
  2: { en: "Floor 2", ar: "طابق 2" },
};

const STATUS_DOTS: Record<string, string> = {
  available: "#22c55e", reserved: "#f59e0b", under_contract: "#f97316", sold: "#ef4444",
};

// ─── Typology customer metadata ───────────────────────────────────────────────
const TYPOLOGY_CUSTOMER_META: Record<string, {
  headline_en: string; headline_ar: string;
  description_en: string; description_ar: string;
  specs_en: string[]; specs_ar: string[];
  icon: string;
}> = {
  villa_2f: {
    headline_en: "Standalone Villa", headline_ar: "فيلا مستقلة",
    description_en: "Private 2-floor villa with landscaped garden and terrace. Perfect for families.",
    description_ar: "فيلا مستقلة على طابقين مع حديقة مشجّرة وتراس. مثالية للعائلات.",
    specs_en: ["370m² built area", "4 bedrooms", "Garden + terrace", "Private parking"],
    specs_ar: ["370م² مساحة مبنية", "4 غرف نوم", "حديقة + تراس", "موقف خاص"],
    icon: "🏡",
  },
  villa_3f: {
    headline_en: "Luxury Villa", headline_ar: "فيلا فاخرة",
    description_en: "Expansive 3-floor villa with panoramic mountain views and rooftop terrace.",
    description_ar: "فيلا فاخرة على 3 طوابق مع إطلالات جبلية بانورامية وتراس سطح.",
    specs_en: ["450m² built area", "5 bedrooms", "Rooftop terrace", "OUG permitted"],
    specs_ar: ["450م² مساحة مبنية", "5 غرف نوم", "تراس سطح", "مستودع مسموح"],
    icon: "🏠",
  },
  twin_villa: {
    headline_en: "Twin Villa", headline_ar: "فيلا توأم",
    description_en: "Semi-detached villa sharing one party wall. Two spacious units per plot, each with a private garden.",
    description_ar: "فيلا شبه منفصلة. وحدتان واسعتان لكل قطعة مع حدائق خاصة.",
    specs_en: ["280m² per unit", "4 bedrooms", "Private garden", "2 units / lot"],
    specs_ar: ["280م² للوحدة", "4 غرف نوم", "حديقة خاصة", "وحدتان لكل قطعة"],
    icon: "🏘️",
  },
  apartments: {
    headline_en: "Apartments & Duplexes", headline_ar: "شقق ودوبلكس",
    description_en: "Modern 4-unit building with ground-floor garden apartments and upper-floor duplexes.",
    description_ar: "مبنى حديث بـ4 وحدات — شقق أرضية مع حديقة ودوبلكس علوية.",
    specs_en: ["140–200m² per unit", "2–3 bedrooms", "Garden or terrace", "4 units / building"],
    specs_ar: ["140–200م² للوحدة", "2–3 غرف نوم", "حديقة أو تراس", "4 وحدات للمبنى"],
    icon: "🏢",
  },
  lot_sale: {
    headline_en: "Land Plot", headline_ar: "قطعة أرض",
    description_en: "Fully serviced land ready to build. Design your own custom home on an infrastructure-ready plot.",
    description_ar: "أرض مخدومة جاهزة للبناء. صمم منزلك الخاص على أرض ببنية تحتية كاملة.",
    specs_en: ["Variable area", "Full infrastructure", "Custom design", "Flexible timeline"],
    specs_ar: ["مساحة متغيرة", "بنية تحتية كاملة", "تصميم مخصص", "جدول زمني مرن"],
    icon: "🌄",
  },
};

type BudgetFilter = "all" | "lt300" | "300to600" | "gt600";

const BUDGET_LABELS: Record<BudgetFilter, { en: string; ar: string }> = {
  all:        { en: "Any Price",     ar: "أي سعر"        },
  lt300:      { en: "< $300K",       ar: "< $300K"       },
  "300to600": { en: "$300K – $600K", ar: "$300K – $600K" },
  gt600:      { en: "> $600K",       ar: "> $600K"       },
};

type SelectedUnit = { unit: Unit; devType: DevelopmentType; status: LotStatus };
type DetailTab = "overview" | "floors" | "finishings";

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ active, onClick, dot, children }: {
  active: boolean; onClick: () => void; dot?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
      style={{
        background: active ? C.ink : "transparent",
        color: active ? C.white : C.muted,
        border: `1.5px solid ${active ? C.ink : C.border}`,
      }}
    >
      {dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />}
      {children}
    </button>
  );
}

// ─── Enquire Modal ─────────────────────────────────────────────────────────────
function EnquireModal({
  unitLabel, lotId, unitId, onClose, lang, t,
}: {
  unitLabel: string; lotId?: number; unitId?: string;
  onClose: () => void; lang: string; t: (k: string) => string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    lang === "ar"
      ? `أنا مهتم بـ ${unitLabel} وأود معرفة المزيد عن التوفر والتسعير.`
      : `I'm interested in ${unitLabel} and would like to learn more about availability and pricing.`
  );
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [submitted, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!name.trim())  errs.name  = lang === "ar" ? "الاسم مطلوب"             : "Name is required";
    if (!email.trim()) errs.email = lang === "ar" ? "البريد الإلكتروني مطلوب" : "Email is required";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, message: message.trim(), unitLabel, lotId, unitId }),
      });
      if (!res.ok) throw new Error("server error");
      setSubmitted(true);
    } catch {
      setSubmitError(t("enquire_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(28,32,16,0.65)" }}>
      <div className="rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden" style={{ background: C.white }}>
        <div className="px-6 py-5" style={{ background: C.ink }}>
          <button onClick={onClose}
            className="absolute top-4 end-4 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors"
            style={{ background: "rgba(245,240,232,0.1)", color: C.white }}>×</button>
          <h3 className="font-bold text-base" style={{ color: C.white, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {t("enquire_modal_title")}
          </h3>
          <p className="text-xs mt-1" style={{ color: C.border }}>{unitLabel}</p>
        </div>
        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#f0fdf4" }}>
              <svg className="w-6 h-6" fill="none" stroke="#22c55e" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <p className="font-semibold text-sm" style={{ color: C.ink }}>{t("enquire_success")}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>{t("enquire_name")} *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} dir="auto"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
                style={{ border: `1.5px solid ${errors.name ? "#ef4444" : C.border}`, background: C.bg, color: C.ink }} />
              {errors.name && <p className="text-red-500 text-[10px] mt-0.5">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>{t("enquire_email")} *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} dir="ltr"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none transition-all"
                style={{ border: `1.5px solid ${errors.email ? "#ef4444" : C.border}`, background: C.bg, color: C.ink }} />
              {errors.email && <p className="text-red-500 text-[10px] mt-0.5">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>{t("enquire_phone")}</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} dir="ltr"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: `1.5px solid ${C.border}`, background: C.bg, color: C.ink }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.muted }}>{t("enquire_message")}</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} dir="auto" rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
                style={{ border: `1.5px solid ${C.border}`, background: C.bg, color: C.ink }} />
            </div>
            {submitError && (
              <p className="text-red-500 text-xs text-center -mt-1">{submitError}</p>
            )}
            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60"
              style={{ background: C.forest, color: C.white }}>
              {submitting ? (lang === "ar" ? "جارٍ الإرسال…" : "Sending…") : t("enquire_send")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Unit Detail Panel ─────────────────────────────────────────────────────────
const SPEC_CATEGORIES = [
  { key: "structure"  as const, icon: "🏗️", tk: "spec_structure"  },
  { key: "flooring"   as const, icon: "🏠", tk: "spec_flooring"   },
  { key: "kitchen"    as const, icon: "🍳", tk: "spec_kitchen"    },
  { key: "bathrooms"  as const, icon: "🚿", tk: "spec_bathrooms"  },
  { key: "electrical" as const, icon: "⚡", tk: "spec_electrical" },
  { key: "energy"     as const, icon: "☀️", tk: "spec_energy"     },
  { key: "outdoor"    as const, icon: "🌿", tk: "spec_outdoor"    },
];

function UnitDetail({ sel, lang, t, projectSpecs, onClose, onEnquire, wide = false }: {
  sel: SelectedUnit;
  lang: string;
  t: (k: string) => string;
  projectSpecs: ProjectSpecs;
  onClose?: () => void;
  onEnquire: () => void;
  wide?: boolean;
}) {
  const { unit, devType, status } = sel;
  const devCfg = DEVELOPMENT_TYPES[devType];
  const [tab, setTab] = useState<DetailTab>("overview");
  const [floorIdx, setFloorIdx] = useState(0);
  const appreciation = OFFPLAN_APPRECIATION[devType] ?? 0.15;
  const estimatedResale = unit.price > 0 ? Math.round(unit.price * (1 + appreciation)) : 0;
  const isUnavailable = status !== "available";
  const isLotSale = devType === "lot_sale";
  const lotRow = LOTS.find(l => l.id === unit.lotId);
  const lotPricing = LOT_PRICES.find(l => l.lot === unit.lotId);
  const unitTitle = lang === "ar"
    ? `${t("lot_id")} ${unit.lotId} — ${unit.labelAr}`
    : `Lot ${unit.lotId} — ${unit.label}`;

  const TABS = [
    { id: "overview"   as const, en: "Overview",          ar: "نظرة عامة"      },
    { id: "floors"     as const, en: t("floor_plan_tab"), ar: t("floor_plan_tab") },
    { id: "finishings" as const, en: t("finishings"),     ar: t("finishings")     },
  ];

  const scfg = STATUS_CFG[status];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Perspective header */}
      <div className="relative h-40 flex-shrink-0" style={{ backgroundColor: devCfg.color + "20" }}>
        <img src={perspectiveSrc(devType)} alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(28,32,16,0.75) 0%, rgba(28,32,16,0.15) 55%, transparent 100%)" }} />
        {onClose && (
          <button onClick={onClose}
            className="absolute top-3 end-3 w-7 h-7 rounded-full flex items-center justify-center text-sm z-10 transition-colors"
            style={{ background: "rgba(28,32,16,0.55)", color: C.white }}>×</button>
        )}
        <div className="absolute bottom-3 start-3">
          <div className="text-sm font-bold" style={{ color: C.white, fontFamily: "'Playfair Display', Georgia, serif" }}>{unitTitle}</div>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(245,240,232,0.65)" }}>{devCfg.label}</div>
        </div>
        <div className="absolute bottom-3 end-3">
          <div className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
            style={{ background: scfg.bg, color: C.white }}>
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            {lang === "ar" ? scfg.label_ar : scfg.label_en}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: C.sand, background: C.white }}>
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-colors border-b-2"
            style={{
              color: tab === tb.id ? C.forest : C.muted,
              borderColor: tab === tb.id ? C.forest : "transparent",
              background: tab === tb.id ? C.goldBg : "transparent",
            }}>
            {lang === "ar" ? tb.ar : tb.en}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" style={{ background: C.white }}>

        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className={`p-4 ${wide ? "space-y-5" : "space-y-4"}`}>
            {/* Price block */}
            {unit.price > 0 && (
              <div className="rounded-2xl p-4" style={{ background: C.bg, border: `1px solid ${C.sand}` }}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.gold }}>
                      {isLotSale ? (lang === "ar" ? "سعر الأرض" : "Land Price") : t("unit_price")}
                    </div>
                    <div className={`font-bold tabular-nums ${wide ? "text-4xl" : "text-2xl"}`}
                      style={{ color: C.ink, fontFamily: "'Playfair Display', Georgia, serif" }} dir="ltr">
                      {fmtUSD(unit.price)}
                    </div>
                    {!isLotSale && (
                      <div className="text-[10px] mt-1" style={{ color: C.muted }} dir="ltr">
                        ~{fmtUSD(Math.round(unit.price / unit.areaSqm))}{t("per_sqm")}
                      </div>
                    )}
                    {isLotSale && lotPricing && (
                      <div className="text-[10px] mt-1" style={{ color: C.muted }} dir="ltr">
                        ${lotPricing.price_sqm.toLocaleString()}{t("per_sqm")} {lang === "ar" ? "أرض" : "land"}
                      </div>
                    )}
                  </div>
                  {estimatedResale > 0 && !isUnavailable && !isLotSale && (
                    <div className="text-end">
                      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: C.gold }}>{t("est_resale")}</div>
                      <div className={`font-bold tabular-nums ${wide ? "text-2xl" : "text-base"}`}
                        style={{ color: "#16a34a", fontFamily: "'Playfair Display', Georgia, serif" }} dir="ltr">
                        {fmtUSD(estimatedResale)}
                      </div>
                      <div className="text-[10px]" style={{ color: "#22c55e" }} dir="ltr">
                        +{(appreciation * 100).toFixed(0)}% {t("off_plan")}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Specs grid */}
            <div className={`grid gap-2 ${wide ? "grid-cols-4" : "grid-cols-2"}`}>
              {[
                { label: t("internal_area"), value: `${fmt(unit.areaSqm)} m²` },
                ...(unit.bedroomCount > 0 ? [{ label: t("bedrooms"), value: `${unit.bedroomCount}` }] : []),
                ...(unit.gardenSqm > 0  ? [{ label: t("garden"),   value: `${fmt(unit.gardenSqm)} m²`  }] : []),
                ...(unit.terraceSqm > 0 ? [{ label: t("terrace"),  value: `${fmt(unit.terraceSqm)} m²` }] : []),
                { label: lang === "ar" ? "سفلي مكشوف" : "OUG", value: lotRow?.oug_allowed ? "✓" : "—" },
                ...(lotPricing ? [{ label: t("phase_per_lot_retail"), value: `$${lotPricing.price_sqm.toLocaleString()}/m²` }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl py-2.5 px-3" style={{ background: C.bg, border: `1px solid ${C.sand}` }}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: C.gold }}>{label}</div>
                  <div className={`font-bold ${wide ? "text-sm" : "text-xs"}`} style={{ color: C.ink }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Payment plan */}
            {!isUnavailable && unit.price > 0 && !isLotSale && (
              <div>
                <div className="text-[10px] uppercase tracking-widest font-medium mb-2.5" style={{ color: C.gold }}>{t("payment_plan")}</div>
                {wide ? (
                  <div className="grid grid-cols-4 gap-2">
                    {PAYMENT_MILESTONES.map(m => (
                      <div key={m.label_en} className="rounded-xl p-3 text-center" style={{ background: C.bg, border: `1px solid ${C.sand}` }}>
                        <div className="text-[9px] mb-1" style={{ color: C.muted }}>{lang === "ar" ? m.label_ar : m.label_en}</div>
                        <div className="text-sm font-bold tabular-nums" style={{ color: C.ink, fontFamily: "'Playfair Display', Georgia, serif" }} dir="ltr">
                          {fmtUSD(unit.price * m.pct)}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: C.gold }}>{(m.pct * 100).toFixed(0)}%</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {PAYMENT_MILESTONES.map(m => (
                      <div key={m.label_en} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: C.gold }} />
                          <span style={{ color: C.muted }}>{lang === "ar" ? m.label_ar : m.label_en}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: C.gold }}>{(m.pct * 100).toFixed(0)}%</span>
                          <span className="font-semibold tabular-nums" style={{ color: C.ink }} dir="ltr">{fmtUSD(unit.price * m.pct)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {estimatedResale > 0 && (
                  <div className="mt-3 text-[10px] leading-relaxed" style={{ color: C.muted }}>
                    {lang === "ar"
                      ? <>الشراء على الخريطة يضمن سعر اليوم. القيمة المتوقعة عند التسليم:{" "}
                          <span style={{ color: "#16a34a" }} className="font-semibold">{fmtUSD(estimatedResale)}</span>{" "}
                          (+{(appreciation * 100).toFixed(0)}%).</>
                      : <>Off-plan locks in today&apos;s price. Est. value at handover:{" "}
                          <span style={{ color: "#16a34a" }} className="font-semibold">{fmtUSD(estimatedResale)}</span>{" "}
                          (+{(appreciation * 100).toFixed(0)}%).</>}
                  </div>
                )}
              </div>
            )}

            {/* Enquire CTA */}
            {!isUnavailable && (
              <button onClick={onEnquire}
                className={`w-full rounded-xl font-semibold transition-all ${wide ? "py-3 text-base" : "py-2.5 text-sm"}`}
                style={{ background: C.forest, color: C.white }}>
                {t("enquire")} — {lang === "ar" ? unit.labelAr : unit.label}
              </button>
            )}
          </div>
        )}

        {/* ── Floor Plans ── */}
        {tab === "floors" && (
          <div className="p-4">
            {!isLotSale ? (
              <>
                {unit.floors.length > 1 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {unit.floors.map((f, i) => (
                      <button key={f} onClick={() => setFloorIdx(i)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                        style={{
                          background: floorIdx === i ? C.ink : "transparent",
                          color: floorIdx === i ? C.white : C.muted,
                          border: `1.5px solid ${floorIdx === i ? C.ink : C.border}`,
                        }}>
                        {lang === "ar" ? FLOOR_LABELS[f]?.ar : FLOOR_LABELS[f]?.en}
                      </button>
                    ))}
                  </div>
                )}

                {wide ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: C.gold }}>
                        {lang === "ar" ? `مخطط ${FLOOR_LABELS[unit.floors[floorIdx]]?.ar}` : `${FLOOR_LABELS[unit.floors[floorIdx]]?.en} Floor Plan`}
                      </div>
                      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/4", background: C.bg, border: `1px solid ${C.sand}` }}>
                        <img
                          key={`fp-${devType}-${unit.floors[floorIdx]}`}
                          src={floorPlanSrc(devType, unit.floors[floorIdx])}
                          alt=""
                          className="absolute inset-0 w-full h-full object-contain p-3"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 9v12M3 15h6"/><path d="M12 9v3h6v-3"/>
                          </svg>
                          <span className="text-[10px]" style={{ color: C.border }}>{t("floor_plan_coming_soon")}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: C.gold }}>
                        {lang === "ar" ? "المنظور الخارجي" : "Exterior Perspective"}
                      </div>
                      <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "3/4", background: C.bg, border: `1px solid ${C.sand}` }}>
                        <img src={perspectiveSrc(devType)} alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5">
                            <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/>
                            <path d="M9 22V12h6v10"/>
                          </svg>
                          <span className="text-[10px]" style={{ color: C.border }}>Perspective</span>
                        </div>
                        <div className="absolute bottom-2 start-2 text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(28,32,16,0.5)", color: C.white }}>
                          {lang === "ar" ? "المنظور الخارجي" : "Exterior perspective"}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="relative rounded-xl overflow-hidden mb-3" style={{ aspectRatio: "3/4", background: C.bg, border: `1px solid ${C.sand}` }}>
                      <img
                        key={`fp-${devType}-${unit.floors[floorIdx]}`}
                        src={floorPlanSrc(devType, unit.floors[floorIdx])}
                        alt=""
                        className="absolute inset-0 w-full h-full object-contain p-3"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 9v12M3 15h6"/><path d="M12 9v3h6v-3"/>
                        </svg>
                        <span className="text-[10px]" style={{ color: C.border }}>{t("floor_plan_coming_soon")}</span>
                      </div>
                      <div className="absolute bottom-2 start-2 text-[9px] px-2 py-0.5 rounded-full backdrop-blur-sm" style={{ background: "rgba(28,32,16,0.4)", color: C.white }}>
                        {lang === "ar" ? FLOOR_LABELS[unit.floors[floorIdx]]?.ar : FLOOR_LABELS[unit.floors[floorIdx]]?.en}
                      </div>
                    </div>
                    <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "16/9", background: C.bg, border: `1px solid ${C.sand}` }}>
                      <img src={perspectiveSrc(devType)} alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke={C.border} strokeWidth="1.5">
                          <path d="M3 9l9-6 9 6v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9z"/>
                          <path d="M9 22V12h6v10"/>
                        </svg>
                        <span className="text-[10px]" style={{ color: C.border }}>{lang === "ar" ? "المنظور" : "Perspective"}</span>
                      </div>
                      <div className="absolute bottom-2 start-2 text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(28,32,16,0.5)", color: C.white }}>
                        {lang === "ar" ? "المنظور الخارجي" : "Exterior perspective"}
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16" style={{ color: C.muted }}>
                <div className="text-4xl mb-2 opacity-30">🗺️</div>
                <p className="text-xs">{lang === "ar" ? "قطعة أرض — لا توجد مخططات" : "Land plot — no floor plans"}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Finishings ── */}
        {tab === "finishings" && (
          wide ? (
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-5">
                {SPEC_CATEGORIES.map(({ key, icon, tk }) => (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm leading-none">{icon}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{t(tk)}</span>
                    </div>
                    <div className="rounded-xl overflow-hidden" style={{ background: C.bg, border: `1px solid ${C.sand}` }}>
                      {projectSpecs[key].map((item, i) => (
                        <div key={i} className={`flex justify-between px-3 py-2 text-xs gap-3 ${i < projectSpecs[key].length - 1 ? "border-b" : ""}`}
                          style={{ borderColor: C.sand }}>
                          <span className="flex-shrink-0" style={{ color: C.muted }}>{lang === "ar" ? item.labelAr : item.label}</span>
                          <span className="font-medium text-end" style={{ color: C.ink }}>{lang === "ar" ? item.valueAr : item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm leading-none">✅</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{t("amenities")}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {(lang === "ar" ? projectSpecs.amenitiesAr : projectSpecs.amenities).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: C.ink }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: C.gold }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {SPEC_CATEGORIES.map(({ key, icon, tk }) => (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm leading-none">{icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{t(tk)}</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ background: C.bg, border: `1px solid ${C.sand}` }}>
                    {projectSpecs[key].map((item, i) => (
                      <div key={i} className={`flex justify-between px-3 py-2 text-xs gap-3 ${i < projectSpecs[key].length - 1 ? "border-b" : ""}`}
                        style={{ borderColor: C.sand }}>
                        <span className="flex-shrink-0" style={{ color: C.muted }}>{lang === "ar" ? item.labelAr : item.label}</span>
                        <span className="font-medium text-end" style={{ color: C.ink }}>{lang === "ar" ? item.valueAr : item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm leading-none">✅</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{t("amenities")}</span>
                </div>
                <div className="space-y-1.5">
                  {(lang === "ar" ? projectSpecs.amenitiesAr : projectSpecs.amenities).map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs" style={{ color: C.ink }}>
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: C.gold }} />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Map panel — unit list ────────────────────────────────────────────────────
function MapUnitList({
  lotId, devType, status, units, lang, t, onSelectUnit, onClose,
}: {
  lotId: number; devType: DevelopmentType; status: LotStatus;
  units: Unit[]; lang: string; t: (k: string) => string;
  onSelectUnit: (u: Unit) => void; onClose: () => void;
}) {
  const devCfg = DEVELOPMENT_TYPES[devType];
  const scfg = STATUS_CFG[status];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: C.sand }}>
        <div>
          <div className="text-xs font-bold" style={{ color: C.ink, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {lang === "ar" ? `${t("lot_id")} ${lotId}` : `Lot ${lotId}`}
          </div>
          <div className="text-[10px]" style={{ color: C.muted }}>{devCfg.label}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: scfg.textColor }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: scfg.dot }} />
            {lang === "ar" ? scfg.label_ar : scfg.label_en}
          </span>
          <button onClick={onClose}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors"
            style={{ background: C.sand, color: C.muted }}>×</button>
        </div>
      </div>

      {/* Perspective */}
      <div className="relative flex-shrink-0" style={{ height: "120px", backgroundColor: devCfg.color + "18" }}>
        <img src={perspectiveSrc(devType)} alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>

      {/* Instruction */}
      <div className="px-4 pt-3 pb-1 flex-shrink-0">
        <p className="text-[10px]" style={{ color: C.muted }}>{t("units_in_lot")} · {t("select_unit")}</p>
      </div>

      {/* Unit list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {units.map(unit => (
          <button
            key={unit.id}
            onClick={() => onSelectUnit(unit)}
            className="w-full text-start rounded-xl px-3 py-2.5 transition-all"
            style={{ background: C.bg, border: `1.5px solid ${C.sand}` }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold" style={{ color: C.ink }}>{lang === "ar" ? unit.labelAr : unit.label}</span>
              {unit.price > 0 && (
                <span className="text-xs font-bold tabular-nums"
                  style={{ color: C.forest, fontFamily: "'Playfair Display', Georgia, serif" }} dir="ltr">
                  {fmtUSD(unit.price)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] flex-wrap" style={{ color: C.muted }}>
              <span dir="ltr">{fmt(unit.areaSqm)} m²</span>
              {unit.bedroomCount > 0 && <span>{unit.bedroomCount} {lang === "ar" ? "غرف" : "br"}</span>}
              {unit.gardenSqm > 0  && <span>{lang === "ar" ? "حديقة" : "Garden"} {fmt(unit.gardenSqm)}m²</span>}
              {unit.terraceSqm > 0 && <span>{lang === "ar" ? "تراس"  : "Terrace"} {fmt(unit.terraceSqm)}m²</span>}
              <span style={{ color: C.border }}>{unit.floors.map(f => FLOOR_LABELS[f]?.en).join(" · ")}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerPage() {
  const assignments         = useSimulationStore((s) => s.assignments);
  const lotStatuses         = useSimulationStore((s) => s.lotStatuses);
  const lotGroups           = useSimulationStore((s) => s.lotGroups);
  const projectSpecs        = useSimulationStore((s) => s.projectSpecs);
  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);
  const { t, lang }         = useTranslations();

  // Filter state
  const [filterPhase,  setFilterPhase]  = useState<Phase | 0>(0);
  const [filterType,   setFilterType]   = useState<DevelopmentType | "all">("all");
  const [filterAvail,  setFilterAvail]  = useState<"all" | LotStatus>("all");
  const [filterBudget, setFilterBudget] = useState<BudgetFilter>("all");
  const [viewMode,     setViewMode]     = useState<"map" | "grid" | "typologies">("typologies");

  // Selection state
  const [selectedMapLotId, setSelectedMapLotId] = useState<number | null>(null);
  const [selectedUnit,     setSelectedUnit]     = useState<SelectedUnit | null>(null);
  const [showingUnitList,  setShowingUnitList]  = useState(false);
  const [enquireUnit,      setEnquireUnit]      = useState<SelectedUnit | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    initStateFromServer();
    // Inject fonts + utility CSS client-side to avoid SSR hydration mismatch
    const id = "dh-customer-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        .dh-serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
        .dh-sans  { font-family: 'DM Sans', system-ui, sans-serif; }
        .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        @keyframes sheetIn {
          from { transform: translateY(100%); opacity: 0.7; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
        .sheet-enter { animation: sheetIn 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
      `;
      document.head.appendChild(el);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Aggregate counts
  const totalAssigned      = useMemo(() => Array.from(assignments.values()).filter((a) => a.developmentType !== "unassigned").length, [assignments]);
  const totalAvailable     = useMemo(() => Array.from(assignments.values()).filter((a) => a.developmentType !== "unassigned" && (lotStatuses.get(a.lotId) ?? "available") === "available").length, [assignments, lotStatuses]);
  const totalReserved      = useMemo(() => Array.from(lotStatuses.values()).filter((s) => s === "reserved").length, [lotStatuses]);
  const totalUnderContract = useMemo(() => Array.from(lotStatuses.values()).filter((s) => s === "under_contract").length, [lotStatuses]);
  const totalSold          = useMemo(() => Array.from(lotStatuses.values()).filter((s) => s === "sold").length, [lotStatuses]);

  // Dev types in project (for chip generation)
  const devTypes = useMemo(() => {
    const s = new Set<DevelopmentType>();
    assignments.forEach((a) => { if (a.developmentType !== "unassigned") s.add(a.developmentType); });
    return Array.from(s);
  }, [assignments]);

  // Budget match helper
  function matchesBudget(devId: string, lot: (typeof LOTS)[0]): boolean {
    if (filterBudget === "all") return true;
    const cfg = DEVELOPMENT_TYPES[devId];
    if (!cfg) return false;
    const price = devId === "lot_sale"
      ? lot.zone_price_retail * lot.area_sqm
      : cfg.sellingPricePerM * cfg.avgUnitSize;
    if (price === 0) return false;
    if (filterBudget === "lt300")    return price < 300_000;
    if (filterBudget === "300to600") return price >= 300_000 && price <= 600_000;
    if (filterBudget === "gt600")    return price > 600_000;
    return true;
  }

  // Filtered lot list
  const lots = useMemo(() => {
    return LOTS.map((lot) => {
      const assignment = assignments.get(lot.id) ?? { developmentType: "unassigned" as DevelopmentType, phase: 0 as Phase, lotId: lot.id };
      const status: LotStatus = lotStatuses.get(lot.id) ?? "available";
      return { lot, assignment, status };
    })
      .filter(({ assignment }) => assignment.developmentType !== "unassigned")
      .filter(({ assignment }) => filterPhase === 0 || assignment.phase === filterPhase)
      .filter(({ assignment }) => filterType === "all" || assignment.developmentType === filterType)
      .filter(({ status }) => filterAvail === "all" || status === filterAvail)
      .filter(({ lot, assignment }) => matchesBudget(assignment.developmentType, lot))
      .sort((a, b) => {
        if (a.assignment.phase !== b.assignment.phase) return a.assignment.phase - b.assignment.phase;
        return a.lot.id - b.lot.id;
      });
  }, [assignments, lotStatuses, filterPhase, filterType, filterAvail, filterBudget]); // eslint-disable-line react-hooks/exhaustive-deps

  // Units per lot
  const lotUnits = useMemo(() => {
    const map = new Map<number, Unit[]>();
    for (const { lot, assignment } of lots) {
      const units = generateUnitsForLot(lot, assignment.developmentType);
      map.set(lot.id, units);
    }
    return map;
  }, [lots]);

  // Total units count
  const totalUnits = useMemo(() => {
    let n = 0;
    lotUnits.forEach(us => { n += us.length; });
    return n;
  }, [lotUnits]);

  // Per-typology stats for the Typologies view
  const typologyStats = useMemo(() => {
    const stats: Record<string, { lotCount: number; availableCount: number; fromPrice: number; unitCount: number }> = {};
    lots.forEach(({ lot, assignment, status }) => {
      const tp = assignment.developmentType;
      if (!stats[tp]) stats[tp] = { lotCount: 0, availableCount: 0, fromPrice: Infinity, unitCount: 0 };
      stats[tp].lotCount++;
      const units = lotUnits.get(lot.id) ?? [];
      stats[tp].unitCount += units.length;
      if (status === "available") stats[tp].availableCount++;
      const cfg = DEVELOPMENT_TYPES[tp];
      const price = tp === "lot_sale"
        ? lot.zone_price_retail * lot.area_sqm
        : cfg.sellingPricePerM * cfg.avgUnitSize;
      if (price > 0 && price < stats[tp].fromPrice) stats[tp].fromPrice = price;
    });
    return stats;
  }, [lots, lotUnits]);

  // Sorted devTypes for typology view (predefined order)
  const TYPOLOGY_ORDER = ["villa_2f", "villa_3f", "twin_villa", "apartments", "lot_sale"];
  const sortedDevTypes = useMemo(
    () => TYPOLOGY_ORDER.filter(tp => devTypes.includes(tp as DevelopmentType)),
    [devTypes] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Map filter set
  const filteredLotIds = useMemo(() => new Set(lots.map(l => l.lot.id)), [lots]);

  // Handle map lot click
  function handleMapLotSelect(lotId: number) {
    if (lotId === selectedMapLotId) {
      setSelectedMapLotId(null);
      setSelectedUnit(null);
      setShowingUnitList(false);
      return;
    }
    setSelectedMapLotId(lotId);
    setSelectedUnit(null);
    setShowingUnitList(false);

    const assignment = assignments.get(lotId);
    if (!assignment || assignment.developmentType === "unassigned") return;
    const lot = LOTS.find(l => l.id === lotId);
    if (!lot) return;
    const units = generateUnitsForLot(lot, assignment.developmentType);
    const status: LotStatus = lotStatuses.get(lotId) ?? "available";
    if (units.length === 1) {
      setSelectedUnit({ unit: units[0], devType: assignment.developmentType, status });
    } else {
      setShowingUnitList(true);
    }
  }

  // Status count helper
  const statusCount = (v: "all" | LotStatus) => {
    if (v === "all") return totalAssigned;
    if (v === "available") return totalAvailable;
    if (v === "reserved") return totalReserved;
    if (v === "under_contract") return totalUnderContract;
    return totalSold;
  };

  // Map panel content
  const mapLotEntry = useMemo(() => {
    if (!selectedMapLotId) return null;
    const assignment = assignments.get(selectedMapLotId);
    if (!assignment || assignment.developmentType === "unassigned") return null;
    const lot = LOTS.find(l => l.id === selectedMapLotId);
    if (!lot) return null;
    const status: LotStatus = lotStatuses.get(selectedMapLotId) ?? "available";
    const units = generateUnitsForLot(lot, assignment.developmentType);
    return { lot, assignment, status, units };
  }, [selectedMapLotId, assignments, lotStatuses]);

  // Mobile bottom sheet visibility
  const mobileSheetOpen = selectedUnit !== null || (viewMode === "map" && showingUnitList && !!mapLotEntry);

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>

      {/* ── Hero ── */}
      <div style={{ background: "#1A3810" }}>
        <div className="max-w-7xl mx-auto px-5 pt-6 pb-6 sm:pt-8 sm:pb-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-4">
            <div className="flex-1 min-w-0">
              {/* Eyebrow + lang toggle on mobile (inline) */}
              <div className="flex items-center justify-between mb-5">
                <a href="/" className="flex items-center gap-3 w-fit group" style={{ textDecoration: "none" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity group-hover:opacity-80" style={{ background: C.forest }}>
                    <span className="font-bold text-xs" style={{ color: C.white, fontFamily: "'DM Sans', system-ui, sans-serif" }}>DH</span>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] transition-opacity group-hover:opacity-70" style={{ color: C.gold, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    Koura, North Lebanon
                  </div>
                </a>
                {/* Lang toggle visible on mobile only (hidden on sm+ since it shows in stats column) */}
                <div className="sm:hidden">
                  <LanguageToggle className="border-white/30 bg-white/10 text-white/90 hover:bg-white/20" />
                </div>
              </div>
              {/* Title */}
              <h1 className="dh-serif font-bold leading-none mb-3" style={{ fontSize: "clamp(1.8rem,6vw,3.75rem)", color: C.white }}>
                Deddeh Hills
              </h1>
              {/* Description */}
              <p className="text-sm leading-relaxed mb-4 max-w-lg" style={{ color: "rgba(245,240,232,0.6)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {lang === "ar"
                  ? "مجمع سكني فاخر مسوّر على قمة تل في شمال لبنان. إطلالات بانورامية وتصاميم حصرية."
                  : "Premium hilltop gated community in North Lebanon. Panoramic mountain views, curated architecture, and full infrastructure."}
              </p>
              {/* Feature pills */}
              <div className="flex gap-2 scrollbar-none" style={{ overflowX: "auto" }}>
                {[
                  lang === "ar" ? "أسعار ما قبل الإنشاء" : "Off-plan pricing",
                  lang === "ar" ? "خطة دفع مرنة"         : "Flexible payment plan",
                  lang === "ar" ? "مسوّر ومخدوم"           : "Gated & serviced",
                ].map(label => (
                  <span key={label}
                    className="text-[10px] px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: "rgba(120,191,66,0.12)", color: C.gold, border: "1px solid rgba(120,191,66,0.28)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats + lang toggle (desktop) */}
            <div className="hidden sm:flex flex-col items-end gap-4 flex-shrink-0">
              <div className="flex items-start gap-4 md:gap-7 text-end">
                <div>
                  <div className="dh-serif font-bold tabular-nums" style={{ fontSize: "clamp(1.4rem,4vw,2.25rem)", color: C.white }}>
                    {mounted ? totalUnits : "—"}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(245,240,232,0.38)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    {lang === "ar" ? "الوحدات" : "Total Units"}
                  </div>
                </div>
                <div>
                  <div className="dh-serif font-bold tabular-nums" style={{ fontSize: "clamp(1.4rem,4vw,2.25rem)", color: "#4ade80" }}>
                    {mounted ? totalAvailable : "—"}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "rgba(245,240,232,0.38)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    {lang === "ar" ? "متاحة" : "Available"}
                  </div>
                </div>
              </div>
              <LanguageToggle className="border-white/30 bg-white/10 text-white/90 hover:bg-white/20" />
            </div>

            {/* Stats — mobile only (compact row below hero text) */}
            <div className="flex sm:hidden items-center gap-5">
              <div>
                <div className="dh-serif font-bold tabular-nums text-xl" style={{ color: C.white }}>
                  {mounted ? totalUnits : "—"}
                </div>
                <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(245,240,232,0.38)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {lang === "ar" ? "الوحدات" : "Total Units"}
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="dh-serif font-bold tabular-nums text-xl" style={{ color: "#4ade80" }}>
                  {mounted ? totalAvailable : "—"}
                </div>
                <div className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(245,240,232,0.38)", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {lang === "ar" ? "متاحة" : "Available"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="sticky top-0 z-20"
        style={{ background: C.white, borderBottom: `1px solid ${C.sand}`, boxShadow: "0 1px 12px rgba(28,32,16,0.06)" }}>
        <div className="max-w-7xl mx-auto px-5">

          {/* Sub-row: result count + view toggle */}
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[11px]" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {mounted
                ? lang === "ar"
                    ? `${lots.length} قطعة · ${totalUnits} وحدة`
                    : `${lots.length} lot${lots.length !== 1 ? "s" : ""} · ${totalUnits} unit${totalUnits !== 1 ? "s" : ""}`
                : ""}
            </span>
            {/* View toggle */}
            <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: C.bg }}>
              <button
                onClick={() => setViewMode("map")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: viewMode === "map" ? C.white : "transparent",
                  color: viewMode === "map" ? C.ink : C.muted,
                  boxShadow: viewMode === "map" ? "0 1px 4px rgba(28,32,16,0.1)" : "none",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zM8 6a2 2 0 100 4 2 2 0 000-4z"/>
                </svg>
                {lang === "ar" ? "خريطة" : "Map"}
              </button>
              <button
                onClick={() => { setViewMode("grid"); setSelectedUnit(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: viewMode === "grid" ? C.white : "transparent",
                  color: viewMode === "grid" ? C.ink : C.muted,
                  boxShadow: viewMode === "grid" ? "0 1px 4px rgba(28,32,16,0.1)" : "none",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                  <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
                </svg>
                {lang === "ar" ? "قائمة" : "Browse"}
              </button>
              <button
                onClick={() => { setViewMode("typologies"); setSelectedUnit(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: viewMode === "typologies" ? C.white : "transparent",
                  color: viewMode === "typologies" ? C.ink : C.muted,
                  boxShadow: viewMode === "typologies" ? "0 1px 4px rgba(28,32,16,0.1)" : "none",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 2h5v5H2V2zm7 0h5v5H9V2zM2 9h5v5H2V9zm7 0h5v5H9V9z" opacity="0.9"/><circle cx="4.5" cy="4.5" r="1.5"/><circle cx="11.5" cy="4.5" r="1.5"/><circle cx="4.5" cy="11.5" r="1.5"/><circle cx="11.5" cy="11.5" r="1.5"/>
                </svg>
                {lang === "ar" ? "أنواع" : "Types"}
              </button>
            </div>
          </div>

          {/* Filter row 1: Status + Phase — horizontally scrollable */}
          <div className="flex items-center gap-2 pb-2.5 scrollbar-none" style={{ overflowX: "auto" }}>
            {(["all", "available", "reserved", "under_contract", "sold"] as const).map((v) => (
              <Chip key={v} active={filterAvail === v} onClick={() => setFilterAvail(v)} dot={v !== "all" ? STATUS_DOTS[v] : undefined}>
                {v === "all"
                  ? (lang === "ar" ? "جميع الحالات" : "All")
                  : (lang === "ar" ? STATUS_CFG[v].label_ar : STATUS_CFG[v].label_en)}
                {" "}{mounted && <span style={{ opacity: 0.5 }}>({statusCount(v)})</span>}
              </Chip>
            ))}
            <div className="w-px h-5 flex-shrink-0" style={{ background: C.border, margin: "0 2px" }} />
            {([0, 1, 2, 3] as const).map((p) => (
              <Chip key={p} active={filterPhase === p} onClick={() => setFilterPhase(p)} dot={p !== 0 ? PHASE_COLORS[p] : undefined}>
                {p === 0 ? (lang === "ar" ? "جميع المراحل" : "All Phases") : PHASE_LABELS[p]}
              </Chip>
            ))}
          </div>

          {/* Filter row 2: Typology + Budget — horizontally scrollable */}
          <div className="flex items-center gap-2 pb-2.5 scrollbar-none" style={{ overflowX: "auto" }}>
            <Chip active={filterType === "all"} onClick={() => setFilterType("all")}>
              {lang === "ar" ? "جميع الأنواع" : "All Types"}
            </Chip>
            {mounted && devTypes.map((tp) => (
              <Chip key={tp} active={filterType === tp} onClick={() => setFilterType(tp)}>
                {DEVELOPMENT_TYPES[tp].label}
              </Chip>
            ))}
            <div className="w-px h-5 flex-shrink-0" style={{ background: C.border, margin: "0 2px" }} />
            {(["all", "lt300", "300to600", "gt600"] as const).map((b) => (
              <Chip key={b} active={filterBudget === b} onClick={() => setFilterBudget(b)}>
                {lang === "ar" ? BUDGET_LABELS[b].ar : BUDGET_LABELS[b].en}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map view ── */}
      {viewMode === "map" && (
        <div className="max-w-7xl mx-auto px-5 pt-4 pb-24 md:pb-8">
          <div className="flex gap-4 items-start">
            {/* Map — collapses to compact thumbnail when a lot is selected */}
            <div className={`${mapLotEntry ? "w-72 flex-shrink-0" : "flex-1 min-w-0"} transition-all duration-300`}>
              <CustomerMap
                filteredLotIds={filteredLotIds}
                assignments={assignments}
                lotStatuses={lotStatuses}
                onSelectLot={handleMapLotSelect}
                selectedLotId={selectedMapLotId}
                lang={lang}
                compact={!!mapLotEntry}
                lotGroups={lotGroups}
              />
            </div>

            {/* Desktop side panel — hidden on mobile */}
            <div
              className={`hidden md:flex ${mapLotEntry ? "flex-1 min-w-0" : "w-80 flex-shrink-0"} rounded-2xl overflow-hidden flex-col transition-all duration-300`}
              style={{
                border: `1px solid ${C.sand}`,
                background: C.white,
                boxShadow: "0 4px 24px rgba(28,32,16,0.07)",
                maxHeight: mapLotEntry ? "calc(100vh - 10rem)" : "580px",
              }}>
              {/* No selection — rich empty state */}
              {!mapLotEntry && (
                <div className="h-full flex flex-col p-5 min-h-52">
                  {/* Top prompt */}
                  <div className="flex-1 flex flex-col items-center justify-center text-center mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                      style={{ background: C.goldBg, border: `1px solid ${C.sand}` }}>
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {lang === "ar" ? "اختر قطعة أرض" : "Select a Plot"}
                    </p>
                    <p className="text-xs leading-relaxed max-w-[180px]" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      {lang === "ar"
                        ? "انقر على أي نقطة ملونة على الخريطة لعرض الوحدات والتسعير"
                        : "Click any coloured dot on the map to explore units, floor plans, and pricing"}
                    </p>
                  </div>
                  {/* Typology legend */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] uppercase tracking-wider font-medium mb-2" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                      {lang === "ar" ? "أنواع التطوير" : "Development Types"}
                    </p>
                    {mounted && sortedDevTypes.slice(0, 4).map(tp => {
                      const cfg = DEVELOPMENT_TYPES[tp];
                      const meta = TYPOLOGY_CUSTOMER_META[tp];
                      const stat = typologyStats[tp];
                      return (
                        <button
                          key={tp}
                          onClick={() => { setFilterType(tp as DevelopmentType); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-start"
                          style={{ background: filterType === tp ? cfg.color + "18" : "transparent",
                            border: `1px solid ${filterType === tp ? cfg.color + "40" : C.sand}` }}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                          <span className="flex-1 text-xs font-medium" style={{ color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            {lang === "ar" ? meta?.headline_ar : meta?.headline_en ?? cfg.label}
                          </span>
                          {stat && (
                            <span className="text-[10px]" style={{ color: C.muted }}>
                              {stat.availableCount}
                              <span style={{ color: C.border }}> / {stat.lotCount}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {filterType !== "all" && (
                      <button onClick={() => setFilterType("all")}
                        className="w-full text-center text-[10px] py-1 transition-colors"
                        style={{ color: C.gold, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                        {lang === "ar" ? "عرض الكل" : "Show all types"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lot selected → unit list */}
              {mapLotEntry && showingUnitList && !selectedUnit && (
                <MapUnitList
                  lotId={mapLotEntry.lot.id}
                  devType={mapLotEntry.assignment.developmentType}
                  status={mapLotEntry.status}
                  units={mapLotEntry.units}
                  lang={lang}
                  t={t as (k: string) => string}
                  onSelectUnit={(u) => {
                    setSelectedUnit({ unit: u, devType: mapLotEntry.assignment.developmentType, status: mapLotEntry.status });
                    setShowingUnitList(false);
                  }}
                  onClose={() => { setSelectedMapLotId(null); setShowingUnitList(false); }}
                />
              )}

              {/* Unit detail (wide=true since panel expands) */}
              {selectedUnit && (
                <UnitDetail
                  sel={selectedUnit}
                  lang={lang}
                  t={t as (k: string) => string}
                  projectSpecs={projectSpecs}
                  wide={true}
                  onClose={() => {
                    if (mapLotEntry && mapLotEntry.units.length > 1) {
                      setSelectedUnit(null);
                      setShowingUnitList(true);
                    } else {
                      setSelectedUnit(null);
                      setSelectedMapLotId(null);
                    }
                  }}
                  onEnquire={() => setEnquireUnit(selectedUnit)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Grid view ── */}
      {viewMode === "grid" && (
        <div className="max-w-7xl mx-auto px-5 pt-4 pb-24 md:pb-8">
          {lots.length === 0 ? (
            <div className="text-center py-20" style={{ color: C.muted }}>
              <div className="text-5xl mb-4 opacity-25">⌂</div>
              <p className="text-sm font-medium" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {lang === "ar" ? "لا توجد قطع تطابق الفلاتر الحالية." : "No lots match the current filters."}
              </p>
              {totalAssigned === 0 && (
                <p className="text-xs mt-2" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {lang === "ar" ? "لم يتم تهيئة أي قطعة." : "No lots configured yet."}
                </p>
              )}
            </div>
          ) : (
            <div className="flex gap-5 items-start">
              {/* Lot sections */}
              <div className={`${selectedUnit ? "flex-1 min-w-0" : "w-full"} space-y-8`}>
                {lots.map(({ lot, assignment, status }) => {
                  const devCfg     = DEVELOPMENT_TYPES[assignment.developmentType];
                  const phaseColor = PHASE_COLORS[assignment.phase];
                  const units      = mounted ? (lotUnits.get(lot.id) ?? []) : [];
                  const scfg       = STATUS_CFG[status];

                  return (
                    <div key={lot.id}>
                      {/* Lot header */}
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shadow-sm flex-shrink-0"
                          style={{ backgroundColor: devCfg.color, color: C.white }}>
                          {devCfg.shortLabel}
                        </div>
                        <div>
                          <div className="text-sm font-bold dh-serif" style={{ color: C.ink }}>
                            {lang === "ar" ? `${t("lot_id")} ${lot.id}` : `Lot ${lot.id}`}
                            <span className="ms-2 font-normal text-xs" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                              {devCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            <span style={{ color: phaseColor }}>{PHASE_LABELS[assignment.phase]}</span>
                            <span>·</span>
                            <span>{fmt(lot.area_sqm)} m² {lang === "ar" ? "أرض" : "land"}</span>
                            {lot.oug_allowed && <><span>·</span><span>OUG</span></>}
                            <span>·</span>
                            <span style={{ color: scfg.textColor }}>
                              {lang === "ar" ? scfg.label_ar : scfg.label_en}
                            </span>
                          </div>
                        </div>
                        <div className="ms-auto h-px flex-1" style={{ background: C.sand }} />
                      </div>

                      {/* Unit cards */}
                      <div className={`grid gap-3 ${
                        units.length === 1 ? "grid-cols-1 max-w-sm" :
                        units.length === 2 ? "grid-cols-2" :
                        units.length <= 4  ? "grid-cols-2 sm:grid-cols-4" :
                        "grid-cols-2 sm:grid-cols-3"
                      }`}>
                        {units.length === 0 && !mounted && (
                          Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="rounded-xl h-36 animate-pulse" style={{ background: C.sand }} />
                          ))
                        )}
                        {units.map(unit => {
                          const isSelected    = selectedUnit?.unit.id === unit.id;
                          const isUnavailable = status !== "available";

                          return (
                            <button
                              key={unit.id}
                              onClick={() => {
                                if (isSelected) { setSelectedUnit(null); return; }
                                setSelectedUnit({ unit, devType: assignment.developmentType, status });
                              }}
                              className="text-start rounded-xl overflow-hidden transition-all"
                              style={{
                                border: isSelected ? `1.5px solid ${C.forest}` : `1.5px solid ${C.sand}`,
                                background: isSelected ? C.goldBg : C.white,
                                boxShadow: isSelected ? `0 4px 20px rgba(45,90,39,0.14)` : "none",
                                opacity: isUnavailable ? 0.7 : 1,
                                cursor: isUnavailable ? "default" : "pointer",
                              }}
                            >
                              {/* Image header */}
                              <div className="relative overflow-hidden" style={{ height: "82px", backgroundColor: devCfg.color + "18" }}>
                                <img
                                  src={`/typologies/${assignment.developmentType}-perspective.jpg`}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                                {isUnavailable && (
                                  <div className="absolute inset-0 flex items-end pb-1.5 ps-2">
                                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                                      style={{ background: scfg.bg, color: C.white }}>
                                      {lang === "ar" ? scfg.label_ar : scfg.label_en}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Card body */}
                              <div className="p-3">
                                {/* Label */}
                                <div className="text-xs font-bold mb-1.5" style={{ color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                  {lang === "ar" ? unit.labelAr : unit.label}
                                </div>
                                {/* Price */}
                                {unit.price > 0 && (
                                  <div className="dh-serif font-bold tabular-nums mb-2"
                                    style={{ color: C.ink, fontSize: "1.05rem" }} dir="ltr">
                                    {fmtUSD(unit.price)}
                                  </div>
                                )}
                                {/* Specs */}
                                <div className="space-y-0.5" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                                    <svg className="w-3 h-3 flex-shrink-0 opacity-40" viewBox="0 0 16 16" fill="currentColor">
                                      <rect x="2" y="2" width="12" height="12" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                                    </svg>
                                    {fmt(unit.areaSqm)} m²
                                  </div>
                                  {unit.bedroomCount > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                                      <svg className="w-3 h-3 flex-shrink-0 opacity-40" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M2 10V7a1 1 0 011-1h10a1 1 0 011 1v3M2 10h12M2 10v3h12v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                      </svg>
                                      {unit.bedroomCount} {lang === "ar" ? "غرف" : "br"}
                                    </div>
                                  )}
                                  {unit.gardenSqm > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                                      <span className="text-[10px]">🌿</span>
                                      {fmt(unit.gardenSqm)}m²
                                    </div>
                                  )}
                                  {unit.terraceSqm > 0 && (
                                    <div className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                                      <span className="text-[10px]">☀️</span>
                                      {fmt(unit.terraceSqm)}m²
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 flex-wrap mt-1">
                                    {unit.floors.map(f => (
                                      <span key={f} className="text-[9px] rounded px-1.5 py-0.5"
                                        style={{ background: C.sand, color: C.muted }}>
                                        {lang === "ar" ? FLOOR_LABELS[f]?.ar : FLOOR_LABELS[f]?.en}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {!isUnavailable && !isSelected && (
                                  <div className="mt-2 text-[9px] font-medium" style={{ color: C.gold }}>
                                    {lang === "ar" ? "انقر لعرض التفاصيل ←" : "Tap for details →"}
                                  </div>
                                )}
                                {isSelected && (
                                  <div className="mt-2 text-[9px] font-medium" style={{ color: C.forest }}>
                                    {lang === "ar" ? "← محدد" : "Selected ✓"}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop side panel — hidden on mobile */}
              {selectedUnit && (
                <div
                  className="hidden md:flex w-80 flex-shrink-0 rounded-2xl overflow-hidden flex-col sticky top-28"
                  style={{
                    background: C.white,
                    border: `1px solid ${C.sand}`,
                    boxShadow: "0 4px 24px rgba(28,32,16,0.08)",
                    maxHeight: "calc(100vh - 8rem)",
                  }}>
                  <UnitDetail
                    sel={selectedUnit}
                    lang={lang}
                    t={t as (k: string) => string}
                    projectSpecs={projectSpecs}
                    onClose={() => setSelectedUnit(null)}
                    onEnquire={() => setEnquireUnit(selectedUnit)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Typologies view ── */}
      {viewMode === "typologies" && (
        <div className="max-w-7xl mx-auto px-5 pt-6 pb-24 md:pb-12">
          {/* Section header */}
          <div className="mb-6">
            <h2 className="dh-serif font-bold text-xl mb-1" style={{ color: C.ink }}>
              {lang === "ar" ? "أنواع التطوير" : "Development Types"}
            </h2>
            <p className="text-sm" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
              {lang === "ar"
                ? "استكشف الأنواع المختلفة المتاحة في دده هيلز"
                : "Explore the different typologies available at Deddeh Hills"}
            </p>
          </div>

          {/* Typology cards grid */}
          {!mounted ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl h-56 animate-pulse" style={{ background: C.sand }} />
              ))}
            </div>
          ) : sortedDevTypes.length === 0 ? (
            <div className="text-center py-20" style={{ color: C.muted }}>
              <div className="text-5xl mb-4 opacity-25">🏗️</div>
              <p className="text-sm" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {lang === "ar" ? "لم يتم تهيئة أي نوع تطوير بعد." : "No development types configured yet."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedDevTypes.map(tp => {
                const cfg  = DEVELOPMENT_TYPES[tp];
                const meta = TYPOLOGY_CUSTOMER_META[tp];
                const stat = typologyStats[tp] ?? { lotCount: 0, availableCount: 0, fromPrice: 0, unitCount: 0 };
                const fromPrice = stat.fromPrice < Infinity ? stat.fromPrice : 0;

                return (
                  <div
                    key={tp}
                    className="rounded-2xl overflow-hidden transition-all duration-200"
                    style={{
                      background: C.white,
                      border: `1px solid ${C.sand}`,
                      boxShadow: "0 2px 12px rgba(28,32,16,0.06)",
                    }}
                  >
                    {/* Card accent bar + header */}
                    <div className="px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${C.sand}` }}>
                      <div className="flex items-start gap-3">
                        {/* Icon badge */}
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ background: cfg.color + "22", border: `1.5px solid ${cfg.color}44` }}>
                          {meta?.icon ?? "🏠"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
                            <h3 className="dh-serif font-bold text-base leading-tight" style={{ color: C.ink }}>
                              {lang === "ar" ? (meta?.headline_ar ?? cfg.label) : (meta?.headline_en ?? cfg.label)}
                            </h3>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            {lang === "ar" ? meta?.description_ar : meta?.description_en}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Specs row */}
                    <div className="px-5 py-3" style={{ borderBottom: `1px solid ${C.sand}` }}>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {(lang === "ar" ? (meta?.specs_ar ?? []) : (meta?.specs_en ?? [])).map((spec, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            <span className="w-1 h-1 rounded-full" style={{ background: cfg.color }} />
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats + CTA */}
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {fromPrice > 0 && (
                          <div>
                            <div className="text-[9px] uppercase tracking-wider font-medium mb-0.5" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                              {lang === "ar" ? "يبدأ من" : "From"}
                            </div>
                            <div className="dh-serif font-bold text-base" style={{ color: C.forest }} dir="ltr">
                              {fmtUSD(fromPrice)}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[9px] uppercase tracking-wider font-medium mb-0.5" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            {lang === "ar" ? "متاح" : "Available"}
                          </div>
                          <div className="text-base font-bold" style={{ color: stat.availableCount > 0 ? "#22c55e" : "#ef4444", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                            {stat.availableCount}
                            <span className="text-xs font-normal ms-1" style={{ color: C.muted }}>/ {stat.unitCount} {lang === "ar" ? "وحدة" : "units"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Explore CTA */}
                      <button
                        onClick={() => {
                          setFilterType(tp as DevelopmentType);
                          setViewMode("map");
                          setSelectedUnit(null);
                          setSelectedMapLotId(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                        style={{
                          background: stat.availableCount > 0 ? C.forest : C.sand,
                          color: stat.availableCount > 0 ? C.white : C.muted,
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                      >
                        {lang === "ar" ? "استكشف على الخريطة" : "Explore on Map"}
                        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                          <path fillRule="evenodd" d="M1 8a.5.5 0 01.5-.5h11.793l-3.147-3.146a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L13.293 8.5H1.5A.5.5 0 011 8z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comparison hint */}
          {mounted && sortedDevTypes.length > 0 && (
            <div className="mt-6 rounded-2xl px-5 py-4 flex items-center gap-4" style={{ background: C.goldBg, border: `1px solid ${C.sand}` }}>
              <div className="text-2xl flex-shrink-0">💡</div>
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: C.ink, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {lang === "ar" ? "لست متأكداً؟" : "Not sure which type?"}
                </p>
                <p className="text-xs" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                  {lang === "ar"
                    ? "انقر على \"استكشف على الخريطة\" لرؤية المواقع الدقيقة على المخطط الرئيسي."
                    : "Click \"Explore on Map\" to see exact locations on the master plan, or switch to Browse for a full list."}
                </p>
              </div>
              <button onClick={() => setViewMode("grid")}
                className="ms-auto flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{ background: C.white, color: C.forest, border: `1px solid ${C.sand}`, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                {lang === "ar" ? "استعراض الوحدات" : "Browse All"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mobile bottom sheet ── */}
      {mobileSheetOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(28,32,16,0.45)" }}
            onClick={() => {
              if (viewMode === "map" && showingUnitList && mapLotEntry) {
                setSelectedMapLotId(null);
                setShowingUnitList(false);
              } else {
                setSelectedUnit(null);
                if (viewMode === "map") setSelectedMapLotId(null);
              }
            }}
          />
          {/* Sheet */}
          <div
            className="absolute bottom-0 inset-x-0 rounded-t-3xl overflow-hidden flex flex-col sheet-enter"
            style={{ maxHeight: "92vh", background: C.white }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: C.border }} />
            </div>
            {/* Sheet content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {viewMode === "map" && mapLotEntry && showingUnitList && !selectedUnit && (
                <MapUnitList
                  lotId={mapLotEntry.lot.id}
                  devType={mapLotEntry.assignment.developmentType}
                  status={mapLotEntry.status}
                  units={mapLotEntry.units}
                  lang={lang}
                  t={t as (k: string) => string}
                  onSelectUnit={(u) => {
                    setSelectedUnit({ unit: u, devType: mapLotEntry.assignment.developmentType, status: mapLotEntry.status });
                    setShowingUnitList(false);
                  }}
                  onClose={() => { setSelectedMapLotId(null); setShowingUnitList(false); }}
                />
              )}
              {selectedUnit && (
                <UnitDetail
                  sel={selectedUnit}
                  lang={lang}
                  t={t as (k: string) => string}
                  projectSpecs={projectSpecs}
                  onClose={() => {
                    if (viewMode === "map" && mapLotEntry && mapLotEntry.units.length > 1) {
                      setSelectedUnit(null);
                      setShowingUnitList(true);
                    } else {
                      setSelectedUnit(null);
                      if (viewMode === "map") setSelectedMapLotId(null);
                    }
                  }}
                  onEnquire={() => setEnquireUnit(selectedUnit)}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Enquire Modal ── */}
      {enquireUnit && (
        <EnquireModal
          unitLabel={
            lang === "ar"
              ? `${t("lot_id")} ${enquireUnit.unit.lotId} — ${enquireUnit.unit.labelAr}`
              : `Lot ${enquireUnit.unit.lotId} — ${enquireUnit.unit.label}`
          }
          lotId={enquireUnit.unit.lotId}
          unitId={enquireUnit.unit.id}
          lang={lang}
          t={t as (k: string) => string}
          onClose={() => setEnquireUnit(null)}
        />
      )}

      {/* ── Footer ── */}
      <div style={{ borderTop: `1px solid ${C.sand}`, background: C.white }}>
        <div className="max-w-7xl mx-auto px-5 py-5 flex items-center justify-between">
          <div className="text-xs" style={{ color: C.muted, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Deddeh Hills · Koura, Lebanon · All prices in USD
          </div>
          <div className="flex items-center gap-4">
            <LanguageToggle />
          </div>
        </div>
      </div>
    </div>
  );
}
