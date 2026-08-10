"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Triangle, LogOut, Info, CheckCircle2, XCircle, Terminal } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";
import BottomNav from "@/components/BottomNav";

type Status = { github: boolean; githubOrg: string | null; vercel: boolean; vercelTeam: boolean };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 px-1 font-display text-xs font-semibold uppercase tracking-wide text-ink-faint">
      {children}
    </h2>
  );
}

function Row({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-base-border bg-base-surface2 text-ink-dim">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{title}</p>
        {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function StatusPill({ ok, t }: { ok: boolean; t: (k: any) => string }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${
        ok
          ? "border-accent-mint/30 bg-accent-mint/10 text-accent-mint"
          : "border-accent-red/25 bg-accent-red/10 text-accent-red"
      }`}
    >
      {ok ? <CheckCircle2 size={12} strokeWidth={2.25} /> : <XCircle size={12} strokeWidth={2.25} />}
      {ok ? t("settings_configured") : t("settings_not_configured")}
    </span>
  );
}

export default function SettingsPage() {
  const { t } = useLang();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/settings/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setStatus(data);
      })
      .catch(() => setStatus(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between border-b border-base-border pb-4">
        <h1 className="font-display text-lg font-semibold tracking-tight text-ink">{t("settings_title")}</h1>
        <LanguageToggle />
      </header>

      <SectionLabel>{t("settings_general")}</SectionLabel>
      <div className="mb-6 divide-y divide-base-border rounded-xl border border-base-border bg-base-surface">
        <Row
          icon={<Terminal size={16} strokeWidth={2} />}
          title={t("settings_language")}
          right={<LanguageToggle />}
        />
      </div>

      <SectionLabel>{t("settings_integrations")}</SectionLabel>
      <div className="mb-1 divide-y divide-base-border rounded-xl border border-base-border bg-base-surface">
        <Row
          icon={<Github size={16} strokeWidth={2} />}
          title={t("settings_github_token")}
          subtitle={status?.githubOrg ? `org: ${status.githubOrg}` : undefined}
          right={status ? <StatusPill ok={status.github} t={t} /> : null}
        />
        <Row
          icon={<Triangle size={13} strokeWidth={2} fill="currentColor" />}
          title={t("settings_vercel_token")}
          right={status ? <StatusPill ok={status.vercel} t={t} /> : null}
        />
      </div>
      <p className="mb-6 px-1 text-xs text-ink-faint">{t("settings_env_hint")}</p>

      <SectionLabel>{t("settings_account")}</SectionLabel>
      <div className="mb-6 divide-y divide-base-border rounded-xl border border-base-border bg-base-surface">
        <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-base-surface2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent-red/25 bg-accent-red/10 text-accent-red">
            <LogOut size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-accent-red">{t("logout")}</p>
            <p className="truncate text-xs text-ink-faint">{t("settings_logout_desc")}</p>
          </div>
        </button>
      </div>

      <SectionLabel>{t("settings_about")}</SectionLabel>
      <div className="rounded-xl border border-base-border bg-base-surface p-4">
        <div className="mb-1 flex items-center gap-2 text-ink-dim">
          <Info size={14} strokeWidth={2} />
          <span className="font-mono text-xs">{t("appName")}</span>
        </div>
        <p className="text-xs leading-relaxed text-ink-faint">{t("settings_about_desc")}</p>
      </div>

      <BottomNav />
    </main>
  );
}
