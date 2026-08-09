import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { extractZip } from "@/lib/zip";
import { detectFramework } from "@/lib/framework-detect";
import { insertProject } from "@/lib/db";
import { newExtractDir } from "@/lib/paths";
import { storeZipBlob } from "@/lib/blob";

const MAX_ZIP_SIZE_MB = Number(process.env.MAX_ZIP_SIZE_MB || 50);

export async function POST(req: NextRequest) {
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
  const projectId = nanoid(10);

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

  const detection = detectFramework(extractDir, extracted.packageJson);
  const projectName = file.name.replace(/\.zip$/i, "");

  // เก็บ ZIP ต้นฉบับไว้ที่ Vercel Blob กลาง เพื่อให้ request อื่น (ตอนกด deploy) ดึงมาแตกใหม่ได้
  const zipBlobUrl = await storeZipBlob(projectId, buffer);

  await insertProject({
    id: projectId,
    name: projectName,
    framework: detection.framework,
    build_command: detection.buildCommand,
    file_tree: JSON.stringify(extracted.tree),
    has_package_json: Boolean(extracted.packageJson),
    zip_blob_url: zipBlobUrl,
  });

  return NextResponse.json({
    ok: true,
    projectId,
    name: projectName,
    tree: extracted.tree,
    fileCount: extracted.fileCount,
    framework: detection.framework,
    buildCommand: detection.buildCommand,
    packageJson: extracted.packageJson,
  });
}
