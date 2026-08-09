import { NextRequest, NextResponse } from "next/server";
import { extractZip } from "@/lib/zip";
import { detectFramework } from "@/lib/framework-detect";
import { getProject, updateProjectZip } from "@/lib/db";
import { newExtractDir } from "@/lib/paths";
import { storeZipBlob } from "@/lib/blob";

const MAX_ZIP_SIZE_MB = Number(process.env.MAX_ZIP_SIZE_MB || 50);

/**
 * อัพเดต ZIP ของ project ที่มีอยู่แล้ว "แทนที่" ของเดิม
 * - ใช้ id เดิม, name เดิม ไม่สร้าง project ใหม่
 * - เขียนทับ blob เดิม (ผ่าน storeZipBlob ที่ใช้ path เดิม + allowOverwrite)
 * - วิเคราะห์ framework/build command/file tree ใหม่จาก ZIP ที่อัพมาล่าสุด
 * - ไม่แตะ deployments history เดิม (ยังดูย้อนหลังได้ว่า deploy รอบไหนสำเร็จ/ล้มเหลว)
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = params.id;

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: "project_not_found" }, { status: 404 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file") as File | null;

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

  // แตกไฟล์ในเครื่องของ request นี้ไว้แค่เพื่อวิเคราะห์โครงสร้าง/framework ทันที
  const extractDir = newExtractDir(projectId);
  let extracted;
  try {
    extracted = extractZip(buffer, extractDir);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "extract_failed", detail: String(err?.message || err) },
      { status: 400 }
    );
  }

  try {
    const detection = detectFramework(extractDir, extracted.packageJson);

    // เขียนทับ blob เดิมที่ path เดียวกัน (zips/{projectId}.zip) — ของเก่าหายไปเลย ไม่มีค้าง
    const zipBlobUrl = await storeZipBlob(projectId, buffer);

    await updateProjectZip(projectId, {
      framework: detection.framework,
      build_command: detection.buildCommand,
      file_tree: JSON.stringify(extracted.tree),
      has_package_json: Boolean(extracted.packageJson),
      zip_blob_url: zipBlobUrl,
    });

    return NextResponse.json({
      ok: true,
      projectId,
      tree: extracted.tree,
      fileCount: extracted.fileCount,
      framework: detection.framework,
      buildCommand: detection.buildCommand,
      packageJson: extracted.packageJson,
    });
  } catch (err: any) {
    console.error("update_zip_failed:", err);
    return NextResponse.json(
      { ok: false, error: "update_zip_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
