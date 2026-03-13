import type { CSSProperties } from "react";

/**
 * Deddeh Hills brand logo — matches the style on the customer/landing page.
 * variant="light"  → white "Deddeh Hills" text (for dark headers)
 * variant="dark"   → dark ink "Deddeh Hills" text (for light backgrounds)
 */
export default function DhLogo({
  className,
  variant = "dark",
  style,
  href = "/",
}: {
  className?: string;
  variant?: "light" | "dark";
  style?: CSSProperties;
  href?: string;
}) {
  const textColor  = variant === "light" ? "#ffffff"   : "#1A3810";
  const boxBg      = variant === "light" ? "rgba(120,191,66,0.12)" : "rgba(120,191,66,0.15)";
  const boxBorder  = variant === "light" ? "rgba(120,191,66,0.30)" : "rgba(120,191,66,0.45)";
  const dhColor    = "#78BF42";

  return (
    <a
      href={href}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        textDecoration: "none",
        ...style,
      }}
    >
      {/* DH emblem */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: boxBg,
        border: `1.5px solid ${boxBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          color: dhColor,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "'Playfair Display', Georgia, serif",
        }}>DH</span>
      </div>

      {/* Wordmark */}
      <span style={{
        color: textColor,
        fontSize: 16,
        fontWeight: 600,
        fontFamily: "'Playfair Display', Georgia, serif",
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}>Deddeh Hills</span>
    </a>
  );
}
