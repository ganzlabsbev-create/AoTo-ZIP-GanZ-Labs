"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  UploadCloud,
  CheckCircle2,
  XCircle,
  ExternalLink,
  GitBranch,
  Github,
  ChevronRight,
  Pencil,
  Folder,
  File as FileIcon,
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

  // รวม 3 หมวดเป็นต้นไม้เดียว (โฟลเดอร์สีม่วง, ไฟล์สีตามสถานะ) — คำนวณใหม่เฉพาะตอน diff เปลี่ยน
  const diffTree = useMemo(() => {
    if (!diff) return [];
    const items: { path: string; status: DiffStatus }[] = [
      ...diff.modified.map((p) => ({ path: p, status: "modified" as DiffStatus })),
      ...diff.zipOnly.map((p) => ({ path: p, status: "add" as DiffStatus })),
      ...diff.repoOnly.map((p) => ({ path: p, status: "unchanged" as DiffStatus })),
    ];
    return buildDiffTree(items);
  }, [diff]);

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

      {/* Step 1: เลือก repo — โชว์รายการทั้งหมดเลย แตะแถวเพื่อเลือก ไม่ต้องกด dropdown */}
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
        ) : selectedFullName ? (
          // เลือกแล้ว: โชว์สรุป repo ที่เลือก + ปุ่มเปลี่ยน แทนที่จะโชว์ทั้งลิสต์ค้างไว้
          <div className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Github size={15} strokeWidth={2} className="shrink-0 text-ink-dim" />
              <span className="truncate font-mono text-sm text-ink">{selectedFullName}</span>
            </div>
            <button
              onClick={() => {
                setSelectedFullName("");
                resetDiffState();
              }}
              className="flex shrink-0 items-center gap-1 rounded-md border border-base-border bg-base-surface px-2 py-1 text-[11px] text-ink-dim active:scale-95 transition"
            >
              <Pencil size={11} /> {t("change_repo")}
            </button>
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {repos.map((r) => (
              <button
                key={r.full_name}
                onClick={() => handleSelectRepo(r.full_name)}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2.5 text-left active:scale-[0.98] transition"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Github size={15} strokeWidth={2} className="shrink-0 text-ink-faint" />
                  <span className="truncate font-mono text-sm text-ink">{r.full_name}</span>
                </div>
                <ChevronRight size={15} strokeWidth={2} className="shrink-0 text-ink-faint" />
              </button>
            ))}
          </div>
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

      {/* Step 3: ต้นไม้ไฟล์รวม (โฟลเดอร์สีม่วง, ไฟล์สีตามสถานะ, ติ๊กอยู่ขวา) */}
      {diff && (
        <>
          <section className="mb-5 rounded-xl border border-base-border bg-base-surface p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-ink-dim">{t("diff_tree_title")}</p>
              <div className="ml-auto flex flex-wrap gap-2">
                {diff.modified.length > 0 && (
                  <button
                    onClick={() => toggleAllOfGroup(diff.modified, selectedReplace, setSelectedReplace)}
                    className="flex items-center gap-1.5 rounded-md border border-accent-amber/30 bg-accent-amber/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-amber active:scale-95 transition"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-amber" />
                    {diff.modified.every((p) => selectedReplace.has(p)) ? t("deselect_all") : t("select_all")}
                  </button>
                )}
                {diff.zipOnly.length > 0 && (
                  <button
                    onClick={() => toggleAllOfGroup(diff.zipOnly, selectedAdd, setSelectedAdd)}
                    className="flex items-center gap-1.5 rounded-md border border-accent-mint/30 bg-accent-mint/10 px-2.5 py-1.5 text-[11px] font-medium text-accent-mint active:scale-95 transition"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mint" />
                    {diff.zipOnly.every((p) => selectedAdd.has(p)) ? t("deselect_all") : t("select_all")}
                  </button>
                )}
              </div>
            </div>

            {repoEmpty && <p className="mb-3 text-xs text-ink-faint">{t("repo_empty_hint")}</p>}

            {diffTree.length === 0 ? (
              <p className="text-xs text-ink-faint">{t("group_empty")}</p>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto">
                <DiffTreeView
                  nodes={diffTree}
                  selectedReplace={selectedReplace}
                  selectedAdd={selectedAdd}
                  selectedDelete={selectedDelete}
                  onToggleReplace={(p) => setSelectedReplace((s) => toggle(s, p))}
                  onToggleAdd={(p) => setSelectedAdd((s) => toggle(s, p))}
                  onToggleDelete={(p) => setSelectedDelete((s) => toggle(s, p))}
                />
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

type DiffStatus = "modified" | "add" | "unchanged";

interface DiffTreeNode {
  name: string;
  fullPath: string;
  type: "dir" | "file";
  status?: DiffStatus;
  children?: DiffTreeNode[];
}

/** รวม path จาก 3 หมวด (modified/add/unchanged) เป็นต้นไม้เดียว โฟลเดอร์ก่อน ไฟล์ทีหลัง เรียงตามชื่อ */
function buildDiffTree(items: { path: string; status: DiffStatus }[]): DiffTreeNode[] {
  const root: DiffTreeNode[] = [];

  for (const item of items) {
    const segments = item.path.split("/").filter(Boolean);
    let level = root;
    let acc = "";

    segments.forEach((seg, idx) => {
      acc = acc ? `${acc}/${seg}` : seg;
      const isFile = idx === segments.length - 1;
      let node = level.find((n) => n.name === seg && n.type === (isFile ? "file" : "dir"));
      if (!node) {
        node = isFile
          ? { name: seg, fullPath: acc, type: "file", status: item.status }
          : { name: seg, fullPath: acc, type: "dir", children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    });
  }

  sortDiffTree(root);
  return root;
}

function sortDiffTree(nodes: DiffTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach((n) => n.children && sortDiffTree(n.children));
}

/**
 * ต้นไม้ไฟล์แบบใหญ่/ชัด สำหรับหน้าอัพเดตไฟล์เข้า repo โดยเฉพาะ (แยกจาก TreeView ของหน้า deploy zip เดิม)
 * โฟลเดอร์ = สีม่วง (accent-indigo) ไม่มี checkbox
 * ไฟล์ = สีตามสถานะ ทั้งไอคอนและชื่อ, checkbox อยู่ขวาสุดของแถว
 *   - 🟠 modified (อยู่ทั้งใน repo และ zip) ติ๊ก = แทนที่
 *   - 🟢 add (มีแค่ใน zip) ติ๊ก = เพิ่มใหม่
 *   - เทา unchanged (มีแค่ใน repo) ติ๊ก = ทำเครื่องหมายลบ → กลายเป็นสีแดงขีดฆ่า
 */
function DiffTreeView({
  nodes,
  depth = 0,
  selectedReplace,
  selectedAdd,
  selectedDelete,
  onToggleReplace,
  onToggleAdd,
  onToggleDelete,
}: {
  nodes: DiffTreeNode[];
  depth?: number;
  selectedReplace: Set<string>;
  selectedAdd: Set<string>;
  selectedDelete: Set<string>;
  onToggleReplace: (path: string) => void;
  onToggleAdd: (path: string) => void;
  onToggleDelete: (path: string) => void;
}) {
  return (
    <div style={{ paddingLeft: depth ? 16 : 0 }}>
      {nodes.map((n) => {
        if (n.type === "dir") {
          return (
            <div key={n.fullPath}>
              <div className="flex items-center gap-2 py-2">
                <Folder size={16} strokeWidth={2} className="shrink-0 text-accent-indigo" />
                <span className="truncate font-mono text-sm font-medium text-accent-indigo">{n.name}</span>
              </div>
              {n.children && n.children.length > 0 && (
                <DiffTreeView
                  nodes={n.children}
                  depth={depth + 1}
                  selectedReplace={selectedReplace}
                  selectedAdd={selectedAdd}
                  selectedDelete={selectedDelete}
                  onToggleReplace={onToggleReplace}
                  onToggleAdd={onToggleAdd}
                  onToggleDelete={onToggleDelete}
                />
              )}
            </div>
          );
        }

        const isMarkedDelete = n.status === "unchanged" && selectedDelete.has(n.fullPath);
        const checked =
          n.status === "modified"
            ? selectedReplace.has(n.fullPath)
            : n.status === "add"
              ? selectedAdd.has(n.fullPath)
              : selectedDelete.has(n.fullPath);

        const colorClass =
          n.status === "modified"
            ? "text-accent-amber"
            : n.status === "add"
              ? "text-accent-mint"
              : isMarkedDelete
                ? "text-accent-red line-through"
                : "text-ink-dim";

        const accentClass =
          n.status === "modified"
            ? "accent-accent-amber"
            : n.status === "add"
              ? "accent-accent-mint"
              : "accent-accent-red";

        function handleToggle() {
          if (n.status === "modified") onToggleReplace(n.fullPath);
          else if (n.status === "add") onToggleAdd(n.fullPath);
          else onToggleDelete(n.fullPath);
        }

        return (
          <label
            key={n.fullPath}
            className={`flex cursor-pointer items-center gap-2 rounded-lg py-2.5 pl-1 pr-2 transition ${
              isMarkedDelete ? "bg-accent-red/5" : checked ? "bg-base-surface2" : ""
            }`}
          >
            <FileIcon size={16} strokeWidth={2} className={`shrink-0 ${colorClass}`} />
            <span className={`min-w-0 flex-1 truncate font-mono text-sm ${colorClass}`}>{n.name}</span>
            <input
              type="checkbox"
              checked={checked}
              onChange={handleToggle}
              className={`h-[18px] w-[18px] shrink-0 ${accentClass}`}
            />
          </label>
        );
      })}
    </div>
  );
}
