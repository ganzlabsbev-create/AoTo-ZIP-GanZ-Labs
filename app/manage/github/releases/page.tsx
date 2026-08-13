"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Tag, ExternalLink } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface Release {
  id: number;
  tagName: string;
  name: string | null;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string | null;
  htmlUrl: string;
}

export default function ReleasesTab() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      }
    >
      <ReleasesTabInner />
    </Suspense>
  );
}

function ReleasesTabInner() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";
  const branch = searchParams.get("branch") || "main";

  const [releases, setReleases] = useState<Release[] | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [tagMode, setTagMode] = useState<"existing" | "new">("new");
  const [selectedTag, setSelectedTag] = useState("");
  const [newTag, setNewTag] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [prerelease, setPrerelease] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    fetch(`/api/github/releases?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setReleases(data.releases);
          setTags(data.tags);
        } else {
          setError(data.detail || data.error);
        }
      })
      .catch((err) => setError(String(err?.message || err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  async function handleCreate() {
    const tagName = tagMode === "existing" ? selectedTag : newTag.trim();
    if (!tagName) return;
    setCreating(true);
    try {
      const res = await fetch("/api/github/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner,
          repo,
          tagName,
          name: title || tagName,
          body,
          prerelease,
          ...(tagMode === "new" ? { targetCommitish: branch } : {}),
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setReleases((prev) => (prev ? [data.release, ...prev] : [data.release]));
      setShowCreate(false);
      setNewTag("");
      setTitle("");
      setBody("");
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }
  if (releases === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowCreate((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2.5 text-xs font-medium text-accent-indigo active:scale-[0.98] transition"
      >
        <Plus size={13} /> {t("release_create_button")}
      </button>

      {showCreate && (
        <div className="space-y-2 rounded-lg border border-base-border bg-base-surface2 p-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => setTagMode("new")}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
                tagMode === "new" ? "border-accent-indigo/40 bg-accent-indigo/10 text-accent-indigo" : "border-base-border text-ink-faint"
              }`}
            >
              {t("release_new_tag")}
            </button>
            <button
              onClick={() => setTagMode("existing")}
              disabled={tags.length === 0}
              className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition disabled:opacity-40 ${
                tagMode === "existing" ? "border-accent-indigo/40 bg-accent-indigo/10 text-accent-indigo" : "border-base-border text-ink-faint"
              }`}
            >
              {t("release_existing_tag")}
            </button>
          </div>

          {tagMode === "new" ? (
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="v1.0.0"
              className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
          ) : (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 text-xs text-ink focus:outline-none"
            >
              <option value="">—</option>
              {tags.map((tg) => (
                <option key={tg} value={tg}>{tg}</option>
              ))}
            </select>
          )}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("release_title_placeholder")}
            className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("release_notes_placeholder")}
            rows={3}
            className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <label className="flex items-center gap-2 text-[11px] text-ink-dim">
            <input type="checkbox" checked={prerelease} onChange={(e) => setPrerelease(e.target.checked)} />
            {t("release_prerelease_label")}
          </label>

          <button
            onClick={handleCreate}
            disabled={creating || (tagMode === "new" ? !newTag.trim() : !selectedTag)}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-mint/30 bg-accent-mint/10 py-2 text-xs font-medium text-accent-mint active:scale-95 transition disabled:opacity-40"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {t("release_create_confirm")}
          </button>
        </div>
      )}

      {releases.length === 0 ? (
        <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">
          {t("release_empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {releases.map((r) => (
            <a
              key={r.id}
              href={r.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 rounded-xl border border-base-border bg-base-surface p-3.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="shrink-0 text-ink-faint" />
                  <span className="truncate text-xs font-medium text-ink">{r.name || r.tagName}</span>
                  {r.prerelease && (
                    <span className="shrink-0 rounded-full border border-accent-amber/30 bg-accent-amber/10 px-1.5 py-0.5 text-[9px] text-accent-amber">
                      pre
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                  {r.tagName}
                  {r.publishedAt && ` · ${new Date(r.publishedAt).toLocaleDateString()}`}
                </p>
              </div>
              <ExternalLink size={13} className="shrink-0 text-ink-faint" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
