import { NextRequest, NextResponse } from "next/server";
import { listDeployments } from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const deployments = await listDeployments(params.id);
    return NextResponse.json({ ok: true, deployments });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "list_deployments_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
