import { NextRequest, NextResponse } from "next/server";
import { getProject, getDeploymentsForProject, deleteProject } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const deployments = await getDeploymentsForProject(params.id);
  return NextResponse.json({
    ok: true,
    project: {
      ...project,
      file_tree: project.file_tree ? JSON.parse(project.file_tree) : [],
    },
    deployments,
  });
}

/** ลบโปรเจกต์ออกจากประวัติในแอปนี้ (ไม่ลบ deployment จริงบน Vercel/repo บน GitHub นะ แค่เอาออกจาก Recent Projects) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  await deleteProject(params.id);
  return NextResponse.json({ ok: true });
}
