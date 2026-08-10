"use client";

import { ChevronRight, LucideIcon } from "lucide-react";

export default function ToolCard({
  icon: Icon,
  title,
  description,
  color = "indigo",
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  color?: "indigo" | "mint";
  onClick: () => void;
}) {
  const colorClasses =
    color === "mint"
      ? "border-accent-mint/25 bg-accent-mint/10 text-accent-mint"
      : "border-accent-indigo/25 bg-accent-indigo/10 text-accent-indigo";

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-base-border bg-base-surface p-4 text-left shadow-card transition active:scale-[0.98] hover:border-ink-faint/40"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${colorClasses}`}>
        <Icon size={20} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-semibold text-ink">{title}</p>
        <p className="truncate text-xs text-ink-faint">{description}</p>
      </div>
      <ChevronRight
        size={16}
        strokeWidth={2}
        className="shrink-0 text-ink-faint transition group-active:translate-x-0.5"
      />
    </button>
  );
}
