"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/i18n/useTranslations";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useSimulationStore } from "@/store/simulation-store";
import { LOTS } from "@/data/lots";
import { generateUnitsForLot } from "@/data/units";
import type { LotStatus } from "@/types";

/* ─── Design tokens — extracted from Deddeh Hills logo ──────── */
const C = {
  // Page surfaces
  bg:       "#F4F9EF",
  bgAlt:    "#EAF4E1",
  white:    "#FFFFFF",

  // Dark hero / footer
  darkBg:   "#1A3810",
  darkAlt:  "#213F15",

  // Logo greens
  hills:    "#78BF42",
  hillsHov: "#67AA34",
  deep:     "#3D7A24",
  mid:      "#62AE35",
  light:    "#95CC58",
  lightBg:  "rgba(120,191,66,0.10)",

  // Text
  ink:       "#373737",
  muted:     "#6A7B5F",
  mutedDark: "rgba(255,255,255,0.58)",

  // Borders
  border:    "#C8E0B5",
  faint:     "rgba(62,122,36,0.13)",
  faintDark: "rgba(255,255,255,0.10)",
};

/* ─── Enquiry form — bilingual ────────────────────────────────── */
function EnquiryForm() {
  const { t, isRTL } = useTranslations();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  const bFont = isRTL
    ? "'Noto Sans Arabic', system-ui, sans-serif"
    : "'DM Sans', system-ui, sans-serif";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSending(true);
    setSubmitError(false);
    try {
      const res = await fetch("/api/enquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("server error");
      setSent(true);
    } catch {
      setSubmitError(true);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: C.lightBg, border: `2px solid ${C.hills}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px", fontSize: 22,
        }}>✓</div>
        <p style={{ color: C.deep, fontWeight: 600, marginBottom: 8, fontSize: 16, fontFamily: bFont }}>{t("landing_form_thanks")}</p>
        <p style={{ color: C.muted, fontSize: 14, fontFamily: bFont }}>{t("landing_form_touch")}</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    background: C.white, border: `1.5px solid ${C.border}`,
    borderRadius: 10, color: C.ink, fontSize: 14,
    fontFamily: bFont,
    outline: "none", boxSizing: "border-box", resize: "none",
    transition: "border-color 0.2s",
    direction: isRTL ? "rtl" : "ltr",
  };

  const field = (key: keyof typeof form, placeholder: string, type = "text", rows?: number) => {
    const shared = {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value })),
      placeholder,
      style: inputStyle,
      onFocus:  (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = C.hills; },
      onBlur:   (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { e.currentTarget.style.borderColor = C.border; },
    };
    if (rows) return <textarea key={key} rows={rows} {...shared} />;
    return <input key={key} type={type} {...shared} />;
  };

  const canSubmit = !sending && !!form.name && !!form.email;
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="dh-form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {field("name",  t("landing_form_name"))}
        {field("email", t("landing_form_email"), "email")}
      </div>
      {field("phone",   t("landing_form_phone"), "tel")}
      {field("message", t("landing_form_message"), "text", 3)}
      {submitError && (
        <p style={{ color: "#DC2626", fontSize: 13, fontFamily: bFont, margin: "4px 0 -4px" }}>
          {isRTL
            ? "تعذّر إرسال طلبك. يرجى المحاولة مرة أخرى."
            : "Something went wrong. Please try again."}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: "13px 24px",
          background: canSubmit ? C.hills : C.lightBg,
          border: "none", borderRadius: 10,
          color: canSubmit ? C.white : C.muted,
          fontSize: 14, fontWeight: 600,
          fontFamily: bFont,
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "all 0.2s", marginTop: 4,
        }}
        onMouseOver={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = C.hillsHov; }}
        onMouseOut={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = C.hills; }}
      >
        {sending ? t("landing_form_sending") : t("enquire_send")}
      </button>
    </form>
  );
}

/* ─── Price formatter ───────────────────────────────────────── */
function fmtPrice(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000)     return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

/* ─── Main landing page ─────────────────────────────────────── */
export default function LandingPage() {
  const { t, lang, isRTL } = useTranslations();
  const [scrolled, setScrolled] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  /* ── Store state ──────────────────────────────────────────── */
  const assignments        = useSimulationStore((s) => s.assignments);
  const lotStatuses        = useSimulationStore((s) => s.lotStatuses);
  const typeAssumptions    = useSimulationStore((s) => s.typeAssumptions);
  const initStateFromServer = useSimulationStore((s) => s.initStateFromServer);

  useEffect(() => { setMounted(true); initStateFromServer(); }, [initStateFromServer]);

  /* ── Dynamic typology stats ───────────────────────────────── */
  const typologyData = useMemo(() => {
    const result: Record<string, { unitCount: number; availableCount: number; fromPrice: number }> = {};
    LOTS.forEach((lot) => {
      const assignment = assignments.get(lot.id);
      if (!assignment || assignment.developmentType === "unassigned") return;
      const tp = assignment.developmentType;
      const status: LotStatus = lotStatuses.get(lot.id) ?? "available";
      if (!result[tp]) result[tp] = { unitCount: 0, availableCount: 0, fromPrice: Infinity };
      const units = generateUnitsForLot(lot, tp);
      result[tp].unitCount += units.length;
      if (status === "available") result[tp].availableCount += units.length;
      const asmp = typeAssumptions[tp];
      if (asmp) {
        const price = asmp.sellingPricePerM * asmp.avgUnitSize;
        if (price > 0 && price < result[tp].fromPrice) result[tp].fromPrice = price;
      }
    });
    return result;
  }, [assignments, lotStatuses, typeAssumptions]);

  /* ── Font helpers ─────────────────────────────────────────── */
  const bFont = isRTL
    ? "'Noto Sans Arabic', system-ui, sans-serif"
    : "'DM Sans', system-ui, sans-serif";
  const hFont = isRTL
    ? "'Noto Sans Arabic', system-ui, sans-serif"
    : "'Playfair Display', Georgia, serif";

  /* ── Bilingual data ───────────────────────────────────────── */
  const TYPOLOGIES = [
    {
      id: "villa_2f",
      label: lang === "ar" ? "فيلا (طابقان)" : "Villa (2 Floors)",
      badge: "V2F",
      color: C.mid,
      colorBg: "rgba(98,174,53,0.10)",
      beds: "4–5 br",
      size: "250–350 m²",
      desc: lang === "ar"
        ? "فيلا مستقلة بطابقين مع حديقة خاصة وموقف سيارات تحت الأرض."
        : "Standalone two-floor villa with private garden and underground parking.",
    },
    {
      id: "villa_3f",
      label: lang === "ar" ? "فيلا (ثلاثة طوابق)" : "Villa (3 Floors)",
      badge: "V3F",
      color: C.deep,
      colorBg: "rgba(61,122,36,0.10)",
      beds: "5–6 br",
      size: "400–600 m²",
      desc: lang === "ar"
        ? "فيلا فسيحة بثلاثة طوابق — مثالية للعائلات الممتدة مع إطلالات بانورامية."
        : "Spacious three-floor villa — ideal for extended families with panoramic views.",
    },
    {
      id: "twin_villa",
      label: lang === "ar" ? "فيلا توأم" : "Twin Villa",
      badge: "TWIN",
      color: C.hills,
      colorBg: "rgba(120,191,66,0.10)",
      beds: "3–4 br",
      size: "200–280 m²",
      desc: lang === "ar"
        ? "فيلا مزدوجة شبه منفصلة تجمع بين الحياة المجتمعية والمساحة الخارجية الخاصة."
        : "Semi-detached paired villa offering community living with private outdoor space.",
    },
    {
      id: "apartments",
      label: lang === "ar" ? "شقق وديبلكس" : "Apartments & Duplexes",
      badge: "APT",
      color: "#5AAE28",
      colorBg: "rgba(90,174,40,0.10)",
      beds: "2–3 br",
      size: "120–220 m²",
      desc: lang === "ar"
        ? "شقق وديبلكس عصرية مع مرافق مشتركة."
        : "Contemporary apartments and duplex units with shared amenities.",
    },
  ];

  const FEATURES = [
    { icon: "🔒", label: lang === "ar" ? "مجتمع مسوّر"          : "Gated community",         sub: lang === "ar" ? "محيط مؤمّن ٢٤/٧"                  : "24/7 secured perimeter"      },
    { icon: "🛣️", label: lang === "ar" ? "طرق داخلية معبّدة"    : "Paved internal roads",    sub: lang === "ar" ? "بنية تحتية متكاملة"               : "Full infrastructure built"    },
    { icon: "⚡", label: lang === "ar" ? "كهرباء مستقلة"         : "Independent electricity",  sub: lang === "ar" ? "مولدات كهرباء في الموقع"          : "On-site generator supply"     },
    { icon: "💧", label: lang === "ar" ? "إمداد مياه عذبة"       : "Fresh water supply",       sub: lang === "ar" ? "شبكة مياه مخصصة"                  : "Dedicated water network"      },
    { icon: "🌿", label: lang === "ar" ? "مساحات خضراء مشتركة"  : "Landscaped commons",       sub: lang === "ar" ? "مساحات خضراء مشتركة"              : "Green shared spaces"          },
    { icon: "🏔️", label: lang === "ar" ? "إطلالات جبلية وبحرية" : "Mountain & sea views",     sub: lang === "ar" ? "موقع على قمة التل"                : "Panoramic hilltop position"   },
    { icon: "📋", label: lang === "ar" ? "خطط دفع مرنة"         : "Flexible payment plans",   sub: lang === "ar" ? "دفعات مرحلية قبل الإنشاء"         : "Off-plan staged payments"     },
    { icon: "🏗️", label: lang === "ar" ? "أسعار ما قبل الإنشاء" : "Off-plan pricing",         sub: lang === "ar" ? "احجز بأسعار ما قبل الإطلاق"       : "Lock in pre-launch rates"     },
  ];

  const DISTANCES = [
    { place: lang === "ar" ? "وسط طرابلس"      : "Tripoli city centre",  time: "7 min"  },
    { place: lang === "ar" ? "بيروت"            : "Beirut",               time: "75 min" },
    { place: lang === "ar" ? "تقاطع الشيخا"    : "Chekka interchange",   time: "15 min" },
    { place: lang === "ar" ? "البترون"          : "Batroun",              time: "20 min" },
  ];

  const LOC_FEATURES = [
    { icon: "🏔️", text: lang === "ar" ? "ارتفاع على التل مع إطلالات على الوادي والبحر"  : "Hilltop elevation with valley and sea views"    },
    { icon: "🛤️", text: lang === "ar" ? "وصول مباشر من الطريق الرئيسي للكورة"           : "Direct access from the Koura main road"         },
    { icon: "🌳", text: lang === "ar" ? "محاط بكروم الزيتون وأشجار الصنوبر"              : "Surrounded by olive groves and pine trees"      },
    { icon: "☀️", text: lang === "ar" ? "مناخ متوسطي — صيف دافئ وجاف"                   : "Mediterranean climate — warm, dry summers"      },
    { icon: "🔇", text: lang === "ar" ? "منطقة سكنية هادئة بعيداً عن الازدحام العمراني" : "Quiet residential area, away from urban density"},
  ];

  const BUILDING_SPECS = [
    {
      icon: "🪨",
      title: lang === "ar" ? "كسوة الحجر الطبيعي"      : "Natural Stone Cladding",
      desc:  lang === "ar"
        ? "تستلزم جميع الواجهات الأربع كسوة حجر طبيعي بنسبة ≥٨٠٪ — السمة المعمارية الأيقونية للشمال اللبناني."
        : "All four facades require ≥80% natural stone cladding — the defining mark of North Lebanese heritage architecture.",
    },
    {
      icon: "🏠",
      title: lang === "ar" ? "أسقف قرميدية تقليدية"    : "Traditional Tiled Roofs",
      desc:  lang === "ar"
        ? "يُغطى ما لا يقل عن ٨٠٪ من مساحة السقف بالقرميد الفخاري التقليدي، للحفاظ على سيلويت التل."
        : "A minimum of 80% of each roof surface must be covered in traditional clay tile, preserving the hillside silhouette.",
    },
    {
      icon: "📐",
      title: lang === "ar" ? "مقياس معماري منخفض"       : "Low-Rise Scale",
      desc:  lang === "ar"
        ? "أقصى ارتفاع للمبنى ٨م + ١م لحافة القرميد، مما يحافظ على تناسق المسكن مع تضاريس التل."
        : "Maximum 8m building height + 1m for the tile ridge — every home stays proportional to the natural hillside terrain.",
    },
    {
      icon: "↔️",
      title: lang === "ar" ? "ارتدادات سخية"            : "Generous Setbacks",
      desc:  lang === "ar"
        ? "ارتدادات لا تقل عن ٥م عن الطرق الداخلية والعامة، تضمن الخصوصية وإطلالات مفتوحة."
        : "Minimum 5m setbacks from all internal and public roads — ensuring privacy and open sight lines across the estate.",
    },
    {
      icon: "✨",
      title: lang === "ar" ? "واجهات خالية من المعدات"  : "Clutter-Free Facades",
      desc:  lang === "ar"
        ? "لا يُسمح بأي معدات ميكانيكية أو مكيفات أو تركيبات تقنية ظاهرة على أي واجهة خارجية."
        : "No visible mechanical equipment, AC units, or technical installations permitted on any external elevation.",
    },
    {
      icon: "🚗",
      title: lang === "ar" ? "مواقف سيارات خاصة"        : "Private Parking",
      desc:  lang === "ar"
        ? "مواقفان مخصصان على الأقل لكل وحدة سكنية، مدمجان ضمن حدود القطعة الخاصة."
        : "Minimum two dedicated parking spaces per residential unit, integrated within the private plot boundary.",
    },
  ];

  /* ── CSS injection (fonts + animations) ──────────────────── */
  useEffect(() => {
    const id = "dh-landing-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Noto+Sans+Arabic:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up   { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .fade-up-1 { animation-delay: 0.08s; }
        .fade-up-2 { animation-delay: 0.20s; }
        .fade-up-3 { animation-delay: 0.32s; }
        .fade-up-4 { animation-delay: 0.44s; }
        .fade-up-5 { animation-delay: 0.56s; }
        a { text-decoration: none; color: inherit; }
        ::placeholder { color: #9DB090; }
        /* Stats bar — absolute on desktop, flows in flex on mobile */
        .dh-stats-bar {
          position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%);
          z-index: 3; display: flex; flex-wrap: nowrap; justify-content: center;
          background: rgba(255,255,255,0.06); backdrop-filter: blur(16px);
          border: 1px solid rgba(149,204,88,0.22); border-radius: 14px; overflow: hidden;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .dh-stats-bar {
            position: relative; bottom: auto; left: auto; transform: none;
            width: calc(100% - 0px); margin-top: 36px; flex-wrap: wrap;
            white-space: normal;
          }
          .dh-stats-bar > div {
            flex: 1 1 calc(50% - 2px); min-width: 0;
            padding: 14px 12px !important;
          }
          /* remove right border on 2nd cell (end of first row) */
          .dh-stats-bar > div:nth-child(2) { border-right: none !important; }
          /* add bottom border between rows */
          .dh-stats-bar > div:nth-child(1),
          .dh-stats-bar > div:nth-child(2) {
            border-bottom: 1px solid rgba(149,204,88,0.18);
          }
        }
      `;
      document.head.appendChild(el);
    }
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Nav ──────────────────────────────────────────────────── */
  const Nav = () => (
    <nav className="dh-sans" style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 32px", height: 64,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: scrolled ? "rgba(255,255,255,0.95)" : "transparent",
      backdropFilter: scrolled ? "blur(14px)" : "none",
      borderBottom: scrolled ? `1px solid ${C.border}` : "none",
      boxShadow: scrolled ? "0 1px 16px rgba(62,122,36,0.08)" : "none",
      transition: "all 0.3s",
    }}>
      {/* Logo */}
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: C.lightBg, border: `1.5px solid ${C.hills}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="dh-serif" style={{ color: C.hills, fontSize: 14, fontWeight: 700 }}>DH</span>
        </div>
        <span className="dh-serif" style={{
          color: scrolled ? C.ink : C.white,
          fontSize: 16, fontWeight: 600,
          transition: "color 0.3s",
        }}>
          Deddeh Hills
        </span>
      </a>

      {/* Desktop links — hidden on mobile via dh-nav-links */}
      <div className="dh-nav-links" style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13 }}>
        {[
          { label: t("landing_nav_typologies"), href: "#typologies" },
          { label: t("landing_nav_location"),   href: "#location"   },
          { label: t("landing_nav_contact"),    href: "#contact"    },
        ].map(({ label, href }) => (
          <a key={href} href={href}
            style={{ color: scrolled ? C.muted : "rgba(255,255,255,0.75)", transition: "color 0.2s", fontFamily: bFont }}
            onMouseOver={e => (e.currentTarget.style.color = scrolled ? C.deep : C.white)}
            onMouseOut={e => (e.currentTarget.style.color = scrolled ? C.muted : "rgba(255,255,255,0.75)")}
          >{label}</a>
        ))}
      </div>

      {/* Lang toggle + CTA — always visible */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <LanguageToggle className={scrolled ? "" : "border-white/30 bg-white/10 text-white hover:bg-white/20"} />
        <a
          href="/customer"
          style={{
            padding: "8px 20px", background: C.hills, color: C.white,
            borderRadius: 8, fontWeight: 600, fontSize: 13,
            transition: "background 0.2s",
            fontFamily: bFont,
          }}
          onMouseOver={e => (e.currentTarget.style.background = C.hillsHov)}
          onMouseOut={e => (e.currentTarget.style.background = C.hills)}
        >
          {t("landing_nav_explore")}
        </a>
      </div>
    </nav>
  );

  /* ── Hero ─────────────────────────────────────────────────── */
  const Hero = () => (
    <section style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "120px 24px 80px", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/master-plan.png')",
        backgroundSize: "cover", backgroundPosition: "center 30%",
        opacity: 0.15, filter: "saturate(0.4) hue-rotate(40deg)",
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: `linear-gradient(160deg, ${C.darkBg} 0%, #1E4710 35%, #163310 65%, ${C.darkBg} 100%)`,
      }} />
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(10,22,6,0.55) 100%)",
      }} />

      <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 760 }}>
        <p className="dh-sans fade-up fade-up-1" style={{
          color: C.light, fontSize: 11, fontWeight: 500,
          letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 20,
          fontFamily: bFont,
        }}>
          {lang === "ar" ? "الكورة · شمال لبنان" : "Koura · North Lebanon"}
        </p>

        <h1 className="dh-serif fade-up fade-up-2" style={{
          fontSize: "clamp(52px, 8.5vw, 96px)", fontWeight: 600,
          color: C.white, lineHeight: 1.0, marginBottom: 24,
          letterSpacing: "-0.02em",
          fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
        }}>
          Deddeh Hills
        </h1>

        <p className="dh-sans fade-up fade-up-3" style={{
          fontSize: "clamp(15px, 2vw, 18px)", color: C.mutedDark,
          lineHeight: 1.68, maxWidth: 520, margin: "0 auto 44px", fontWeight: 300,
          fontFamily: bFont,
        }}>
          {t("landing_hero_subtitle")}
        </p>

        <div className="fade-up fade-up-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/customer" style={{
            padding: "15px 34px", background: C.hills, color: C.white,
            borderRadius: 10, fontWeight: 600, fontSize: 15,
            fontFamily: bFont,
            transition: "background 0.2s", display: "inline-block",
          }}
            onMouseOver={e => (e.currentTarget.style.background = C.hillsHov)}
            onMouseOut={e => (e.currentTarget.style.background = C.hills)}
          >
            {t("landing_hero_browse")}
          </a>
          <a href="#contact" style={{
            padding: "15px 34px", background: "transparent",
            color: C.white, border: `1.5px solid rgba(255,255,255,0.28)`,
            borderRadius: 10, fontWeight: 400, fontSize: 15,
            fontFamily: bFont,
            transition: "border-color 0.2s", display: "inline-block",
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.light; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
          >
            {t("landing_hero_enquire")}
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="fade-up fade-up-5 dh-sans dh-stats-bar">
        {[
          { value: "101",     label: t("landing_stats_lots")       },
          { value: "4",       label: t("landing_nav_typologies")   },
          { value: "59",      label: t("landing_stats_available")  },
          { value: lang === "ar" ? "المرحلة ١" : "Phase 1", label: t("landing_stats_phase_label") },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: "16px 30px", textAlign: "center",
            borderRight: i < 3 ? "1px solid rgba(149,204,88,0.18)" : "none",
          }}>
            <div className="dh-serif" style={{ fontSize: 22, fontWeight: 600, color: C.white, fontFamily: hFont }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.light, marginTop: 3, letterSpacing: "0.07em", fontFamily: bFont }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );

  /* ── About ────────────────────────────────────────────────── */
  const About = () => (
    <section style={{ padding: "96px 24px", background: C.white }}>
      <div className="dh-about-grid" style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 72, alignItems: "center",
      }}>
        <div>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 600,
            fontFamily: bFont,
          }}>{t("landing_about_eyebrow")}</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.15, marginBottom: 24,
            fontFamily: hFont,
          }}>
            {t("landing_about_heading")}
          </h2>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.78, marginBottom: 20, fontWeight: 300,
            fontFamily: bFont,
          }}>
            {t("landing_about_p1")}
          </p>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.78, fontWeight: 300,
            fontFamily: bFont,
          }}>
            {t("landing_about_p2")}
          </p>

          <div style={{
            display: "flex", gap: 28, marginTop: 36,
            paddingTop: 32, borderTop: `1px solid ${C.border}`,
          }}>
            {[
              { val: "101", lbl: t("landing_about_lots")      },
              { val: "4",   lbl: t("landing_nav_typologies")  },
              { val: "3",   lbl: t("landing_about_phases")    },
            ].map(s => (
              <div key={s.lbl}>
                <div className="dh-serif" style={{ fontSize: 28, fontWeight: 700, color: C.deep, fontFamily: hFont }}>{s.val}</div>
                <div className="dh-sans" style={{ fontSize: 12, color: C.muted, marginTop: 2, fontFamily: bFont }}>{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          borderRadius: 20, overflow: "hidden",
          border: `1px solid ${C.border}`,
          aspectRatio: "4/3", position: "relative",
          boxShadow: "0 8px 40px rgba(62,122,36,0.12)",
        }}>
          <img
            src="/master-plan.png"
            alt="Deddeh Hills master plan"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div style={{
            position: "absolute", bottom: 16,
            ...(isRTL ? { right: 16 } : { left: 16 }),
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(8px)",
            borderRadius: 10, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.hills }} />
            <span className="dh-sans" style={{ fontSize: 12, color: C.ink, fontWeight: 500, fontFamily: bFont }}>{t("landing_about_masterplan")}</span>
          </div>
        </div>
      </div>
    </section>
  );

  /* ── Typologies ───────────────────────────────────────────── */
  const Typologies = () => (
    <section id="typologies" style={{ padding: "96px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
            fontFamily: bFont,
          }}>{t("landing_typo_eyebrow")}</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.2, fontFamily: hFont,
          }}>
            {t("landing_typo_heading")}
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}>
          {TYPOLOGIES.map((ty) => (
            <a key={ty.id} href={`/customer?tab=typologies&type=${ty.id}`} style={{
              display: "block",
              background: C.white,
              border: `1.5px solid ${C.border}`,
              borderRadius: 16, padding: "28px 24px",
              transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
              cursor: "pointer",
            }}
              onMouseOver={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-5px)";
                el.style.borderColor = ty.color;
                el.style.boxShadow = `0 8px 32px ${ty.color}28`;
              }}
              onMouseOut={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(0)";
                el.style.borderColor = C.border;
                el.style.boxShadow = "none";
              }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 2, background: ty.color, marginBottom: 20 }} />
              <div className="dh-sans" style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", color: ty.color, marginBottom: 8, fontFamily: bFont,
              }}>{ty.badge}</div>
              <h3 className="dh-serif" style={{
                fontSize: 22, fontWeight: 600, color: C.ink,
                marginBottom: 10, lineHeight: 1.2, fontFamily: hFont,
              }}>{ty.label}</h3>
              <p className="dh-sans" style={{
                fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20, fontFamily: bFont,
              }}>{ty.desc}</p>
              <div className="dh-sans" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { k: t("landing_typo_size"), v: ty.size,                           accent: false },
                  { k: t("landing_typo_beds"), v: ty.beds,                           accent: false },
                  { k: t("landing_typo_from"), v: mounted && typologyData[ty.id]?.fromPrice && typologyData[ty.id].fromPrice < Infinity ? fmtPrice(typologyData[ty.id].fromPrice) : "—", accent: true  },
                  { k: t("landing_typo_available"), v: mounted && typologyData[ty.id]?.unitCount != null ? `${typologyData[ty.id].unitCount} ${t("landing_typo_units")}` : "—", accent: false },
                ].map(row => (
                  <div key={row.k} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 12, paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ color: C.muted, fontFamily: bFont }}>{row.k}</span>
                    <span style={{ color: row.accent ? ty.color : C.ink, fontWeight: row.accent ? 700 : 500, fontFamily: row.accent ? hFont : bFont }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, fontSize: 12, color: ty.color, fontWeight: 500, fontFamily: bFont }}>
                {t("landing_typo_view")}
              </div>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <a href="/customer" className="dh-sans" style={{
            display: "inline-block", padding: "13px 32px",
            border: `1.5px solid ${C.hills}`,
            color: C.hills, borderRadius: 10, fontSize: 14, fontWeight: 600,
            transition: "background 0.2s, color 0.2s", fontFamily: bFont,
          }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = C.hills;
              (e.currentTarget as HTMLElement).style.color = C.white;
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = C.hills;
            }}
          >
            {t("landing_typo_cta")}
          </a>
        </div>
      </div>
    </section>
  );

  /* ── Location ─────────────────────────────────────────────── */
  const Location = () => (
    <section id="location" style={{ padding: "96px 24px", background: C.white }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600, fontFamily: bFont,
          }}>{t("landing_loc_eyebrow")}</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.2, fontFamily: hFont,
          }}>{t("landing_loc_heading")}</h2>
        </div>

        <div className="dh-location-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
          <div>
            <p className="dh-sans" style={{
              color: C.muted, fontSize: 15, lineHeight: 1.78, marginBottom: 32, fontWeight: 300, fontFamily: bFont,
            }}>
              {t("landing_loc_text")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {DISTANCES.map((d) => (
                <div key={d.place} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "14px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span className="dh-sans" style={{ color: C.muted, fontSize: 14, fontFamily: bFont }}>{d.place}</span>
                  <span className="dh-sans" style={{
                    color: C.deep, fontSize: 14, fontWeight: 600, fontFamily: bFont,
                    background: C.lightBg, padding: "4px 14px", borderRadius: 20,
                  }}>{d.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: C.bg, border: `1.5px solid ${C.border}`,
            borderRadius: 20, padding: "36px 30px",
            boxShadow: "0 4px 20px rgba(62,122,36,0.07)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: C.lightBg, border: `1.5px solid ${C.hills}44`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>📍</div>
              <div>
                <div className="dh-serif" style={{ color: C.ink, fontSize: 18, fontWeight: 600, fontFamily: hFont }}>
                  {lang === "ar" ? "دده، الكورة" : "Deddeh, Koura"}
                </div>
                <div className="dh-sans" style={{ color: C.muted, fontSize: 13, fontFamily: bFont }}>
                  {lang === "ar" ? "شمال لبنان" : "North Lebanon"}
                </div>
              </div>
            </div>
            {LOC_FEATURES.map((f) => (
              <div key={f.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <span className="dh-sans" style={{ color: C.muted, fontSize: 13, lineHeight: 1.55, fontFamily: bFont }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  /* ── Features ─────────────────────────────────────────────── */
  const Features = () => (
    <section style={{ padding: "96px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600, fontFamily: bFont,
          }}>{t("landing_feat_eyebrow")}</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, fontFamily: hFont,
          }}>{t("landing_feat_heading")}</h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}>
          {FEATURES.map((f) => (
            <div key={f.label} style={{
              padding: "24px 20px",
              background: C.white,
              border: `1.5px solid ${C.border}`,
              borderRadius: 14,
              display: "flex", flexDirection: "column", gap: 8,
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.borderColor = C.hills;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${C.hills}18`;
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.borderColor = C.border;
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <span style={{ fontSize: 24 }}>{f.icon}</span>
              <div className="dh-sans" style={{ color: C.ink, fontWeight: 600, fontSize: 14, fontFamily: bFont }}>{f.label}</div>
              <div className="dh-sans" style={{ color: C.muted, fontSize: 12, lineHeight: 1.55, fontFamily: bFont }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  /* ── Building Standards ───────────────────────────────────── */
  const BuildingSpecs = () => (
    <section style={{ padding: "96px 24px", background: C.white, borderTop: `1px solid ${C.border}` }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
            fontFamily: bFont,
          }}>{t("landing_specs_eyebrow")}</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.2, marginBottom: 16,
            fontFamily: hFont,
          }}>
            {t("landing_specs_heading")}
          </h2>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.72,
            maxWidth: 620, margin: "0 auto", fontWeight: 300,
            fontFamily: bFont,
          }}>
            {t("landing_specs_sub")}
          </p>
        </div>

        {/* Specs grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          gap: 18,
          marginBottom: 40,
        }}>
          {BUILDING_SPECS.map((spec) => (
            <div key={spec.title} style={{
              background: C.bg,
              border: `1.5px solid ${C.border}`,
              borderRadius: 16,
              padding: "26px 22px",
              display: "flex", gap: 18, alignItems: "flex-start",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
              onMouseOver={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = C.hills;
                el.style.boxShadow = `0 4px 20px ${C.hills}16`;
              }}
              onMouseOut={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = C.border;
                el.style.boxShadow = "none";
              }}
            >
              {/* Icon bubble */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: C.white, border: `1.5px solid ${C.hills}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>
                {spec.icon}
              </div>
              {/* Text */}
              <div>
                <div className="dh-sans" style={{
                  color: C.ink, fontWeight: 700, fontSize: 14,
                  marginBottom: 6, fontFamily: bFont,
                }}>
                  {spec.title}
                </div>
                <div className="dh-sans" style={{
                  color: C.muted, fontSize: 13, lineHeight: 1.6,
                  fontFamily: bFont,
                }}>
                  {spec.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="dh-sans" style={{
          textAlign: "center", color: C.muted, fontSize: 12,
          lineHeight: 1.65, fontFamily: bFont,
          borderTop: `1px solid ${C.border}`, paddingTop: 28,
          maxWidth: 700, margin: "0 auto",
        }}>
          {t("landing_specs_note")}
        </p>
      </div>
    </section>
  );

  /* ── CTA banner ───────────────────────────────────────────── */
  const CTABanner = () => (
    <section style={{
      padding: "88px 24px", textAlign: "center",
      background: `linear-gradient(135deg, ${C.deep} 0%, ${C.mid} 55%, ${C.hills} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url('/master-plan.png')",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.06, filter: "saturate(0)",
      }} />
      <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
        <p className="dh-sans" style={{
          color: "rgba(255,255,255,0.72)", fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 16, fontWeight: 500, fontFamily: bFont,
        }}>{t("landing_cta_eyebrow")}</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 600,
          color: C.white, marginBottom: 16, lineHeight: 1.1, fontFamily: hFont,
        }}>{t("landing_cta_heading")}</h2>
        <p className="dh-sans" style={{
          color: "rgba(255,255,255,0.72)", fontSize: 15, marginBottom: 40, lineHeight: 1.68, fontFamily: bFont,
        }}>
          {t("landing_cta_text")}
        </p>
        <a href="/customer" className="dh-sans" style={{
          display: "inline-block", padding: "16px 40px",
          background: C.white, color: C.deep,
          borderRadius: 10, fontSize: 15, fontWeight: 700,
          transition: "opacity 0.2s", fontFamily: bFont,
        }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          {t("landing_cta_btn")}
        </a>
      </div>
    </section>
  );

  /* ── Contact ──────────────────────────────────────────────── */
  const Contact = () => (
    <section id="contact" style={{ padding: "96px 24px", background: C.white }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <p className="dh-sans" style={{
          color: C.hills, fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 14, fontWeight: 600, fontFamily: bFont,
        }}>{t("landing_contact_eyebrow")}</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600,
          color: C.ink, marginBottom: 12, fontFamily: hFont,
        }}>{t("landing_contact_heading")}</h2>
        <p className="dh-sans" style={{
          color: C.muted, fontSize: 14, marginBottom: 40, lineHeight: 1.68, fontFamily: bFont,
        }}>
          {t("landing_contact_sub")}
        </p>
        <div style={{ textAlign: isRTL ? "right" : "left" }}>
          <EnquiryForm />
        </div>
      </div>
    </section>
  );

  /* ── Footer ───────────────────────────────────────────────── */
  const Footer = () => (
    <footer className="dh-sans" style={{
      padding: "32px 32px",
      background: C.darkBg,
      borderTop: `1px solid rgba(149,204,88,0.15)`,
      display: "flex", flexWrap: "wrap", gap: 16,
      justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: C.lightBg, border: `1px solid ${C.hills}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="dh-serif" style={{ color: C.hills, fontSize: 11, fontWeight: 700 }}>DH</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: bFont }}>
          {lang === "ar" ? "ديدح هيلز · الكورة، شمال لبنان" : "Deddeh Hills · Koura, North Lebanon"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 24, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        {[
          { label: t("landing_footer_browse"),   href: "/customer" },
          { label: t("landing_footer_contact"),  href: "#contact"  },
          { label: t("landing_footer_investor"), href: "/investor" },
        ].map(({ label, href }) => (
          <a key={href} href={href} style={{ transition: "color 0.2s", fontFamily: bFont }}
            onMouseOver={e => (e.currentTarget.style.color = C.light)}
            onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          >{label}</a>
        ))}
      </div>

      <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 12, fontFamily: bFont }}>© 2025 Deddeh Hills</span>
    </footer>
  );

  return (
    <div className="dh-sans" dir={isRTL ? "rtl" : "ltr"} style={{ background: C.white, minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <About />
      <Typologies />
      <Location />
      <Features />
      <BuildingSpecs />
      <CTABanner />
      <Contact />
      <Footer />
    </div>
  );
}
