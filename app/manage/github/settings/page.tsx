"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface RepoSettings {
  description: string | null;
  topics: string[];
  private: boolean;
  archived: boolean;
  defaultBranch: string;
}

export default function GithubSettingsTab() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      }
    >
      <GithubSettingsTabInner />
    </Suspense>
  );
}

function GithubSettingsTabInner() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";

  const [settings, setSettings] = useState<RepoSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [savingBasic, setSavingBasic] = useState(false);

  const [visibilityConfirm, setVisibilityConfirm] = useState(false);
  const [busyVisibility, setBusyVisibility] = useState(false);
  const [busyArchive, setBusyArchive] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!owner || !repo) return;
    fetch(`/api/github/settings?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSettings(data.settings);
          setDescription(data.settings.description ?? "");
          setTopics(data.settings.topics ?? []);
        } else {
          setError(data.detail || data.error);
        }
      })
      .catch((err) => setError(String(err?.message || err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  function addTopic() {
    const v = topicInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (!v || topics.includes(v)) return;
    setTopics((prev) => [...prev, v]);
    setTopicInput("");
  }

  async function handleSaveBasic() {
    setSavingBasic(true);
    try {
      const res = await fetch("/api/github/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, description, topics }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      alert(t("manage_saved"));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSavingBasic(false);
    }
  }

  async function handleToggleVisibility() {
    if (!settings) return;
    if (!visibilityConfirm) {
      setVisibilityConfirm(true);
      return;
    }
    setBusyVisibility(true);
    try {
      const res = await fetch("/api/github/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, private: !settings.private }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setSettings((prev) => (prev ? { ...prev, private: !prev.private } : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyVisibility(false);
      setVisibilityConfirm(false);
    }
  }

  async function handleToggleArchive() {
    if (!settings) return;
    setBusyArchive(true);
    try {
      const res = await fetch("/api/github/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, archived: !settings.archived }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setSettings((prev) => (prev ? { ...prev, archived: !prev.archived } : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyArchive(false);
    }
  }

  async function handleDeleteRepo() {
    if (deleteConfirmText !== repo) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      router.push("/manage");
    } catch (err: any) {
      alert(String(err?.message || err));
      setDeleting(false);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }
  if (!settings) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-3 text-[11px] uppercase tracking-wide text-ink-faint">{t("repo_settings_basic_title")}</p>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] text-ink-faint">{t("repo_settings_description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-ink-faint">{t("repo_settings_topics")}</label>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {topics.map((tpc) => (
                <span
                  key={tpc}
                  className="flex items-center gap-1 rounded-full border border-accent-indigo/30 bg-accent-indigo/10 px-2 py-0.5 text-[10px] text-accent-indigo"
                >
                  {tpc}
                  <button onClick={() => setTopics((prev) => prev.filter((x) => x !== tpc))}>
                    <X size={9} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                placeholder={t("repo_settings_topics_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={addTopic}
                className="shrink-0 rounded-lg border border-base-border bg-base-surface2 px-3 text-xs font-medium text-ink-faint active:scale-95 transition"
              >
                +
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveBasic}
          disabled={savingBasic}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2.5 text-xs font-medium text-accent-indigo active:scale-[0.98] transition disabled:opacity-40"
        >
          {savingBasic ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {t("manage_save_button")}
        </button>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-base-border bg-base-surface p-4">
        <div className="min-w-0 pr-3">
          <p className="text-sm font-medium text-ink">{t("repo_settings_archive_title")}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{t("repo_settings_archive_desc")}</p>
        </div>
        <button
          onClick={handleToggleArchive}
          disabled={busyArchive}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
            settings.archived ? "bg-accent-amber" : "bg-base-surface2 border border-base-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              settings.archived ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </section>

      <section className="rounded-xl border border-accent-amber/30 bg-accent-amber/5 p-4">
        <p className="mb-1 text-sm font-medium text-accent-amber">{t("repo_settings_visibility_title")}</p>
        <p className="mb-3 text-[11px] text-ink-faint">
          {settings.private ? t("repo_settings_visibility_private_desc") : t("repo_settings_visibility_public_desc")}
        </p>
        <button
          onClick={handleToggleVisibility}
          disabled={busyVisibility}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-40 ${
            visibilityConfirm
              ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
              : "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
          }`}
        >
          {busyVisibility ? <Loader2 size={13} className="animate-spin" /> : null}
          {visibilityConfirm
            ? t("manage_delete_confirm")
            : settings.private
            ? t("repo_settings_make_public")
            : t("repo_settings_make_private")}
        </button>
      </section>

      <section className="rounded-xl border border-accent-red/30 bg-accent-red/5 p-4">
        <p className="mb-1 text-sm font-medium text-accent-red">{t("repo_settings_danger_title")}</p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("repo_settings_danger_desc")}</p>
        <input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={repo}
          className="mb-2 w-full rounded-lg border border-accent-red/30 bg-base-surface px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          onClick={handleDeleteRepo}
          disabled={deleting || deleteConfirmText !== repo}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-red/40 bg-accent-red/10 py-2.5 text-xs font-medium text-accent-red active:scale-[0.98] transition disabled:opacity-40"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          {t("repo_settings_delete_button")}
        </button>
      </section>
    </div>
  );
}
