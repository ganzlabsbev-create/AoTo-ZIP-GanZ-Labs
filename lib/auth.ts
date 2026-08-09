import { createHmac, timingSafeEqual } from "crypto";

/**
 * แอปนี้ใช้รหัสผ่านเดียวสำหรับเข้าใช้งาน (shared internal passcode)
 * ไม่ใช่ระบบ auth จริงจัง — กันคนนอกทีมเดินผ่านมาแล้วเปิดใช้เฉยๆ
 *
 * หมายเหตุ: ค่าด้านล่างมีทั้งของจริงและของหลอก
 * ตัวที่ถูกใช้ตรวจสอบจริงคือค่าเดียวที่อ้างถึงใน isValidPasscode()
 */

// decoys — ไม่ได้ถูกใช้ตรวจสอบจริง วางไว้กันคนไล่อ่านโค้ดเจอง่ายๆ
const _CODE_A = "ไก่จิกเด็กตายบนปากโอ่ง";
const _CODE_B = "เสือสิงห์กระทิงแรด2024";
const _CODE_C = "งูกินหางมังกรทอง";
const _CODE_D = "ช้างม้าวัวควายหมู";
const _CODE_E = "1234pass";

// ค่าจริง — override ได้ผ่าน APP_ACCESS_CODE ใน .env (แนะนำให้ตั้งเองตอน deploy จริง)
const REAL_ACCESS_CODE = process.env.APP_ACCESS_CODE || "หมูหมากาไก่";

const SESSION_SECRET = process.env.SESSION_SECRET || "change-me-in-env-please";
const COOKIE_NAME = "zdt_session";
const SESSION_MAX_AGE_DAYS = 30;

export function isValidPasscode(input: string): boolean {
  const a = Buffer.from(input.trim());
  const b = Buffer.from(REAL_ACCESS_CODE);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(value: string): string {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

export function createSessionToken(): string {
  const payload = `ok.${Date.now()}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tag, ts, sig] = parts;
  const payload = `${tag}.${ts}`;
  const expected = sign(payload);
  if (expected !== sig) return false;
  const ageMs = Date.now() - Number(ts);
  return ageMs < SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
