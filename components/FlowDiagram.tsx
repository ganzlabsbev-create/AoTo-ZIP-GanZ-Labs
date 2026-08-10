import { FileArchive, Github, Triangle, ArrowRight } from "lucide-react";

export default function FlowDiagram() {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-base-border bg-base-surface/60 px-3 py-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 px-2.5 py-1.5">
        <FileArchive size={14} strokeWidth={2} className="text-accent-indigo" />
        <span className="font-mono text-xs text-ink">project.zip</span>
      </div>

      <ArrowRight size={13} strokeWidth={2} className="shrink-0 text-ink-faint" />

      <div className="flex items-center gap-1 rounded-lg border border-base-border bg-base-surface2 px-2 py-1.5">
        <Github size={13} strokeWidth={2} className="text-ink-dim" />
        <span className="font-mono text-[11px] text-ink-dim">GitHub</span>
      </div>

      <span className="font-mono text-[10px] text-ink-faint">/</span>

      <div className="flex items-center gap-1 rounded-lg border border-base-border bg-base-surface2 px-2 py-1.5">
        <Triangle size={11} strokeWidth={2} fill="currentColor" className="text-ink-dim" />
        <span className="font-mono text-[11px] text-ink-dim">Vercel</span>
      </div>
    </div>
  );
}
