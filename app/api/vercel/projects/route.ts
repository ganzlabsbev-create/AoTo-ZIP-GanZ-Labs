import { NextResponse } from "next/server";
import { listVercelProjects } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** คืนรายชื่อ Vercel project ทั้งหมดในบัญชี ไม่ใช่แค่ที่เคย deploy ผ่านแอปนี้ — ใช้ในหน้า Manage */
export async function GET() {
  try {
    const projects = await listVercelProjects();
    return NextResponse.json({ ok: true, projects });
  } catch (err: any) {
    console.error("list_vercel_projects_failed:", err);
    return NextResponse.json(
      { ok: false, error: "list_projects_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
