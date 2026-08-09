"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Github,
  Triangle,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Folder,
  File as FileIcon,
} from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

type TreeNode = { name: string; type: "file" | "dir"; children?: TreeNode[] };

function TreeView({ nodes, depth = 0 }: { nodes: TreeNode[]; depth?: number }) {
  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }}>
      {nodes.map((n, i) => (
        <div key={i}>
          <div className="flex items-center gap-1.5 py-1 font-mono text-xs text-ink-dim">
            {n.type === "dir" ? (
              <Folder size={13} strokeWidth={2} className="shrink-0 text-accent-indigo" />
            ) : (
              <FileIcon size={13} strokeWidth={2} className="shrink-0 text-ink-faint" />
            )}
            <span className="truncate">{n.name}</span>
          </div>
          {n.children && n.children.length > 0 && <TreeView nodes={n.children} depth={depth + 1} />}
        </div>
      ))}
    </div>
  );
}

type DeployStatus = "idle" | "loading" | "success" | "error";

export default function ProjectDetailPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);

  const [domainName, setDomainName] = useState("");
  const [repoName, setRepoName] = useState("");

  const [vercelStatus, setVercelStatus] = useState<DeployStatus>("idle");
  const [vercelUrl, setVercelUrl] = useState<string | null>(null);
  const [vercelError, setVercelError] = useState<string | null>(null);

  const [githubStatus, setGithubStatus] = useState<DeployStatus>("idle");
  const [githubUrl, setGithubUrl] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setProject(data.project);
        setDomainName(data.project.name);
        setRepoName(data.project.name);

        const successVercel = data.deployments.find(
          (d: any) => d.target === "vercel" && d.status === "success"
        );
        const successGithub = data.deployments.find(
          (d: any) => d.target === "github" && d.status === "success"
        );
        if (successVercel) {
          setVercelStatus("success");
          setVercelUrl(successVercel.url);
        }
        if (successGithub) {
          setGithubStatus("success");
          setGithubUrl(successGithub.url);
        }
      });
  }, [params.id]);

  async function deployVercel() {
    setVercelStatus("loading");
    setVercelError(null);
    try {
      const res = await fetch("/api/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id, domainName }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setVercelUrl(data.url);
      setVercelStatus("success");
    } catch (err: any) {
      setVercelError(String(err?.message || err));
      setVercelStatus("error");
    }
  }

  async function pushGithub() {
    setGithubStatus("loading");
    setGithubError(null);
    try {
      const res = await fetch("/api/deploy/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id, repoName }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setGithubUrl(data.url);
      setGithubStatus("success");
    } catch (err: any) {
      setGithubError(String(err?.message || err));
      setGithubStatus("error");
    }
  }

  if (!project) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
        <Loader2 size={22} className="animate-spin text-ink-faint" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <LanguageToggle />
      </header>

      <h1 className="mb-1 truncate font-display text-xl font-semibold text-ink">{project.name}</h1>
      <p className="mb-5 text-sm text-ink-dim">
        {t("detected")}: <span className="text-ink">{project.framework}</span>
      </p>

      {project.build_command && (
        <div className="mb-5 rounded-lg border border-base-border bg-base-surface px-3 py-2.5">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-faint">
            {t("build_command")}
          </p>
          <code className="font-mono text-xs text-accent-mint">{project.build_command}</code>
        </div>
      )}

      <section className="mb-6 rounded-xl border border-base-border bg-base-surface p-3">
        <p className="mb-2 text-[11px] uppercase tracking-wide text-ink-faint">
          {t("file_structure")}
        </p>
        <div className="max-h-56 overflow-y-auto">
          <TreeView nodes={project.file_tree} />
        </div>
      </section>

      {/* Vercel deploy */}
      <section className="mb-4 rounded-xl border border-base-border bg-base-surface p-4">
        <label className="mb-1.5 block text-xs font-medium text-ink-dim">{t("domain_label")}</label>
        <div className="mb-3 flex items-center rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5">
          <input
            value={domainName}
            onChange={(e) => setDomainName(e.target.value)}
            placeholder={t("domain_placeholder")}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <span className="shrink-0 font-mono text-xs text-ink-faint">.vercel.app</span>
        </div>

        <button
          onClick={deployVercel}
          disabled={vercelStatus === "loading" || !domainName}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-base-bg disabled:opacity-40 active:scale-[0.98] transition"
        >
          {vercelStatus === "loading" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {t("deploying")}
            </>
          ) : (
            <>
              <Triangle size={12} fill="currentColor" strokeWidth={0} /> {t("deploy_vercel")}
            </>
          )}
        </button>

        {vercelStatus === "success" && vercelUrl && (
          <a
            href={vercelUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm text-accent-mint"
          >
            <CheckCircle2 size={14} /> {t("view_site")} <ExternalLink size={12} />
          </a>
        )}
        {vercelStatus === "error" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {vercelError}
          </p>
        )}
      </section>

      {/* GitHub push */}
      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <label className="mb-1.5 block text-xs font-medium text-ink-dim">{t("repo_label")}</label>
        <div className="mb-3 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5">
          <input
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder={t("repo_placeholder")}
            className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>

        <button
          onClick={pushGithub}
          disabled={githubStatus === "loading" || !repoName}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-border bg-base-surface2 py-3 text-sm font-medium text-ink disabled:opacity-40 active:scale-[0.98] transition"
        >
          {githubStatus === "loading" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {t("uploading_github")}
            </>
          ) : (
            <>
              <Github size={15} strokeWidth={2} /> {t("deploy_github")}
            </>
          )}
        </button>

        {githubStatus === "success" && githubUrl && (
          <a
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 text-sm text-accent-mint"
          >
            <CheckCircle2 size={14} /> {t("view_repo")} <ExternalLink size={12} />
          </a>
        )}
        {githubStatus === "error" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {githubError}
          </p>
        )}
      </section>
    </main>
  );
}
