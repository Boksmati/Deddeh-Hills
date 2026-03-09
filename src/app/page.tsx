"use client";

import { useEffect, useState } from "react";

/* ─── Design tokens — extracted from Deddeh Hills logo ──────── */
const C = {
  // Page surfaces
  bg:       "#F4F9EF",   // barely-green white — main light background
  bgAlt:    "#EAF4E1",   // richer tint for alternating sections
  white:    "#FFFFFF",

  // Dark hero / footer
  darkBg:   "#1A3810",   // deep forest green (echoes dark swoosh arc)
  darkAlt:  "#213F15",

  // Logo greens
  hills:    "#78BF42",   // "HILLS" text — primary brand CTA
  hillsHov: "#67AA34",   // hover state
  deep:     "#3D7A24",   // dark swoosh — headlines, depth
  mid:      "#62AE35",   // middle swoosh
  light:    "#95CC58",   // lightest swoosh arc
  lightBg:  "rgba(120,191,66,0.10)",

  // Text
  ink:      "#373737",   // charcoal — matches "DEDDEH" gray
  muted:    "#6A7B5F",   // greenish-gray secondary text
  mutedDark:"rgba(255,255,255,0.58)",   // secondary text on dark bg

  // Borders
  border:   "#C8E0B5",
  faint:    "rgba(62,122,36,0.13)",
  faintDark:"rgba(255,255,255,0.10)",
};

/* ─── Typology card data — greens only ──────────────────────── */
const TYPOLOGIES = [
  {
    id: "villa_2f",
    label: "Villa (2 Floors)",
    badge: "V2F",
    color: C.mid,
    colorBg: "rgba(98,174,53,0.10)",
    beds: "4–5 br",
    size: "250–350 m²",
    from: "$750K",
    count: 28,
    desc: "Standalone two-floor villa with private garden and underground parking.",
  },
  {
    id: "villa_3f",
    label: "Villa (3 Floors)",
    badge: "V3F",
    color: C.deep,
    colorBg: "rgba(61,122,36,0.10)",
    beds: "5–6 br",
    size: "400–600 m²",
    from: "$1.1M",
    count: 12,
    desc: "Spacious three-floor villa — ideal for extended families with panoramic views.",
  },
  {
    id: "twin_villa",
    label: "Twin Villa",
    badge: "TWIN",
    color: C.hills,
    colorBg: "rgba(120,191,66,0.10)",
    beds: "3–4 br",
    size: "200–280 m²",
    from: "$550K",
    count: 35,
    desc: "Semi-detached paired villa offering community living with private outdoor space.",
  },
  {
    id: "apartments",
    label: "Apartments & Duplexes",
    badge: "APT",
    color: "#5AAE28",
    colorBg: "rgba(90,174,40,0.10)",
    beds: "2–3 br",
    size: "120–220 m²",
    from: "$280K",
    count: 26,
    desc: "Contemporary apartments and duplex units with shared amenities.",
  },
];

/* ─── Features ──────────────────────────────────────────────── */
const FEATURES = [
  { icon: "🔒", label: "Gated community",       sub: "24/7 secured perimeter" },
  { icon: "🛣️", label: "Paved internal roads",  sub: "Full infrastructure built" },
  { icon: "⚡", label: "Independent electricity",sub: "On-site generator supply" },
  { icon: "💧", label: "Fresh water supply",     sub: "Dedicated water network" },
  { icon: "🌿", label: "Landscaped commons",     sub: "Green shared spaces" },
  { icon: "🏔️", label: "Mountain & sea views",   sub: "Panoramic hilltop position" },
  { icon: "📋", label: "Flexible payment plans", sub: "Off-plan staged payments" },
  { icon: "🏗️", label: "Off-plan pricing",       sub: "Lock in pre-launch rates" },
];

/* ─── Enquiry form ───────────────────────────────────────────── */
function EnquiryForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    setSent(true);
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
        <p style={{ color: C.deep, fontWeight: 600, marginBottom: 8, fontSize: 16 }}>Thank you</p>
        <p style={{ color: C.muted, fontSize: 14 }}>We&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px",
    background: C.white, border: `1.5px solid ${C.border}`,
    borderRadius: 10, color: C.ink, fontSize: 14,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    outline: "none", boxSizing: "border-box", resize: "none",
    transition: "border-color 0.2s",
  };

  const field = (key: keyof typeof form, placeholder: string, type = "text", rows?: number) => {
    const shared = {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value })),
      placeholder,
      style: inputStyle,
      onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = C.hills;
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = C.border;
      },
    };
    if (rows) return <textarea key={key} rows={rows} {...shared} />;
    return <input key={key} type={type} {...shared} />;
  };

  const canSubmit = !sending && !!form.name && !!form.email;
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {field("name", "Full name")}
        {field("email", "Email address", "email")}
      </div>
      {field("phone", "Phone number (optional)", "tel")}
      {field("message", "Tell us about your interest (optional)", "text", 3)}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          padding: "13px 24px",
          background: canSubmit ? C.hills : C.lightBg,
          border: "none", borderRadius: 10,
          color: canSubmit ? C.white : C.muted,
          fontSize: 14, fontWeight: 600,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "all 0.2s", marginTop: 4,
        }}
        onMouseOver={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = C.hillsHov; }}
        onMouseOut={e => { if (canSubmit) (e.currentTarget as HTMLButtonElement).style.background = C.hills; }}
      >
        {sending ? "Sending…" : "Send Enquiry"}
      </button>
    </form>
  );
}

/* ─── Main landing page ─────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const id = "dh-landing-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .dh-serif { font-family: 'Playfair Display', Georgia, serif; }
        .dh-sans  { font-family: 'DM Sans', system-ui, sans-serif; }
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
      `;
      document.head.appendChild(el);
    }

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Nav ─────────────────────────────────────────────────────── */
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

      {/* Desktop links */}
      <div style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13 }}>
        {[
          { label: "Typologies", href: "#typologies" },
          { label: "Location",   href: "#location"   },
          { label: "Contact",    href: "#contact"     },
        ].map(({ label, href }) => (
          <a key={href} href={href}
            style={{ color: scrolled ? C.muted : "rgba(255,255,255,0.75)", transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = scrolled ? C.deep : C.white)}
            onMouseOut={e => (e.currentTarget.style.color = scrolled ? C.muted : "rgba(255,255,255,0.75)")}
          >{label}</a>
        ))}
        <a
          href="/customer"
          style={{
            padding: "8px 20px", background: C.hills, color: C.white,
            borderRadius: 8, fontWeight: 600, fontSize: 13,
            transition: "background 0.2s",
          }}
          onMouseOver={e => (e.currentTarget.style.background = C.hillsHov)}
          onMouseOut={e => (e.currentTarget.style.background = C.hills)}
        >
          Explore Units
        </a>
      </div>
    </nav>
  );

  /* ── Hero — deep forest green, not black ───────────────────── */
  const Hero = () => (
    <section style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "120px 24px 80px", overflow: "hidden",
    }}>
      {/* Master plan background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/master-plan.png')",
        backgroundSize: "cover", backgroundPosition: "center 30%",
        opacity: 0.15, filter: "saturate(0.4) hue-rotate(40deg)",
      }} />
      {/* Gradient — deep forest green (echoes dark swoosh arc) */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: `linear-gradient(160deg, ${C.darkBg} 0%, #1E4710 35%, #163310 65%, ${C.darkBg} 100%)`,
      }} />
      {/* Subtle vignette */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(10,22,6,0.55) 100%)",
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 3, textAlign: "center", maxWidth: 760 }}>
        <p className="dh-sans fade-up fade-up-1" style={{
          color: C.light, fontSize: 11, fontWeight: 500,
          letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 20,
        }}>
          Koura · North Lebanon
        </p>

        <h1 className="dh-serif fade-up fade-up-2" style={{
          fontSize: "clamp(52px, 8.5vw, 96px)", fontWeight: 600,
          color: C.white, lineHeight: 1.0, marginBottom: 24,
          letterSpacing: "-0.02em",
        }}>
          Deddeh Hills
        </h1>

        <p className="dh-sans fade-up fade-up-3" style={{
          fontSize: "clamp(15px, 2vw, 18px)", color: C.mutedDark,
          lineHeight: 1.68, maxWidth: 520, margin: "0 auto 44px", fontWeight: 300,
        }}>
          A gated hilltop community of 101 private residences overlooking
          the Koura valley — where mountain living meets modern infrastructure.
        </p>

        <div className="fade-up fade-up-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/customer" style={{
            padding: "15px 34px", background: C.hills, color: C.white,
            borderRadius: 10, fontWeight: 600, fontSize: 15,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: "background 0.2s", display: "inline-block",
          }}
            onMouseOver={e => (e.currentTarget.style.background = C.hillsHov)}
            onMouseOut={e => (e.currentTarget.style.background = C.hills)}
          >
            Browse Available Units →
          </a>
          <a href="#contact" style={{
            padding: "15px 34px", background: "transparent",
            color: C.white, border: `1.5px solid rgba(255,255,255,0.28)`,
            borderRadius: 10, fontWeight: 400, fontSize: 15,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            transition: "border-color 0.2s", display: "inline-block",
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.light; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.28)"; }}
          >
            Enquire
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="fade-up fade-up-5 dh-sans" style={{
        position: "absolute", bottom: 52, left: "50%", transform: "translateX(-50%)",
        zIndex: 3, display: "flex", flexWrap: "wrap", justifyContent: "center",
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(16px)",
        border: `1px solid rgba(149,204,88,0.22)`,
        borderRadius: 14, overflow: "hidden",
      }}>
        {[
          { value: "101",     label: "Private lots"  },
          { value: "4",       label: "Typologies"    },
          { value: "59",      label: "Available now" },
          { value: "Phase 1", label: "Underway"      },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: "16px 30px", textAlign: "center",
            borderRight: i < 3 ? "1px solid rgba(149,204,88,0.18)" : "none",
          }}>
            <div className="dh-serif" style={{ fontSize: 22, fontWeight: 600, color: C.white }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.light, marginTop: 3, letterSpacing: "0.07em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );

  /* ── About — light ─────────────────────────────────────────── */
  const About = () => (
    <section style={{ padding: "96px 24px", background: C.white }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 72, alignItems: "center",
      }}>
        <div>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 600,
          }}>About the project</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.15, marginBottom: 24,
          }}>
            101 private residences on a hilltop estate
          </h2>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.78, marginBottom: 20, fontWeight: 300,
          }}>
            Deddeh Hills is a master-planned gated community set on elevated land in the Koura district
            of North Lebanon. The development spans 101 lots across four residential typologies —
            from contemporary apartments to spacious standalone villas.
          </p>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.78, fontWeight: 300,
          }}>
            Every plot benefits from complete infrastructure — paved roads, electricity, water —
            and a secure perimeter, allowing residents to build and move in with confidence.
          </p>

          {/* Mini-stats row */}
          <div style={{
            display: "flex", gap: 28, marginTop: 36,
            paddingTop: 32, borderTop: `1px solid ${C.border}`,
          }}>
            {[
              { val: "101", lbl: "Lots" },
              { val: "4",   lbl: "Typologies" },
              { val: "3",   lbl: "Phases" },
            ].map(s => (
              <div key={s.lbl}>
                <div className="dh-serif" style={{ fontSize: 28, fontWeight: 700, color: C.deep }}>{s.val}</div>
                <div className="dh-sans" style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.lbl}</div>
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
            position: "absolute", bottom: 16, left: 16,
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(8px)",
            borderRadius: 10, padding: "8px 14px",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.hills }} />
            <span className="dh-sans" style={{ fontSize: 12, color: C.ink, fontWeight: 500 }}>Master plan · Koura</span>
          </div>
        </div>
      </div>
    </section>
  );

  /* ── Typologies ─────────────────────────────────────────────── */
  const Typologies = () => (
    <section id="typologies" style={{ padding: "96px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
          }}>Residence types</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.2,
          }}>
            Choose your residence
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}>
          {TYPOLOGIES.map((t) => (
            <a key={t.id} href="/customer" style={{
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
                el.style.borderColor = t.color;
                el.style.boxShadow = `0 8px 32px ${t.color}28`;
              }}
              onMouseOut={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(0)";
                el.style.borderColor = C.border;
                el.style.boxShadow = "none";
              }}
            >
              {/* Color bar */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: t.color, marginBottom: 20 }} />

              <div className="dh-sans" style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
                textTransform: "uppercase", color: t.color, marginBottom: 8,
              }}>{t.badge}</div>

              <h3 className="dh-serif" style={{
                fontSize: 22, fontWeight: 600, color: C.ink,
                marginBottom: 10, lineHeight: 1.2,
              }}>{t.label}</h3>

              <p className="dh-sans" style={{
                fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20,
              }}>{t.desc}</p>

              <div className="dh-sans" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { k: "Size",          v: t.size,          accent: false },
                  { k: "Bedrooms",      v: t.beds,          accent: false },
                  { k: "Starting from", v: t.from,          accent: true  },
                  { k: "Available",     v: `${t.count} units`, accent: false },
                ].map(row => (
                  <div key={row.k} style={{
                    display: "flex", justifyContent: "space-between",
                    fontSize: 12, paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}>
                    <span style={{ color: C.muted }}>{row.k}</span>
                    <span style={{ color: row.accent ? t.color : C.ink, fontWeight: row.accent ? 700 : 500, fontFamily: row.accent ? "'Playfair Display', serif" : "inherit" }}>
                      {row.v}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, fontSize: 12, color: t.color, fontWeight: 500 }}>
                View units →
              </div>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 48 }}>
          <a href="/customer" className="dh-sans" style={{
            display: "inline-block", padding: "13px 32px",
            border: `1.5px solid ${C.hills}`,
            color: C.hills, borderRadius: 10, fontSize: 14, fontWeight: 600,
            transition: "background 0.2s, color 0.2s",
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
            Explore all units on the master plan →
          </a>
        </div>
      </div>
    </section>
  );

  /* ── Location ───────────────────────────────────────────────── */
  const Location = () => (
    <section id="location" style={{ padding: "96px 24px", background: C.white }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
          }}>Where we are</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink, lineHeight: 1.2,
          }}>Koura, North Lebanon</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
          <div>
            <p className="dh-sans" style={{
              color: C.muted, fontSize: 15, lineHeight: 1.78, marginBottom: 32, fontWeight: 300,
            }}>
              Situated on elevated terrain in the Koura district, Deddeh Hills commands
              sweeping views of the surrounding valley and the distant Mediterranean.
              The area is known for its olive groves, mild climate, and proximity to
              both Tripoli and the Beirut–Tripoli highway.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { place: "Tripoli city centre",  time: "25 min" },
                { place: "Beirut",               time: "75 min" },
                { place: "Chekka interchange",   time: "12 min" },
                { place: "Batroun",              time: "20 min" },
              ].map((d) => (
                <div key={d.place} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", padding: "14px 0",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <span className="dh-sans" style={{ color: C.muted, fontSize: 14 }}>{d.place}</span>
                  <span className="dh-sans" style={{
                    color: C.deep, fontSize: 14, fontWeight: 600,
                    background: C.lightBg, padding: "4px 14px", borderRadius: 20,
                  }}>{d.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Location feature card */}
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
                <div className="dh-serif" style={{ color: C.ink, fontSize: 18, fontWeight: 600 }}>Deddeh, Koura</div>
                <div className="dh-sans" style={{ color: C.muted, fontSize: 13 }}>North Lebanon</div>
              </div>
            </div>

            {[
              { icon: "🏔️", text: "Hilltop elevation with valley and sea views" },
              { icon: "🛤️", text: "Direct access from the Koura main road" },
              { icon: "🌳", text: "Surrounded by olive groves and pine trees" },
              { icon: "☀️", text: "Mediterranean climate — warm, dry summers" },
              { icon: "🔇", text: "Quiet residential area, away from urban density" },
            ].map((f) => (
              <div key={f.text} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <span className="dh-sans" style={{ color: C.muted, fontSize: 13, lineHeight: 1.55 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  /* ── Features ───────────────────────────────────────────────── */
  const Features = () => (
    <section style={{ padding: "96px 24px", background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.hills, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
          }}>What&apos;s included</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.ink,
          }}>Community &amp; investment features</h2>
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
              <div className="dh-sans" style={{ color: C.ink, fontWeight: 600, fontSize: 14 }}>{f.label}</div>
              <div className="dh-sans" style={{ color: C.muted, fontSize: 12, lineHeight: 1.55 }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  /* ── CTA banner — rich brand green ─────────────────────────── */
  const CTABanner = () => (
    <section style={{
      padding: "88px 24px", textAlign: "center",
      background: `linear-gradient(135deg, ${C.deep} 0%, ${C.mid} 55%, ${C.hills} 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle pattern overlay */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url('/master-plan.png')",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: 0.06, filter: "saturate(0)",
      }} />
      <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
        <p className="dh-sans" style={{
          color: "rgba(255,255,255,0.72)", fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
        }}>Limited availability</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(30px, 4vw, 52px)", fontWeight: 600,
          color: C.white, marginBottom: 16, lineHeight: 1.1,
        }}>59 units available now</h2>
        <p className="dh-sans" style={{
          color: "rgba(255,255,255,0.72)", fontSize: 15, marginBottom: 40, lineHeight: 1.68,
        }}>
          Browse the interactive master plan to explore available lots,
          view unit specs, and compare payment plans.
        </p>
        <a href="/customer" className="dh-sans" style={{
          display: "inline-block", padding: "16px 40px",
          background: C.white, color: C.deep,
          borderRadius: 10, fontSize: 15, fontWeight: 700,
          transition: "opacity 0.2s",
        }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          Explore the master plan →
        </a>
      </div>
    </section>
  );

  /* ── Contact ────────────────────────────────────────────────── */
  const Contact = () => (
    <section id="contact" style={{ padding: "96px 24px", background: C.white }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <p className="dh-sans" style={{
          color: C.hills, fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 14, fontWeight: 600,
        }}>Get in touch</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600,
          color: C.ink, marginBottom: 12,
        }}>Enquire about a unit</h2>
        <p className="dh-sans" style={{
          color: C.muted, fontSize: 14, marginBottom: 40, lineHeight: 1.68,
        }}>
          Our team is available to answer your questions and arrange a site visit.
        </p>
        <div style={{ textAlign: "left" }}>
          <EnquiryForm />
        </div>
      </div>
    </section>
  );

  /* ── Footer ─────────────────────────────────────────────────── */
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
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          Deddeh Hills · Koura, North Lebanon
        </span>
      </div>

      <div style={{ display: "flex", gap: 24, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        {[
          { label: "Browse Units",    href: "/customer"  },
          { label: "Contact",         href: "#contact"   },
          { label: "Investor Access", href: "/investor"  },
        ].map(({ label, href }) => (
          <a key={href} href={href} style={{ transition: "color 0.2s" }}
            onMouseOver={e => (e.currentTarget.style.color = C.light)}
            onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          >{label}</a>
        ))}
      </div>

      <span style={{ color: "rgba(255,255,255,0.22)", fontSize: 12 }}>© 2025 Deddeh Hills</span>
    </footer>
  );

  return (
    <div className="dh-sans" style={{ background: C.white, minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <About />
      <Typologies />
      <Location />
      <Features />
      <CTABanner />
      <Contact />
      <Footer />
    </div>
  );
}
