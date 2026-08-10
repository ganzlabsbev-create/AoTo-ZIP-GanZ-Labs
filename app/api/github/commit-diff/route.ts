import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { extractZip } from "@/lib/zip";
import { newExtractDir } from "@/lib/paths";
import { fetchZipBlob } from "@/lib/blob";
import { commitFileChanges, FileChange } from "@/lib/github";

interface IncomingChange {
  path: string;
  action: "add" | "replace" | "delete";
}

/**
 * รับรายการไฟล์ที่ผู้ใช้ติ๊ก/เลือกไว้แล้ว (add/replace/delete) + zipBlobUrl จากขั้น diff-upload
 * แตก ZIP อีกรอบในเครื่องของ request นี้ (ดึงจาก Blob ไม่พึ่ง /tmp เดิม) แล้วสร้าง commit เดียว
 * ผ่าน commitFileChanges ที่ใช้ base_tree — ไฟล์ที่ไม่ได้เลือกจะยังอยู่ใน repo เหมือนเดิมอัตโนมัติ
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const owner = (body.owner as string | undefined)?.trim();
  const repo = (body.repo as string | undefined)?.trim();
  const branch = (body.branch as string | undefined)?.trim();
  const zipBlobUrl = body.zipBlobUrl as string | undefined;
  const changes = body.changes as IncomingChange[] | undefined;
  const commitMessage =
    (body.commitMessage as string | undefined)?.trim() || "Update files via Project Uploader";

  if (!owner || !repo || !branch || !zipBlobUrl) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  // กัน path traversal / path แปลกๆ ที่หลุดมาจาก client
  const isSafePath = (p: unknown): p is string =>
    typeof p === "string" && p.length > 0 && !p.startsWith("/") && !p.split("/").includes("..");
  if (!changes.every((c) => isSafePath(c.path) && ["add", "replace", "delete"].includes(c.action))) {
    return NextResponse.json({ ok: false, error: "invalid_changes" }, { status: 400 });
  }

  try {
    const zipBuffer = await fetchZipBlob(zipBlobUrl);
    const extractDir = newExtractDir(`commit-${nanoid(6)}`);
    extractZip(zipBuffer, extractDir);

    const fileChanges: FileChange[] = changes.map((c) => {
      if (c.action === "delete") {
        return { path: c.path, action: "delete" };
      }
      const abs = path.join(extractDir, c.path);
      if (!abs.startsWith(extractDir) || !fs.existsSync(abs)) {
        throw new Error(`ไม่พบไฟล์ "${c.path}" ใน ZIP ที่อัพโหลดไว้ (ลองอัพโหลดใหม่อีกครั้ง)`);
      }
      return { path: c.path, action: c.action, content: fs.readFileSync(abs) };
    });

    const url = await commitFileChanges(owner, repo, branch, fileChanges, commitMessage);
    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    console.error("commit_diff_failed:", err);
    const detail = String(err?.message || err);
    return NextResponse.json({ ok: false, error: "commit_failed", detail }, { status: 500 });
  }
}
