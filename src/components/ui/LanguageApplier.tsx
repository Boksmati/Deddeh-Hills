"use client";

import { useEffect } from "react";
import { useLang } from "@/i18n/useTranslations";

export default function LanguageApplier() {
  const lang = useLang();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    // Add RTL class to body for targeted CSS
    if (lang === "ar") {
      document.documentElement.classList.add("rtl");
    } else {
      document.documentElement.classList.remove("rtl");
    }
  }, [lang]);

  return null;
}
