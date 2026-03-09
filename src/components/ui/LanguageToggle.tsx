"use client";

import { useTranslations } from "@/i18n/useTranslations";

export default function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useTranslations();

  return (
    <button
      onClick={() => setLang(lang === "en" ? "ar" : "en")}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600 ${className ?? ""}`}
      title={lang === "en" ? "Switch to Arabic" : "Switch to English"}
    >
      {lang === "en" ? "عربي" : "English"}
    </button>
  );
}
