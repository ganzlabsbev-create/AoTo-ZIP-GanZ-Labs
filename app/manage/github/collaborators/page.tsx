"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface Collaborator {
  login: string;
  permission: string;
  avatarUrl: string;
}

const PERMISSIONS = ["pull", "triage", "push", "maintain", "admin"] as const;

export default function CollaboratorsTab() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      }
    >
      <CollaboratorsTabInner />
    </Suspense>
  );
}

function CollaboratorsTabInner() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";

  const [collaborators, setCollaborators] = useState<Collaborator[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [permission, setPermission] = useState<(typeof PERMISSIONS)[number]>("push");
  const [adding, setAdding] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    if (!owner || !repo) return;
    setError(null);
    fetch(`/api/github/collaborators?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setCollaborators(data.collaborators);
        else setError(data.detail || data.error);
      })
      .catch((err) => setError(String(err?.message || err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  async function handleAdd() {
    if (!username.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/github/collaborators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, username: username.trim(), permission }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setUsername("");
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(login: string) {
    if (confirmRemove !== login) {
      setConfirmRemove(login);
      return;
    }
    setBusy(login);
    try {
      const res = await fetch(
        `/api/github/collaborators?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&username=${encodeURIComponent(login)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setCollaborators((prev) => (prev ? prev.filter((c) => c.login !== login) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }
  if (collaborators === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-ink-faint" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-3 text-[11px] uppercase tracking-wide text-ink-faint">{t("collaborator_add_title")}</p>
        <div className="space-y-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("collaborator_username_placeholder")}
            className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <select
            value={permission}
            onChange={(e) => setPermission(e.target.value as any)}
            className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink focus:outline-none"
          >
            {PERMISSIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={adding || !username.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2.5 text-xs font-medium text-accent-indigo active:scale-[0.98] transition disabled:opacity-40"
          >
            {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {t("collaborator_add_button")}
          </button>
        </div>
      </section>

      {collaborators.length === 0 ? (
        <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">
          {t("collaborator_empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {collaborators.map((c) => (
            <div key={c.login} className="flex items-center justify-between gap-2 rounded-xl border border-base-border bg-base-surface p-3">
              <div className="flex min-w-0 items-center gap-2">
                {c.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatarUrl} alt={c.login} className="h-8 w-8 shrink-0 rounded-full" />
                ) : (
                  <UserRound size={16} className="shrink-0 text-ink-faint" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{c.login}</p>
                  <p className="text-[10px] text-ink-faint">{c.permission}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemove(c.login)}
                disabled={busy === c.login}
                className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium transition active:scale-95 disabled:opacity-40 ${
                  confirmRemove === c.login
                    ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                    : "border-base-border bg-base-surface2 text-ink-faint"
                }`}
              >
                {busy === c.login ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
