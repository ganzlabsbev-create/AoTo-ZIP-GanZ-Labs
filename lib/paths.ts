import path from "path";
import os from "os";
import { nanoid } from "nanoid";

/**
 * ที่เก็บไฟล์ที่แตกจาก ZIP ชั่วคราว — สร้าง path ใหม่ทุกครั้งที่เรียก (unique suffix)
 * เพราะแต่ละ request ควรแตกไฟล์ของตัวเองใหม่เสมอ (ดึงจาก Blob) ไม่ใช้ /tmp ร่วมข้าม request
 * กัน race condition ถ้ามีคนกด deploy Vercel กับ push GitHub พร้อมกัน
 */
export function newExtractDir(projectId: string): string {
  return path.join(os.tmpdir(), "zdt-projects", `${projectId}-${nanoid(6)}`);
}
