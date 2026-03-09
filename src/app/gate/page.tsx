"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Inject fonts client-side to avoid SSR hydration issues
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
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.15s; }
        .fade-up-3 { animation-delay: 0.25s; }
        .fade-up-4 { animation-delay: 0.35s; }
      `;
      document.head.appendChild(el);
    }
    // Focus the input once the fonts load
    setTimeout(() => inputRef.current?.focus(), 400);
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
        const from = searchParams.get("from") || "/";
        router.replace(from);
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
        background: "#12180F",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle background texture */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(161,138,68,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 50% 100%, rgba(161,138,68,0.05) 0%, transparent 60%)
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
        {/* Monogram */}
        <div
          className="fade-up fade-up-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 52,
            height: 52,
            borderRadius: 12,
            background: "rgba(161,138,68,0.15)",
            border: "1px solid rgba(161,138,68,0.3)",
            marginBottom: 28,
          }}
        >
          <span
            className="dh-serif"
            style={{
              color: "#A18A44",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            DH
          </span>
        </div>

        {/* Eyebrow */}
        <p
          className="dh-sans fade-up fade-up-1"
          style={{
            color: "#A18A44",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Private Preview
        </p>

        {/* Title */}
        <h1
          className="dh-serif fade-up fade-up-2"
          style={{
            color: "#F5F0E8",
            fontSize: 36,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
            marginBottom: 12,
          }}
        >
          Deddeh Hills
        </h1>

        {/* Subtitle */}
        <p
          className="dh-sans fade-up fade-up-2"
          style={{
            color: "rgba(245,240,232,0.45)",
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.6,
            marginBottom: 40,
          }}
        >
          Enter your access code to continue.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`fade-up fade-up-3 ${shake ? "shake" : ""}`}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <input
            ref={inputRef}
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
              background: "rgba(245,240,232,0.05)",
              border: error
                ? "1px solid rgba(239,68,68,0.6)"
                : "1px solid rgba(245,240,232,0.12)",
              borderRadius: 10,
              color: "#F5F0E8",
              fontSize: 15,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              letterSpacing: "0.08em",
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
              textAlign: "center",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(161,138,68,0.6)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = error
                ? "rgba(239,68,68,0.6)"
                : "rgba(245,240,232,0.12)";
            }}
          />

          {/* Error message */}
          {error && (
            <p
              style={{
                color: "rgba(239,68,68,0.9)",
                fontSize: 13,
                margin: "0 0 4px",
                lineHeight: 1.4,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: "100%",
              padding: "13px 16px",
              background: loading || !code.trim()
                ? "rgba(161,138,68,0.25)"
                : "rgba(161,138,68,0.9)",
              border: "none",
              borderRadius: 10,
              color: loading || !code.trim() ? "rgba(245,240,232,0.4)" : "#12180F",
              fontSize: 14,
              fontWeight: 600,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              letterSpacing: "0.06em",
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Verifying…" : "Enter"}
          </button>
        </form>

        {/* Footer */}
        <p
          className="dh-sans fade-up fade-up-4"
          style={{
            color: "rgba(245,240,232,0.2)",
            fontSize: 12,
            marginTop: 40,
            letterSpacing: "0.02em",
          }}
        >
          Koura, North Lebanon
        </p>
      </div>
    </div>
  );
}
