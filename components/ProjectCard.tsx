import Link from "next/link";
import { Github, Triangle, FolderGit2, ChevronRight } from "lucide-react";

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
      className="group flex items-center gap-3 rounded-xl border border-base-border bg-base-surface px-4 py-3.5 shadow-card transition active:scale-[0.99] active:bg-base-surface2 hover:border-ink-faint/40"
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
  );
}
