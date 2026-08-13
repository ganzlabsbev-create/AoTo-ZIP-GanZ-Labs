import { NextRequest, NextResponse } from "next/server";
import { deleteVercelProject, getVercelProjectById } from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const project = await getVercelProjectById(params.id);
    if (!project) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true, project });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "get_project_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/** ลบ Vercel project จริงถาวร ไม่ผ่าน DB ของแอปเลย (ใช้จากหน้า Manage กับ project ไหนก็ได้ในบัญชี) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteVercelProject(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "delete_project_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
