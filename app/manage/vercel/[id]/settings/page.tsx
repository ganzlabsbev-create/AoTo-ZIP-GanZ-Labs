"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useLang } from "@/lib/i18n-context";

interface Settings {
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  devCommand: string | null;
  rootDirectory: string | null;
  framework: string | null;
  nodeVersion: string | null;
  productionBranch: string | null;
  autoDeployEnabled: boolean;
}

const NODE_VERSIONS = ["22.x", "20.x", "18.x"];

export default function VercelSettingsTab() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [togglingAuto, setTogglingAuto] = useState(false);

  const [form, setForm] = useState({
    buildCommand: "",
    outputDirectory: "",
    installCommand: "",
    devCommand: "",
    rootDirectory: "",
    framework: "",
    nodeVersion: "22.x",
  });
  const [branchInput, setBranchInput] = useState("");

  useEffect(() => {
    fetch(`/api/vercel/projects/${params.id}/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setSettings(data.settings);
          setForm({
            buildCommand: data.settings.buildCommand ?? "",
            outputDirectory: data.settings.outputDirectory ?? "",
            installCommand: data.settings.installCommand ?? "",
            devCommand: data.settings.devCommand ?? "",
            rootDirectory: data.settings.rootDirectory ?? "",
            framework: data.settings.framework ?? "",
            nodeVersion: data.settings.nodeVersion ?? "22.x",
          });
          setBranchInput(data.settings.productionBranch ?? "");
        } else {
          setError(data.detail || data.error);
        }
      })
      .catch((err) => setError(String(err?.message || err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSaveBuild() {
    setSaving(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          build: {
            buildCommand: form.buildCommand || null,
            outputDirectory: form.outputDirectory || null,
            installCommand: form.installCommand || null,
            devCommand: form.devCommand || null,
            rootDirectory: form.rootDirectory || null,
            framework: form.framework || null,
            nodeVersion: form.nodeVersion,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      alert(t("manage_saved"));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBranch() {
    if (!branchInput.trim()) return;
    setSavingBranch(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productionBranch: branchInput.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setSettings((prev) => (prev ? { ...prev, productionBranch: branchInput.trim() } : prev));
      alert(t("manage_saved"));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setSavingBranch(false);
    }
  }

  async function handleToggleAutoDeploy() {
    if (!settings?.productionBranch) return;
    const next = !settings.autoDeployEnabled;
    setTogglingAuto(true);
    try {
      const res = await fetch(`/api/vercel/projects/${params.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoDeployEnabled: next, branch: settings.productionBranch }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.detail || data.error);
      setSettings((prev) => (prev ? { ...prev, autoDeployEnabled: next } : prev));
    } catch (err: any) {
      alert(String(err?.message || err));
    } finally {
      setTogglingAuto(false);
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
        <p className="mb-3 text-[11px] uppercase tracking-wide text-ink-faint">{t("settings_build_dev_title")}</p>
        <div className="space-y-2">
          <LabeledInput label={t("settings_framework")} value={form.framework} onChange={(v) => setForm((f) => ({ ...f, framework: v }))} placeholder="nextjs" />
          <LabeledInput label={t("settings_build_command")} value={form.buildCommand} onChange={(v) => setForm((f) => ({ ...f, buildCommand: v }))} placeholder="npm run build" />
          <LabeledInput label={t("settings_dev_command")} value={form.devCommand} onChange={(v) => setForm((f) => ({ ...f, devCommand: v }))} placeholder="npm run dev" />
          <LabeledInput label={t("settings_install_command")} value={form.installCommand} onChange={(v) => setForm((f) => ({ ...f, installCommand: v }))} placeholder="npm install" />
          <LabeledInput label={t("settings_output_directory")} value={form.outputDirectory} onChange={(v) => setForm((f) => ({ ...f, outputDirectory: v }))} placeholder=".next" />
          <LabeledInput label={t("settings_root_directory")} value={form.rootDirectory} onChange={(v) => setForm((f) => ({ ...f, rootDirectory: v }))} placeholder="./" />

          <div>
            <label className="mb-1 block text-[11px] text-ink-faint">{t("settings_node_version")}</label>
            <select
              value={form.nodeVersion}
              onChange={(e) => setForm((f) => ({ ...f, nodeVersion: e.target.value }))}
              className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 text-xs text-ink focus:outline-none"
            >
              {NODE_VERSIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSaveBuild}
          disabled={saving}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 py-2.5 text-xs font-medium text-accent-indigo active:scale-[0.98] transition disabled:opacity-40"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {t("manage_save_button")}
        </button>
      </section>

      <section className="rounded-xl border border-base-border bg-base-surface p-4">
        <p className="mb-3 text-[11px] uppercase tracking-wide text-ink-faint">{t("settings_production_branch_title")}</p>
        <div className="flex gap-1.5">
          <input
            value={branchInput}
            onChange={(e) => setBranchInput(e.target.value)}
            placeholder="main"
            className="min-w-0 flex-1 rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            onClick={handleSaveBranch}
            disabled={savingBranch || !branchInput.trim()}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-accent-indigo/30 bg-accent-indigo/10 px-3 text-xs font-medium text-accent-indigo active:scale-95 transition disabled:opacity-40"
          >
            {savingBranch ? <Loader2 size={13} className="animate-spin" /> : t("manage_save_button")}
          </button>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-xl border border-base-border bg-base-surface p-4">
        <div className="min-w-0 pr-3">
          <p className="text-sm font-medium text-ink">{t("settings_auto_deploy_title")}</p>
          <p className="mt-0.5 text-[11px] text-ink-faint">{t("settings_auto_deploy_desc")}</p>
        </div>
        <button
          onClick={handleToggleAutoDeploy}
          disabled={togglingAuto || !settings.productionBranch}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
            settings.autoDeployEnabled ? "bg-accent-mint" : "bg-base-surface2 border border-base-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              settings.autoDeployEnabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </section>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-ink-faint">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-base-border bg-base-surface2 px-2.5 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none"
      />
    </div>
  );
}
