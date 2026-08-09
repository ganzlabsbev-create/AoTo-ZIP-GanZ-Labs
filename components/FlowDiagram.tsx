import { FileArchive, Github, Triangle } from "lucide-react";

export default function FlowDiagram() {
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className="flex items-center gap-2 rounded-xl border border-base-border bg-base-surface px-4 py-2.5">
        <FileArchive size={18} strokeWidth={2} className="text-accent-indigo" />
        <span className="font-mono text-sm text-ink-dim">project.zip</span>
      </div>

      <div className="h-5 w-px bg-base-border" />

      <div className="flex w-full max-w-xs items-start justify-between gap-4">
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-5 w-px bg-base-border" />
          <div className="flex items-center gap-1.5 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
            <Github size={16} strokeWidth={2} className="text-ink" />
            <span className="font-mono text-xs text-ink-dim">GitHub</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="h-5 w-px bg-base-border" />
          <div className="flex items-center gap-1.5 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
            <Triangle size={14} strokeWidth={2} fill="currentColor" className="text-ink" />
            <span className="font-mono text-xs text-ink-dim">Vercel</span>
          </div>
        </div>
      </div>
    </div>
  );
}
