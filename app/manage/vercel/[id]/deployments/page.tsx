"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, ExternalLink, Trash2, ArrowUpCircle, RotateCw, XCircle } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface Deployment {
  uid: string;
  url: string;
  name: string;
  target: string | null;
  state: string;
  created: number;
}

function stateColor(state: string) {
  switch (state) {
    case "READY":
      return "text-accent-mint border-accent-mint/30 bg-accent-mint/10";
    case "ERROR":
    case "CANCELED":
      return "text-accent-red border-accent-red/30 bg-accent-red/10";
    case "BUILDING":
    case "QUEUED":
    case "INITIALIZING":
      return "text-accent-indigo border-accent-indigo/30 bg-accent-indigo/10";
    default:
      return "text-ink-faint border-base-border bg-base-surface2";
  }
}

export default function DeploymentsTab() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();

  const [items, setItems] = useState<Deployment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch(`/api/vercel/projects/${params.id}/deployments`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setItems(data.deployments);
        else setError(data.detail || data.error);
      })
      .catch((err) => setError(String(err?.message || err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handlePromote(uid: string) {
    setBusyId(uid);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/deployments/${uid}/promote`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleRedeploy(d: Deployment) {
    setBusyId(d.uid);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/deployments/${d.uid}/redeploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: d.name, target: d.target || "production" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(uid: string) {
    setBusyId(uid);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/deployments/${uid}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(uid: string) {
    if (confirmDeleteId !== uid) {
      setConfirmDeleteId(uid);
      return;
    }
    setBusyId(uid);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/deployments/${uid}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setItems((prev) => (prev ? prev.filter((d) => d.uid !== uid) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyId(null);
      setConfirmDeleteId(null);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }
  if (items === null) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={20} className="animate-spin text-ink-faint" />
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-base-border px-4 py-6 text-center text-sm text-ink-faint">{t("deployments_empty")}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((d) => {
        const busy = busyId === d.uid;
        const canCancel = d.state === "BUILDING" || d.state === "QUEUED" || d.state === "INITIALIZING";
        return (
          <div key={d.uid} className="rounded-xl border border-base-border bg-base-surface p-3.5 shadow-card">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <a
                  href={`https://${d.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 truncate text-xs font-medium text-ink-dim"
                >
                  <span className="truncate">{d.url}</span>
                  <ExternalLink size={11} className="shrink-0" />
                </a>
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  {d.target === "production" ? t("deployment_target_production") : t("deployment_target_preview")}
                  {" · "}
                  {new Date(d.created).toLocaleString()}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${stateColor(d.state)}`}>
                {d.state}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {d.target !== "production" && d.state === "READY" && (
                <button
                  onClick={() => handlePromote(d.uid)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md border border-accent-mint/30 bg-accent-mint/10 px-2 py-1 text-[11px] font-medium text-accent-mint active:scale-95 transition disabled:opacity-40"
                >
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <ArrowUpCircle size={11} />}
                  {t("deployment_promote")}
                </button>
              )}
              <button
                onClick={() => handleRedeploy(d)}
                disabled={busy}
                className="flex items-center gap-1 rounded-md border border-accent-indigo/30 bg-accent-indigo/10 px-2 py-1 text-[11px] font-medium text-accent-indigo active:scale-95 transition disabled:opacity-40"
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <RotateCw size={11} />}
                {t("deployment_redeploy")}
              </button>
              {canCancel && (
                <button
                  onClick={() => handleCancel(d.uid)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded-md border border-base-border bg-base-surface2 px-2 py-1 text-[11px] font-medium text-ink-faint active:scale-95 transition disabled:opacity-40"
                >
                  {busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                  {t("deployment_cancel")}
                </button>
              )}
              <button
                onClick={() => handleDelete(d.uid)}
                disabled={busy}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition active:scale-95 disabled:opacity-40 ${
                  confirmDeleteId === d.uid
                    ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                    : "border-base-border bg-base-surface2 text-ink-faint"
                }`}
              >
                {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                {confirmDeleteId === d.uid ? t("manage_delete_confirm") : t("deployment_delete")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
