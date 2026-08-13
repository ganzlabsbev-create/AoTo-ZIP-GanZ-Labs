"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Triangle, Github, Search, X, Trash2, Loader2, ChevronRight } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import BottomNav from "@/components/BottomNav";
import LanguageToggle from "@/components/LanguageToggle";

interface VercelProjectItem {
  id: string;
  name: string;
  url: string | null;
  updatedAt: number | null;
}

interface GithubRepoItem {
  name: string;
  full_name: string;
  default_branch: string;
  updated_at: string;
}

export default function ManagePage() {
  const { t } = useLang();
  const router = useRouter();
  const [tab, setTab] = useState<"vercel" | "github">("vercel");
  const [query, setQuery] = useState("");

  const [vercelProjects, setVercelProjects] = useState<VercelProjectItem[] | null>(null);
  const [vercelError, setVercelError] = useState<string | null>(null);
  const [githubRepos, setGithubRepos] = useState<GithubRepoItem[] | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/vercel/projects")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setVercelProjects(data.projects);
        else setVercelError(data.detail || data.error);
      })
      .catch((err) => setVercelError(String(err?.message || err)));

    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setGithubRepos(data.repos);
        else setGithubError(data.detail || data.error);
      })
      .catch((err) => setGithubError(String(err?.message || err)));
  }, []);

  const filteredVercel = useMemo(() => {
    if (!vercelProjects) return vercelProjects;
    const q = query.trim().toLowerCase();
    if (!q) return vercelProjects;
    return vercelProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [vercelProjects, query]);

  const filteredGithub = useMemo(() => {
    if (!githubRepos) return githubRepos;
    const q = query.trim().toLowerCase();
    if (!q) return githubRepos;
    return githubRepos.filter((r) => r.full_name.toLowerCase().includes(q));
  }, [githubRepos, query]);

  async function handleDeleteVercel(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/vercel/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setVercelProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  async function handleDeleteGithub(fullName: string) {
    if (confirmingId !== fullName) {
      setConfirmingId(fullName);
      return;
    }
    setDeletingId(fullName);
    try {
      const [owner, repo] = fullName.split("/");
      const res = await fetch(`/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setGithubRepos((prev) => (prev ? prev.filter((r) => r.full_name !== fullName) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-grid-fade">
      <div className="mx-auto max-w-md px-4 pb-24 pt-6">
        <header className="mb-5 flex items-center justify-between border-b border-base-border pb-4">
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight text-ink">{t("manage_title")}</h1>
            <p className="mt-0.5 text-xs text-ink-faint">{t("manage_desc")}</p>
          </div>
          <LanguageToggle />
        </header>

        <div className="mb-4 flex gap-2 rounded-lg border border-base-border bg-base-surface2 p-1">
          <button
            onClick={() => {
              setTab("vercel");
              setQuery("");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition ${
              tab === "vercel" ? "bg-base-surface text-ink shadow-card" : "text-ink-faint"
            }`}
          >
            <Triangle size={11} fill="currentColor" />
            {t("manage_tab_vercel")}
          </button>
          <button
            onClick={() => {
              setTab("github");
              setQuery("");
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition ${
              tab === "github" ? "bg-base-surface text-ink shadow-card" : "text-ink-faint"
            }`}
          >
            <Github size={12} />
            {t("manage_tab_github")}
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
          <Search size={14} className="shrink-0 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("manage_search_placeholder")}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0 text-ink-faint active:scale-95 transition">
              <X size={14} />
            </button>
          )}
        </div>

        {tab === "vercel" ? (
          <VercelList
            projects={filteredVercel}
            error={vercelError}
            confirmingId={confirmingId}
            deletingId={deletingId}
            onDelete={handleDeleteVercel}
            onOpen={(id) => router.push(`/manage/vercel/${id}`)}
          />
        ) : (
          <GithubList
            repos={filteredGithub}
            error={githubError}
            confirmingId={confirmingId}
            deletingId={deletingId}
            onDelete={handleDeleteGithub}
            onOpen={(r) =>
              router.push(
                `/manage/github?owner=${encodeURIComponent(r.full_name.split("/")[0])}&repo=${encodeURIComponent(
                  r.name
                )}&branch=${encodeURIComponent(r.default_branch)}`
              )
            }
          />
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function VercelList({
  projects,
  error,
  confirmingId,
  deletingId,
  onDelete,
  onOpen,
}: {
  projects: VercelProjectItem[] | null;
  error: string | null;
  confirmingId: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useLang();
  if (error) return <ErrorBox message={error} />;
  if (projects === null) return <LoadingList />;
  if (projects.length === 0) return <EmptyBox message={t("manage_no_vercel_projects")} />;

  return (
    <div className="space-y-2">
      {projects.map((p) => (
        <ListRow
          key={p.id}
          title={p.name}
          subtitle={p.url}
          icon={<Triangle size={14} fill="currentColor" className="text-accent-indigo" />}
          confirming={confirmingId === p.id}
          deleting={deletingId === p.id}
          onOpen={() => onOpen(p.id)}
          onDelete={() => onDelete(p.id)}
        />
      ))}
    </div>
  );
}

function GithubList({
  repos,
  error,
  confirmingId,
  deletingId,
  onDelete,
  onOpen,
}: {
  repos: GithubRepoItem[] | null;
  error: string | null;
  confirmingId: string | null;
  deletingId: string | null;
  onDelete: (fullName: string) => void;
  onOpen: (r: GithubRepoItem) => void;
}) {
  const { t } = useLang();
  if (error) return <ErrorBox message={error} />;
  if (repos === null) return <LoadingList />;
  if (repos.length === 0) return <EmptyBox message={t("manage_no_github_repos")} />;

  return (
    <div className="space-y-2">
      {repos.map((r) => (
        <ListRow
          key={r.full_name}
          title={r.full_name}
          subtitle={r.default_branch}
          icon={<Github size={14} className="text-accent-mint" />}
          confirming={confirmingId === r.full_name}
          deleting={deletingId === r.full_name}
          onOpen={() => onOpen(r)}
          onDelete={() => onDelete(r.full_name)}
        />
      ))}
    </div>
  );
}

function ListRow({
  title,
  subtitle,
  icon,
  confirming,
  deleting,
  onOpen,
  onDelete,
}: {
  title: string;
  subtitle: string | null;
  icon: React.ReactNode;
  confirming: boolean;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-base-border bg-base-surface px-4 py-3.5 shadow-card">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left active:scale-[0.99] transition">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-base-border bg-base-surface2">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium text-ink">{title}</p>
          {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
        </div>
        <ChevronRight size={15} strokeWidth={2} className="shrink-0 text-ink-faint" />
      </button>
      <button
        onClick={onDelete}
        disabled={deleting}
        title={confirming ? t("manage_delete_confirm") : undefined}
        className={`flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition active:scale-95 ${
          confirming
            ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
            : "border-base-border bg-base-surface2 text-ink-faint"
        }`}
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} strokeWidth={2} />}
      </button>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-base-border bg-base-surface" />
      ))}
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">
      {message}
    </p>
  );
}

function ErrorBox({ message }: { message: string }) {
  const { t } = useLang();
  return (
    <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
      {t("manage_load_failed")}: {message}
    </p>
  );
}
