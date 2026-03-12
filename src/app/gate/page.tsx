"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/* ─── Brand tokens (matches customer/investor pages) ─────────────────────── */
const C = {
  bg:      "#F4F9EF",                   // barely-green white
  bgCard:  "#FFFFFF",                   // card surface
  ink:     "#1C2010",                   // deep dark ink
  forest:  "#3D7A24",                   // primary CTA green
  brand:   "#78BF42",                   // accent brand green
  brandBg: "rgba(120,191,66,0.12)",     // light green badge bg
  brandBd: "rgba(61,122,36,0.25)",      // green badge border
  border:  "#C8E0B5",                   // green-tinted border
  muted:   "#6A7B5F",                   // secondary text
  error:   "#dc2626",                   // red error
} as const;

/* ─── Isolated form (useSearchParams inside Suspense) ────────────────────── */
function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const id = "dh-gate-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap');
        .dh-serif { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; }
        .dh-sans  { font-family: 'DM Sans', system-ui, sans-serif; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-6px); }
          30%       { transform: translateX(6px); }
          45%       { transform: translateX(-4px); }
          60%       { transform: translateX(4px); }
          75%       { transform: translateX(-2px); }
          90%       { transform: translateX(2px); }
        }
        .shake { animation: shake 0.45s ease; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up   { animation: fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.12s; }
        .fade-up-3 { animation-delay: 0.20s; }
        .fade-up-4 { animation-delay: 0.28s; }
        .dh-input:focus {
          outline: none;
          border-color: #3D7A24 !important;
          box-shadow: 0 0 0 3px rgba(120,191,66,0.18);
        }
        .dh-btn:hover:not(:disabled) {
          background: #2d5e1b !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(61,122,36,0.28);
        }
        .dh-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .dh-btn { transition: all 0.18s ease; }
      `;
      document.head.appendChild(el);
    }
    setTimeout(() => inputRef.current?.focus(), 350);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        const data = await res.json() as { success: boolean; role?: string };
        const from = searchParams.get("from");
        // Route each role to their natural home when no explicit ?from= is set
        const roleHome =
          data.role === "admin" ? "/simulator" :
          data.role === "investor" ? "/investor" :
          "/customer";
        router.replace(from || roleHome);
        router.refresh();
      } else {
        setError("Incorrect access code. Please try again.");
        setCode("");
        setShake(true);
        setTimeout(() => {
          setShake(false);
          inputRef.current?.focus();
        }, 500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="dh-sans"
      style={{
        minHeight: "100dvh",
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative green radial bloom */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 70% 55% at 50% -5%, rgba(120,191,66,0.14) 0%, transparent 65%),
            radial-gradient(ellipse 50% 35% at 80% 100%, rgba(61,122,36,0.07) 0%, transparent 60%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          position: "relative",
          zIndex: 1,
          textAlign: "center",
        }}
      >
        {/* DH monogram badge */}
        <div
          className="fade-up fade-up-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 54,
            height: 54,
            borderRadius: 14,
            background: C.brandBg,
            border: `1.5px solid ${C.brandBd}`,
            marginBottom: 24,
            boxShadow: "0 2px 12px rgba(61,122,36,0.10)",
          }}
        >
          <span
            className="dh-serif"
            style={{ color: C.forest, fontSize: 22, fontWeight: 700, letterSpacing: "0.02em", lineHeight: 1 }}
          >
            DH
          </span>
        </div>

        {/* Eyebrow */}
        <p
          className="dh-sans fade-up fade-up-1"
          style={{
            color: C.forest,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Private Preview
        </p>

        {/* Title */}
        <h1
          className="dh-serif fade-up fade-up-2"
          style={{
            color: C.ink,
            fontSize: 38,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.12,
            marginBottom: 10,
          }}
        >
          Deddeh Hills
        </h1>

        {/* Subtitle */}
        <p
          className="dh-sans fade-up fade-up-2"
          style={{
            color: C.muted,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.6,
            marginBottom: 36,
          }}
        >
          Enter your access code to continue.
        </p>

        {/* Divider */}
        <div
          className="fade-up fade-up-2"
          style={{
            width: 40,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${C.brand}, transparent)`,
            margin: "-20px auto 32px",
            borderRadius: 2,
          }}
        />

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`fade-up fade-up-3${shake ? " shake" : ""}`}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            ref={inputRef}
            className="dh-sans dh-input"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(""); }}
            placeholder="Access code"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 16px",
              background: C.bgCard,
              border: `1.5px solid ${error ? C.error : C.border}`,
              borderRadius: 10,
              color: C.ink,
              fontSize: 15,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              letterSpacing: "0.07em",
              boxSizing: "border-box",
              textAlign: "center",
              transition: "border-color 0.2s",
            }}
          />

          {error && (
            <p style={{ color: C.error, fontSize: 13, margin: "2px 0 2px", lineHeight: 1.4 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="dh-btn"
            disabled={loading || !code.trim()}
            style={{
              width: "100%",
              padding: "13px 16px",
              background: loading || !code.trim()
                ? `rgba(61,122,36,0.22)`
                : C.forest,
              border: "none",
              borderRadius: 10,
              color: loading || !code.trim() ? `rgba(61,122,36,0.45)` : "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              letterSpacing: "0.06em",
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>

        {/* Footer */}
        <p
          className="dh-sans fade-up fade-up-4"
          style={{
            color: C.muted,
            fontSize: 11.5,
            marginTop: 36,
            letterSpacing: "0.04em",
            opacity: 0.6,
          }}
        >
          Koura, North Lebanon
        </p>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateForm />
    </Suspense>
  );
}
