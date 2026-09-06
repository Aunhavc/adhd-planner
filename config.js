/* =============================================================
   ค่าตั้งต้นของระบบ — กรอก 2 ค่าแรกก่อนใช้งาน
   ทั้งสองค่านี้ "เปิดเผยได้" ออกแบบมาให้ฝังในหน้าเว็บอยู่แล้ว
   ความปลอดภัยอยู่ที่ RLS ในฐานข้อมูล ไม่ใช่การซ่อนคีย์

   หาได้ที่: Supabase Dashboard → Project Settings → API
   ============================================================= */
window.PLANNER_CONFIG = {

  // ---- จำเป็น ----
  SUPABASE_URL:      'https://hsvggmmzfjexozajputi.supabase.co',   // เช่น 'https://abcdefghijk.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzdmdnbW16ZmpleG96YWpwdXRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2NzQzMTksImV4cCI6MjEwNDI1MDMxOX0.HejuSTsIYjcu7FV5NOyXz4y6YQA6jP5YqAojJB2vlYI',   // ขึ้นต้นด้วย 'eyJ...' หรือ 'sb_publishable_...'

  // ---- Stripe (เว้นว่างไว้ก่อนได้ ระบบยังใช้งานได้โดยให้สิทธิ์ด้วยมือจากหน้าแอดมิน) ----
  PRICES: {
    monthly:  { id: '', label: 'รายเดือน', price: 149,  unit: 'บาท / เดือน' },
    yearly:   { id: '', label: 'รายปี',    price: 1490, unit: 'บาท / ปี'    },
    lifetime: { id: '', label: 'ตลอดชีพ',  price: 2900, unit: 'บาท ครั้งเดียว' }
  },

  // ---- ปรับได้ตามต้องการ ----
  APP_NAME: 'Ultimate ADHD Planner',
  TRIAL_DAYS: 7
};

/* ห้ามใส่ service_role key ที่ไฟล์นี้เด็ดขาด — มันข้าม RLS ได้ทั้งหมด
   ถ้าหลุดออกไป ใครก็อ่านและลบข้อมูลของผู้ใช้ทุกคนได้ */
