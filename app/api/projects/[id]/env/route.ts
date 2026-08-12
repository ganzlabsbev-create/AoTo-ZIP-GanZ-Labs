import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { getVercelProjectByName, listEnvVars, createEnvVar, updateEnvVar, deleteEnvVar } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** ต้อง deploy ขึ้น Vercel อย่างน้อย 1 ครั้งก่อน ถึงจะมี Vercel Project ให้แก้ env var ได้ */
async function resolveVercelProjectId(appProjectId: string) {
  const project = await getProject(appProjectId);
  if (!project) return { error: "not_found" as const };
  const vercelProject = await getVercelProjectByName(project.name);
  if (!vercelProject) return { error: "not_deployed_yet" as const };
  return { vercelProjectId: vercelProject.id };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveVercelProjectId(params.id);
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  try {
    const envs = await listEnvVars(resolved.vercelProjectId);
    return NextResponse.json({ ok: true, envs });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "list_env_failed", detail: String(err?.message || err) }, { status: 500 });
  }
}

/** body: { key, value, envId? } — ถ้ามี envId คือแก้ค่าเดิม ถ้าไม่มีคือสร้างใหม่ */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveVercelProjectId(params.id);
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const key = (body?.key as string | undefined)?.trim();
  const value = body?.value as string | undefined;
  const envId = body?.envId as string | undefined;

  if (!key || value === undefined) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  try {
    if (envId) {
      await updateEnvVar(resolved.vercelProjectId, envId, value);
    } else {
      await createEnvVar(resolved.vercelProjectId, key, value);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "save_env_failed", detail: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const resolved = await resolveVercelProjectId(params.id);
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 404 });
  }
  const envId = req.nextUrl.searchParams.get("envId");
  if (!envId) {
    return NextResponse.json({ ok: false, error: "missing_env_id" }, { status: 400 });
  }
  try {
    await deleteEnvVar(resolved.vercelProjectId, envId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "delete_env_failed", detail: String(err?.message || err) }, { status: 500 });
  }
}
