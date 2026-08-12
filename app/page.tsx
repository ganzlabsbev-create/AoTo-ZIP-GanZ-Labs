"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { UploadCloud, GitPullRequestArrow, Search, X } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import ProjectCard, { ProjectListItem } from "@/components/ProjectCard";
import ToolCard from "@/components/ToolCard";
import BottomNav from "@/components/BottomNav";

export default function HomePage() {
  const { t } = useLang();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectListItem[] | null>(null);
  const [query, setQuery] = useState("");

  async function loadProjects() {
    const res = await fetch("/api/projects");
    const data = await res.json();
    if (data.ok) setProjects(data.projects);
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleDelete(id: string) {
    // ตัดออกจาก UI ก่อนเลยให้รู้สึกไว แล้วค่อยยิงลบจริง (ถ้า error ค่อยโหลดใหม่)
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
    } catch {
      loadProjects();
    }
  }

  const filtered = useMemo(() => {
    if (!projects) return projects;
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.framework || "").toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <main className="min-h-screen bg-grid-fade">
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        <header className="mb-6 flex items-center gap-2.5 border-b border-base-border pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-glow-indigo">
            <Image src="/logo.png" alt="GanZ Ops" width={36} height={36} priority className="h-full w-full object-contain" />
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
                {filtered?.length ?? 0}/{projects.length}
              </span>
            )}
          </div>

          {projects && projects.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
              <Search size={14} className="shrink-0 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search_projects_placeholder")}
                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="shrink-0 text-ink-faint active:scale-95 transition">
                  <X size={14} />
                </button>
              )}
            </div>
          )}

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
          ) : filtered && filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">
              {t("no_search_results")}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered!.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
