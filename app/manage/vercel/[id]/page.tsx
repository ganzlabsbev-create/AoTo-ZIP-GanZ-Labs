"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Trash2, Plus, ExternalLink, Globe, KeyRound } from "lucide-react";
import { useLang } from "@/lib/i18n-context";
import LanguageToggle from "@/components/LanguageToggle";

interface EnvVar {
  id: string;
  key: string;
  target: string[];
}

export default function ManageVercelProjectPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [name, setName] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [envs, setEnvs] = useState<EnvVar[] | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [addingEnv, setAddingEnv] = useState(false);
  const [deletingEnvId, setDeletingEnvId] = useState<string | null>(null);

  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/vercel/projects/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setName(data.project.name);
          setUrl(data.project.url);
        } else {
          setLoadError(data.detail || data.error);
        }
      })
      .catch((err) => setLoadError(String(err?.message || err)));

    fetch(`/api/vercel/projects/${params.id}/env`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEnvs(data.envs);
      });
  }, [params.id]);

  async function handleAddEnv() {
    if (!newKey.trim()) return;
    setAddingEnv(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim(), value: newValue }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setNewKey("");
      setNewValue("");
      const refreshed = await fetch(`/api/vercel/projects/${params.id}/env`).then((r) => r.json());
      if (refreshed.ok) setEnvs(refreshed.envs);
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setAddingEnv(false);
    }
  }

  async function handleDeleteEnv(envId: string) {
    setDeletingEnvId(envId);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/env?envId=${envId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setEnvs((prev) => (prev ? prev.filter((e) => e.id !== envId) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setDeletingEnvId(null);
    }
  }

  async function handleAddDomain() {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setNewDomain("");
      alert(`${data.domain} — ${data.verified ? t("custom_domain_verified") : t("custom_domain_pending")}`);
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleDeleteProject() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      router.push("/manage");
    } catch (err: any) {
      alert(String(err?.message || err));
      setDeleting(false);
      setDeleteConfirming(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-12 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <button
          onClick={() => router.push("/manage")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-base-border bg-base-surface text-ink-dim active:scale-95 transition"
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <LanguageToggle />
      </header>

      {loadError ? (
        <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
          {loadError}
        </p>
      ) : !name ? (
        <div className="flex justify-center py-12">
          <Loader2 size={22} className="animate-spin text-ink-faint" />
        </div>
      ) : (
        <>
          <h1 className="mb-1 truncate font-display text-xl font-semibold text-ink">{name}</h1>
          {url && (
            <a
              href={`https://${url}`}
              target="_blank"
              rel="noreferrer"
              className="mb-5 inline-flex items-center gap-1 text-sm text-accent-indigo"
            >
              {url} <ExternalLink size={12} />
            </a>
          )}

          <section className="mt-4 rounded-xl border border-base-border bg-base-surface p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
              <KeyRound size={12} /> {t("manage_env_vars_title")}
            </p>
            {envs === null ? (
              <Loader2 size={16} className="animate-spin text-ink-faint" />
            ) : (
              <div className="space-y-1.5">
                {envs.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
                    <span className="truncate font-mono text-xs text-ink">{e.key}</span>
                    <button
                      onClick={() => handleDeleteEnv(e.id)}
                      disabled={deletingEnvId === e.id}
                      className="shrink-0 text-ink-faint active:scale-95 transition"
                    >
                      {deletingEnvId === e.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-1.5">
              <input
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t("env_key_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t("env_value_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={handleAddEnv}
                disabled={addingEnv || !newKey.trim()}
                className="flex shrink-0 items-center justify-center rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 px-2.5 text-accent-indigo active:scale-95 transition disabled:opacity-40"
              >
                {addingEnv ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-base-border bg-base-surface p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
              <Globe size={12} /> {t("manage_domains_title")}
            </p>
            <div className="flex gap-1.5">
              <input
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                placeholder={t("manage_domain_add_placeholder")}
                className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
              />
              <button
                onClick={handleAddDomain}
                disabled={addingDomain || !newDomain.trim()}
                className="flex shrink-0 items-center justify-center rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 px-2.5 text-accent-indigo active:scale-95 transition disabled:opacity-40"
              >
                {addingDomain ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </section>

          <section className="mt-6">
            <button
              onClick={handleDeleteProject}
              disabled={deleting}
              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium transition active:scale-[0.98] ${
                deleteConfirming
                  ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                  : "border-base-border bg-base-surface text-ink-faint"
              }`}
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleteConfirming ? t("manage_delete_confirm") : t("manage_delete_permanent_warning")}
            </button>
          </section>
        </>
      )}
    </main>
  );
}
