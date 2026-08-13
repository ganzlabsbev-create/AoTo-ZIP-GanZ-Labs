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
  projectName: string,
  target: "production" | "preview" = "production"
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
      target,
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

/**
 * Rollback: ย้าย alias (โดเมนหลักที่ deploy อยู่) ให้ไปชี้ที่ deployment เก่าแทน
 * ใช้ Vercel Aliases API ตรงๆ ไม่ต้องพึ่งว่า project ผูก git อยู่หรือไม่
 * (ต้องรู้ vercel deployment id เดิมที่เก็บไว้ตอน deploy ครั้งนั้นๆ)
 */
export async function rollbackToDeployment(
  vercelDeploymentId: string,
  alias: string
): Promise<{ alias: string }> {
  const res = await fetch(withTeam(`${API}/v2/deployments/${vercelDeploymentId}/aliases`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ alias }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Rollback failed: ${text}`);
  }
  const data = await res.json();
  return { alias: data.alias ?? alias };
}

/** หา Vercel Project ตามชื่อ (ชื่อเดียวกับที่ใช้ตอน deploy => sanitize แบบเดียวกัน) คืน null ถ้ายังไม่เคย deploy */
export async function getVercelProjectByName(name: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch(withTeam(`${API}/v9/projects/${sanitizeProjectName(name)}`), {
    headers: authHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get project failed: ${text}`);
  }
  const data = await res.json();
  return { id: data.id, name: data.name };
}

/**
 * ดึงรายชื่อ Vercel project ทั้งหมดในบัญชี/team ที่ token เข้าถึงได้ (ไม่จำกัดแค่ที่ deploy ผ่านแอปนี้)
 * ใช้สำหรับหน้า Manage — วนดึงทีละหน้าให้ครบเผื่อมีเป็นสิบ/ร้อยโปรเจกต์
 */
export async function listVercelProjects(): Promise<
  { id: string; name: string; url: string | null; updatedAt: number | null }[]
> {
  const results: any[] = [];
  let next: number | null | undefined = undefined;

  while (true) {
    const qs = next ? `?limit=100&until=${next}` : "?limit=100";
    const res = await fetch(withTeam(`${API}/v9/projects${qs}`), { headers: authHeaders() });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`List projects failed: ${text}`);
    }
    const data = await res.json();
    const projects = data.projects ?? [];
    results.push(...projects);
    next = data.pagination?.next ?? null;
    if (!next || projects.length === 0) break;
  }

  return results.map((p) => ({
    id: p.id,
    name: p.name,
    url: p.targets?.production?.alias?.[0] || p.latestDeployments?.[0]?.url || null,
    updatedAt: p.updatedAt ?? null,
  }));
}

/** ลบ Vercel project จริง (ลบทุก deployment ที่ผูกกับ project นี้ไปด้วย — ทำลายถาวร) */
export async function deleteVercelProject(projectId: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete project failed: ${text}`);
  }
}

/** หา Vercel Project ตาม id ตรงๆ (ใช้ในหน้า Manage ที่ทำงานกับ id อยู่แล้ว ไม่ต้องแปลงชื่อกลับไปกลับมา) */
export async function getVercelProjectById(
  id: string
): Promise<{ id: string; name: string; url: string | null } | null> {
  const res = await fetch(withTeam(`${API}/v9/projects/${id}`), { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get project failed: ${text}`);
  }
  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    url: data.targets?.production?.alias?.[0] || data.latestDeployments?.[0]?.url || null,
  };
}

export interface VercelEnvVar {
  id: string;
  key: string;
  value?: string;
  target: string[];
}

/** ดึงรายการ env var ของ project (ค่า encrypted จะไม่คืน value กลับมา เป็นปกติของ Vercel API) */
export async function listEnvVars(projectId: string): Promise<VercelEnvVar[]> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/env`), {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List env vars failed: ${text}`);
  }
  const data = await res.json();
  return (data.envs ?? []).map((e: any) => ({ id: e.id, key: e.key, target: e.target ?? [] }));
}

/** เพิ่ม env var ใหม่ให้ project — ระบุ target ได้ (ไม่ระบุ = ใช้ทั้ง 3 target เหมือนเดิม) */
export async function createEnvVar(
  projectId: string,
  key: string,
  value: string,
  target: string[] = ["production", "preview", "development"]
): Promise<void> {
  const res = await fetch(withTeam(`${API}/v10/projects/${projectId}/env`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      key,
      value,
      type: "encrypted",
      target: target.length > 0 ? target : ["production", "preview", "development"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create env var failed: ${text}`);
  }
}

/** แก้ค่า env var เดิม (ต้องมี envId จาก listEnvVars ก่อน) */
export async function updateEnvVar(projectId: string, envId: string, value: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/env/${envId}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update env var failed: ${text}`);
  }
}

export async function deleteEnvVar(projectId: string, envId: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/env/${envId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Delete env var failed: ${text}`);
  }
}

/** ผูก custom domain เข้ากับ project (domain ต้องชี้ DNS มาที่ Vercel เองนอกแอปนี้ก่อน/หลัง) */
export async function addDomainToProject(
  projectId: string,
  domain: string
): Promise<{ name: string; verified: boolean }> {
  const res = await fetch(withTeam(`${API}/v10/projects/${projectId}/domains`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name: domain }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Add domain failed: ${data?.error?.message || JSON.stringify(data)}`);
  }
  return { name: data.name, verified: Boolean(data.verified) };
}

export async function removeDomainFromProject(projectId: string, domain: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/domains/${domain}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Remove domain failed: ${text}`);
  }
}

/** อ่านสถานะ deployment ปัจจุบัน + build log ที่มีอยู่ตอนนี้ (ใช้ poll แบบ non-blocking จากฝั่ง client เพื่อ stream log สด) */
export async function getDeploymentStatus(
  deploymentId: string
): Promise<{ readyState: string; url: string; errorMessage: string | null }> {
  const res = await fetch(withTeam(`${API}/v13/deployments/${deploymentId}`), {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Get deployment status failed`);
  }
  return { readyState: data.readyState, url: data.url, errorMessage: data.errorMessage?.message ?? null };
}

// ============================================================================
// ส่วนขยายสำหรับหน้า Manage แบบเต็ม (deployments list/promote/redeploy/cancel,
// project settings, deployment protection, env target, domain redirect)
// ============================================================================

export interface VercelDeploymentListItem {
  uid: string;
  url: string;
  name: string;
  target: string | null;
  state: string; // READY / BUILDING / QUEUED / ERROR / CANCELED
  created: number;
}

/** ดึงรายการ deployment ทั้งหมดของ project (ไม่ใช่แค่ล่าสุด) เรียงใหม่สุดก่อน */
export async function listDeployments(projectId: string, limit = 50): Promise<VercelDeploymentListItem[]> {
  const res = await fetch(withTeam(`${API}/v6/deployments?projectId=${projectId}&limit=${limit}`), {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `List deployments failed`);
  }
  return (data.deployments ?? []).map((d: any) => ({
    uid: d.uid,
    url: d.url,
    name: d.name,
    target: d.target ?? null,
    state: d.state,
    created: d.created ?? d.createdAt ?? 0,
  }));
}

/** เลื่อน deployment (มักเป็น preview) ขึ้นเป็น production */
export async function promoteDeployment(projectId: string, deploymentId: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v10/projects/${projectId}/promote/${deploymentId}`), {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Promote deployment failed: ${text}`);
  }
}

/** สร้าง deployment ใหม่โดยใช้ source เดิมของ deployment ที่ระบุ (เทียบเท่าปุ่ม Redeploy บนเว็บ Vercel) */
export async function redeployDeployment(
  deploymentId: string,
  name: string,
  target: "production" | "preview" = "production"
): Promise<VercelDeployResult> {
  const res = await fetch(withTeam(`${API}/v13/deployments`), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, deploymentId, target }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Redeploy failed`);
  }
  return { id: data.id, url: data.url, readyState: data.readyState };
}

/** ยกเลิก build ที่กำลัง QUEUED/BUILDING อยู่ */
export async function cancelDeployment(deploymentId: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v12/deployments/${deploymentId}/cancel`), {
    method: "PATCH",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cancel deployment failed: ${text}`);
  }
}

/** ลบ deployment ทีละตัว (ต่างจากลบทั้ง project) */
export async function deleteDeploymentById(deploymentId: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v13/deployments/${deploymentId}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete deployment failed: ${text}`);
  }
}

export interface VercelProjectSettings {
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  devCommand: string | null;
  rootDirectory: string | null;
  framework: string | null;
  nodeVersion: string | null;
  productionBranch: string | null;
  autoDeployEnabled: boolean;
}

/** อ่าน build/dev settings + node version + production branch + สถานะ auto-deploy ปัจจุบันของ project */
export async function getProjectSettings(projectId: string): Promise<VercelProjectSettings> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Get project settings failed`);
  }
  return {
    buildCommand: data.buildCommand ?? null,
    outputDirectory: data.outputDirectory ?? null,
    installCommand: data.installCommand ?? null,
    devCommand: data.devCommand ?? null,
    rootDirectory: data.rootDirectory ?? null,
    framework: data.framework ?? null,
    nodeVersion: data.nodeVersion ?? null,
    productionBranch: data.link?.productionBranch ?? null,
    // Vercel ไม่มี flag ตรงๆ ชื่อ "auto deploy off" — ปิด auto-deploy จาก git ทำผ่านการตั้ง
    // git.deploymentEnabled = false ต่อ branch ทั้งหมด ถ้าไม่มี key นี้ถือว่ายังเปิดอยู่ (ค่า default)
    autoDeployEnabled: data.git?.deploymentEnabled?.[data.link?.productionBranch ?? ""] !== false,
  };
}

/** แก้ build/dev settings ต่างๆ ของ project (ส่งเฉพาะ field ที่เปลี่ยน) */
export async function updateProjectSettings(
  projectId: string,
  patch: Partial<{
    buildCommand: string | null;
    outputDirectory: string | null;
    installCommand: string | null;
    devCommand: string | null;
    rootDirectory: string | null;
    framework: string | null;
    nodeVersion: string;
  }>
): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update project settings failed: ${text}`);
  }
}

/** เปลี่ยน Production Branch ของ project */
export async function setProductionBranch(projectId: string, branch: string): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ link: { productionBranch: branch } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set production branch failed: ${text}`);
  }
}

/**
 * เปิด/ปิด auto-deploy จาก git push สำหรับ production branch ปัจจุบัน
 * หมายเหตุ: field นี้ (git.deploymentEnabled) มาจาก Vercel REST API และอาจเปลี่ยนชื่อ/รูปแบบได้
 * ถ้า Vercel เปลี่ยน API ในอนาคต ให้ตรวจสอบกับเอกสารล่าสุดอีกครั้ง
 */
export async function setAutoDeployEnabled(
  projectId: string,
  branch: string,
  enabled: boolean
): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ git: { deploymentEnabled: { [branch]: enabled } } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Toggle auto-deploy failed: ${text}`);
  }
}

/** อ่านสถานะ Deployment Protection (password gate ของ preview deployments) ปัจจุบัน */
export async function getDeploymentProtection(
  projectId: string
): Promise<{ enabled: boolean; hasPassword: boolean }> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Get protection status failed`);
  }
  const protection = data.passwordProtection;
  return { enabled: Boolean(protection), hasPassword: Boolean(protection?.deploymentType) };
}

/** ตั้ง/ถอด password gate ของ preview deployments */
export async function setDeploymentProtection(
  projectId: string,
  password: string | null
): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      passwordProtection: password ? { deploymentType: "preview", password } : null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set deployment protection failed: ${text}`);
  }
}

export interface VercelDomainItem {
  name: string;
  verified: boolean;
  redirect: string | null;
}

/** ดึงรายการ domain ทั้งหมดที่ผูกกับ project นี้ */
export async function listDomainsForProject(projectId: string): Promise<VercelDomainItem[]> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/domains`), {
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `List domains failed`);
  }
  return (data.domains ?? []).map((d: any) => ({
    name: d.name,
    verified: Boolean(d.verified),
    redirect: d.redirect ?? null,
  }));
}

/** ตั้งให้ domain นี้ redirect ไปยัง domain อื่น (ส่ง null เพื่อยกเลิก redirect) */
export async function setDomainRedirect(
  projectId: string,
  domain: string,
  redirectTo: string | null
): Promise<void> {
  const res = await fetch(withTeam(`${API}/v9/projects/${projectId}/domains/${domain}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ redirect: redirectTo, redirectStatusCode: redirectTo ? 307 : null }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set domain redirect failed: ${text}`);
  }
}
