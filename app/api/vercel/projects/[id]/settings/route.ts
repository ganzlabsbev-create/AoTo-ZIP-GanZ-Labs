import { NextRequest, NextResponse } from "next/server";
import {
  getProjectSettings,
  updateProjectSettings,
  setProductionBranch,
  setAutoDeployEnabled,
} from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const settings = await getProjectSettings(params.id);
    return NextResponse.json({ ok: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "get_settings_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/**
 * body รองรับ 3 กรณี แยกกัน (ส่งมาทีละอย่าง):
 * - { build: { buildCommand, outputDirectory, installCommand, devCommand, rootDirectory, framework, nodeVersion } }
 * - { productionBranch: "main" }
 * - { autoDeployEnabled: true|false, branch: "main" }
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });

  try {
    if (body.build) {
      await updateProjectSettings(params.id, body.build);
    }
    if (typeof body.productionBranch === "string" && body.productionBranch.trim()) {
      await setProductionBranch(params.id, body.productionBranch.trim());
    }
    if (typeof body.autoDeployEnabled === "boolean" && typeof body.branch === "string") {
      await setAutoDeployEnabled(params.id, body.branch, body.autoDeployEnabled);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "update_settings_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
