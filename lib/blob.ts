import { put, get } from "@vercel/blob";

/**
 * เก็บไฟล์ ZIP ต้นฉบับไว้ที่ Vercel Blob (ไม่ใช่ /tmp)
 * เพราะบน serverless แต่ละ request อาจไปลง instance คนละตัว
 * /tmp ของตอน upload กับตอน deploy จึงอาจไม่ใช่เครื่องเดียวกัน
 *
 * ตอน deploy จะดึงไฟล์กลับมาจาก URL นี้ แล้วแตกใหม่ในเครื่อง
 * ของ request นั้นๆ เอง (ต้องใช้ Storage → Add → Blob ในหน้า Vercel project)
 *
 * store นี้ตั้งเป็น private (ปลอดภัยกว่า ไม่มี URL ที่เข้าถึงได้แบบ public)
 * เลยต้อง upload/download ด้วย access: 'private' ผ่าน SDK เท่านั้น
 * ห้ามใช้ fetch(url) ตรงๆ เพราะจะไม่มีสิทธิ์อ่านไฟล์
 */
export async function storeZipBlob(projectId: string, buffer: Buffer): Promise<string> {
  const { url } = await put(`zips/${projectId}.zip`, buffer, {
    access: "private",
    addRandomSuffix: false,
  });
  return url;
}

export async function fetchZipBlob(url: string): Promise<Buffer> {
  const result = await get(url, { access: "private" });
  if (!result || !result.stream) {
    throw new Error("ดึงไฟล์ ZIP จาก Blob ไม่สำเร็จ (ไม่พบไฟล์)");
  }
  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}
