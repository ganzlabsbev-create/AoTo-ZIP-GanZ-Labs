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

/**
 * ดึงรายชื่อ repo ทั้งหมดที่ token เข้าถึงได้ (org ถ้ามี GITHUB_ORG, ไม่งั้น user เอง)
 * วนดึงทีละหน้าให้ครบ ไม่ใช่แค่หน้าแรก (repo อาจมีเป็นร้อยตัว)
 */
export async function listRepos(): Promise<
  { name: string; full_name: string; default_branch: string; updated_at: string }[]
> {
  const perPage = 100;
  const results: any[] = [];
  let page = 1;

  while (true) {
    const pathname = GITHUB_ORG
      ? `/orgs/${GITHUB_ORG}/repos?per_page=${perPage}&page=${page}&sort=updated`
      : `/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`;
    const data = await gh(pathname);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return results.map((r) => ({
    name: r.name,
    full_name: r.full_name,
    default_branch: r.default_branch || "main",
    updated_at: r.updated_at,
  }));
}

/**
 * ดึงโครงสร้างไฟล์ปัจจุบันของ repo/branch ที่เลือก แบบ flat (path + blob sha)
 * ถ้า repo ว่างเปล่า/ยังไม่มี commit หรือ branch ไม่มีอยู่จริง ให้ถือว่าไม่มีไฟล์เลย (คืน array ว่าง)
 * แทนที่จะโยน error ออกไป เพราะฝั่ง diff ต้องใช้ค่านี้เทียบกับ ZIP ต่อได้เสมอ
 */
export async function getRepoTree(
  owner: string,
  repo: string,
  branch: string
): Promise<{ path: string; sha: string }[]> {
  try {
    const data = await gh(
      `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
    );
    if (!Array.isArray(data.tree)) return [];
    return data.tree
      .filter((item: any) => item.type === "blob")
      .map((item: any) => ({ path: item.path, sha: item.sha }));
  } catch {
    return [];
  }
}

/** ดึงเนื้อหาไฟล์เดี่ยวๆ เป็น text (ใช้เปิดดู/แก้ไขในหน้า Manage ก่อน commit) */
export async function getFileContent(
  owner: string,
  repo: string,
  filePath: string,
  branch: string
): Promise<string> {
  const data = await gh(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${encodeURIComponent(branch)}`
  );
  if (Array.isArray(data) || data.type !== "file" || !data.content) {
    throw new Error("Not a readable file");
  }
  return Buffer.from(data.content, "base64").toString("utf-8");
}

/** ลบ repo จริงบน GitHub ถาวร (ต้อง token สิทธิ์ Administration: write ถึงจะลบได้ ไม่งั้น GitHub จะคืน 403) */
export async function deleteRepo(owner: string, repo: string): Promise<void> {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete repo failed: ${res.status} ${text}`);
  }
}

export interface FileChange {
  path: string;
  action: "add" | "replace" | "delete";
  content?: Buffer;
}

/**
 * สร้าง commit เดียวที่รวมการ add/replace/delete ไฟล์ตามที่ผู้ใช้เลือกไว้
 * ใช้ base_tree อ้างอิง tree ปัจจุบันของ branch เสมอ (ต่างจาก pushFilesToRepo ที่เขียนทับทั้งหมด)
 * เพื่อให้ไฟล์ที่ไม่ได้อยู่ใน `changes` ยังคงอยู่ใน repo เหมือนเดิมโดยอัตโนมัติ
 */
export async function commitFileChanges(
  owner: string,
  repo: string,
  branch: string,
  changes: FileChange[],
  commitMessage: string
): Promise<string> {
  if (changes.length === 0) {
    throw new Error("ไม่มีการเปลี่ยนแปลงที่เลือกไว้");
  }

  // 1+2. หา commit sha และ tree sha ปัจจุบันของ branch (ใช้เป็น base_tree)
  let baseCommitSha: string | null = null;
  let baseTreeSha: string | null = null;
  try {
    const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    baseCommitSha = ref.object.sha;
    const commitInfo = await gh(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`);
    baseTreeSha = commitInfo.tree.sha;
  } catch {
    // branch/commit ยังไม่มีอยู่จริง (repo ว่างเปล่า) -> ไม่มี base_tree ให้อ้างอิง สร้าง ref ใหม่ทีหลัง
    baseCommitSha = null;
    baseTreeSha = null;
  }

  // 3. สร้าง blob ใหม่เฉพาะไฟล์ที่ add/replace (delete ไม่ต้องมี blob ใช้ sha: null แทน)
  const treeItems: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
  for (const change of changes) {
    if (change.action === "delete") {
      treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    if (!change.content) {
      throw new Error(`ไม่มีเนื้อหาไฟล์สำหรับ "${change.path}"`);
    }
    const blob = await gh(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: change.content.toString("base64"), encoding: "base64" }),
    });
    treeItems.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  // 4. สร้าง tree ใหม่โดยอ้าง base_tree เดิม — ไฟล์อื่นที่ไม่อยู่ใน treeItems จะคงอยู่เหมือนเดิมอัตโนมัติ
  const tree = await gh(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      ...(baseTreeSha ? { base_tree: baseTreeSha } : {}),
      tree: treeItems,
    }),
  });

  // 5. สร้าง commit ใหม่ผูกกับ parent เดิม (ถ้ามี)
  const commit = await gh(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: commitMessage,
      tree: tree.sha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    }),
  });

  // 6. ขยับ ref ของ branch ไปที่ commit ใหม่ (สร้าง ref ใหม่แทนถ้า branch ยังไม่เคยมีมาก่อน)
  if (baseCommitSha) {
    await gh(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
  } else {
    await gh(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  return `https://github.com/${owner}/${repo}/commit/${commit.sha}`;
}

// ============================================================================
// ส่วนขยายสำหรับหน้า Manage แบบเต็ม (branches, repo settings, releases, collaborators)
// ============================================================================

export interface BranchItem {
  name: string;
  isDefault: boolean;
  protected: boolean;
}

/** ดึงรายชื่อ branch ทั้งหมดของ repo พร้อมระบุว่าอันไหนคือ default */
export async function listBranches(owner: string, repo: string): Promise<BranchItem[]> {
  const repoInfo = await gh(`/repos/${owner}/${repo}`);
  const defaultBranch = repoInfo.default_branch;

  const perPage = 100;
  const results: any[] = [];
  let page = 1;
  while (true) {
    const data = await gh(`/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  return results.map((b) => ({
    name: b.name,
    isDefault: b.name === defaultBranch,
    protected: Boolean(b.protected),
  }));
}

/** สร้าง branch ใหม่จาก branch ต้นทางที่ระบุ */
export async function createBranch(
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string
): Promise<void> {
  const ref = await gh(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(fromBranch)}`);
  await gh(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: ref.object.sha }),
  });
}

/** ลบ branch (กันลบ default branch ไว้ที่ชั้น API route แล้ว แต่เช็คซ้ำที่นี่ด้วยเผื่อเรียกตรง) */
export async function deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
  const repoInfo = await gh(`/repos/${owner}/${repo}`);
  if (repoInfo.default_branch === branch) {
    throw new Error("ลบ default branch ไม่ได้");
  }
  const res = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete branch failed: ${res.status} ${text}`);
  }
}

export interface BranchProtectionSettings {
  requirePullRequestReviews: boolean;
  requiredApprovingReviewCount: number;
  requireStatusChecks: boolean;
  requiredStatusCheckContexts: string[];
}

/** อ่านค่า branch protection rule ปัจจุบัน (คืนค่า default ปิดหมดถ้า branch ยังไม่มี protection เลย) */
export async function getBranchProtection(
  owner: string,
  repo: string,
  branch: string
): Promise<BranchProtectionSettings> {
  try {
    const data = await gh(`/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`);
    return {
      requirePullRequestReviews: Boolean(data.required_pull_request_reviews),
      requiredApprovingReviewCount: data.required_pull_request_reviews?.required_approving_review_count ?? 1,
      requireStatusChecks: Boolean(data.required_status_checks),
      requiredStatusCheckContexts: data.required_status_checks?.contexts ?? [],
    };
  } catch {
    return {
      requirePullRequestReviews: false,
      requiredApprovingReviewCount: 1,
      requireStatusChecks: false,
      requiredStatusCheckContexts: [],
    };
  }
}

/** ตั้งค่า branch protection rule พื้นฐาน (require PR review / require status checks) */
export async function setBranchProtection(
  owner: string,
  repo: string,
  branch: string,
  settings: BranchProtectionSettings
): Promise<void> {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
    {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify({
        required_status_checks: settings.requireStatusChecks
          ? { strict: true, contexts: settings.requiredStatusCheckContexts }
          : null,
        enforce_admins: false,
        required_pull_request_reviews: settings.requirePullRequestReviews
          ? { required_approving_review_count: settings.requiredApprovingReviewCount }
          : null,
        restrictions: null,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Set branch protection failed: ${res.status} ${text}`);
  }
}

/** ปิด branch protection ทั้งหมดของ branch นั้น */
export async function removeBranchProtection(owner: string, repo: string, branch: string): Promise<void> {
  const res = await fetch(
    `${API}/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}/protection`,
    { method: "DELETE", headers: headers() }
  );
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Remove branch protection failed: ${res.status} ${text}`);
  }
}

export interface RepoSettings {
  description: string | null;
  topics: string[];
  private: boolean;
  archived: boolean;
  defaultBranch: string;
}

/** อ่านค่า settings พื้นฐานของ repo */
export async function getRepoSettings(owner: string, repo: string): Promise<RepoSettings> {
  const data = await gh(`/repos/${owner}/${repo}`);
  return {
    description: data.description ?? null,
    topics: data.topics ?? [],
    private: Boolean(data.private),
    archived: Boolean(data.archived),
    defaultBranch: data.default_branch,
  };
}

/** แก้ description ของ repo */
export async function updateRepoDescription(owner: string, repo: string, description: string): Promise<void> {
  await gh(`/repos/${owner}/${repo}`, { method: "PATCH", body: JSON.stringify({ description }) });
}

/** แก้ topics (tags) ของ repo — ใช้ endpoint แยกของ GitHub (ไม่ใช่ PATCH /repos ตรงๆ) */
export async function updateRepoTopics(owner: string, repo: string, topics: string[]): Promise<void> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/topics`, {
    method: "PUT",
    headers: { ...headers(), Accept: "application/vnd.github.mercy-preview+json" },
    body: JSON.stringify({ names: topics }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Update topics failed: ${res.status} ${text}`);
  }
}

/** เปลี่ยน visibility ของ repo (public/private) — กระทบสิทธิ์เข้าถึงทันที ต้อง confirm ก่อนเรียกจาก UI */
export async function setRepoVisibility(owner: string, repo: string, isPrivate: boolean): Promise<void> {
  await gh(`/repos/${owner}/${repo}`, { method: "PATCH", body: JSON.stringify({ private: isPrivate }) });
}

/** archive/unarchive repo */
export async function setRepoArchived(owner: string, repo: string, archived: boolean): Promise<void> {
  await gh(`/repos/${owner}/${repo}`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export interface ReleaseItem {
  id: number;
  tagName: string;
  name: string | null;
  body: string | null;
  prerelease: boolean;
  draft: boolean;
  publishedAt: string | null;
  htmlUrl: string;
}

/** ดึงรายการ releases ทั้งหมด (รวม tags ที่ยังไม่ได้ทำ release ด้วยแยกต่างหาก) */
export async function listReleases(owner: string, repo: string): Promise<ReleaseItem[]> {
  const data = await gh(`/repos/${owner}/${repo}/releases?per_page=50`);
  if (!Array.isArray(data)) return [];
  return data.map((r: any) => ({
    id: r.id,
    tagName: r.tag_name,
    name: r.name,
    body: r.body,
    prerelease: Boolean(r.prerelease),
    draft: Boolean(r.draft),
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
  }));
}

/** ดึงรายชื่อ tag ทั้งหมดของ repo (ใช้เป็นตัวเลือกตอนสร้าง release ใหม่จาก tag ที่มีอยู่) */
export async function listTags(owner: string, repo: string): Promise<string[]> {
  const data = await gh(`/repos/${owner}/${repo}/tags?per_page=50`);
  if (!Array.isArray(data)) return [];
  return data.map((t: any) => t.name);
}

/** สร้าง release ใหม่จาก tag (ถ้า tag ยังไม่มีอยู่ GitHub จะสร้าง tag ให้อัตโนมัติจาก target_commitish) */
export async function createRelease(
  owner: string,
  repo: string,
  tagName: string,
  name: string,
  body: string,
  prerelease: boolean,
  targetCommitish?: string
): Promise<ReleaseItem> {
  const data = await gh(`/repos/${owner}/${repo}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tagName,
      name,
      body,
      prerelease,
      ...(targetCommitish ? { target_commitish: targetCommitish } : {}),
    }),
  });
  return {
    id: data.id,
    tagName: data.tag_name,
    name: data.name,
    body: data.body,
    prerelease: Boolean(data.prerelease),
    draft: Boolean(data.draft),
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
  };
}

export interface CollaboratorItem {
  login: string;
  permission: "read" | "triage" | "write" | "maintain" | "admin";
  avatarUrl: string;
}

/** ดึงรายชื่อคนที่มีสิทธิ์เข้าถึง repo ปัจจุบัน + ระดับสิทธิ์ */
export async function listCollaborators(owner: string, repo: string): Promise<CollaboratorItem[]> {
  const data = await gh(`/repos/${owner}/${repo}/collaborators?per_page=100&affiliation=direct`);
  if (!Array.isArray(data)) return [];
  return data.map((c: any) => ({
    login: c.login,
    permission: c.role_name ?? c.permissions?.admin
      ? "admin"
      : c.permissions?.maintain
      ? "maintain"
      : c.permissions?.push
      ? "write"
      : c.permissions?.triage
      ? "triage"
      : "read",
    avatarUrl: c.avatar_url,
  }));
}

/** เชิญ/เพิ่มคนใหม่เข้า repo ด้วย username + สิทธิ์ที่เลือก */
export async function addCollaborator(
  owner: string,
  repo: string,
  username: string,
  permission: "pull" | "triage" | "push" | "maintain" | "admin"
): Promise<void> {
  await gh(`/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, {
    method: "PUT",
    body: JSON.stringify({ permission }),
  });
}

/** ลบคนออกจาก repo */
export async function removeCollaborator(owner: string, repo: string, username: string): Promise<void> {
  const res = await fetch(`${API}/repos/${owner}/${repo}/collaborators/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Remove collaborator failed: ${res.status} ${text}`);
  }
}
