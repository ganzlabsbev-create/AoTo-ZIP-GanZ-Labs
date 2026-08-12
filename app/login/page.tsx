"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { KeyRound, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

export const dynamic = "force-dynamic";

function LoginForm() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(true);
        setLoading(false);
        return;
      }
      router.replace(params.get("next") || "/");
      router.refresh();
    } catch {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="absolute right-4 top-4">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full shadow-glow-indigo">
            <Image src="/logo.png" alt="GanZ Ops" width={64} height={64} priority className="h-full w-full object-contain" />
          </div>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{t("appName")}</h2>
          <div className="flex items-center gap-1.5 text-ink-dim">
            <KeyRound size={13} strokeWidth={2} />
            <h1 className="font-display text-sm font-medium">{t("login_title")}</h1>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            inputMode="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("login_placeholder")}
            className="w-full rounded-xl border border-base-border bg-base-surface px-4 py-3.5 text-center text-lg tracking-wide text-ink placeholder:text-ink-faint focus:border-accent-indigo focus:outline-none"
          />
          {error && <p className="text-center text-sm text-accent-red">{t("login_error")}</p>}
          <button
            type="submit"
            disabled={loading || !code}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent-indigo py-3.5 font-medium text-white disabled:opacity-40 active:scale-[0.98] transition"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {t("login_button")}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
