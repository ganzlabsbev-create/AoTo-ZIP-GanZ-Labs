"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Trash2,
  RotateCcw,
  GitBranch,
} from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

type RepoInfo = { name: string; full_name: string; default_branch: string; updated_at: string };
type DiffPayload = { modified: string[]; zipOnly: string[]; repoOnly: string[] };
type Action = "add" | "replace" | "delete";

function toggle(set: Set<string>, path: string): Set<string> {
  const next = new Set(set);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

export default function UpdateRepoPage() {
  const { t } = useLang();
  const router = useRouter();

  // ---- Step 1: เลือก repo ----
  const [repos, setRepos] = useState<RepoInfo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [selectedFullName, setSelectedFullName] = useState("");
  const [branch, setBranch] = useState("");

  useEffect(() => {
    fetch("/api/github/repos")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          setReposError([data.error, data.detail].filter(Boolean).join(": "));
          setRepos([]);
          return;
        }
        setRepos(data.repos);
      })
      .catch((err) => {
        setReposError(String(err?.message || err));
        setRepos([]);
      });
  }, []);

  function handleSelectRepo(fullName: string) {
    setSelectedFullName(fullName);
    const found = repos?.find((r) => r.full_name === fullName);
    setBranch(found?.default_branch || "main");
    // เปลี่ยน repo แล้ว diff เดิม (ถ้ามี) อ้างอิงคนละ repo ล้างทิ้งเพื่อไม่ให้สับสน
    resetDiffState();
  }

  // ---- Step 2: วาง ZIP + คำนวณ diff ----
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [diffStatus, setDiffStatus] = useState<"idle" | "loading" | "error">("idle");
  const [diffError, setDiffError] = useState<string | null>(null);
  const [zipBlobUrl, setZipBlobUrl] = useState<string | null>(null);
  const [repoEmpty, setRepoEmpty] = useState(false);
  const [diff, setDiff] = useState<DiffPayload | null>(null);

  // ---- Step 3: การเลือกไฟล์ต่อหมวด ----
  const [selectedReplace, setSelectedReplace] = useState<Set<string>>(new Set());
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
  const [selectedDelete, setSelectedDelete] = useState<Set<string>>(new Set());

  // ---- Step 5: commit ----
  const [commitMessage, setCommitMessage] = useState("");
  const [commitStatus, setCommitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [commitUrl, setCommitUrl] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  function resetDiffState() {
    setDiffStatus("idle");
    setDiffError(null);
    setZipBlobUrl(null);
    setRepoEmpty(false);
    setDiff(null);
    setSelectedReplace(new Set());
    setSelectedAdd(new Set());
    setSelectedDelete(new Set());
    setCommitStatus("idle");
    setCommitUrl(null);
    setCommitError(null);
    setCommitMessage("");
  }

  async function handleZipFile(file: File) {
    if (!selectedFullName) {
      setDiffError(t("choose_repo_first"));
      setDiffStatus("error");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setDiffError(t("no_zip_error"));
      setDiffStatus("error");
      return;
    }

    resetDiffState();
    setDiffStatus("loading");
    try {
      const [owner, repo] = selectedFullName.split("/");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("owner", owner);
      formData.append("repo", repo);
      formData.append("branch", branch);

      const res = await fetch("/api/github/diff-upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(": ");
        throw new Error(msg || "diff_failed");
      }

      setZipBlobUrl(data.zipBlobUrl);
      setRepoEmpty(Boolean(data.repoEmpty));
      setDiff(data.diff);
      setDiffStatus("idle");
    } catch (err: any) {
      setDiffError(String(err?.message || err));
      setDiffStatus("error");
    }
  }

  function toggleAllOfGroup(paths: string[], selected: Set<string>, setSelected: (s: Set<string>) => void) {
    if (paths.length > 0 && paths.every((p) => selected.has(p))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paths));
    }
  }

  const addCount = selectedAdd.size;
  const replaceCount = selectedReplace.size;
  const deleteCount = selectedDelete.size;
  const totalChanges = addCount + replaceCount + deleteCount;

  async function handleCommit() {
    if (!selectedFullName || !zipBlobUrl || totalChanges === 0) return;

    const changes: { path: string; action: Action }[] = [
      ...[...selectedReplace].map((path) => ({ path, action: "replace" as Action })),
      ...[...selectedAdd].map((path) => ({ path, action: "add" as Action })),
      ...[...selectedDelete].map((path) => ({ path, action: "delete" as Action })),
    ];

    setCommitStatus("loading");
    setCommitError(null);
    try {
      const [owner, repo] = selectedFullName.split("/");
      const res = await fetch("/api/github/commit-diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          branch,
          zipBlobUrl,
          changes,
          commitMessage: commitMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(": ");
        throw new Error(msg || "commit_failed");
      }
      setCommitUrl(data.url);
      setCommitStatus("success");
    } catch (err: any) {
      setCommitError(String(err?.message || err));
      setCommitStatus("error");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-16 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <LanguageToggle />
      </header>

      <h1 className="mb-1 font-display text-xl font-semibold text-ink">{t("update_repo_page_title")}</h1>
      <p className="mb-6 text-sm text-ink-dim">{t("update_repo_page_desc")}</p>

      {/* Step 1: เลือก repo */}
      <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
        <label className="mb-1.5 block text-xs font-medium text-ink-dim">{t("select_repo_label")}</label>

        {repos === null ? (
          <p className="flex items-center gap-2 text-sm text-ink-faint">
            <Loader2 size={14} className="animate-spin" /> {t("loading_repos")}
          </p>
        ) : reposError ? (
          <p className="flex items-center gap-1.5 text-xs text-accent-red">
            <XCircle size={13} /> {t("load_repos_failed")}: {reposError}
          </p>
        ) : repos.length === 0 ? (
          <p className="text-sm text-ink-faint">{t("no_repos")}</p>
        ) : (
          <select
            value={selectedFullName}
            onChange={(e) => handleSelectRepo(e.target.value)}
            className="w-full rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5 font-mono text-sm text-ink focus:outline-none"
          >
            <option value="">{t("select_repo_placeholder")}</option>
            {repos.map((r) => (
              <option key={r.full_name} value={r.full_name}>
                {r.full_name}
              </option>
            ))}
          </select>
        )}

        {selectedFullName && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5">
            <GitBranch size={13} className="shrink-0 text-ink-faint" />
            <span className="text-xs text-ink-faint">{t("branch_label")}</span>
            <input
              value={branch}
              onChange={(e) => {
                setBranch(e.target.value);
                resetDiffState();
              }}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink focus:outline-none"
            />
          </div>
        )}
      </section>

      {/* Step 2: อัพโหลด ZIP */}
      {selectedFullName && (
        <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
          <p className="mb-1 text-xs font-medium text-ink-dim">{t("upload_new_zip_title")}</p>
          <p className="mb-3 text-[11px] text-ink-faint">{t("upload_new_zip_desc")}</p>

          <div
            onClick={() => zipInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleZipFile(file);
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition active:scale-[0.99] ${
              isDragging ? "border-accent-indigo bg-accent-indigo/5" : "border-base-border bg-base-surface2"
            }`}
          >
            {diffStatus === "loading" ? (
              <>
                <Loader2 size={26} strokeWidth={2} className="animate-spin text-accent-indigo" />
                <p className="text-sm text-ink-dim">{t("analyzing_diff")}</p>
              </>
            ) : (
              <>
                <UploadCloud size={26} strokeWidth={1.75} className="text-ink-dim" />
                <span className="rounded-lg bg-accent-indigo px-4 py-2 text-sm font-medium text-white">
                  {t("choose_zip_button")}
                </span>
              </>
            )}
          </div>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleZipFile(file);
              e.target.value = "";
            }}
          />

          {diffStatus === "error" && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
              <XCircle size={13} /> {diffError}
            </p>
          )}
          {repoEmpty && diff && (
            <p className="mt-3 text-xs text-ink-faint">{t("repo_empty_hint")}</p>
          )}
        </section>
      )}

      {/* Step 3: หมวดไฟล์ + checkbox */}
      {diff && (
        <>
          <DiffGroup
            title={t("group_modified_title")}
            color="orange"
            paths={diff.modified}
            selected={selectedReplace}
            onToggle={(p) => setSelectedReplace((s) => toggle(s, p))}
            onToggleAll={() => toggleAllOfGroup(diff.modified, selectedReplace, setSelectedReplace)}
            selectAllLabel={t("select_all")}
            deselectAllLabel={t("deselect_all")}
            emptyLabel={t("group_empty")}
          />

          <DiffGroup
            title={t("group_added_title")}
            color="green"
            paths={diff.zipOnly}
            selected={selectedAdd}
            onToggle={(p) => setSelectedAdd((s) => toggle(s, p))}
            onToggleAll={() => toggleAllOfGroup(diff.zipOnly, selectedAdd, setSelectedAdd)}
            selectAllLabel={t("select_all")}
            deselectAllLabel={t("deselect_all")}
            emptyLabel={t("group_empty")}
          />

          <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-ink-dim">
              <span className="h-2 w-2 shrink-0 rounded-full bg-ink-faint" /> {t("group_removed_title")}
            </p>
            {diff.repoOnly.length === 0 ? (
              <p className="text-xs text-ink-faint">{t("group_empty")}</p>
            ) : (
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {diff.repoOnly.map((p) => {
                  const marked = selectedDelete.has(p);
                  return (
                    <div
                      key={p}
                      className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 ${
                        marked ? "bg-accent-red/10" : ""
                      }`}
                    >
                      <span
                        className={`min-w-0 flex-1 truncate font-mono text-xs ${
                          marked ? "text-accent-red line-through" : "text-ink-dim"
                        }`}
                      >
                        {p}
                      </span>
                      <button
                        onClick={() => setSelectedDelete((s) => toggle(s, p))}
                        className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition active:scale-95 ${
                          marked
                            ? "border-accent-red/30 bg-accent-red/10 text-accent-red"
                            : "border-base-border bg-base-surface2 text-ink-faint"
                        }`}
                      >
                        {marked ? (
                          <>
                            <RotateCcw size={11} /> {t("unmark_delete")}
                          </>
                        ) : (
                          <>
                            <Trash2 size={11} /> {t("mark_delete")}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Step 4: สรุป + commit message */}
          <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
            <p className="mb-2 text-xs font-medium text-ink-dim">{t("diff_summary_title")}</p>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-accent-mint/10 px-2.5 py-1 text-accent-mint">
                {t("summary_add")} {addCount} {t("summary_files")}
              </span>
              <span className="rounded-full bg-accent-amber/10 px-2.5 py-1 text-accent-amber">
                {t("summary_replace")} {replaceCount} {t("summary_files")}
              </span>
              <span className="rounded-full bg-accent-red/10 px-2.5 py-1 text-accent-red">
                {t("summary_delete")} {deleteCount} {t("summary_files")}
              </span>
            </div>

            <label className="mb-1.5 block text-xs font-medium text-ink-dim">
              {t("commit_message_label")}
            </label>
            <input
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={t("commit_message_placeholder")}
              className="mb-4 w-full rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            />

            <button
              onClick={handleCommit}
              disabled={commitStatus === "loading" || totalChanges === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-base-bg disabled:opacity-40 active:scale-[0.98] transition"
            >
              {commitStatus === "loading" ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> {t("committing")}
                </>
              ) : (
                t("confirm_commit_button")
              )}
            </button>

            {totalChanges === 0 && commitStatus === "idle" && (
              <p className="mt-2 text-center text-[11px] text-ink-faint">{t("no_changes_selected")}</p>
            )}

            {commitStatus === "success" && commitUrl && (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-sm text-accent-mint"
              >
                <CheckCircle2 size={14} /> {t("view_commit")} <ExternalLink size={12} />
              </a>
            )}
            {commitStatus === "error" && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-accent-red">
                <XCircle size={13} /> {commitError}
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function DiffGroup({
  title,
  color,
  paths,
  selected,
  onToggle,
  onToggleAll,
  selectAllLabel,
  deselectAllLabel,
  emptyLabel,
}: {
  title: string;
  color: "orange" | "green";
  paths: string[];
  selected: Set<string>;
  onToggle: (path: string) => void;
  onToggleAll: () => void;
  selectAllLabel: string;
  deselectAllLabel: string;
  emptyLabel: string;
}) {
  const dotClass = color === "orange" ? "bg-accent-amber" : "bg-accent-mint";
  const allSelected = paths.length > 0 && paths.every((p) => selected.has(p));

  return (
    <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-ink-dim">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} /> {title}
        </p>
        {paths.length > 0 && (
          <button
            onClick={onToggleAll}
            className="shrink-0 rounded-md border border-base-border bg-base-surface2 px-2 py-1 text-[11px] text-ink-dim active:scale-95 transition"
          >
            {allSelected ? deselectAllLabel : selectAllLabel}
          </button>
        )}
      </div>

      {paths.length === 0 ? (
        <p className="text-xs text-ink-faint">{emptyLabel}</p>
      ) : (
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {paths.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5">
              <input
                type="checkbox"
                checked={selected.has(p)}
                onChange={() => onToggle(p)}
                className="shrink-0 accent-accent-indigo"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-dim">{p}</span>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
