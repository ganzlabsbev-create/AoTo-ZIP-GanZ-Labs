import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { newExtractDir } from "@/lib/paths";
import { extractZip, listAllFiles } from "@/lib/zip";
import { fetchZipBlob } from "@/lib/blob";
import { deployToVercel, pollDeploymentUntilReady } from "@/lib/vercel";
import { getProject, insertDeployment, updateDeployment } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const domainName = (body?.domainName as string | undefined)?.trim();

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
  });

  try {
    // ดึง ZIP ต้นฉบับจาก Blob กลับมาแตกใหม่ในเครื่องของ request นี้
    const zipBuffer = await fetchZipBlob(project.zip_blob_url);
    const extractDir = newExtractDir(projectId);
    extractZip(zipBuffer, extractDir);
    const files = listAllFiles(extractDir);

    if (files.length === 0) {
      throw new Error("ไม่พบไฟล์ในโปรเจกต์นี้");
    }

    const created = await deployToVercel(extractDir, files, domainName);
    const ready = await pollDeploymentUntilReady(created.id);
    const url = `https://${ready.url}`;

    await updateDeployment(deploymentId, { status: "success", url, detail: null });

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    const detail = String(err?.message || err);
    const buildLog: string | null = err?.buildLog ?? null;
    await updateDeployment(deploymentId, { status: "failed", url: null, detail, build_log: buildLog });
    return NextResponse.json({ ok: false, error: "deploy_failed", detail, buildLog }, { status: 500 });
  }
}
