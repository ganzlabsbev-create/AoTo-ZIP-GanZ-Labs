import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { rollbackToDeployment } from "@/lib/vercel";
import { getDeployment, insertDeployment } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Rollback: ย้าย alias (โดเมนที่ใช้งานอยู่) กลับไปชี้ deployment เก่าที่เคย success
 * รับ deploymentId = id (ของแอปเรา) ของ deployment เก่าที่จะย้อนกลับไป
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const deploymentId = body?.deploymentId as string | undefined;

  if (!deploymentId) {
    return NextResponse.json({ ok: false, error: "missing_deployment_id" }, { status: 400 });
  }

  const target = await getDeployment(deploymentId);
  if (!target || target.target !== "vercel" || target.status !== "success" || !target.vercel_deployment_id) {
    return NextResponse.json({ ok: false, error: "invalid_rollback_target" }, { status: 400 });
  }
  if (!target.domain_name) {
    return NextResponse.json({ ok: false, error: "domain_unknown_for_this_deployment" }, { status: 400 });
  }

  const alias = target.url ? target.url.replace(/^https?:\/\//, "") : `${target.domain_name}.vercel.app`;

  try {
    await rollbackToDeployment(target.vercel_deployment_id, alias);

    // บันทึกเป็น deployment entry ใหม่ เพื่อให้ "สถานะ deploy ล่าสุดที่สำเร็จ" ในหน้าโปรเจกต์ตรงกับความเป็นจริงหลัง rollback
    await insertDeployment({
      id: nanoid(10),
      project_id: target.project_id,
      target: "vercel",
      status: "success",
      url: target.url,
      detail: `rollback → ${target.vercel_deployment_id}`,
      vercel_deployment_id: target.vercel_deployment_id,
      domain_name: target.domain_name,
    });

    return NextResponse.json({ ok: true, url: target.url });
  } catch (err: any) {
    const detail = String(err?.message || err);
    return NextResponse.json({ ok: false, error: "rollback_failed", detail }, { status: 500 });
  }
}
