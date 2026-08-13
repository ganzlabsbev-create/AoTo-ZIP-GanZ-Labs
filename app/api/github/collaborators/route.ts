import { NextRequest, NextResponse } from "next/server";
import { listCollaborators, addCollaborator, removeCollaborator } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const collaborators = await listCollaborators(owner, repo);
    return NextResponse.json({ ok: true, collaborators });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_collaborators_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const owner = body?.owner as string | undefined;
  const repo = body?.repo as string | undefined;
  const username = (body?.username as string | undefined)?.trim();
  const permission = (body?.permission as string | undefined) || "push";
  if (!owner || !repo || !username) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await addCollaborator(owner, repo, username, permission as any);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "add_collaborator_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const username = searchParams.get("username");
  if (!owner || !repo || !username) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await removeCollaborator(owner, repo, username);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "remove_collaborator_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
