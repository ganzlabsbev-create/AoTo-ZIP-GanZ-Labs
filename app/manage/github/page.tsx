"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  ExternalLink,
  FileIcon,
  X,
  Save,
} from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

interface TreeEntry {
  path: string;
  sha: string;
}

export default function ManageGithubRepoPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
          <Loader2 size={22} className="animate-spin text-ink-faint" />
        </main>
      }
    >
      <ManageGithubRepoInner />
    </Suspense>
  );
}

function ManageGithubRepoInner() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";
  const branch = searchParams.get("branch") || "main";

  const [tree, setTree] = useState<TreeEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [openPath, setOpenPath] = useState<string | null>(null);
  const [openContent, setOpenContent] = useState("");
  const [openLoading, setOpenLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileDeleteConfirming, setFileDeleteConfirming] = useState(false);
  const [fileDeleting, setFileDeleting] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addPath, setAddPath] = useState("");
  const [addContent, setAddContent] = useState("");
  const [adding, setAdding] = useState(false);

  const [repoDeleteConfirming, setRepoDeleteConfirming] = useState(false);
  const [repoDeleting, setRepoDeleting] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, branch]);

  function loadTree() {
    setTree(null);
    fetch(`/api/github/tree?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setTree(data.tree);
        else setLoadError(data.detail || data.error);
      })
      .catch((err) => setLoadError(String(err?.message || err)));
  }

  async function openFile(path: string) {
    setOpenPath(path);
    setOpenLoading(true);
    setFileDeleteConfirming(false);
    try {
      const res = await fetch(
        `/api/github/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setOpenContent(data.content);
    } catch (err: any) {
      alert(String(err?.message || err));
      setOpenPath(null);
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleSaveFile() {
    if (!openPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/github/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, path: openPath, action: "replace", content: openContent }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setOpenPath(null);
      loadTree();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFile() {
    if (!openPath) return;
    if (!fileDeleteConfirming) {
      setFileDeleteConfirming(true);
      return;
    }
    setFileDeleting(true);
    try {
      const res = await fetch("/api/github/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, path: openPath, action: "delete" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setOpenPath(null);
      loadTree();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setFileDeleting(false);
      setFileDeleteConfirming(false);
    }
  }

  async function handleAddFile() {
    if (!addPath.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/github/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, path: addPath.trim(), action: "add", content: addContent }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setAddPath("");
      setAddContent("");
      setShowAddForm(false);
      loadTree();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteRepo() {
    if (!repoDeleteConfirming) {
      setRepoDeleteConfirming(true);
      return;
    }
    setRepoDeleting(true);
    try {
      const res = await fetch(`/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      router.push("/manage");
    } catch (err: any) {
      alert(String(err?.message || err));
      setRepoDeleting(false);
      setRepoDeleteConfirming(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <button
          onClick={() => router.push("/manage")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <LanguageToggle />
      </header>

      <h1 className="mb-1 truncate font-display text-xl font-semibold text-ink">
        {owner}/{repo}
      </h1>
      <a
        href={`https://github.com/${owner}/${repo}`}
        target="_blank"
        rel="noreferrer"
        className="mb-5 inline-flex items-center gap-1 text-sm text-accent-indigo"
      >
        {branch} <ExternalLink size={12} />
      </a>

      <section className="mt-2 rounded-xl border border-base-border bg-base-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wide text-ink-faint">{t("manage_file_tree_title")}</p>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1 rounded-md border border-accent-indigo/30 bg-accent-indigo/10 px-2 py-1 text-[11px] font-medium text-accent-indigo active:scale-95 transition"
          >
            <Plus size={12} /> {t("manage_add_file_button")}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-3 space-y-1.5 rounded-lg border border-base-border bg-base-surface2 p-2.5">
            <input
              value={addPath}
              onChange={(e) => setAddPath(e.target.value)}
              placeholder={t("manage_add_file_path_placeholder")}
              className="w-full rounded-md border border-base-border bg-base-surface px-2 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <textarea
              value={addContent}
              onChange={(e) => setAddContent(e.target.value)}
              placeholder={t("manage_add_file_content_placeholder")}
              rows={4}
              className="w-full rounded-md border border-base-border bg-base-surface px-2 py-1.5 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              onClick={handleAddFile}
              disabled={adding || !addPath.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-mint/30 bg-accent-mint/10 py-1.5 text-xs font-medium text-accent-mint active:scale-95 transition disabled:opacity-40"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {t("manage_add_file_confirm")}
            </button>
          </div>
        )}

        {loadError ? (
          <p className="text-center text-xs text-accent-red">{loadError}</p>
        ) : tree === null ? (
          <div className="flex justify-center py-6">
            <Loader2 size={18} className="animate-spin text-ink-faint" />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-center text-xs text-ink-faint">{t("repo_empty_hint")}</p>
        ) : (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto">
            {tree.map((f) => (
              <button
                key={f.path}
                onClick={() => openFile(f.path)}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left font-mono text-xs text-ink-dim active:bg-base-surface2 transition"
              >
                <FileIcon size={12} className="shrink-0 text-ink-faint" />
                <span className="truncate">{f.path}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <button
          onClick={handleDeleteRepo}
          disabled={repoDeleting}
          className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium transition active:scale-[0.98] ${
            repoDeleteConfirming
              ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
              : "border-base-border bg-base-surface text-ink-faint"
          }`}
        >
          {repoDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {repoDeleteConfirming ? t("manage_delete_confirm") : t("manage_delete_permanent_warning")}
        </button>
      </section>

      {openPath && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 px-4 pb-4 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-2xl border border-base-border bg-base-bg shadow-card">
            <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
              <p className="truncate font-mono text-xs text-ink">{openPath}</p>
              <button onClick={() => setOpenPath(null)} className="shrink-0 text-ink-faint active:scale-95 transition">
                <X size={16} />
              </button>
            </div>
            <div className="p-4">
              {openLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-ink-faint" />
                </div>
              ) : (
                <>
                  <textarea
                    value={openContent}
                    onChange={(e) => setOpenContent(e.target.value)}
                    rows={12}
                    className="w-full rounded-lg border border-base-border bg-base-surface2 p-2.5 font-mono text-xs text-ink focus:outline-none"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={handleSaveFile}
                      disabled={saving}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2.5 text-xs font-medium text-accent-indigo active:scale-[0.98] transition disabled:opacity-40"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {t("manage_file_save")}
                    </button>
                    <button
                      onClick={handleDeleteFile}
                      disabled={fileDeleting}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-40 ${
                        fileDeleteConfirming
                          ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                          : "border-base-border bg-base-surface2 text-ink-faint"
                      }`}
                    >
                      {fileDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      {fileDeleteConfirming ? t("manage_file_delete_confirm") : t("manage_file_delete")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
