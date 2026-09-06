/* =============================================================
   ตัวเริ่มระบบของหน้าแพลนเนอร์

   ลำดับสำคัญ: ต้องดึงข้อมูลจากเซิร์ฟเวอร์ให้เสร็จ "ก่อน" โหลด planner/app.js
   เพราะ app.js อ่านข้อมูลตั้งต้นแบบ synchronous ตอนไฟล์ถูกโหลด
   ============================================================= */
import {
  supabase, configured, configError, requireSession, getAccount, touchLastSeen,
  loadPlannerState, savePlannerState, signOut, esc, fmtDate, PLAN_LABEL
} from './auth.js';

const boot   = document.getElementById('boot');
const bar    = document.getElementById('bar');
const notice = document.getElementById('notice');
const shell  = document.getElementById('shell');

if (!configured) {
  boot.innerHTML = '';
  configError(boot);
  throw new Error('ยังไม่ได้ตั้งค่า config.js');
}

const session = await requireSession();
if (!session) throw new Error('ยังไม่ได้ล็อกอิน');   // requireSession เด้งไปหน้าล็อกอินแล้ว

const user = session.user;
let account;
try {
  account = await getAccount();
} catch (e) {
  boot.innerHTML = `<div class="errbox" style="max-width:560px;margin:0 auto;text-align:start">
    <b>อ่านข้อมูลบัญชีไม่สำเร็จ</b>${esc(e.message)}<br><br>
    ตรวจว่ารันไฟล์ SQL ครบทั้ง 3 ไฟล์แล้วหรือยัง (ดู SETUP.md ขั้นที่ 3)</div>`;
  throw e;
}
touchLastSeen();

/* ---------------- แถบบัญชี ---------------- */
bar.innerHTML = `
  <div class="pbar">
    <a href="app.html" aria-current="page">แพลนเนอร์</a>
    <a href="billing.html">แผนและการชำระเงิน</a>
    ${account.is_admin ? '<a href="admin.html">จัดการผู้ใช้</a>' : ''}
    <span class="sp"></span>
    <span class="who">
      ${account.avatar_url
        ? `<img src="${esc(account.avatar_url)}" alt="" referrerpolicy="no-referrer">`
        : ''}
      <span>${esc(account.full_name || account.email)}</span>
    </span>
    <button id="out">ออกจากระบบ</button>
  </div>`;
document.getElementById('out').addEventListener('click', signOut);

/* ---------------- แจ้งเตือนสถานะสิทธิ์ ---------------- */
const readOnly = !account.has_access;
const daysLeft = account.current_period_end
  ? Math.ceil((new Date(account.current_period_end) - Date.now()) / 864e5)
  : null;

if (readOnly) {
  notice.innerHTML = `
    <div class="pnotice bad">
      <span class="sp"><b>สิทธิ์การใช้งานหมดอายุแล้ว</b> —
      ข้อมูลเดิมของคุณยังอยู่ครบและเปิดอ่านได้ แต่บันทึกการแก้ไขใหม่ไม่ได้จนกว่าจะต่ออายุ</span>
      <a class="cta" href="billing.html">ต่ออายุ</a>
    </div>`;
} else if (account.status === 'trialing' && daysLeft !== null && daysLeft <= 7) {
  notice.innerHTML = `
    <div class="pnotice warn">
      <span class="sp">ทดลองใช้เหลืออีก <b>${daysLeft}</b> วัน (ถึง ${fmtDate(account.current_period_end)})</span>
      <a class="cta" href="billing.html">เลือกแผน</a>
    </div>`;
} else if (daysLeft !== null && daysLeft <= 7) {
  notice.innerHTML = `
    <div class="pnotice warn">
      <span class="sp">แผน${PLAN_LABEL[account.plan] || ''}จะหมดอายุใน <b>${daysLeft}</b> วัน</span>
      <a class="cta" href="billing.html">ต่ออายุ</a>
    </div>`;
}

/* =============================================================
   ที่เก็บข้อมูล
   ชั้นที่ 1 : localStorage แยกตามผู้ใช้ — ให้เปิดมาเห็นข้อมูลทันทีแม้เน็ตช้า
   ชั้นที่ 2 : Supabase — แหล่งความจริง ซิงก์ข้ามเครื่อง
   ============================================================= */
const CACHE_KEY = `adhd-planner-v1:${user.id}`;

let cache = null;
try { cache = localStorage.getItem(CACHE_KEY); } catch { cache = null; }

// ดึงของจริงจากเซิร์ฟเวอร์ก่อนสตาร์ตแอป — ฝั่งที่บันทึกล่าสุดชนะ
let remoteRow = null;
try {
  remoteRow = await loadPlannerState(user.id);
} catch (e) {
  console.warn('[planner] โหลดข้อมูลจากเซิร์ฟเวอร์ไม่สำเร็จ ใช้ข้อมูลในเครื่องแทน', e);
}

if (remoteRow && remoteRow.data && Object.keys(remoteRow.data).length) {
  const localSavedAt = (() => {
    try { return JSON.parse(cache || '{}').savedAt || 0; } catch { return 0; }
  })();
  const remoteSavedAt = remoteRow.data.savedAt || 0;
  if (remoteSavedAt >= localSavedAt) cache = JSON.stringify(remoteRow.data);
}

window.__PLANNER_STORE__ = {
  read:  () => cache,
  write: v => { cache = v; try { localStorage.setItem(CACHE_KEY, v); } catch { /* โควตาเต็ม */ } },
  clear: () => { cache = null; try { localStorage.removeItem(CACHE_KEY); } catch { /* ไม่เป็นไร */ } }
};

/* ---------------- ซิงก์ขึ้นเซิร์ฟเวอร์ ---------------- */
const badgeSet = (cls, text) => {
  const b = document.getElementById('syncBadge');
  if (b) { b.className = 'sync ' + cls; b.innerHTML = `<i></i> ${text}`; }
};

if (readOnly) {
  window.__PLANNER_SYNC__ = () => badgeSet('local', 'อ่านอย่างเดียว');
} else {
  let timer = null, failed = false;
  window.__PLANNER_SYNC__ = json => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      badgeSet('on', 'กำลังบันทึก…');
      try {
        await savePlannerState(user.id, JSON.parse(json));
        failed = false;
        badgeSet('on', 'บันทึกแล้ว');
      } catch (e) {
        console.warn('[planner] บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ', e);
        badgeSet('local', 'บันทึกไม่ขึ้น — เก็บในเครื่องไว้ก่อน');
        // 42501 = RLS ปฏิเสธ แปลว่าสิทธิ์เพิ่งหมดอายุระหว่างใช้งาน
        if (!failed && (e.code === '42501' || /row-level security/i.test(e.message || ''))) {
          failed = true;
          location.reload();
        }
      }
    }, 1200);
  };
}

/* ---------------- สตาร์ตแพลนเนอร์ ---------------- */
boot.remove();
shell.hidden = false;

const s = document.createElement('script');
s.src = 'planner/app.js';
s.onload = () => badgeSet(readOnly ? 'local' : 'on', readOnly ? 'อ่านอย่างเดียว' : 'ซิงก์กับบัญชีแล้ว');
s.onerror = () => { shell.hidden = true; boot.textContent = 'โหลดไฟล์แพลนเนอร์ไม่สำเร็จ'; };
document.body.appendChild(s);
