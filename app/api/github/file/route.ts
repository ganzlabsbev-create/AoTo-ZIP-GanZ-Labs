import { NextRequest, NextResponse } from "next/server";
import { getFileContent, commitFileChanges } from "@/lib/github";

export const dynamic = "force-dynamic";

/** GET ?owner=&repo=&branch=&path= — อ่านเนื้อหาไฟล์เดี่ยวๆ เป็น text */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch");
  const filePath = searchParams.get("path");
  if (!owner || !repo || !branch || !filePath) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const content = await getFileContent(owner, repo, filePath, branch);
    return NextResponse.json({ ok: true, content });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "read_file_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/**
 * POST — เพิ่ม/แก้ไข/ลบไฟล์เดี่ยวๆ ใน repo โดยตรง (ไม่ต้องอัป ZIP ทั้งก้อน)
 * body: { owner, repo, branch, path, action: "add"|"replace"|"delete", content?, message? }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const owner = body?.owner as string | undefined;
  const repo = body?.repo as string | undefined;
  const branch = body?.branch as string | undefined;
  const filePath = body?.path as string | undefined;
  const action = body?.action as "add" | "replace" | "delete" | undefined;
  const content = body?.content as string | undefined;
  const message = (body?.message as string | undefined)?.trim() || `${action} ${filePath} via GanZ Ops Manage`;

  if (!owner || !repo || !branch || !filePath || !action) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (action !== "delete" && content === undefined) {
    return NextResponse.json({ ok: false, error: "missing_content" }, { status: 400 });
  }

  try {
    const url = await commitFileChanges(
      owner,
      repo,
      branch,
      [
        action === "delete"
          ? { path: filePath, action: "delete" }
          : { path: filePath, action, content: Buffer.from(content ?? "", "utf-8") },
      ],
      message
    );
    return NextResponse.json({ ok: true, commitUrl: url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "file_commit_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
