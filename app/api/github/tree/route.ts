import { NextRequest, NextResponse } from "next/server";
import { getRepoTree } from "@/lib/github";

/** คืนรายชื่อไฟล์ปัจจุบันของ repo/branch ที่เลือก (ใช้เดี่ยวๆ ได้ นอกเหนือจาก diff-upload ที่เรียกฟังก์ชันนี้ในตัวอยู่แล้ว) */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch");

  if (!owner || !repo || !branch) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  try {
    const tree = await getRepoTree(owner, repo, branch);
    return NextResponse.json({ ok: true, tree });
  } catch (err: any) {
    console.error("get_tree_failed:", err);
    return NextResponse.json(
      { ok: false, error: "get_tree_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
