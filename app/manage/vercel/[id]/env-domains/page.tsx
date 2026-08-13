"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Trash2, Plus, Globe, KeyRound, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface EnvVar {
  id: string;
  key: string;
  target: string[];
}
interface DomainItem {
  name: string;
  verified: boolean;
  redirect: string | null;
}

const TARGETS = ["production", "preview", "development"] as const;

export default function EnvDomainsTab() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();

  const [envs, setEnvs] = useState<EnvVar[] | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newTargets, setNewTargets] = useState<string[]>(["production", "preview", "development"]);
  const [addingEnv, setAddingEnv] = useState(false);
  const [deletingEnvId, setDeletingEnvId] = useState<string | null>(null);

  const [domains, setDomains] = useState<DomainItem[] | null>(null);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [domainBusy, setDomainBusy] = useState<string | null>(null);
  const [redirectDrafts, setRedirectDrafts] = useState<Record<string, string>>({});

  function loadEnvs() {
    fetch(`/api/vercel/projects/${params.id}/env`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setEnvs(data.envs);
      });
  }

  function loadDomains() {
    fetch(`/api/vercel/projects/${params.id}/domains`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setDomains(data.domains);
      });
  }

  useEffect(() => {
    loadEnvs();
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function toggleNewTarget(target: string) {
    setNewTargets((prev) => (prev.includes(target) ? prev.filter((x) => x !== target) : [...prev, target]));
  }

  async function handleAddEnv() {
    if (!newKey.trim() || newTargets.length === 0) return;
    setAddingEnv(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/env`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim(), value: newValue, target: newTargets }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setNewKey("");
      setNewValue("");
      loadEnvs();
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
      loadDomains();
      alert(`${data.domain} — ${data.verified ? t("custom_domain_verified") : t("custom_domain_pending")}`);
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleRemoveDomain(domain: string) {
    setDomainBusy(domain);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/domains?domain=${encodeURIComponent(domain)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setDomains((prev) => (prev ? prev.filter((d) => d.name !== domain) : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setDomainBusy(null);
    }
  }

  async function handleSetRedirect(domain: string) {
    const target = (redirectDrafts[domain] ?? "").trim();
    setDomainBusy(domain);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/domains`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, redirectTo: target || null }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      loadDomains();
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setDomainBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
          <KeyRound size={12} /> {t("manage_env_vars_title")}
        </p>
        {envs === null ? (
          <Loader2 size={16} className="animate-spin text-ink-faint" />
        ) : (
          <div className="space-y-1.5">
            {envs.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-base-border bg-base-surface2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs text-ink">{e.key}</p>
                  <p className="mt-0.5 truncate text-[10px] text-ink-faint">{e.target.join(", ")}</p>
                </div>
                <button
                  onClick={() => handleDeleteEnv(e.id)}
                  disabled={deletingEnvId === e.id}
                  className="shrink-0 text-ink-faint active:scale-95 transition"
                >
                  {deletingEnvId === e.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 space-y-1.5">
          <div className="flex gap-1.5">
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
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TARGETS.map((target) => (
              <button
                key={target}
                onClick={() => toggleNewTarget(target)}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium transition ${
                  newTargets.includes(target)
                    ? "border-accent-indigo/40 bg-accent-indigo/10 text-accent-indigo"
                    : "border-base-border bg-base-surface2 text-ink-faint"
                }`}
              >
                {target}
              </button>
            ))}
          </div>
          <button
            onClick={handleAddEnv}
            disabled={addingEnv || !newKey.trim() || newTargets.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2 text-xs font-medium text-accent-indigo active:scale-95 transition disabled:opacity-40"
          >
            {addingEnv ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {t("env_add_button")}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-faint">
          <Globe size={12} /> {t("manage_domains_title")}
        </p>

        {domains === null ? (
          <Loader2 size={16} className="animate-spin text-ink-faint" />
        ) : (
          <div className="mb-3 space-y-2">
            {domains.map((d) => (
              <div key={d.name} className="rounded-lg border border-base-border bg-base-surface2 p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">{d.name}</p>
                    <p className="text-[10px] text-ink-faint">
                      {d.verified ? t("custom_domain_verified") : t("custom_domain_pending")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveDomain(d.name)}
                    disabled={domainBusy === d.name}
                    className="shrink-0 text-ink-faint active:scale-95 transition"
                  >
                    {domainBusy === d.name ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowRight size={11} className="shrink-0 text-ink-faint" />
                  <input
                    value={redirectDrafts[d.name] ?? d.redirect ?? ""}
                    onChange={(e) => setRedirectDrafts((prev) => ({ ...prev, [d.name]: e.target.value }))}
                    placeholder={t("domain_redirect_placeholder")}
                    className="min-w-0 flex-1 rounded-md border border-base-border bg-base-surface px-2 py-1.5 text-[11px] text-ink placeholder:text-ink-faint focus:outline-none"
                  />
                  <button
                    onClick={() => handleSetRedirect(d.name)}
                    disabled={domainBusy === d.name}
                    className="shrink-0 rounded-md border border-accent-indigo/30 bg-accent-indigo/10 px-2 py-1.5 text-[11px] font-medium text-accent-indigo active:scale-95 transition disabled:opacity-40"
                  >
                    {t("manage_save_button")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
    </div>
  );
}
