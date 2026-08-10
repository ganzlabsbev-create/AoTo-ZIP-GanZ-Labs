"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, GitPullRequestArrow, Terminal } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import ProjectCard, { ProjectListItem } from "@/components/ProjectCard";
import ToolCard from "@/components/ToolCard";
import BottomNav from "@/components/BottomNav";

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

  return (
    <main className="min-h-screen bg-grid-fade">
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        <header className="mb-6 flex items-center gap-2 border-b border-base-border pb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-base-border bg-base-surface text-accent-indigo">
            <Terminal size={15} strokeWidth={2.25} />
          </div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-ink">{t("appName")}</h1>
        </header>

        <section className="space-y-2.5">
          <ToolCard
            icon={UploadCloud}
            title={t("tool_new_deploy_title")}
            description={t("tool_new_deploy_desc")}
            color="indigo"
            onClick={() => router.push("/new")}
          />
          <ToolCard
            icon={GitPullRequestArrow}
            title={t("tool_update_repo_title")}
            description={t("tool_update_repo_desc")}
            color="mint"
            onClick={() => router.push("/update-repo")}
          />
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-ink-faint">
              {t("recent_projects")}
            </h2>
            {projects && projects.length > 0 && (
              <span className="rounded-full border border-base-border bg-base-surface px-2 py-0.5 font-mono text-[11px] text-ink-faint">
                {projects.length}
              </span>
            )}
          </div>
          {projects === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-base-border bg-base-surface" />
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
      </div>

      <BottomNav />
    </main>
  );
}
