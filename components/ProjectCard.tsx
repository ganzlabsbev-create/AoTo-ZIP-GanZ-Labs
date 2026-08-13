"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n-context";
import { Github, Triangle, FolderGit2, ChevronRight, Trash2, Loader2 } from "lucide-react";

export interface ProjectListItem {
  id: string;
  name: string;
  framework: string | null;
  createdAt: string;
  vercelUrl: string | null;
  githubUrl: string | null;
}

export default function ProjectCard({
  project,
  onDelete,
}: {
  project: ProjectListItem;
  onDelete?: (id: string, real: boolean) => Promise<void> | void;
}) {
  const { t } = useLang();
  const [choosing, setChoosing] = useState(false);
  const [confirmingReal, setConfirmingReal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function handleTrashClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setChoosing((v) => !v);
    setConfirmingReal(false);
  }

  async function handleHistoryOnly(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeleting(true);
    await onDelete?.(project.id, false);
  }

  async function handleReal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmingReal) {
      setConfirmingReal(true);
      return;
    }
    setDeleting(true);
    await onDelete?.(project.id, true);
  }

  return (
    <div className="group relative flex items-center gap-3 rounded-xl border border-base-border bg-base-surface px-4 py-3.5 shadow-card transition hover:border-ink-faint/40">
      <Link
        href={`/project/${project.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 active:scale-[0.99] transition"
        onClick={(e) => {
          if (choosing) {
            e.preventDefault();
            setChoosing(false);
            setConfirmingReal(false);
          }
        }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-base-border bg-base-surface2 text-accent-indigo">
          <FolderGit2 size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-medium text-ink">{project.name}</p>
          <p className="truncate text-xs text-ink-faint">{project.framework || "—"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
              project.githubUrl
                ? "border-accent-mint/30 bg-accent-mint/10 text-accent-mint"
                : "border-base-border text-ink-faint/30"
            }`}
          >
            <Github size={12} strokeWidth={2} />
          </span>
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
              project.vercelUrl
                ? "border-accent-mint/30 bg-accent-mint/10 text-accent-mint"
                : "border-base-border text-ink-faint/30"
            }`}
          >
            <Triangle size={10} strokeWidth={2} fill="currentColor" />
          </span>
          <ChevronRight
            size={15}
            strokeWidth={2}
            className="ml-0.5 text-ink-faint transition group-active:translate-x-0.5"
          />
        </div>
      </Link>

      {onDelete && !choosing && (
        <button
          onClick={handleTrashClick}
          disabled={deleting}
          className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-base-border bg-base-surface2 px-2 text-[11px] font-medium text-ink-faint transition active:scale-95"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} strokeWidth={2} />}
        </button>
      )}

      {onDelete && choosing && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={handleHistoryOnly}
            disabled={deleting}
            className="h-7 shrink-0 rounded-md border border-base-border bg-base-surface2 px-2 text-[11px] font-medium text-ink-faint transition active:scale-95"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : t("delete_btn_history_short")}
          </button>
          <button
            onClick={handleReal}
            disabled={deleting}
            title={t("delete_choice_real_desc")}
            className={`h-7 shrink-0 rounded-md border px-2 text-[11px] font-medium transition active:scale-95 ${
              confirmingReal
                ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                : "border-accent-red/25 bg-accent-red/5 text-accent-red/80"
            }`}
          >
            {confirmingReal ? t("delete_btn_confirm_short") : t("delete_btn_real_short")}
          </button>
        </div>
      )}
    </div>
  );
}
