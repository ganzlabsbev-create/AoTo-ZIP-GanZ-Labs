import { NextRequest, NextResponse } from "next/server";
import { addDomainToProject, removeDomainFromProject } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** เหมือน /api/projects/[id]/domain แต่ใช้ Vercel project id ตรงๆ ไม่ผ่าน DB — สำหรับหน้า Manage */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const domain = (body?.domain as string | undefined)?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ ok: false, error: "missing_domain" }, { status: 400 });
  }
  try {
    const result = await addDomainToProject(params.id, domain);
    return NextResponse.json({ ok: true, domain: result.name, verified: result.verified });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "add_domain_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const domain = new URL(req.url).searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ ok: false, error: "missing_domain" }, { status: 400 });
  }
  try {
    await removeDomainFromProject(params.id, domain);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "remove_domain_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
