import { NextRequest, NextResponse } from "next/server";
import { getDeploymentProtection, setDeploymentProtection } from "@/lib/vercel";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const status = await getDeploymentProtection(params.id);
    return NextResponse.json({ ok: true, ...status });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "get_protection_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/** เปิด: ส่ง { password: "..." } / ปิด: ส่ง { password: null } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const password = (body?.password ?? null) as string | null;
  if (password !== null && !password.trim()) {
    return NextResponse.json({ ok: false, error: "missing_password" }, { status: 400 });
  }
  try {
    await setDeploymentProtection(params.id, password);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "set_protection_failed", detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}
