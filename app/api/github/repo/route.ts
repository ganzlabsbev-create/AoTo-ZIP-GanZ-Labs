import { NextRequest, NextResponse } from "next/server";
import { deleteRepo } from "@/lib/github";

export const dynamic = "force-dynamic";

/** ลบ GitHub repo จริงถาวร — ใช้ query ?owner=&repo= เพราะชื่อ owner/repo มี / ไม่ได้ถ้าใช้ path param */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await deleteRepo(owner, repo);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "delete_repo_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
