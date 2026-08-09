import Link from "next/link";
import { Github, Triangle, FolderGit2 } from "lucide-react";

export interface ProjectListItem {
  id: string;
  name: string;
  framework: string | null;
  createdAt: string;
  vercelUrl: string | null;
  githubUrl: string | null;
}

export default function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link
      href={`/project/${project.id}`}
      className="flex items-center gap-3 rounded-xl border border-base-border bg-base-surface px-4 py-3.5 active:bg-base-surface2 transition"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-base-surface2 text-ink-dim">
        <FolderGit2 size={18} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{project.name}</p>
        <p className="truncate text-xs text-ink-faint">{project.framework || "—"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            project.githubUrl ? "text-accent-mint" : "text-ink-faint/40"
          }`}
        >
          <Github size={14} strokeWidth={2} />
        </span>
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-md ${
            project.vercelUrl ? "text-accent-mint" : "text-ink-faint/40"
          }`}
        >
          <Triangle size={11} strokeWidth={2} fill="currentColor" />
        </span>
      </div>
    </Link>
  );
}
