import { sql } from "@vercel/postgres";

/**
 * เก็บ history โปรเจกต์/deployment ด้วย Vercel Postgres
 * (ต้องกด Storage → Add → Postgres ในหน้า Vercel project ก่อน
 * แล้ว POSTGRES_URL จะถูกใส่เป็น env var ให้อัตโนมัติ)
 */

let initialized = false;

async function ensureSchema() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      framework TEXT,
      build_command TEXT,
      file_tree TEXT,
      has_package_json BOOLEAN DEFAULT FALSE,
      zip_blob_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      target TEXT NOT NULL CHECK (target IN ('vercel','github')),
      status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
      url TEXT,
      detail TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  initialized = true;
}

export interface ProjectRow {
  id: string;
  name: string;
  framework: string | null;
  build_command: string | null;
  file_tree: string | null;
  has_package_json: boolean;
  zip_blob_url: string | null;
  created_at: string;
}

export interface DeploymentRow {
  id: string;
  project_id: string;
  target: "vercel" | "github";
  status: "pending" | "success" | "failed";
  url: string | null;
  detail: string | null;
  created_at: string;
}

export async function insertProject(row: Omit<ProjectRow, "created_at">) {
  await ensureSchema();
  await sql`
    INSERT INTO projects (id, name, framework, build_command, file_tree, has_package_json, zip_blob_url)
    VALUES (${row.id}, ${row.name}, ${row.framework}, ${row.build_command}, ${row.file_tree}, ${row.has_package_json}, ${row.zip_blob_url})
  `;
}

export async function getProject(id: string): Promise<ProjectRow | undefined> {
  await ensureSchema();
  const { rows } = await sql<ProjectRow>`SELECT * FROM projects WHERE id = ${id}`;
  return rows[0];
}

export async function listProjects(limit = 30): Promise<ProjectRow[]> {
  await ensureSchema();
  const { rows } = await sql<ProjectRow>`
    SELECT * FROM projects ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows;
}

export async function insertDeployment(row: Omit<DeploymentRow, "created_at">) {
  await ensureSchema();
  await sql`
    INSERT INTO deployments (id, project_id, target, status, url, detail)
    VALUES (${row.id}, ${row.project_id}, ${row.target}, ${row.status}, ${row.url}, ${row.detail})
  `;
}

export async function updateDeployment(
  id: string,
  patch: Partial<Pick<DeploymentRow, "status" | "url" | "detail">>
) {
  await ensureSchema();
  await sql`
    UPDATE deployments
    SET status = COALESCE(${patch.status ?? null}, status),
        url = ${patch.url ?? null},
        detail = ${patch.detail ?? null}
    WHERE id = ${id}
  `;
}

export async function getDeploymentsForProject(projectId: string): Promise<DeploymentRow[]> {
  await ensureSchema();
  const { rows } = await sql<DeploymentRow>`
    SELECT * FROM deployments WHERE project_id = ${projectId} ORDER BY created_at DESC
  `;
  return rows;
}

export async function getLatestDeploymentStatus(
  projectId: string
): Promise<Record<"vercel" | "github", DeploymentRow | undefined>> {
  const rows = await getDeploymentsForProject(projectId);
  return {
    vercel: rows.find((r) => r.target === "vercel" && r.status === "success"),
    github: rows.find((r) => r.target === "github" && r.status === "success"),
  };
}
