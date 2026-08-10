import { NextResponse } from "next/server";
import { listRepos } from "@/lib/github";

/** คืนรายชื่อ repo ทั้งหมดของ org/user ที่ token ผูกไว้ ให้ dropdown เลือก repo ในหน้า /update-repo */
export async function GET() {
  try {
    const repos = await listRepos();
    return NextResponse.json({ ok: true, repos });
  } catch (err: any) {
    console.error("list_repos_failed:", err);
    return NextResponse.json(
      { ok: false, error: "list_repos_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
