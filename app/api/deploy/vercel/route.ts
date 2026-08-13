import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { newExtractDir } from "@/lib/paths";
import { extractZip, listAllFiles } from "@/lib/zip";
import { fetchZipBlob } from "@/lib/blob";
import { deployToVercel } from "@/lib/vercel";
import { getProject, insertDeployment, updateDeployment } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * เริ่ม deploy แบบ "ไม่รอ" (ต่างจากเดิมที่ block จน READY/ERROR ค่อย response กลับ)
 * สร้าง deployment บน Vercel แล้วคืน deploymentId (ของแอปเรา) + vercelDeploymentId กลับทันที
 * ให้ client ไป poll สถานะ + build log สดๆ ที่ /api/deploy/vercel/status ต่อเอง
 * (เพื่อโชว์ log แบบ real-time แทนที่จะรอเงียบๆ จนจบ)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const domainName = (body?.domainName as string | undefined)?.trim();
  const target = body?.target === "preview" ? "preview" : "production";

  if (!projectId || !domainName) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: "project_not_found" }, { status: 404 });
  }
  if (!project.zip_blob_url) {
    return NextResponse.json({ ok: false, error: "zip_not_found" }, { status: 404 });
  }

  const deploymentId = nanoid(10);
  await insertDeployment({
    id: deploymentId,
    project_id: projectId,
    target: "vercel",
    status: "pending",
    url: null,
    detail: null,
    domain_name: domainName,
  });

  try {
    const zipBuffer = await fetchZipBlob(project.zip_blob_url);
    const extractDir = newExtractDir(projectId);
    extractZip(zipBuffer, extractDir);
    const files = listAllFiles(extractDir);

    if (files.length === 0) {
      throw new Error("ไม่พบไฟล์ในโปรเจกต์นี้");
    }

    const created = await deployToVercel(extractDir, files, domainName, target);
    await updateDeployment(deploymentId, { vercel_deployment_id: created.id });

    return NextResponse.json({ ok: true, deploymentId, vercelDeploymentId: created.id });
  } catch (err: any) {
    const detail = String(err?.message || err);
    await updateDeployment(deploymentId, { status: "failed", detail });
    return NextResponse.json({ ok: false, error: "deploy_start_failed", detail }, { status: 500 });
  }
}
