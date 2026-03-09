"use client";

import { useEffect, useRef, useState } from "react";

/* ─── Design tokens ─────────────────────────────────────────── */
const C = {
  ink:    "#0E1409",
  forest: "#1C3A1A",
  gold:   "#A18A44",
  goldBg: "rgba(161,138,68,0.12)",
  cream:  "#F5F0E8",
  muted:  "rgba(245,240,232,0.5)",
  faint:  "rgba(245,240,232,0.12)",
  sand:   "#EDE8DC",
  white:  "#FFFFFF",
};

/* ─── Typology cards data ───────────────────────────────────── */
const TYPOLOGIES = [
  {
    id: "villa_2f",
    label: "Villa (2 Floors)",
    badge: "V2F",
    color: "#34D399",
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
    color: "#A78BFA",
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
    color: "#60A5FA",
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
    color: "#F472B6",
    beds: "2–3 br",
    size: "120–220 m²",
    from: "$280K",
    count: 26,
    desc: "Contemporary apartments and duplex units with shared amenities.",
  },
];

/* ─── Features ──────────────────────────────────────────────── */
const FEATURES = [
  { icon: "🔒", label: "Gated community", sub: "24/7 secured perimeter" },
  { icon: "🛣️", label: "Paved internal roads", sub: "Full infrastructure built" },
  { icon: "⚡", label: "Independent electricity", sub: "On-site generator supply" },
  { icon: "💧", label: "Fresh water supply", sub: "Dedicated water network" },
  { icon: "🌿", label: "Landscaped commons", sub: "Green shared spaces" },
  { icon: "🏔️", label: "Mountain & sea views", sub: "Panoramic hilltop position" },
  { icon: "📋", label: "Flexible payment plans", sub: "Off-plan staged payments" },
  { icon: "🏗️", label: "Off-plan pricing", sub: "Lock in pre-launch rates" },
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
      <div className="text-center py-12">
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <p style={{ color: C.gold, fontWeight: 600, marginBottom: 8 }}>Thank you</p>
        <p style={{ color: C.muted, fontSize: 14 }}>We&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  const field = (key: keyof typeof form, placeholder: string, type = "text", rows?: number) => {
    const shared = {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value })),
      placeholder,
      style: {
        width: "100%", padding: "12px 14px", background: C.faint,
        border: `1px solid rgba(245,240,232,0.15)`, borderRadius: 10,
        color: C.cream, fontSize: 14, fontFamily: "'DM Sans', system-ui, sans-serif",
        outline: "none", boxSizing: "border-box" as const, resize: "none" as const,
        transition: "border-color 0.2s",
      } as React.CSSProperties,
      onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = "rgba(161,138,68,0.5)";
      },
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.currentTarget.style.borderColor = "rgba(245,240,232,0.15)";
      },
    };
    if (rows) return <textarea key={key} rows={rows} {...shared} />;
    return <input key={key} type={type} {...shared} />;
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {field("name", "Full name")}
        {field("email", "Email address", "email")}
      </div>
      {field("phone", "Phone number", "tel")}
      {field("message", "Tell us about your interest (optional)", "text", 3)}
      <button
        type="submit"
        disabled={sending || !form.name || !form.email}
        style={{
          padding: "13px 24px", background: sending || !form.name || !form.email
            ? "rgba(161,138,68,0.3)" : C.gold,
          border: "none", borderRadius: 10, color: sending || !form.name || !form.email
            ? "rgba(245,240,232,0.4)" : C.ink,
          fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', system-ui, sans-serif",
          cursor: sending || !form.name || !form.email ? "not-allowed" : "pointer",
          transition: "all 0.2s", marginTop: 4,
        }}
      >
        {sending ? "Sending…" : "Send Enquiry"}
      </button>
    </form>
  );
}

/* ─── Main landing page ─────────────────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Inject fonts
    const id = "dh-landing-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${C.ink}; color: ${C.cream}; }
        .dh-serif { font-family: 'Playfair Display', Georgia, serif; }
        .dh-sans  { font-family: 'DM Sans', system-ui, sans-serif; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.22s; }
        .fade-up-3 { animation-delay: 0.34s; }
        .fade-up-4 { animation-delay: 0.46s; }
        .fade-up-5 { animation-delay: 0.58s; }
        a { text-decoration: none; color: inherit; }
        ::placeholder { color: rgba(245,240,232,0.35); }
      `;
      document.head.appendChild(el);
    }

    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Nav ───────────────────────────────────────────────────── */
  const Nav = () => (
    <nav
      className="dh-sans"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 24px",
        background: scrolled ? "rgba(14,20,9,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${C.faint}` : "none",
        transition: "all 0.3s",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: 64,
      }}
    >
      {/* Logo */}
      <a href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: "rgba(161,138,68,0.18)", border: `1px solid rgba(161,138,68,0.35)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="dh-serif" style={{ color: C.gold, fontSize: 14, fontWeight: 700 }}>DH</span>
        </div>
        <span className="dh-serif" style={{ color: C.cream, fontSize: 16, fontWeight: 600 }}>
          Deddeh Hills
        </span>
      </a>

      {/* Desktop links */}
      <div className="dh-sans" style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 13 }}>
        <a href="#typologies" style={{ color: C.muted, transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>
          Typologies
        </a>
        <a href="#location" style={{ color: C.muted, transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>
          Location
        </a>
        <a href="#contact" style={{ color: C.muted, transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>
          Contact
        </a>
        <a
          href="/customer"
          style={{
            padding: "8px 18px", background: C.gold, color: C.ink,
            borderRadius: 8, fontWeight: 600, fontSize: 13,
            transition: "opacity 0.2s",
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          Explore Units
        </a>
      </div>
    </nav>
  );

  /* ── Hero ──────────────────────────────────────────────────── */
  const Hero = () => (
    <section style={{
      minHeight: "100dvh", position: "relative",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "120px 24px 80px",
      overflow: "hidden",
    }}>
      {/* Master plan background */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "url('/master-plan.png')",
        backgroundSize: "cover", backgroundPosition: "center 30%",
        opacity: 0.12, filter: "saturate(0)",
      }} />
      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: `linear-gradient(to bottom, ${C.ink} 0%, rgba(14,20,9,0.7) 40%, rgba(14,20,9,0.85) 70%, ${C.ink} 100%)`,
      }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: 720 }}>
        <p className="dh-sans fade-up fade-up-1" style={{
          color: C.gold, fontSize: 11, fontWeight: 500,
          letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 20,
        }}>
          Koura · North Lebanon
        </p>

        <h1 className="dh-serif fade-up fade-up-2" style={{
          fontSize: "clamp(48px, 8vw, 88px)", fontWeight: 600,
          color: C.cream, lineHeight: 1.05, marginBottom: 24,
          letterSpacing: "-0.02em",
        }}>
          Deddeh Hills
        </h1>

        <p className="dh-sans fade-up fade-up-3" style={{
          fontSize: "clamp(15px, 2vw, 18px)", color: C.muted,
          lineHeight: 1.65, maxWidth: 520, margin: "0 auto 40px",
          fontWeight: 300,
        }}>
          A gated hilltop community of 101 private residences overlooking
          the Koura valley — where mountain living meets modern infrastructure.
        </p>

        <div className="fade-up fade-up-4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/customer"
            style={{
              padding: "14px 32px", background: C.gold, color: C.ink,
              borderRadius: 10, fontWeight: 600, fontSize: 15,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: "opacity 0.2s", display: "inline-block",
            }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseOut={e => (e.currentTarget.style.opacity = "1")}
          >
            Browse Available Units →
          </a>
          <a
            href="#contact"
            style={{
              padding: "14px 32px",
              background: "transparent",
              color: C.cream,
              border: `1px solid rgba(245,240,232,0.25)`,
              borderRadius: 10, fontWeight: 400, fontSize: 15,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              transition: "border-color 0.2s, color 0.2s", display: "inline-block",
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = C.gold; e.currentTarget.style.color = C.gold; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "rgba(245,240,232,0.25)"; e.currentTarget.style.color = C.cream; }}
          >
            Enquire
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="fade-up fade-up-5 dh-sans" style={{
        position: "absolute", bottom: 48, left: "50%", transform: "translateX(-50%)",
        zIndex: 2, display: "flex", gap: 0, flexWrap: "wrap", justifyContent: "center",
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${C.faint}`,
        borderRadius: 14, overflow: "hidden",
      }}>
        {[
          { value: "101", label: "Private lots" },
          { value: "4", label: "Typologies" },
          { value: "59", label: "Available now" },
          { value: "Phase 1", label: "Underway" },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: "16px 28px", textAlign: "center",
            borderRight: i < 3 ? `1px solid ${C.faint}` : "none",
          }}>
            <div className="dh-serif" style={{ fontSize: 22, fontWeight: 600, color: C.cream }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2, letterSpacing: "0.06em" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );

  /* ── About ─────────────────────────────────────────────────── */
  const About = () => (
    <section style={{ padding: "96px 24px", background: C.forest, position: "relative" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <p className="dh-sans" style={{
            color: C.gold, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
          }}>About the project</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(30px, 4vw, 44px)", fontWeight: 600,
            color: C.cream, lineHeight: 1.15, marginBottom: 24,
          }}>
            101 private residences on a hilltop estate
          </h2>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.75, marginBottom: 20, fontWeight: 300,
          }}>
            Deddeh Hills is a master-planned gated community set on elevated land in the Koura district
            of North Lebanon. The development spans 101 lots across four residential typologies —
            from contemporary apartments to spacious standalone villas.
          </p>
          <p className="dh-sans" style={{
            color: C.muted, fontSize: 15, lineHeight: 1.75, fontWeight: 300,
          }}>
            Every plot benefits from complete infrastructure — paved roads, electricity, water —
            and a secure perimeter, allowing residents to build and move in with confidence.
          </p>
        </div>
        <div style={{
          borderRadius: 20, overflow: "hidden",
          border: `1px solid rgba(245,240,232,0.1)`,
          aspectRatio: "4/3",
          background: "rgba(245,240,232,0.04)",
          position: "relative",
        }}>
          <img
            src="/master-plan.png"
            alt="Deddeh Hills master plan"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }}
          />
        </div>
      </div>
    </section>
  );

  /* ── Typologies ────────────────────────────────────────────── */
  const Typologies = () => (
    <section id="typologies" style={{ padding: "96px 24px", background: C.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.gold, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
          }}>Residence types</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.cream, lineHeight: 1.2,
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
            <a
              href="/customer"
              key={t.id}
              style={{
                display: "block",
                background: "rgba(255,255,255,0.03)",
                border: `1px solid rgba(255,255,255,0.08)`,
                borderRadius: 16, padding: "28px 24px",
                transition: "transform 0.2s, border-color 0.2s, background 0.2s",
                cursor: "pointer",
              }}
              onMouseOver={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)";
                (e.currentTarget as HTMLElement).style.borderColor = t.color + "60";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.055)";
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
              }}
            >
              {/* Color accent */}
              <div style={{
                width: 40, height: 4, borderRadius: 2,
                background: t.color, marginBottom: 20,
              }} />
              <div className="dh-sans" style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.14em",
                textTransform: "uppercase", color: t.color, marginBottom: 8,
              }}>{t.badge}</div>
              <h3 className="dh-serif" style={{
                fontSize: 22, fontWeight: 600, color: C.cream,
                marginBottom: 12, lineHeight: 1.2,
              }}>{t.label}</h3>
              <p className="dh-sans" style={{
                fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 20,
              }}>{t.desc}</p>
              <div className="dh-sans" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Size</span>
                  <span style={{ color: C.cream, fontWeight: 500 }}>{t.size}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Bedrooms</span>
                  <span style={{ color: C.cream, fontWeight: 500 }}>{t.beds}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Starting from</span>
                  <span style={{ color: C.gold, fontWeight: 600, fontFamily: "'Playfair Display', serif" }}>{t.from}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>Available</span>
                  <span style={{ color: C.cream, fontWeight: 500 }}>{t.count} units</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 44 }}>
          <a
            href="/customer"
            className="dh-sans"
            style={{
              display: "inline-block", padding: "13px 32px",
              border: `1px solid rgba(161,138,68,0.4)`,
              color: C.gold, borderRadius: 10, fontSize: 14, fontWeight: 500,
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLElement).style.background = C.goldBg;
              (e.currentTarget as HTMLElement).style.borderColor = C.gold;
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "rgba(161,138,68,0.4)";
            }}
          >
            Explore all units on the master plan →
          </a>
        </div>
      </div>
    </section>
  );

  /* ── Location ──────────────────────────────────────────────── */
  const Location = () => (
    <section id="location" style={{ padding: "96px 24px", background: C.forest }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.gold, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
          }}>Where we are</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.cream, lineHeight: 1.2,
          }}>
            Koura, North Lebanon
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }}>
          <div>
            <p className="dh-sans" style={{
              color: C.muted, fontSize: 15, lineHeight: 1.75, marginBottom: 32, fontWeight: 300,
            }}>
              Situated on elevated terrain in the Koura district, Deddeh Hills commands
              sweeping views of the surrounding valley and the distant Mediterranean.
              The area is known for its olive groves, mild climate, and proximity to
              both Tripoli and the Beirut–Tripoli highway.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { place: "Tripoli city centre", time: "25 min" },
                { place: "Beirut", time: "75 min" },
                { place: "Chekka interchange", time: "12 min" },
                { place: "Batroun", time: "20 min" },
              ].map((d) => (
                <div key={d.place} style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", paddingBottom: 16,
                  borderBottom: `1px solid rgba(245,240,232,0.08)`,
                }}>
                  <span className="dh-sans" style={{ color: C.muted, fontSize: 14 }}>{d.place}</span>
                  <span className="dh-sans" style={{
                    color: C.cream, fontSize: 14, fontWeight: 600,
                    background: "rgba(245,240,232,0.06)",
                    padding: "4px 12px", borderRadius: 20,
                  }}>{d.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stylised location card */}
          <div style={{
            background: "rgba(245,240,232,0.04)",
            border: `1px solid rgba(245,240,232,0.1)`,
            borderRadius: 20, padding: "40px 32px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10,
                background: C.goldBg, border: `1px solid rgba(161,138,68,0.3)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20,
              }}>📍</div>
              <div>
                <div className="dh-serif" style={{ color: C.cream, fontSize: 18, fontWeight: 600 }}>Deddeh, Koura</div>
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
              <div key={f.text} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <span className="dh-sans" style={{ color: C.muted, fontSize: 13, lineHeight: 1.5 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  /* ── Features ──────────────────────────────────────────────── */
  const Features = () => (
    <section style={{ padding: "96px 24px", background: C.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p className="dh-sans" style={{
            color: C.gold, fontSize: 11, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
          }}>What&apos;s included</p>
          <h2 className="dh-serif" style={{
            fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600,
            color: C.cream,
          }}>Community & investment features</h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}>
          {FEATURES.map((f) => (
            <div key={f.label} style={{
              padding: "24px 20px",
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${C.faint}`,
              borderRadius: 14,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <span style={{ fontSize: 24 }}>{f.icon}</span>
              <div className="dh-sans" style={{ color: C.cream, fontWeight: 600, fontSize: 14 }}>{f.label}</div>
              <div className="dh-sans" style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>{f.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  /* ── CTA banner ────────────────────────────────────────────── */
  const CTABanner = () => (
    <section style={{
      padding: "80px 24px",
      background: C.forest,
      textAlign: "center",
    }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <p className="dh-sans" style={{
          color: C.gold, fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
        }}>Limited availability</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(30px, 4vw, 48px)", fontWeight: 600,
          color: C.cream, marginBottom: 16, lineHeight: 1.15,
        }}>59 units available now</h2>
        <p className="dh-sans" style={{
          color: C.muted, fontSize: 15, marginBottom: 36, lineHeight: 1.65,
        }}>
          Browse the interactive master plan to explore available lots,
          view unit specs, and compare payment plans.
        </p>
        <a
          href="/customer"
          className="dh-sans"
          style={{
            display: "inline-block", padding: "15px 36px",
            background: C.gold, color: C.ink, borderRadius: 10,
            fontSize: 15, fontWeight: 600, transition: "opacity 0.2s",
          }}
          onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={e => (e.currentTarget.style.opacity = "1")}
        >
          Explore the master plan →
        </a>
      </div>
    </section>
  );

  /* ── Contact ───────────────────────────────────────────────── */
  const Contact = () => (
    <section id="contact" style={{ padding: "96px 24px", background: C.ink }}>
      <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
        <p className="dh-sans" style={{
          color: C.gold, fontSize: 11, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: 16, fontWeight: 500,
        }}>Get in touch</p>
        <h2 className="dh-serif" style={{
          fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600,
          color: C.cream, marginBottom: 12,
        }}>Enquire about a unit</h2>
        <p className="dh-sans" style={{
          color: C.muted, fontSize: 14, marginBottom: 40, lineHeight: 1.65,
        }}>
          Our team is available to answer your questions and arrange a site visit.
        </p>
        <div style={{ textAlign: "left" }}>
          <EnquiryForm />
        </div>
      </div>
    </section>
  );

  /* ── Footer ────────────────────────────────────────────────── */
  const Footer = () => (
    <footer className="dh-sans" style={{
      padding: "32px 24px",
      background: "#080D06",
      borderTop: `1px solid ${C.faint}`,
      display: "flex", flexWrap: "wrap", gap: 16,
      justifyContent: "space-between", alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: C.goldBg, border: `1px solid rgba(161,138,68,0.3)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span className="dh-serif" style={{ color: C.gold, fontSize: 11, fontWeight: 700 }}>DH</span>
        </div>
        <span style={{ color: C.muted, fontSize: 13 }}>Deddeh Hills · Koura, North Lebanon</span>
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 12, color: C.muted }}>
        <a href="/customer" style={{ transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>Browse Units</a>
        <a href="#contact" style={{ transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>Contact</a>
        <a href="/investor" style={{ transition: "color 0.2s" }}
          onMouseOver={e => (e.currentTarget.style.color = C.cream)}
          onMouseOut={e => (e.currentTarget.style.color = C.muted)}>Investor Access</a>
      </div>
      <span style={{ color: "rgba(245,240,232,0.2)", fontSize: 12 }}>© 2025 Deddeh Hills</span>
    </footer>
  );

  return (
    <div className="dh-sans" style={{ background: C.ink, minHeight: "100vh" }}>
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
