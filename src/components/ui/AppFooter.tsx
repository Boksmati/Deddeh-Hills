"use client";

import { useTranslations } from "@/i18n/useTranslations";

export default function AppFooter() {
  const { lang, isRTL } = useTranslations();

  return (
    <footer
      dir={isRTL ? "rtl" : "ltr"}
      className="mt-16 border-t"
      style={{ background: "#1A3810", borderColor: "rgba(149,204,88,0.15)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-wrap gap-4 items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "#2D5A27", border: "1px solid rgba(120,191,66,0.3)" }}
          >
            <span className="font-serif font-bold text-[11px]" style={{ color: "#78BF42" }}>DH</span>
          </div>
          <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans, sans-serif)" }}>
            {lang === "ar" ? "ديدح هيلز · الكورة، شمال لبنان" : "Deddeh Hills · Koura, North Lebanon"}
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-6 text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
          {[
            { label: lang === "ar" ? "تصفح القطع" : "Browse Lots", href: "/customer" },
            { label: lang === "ar" ? "المستثمرون" : "Investors",  href: "/investor" },
            { label: lang === "ar" ? "تواصل معنا" : "Contact",   href: "/#contact" },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              className="transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.45)" }}
              onMouseOver={e => (e.currentTarget.style.color = "#95CC58")}
              onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
          © 2025 Deddeh Hills
        </span>
      </div>
    </footer>
  );
}
