/**
 * แอปนี้ใช้รหัสผ่านเดียวสำหรับเข้าใช้งาน (shared internal passcode)
 * ไม่ใช่ระบบ auth จริงจัง — กันคนนอกทีมเดินผ่านมาแล้วเปิดใช้เฉยๆ
 *
 * หมายเหตุ: ค่าด้านล่างมีทั้งของจริงและของหลอก
 * ตัวที่ถูกใช้ตรวจสอบจริงคือค่าเดียวที่อ้างถึงใน isValidPasscode()
 *
 * เปลี่ยนมาใช้ Web Crypto API (crypto.subtle) แทน Node's `crypto` module
 * เพราะไฟล์นี้ถูก import เข้าไปใน middleware.ts ซึ่งรันบน Vercel Edge Runtime
 * และ Edge Runtime ไม่รองรับ Node's `crypto` (createHmac / timingSafeEqual)
 * — ทำให้ middleware crash ด้วย MIDDLEWARE_INVOCATION_FAILED
 * Web Crypto ใช้ได้ทั้งบน Edge และ Node เลยพอร์ตมาใช้ตัวนี้แทนทั้งหมด
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

const encoder = new TextEncoder();

let cachedKey: Promise<CryptoKey> | null = null;

function getHmacKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      "raw",
      encoder.encode(SESSION_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return cachedKey;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(value: string): Promise<string> {
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToHex(sig);
}

/** Constant-time comparison of two equal-length strings (timing-safe). */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function isValidPasscode(input: string): boolean {
  const a = input.trim();
  const b = REAL_ACCESS_CODE;
  if (a.length !== b.length) return false;
  return timingSafeEqualStr(a, b);
}

export async function createSessionToken(): Promise<string> {
  const payload = `ok.${Date.now()}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tag, ts, sig] = parts;
  const payload = `${tag}.${ts}`;
  const expected = await sign(payload);
  if (!timingSafeEqualStr(expected, sig)) return false;
  const ageMs = Date.now() - Number(ts);
  return ageMs < SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
