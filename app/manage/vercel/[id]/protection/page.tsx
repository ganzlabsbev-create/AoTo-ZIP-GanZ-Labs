"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

export default function ProtectionTab() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmingEnable, setConfirmingEnable] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/vercel/projects/${params.id}/protection`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEnabled(data.enabled);
        else setError(data.detail || data.error);
      })
      .catch((err) => setError(String(err?.message || err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleEnable() {
    if (!password.trim()) return;
    if (!confirmingEnable) {
      setConfirmingEnable(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setEnabled(true);
      setPassword("");
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSaving(false);
      setConfirmingEnable(false);
    }
  }

  async function handleDisable() {
    if (!confirmingDisable) {
      setConfirmingDisable(true);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/protection`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setEnabled(false);
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSaving(false);
      setConfirmingDisable(false);
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

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
          <ShieldCheck size={12} /> {t("protection_title")}
        </p>
        <p className="mb-3 text-[11px] text-ink-faint">{t("protection_desc")}</p>

        {enabled === null ? (
          <Loader2 size={16} className="animate-spin text-ink-faint" />
        ) : enabled ? (
          <button
            onClick={handleDisable}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-40 ${
              confirmingDisable
                ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                : "border-base-border bg-base-surface2 text-ink-dim"
            }`}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {confirmingDisable ? t("manage_delete_confirm") : t("protection_disable_button")}
          </button>
        ) : (
          <div className="space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("protection_password_placeholder")}
              className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <button
              onClick={handleEnable}
              disabled={saving || !password.trim()}
              className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-2.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-40 ${
                confirmingEnable
                  ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
                  : "border-accent-indigo/30 bg-accent-indigo/10 text-accent-indigo"
              }`}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {confirmingEnable ? t("manage_delete_confirm") : t("protection_enable_button")}
            </button>
          </div>
        )}
      </section>

      <section>
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
    </div>
  );
}
