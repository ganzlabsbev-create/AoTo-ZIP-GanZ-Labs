"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, GitPullRequestArrow } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";
import UploadZone from "@/components/UploadZone";
import ProjectCard, { ProjectListItem } from "@/components/ProjectCard";
import FlowDiagram from "@/components/FlowDiagram";

export default function HomePage() {
  const { t } = useLang();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (data.ok) setProjects(data.projects);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-ink">{t("appName")}</h1>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            onClick={logout}
            aria-label={t("logout")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
          >
            <LogOut size={15} strokeWidth={2} />
          </button>
        </div>
      </header>

      <FlowDiagram />

      <section className="mt-4">
        <UploadZone
          onUploaded={(result) => {
            router.push(`/project/${result.projectId}`);
          }}
        />
      </section>

      <button
        onClick={() => router.push("/update-repo")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-base-border bg-base-surface py-3 text-sm font-medium text-ink-dim active:scale-[0.98] transition"
      >
        <GitPullRequestArrow size={15} strokeWidth={2} /> {t("update_repo_nav")}
      </button>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
          {t("recent_projects")}
        </h2>
        {projects === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-base-surface" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">
            {t("no_projects")}
          </p>
        ) : (
          <div className="space-y-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
