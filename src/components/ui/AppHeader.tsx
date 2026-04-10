"use client";

import { useState } from "react";
import DhLogo from "./DhLogo";
import LanguageToggle from "./LanguageToggle";
import { useRole } from "@/hooks/useRole";
import { useTranslations } from "@/i18n/useTranslations";

export type AppPage =
  | "simulator"
  | "assumptions"
  | "status"
  | "investor"
  | "term-sheet"
  | "admin"
  | "customer";

interface AppHeaderProps {
  currentPage: AppPage;
}

/**
 * Unified navigation header — dark forest green, role-aware, mobile hamburger.
 * Used on every page: simulator, assumptions, status, investor,
 * investor/term-sheet, admin, and customer (public).
 *
 * - Admin/Investor role → sees Investor Portal link
 * - Customer / unauthenticated → Investor Portal link hidden
 */
export default function AppHeader({ currentPage }: AppHeaderProps) {
  const role = useRole();
  const { t, lang } = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);

  const isAdmin      = role === "admin";
  const isInvestor   = role === "investor";
  const canSeeInvestor = isAdmin || isInvestor;
  const isRTL        = lang === "ar";

  /* ── Shared style helpers ──────────────────────────────────────────────── */
  const base =
    "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap";

  function NavLink({
    href,
    page,
    variant = "ghost",
    children,
  }: {
    href: string;
    page?: AppPage;
    variant?: "ghost" | "green" | "subtle" | "admin";
    children: React.ReactNode;
  }) {
    const isActive = page !== undefined && page === currentPage;

    if (isActive) {
      return (
        <a href={href} className={`${base} bg-white/15 text-white font-semibold`}>
          {children}
        </a>
      );
    }
    if (variant === "green") {
      return (
        <a href={href} className={`${base} text-white`} style={{ background: "#78BF42" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#67AA34")}
          onMouseLeave={e => (e.currentTarget.style.background = "#78BF42")}>
          {children}
        </a>
      );
    }
    if (variant === "subtle") {
      return (
        <a href={href} className={`${base} bg-white/10 text-white/90 hover:bg-white/20`}>
          {children}
        </a>
      );
    }
    if (variant === "admin") {
      return (
        <a href={href} className={`${base} border`}
          style={{ background: "rgba(255,255,255,0.08)", color: "#95CC58", borderColor: "rgba(255,255,255,0.2)" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}>
          {children}
        </a>
      );
    }
    /* ghost */
    return (
      <a href={href} className={`${base} text-white/70 hover:bg-white/10 hover:text-white`}>
        {children}
      </a>
    );
  }

  const Divider = () => <div className="w-px h-4 bg-white/20 mx-1 flex-shrink-0" />;

  /* ── Mobile dropdown items (role-aware) ───────────────────────────────── */
  const bFont = "'DM Sans', system-ui, sans-serif";

  const mobileItemStyle = (active: boolean): React.CSSProperties => ({
    display: "block",
    padding: "13px 20px",
    color: active ? "#78BF42" : "rgba(255,255,255,0.80)",
    fontSize: 14,
    fontFamily: bFont,
    fontWeight: active ? 600 : 400,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    transition: "background 0.15s",
    textDecoration: "none",
  });

  function MobileItem({ href, label, active = false, accent = false }:
    { href: string; label: string; active?: boolean; accent?: boolean }) {
    return (
      <a
        href={href}
        onClick={() => setMenuOpen(false)}
        style={{
          ...mobileItemStyle(active),
          ...(accent
            ? { background: "rgba(120,191,66,0.12)", color: "#95CC58", fontWeight: 600 }
            : {}),
        }}
        onMouseOver={e => { if (!accent) e.currentTarget.style.background = "rgba(120,191,66,0.07)"; }}
        onMouseOut={e => { if (!accent) e.currentTarget.style.background = "transparent"; }}
      >
        {label}
      </a>
    );
  }

  return (
    <div className="relative" style={{ zIndex: 40 }}>
      {/* ── Main bar ─────────────────────────────────────────────────── */}
      <header
        className="px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0 min-w-0"
        style={{ background: "#1A3810" }}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Logo */}
        <DhLogo
          variant="light"
          href={isAdmin ? "/simulator" : isInvestor ? "/investor" : "/"}
          style={{ flexShrink: 0 }}
        />

        {/* ── Desktop nav links — hidden on mobile ────────────────── */}
        <div
          className={`hidden md:flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""} min-w-0 overflow-x-auto`}
          style={{ scrollbarWidth: "none" } as React.CSSProperties}
        >
          {/* Admin */}
          {isAdmin && (
            <>
              <NavLink href="/simulator"   page="simulator"   variant="ghost">{t("nav_simulator")}</NavLink>
              <NavLink href="/assumptions" page="assumptions" variant="ghost">{t("nav_assumptions")}</NavLink>
              <NavLink href="/model"       page="model"       variant="ghost">{lang === "ar" ? "النموذج" : "Model"}</NavLink>
              <NavLink href="/status"      page="status"      variant="ghost">{t("nav_status")}</NavLink>
              <Divider />
              <NavLink href="/investor"    page="investor"    variant="green">{t("nav_investor")}</NavLink>
              <NavLink href="/customer"    page="customer"    variant="subtle">{t("nav_customer")}</NavLink>
              <Divider />
              <NavLink href="/admin"       page="admin"       variant="admin">
                {lang === "ar" ? "الإدارة ⚙️" : "Admin ⚙️"}
              </NavLink>
            </>
          )}

          {/* Investor */}
          {isInvestor && (
            <>
              <NavLink href="/investor"           page="investor"    variant="ghost">{t("nav_investor")}</NavLink>
              <NavLink href="/investor/term-sheet" page="term-sheet"  variant="ghost">{t("term_sheet_nav")}</NavLink>
              <Divider />
              <NavLink href="/customer" page="customer" variant="subtle">
                {lang === "ar" ? "تصفح المشروع ↗" : "Browse Project ↗"}
              </NavLink>
            </>
          )}

          {/* Customer / public — investor portal CTA only if eligible */}
          {!isAdmin && !isInvestor && (
            <>
              <NavLink href="/" variant="ghost">
                {lang === "ar" ? "الرئيسية" : "Home"}
              </NavLink>
              <NavLink href="/customer" page="customer" variant="subtle">
                {lang === "ar" ? "تصفح المشروع" : "Browse Project"}
              </NavLink>
            </>
          )}

          {/* Read-only badge */}
          {isInvestor && currentPage === "simulator" && (
            <span className="px-3 py-1.5 bg-white/10 text-white/80 text-xs font-medium rounded-lg border border-white/20">
              {lang === "ar" ? "عرض فقط" : "Read-only"}
            </span>
          )}
        </div>

        {/* ── Right side: lang toggle + hamburger ─────────────────── */}
        <div className="flex items-center gap-2 ms-auto flex-shrink-0">
          <LanguageToggle />
          {/* Hamburger — always visible on mobile, hidden md+ */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg border-none cursor-pointer transition-colors"
            style={{ background: menuOpen ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.10)" }}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {menuOpen
              ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="2" x2="14" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="14" y1="2" x2="2" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
              : <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><line x1="2" y1="4" x2="14" y2="4" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="8" x2="14" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round"/><line x1="2" y1="12" x2="14" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            }
          </button>
        </div>
      </header>

      {/* ── Mobile dropdown ───────────────────────────────────────────── */}
      {menuOpen && (
        <div
          className="md:hidden absolute top-full left-0 right-0"
          style={{
            background: "rgba(22,47,14,0.98)",
            backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(120,191,66,0.18)",
            animation: "menuSlide 0.18s ease both",
          }}
        >
          <style>{`@keyframes menuSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>

          {/* Admin links */}
          {isAdmin && (
            <>
              <MobileItem href="/simulator"            label={t("nav_simulator")}    active={currentPage === "simulator"} />
              <MobileItem href="/assumptions"          label={t("nav_assumptions")}  active={currentPage === "assumptions"} />
              <MobileItem href="/model"                label={lang === "ar" ? "النموذج" : "Model"} active={currentPage === "model"} />
              <MobileItem href="/status"               label={t("nav_status")}       active={currentPage === "status"} />
              <MobileItem href="/investor"             label={t("nav_investor")}     active={currentPage === "investor"}   accent />
              <MobileItem href="/customer"             label={lang === "ar" ? "تصفح المشروع" : "Browse Project"} active={currentPage === "customer"} />
              <MobileItem href="/admin"                label={lang === "ar" ? "الإدارة ⚙️" : "Admin ⚙️"}      active={currentPage === "admin"} />
            </>
          )}

          {/* Investor links */}
          {isInvestor && !isAdmin && (
            <>
              <MobileItem href="/investor"             label={t("nav_investor")}     active={currentPage === "investor"}   accent />
              <MobileItem href="/investor/term-sheet"  label={t("term_sheet_nav")}   active={currentPage === "term-sheet"} />
              <MobileItem href="/customer"             label={lang === "ar" ? "تصفح المشروع" : "Browse Project"} active={currentPage === "customer"} />
            </>
          )}

          {/* Customer / public — NO investor link */}
          {!isAdmin && !isInvestor && (
            <>
              <MobileItem href="/"        label={lang === "ar" ? "الرئيسية" : "Home"}          active={false} />
              <MobileItem href="/customer" label={lang === "ar" ? "تصفح المشروع" : "Browse Project"} active={currentPage === "customer"} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
