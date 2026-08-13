import { NextRequest, NextResponse } from "next/server";
import { deleteDeploymentById } from "@/lib/vercel";

export const dynamic = "force-dynamic";

/** ลบ deployment ทีละตัว (ไม่กระทบ deployment อื่นของ project เดียวกัน) */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; deploymentId: string } }
) {
  try {
    await deleteDeploymentById(params.deploymentId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "delete_deployment_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
