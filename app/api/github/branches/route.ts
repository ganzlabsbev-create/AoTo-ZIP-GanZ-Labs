import { NextRequest, NextResponse } from "next/server";
import { listBranches, createBranch, deleteBranch } from "@/lib/github";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    const branches = await listBranches(owner, repo);
    return NextResponse.json({ ok: true, branches });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_branches_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const owner = body?.owner as string | undefined;
  const repo = body?.repo as string | undefined;
  const newBranch = (body?.newBranch as string | undefined)?.trim();
  const fromBranch = body?.fromBranch as string | undefined;
  if (!owner || !repo || !newBranch || !fromBranch) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  try {
    await createBranch(owner, repo, newBranch, fromBranch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "create_branch_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/** ลบ branch — กัน default branch ไว้ที่ชั้นนี้ (ก่อนจะยิงไป GitHub เลย) เผื่อ client ส่งผิดมา */
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const branch = searchParams.get("branch");
  const defaultBranch = searchParams.get("defaultBranch");
  if (!owner || !repo || !branch) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (defaultBranch && branch === defaultBranch) {
    return NextResponse.json({ ok: false, error: "cannot_delete_default_branch" }, { status: 400 });
  }
  try {
    await deleteBranch(owner, repo, branch);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "delete_branch_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
