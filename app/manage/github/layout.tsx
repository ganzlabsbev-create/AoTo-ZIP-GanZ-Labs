"use client";

import { Suspense } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, GitBranch, FolderTree, SlidersHorizontal, Tag, Users } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

const TABS = [
  { key: "files", icon: FolderTree, labelKey: "manage_tab_g_files" },
  { key: "branches", icon: GitBranch, labelKey: "manage_tab_g_branches" },
  { key: "settings", icon: SlidersHorizontal, labelKey: "manage_tab_g_settings" },
  { key: "releases", icon: Tag, labelKey: "manage_tab_g_releases" },
  { key: "collaborators", icon: Users, labelKey: "manage_tab_g_collaborators" },
] as const;

export default function GithubRepoLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
          <div className="flex justify-center py-12" />
        </main>
      }
    >
      <GithubRepoLayoutInner>{children}</GithubRepoLayoutInner>
    </Suspense>
  );
}

function GithubRepoLayoutInner({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";
  const branch = searchParams.get("branch") || "main";

  const activeTab = TABS.find((tb) => pathname?.includes(`/${tb.key}`))?.key ?? "files";

  function goTab(key: string) {
    router.push(
      `/manage/github/${key}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`
    );
  }

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

      <div className="mb-4">
        <h1 className="mb-1 truncate font-display text-xl font-semibold text-ink">
          {owner}/{repo}
        </h1>
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent-indigo"
        >
          {branch} <ExternalLink size={12} />
        </a>
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-base-border bg-base-surface2 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => goTab(tab.key)}
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
