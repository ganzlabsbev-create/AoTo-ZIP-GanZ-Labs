"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Rocket, SlidersHorizontal, KeyRound, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

const TABS = [
  { key: "deployments", icon: Rocket, labelKey: "manage_tab_v_deployments" },
  { key: "settings", icon: SlidersHorizontal, labelKey: "manage_tab_v_settings" },
  { key: "env-domains", icon: KeyRound, labelKey: "manage_tab_v_env_domains" },
  { key: "protection", icon: ShieldCheck, labelKey: "manage_tab_v_protection" },
] as const;

export default function VercelProjectLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();

  const [name, setName] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // โหลดข้อมูล header (ชื่อ/url) แค่ครั้งเดียวตอนเข้าโปรเจกต์นี้ ไม่โหลดซ้ำตอนสลับแท็บ
  useEffect(() => {
    fetch(`/api/vercel/projects/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setName(data.project.name);
          setUrl(data.project.url);
        } else {
          setLoadError(data.detail || data.error);
        }
      })
      .catch((err) => setLoadError(String(err?.message || err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const activeTab = TABS.find((tb) => pathname?.includes(`/${tb.key}`))?.key ?? "deployments";

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <button
          onClick={() => router.push("/manage")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <LanguageToggle />
      </header>

      {loadError ? (
        <p className="mb-4 rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
          {loadError}
        </p>
      ) : !name ? (
        <div className="mb-4 flex justify-center py-6">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      ) : (
        <div className="mb-4">
          <h1 className="mb-1 truncate font-display text-xl font-semibold text-ink">{name}</h1>
          {url && (
            <a
              href={`https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent-indigo"
            >
              {url} <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-base-border bg-base-surface2 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => router.push(`/manage/vercel/${params.id}/${tab.key}`)}
              className={`flex flex-1 shrink-0 items-center justify-center gap-1 rounded-md px-2 py-2 text-[11px] font-medium whitespace-nowrap transition ${
                active ? "bg-base-surface text-ink shadow-card" : "text-ink-faint"
              }`}
            >
              <Icon size={12} />
              {t(tab.labelKey)}
            </button>
          );
        })}
      </nav>

      {children}
    </main>
  );
}
