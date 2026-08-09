import { NextResponse } from "next/server";
import { listProjects, getLatestDeploymentStatus } from "@/lib/db";

export async function GET() {
  const projects = await listProjects(30);
  const withStatus = await Promise.all(
    projects.map(async (p) => {
      const status = await getLatestDeploymentStatus(p.id);
      return {
        id: p.id,
        name: p.name,
        framework: p.framework,
        createdAt: p.created_at,
        vercelUrl: status.vercel?.url ?? null,
        githubUrl: status.github?.url ?? null,
      };
    })
  );
  return NextResponse.json({ ok: true, projects: withStatus });
}
