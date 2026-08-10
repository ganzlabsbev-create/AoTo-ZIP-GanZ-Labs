"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

export default function UploadZone({
  onUploaded,
}: {
  onUploaded: (result: any) => void;
}) {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setDragging] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError(t("no_zip_error"));
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.ok) {
        const msg = [data.error, data.detail].filter(Boolean).join(": ");
        throw new Error(msg || "upload_failed");
      }
      onUploaded(data);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed px-6 py-12 text-center transition active:scale-[0.99] ${
          isDragging
            ? "border-accent-indigo bg-accent-indigo/5 shadow-glow-indigo"
            : "border-base-border bg-base-surface hover:border-ink-faint/50"
        }`}
      >
        {isUploading ? (
          <Loader2 size={28} strokeWidth={2} className="animate-spin text-accent-indigo" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-base-border bg-base-surface2 text-ink-dim">
            <UploadCloud size={22} strokeWidth={1.75} />
          </div>
        )}
        <p className="font-display text-base font-medium text-ink">
          {isUploading ? t("upload_uploading") : t("upload_title")}
        </p>
        {!isUploading && (
          <>
            <span className="text-xs text-ink-faint">{t("upload_or")}</span>
            <span className="rounded-lg bg-accent-indigo px-4 py-2 text-sm font-medium text-base-bg shadow-glow-indigo">
              {t("upload_button")}
            </span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-2 text-sm text-accent-red">{error}</p>}
    </div>
  );
}
