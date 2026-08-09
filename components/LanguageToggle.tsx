"use client";

import { useLang } from "@/lib/i18n-context";
import { Languages } from "lucide-react";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();

  return (
    <button
      onClick={() => setLang(lang === "th" ? "en" : "th")}
      className="flex items-center gap-1.5 rounded-full border border-base-border bg-base-surface px-3 py-2 text-xs font-medium text-ink-dim active:scale-95 transition"
      aria-label="Toggle language"
    >
      <Languages size={14} strokeWidth={2} />
      {lang === "th" ? "TH" : "EN"}
    </button>
  );
}
