"use client";

import { Check } from "lucide-react";

type CircleCheckboxColor = "indigo" | "mint" | "amber" | "red";

const COLOR_MAP: Record<CircleCheckboxColor, { border: string; bg: string; ring: string }> = {
  indigo: { border: "border-accent-indigo", bg: "bg-accent-indigo", ring: "shadow-glow-indigo" },
  mint: { border: "border-accent-mint", bg: "bg-accent-mint", ring: "shadow-glow-mint" },
  amber: { border: "border-accent-amber", bg: "bg-accent-amber", ring: "shadow-glow-amber" },
  red: { border: "border-accent-red", bg: "bg-accent-red", ring: "shadow-glow-red" },
};

export default function CircleCheckbox({
  checked,
  onChange,
  color = "indigo",
  size = 20,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  color?: CircleCheckboxColor;
  size?: number;
  "aria-label"?: string;
}) {
  const c = COLOR_MAP[color];

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange();
      }}
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full border-[1.5px] transition active:scale-90 ${
        checked ? `${c.bg} ${c.border} ${c.ring}` : `border-base-border bg-base-surface2 hover:border-ink-faint`
      }`}
    >
      {checked && <Check size={size * 0.65} strokeWidth={3} className="text-base-bg" />}
    </button>
  );
}
