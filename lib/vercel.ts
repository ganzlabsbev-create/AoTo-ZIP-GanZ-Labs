import fs from "fs";
import path from "path";
import crypto from "crypto";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID; // optional, ถ้าใช้ Vercel Team
const API = "https://api.vercel.com";

function authHeaders() {
  return { Authorization: `Bearer ${VERCEL_TOKEN}` };
}

function withTeam(url: string) {
  if (!VERCEL_TEAM_ID) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}teamId=${VERCEL_TEAM_ID}`;
}

/** อัปโหลดไฟล์แต่ละไฟล์ขึ้น Vercel ก่อน (ได้ sha กลับมา) ตาม Vercel Deployments API */
async function uploadFile(filePath: string, content: Buffer): Promise<string> {
  const sha = crypto.createHash("sha1").update(content).digest("hex");

  const res = await fetch(withTeam(`${API}/v2/files`), {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Length": String(content.length),
      "x-vercel-digest": sha,
    },
    body: content,
  });

  if (!res.ok && res.status !== 409) {
    // 409 = ไฟล์นี้มีอยู่แล้วบน Vercel (sha ซ้ำ) ถือว่าใช้ได้ ไม่ใช่ error
    const text = await res.text();
    throw new Error(`Upload file failed (${filePath}): ${text}`);
  }

  return sha;
}

export interface VercelDeployResult {
  id: string;
  url: string;
  readyState: string;
}

/**
 * สร้าง deployment ใหม่บน Vercel จากไฟล์ทั้งหมดในโปรเจกต์
 * projectName กลายเป็นชื่อโดเมน => {projectName}.vercel.app
 */
export async function deployToVercel(
  extractDir: string,
  relativeFiles: string[],
  projectName: string
): Promise<VercelDeployResult> {
  const files: Array<{ file: string; sha: string; size: number }> = [];

  for (const rel of relativeFiles) {
    const abs = path.join(extractDir, rel);
    const content = fs.readFileSync(abs);
    const sha = await uploadFile(rel, content);
    files.push({ file: rel, sha, size: content.length });
  }

  const createRes = await fetch(withTeam(`${API}/v13/deployments`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      name: sanitizeProjectName(projectName),
      files,
      target: "production",
      projectSettings: {
        framework: null, // ให้ Vercel auto-detect เอง
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Create deployment failed: ${text}`);
  }

  const data = await createRes.json();
  return { id: data.id, url: data.url, readyState: data.readyState };
}

/** Poll สถานะ deployment จนกว่าจะ READY หรือ ERROR (timeout กันไว้ที่ ~3 นาที) */
export async function pollDeploymentUntilReady(deploymentId: string): Promise<VercelDeployResult> {
  const maxAttempts = 36; // 36 * 5s = 180s
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(withTeam(`${API}/v13/deployments/${deploymentId}`), {
      headers: authHeaders(),
    });
    const data = await res.json();

    if (data.readyState === "READY") {
      return { id: data.id, url: data.url, readyState: data.readyState };
    }
    if (data.readyState === "ERROR" || data.readyState === "CANCELED") {
      throw new Error(`Deployment ${data.readyState}: ${data.errorMessage ?? "unknown error"}`);
    }

    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Deployment timed out after 3 minutes");
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52);
}
