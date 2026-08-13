import { NextRequest, NextResponse } from "next/server";
import {
  addDomainToProject,
  removeDomainFromProject,
  listDomainsForProject,
  setDomainRedirect,
} from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const domains = await listDomainsForProject(params.id);
    return NextResponse.json({ ok: true, domains });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_domains_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

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

/** ตั้ง/ยกเลิก redirect ของ domain นี้ไปยัง domain อื่น — body: { domain, redirectTo: string | null } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const domain = (body?.domain as string | undefined)?.trim();
  const redirectTo = (body?.redirectTo as string | null | undefined) ?? null;
  if (!domain) {
    return NextResponse.json({ ok: false, error: "missing_domain" }, { status: 400 });
  }
  try {
    await setDomainRedirect(params.id, domain, redirectTo ? redirectTo.trim() : null);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "set_redirect_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
