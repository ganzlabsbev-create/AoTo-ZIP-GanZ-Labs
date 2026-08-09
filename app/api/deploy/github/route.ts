import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { newExtractDir } from "@/lib/paths";
import { extractZip, listAllFiles } from "@/lib/zip";
import { fetchZipBlob } from "@/lib/blob";
import { createRepoIfNeeded, pushFilesToRepo, sanitizeRepoName } from "@/lib/github";
import { getProject, insertDeployment, updateDeployment } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const projectId = body?.projectId as string | undefined;
  const repoNameRaw = (body?.repoName as string | undefined)?.trim();

  if (!projectId || !repoNameRaw) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ ok: false, error: "project_not_found" }, { status: 404 });
  }
  if (!project.zip_blob_url) {
    return NextResponse.json({ ok: false, error: "zip_not_found" }, { status: 404 });
  }

  const repoName = sanitizeRepoName(repoNameRaw);
  const deploymentId = nanoid(10);
  await insertDeployment({
    id: deploymentId,
    project_id: projectId,
    target: "github",
    status: "pending",
    url: null,
    detail: null,
  });

  try {
    const zipBuffer = await fetchZipBlob(project.zip_blob_url);
    const extractDir = newExtractDir(projectId);
    extractZip(zipBuffer, extractDir);
    const files = listAllFiles(extractDir);

    if (files.length === 0) {
      throw new Error("ไม่พบไฟล์ในโปรเจกต์นี้");
    }

    const { owner, repo } = await createRepoIfNeeded(repoName);
    const url = await pushFilesToRepo(owner, repo, extractDir, files);

    await updateDeployment(deploymentId, { status: "success", url, detail: null });

    return NextResponse.json({ ok: true, url });
  } catch (err: any) {
    const detail = String(err?.message || err);
    await updateDeployment(deploymentId, { status: "failed", url: null, detail });
    return NextResponse.json({ ok: false, error: "push_failed", detail }, { status: 500 });
  }
}
