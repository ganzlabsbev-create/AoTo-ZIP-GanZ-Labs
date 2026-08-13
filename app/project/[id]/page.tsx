"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  History,
  Globe,
  KeyRound,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
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

/** กล่องแสดง build log (ใช้ทั้งตอน error แบบเดิม และตอน live ระหว่าง deploy) */
function BuildLogPanel({
  log,
  source,
  title,
  live,
}: {
  log: string;
  source: BuildLogSource;
  title?: string;
  live?: boolean;
}) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (live && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log, live]);

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
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
          {live && <Loader2 size={11} className="animate-spin text-accent-indigo" />}
          {title || t("build_log_title")}
          {source === "vercel" ? " · Vercel" : source === "github" ? " · GitHub" : ""}
        </p>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1 rounded-md border border-base-border bg-base-surface2 px-2 py-1 text-[11px] text-ink-dim active:scale-95 transition"
        >
          <Copy size={12} /> {copied ? t("build_log_copied") : t("build_log_copy")}
        </button>
      </div>
      <pre
        ref={logRef}
        className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-base-bg p-3 font-mono text-xs text-ink-dim"
      >
        {log || t("live_log_waiting")}
      </pre>
    </section>
  );
}

export default function ProjectDetailPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [project, setProject] = useState<any>(null);
  const [deployments, setDeployments] = useState<any[]>([]);

  const [domainName, setDomainName] = useState("");
  const [deployTarget, setDeployTarget] = useState<"production" | "preview">("production");
  const [repoName, setRepoName] = useState("");

  const [vercelStatus, setVercelStatus] = useState<DeployStatus>("idle");
  const [vercelUrl, setVercelUrl] = useState<string | null>(null);
  const [vercelError, setVercelError] = useState<string | null>(null);
  const [liveLog, setLiveLog] = useState<string>("");

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

  // rollback
  const [rollbackConfirmId, setRollbackConfirmId] = useState<string | null>(null);
  const [rollbackLoadingId, setRollbackLoadingId] = useState<string | null>(null);
  const [rollbackMsg, setRollbackMsg] = useState<string | null>(null);
  const [rollbackErr, setRollbackErr] = useState<string | null>(null);

  // env vars
  const [envs, setEnvs] = useState<{ id: string; key: string; target: string[] }[] | null>(null);
  const [envNotDeployed, setEnvNotDeployed] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState("");
  const [newEnvValue, setNewEnvValue] = useState("");
  const [envSaving, setEnvSaving] = useState(false);
  const [envEditingId, setEnvEditingId] = useState<string | null>(null);
  const [envEditValue, setEnvEditValue] = useState("");

  // custom domain
  const [domainInput, setDomainInput] = useState("");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainErr, setDomainErr] = useState<string | null>(null);

  // delete project
  const [deleteChoosing, setDeleteChoosing] = useState(false);
  const [deleteConfirmingReal, setDeleteConfirmingReal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function loadProject() {
    fetch(`/api/projects/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setProject(data.project);
        setDomainName(data.project.name);
        setRepoName(data.project.name);
        setDeployments(data.deployments || []);

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
  }

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function loadEnvs() {
    fetch(`/api/projects/${params.id}/env`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          if (data.error === "not_deployed_yet") setEnvNotDeployed(true);
          setEnvs([]);
          return;
        }
        setEnvNotDeployed(false);
        setEnvs(data.envs);
      })
      .catch(() => setEnvs([]));
  }

  useEffect(() => {
    loadEnvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function pollVercelStatus(deploymentId: string) {
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(`/api/deploy/vercel/status?deploymentId=${deploymentId}`);
      const data = await res.json();
      if (data.buildLog) setLiveLog(data.buildLog);

      if (data.status === "success") {
        setVercelUrl(data.url);
        setVercelStatus("success");
        loadProject();
        return;
      }
      if (data.status === "failed") {
        if (data.buildLog) {
          setBuildLog(data.buildLog);
          setBuildLogSource("vercel");
        }
        setVercelError(data.detail || t("deploy_failed"));
        setVercelStatus("error");
        return;
      }
    }
    setVercelError("timeout");
    setVercelStatus("error");
  }

  async function deployVercel() {
    setVercelStatus("loading");
    setVercelError(null);
    setLiveLog("");
    setBuildLog(null);
    try {
      const res = await fetch("/api/deploy/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: params.id, domainName, target: deployTarget }),
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.detail || data.error);
      }
      await pollVercelStatus(data.deploymentId);
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

      setProject((prev: any) => ({
        ...prev,
        framework: data.framework,
        build_command: data.buildCommand,
        file_tree: data.tree,
      }));

      setVercelStatus("idle");
      setVercelUrl(null);
      setVercelError(null);
      setGithubStatus("idle");
      setGithubUrl(null);
      setGithubError(null);
      setBuildLog(null);
      setBuildLogSource(null);
      setLiveLog("");

      setUpdateZipStatus("success");
      setTimeout(() => setUpdateZipStatus("idle"), 3000);
    } catch (err: any) {
      setUpdateZipError(String(err?.message || err));
      setUpdateZipStatus("error");
    }
  }

  // deployment สำเร็จบน vercel ทั้งหมด ไม่ซ้ำ vercel_deployment_id เรียงใหม่สุดก่อน (สำหรับ rollback list)
  const vercelHistory = useMemo(() => {
    const seen = new Set<string>();
    return deployments.filter((d) => {
      if (d.target !== "vercel" || d.status !== "success" || !d.vercel_deployment_id) return false;
      if (seen.has(d.vercel_deployment_id)) return false;
      seen.add(d.vercel_deployment_id);
      return true;
    });
  }, [deployments]);

  async function handleRollback(deploymentId: string) {
    if (rollbackConfirmId !== deploymentId) {
      setRollbackConfirmId(deploymentId);
      return;
    }
    setRollbackLoadingId(deploymentId);
    setRollbackErr(null);
    setRollbackMsg(null);
    try {
      const res = await fetch("/api/deploy/vercel/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setRollbackMsg(t("rollback_success"));
      setVercelUrl(data.url);
      setVercelStatus("success");
      loadProject();
    } catch (err: any) {
      setRollbackErr(String(err?.message || err));
    } finally {
      setRollbackLoadingId(null);
      setRollbackConfirmId(null);
    }
  }

  async function handleAddEnv() {
    if (!newEnvKey.trim() || !newEnvValue) return;
    setEnvSaving(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newEnvKey.trim(), value: newEnvValue }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setNewEnvKey("");
      setNewEnvValue("");
      loadEnvs();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setEnvSaving(false);
    }
  }

  async function handleSaveEnvEdit(envId: string) {
    setEnvSaving(true);
    try {
      const res = await fetch(`/api/projects/${params.id}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "", value: envEditValue, envId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setEnvEditingId(null);
      setEnvEditValue("");
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setEnvSaving(false);
    }
  }

  async function handleDeleteEnv(envId: string) {
    try {
      const res = await fetch(`/api/projects/${params.id}/env?envId=${envId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      loadEnvs();
    } catch (err: any) {
      alert(String(err?.message || err));
    }
  }

  async function handleAddDomain() {
    if (!domainInput.trim()) return;
    setDomainSaving(true);
    setDomainErr(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/domain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainInput.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setDomainInput("");
      loadProject();
    } catch (err: any) {
      setDomainErr(String(err?.message || err));
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleRemoveDomain() {
    setDomainSaving(true);
    setDomainErr(null);
    try {
      const res = await fetch(`/api/projects/${params.id}/domain`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      loadProject();
    } catch (err: any) {
      setDomainErr(String(err?.message || err));
    } finally {
      setDomainSaving(false);
    }
  }

  async function handleDeleteHistoryOnly() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push("/");
    } catch (err: any) {
      alert(String(err?.message || err));
      setDeleting(false);
      setDeleteChoosing(false);
    }
  }

  async function handleDeleteReal() {
    if (!deleteConfirmingReal) {
      setDeleteConfirmingReal(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}?real=1`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      router.push("/");
    } catch (err: any) {
      alert(String(err?.message || err));
      setDeleting(false);
      setDeleteChoosing(false);
      setDeleteConfirmingReal(false);
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
        <div className="flex items-center gap-2">
          {!deleteChoosing ? (
            <button
              onClick={() => setDeleteChoosing(true)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-base-border bg-base-surface px-3 text-xs font-medium text-ink-faint transition active:scale-95"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDeleteHistoryOnly}
                disabled={deleting}
                className="flex h-9 items-center gap-1 rounded-full border border-base-border bg-base-surface px-2.5 text-[11px] font-medium text-ink-faint transition active:scale-95"
              >
                {deleting && !deleteConfirmingReal ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  t("delete_btn_history_short")
                )}
              </button>
              <button
                onClick={handleDeleteReal}
                disabled={deleting}
                className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition active:scale-95 ${
                  deleteConfirmingReal
                    ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                    : "border-accent-red/25 bg-accent-red/5 text-accent-red/80"
                }`}
              >
                {deleting && deleteConfirmingReal ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : deleteConfirmingReal ? (
                  t("delete_btn_confirm_short")
                ) : (
                  t("delete_btn_real_short")
                )}
              </button>
              <button
                onClick={() => {
                  setDeleteChoosing(false);
                  setDeleteConfirmingReal(false);
                }}
                disabled={deleting}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-faint transition active:scale-95"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          )}
          <LanguageToggle />
        </div>
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

      {/* Vercel deploy (กด Deploy ซ้ำได้เรื่อยๆ = redeploy จาก ZIP เดิมในตัวอยู่แล้ว) */}
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

        <label className="mb-1.5 block text-xs font-medium text-ink-dim">{t("deploy_target_label")}</label>
        <div className="mb-3 flex gap-2 rounded-lg border border-base-border bg-base-surface2 p-1">
          <button
            type="button"
            onClick={() => setDeployTarget("production")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              deployTarget === "production" ? "bg-base-surface text-ink shadow-card" : "text-ink-faint"
            }`}
          >
            {t("deploy_target_production")}
          </button>
          <button
            type="button"
            onClick={() => setDeployTarget("preview")}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
              deployTarget === "preview" ? "bg-base-surface text-ink shadow-card" : "text-ink-faint"
            }`}
          >
            {t("deploy_target_preview")}
          </button>
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
              <Triangle size={12} fill="currentColor" strokeWidth={0} />
              {vercelStatus === "success" ? t("redeploy_button") : t("deploy_vercel")}
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

      {/* Build log สด ระหว่าง deploy กำลังทำงาน */}
      {vercelStatus === "loading" && (
        <BuildLogPanel log={liveLog} source="vercel" title={t("live_log_title")} live />
      )}

      {/* GitHub push */}
      <section className="mb-4 rounded-xl border border-base-border bg-base-surface p-4">
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

      {buildLog && vercelStatus !== "loading" && <BuildLogPanel log={buildLog} source={buildLogSource} />}

      {/* Rollback */}
      <section className="mb-4 rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <History size={13} /> {t("rollback_title")}
        </p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("rollback_desc")}</p>

        {vercelHistory.length === 0 ? (
          <p className="text-xs text-ink-faint">{t("rollback_empty")}</p>
        ) : (
          <div className="space-y-2">
            {vercelHistory.map((d, idx) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-ink">{d.url}</p>
                  <p className="text-[10px] text-ink-faint">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                {idx === 0 ? (
                  <span className="shrink-0 rounded-full border border-accent-mint/30 bg-accent-mint/10 px-2 py-1 text-[10px] text-accent-mint">
                    {t("rollback_current")}
                  </span>
                ) : (
                  <button
                    onClick={() => handleRollback(d.id)}
                    disabled={rollbackLoadingId === d.id}
                    className={`flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition active:scale-95 ${
                      rollbackConfirmId === d.id
                        ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
                        : "border-base-border bg-base-surface text-ink-dim"
                    }`}
                  >
                    {rollbackLoadingId === d.id ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <History size={11} />
                    )}
                    {rollbackConfirmId === d.id ? t("rollback_confirm") : t("rollback_button")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {rollbackMsg && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-mint">
            <CheckCircle2 size={13} /> {rollbackMsg}
          </p>
        )}
        {rollbackErr && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {rollbackErr}
          </p>
        )}
      </section>

      {/* Custom domain */}
      <section className="mb-4 rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <Globe size={13} /> {t("custom_domain_title")}
        </p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("custom_domain_desc")}</p>

        {project.custom_domain ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5">
            <span className="truncate font-mono text-sm text-ink">{project.custom_domain}</span>
            <button
              onClick={handleRemoveDomain}
              disabled={domainSaving}
              className="flex shrink-0 items-center gap-1 rounded-md border border-base-border bg-base-surface px-2.5 py-1.5 text-[11px] text-accent-red active:scale-95 transition"
            >
              {domainSaving ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              {t("custom_domain_remove_button")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder={t("custom_domain_placeholder")}
              className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5 font-mono text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              onClick={handleAddDomain}
              disabled={domainSaving || !domainInput.trim()}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-ink px-3 py-2.5 text-xs font-medium text-base-bg disabled:opacity-40 active:scale-95 transition"
            >
              {domainSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t("custom_domain_add_button")}
            </button>
          </div>
        )}
        {domainErr && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {domainErr}
          </p>
        )}
      </section>

      {/* Environment variables */}
      <section className="mb-4 rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <KeyRound size={13} /> {t("env_vars_title")}
        </p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("env_vars_desc")}</p>

        {envNotDeployed ? (
          <p className="text-xs text-ink-faint">{t("env_vars_not_deployed")}</p>
        ) : (
          <>
            {envs === null ? (
              <Loader2 size={15} className="animate-spin text-ink-faint" />
            ) : (
              <div className="mb-3 space-y-2">
                {envs.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs text-ink">{e.key}</span>
                    {envEditingId === e.id ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <input
                          value={envEditValue}
                          onChange={(ev) => setEnvEditValue(ev.target.value)}
                          placeholder={t("env_value_placeholder")}
                          className="w-28 rounded-md border border-base-border bg-base-bg px-2 py-1 font-mono text-xs text-ink focus:outline-none"
                        />
                        <button
                          onClick={() => handleSaveEnvEdit(e.id)}
                          disabled={envSaving}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-accent-mint/30 bg-accent-mint/10 text-accent-mint active:scale-95 transition"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEnvEditingId(e.id);
                            setEnvEditValue("");
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-base-border bg-base-surface text-ink-faint active:scale-95 transition"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => handleDeleteEnv(e.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-base-border bg-base-surface text-accent-red active:scale-95 transition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {envs.length === 0 && <p className="text-xs text-ink-faint">—</p>}
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <input
                value={newEnvKey}
                onChange={(e) => setNewEnvKey(e.target.value)}
                placeholder={t("env_key_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <input
                value={newEnvValue}
                onChange={(e) => setNewEnvValue(e.target.value)}
                placeholder={t("env_value_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={handleAddEnv}
                disabled={envSaving || !newEnvKey.trim() || !newEnvValue}
                className="flex shrink-0 items-center justify-center rounded-lg bg-ink p-2 text-base-bg disabled:opacity-40 active:scale-95 transition"
              >
                {envSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
