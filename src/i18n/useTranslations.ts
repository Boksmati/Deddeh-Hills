"use client";

import { create } from "zustand";
import { useState, useEffect } from "react";
import { translations, Lang, TranslationKey } from "./translations";

interface LangStore {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const useLangStore = create<LangStore>((set) => ({
  lang: (() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("dh_lang") as Lang) ?? "en";
  })(),
  setLang: (lang) => {
    if (typeof window !== "undefined") localStorage.setItem("dh_lang", lang);
    set({ lang });
  },
}));

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}

export function useSetLang(): (l: Lang) => void {
  return useLangStore((s) => s.setLang);
}

export function useTranslations() {
  const lang = useLang();
  const setLang = useSetLang();
  // Guard against SSR/client hydration mismatch: always render "en" until mounted.
  // On mount, also sync the Zustand store from localStorage so page-reload
  // correctly restores the last-chosen language (the store IIFE may run
  // server-side with window===undefined and persist "en" through hydration).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? (localStorage.getItem("dh_lang") as Lang | null)
      : null;
    if (stored && stored !== lang) setLang(stored);
    setMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLang: Lang = mounted ? lang : "en";
  const isRTL = mounted ? lang === "ar" : false;

  function t(key: TranslationKey): string {
    return translations[activeLang][key];
  }

  return { t, lang: activeLang, setLang, isRTL };
}
