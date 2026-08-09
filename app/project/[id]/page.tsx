"use client";

import { useEffect, useRef, useState } from "react";
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
  Copy,
  RefreshCw,
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
type BuildLogSource = "vercel" | "github" | null;

/** กล่องแสดง build log เต็มของ deployment ล่าสุดที่ error (vercel หรือ github ก็ใช้ตัวเดียวกัน) */
function BuildLogPanel({ log, source }: { log: string; source: BuildLogSource }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(log);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // เผื่อ clipboard permission ไม่ผ่าน ไม่ต้องทำอะไรต่อ
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-base-border bg-base-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">
          {t("build_log_title")}
          {source === "vercel" ? " · Vercel" : source === "github" ? " · GitHub" : ""}
        </p>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1 rounded-md border border-base-border bg-base-surface2 px-2 py-1 text-[11px] text-ink-dim active:scale-95 transition"
        >
          <Copy size={12} /> {copied ? t("build_log_copied") : t("build_log_copy")}
        </button>
      </div>
      <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-base-bg p-3 font-mono text-xs text-ink-dim">
        {log}
      </pre>
    </section>
  );
}

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

  // build log เต็มของ deployment ล่าสุดที่ error (ไม่ว่าจะเป็น vercel หรือ github)
  const [buildLog, setBuildLog] = useState<string | null>(null);
  const [buildLogSource, setBuildLogSource] = useState<BuildLogSource>(null);

  // อัพเดต ZIP ทับของเดิม (project id เดิม)
  const updateZipInputRef = useRef<HTMLInputElement>(null);
  const [updateZipStatus, setUpdateZipStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [updateZipError, setUpdateZipError] = useState<string | null>(null);

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
      if (!data.ok) {
        if (data.buildLog) {
          setBuildLog(data.buildLog);
          setBuildLogSource("vercel");
        }
        throw new Error(data.detail || data.error);
      }
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
      if (!data.ok) {
        if (data.buildLog) {
          setBuildLog(data.buildLog);
          setBuildLogSource("github");
        }
        throw new Error(data.detail || data.error);
      }
      setGithubUrl(data.url);
      setGithubStatus("success");
    } catch (err: any) {
      setGithubError(String(err?.message || err));
      setGithubStatus("error");
    }
  }

  async function handleUpdateZip(file: File) {
    setUpdateZipStatus("loading");
    setUpdateZipError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${params.id}/update-zip`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(": ");
        throw new Error(msg || "update_zip_failed");
      }

      // อัพเดตข้อมูลโปรเจกต์ในหน้าให้ตรงกับ ZIP ใหม่ (id/name เดิม ไม่เปลี่ยน)
      setProject((prev: any) => ({
        ...prev,
        framework: data.framework,
        build_command: data.buildCommand,
        file_tree: data.tree,
      }));

      // ผลลัพธ์ deploy เดิม (ถ้ามี) อ้างอิงโค้ดเก่า ล้างสถานะทิ้งเพื่อไม่ให้เข้าใจผิด
      // (ค่า domainName / repoName ที่กรอกไว้ไม่แตะ ใช้ค่าเดิมได้เลย)
      setVercelStatus("idle");
      setVercelUrl(null);
      setVercelError(null);
      setGithubStatus("idle");
      setGithubUrl(null);
      setGithubError(null);
      setBuildLog(null);
      setBuildLogSource(null);

      setUpdateZipStatus("success");
      setTimeout(() => setUpdateZipStatus("idle"), 3000);
    } catch (err: any) {
      setUpdateZipError(String(err?.message || err));
      setUpdateZipStatus("error");
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

      {/* อัพเดต ZIP ทับของเดิม (project id เดิม, ไม่สร้างใหม่) */}
      <section className="mb-6 rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-1 text-xs font-medium text-ink-dim">{t("update_zip_title")}</p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("update_zip_desc")}</p>

        <button
          onClick={() => updateZipInputRef.current?.click()}
          disabled={updateZipStatus === "loading"}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-base-border bg-base-surface2 py-3 text-sm font-medium text-ink disabled:opacity-40 active:scale-[0.98] transition"
        >
          {updateZipStatus === "loading" ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {t("update_zip_uploading")}
            </>
          ) : (
            <>
              <RefreshCw size={15} strokeWidth={2} /> {t("update_zip_button")}
            </>
          )}
        </button>
        <input
          ref={updateZipInputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpdateZip(file);
            e.target.value = "";
          }}
        />

        {updateZipStatus === "success" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-mint">
            <CheckCircle2 size={13} /> {t("update_zip_success")}
          </p>
        )}
        {updateZipStatus === "error" && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {updateZipError}
          </p>
        )}
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

      {buildLog && <BuildLogPanel log={buildLog} source={buildLogSource} />}
    </main>
  );
}
