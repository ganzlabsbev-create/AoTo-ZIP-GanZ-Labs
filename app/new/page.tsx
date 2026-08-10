"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";
import UploadZone from "@/components/UploadZone";
import FlowDiagram from "@/components/FlowDiagram";

export default function NewDeployPage() {
  const { t } = useLang();
  const router = useRouter();

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

      <h1 className="mb-1 font-display text-xl font-semibold text-ink">{t("new_deploy_page_title")}</h1>
      <p className="mb-6 text-sm text-ink-dim">{t("new_deploy_page_desc")}</p>

      <FlowDiagram />

      <section className="mt-5">
        <UploadZone
          onUploaded={(result) => {
            router.push(`/project/${result.projectId}`);
          }}
        />
      </section>
    </main>
  );
}
