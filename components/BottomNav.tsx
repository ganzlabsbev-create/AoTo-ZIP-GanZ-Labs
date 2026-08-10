"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Settings } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

export default function BottomNav() {
  const { t } = useLang();
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { href: "/", label: t("nav_home"), icon: Home },
    { href: "/settings", label: t("nav_settings"), icon: Settings },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-base-border bg-base-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 active:scale-95 transition"
            >
              {active && (
                <span className="absolute top-0 h-[2px] w-8 rounded-full bg-accent-indigo shadow-glow-indigo" />
              )}
              <Icon
                size={19}
                strokeWidth={active ? 2.4 : 2}
                className={active ? "text-accent-indigo" : "text-ink-faint"}
              />
              <span className={`text-[10px] font-medium ${active ? "text-ink" : "text-ink-faint"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
