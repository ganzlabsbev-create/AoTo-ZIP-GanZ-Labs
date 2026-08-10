import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { extractZip, listAllFiles } from "@/lib/zip";
import { newExtractDir } from "@/lib/paths";
import { storeZipBlob } from "@/lib/blob";
import { getRepoTree } from "@/lib/github";

const MAX_ZIP_SIZE_MB = Number(process.env.MAX_ZIP_SIZE_MB || 50);

/**
 * รับ ZIP โปรเจกต์ใหม่ + repo/branch ที่เลือก แล้วคำนวณ diff เป็น 3 หมวด:
 * modified (อยู่ทั้งคู่, path ตรงกัน), zipOnly (มีแค่ใน zip), repoOnly (มีแค่ใน repo)
 *
 * ไฟล์ ZIP ที่อัพมาจะถูกเก็บไว้ที่ Vercel Blob (ไม่ใช่ /tmp) แล้วส่ง zipBlobUrl กลับไปให้ client
 * เก็บไว้ เพราะ /tmp ของ request นี้อาจไม่ใช่เครื่องเดียวกับตอนกด "ยืนยัน commit" บน serverless
 * — ตอน commit ให้ client ส่ง zipBlobUrl นี้กลับมาที่ /api/github/commit-diff อีกที
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;
  const owner = formData?.get("owner")?.toString().trim();
  const repo = formData?.get("repo")?.toString().trim();
  const branch = formData?.get("branch")?.toString().trim();

  if (!owner || !repo || !branch) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ ok: false, error: "not_zip" }, { status: 400 });
  }
  if (file.size > MAX_ZIP_SIZE_MB * 1024 * 1024) {
    return NextResponse.json(
      { ok: false, error: "too_large", maxMb: MAX_ZIP_SIZE_MB },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sessionId = `diff-${nanoid(10)}`;

  let zipFiles: string[];
  try {
    const extractDir = newExtractDir(sessionId);
    extractZip(buffer, extractDir);
    zipFiles = listAllFiles(extractDir);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "extract_failed", detail: String(err?.message || err) },
      { status: 400 }
    );
  }

  if (zipFiles.length === 0) {
    return NextResponse.json({ ok: false, error: "empty_zip" }, { status: 400 });
  }

  try {
    const repoTree = await getRepoTree(owner, repo, branch);
    const repoPaths = new Set(repoTree.map((f) => f.path));
    const zipPaths = new Set(zipFiles);

    const modified = zipFiles.filter((p) => repoPaths.has(p)).sort(); // 🟠 อยู่ทั้งคู่
    const zipOnly = zipFiles.filter((p) => !repoPaths.has(p)).sort(); // 🟢 มีแค่ใน zip
    const repoOnly = [...repoPaths].filter((p) => !zipPaths.has(p)).sort(); // ⚪ มีแค่ใน repo

    // path ที่มี ".." หรือขึ้นต้นด้วย "/" ตัดทิ้งจากทุกหมวด กัน path traversal ตอนสร้าง blob/commit ทีหลัง
    const isSafePath = (p: string) => !p.startsWith("/") && !p.split("/").includes("..");
    const safeModified = modified.filter(isSafePath);
    const safeZipOnly = zipOnly.filter(isSafePath);
    const safeRepoOnly = repoOnly.filter(isSafePath);

    const zipBlobUrl = await storeZipBlob(sessionId, buffer);

    return NextResponse.json({
      ok: true,
      zipBlobUrl,
      repoEmpty: repoTree.length === 0,
      diff: { modified: safeModified, zipOnly: safeZipOnly, repoOnly: safeRepoOnly },
    });
  } catch (err: any) {
    console.error("diff_failed:", err);
    return NextResponse.json(
      { ok: false, error: "diff_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
