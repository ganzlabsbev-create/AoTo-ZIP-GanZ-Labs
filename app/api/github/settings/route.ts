import { NextRequest, NextResponse } from "next/server";
import {
  getRepoSettings,
  updateRepoDescription,
  updateRepoTopics,
  setRepoVisibility,
  setRepoArchived,
} from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const settings = await getRepoSettings(owner, repo);
    return NextResponse.json({ ok: true, settings });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "get_settings_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/**
 * body: { owner, repo, description?, topics?, private?, archived? }
 * ทำทีละ field ที่ถูกส่งมาเท่านั้น (undefined = ไม่แตะ field นั้น)
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const owner = body?.owner as string | undefined;
  const repo = body?.repo as string | undefined;
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    if (typeof body.description === "string") {
      await updateRepoDescription(owner, repo, body.description);
    }
    if (Array.isArray(body.topics)) {
      await updateRepoTopics(owner, repo, body.topics);
    }
    if (typeof body.private === "boolean") {
      await setRepoVisibility(owner, repo, body.private);
    }
    if (typeof body.archived === "boolean") {
      await setRepoArchived(owner, repo, body.archived);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "update_settings_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
