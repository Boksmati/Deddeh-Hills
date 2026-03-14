"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forName = searchParams.get("for") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [confirmedName, setConfirmedName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    // Call the API — it validates and sets cookies in the response headers.
    // We then navigate client-side so the cookies are sent with the next request.
    // (A server-side redirect causes a cross-origin hostname mismatch on some
    //  dev setups, breaking fetch() CORS; returning JSON avoids that.)
    fetch(`/api/invite?token=${token}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.destination) {
          // Store invite context for analytics attribution
          try {
            sessionStorage.setItem("dh_invite_token", d.token as string ?? token);
            sessionStorage.setItem("dh_invite_label", d.label as string ?? "");
          } catch {}
          if (d.label) setConfirmedName(d.label as string);
          setStatus("success");
          setTimeout(() => router.replace(d.destination as string), 800);
        } else {
          setErrorMsg(d.error ?? "Invalid or expired link.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("Something went wrong. Please try again.");
        setStatus("error");
      });
  }, [token, router]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#12180F",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Glow */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(161,138,68,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ textAlign: "center", zIndex: 1, maxWidth: 360 }}>
        {/* DH monogram */}
        <div
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
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              color: "#A18A44",
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            DH
          </span>
        </div>

        <p style={{ color: "#A18A44", fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 12 }}>
          Deddeh Hills
        </p>

        {status === "loading" && (
          <>
            <h1 style={{ color: "#F5F0E8", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
              {forName ? `Welcome, ${forName}` : "Verifying your invitation…"}
            </h1>
            <p style={{ color: "rgba(245,240,232,0.45)", fontSize: 14, lineHeight: 1.6 }}>
              Just a moment while we set up your access.
            </p>
            {/* Simple spinner */}
            <div
              style={{
                margin: "28px auto 0",
                width: 32,
                height: 32,
                border: "3px solid rgba(161,138,68,0.2)",
                borderTop: "3px solid #A18A44",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1 style={{ color: "#F5F0E8", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
              {confirmedName ? `Welcome, ${confirmedName}` : "Welcome to Deddeh Hills"}
            </h1>
            <p style={{ color: "rgba(245,240,232,0.45)", fontSize: 14, lineHeight: 1.6 }}>
              Your access has been granted. Redirecting you now…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 style={{ color: "#F5F0E8", fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
              Invalid Invitation
            </h1>
            <p style={{ color: "rgba(239,68,68,0.8)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {errorMsg}
            </p>
            <p style={{ color: "rgba(245,240,232,0.3)", fontSize: 13 }}>
              Please contact the team for a new link.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
