import { NextRequest, NextResponse } from "next/server";
import { cancelDeployment } from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; deploymentId: string } }
) {
  try {
    await cancelDeployment(params.deploymentId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "cancel_deployment_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
