import { NextResponse } from "next/server";
import { listProjects, getLatestDeploymentStatus } from "@/lib/db";

// สำคัญ: ห้ามให้ Next.js แคช route นี้แบบ static เด็ดขาด
// เพราะไม่ได้ใช้ cookies/headers เลย Next.js จะเข้าใจผิดว่าเป็นหน้า static
// แล้ว cache ผลลัพธ์ไว้ตั้งแต่ build/deploy ครั้งแรก ทำให้ "Recent Projects"
// ไม่อัพเดตจนกว่าจะมี deploy ใหม่มา reset cache
export const dynamic = "force-dynamic";

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
