import { NextRequest, NextResponse } from "next/server";
import { listEnvVars, createEnvVar, updateEnvVar, deleteEnvVar } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/**
 * เหมือน /api/projects/[id]/env แต่ใช้ Vercel project id ตรงๆ แทนที่จะพึ่ง DB ของแอปนี้
 * เพื่อให้หน้า Manage จัดการ env var ของ project ไหนก็ได้ในบัญชี ไม่ใช่แค่ที่ deploy ผ่านแอปนี้
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const envs = await listEnvVars(params.id);
    return NextResponse.json({ ok: true, envs });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_env_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const key = (body?.key as string | undefined)?.trim();
  const value = body?.value as string | undefined;
  if (!key || value === undefined) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await createEnvVar(params.id, key, value);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "create_env_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const envId = body?.envId as string | undefined;
  const value = body?.value as string | undefined;
  if (!envId || value === undefined) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await updateEnvVar(params.id, envId, value);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "update_env_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const envId = new URL(req.url).searchParams.get("envId");
  if (!envId) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await deleteEnvVar(params.id, envId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "delete_env_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
