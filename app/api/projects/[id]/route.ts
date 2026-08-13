import { NextRequest, NextResponse } from "next/server";
import { getProject, getDeploymentsForProject, deleteProject } from "@/lib/db";
import { getVercelProjectByName, deleteVercelProject } from "@/lib/vercel";
import { deleteRepo } from "@/lib/github";

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

/**
 * ลบโปรเจกต์
 * - โหมดปกติ: ลบแค่ประวัติในแอปนี้ (Recent Projects) เหมือนเดิม
 * - ?real=1: ลบของจริงด้วย — ทั้ง Vercel project (ถ้าเคย deploy) และ GitHub repo (ถ้าเคย push)
 *   แต่ละส่วนพยายามลบแยกกัน ถ้าอันไหนพังไม่ให้บล็อกอันอื่น แล้วรายงานผลกลับไปทุกส่วน
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getProject(params.id);
  if (!project) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const wantsReal = new URL(req.url).searchParams.get("real") === "1";
  const result: { vercel?: string; github?: string } = {};

  if (wantsReal) {
    try {
      const vercelProject = await getVercelProjectByName(project.name);
      if (vercelProject) {
        await deleteVercelProject(vercelProject.id);
        result.vercel = "deleted";
      } else {
        result.vercel = "not_found";
      }
    } catch (err: any) {
      result.vercel = `failed: ${String(err?.message || err)}`;
    }

    try {
      const deployments = await getDeploymentsForProject(params.id);
      const githubDeploy = deployments.find((d) => d.target === "github" && d.url);
      const match = githubDeploy?.url?.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (match) {
        await deleteRepo(match[1], match[2]);
        result.github = "deleted";
      } else {
        result.github = "not_found";
      }
    } catch (err: any) {
      result.github = `failed: ${String(err?.message || err)}`;
    }
  }

  await deleteProject(params.id);
  return NextResponse.json({ ok: true, real: wantsReal, result });
}
