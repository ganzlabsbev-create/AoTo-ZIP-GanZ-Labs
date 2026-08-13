import { NextRequest, NextResponse } from "next/server";
import { redeployDeployment } from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; deploymentId: string } }
) {
  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const target = (body?.target as "production" | "preview" | undefined) || "production";
  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }
  try {
    const result = await redeployDeployment(params.deploymentId, name, target);
    return NextResponse.json({ ok: true, deployment: result });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "redeploy_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
