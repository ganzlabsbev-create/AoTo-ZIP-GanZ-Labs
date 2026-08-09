import { put } from "@vercel/blob";

/**
 * เก็บไฟล์ ZIP ต้นฉบับไว้ที่ Vercel Blob (ไม่ใช่ /tmp)
 * เพราะบน serverless แต่ละ request อาจไปลง instance คนละตัว
 * /tmp ของตอน upload กับตอน deploy จึงอาจไม่ใช่เครื่องเดียวกัน
 *
 * ตอน deploy จะ fetch ไฟล์กลับมาจาก URL นี้ แล้วแตกใหม่ในเครื่อง
 * ของ request นั้นๆ เอง (ต้องใช้ Storage → Add → Blob ในหน้า Vercel project)
 */
export async function storeZipBlob(projectId: string, buffer: Buffer): Promise<string> {
  const { url } = await put(`zips/${projectId}.zip`, buffer, {
    access: "public",
    addRandomSuffix: false,
  });
  return url;
}

export async function fetchZipBlob(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ดึงไฟล์ ZIP จาก Blob ไม่สำเร็จ (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}
