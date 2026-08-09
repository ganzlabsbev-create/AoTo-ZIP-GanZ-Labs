# Project Uploader — ZIP → GitHub / Vercel

เครื่องมือภายในองค์กร: อัปโหลด ZIP → ตรวจ framework อัตโนมัติ → deploy ไป Vercel หรือ push ขึ้น GitHub

Mobile-first, รองรับไทย/อังกฤษ, มีรหัสผ่านกันหน้าแรกไว้ชั้นหนึ่ง
ออกแบบให้ deploy บน **Vercel เอง** ได้จริง (ใช้ Vercel Postgres เก็บ history + Vercel Blob เก็บไฟล์ ZIP ระหว่างขั้นตอน)

## วิธี Deploy ขึ้น Vercel จริง (ทำตามลำดับ)

1. Push โค้ดนี้ขึ้น GitHub repo ของตัวเอง
2. เข้า https://vercel.com → **Add New → Project** → เลือก repo นี้ → Import (ยังไม่ต้องกด Deploy)
3. ในหน้า Project → แท็บ **Storage** → **Create Database** → เลือก **Postgres** → connect เข้าโปรเจกต์
   (จะได้ env var `POSTGRES_URL` ให้อัตโนมัติ)
4. แท็บ **Storage** อีกครั้ง → **Create** → เลือก **Blob** → connect เข้าโปรเจกต์
   (จะได้ env var `BLOB_READ_WRITE_TOKEN` ให้อัตโนมัติ)
5. แท็บ **Settings → Environment Variables** ใส่เพิ่มเอง:
   - `APP_ACCESS_CODE` — รหัสผ่านเข้าแอป (**อย่าใช้ค่า default ในโค้ด**)
   - `SESSION_SECRET` — สุ่มสตริงยาวๆ
   - `VERCEL_TOKEN` — สร้างที่ https://vercel.com/account/tokens
   - `GITHUB_TOKEN` — fine-grained PAT สิทธิ์ Contents: read/write (+ Administration: read/write ถ้าจะให้สร้าง repo ใหม่เองได้)
   - `GITHUB_ORG` — ใส่ถ้าจะ push repo เข้า organization แทน personal account
6. กด **Deploy**

เท่านี้จบ — ตารางใน Postgres จะถูกสร้างอัตโนมัติตอนเรียก API ครั้งแรก ไม่ต้อง migrate เอง

## รันในเครื่องตัวเอง (dev)

```bash
npm install
vercel link          # ผูกกับ Vercel project ที่สร้างไว้ในข้อ 2-4 ด้านบน
vercel env pull .env.local   # ดึง POSTGRES_URL / BLOB_READ_WRITE_TOKEN มาไว้ในเครื่อง
```

แล้วเติมค่าที่เหลือใน `.env.local` เอง (ดูตัวอย่างที่ `.env.example`): `APP_ACCESS_CODE`, `SESSION_SECRET`, `VERCEL_TOKEN`, `GITHUB_TOKEN`

```bash
npm run dev
```

เปิด http://localhost:3000 — จะเจอหน้ากรอกรหัสก่อน

## สถาปัตยกรรม (ทำไมต้องใช้ Postgres + Blob)

Vercel serverless function ไม่มี filesystem ถาวร และแต่ละ request อาจไปลงคนละ instance กัน ทำให้:

- ข้อมูล "Recent Projects" เก็บด้วยไฟล์ธรรมดาไม่ได้ → ใช้ **Vercel Postgres**
- ไฟล์ ZIP ที่แตกไว้ตอน upload จะหายไปก่อนกดปุ่ม deploy (เพราะเป็นคนละ request/instance) → เก็บ ZIP ต้นฉบับไว้ที่ **Vercel Blob** แทน แล้วทุกครั้งที่กด deploy จะดึงมาแตกใหม่ในเครื่องของ request นั้นๆ เอง (ใช้ `/tmp` แค่ชั่วคราวระหว่างการประมวลผลใน request เดียว ไม่พึ่งพาให้อยู่ข้าม request)

## ⚠️ เรื่องสำคัญอื่นๆ

1. **Auth เป็นรหัสผ่านเดียวใช้ร่วมกันทั้งองค์กร** ไม่ใช่ระบบ user แยกคน เหมาะกับทีมเล็กที่ไว้ใจกัน ถ้าต้องการ audit ว่าใคร deploy อะไร ต้องเพิ่มระบบ login แยกคนทีหลัง
2. **Token องค์กร (Vercel/GitHub) มีสิทธิ์เต็ม** — ใครก็ตามที่ผ่านรหัสเข้าแอปได้ = deploy/push ในนามองค์กรได้หมด ดูแลการแจกรหัสให้ดี
3. Vercel Blob ตั้งเป็น `public` access (จำเป็นเพื่อให้ server ดึงกลับมา fetch ได้ง่าย) — ไฟล์ ZIP จะเข้าถึงได้ผ่าน URL แบบสุ่มเดา (ไม่ list ให้คนทั่วไปดู) แต่ถ้ากังวลเรื่องนี้เพิ่มเติม บอกได้ จะปรับให้ fetch แบบ signed request แทน

## โครงสร้างโปรเจกต์

```
app/
  login/page.tsx           หน้ากรอกรหัส
  page.tsx                 หน้าหลัก (upload + recent projects)
  project/[id]/page.tsx    หน้ารายละเอียดโปรเจกต์ + ปุ่ม deploy
  api/
    auth/route.ts          ตรวจรหัสผ่าน + set cookie
    upload/route.ts        รับ ZIP, แตกไว้วิเคราะห์, เก็บต้นฉบับขึ้น Blob
    projects/route.ts      list history จาก Postgres
    deploy/vercel/route.ts ดึง ZIP จาก Blob มาแตกใหม่ แล้ว deploy
    deploy/github/route.ts ดึง ZIP จาก Blob มาแตกใหม่ แล้ว push
lib/
  auth.ts                  ตรรกะรหัสผ่าน + session
  zip.ts                   แตกไฟล์ + build file tree
  framework-detect.ts      เดา framework จาก config/deps
  vercel.ts / github.ts    เรียก API จริง
  db.ts                    Vercel Postgres
  blob.ts                  Vercel Blob (เก็บ/ดึง ZIP ต้นฉบับ)
  i18n.ts / i18n-context.tsx
middleware.ts               กันทุกหน้ายกเว้น /login
```
