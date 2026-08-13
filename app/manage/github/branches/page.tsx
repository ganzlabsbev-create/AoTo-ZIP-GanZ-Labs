"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, Trash2, GitBranch, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface Branch {
  name: string;
  isDefault: boolean;
  protected: boolean;
}

interface ProtectionSettings {
  requirePullRequestReviews: boolean;
  requiredApprovingReviewCount: number;
  requireStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
}

export default function BranchesTab() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      }
    >
      <BranchesTabInner />
    </Suspense>
  );
}

function BranchesTabInner() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const owner = searchParams.get("owner") || "";
  const repo = searchParams.get("repo") || "";

  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState("");
  const [creating, setCreating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyBranch, setBusyBranch] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [protection, setProtection] = useState<Record<string, ProtectionSettings>>({});
  const [protectionConfirm, setProtectionConfirm] = useState<string | null>(null);

  function load() {
    if (!owner || !repo) return;
    setError(null);
    fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setBranches(data.branches);
          const def = data.branches.find((b: Branch) => b.isDefault);
          if (def) setFromBranch(def.name);
        } else {
          setError(data.detail || data.error);
        }
      })
      .catch((err) => setError(String(err?.message || err)));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  async function handleCreate() {
    if (!newBranchName.trim() || !fromBranch) return;
    setCreating(true);
    try {
      const res = await fetch("/api/github/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, newBranch: newBranchName.trim(), fromBranch }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setNewBranchName("");
      setShowCreate(false);
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setCreating(false);
    }
  }

  const defaultBranchName = branches?.find((b) => b.isDefault)?.name;

  async function handleDelete(name: string) {
    if (confirmDelete !== name) {
      setConfirmDelete(name);
      return;
    }
    setBusyBranch(name);
    try {
      const res = await fetch(
        `/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(name)}&defaultBranch=${encodeURIComponent(defaultBranchName || "")}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setBranches((prev) => (prev ? prev.filter((b) => b.name !== name) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyBranch(null);
      setConfirmDelete(null);
    }
  }

  async function loadProtection(name: string) {
    if (protection[name]) return;
    const res = await fetch(
      `/api/github/branches/protection?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(name)}`
    );
    const data = await res.json();
    if (data.ok) setProtection((prev) => ({ ...prev, [name]: data.settings }));
  }

  function toggleExpand(name: string) {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    loadProtection(name);
  }

  async function saveProtection(name: string) {
    const settings = protection[name];
    if (!settings) return;
    const isDefault = name === defaultBranchName;
    if (isDefault && protectionConfirm !== name) {
      setProtectionConfirm(name);
      return;
    }
    setBusyBranch(name);
    try {
      const res = await fetch("/api/github/branches/protection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, branch: name, settings }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      load();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setBusyBranch(null);
      setProtectionConfirm(null);
    }
  }

  if (error) {
    return (
      <p className="rounded-xl border border-accent-red/30 bg-accent-red/5 px-4 py-6 text-center text-sm text-accent-red">
        {t("manage_load_failed")}: {error}
      </p>
    );
  }
  if (branches === null) {
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
        <Plus size={13} /> {t("branch_create_button")}
      </button>

      {showCreate && (
        <div className="space-y-2 rounded-lg border border-base-border bg-base-surface2 p-3">
          <input
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder={t("branch_new_name_placeholder")}
            className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <select
            value={fromBranch}
            onChange={(e) => setFromBranch(e.target.value)}
            className="w-full rounded-md border border-base-border bg-base-surface px-2.5 py-2 text-xs text-ink focus:outline-none"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {t("branch_from_prefix")} {b.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating || !newBranchName.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-accent-mint/30 bg-accent-mint/10 py-2 text-xs font-medium text-accent-mint active:scale-95 transition disabled:opacity-40"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {t("branch_create_confirm")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {branches.map((b) => (
          <div key={b.name} className="rounded-xl border border-base-border bg-base-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <button onClick={() => toggleExpand(b.name)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <GitBranch size={13} className="shrink-0 text-ink-faint" />
                <span className="truncate font-mono text-xs text-ink">{b.name}</span>
                {b.isDefault && (
                  <span className="shrink-0 rounded-full border border-accent-indigo/30 bg-accent-indigo/10 px-1.5 py-0.5 text-[9px] font-medium text-accent-indigo">
                    {t("branch_default_label")}
                  </span>
                )}
                {b.protected && <ShieldCheck size={11} className="shrink-0 text-accent-mint" />}
                {expanded === b.name ? (
                  <ChevronUp size={13} className="ml-auto shrink-0 text-ink-faint" />
                ) : (
                  <ChevronDown size={13} className="ml-auto shrink-0 text-ink-faint" />
                )}
              </button>
              {!b.isDefault && (
                <button
                  onClick={() => handleDelete(b.name)}
                  disabled={busyBranch === b.name}
                  className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium transition active:scale-95 disabled:opacity-40 ${
                    confirmDelete === b.name
                      ? "border-accent-red/40 bg-accent-red/10 text-accent-red"
                      : "border-base-border bg-base-surface2 text-ink-faint"
                  }`}
                >
                  {busyBranch === b.name ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              )}
            </div>

            {expanded === b.name && (
              <div className="mt-3 space-y-2 border-t border-base-border pt-3">
                {!protection[b.name] ? (
                  <Loader2 size={14} className="animate-spin text-ink-faint" />
                ) : (
                  <>
                    <ToggleRow
                      label={t("branch_require_pr_review")}
                      checked={protection[b.name].requirePullRequestReviews}
                      onChange={(v) =>
                        setProtection((prev) => ({ ...prev, [b.name]: { ...prev[b.name], requirePullRequestReviews: v } }))
                      }
                    />
                    <ToggleRow
                      label={t("branch_require_status_checks")}
                      checked={protection[b.name].requireStatusChecks}
                      onChange={(v) =>
                        setProtection((prev) => ({ ...prev, [b.name]: { ...prev[b.name], requireStatusChecks: v } }))
                      }
                    />
                    <button
                      onClick={() => saveProtection(b.name)}
                      disabled={busyBranch === b.name}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-md border py-2 text-[11px] font-medium transition active:scale-95 disabled:opacity-40 ${
                        protectionConfirm === b.name
                          ? "border-accent-amber/40 bg-accent-amber/10 text-accent-amber"
                          : "border-accent-indigo/30 bg-accent-indigo/10 text-accent-indigo"
                      }`}
                    >
                      {busyBranch === b.name ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      {b.isDefault && protectionConfirm === b.name
                        ? t("manage_delete_confirm")
                        : t("branch_save_protection")}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-[11px] text-ink-dim">{label}</p>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-accent-mint" : "bg-base-surface2 border border-base-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
