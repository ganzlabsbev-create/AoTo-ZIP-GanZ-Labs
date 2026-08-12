import { NextRequest, NextResponse } from "next/server";
import { getProject, setCustomDomain } from "@/lib/db";
import { getVercelProjectByName, addDomainToProject, removeDomainFromProject } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** body: { domain } — ผูก custom domain เข้ากับ Vercel project (DNS ต้องไปตั้งเองที่ registrar) */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const body = await req.json().catch(() => null);
  const domain = (body?.domain as string | undefined)?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ ok: false, error: "missing_domain" }, { status: 400 });
  }

  const vercelProject = await getVercelProjectByName(project.name);
  if (!vercelProject) {
    return NextResponse.json({ ok: false, error: "not_deployed_yet" }, { status: 400 });
  }

  try {
    const result = await addDomainToProject(vercelProject.id, domain);
    await setCustomDomain(params.id, domain);
    return NextResponse.json({ ok: true, domain: result.name, verified: result.verified });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "add_domain_failed", detail: String(err?.message || err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project || !project.custom_domain) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const vercelProject = await getVercelProjectByName(project.name);
  if (!vercelProject) {
    return NextResponse.json({ ok: false, error: "not_deployed_yet" }, { status: 400 });
  }
  try {
    await removeDomainFromProject(vercelProject.id, project.custom_domain);
    await setCustomDomain(params.id, null);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "remove_domain_failed", detail: String(err?.message || err) }, { status: 500 });
  }
}
