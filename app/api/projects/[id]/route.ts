import { NextRequest, NextResponse } from "next/server";
import { getProject, getDeploymentsForProject } from "@/lib/db";

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
