import { NextRequest, NextResponse } from "next/server";
import { listReleases, listTags, createRelease } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const [releases, tags] = await Promise.all([listReleases(owner, repo), listTags(owner, repo)]);
    return NextResponse.json({ ok: true, releases, tags });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_releases_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const owner = body?.owner as string | undefined;
  const repo = body?.repo as string | undefined;
  const tagName = (body?.tagName as string | undefined)?.trim();
  const name = (body?.name as string | undefined) ?? "";
  const description = (body?.body as string | undefined) ?? "";
  const prerelease = Boolean(body?.prerelease);
  const targetCommitish = body?.targetCommitish as string | undefined;
  if (!owner || !repo || !tagName) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const release = await createRelease(owner, repo, tagName, name, description, prerelease, targetCommitish);
    return NextResponse.json({ ok: true, release });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "create_release_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
