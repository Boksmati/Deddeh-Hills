"use client";

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
  | "admin";

interface AppHeaderProps {
  currentPage: AppPage;
}

/**
 * Unified navigation header — dark forest green, role-aware, active-state aware.
 * Used on every authenticated page: simulator, assumptions, status, investor,
 * investor/term-sheet, and admin.
 */
export default function AppHeader({ currentPage }: AppHeaderProps) {
  const role = useRole();
  const { t, lang } = useTranslations();

  const isAdmin = role === "admin";
  const isInvestor = role === "investor";
  const isRTL = lang === "ar";

  /* ── Nav link building blocks ────────────────────────────────────── */
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
        <a
          href={href}
          className={`${base} bg-white/15 text-white font-semibold`}
        >
          {children}
        </a>
      );
    }

    if (variant === "green") {
      return (
        <a
          href={href}
          className={`${base} text-white`}
          style={{ background: "#78BF42" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#67AA34")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "#78BF42")
          }
        >
          {children}
        </a>
      );
    }

    if (variant === "subtle") {
      return (
        <a
          href={href}
          className={`${base} bg-white/10 text-white/90 hover:bg-white/20`}
        >
          {children}
        </a>
      );
    }

    if (variant === "admin") {
      return (
        <a
          href={href}
          className={`${base} border`}
          style={{
            background: "rgba(255,255,255,0.08)",
            color: "#95CC58",
            borderColor: "rgba(255,255,255,0.2)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "rgba(255,255,255,0.08)")
          }
        >
          {children}
        </a>
      );
    }

    /* ghost (default) */
    return (
      <a
        href={href}
        className={`${base} text-white/70 hover:bg-white/10 hover:text-white`}
      >
        {children}
      </a>
    );
  }

  const Divider = () => (
    <div className="w-px h-4 bg-white/20 mx-1 flex-shrink-0" />
  );

  return (
    <header
      className="px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0 min-w-0"
      style={{ background: "#1A3810" }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Logo — links to role home */}
      <DhLogo
        variant="light"
        href={isAdmin ? "/simulator" : isInvestor ? "/investor" : "/"}
        style={{ flexShrink: 0 }}
      />

      {/* ── Navigation — scrollable on mobile, no scrollbar ── */}
      <div
        className={`flex items-center gap-1.5 ${isRTL ? "flex-row-reverse" : ""} min-w-0 overflow-x-auto`}
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {/* ── Admin navigation ── */}
        {isAdmin && (
          <>
            <NavLink href="/simulator" page="simulator" variant="ghost">
              {t("nav_simulator")}
            </NavLink>
            <NavLink href="/assumptions" page="assumptions" variant="ghost">
              {t("nav_assumptions")}
            </NavLink>
            <NavLink href="/status" page="status" variant="ghost">
              {t("nav_status")}
            </NavLink>

            <Divider />

            <NavLink href="/investor" page="investor" variant="green">
              {t("nav_investor")}
            </NavLink>
            <NavLink href="/customer" variant="subtle">
              {t("nav_customer")}
            </NavLink>

            <Divider />

            <NavLink href="/admin" page="admin" variant="admin">
              {lang === "ar" ? "الإدارة ⚙️" : "Admin ⚙️"}
            </NavLink>
          </>
        )}

        {/* ── Investor navigation ── */}
        {isInvestor && (
          <>
            <NavLink href="/investor" page="investor" variant="ghost">
              {t("nav_investor")}
            </NavLink>
            <NavLink href="/investor/term-sheet" page="term-sheet" variant="ghost">
              {t("term_sheet_nav")}
            </NavLink>

            <Divider />

            <NavLink href="/customer" variant="subtle">
              {lang === "ar" ? "تصفح المشروع ↗" : "Browse Project ↗"}
            </NavLink>
          </>
        )}

        {/* Read-only badge — investor viewing simulator */}
        {isInvestor && currentPage === "simulator" && (
          <span className="px-3 py-1.5 bg-white/10 text-white/80 text-xs font-medium rounded-lg border border-white/20">
            {lang === "ar" ? "عرض فقط" : "Read-only"}
          </span>
        )}

        <LanguageToggle />
      </div>
    </header>
  );
}
