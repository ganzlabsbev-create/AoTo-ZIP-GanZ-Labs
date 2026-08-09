import fs from "fs";
import path from "path";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_ORG = process.env.GITHUB_ORG; // optional: ถ้าจะสร้าง repo ในนาม org แทน user
const API = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

async function gh(pathname: string, init?: RequestInit) {
  const res = await fetch(`${API}${pathname}`, { ...init, headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${pathname}): ${res.status} ${text}`);
  }
  return res.json();
}

async function getAuthenticatedUser(): Promise<string> {
  const me = await gh("/user");
  return me.login;
}

/** สร้าง repo ใหม่ (private by default) ถ้ายังไม่มี */
export async function createRepoIfNeeded(repoName: string): Promise<{ owner: string; repo: string }> {
  const owner = GITHUB_ORG || (await getAuthenticatedUser());

  // เช็คว่ามี repo นี้อยู่แล้วหรือยัง
  const checkRes = await fetch(`${API}/repos/${owner}/${repoName}`, { headers: headers() });
  if (checkRes.ok) {
    return { owner, repo: repoName };
  }

  const createPath = GITHUB_ORG ? `/orgs/${GITHUB_ORG}/repos` : "/user/repos";
  await gh(createPath, {
    method: "POST",
    body: JSON.stringify({ name: repoName, private: true, auto_init: true }),
  });

  // repo ใหม่ auto_init แล้วต้องรอ GitHub สร้าง commit แรก (README) เสร็จก่อน
  // ไม่งั้น git/blobs อาจยังเจอ repo ว่างอยู่ (409 Git Repository is empty)
  for (let i = 0; i < 5; i++) {
    const ref = await fetch(`${API}/repos/${owner}/${repoName}/git/refs/heads/main`, {
      headers: headers(),
    });
    if (ref.ok) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  return { owner, repo: repoName };
}

/**
 * Push ไฟล์ทั้งหมดขึ้น repo ในครั้งเดียวด้วย Git Data API
 * (เร็วกว่าการเรียก contents API ทีละไฟล์มาก สำหรับโปรเจกต์ที่มีหลายไฟล์)
 */
export async function pushFilesToRepo(
  owner: string,
  repo: string,
  extractDir: string,
  relativeFiles: string[],
  commitMessage = "Initial upload via Project Uploader"
): Promise<string> {
  // 1. หา default branch ปัจจุบัน (ถ้า repo ใหม่เอี่ยมยังไม่มี commit จะ handle แยก)
  let baseSha: string | null = null;
  let defaultBranch = "main";

  try {
    const repoInfo = await gh(`/repos/${owner}/${repo}`);
    defaultBranch = repoInfo.default_branch || "main";
    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`);
    baseSha = ref.object.sha;
  } catch {
    baseSha = null; // repo ว่างเปล่า ยังไม่มี branch/commit
  }

  // 2. สร้าง blob ของทุกไฟล์
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const rel of relativeFiles) {
    const abs = path.join(extractDir, rel);
    const content = fs.readFileSync(abs);
    const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: content.toString("base64"), encoding: "base64" }),
    });
    treeItems.push({ path: rel, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 3. สร้าง tree
  const tree = await gh(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      tree: treeItems,
      ...(baseSha ? { base_tree: undefined } : {}),
    }),
  });

  // 4. สร้าง commit
  const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: baseSha ? [baseSha] : [],
    }),
  });

  // 5. อัปเดต ref ให้ชี้ไป commit ใหม่ (สร้าง ref ถ้ายังไม่มี)
  if (baseSha) {
    await gh(`/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
  } else {
    await gh(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${defaultBranch}`, sha: commit.sha }),
    });
  }

  return `https://github.com/${owner}/${repo}`;
}

export function sanitizeRepoName(name: string): string {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}
