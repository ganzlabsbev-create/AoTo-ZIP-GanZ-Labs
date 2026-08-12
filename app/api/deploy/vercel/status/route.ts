import { NextRequest, NextResponse } from "next/server";
import { getDeploymentStatus, getDeploymentBuildLog } from "@/lib/vercel";
import { getDeployment, updateDeployment } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Client poll endpoint นี้ทุก ~2 วินาทีระหว่าง deploy กำลังทำงาน
 * เพื่อโชว์ build log สดๆ (ไม่ต้องรอ error ค่อยเห็น log เหมือนเดิม)
 * เมื่อ readyState เป็น READY/ERROR/CANCELED จะ finalize ผลลง DB ให้อัตโนมัติ
 */
export async function GET(req: NextRequest) {
  const deploymentId = req.nextUrl.searchParams.get("deploymentId");
  if (!deploymentId) {
    return NextResponse.json({ ok: false, error: "missing_deployment_id" }, { status: 400 });
  }

  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    return NextResponse.json({ ok: false, error: "deployment_not_found" }, { status: 404 });
  }

  // ถ้า finalize ไปแล้วก่อนหน้านี้ (client poll ต่อหลัง done) ตอบจาก DB เลย ไม่ยิง Vercel ซ้ำ
  if (deployment.status !== "pending") {
    return NextResponse.json({
      ok: true,
      status: deployment.status,
      url: deployment.url,
      buildLog: deployment.build_log,
    });
  }

  if (!deployment.vercel_deployment_id) {
    // ยังอัพโหลดไฟล์/สร้าง deployment ไม่เสร็จตอนนั้น (start route ยัง await อยู่) ให้ client รออีกรอบ
    return NextResponse.json({ ok: true, status: "pending", url: null, buildLog: null });
  }

  const buildLog = await getDeploymentBuildLog(deployment.vercel_deployment_id);

  try {
    const vercelStatus = await getDeploymentStatus(deployment.vercel_deployment_id);

    if (vercelStatus.readyState === "READY") {
      const url = `https://${vercelStatus.url}`;
      await updateDeployment(deploymentId, { status: "success", url, build_log: buildLog });
      return NextResponse.json({ ok: true, status: "success", url, buildLog });
    }

    if (vercelStatus.readyState === "ERROR" || vercelStatus.readyState === "CANCELED") {
      const detail = vercelStatus.errorMessage || `Deployment ${vercelStatus.readyState}`;
      await updateDeployment(deploymentId, { status: "failed", detail, build_log: buildLog });
      return NextResponse.json({ ok: false, status: "failed", error: "deploy_failed", detail, buildLog });
    }

    // ยังไม่เสร็จ (BUILDING/QUEUED/INITIALIZING ฯลฯ) — คืน log ปัจจุบันให้ client โชว์ระหว่างรอ
    return NextResponse.json({ ok: true, status: "pending", url: null, buildLog });
  } catch (err: any) {
    return NextResponse.json({ ok: true, status: "pending", url: null, buildLog });
  }
}
