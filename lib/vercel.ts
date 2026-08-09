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
    body: content as unknown as BodyInit,
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

/**
 * Error พิเศษที่แนบ build log เต็มมาด้วย (แยกจาก message สั้นๆ)
 * ให้ route.ts อ่าน err.buildLog ต่อได้โดยไม่ต้อง parse message
 */
export class VercelDeploymentError extends Error {
  buildLog?: string;
  constructor(message: string, buildLog?: string) {
    super(message);
    this.name = "VercelDeploymentError";
    this.buildLog = buildLog;
  }
}

/**
 * ดึง build log เต็มจาก Vercel Events API
 * โครงสร้าง response ของ endpoint นี้ไม่คงที่ 100% ระหว่างเวอร์ชัน/ประเภท event
 * เลย log raw response ไว้ debug แล้วใช้ extractEventText ที่ทนทานกับ field ที่ขาด/ไม่ตรง
 */
export async function getDeploymentBuildLog(deploymentId: string): Promise<string> {
  try {
    const res = await fetch(
      withTeam(`${API}/v3/deployments/${deploymentId}/events?builds=1&limit=-1`),
      { headers: authHeaders() }
    );

    if (!res.ok) {
      const text = await res.text();
      return `(ดึง build log ไม่สำเร็จ: HTTP ${res.status} ${text})`;
    }

    const data = await res.json();

    // log raw response ออกมาดูโครงสร้างจริงก่อน (ช่วย debug ตอน field ไม่ตรงตามคาด)
    console.log("[vercel] raw build log events:", JSON.stringify(data)?.slice(0, 5000));

    const events: any[] = Array.isArray(data) ? data : data?.events ?? [];

    const lines = events
      .map((ev) => extractEventText(ev))
      .filter((line): line is string => Boolean(line && line.trim().length > 0));

    if (lines.length === 0) {
      return "(ไม่มี build log จาก Vercel สำหรับ deployment นี้)";
    }

    return lines.join("\n");
  } catch (err: any) {
    return `(ดึง build log ไม่สำเร็จ: ${String(err?.message || err)})`;
  }
}

/** ดึงข้อความ log จาก event object โดยลองหลาย field เผื่อ response ไม่ตรงตามที่คาดไว้ */
function extractEventText(ev: any): string | null {
  if (!ev || typeof ev !== "object") return null;

  const candidates = [
    ev.payload?.text,
    ev.text,
    ev.payload?.log,
    ev.payload?.message,
    ev.message,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }

  return null;
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
      const buildLog = await getDeploymentBuildLog(deploymentId);
      throw new VercelDeploymentError(
        `Deployment ${data.readyState}: ${data.errorMessage ?? "unknown error"}`,
        buildLog
      );
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
