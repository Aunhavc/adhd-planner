/* ===========================================================
   Ultimate ADHD Planner — Local-First Web App
   ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น
   ไม่มีการส่งข้อมูลออกไปที่เซิร์ฟเวอร์ใด ๆ
   =========================================================== */
'use strict';

const KEY = 'adhd-planner-v1';
const DAY_TH = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
const DAY_SHORT = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ---------- date helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
/** 0 = จันทร์ ... 6 = อาทิตย์ */
const dowMon = s => (parseISO(s).getDay() + 6) % 7;
const mondayOf = s => addDays(s, -dowMon(s));
const monthKey = s => s.slice(0, 7);

function weekKey(s) {
  const d = parseISO(s);
  d.setDate(d.getDate() + 3 - dowMon(s));           // วันพฤหัสของสัปดาห์นั้น = ตัวกำหนดปีตาม ISO-8601
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d - jan4) / 864e5 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${pad(week)}`;
}
const fmtDate = s => {
  const d = parseISO(s);
  return `${DAY_SHORT[dowMon(s)]} ${d.getDate()} ${MONTH_TH[d.getMonth()]} ${d.getFullYear()}`;
};

/* ---------- misc helpers ---------- */
const uid = () => 'i' + Math.random().toString(36).slice(2, 9);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = sel => document.querySelector(sel);

/* ===========================================================
   1) STATE
   =========================================================== */
const newFocus = () => ({ t: '', done: false, steps: [] });
const newDay = () => ({
  brainDump: '', focus: [newFocus(), newFocus(), newFocus()], water: 0,
  energy: '', mood: '', notToday: [], quickDone: [], quickExtra: [],
  meals: { b: '', l: '', d: '' }, notes: '', rewards: [],
  proud: '', forgiven: false
});
const newWeek = () => ({
  overview: Array.from({ length: 7 }, () => ({ t: '', done: false })),
  routineChecks: {}, wins: '', learn: ''
});

const DEFAULTS = () => ({
  v: 1, owner: '', startDate: todayISO(), theme: 'auto', tab: 'focus',
  days: {}, weeks: {}, goals: [],
  dopamine: {
    small: ['ฟังเพลงโปรด 1 เพลง', 'ลุกไปยืดเส้นยืดสาย', 'ออกไปรับแดด 2 นาที'].map(t => ({ id: uid(), t })),
    mid: ['ชงเครื่องดื่มแก้วโปรด', 'เล่นเกมสั้น ๆ 1 ตา', 'นอนแผ่ 15 นาที'].map(t => ({ id: uid(), t })),
    big: ['ดูซีรีส์ 1 ตอน', 'สั่งของอร่อยมากิน', 'ออกไปเดินเล่นนอกบ้าน'].map(t => ({ id: uid(), t }))
  },
  quickLib: ['ตอบอีเมล/แชท 1 ข้อความ', 'เก็บขยะบนโต๊ะทำงาน', 'ยืดเหยียดร่างกาย 5 นาที', 'ล้างแก้วน้ำ'].map(t => ({ id: uid(), t })),
  routines: [
    { id: uid(), name: 'ดื่มน้ำ 1 แก้วหลังตื่น', slot: 'เช้า' },
    { id: uid(), name: 'เก็บโต๊ะก่อนนอน', slot: 'ก่อนนอน' }
  ],
  passwords: [], bills: [], billPaid: {}, inbox: []
});

/* ที่เก็บข้อมูล — ค่าเริ่มต้นคือ localStorage
   เวอร์ชันบนเว็บจะตั้ง window.__PLANNER_STORE__ ไว้ก่อนโหลดไฟล์นี้ เพื่อเก็บบนบัญชีแทน */
const STORE = window.__PLANNER_STORE__ || {
  read: () => localStorage.getItem(KEY),
  write: v => localStorage.setItem(KEY, v),
  clear: () => localStorage.removeItem(KEY)
};

let S = load();
let cur = todayISO();

/** เติมฟิลด์ที่ขาดให้ข้อมูลเก่า เพื่อไม่ให้ renderer พังเมื่อ schema เพิ่มขึ้น */
function normalize(st) {
  Object.keys(st.days).forEach(k => {
    const d = st.days[k] = Object.assign(newDay(), st.days[k]);
    d.meals = Object.assign({ b: '', l: '', d: '' }, d.meals);
    while (d.focus.length < 3) d.focus.push(newFocus());
    d.focus.forEach(f => { f.steps ||= []; });
  });
  Object.keys(st.weeks).forEach(k => {
    const w = st.weeks[k] = Object.assign(newWeek(), st.weeks[k]);
    while (w.overview.length < 7) w.overview.push({ t: '', done: false });
  });
  st.goals.forEach(g => { g.steps ||= []; });
  return st;
}

function load() {
  try {
    const raw = STORE.read();
    if (!raw) return DEFAULTS();
    return normalize(Object.assign(DEFAULTS(), JSON.parse(raw)));
  } catch (e) {
    console.warn('[planner] อ่านข้อมูลเดิมไม่สำเร็จ ใช้ค่าเริ่มต้นแทน', e);
    return DEFAULTS();
  }
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    S.savedAt = Date.now();
    const json = JSON.stringify(S);
    try { STORE.write(json); }
    catch (e) { toast('⚠️ บันทึกไม่สำเร็จ — พื้นที่เก็บข้อมูลอาจเต็ม'); }
    try { window.__PLANNER_SYNC__ && window.__PLANNER_SYNC__(json); } catch (e) { /* ซิงก์ล้มเหลวไม่ควรทำให้แอปพัง */ }
  }, 250);
}

/** ให้ตัวซิงก์เรียกเมื่อพบข้อมูลบนบัญชีที่ใหม่กว่าในเครื่อง */
function applyRemoteState(obj) {
  S = normalize(Object.assign(DEFAULTS(), obj));
  try { STORE.write(JSON.stringify(S)); } catch (e) { /* ไม่เป็นไร */ }
  render();
}

/** วันปัจจุบัน (สร้างขึ้นเมื่อถูกเรียกครั้งแรก) */
const D = () => (S.days[cur] ||= newDay());
/** สัปดาห์ปัจจุบัน */
const W = () => (S.weeks[weekKey(cur)] ||= newWeek());

/* ===========================================================
   2) MODULES
   =========================================================== */
const MODULES = [
  { id: 'braindump', num: '02', icon: '🌪️', title: 'Brain Dump', group: 'วันนี้' },
  { id: 'focus', num: '04', icon: '🎯', title: 'Rule of 3', group: 'วันนี้' },
  { id: 'quick', num: '10', icon: '⏱️', title: 'งานจิ๋ว 5 นาที', group: 'วันนี้' },
  { id: 'nottoday', num: '08', icon: '🛑', title: 'Not Today List', group: 'วันนี้' },
  { id: 'energy', num: '09', icon: '⚡', title: 'พลังงาน & อารมณ์', group: 'วันนี้' },
  { id: 'meals', num: '11', icon: '🍳', title: 'วางแผนมื้ออาหาร', group: 'วันนี้' },
  { id: 'notes', num: '15', icon: '🎨', title: 'พื้นที่โน้ตอิสระ', group: 'วันนี้' },
  { id: 'close', num: '🌙', icon: '🌙', title: 'สรุปสิ้นวัน', group: 'วันนี้' },

  { id: 'weekly', num: '05', icon: '📈', title: 'ภาพรวมสัปดาห์', group: 'สัปดาห์' },
  { id: 'routine', num: '07', icon: '🔄', title: 'เช็กลิสต์กิจวัตร', group: 'สัปดาห์' },
  { id: 'wreview', num: '14', icon: '⭐', title: 'ทบทวนแบบใจดี', group: 'สัปดาห์' },

  { id: 'dopamine', num: '03', icon: '🎁', title: 'Dopamine Menu', group: 'คลังข้อมูล' },
  { id: 'breakdown', num: '06', icon: '🧩', title: 'ย่อยเป้าหมายใหญ่', group: 'คลังข้อมูล' },
  { id: 'inbox', num: '02', icon: '📥', title: 'คลัง Brain Dump', group: 'คลังข้อมูล' },
  { id: 'bills', num: '13', icon: '💳', title: 'ติดตามบิล', group: 'คลังข้อมูล' },
  { id: 'passwords', num: '12', icon: '🔑', title: 'คำใบ้รหัสผ่าน', group: 'คลังข้อมูล' },

  { id: 'cover', num: '01', icon: '📔', title: 'หน้าปก & ตั้งค่า', group: 'ระบบ' }
];

/* ---------- reusable fragments ---------- */
const card = (icon, title, num, hint, body) => `
  <section class="card">
    <h2>${icon} ${esc(title)} ${num ? `<span class="pill">${esc(num)}</span>` : ''}</h2>
    ${hint ? `<p class="hint">${hint}</p>` : ''}
    ${body}
  </section>`;

const textRow = (path, val, ph, extra = '') =>
  `<input type="text" data-bind="${path}" value="${esc(val)}" placeholder="${esc(ph)}" ${extra}>`;

const checkbox = (path, on) =>
  `<input type="checkbox" class="chk" data-bind="${path}" ${on ? 'checked' : ''}>`;

const emptyMsg = t => `<p class="empty">${esc(t)}</p>`;

/* ===========================================================
   3) RENDERERS
   =========================================================== */
const R = {};

/* --- 02 Brain Dump --- */
R.braindump = () => {
  const d = D();
  return card('🌪️', 'Morning Brain Dump', '02',
    'เขียนทุกสิ่งที่กวนใจหรือค้างคาในหัวตอนนี้ ปล่อยให้ไหลออกมาโดยไม่ต้องจัดระเบียบ ไม่ต้องสวย ไม่ต้องเรียง',
    `<textarea data-bind="day.brainDump" placeholder="เทออกมาเลย..." style="min-height:220px">${esc(d.brainDump)}</textarea>
     <div class="row" style="margin-top:12px">
       <button class="btn" data-act="dump-archive">📥 ส่งเข้าคลัง Brain Dump</button>
       <button class="btn" data-act="dump-to-focus">🎯 ยกไปเป็นงานสำคัญวันนี้</button>
     </div>`);
};

/* --- 04 Rule of 3 --- */
R.focus = () => {
  const d = D();
  const rankName = ['งานสำคัญที่สุด', 'งานรองลงมา', 'ถ้ามีเวลาค่อยทำ'];
  const items = d.focus.map((f, i) => `
    <div class="focus rank${i + 1}">
      <div class="head">
        ${checkbox(`day.focus.${i}.done`, f.done)}
        <input type="text" data-bind="day.focus.${i}.t" value="${esc(f.t)}"
               placeholder="${i + 1}. ${rankName[i]}" class="${f.done ? 'done' : ''}">
      </div>
      <div class="steps">
        ${f.steps.map((s, j) => `
          <div class="row">
            ${checkbox(`day.focus.${i}.steps.${j}.done`, s.done)}
            <input type="text" data-bind="day.focus.${i}.steps.${j}.t" value="${esc(s.t)}"
                   placeholder="สเตปย่อย ${j + 1}" class="${s.done ? 'done' : ''}">
            <button class="icon" data-act="step-del" data-i="${i}" data-j="${j}" title="ลบ">✕</button>
          </div>`).join('')}
        <div><button class="btn ghost" data-act="step-add" data-i="${i}">+ เพิ่มสเตปย่อย</button></div>
      </div>
    </div>`).join('');

  const cups = Array.from({ length: 8 }, (_, i) =>
    `<div class="cup ${i < d.water ? 'on' : ''}" data-act="water" data-i="${i}">${i < d.water ? '💧' : ''}</div>`).join('');

  return carryOverBlock() + card('🎯', 'Daily Focus — Rule of 3', '04',
    'เลือกงานสำคัญที่สุดมาแค่ 3 อย่าง เพื่อไม่ให้สมองเกิดภาวะท่วมท้น (Overwhelm)',
    items) +
    card('💧', 'ตัวนับการดื่มน้ำ', '04', `วันนี้ดื่มไปแล้ว ${d.water} / 8 แก้ว`,
      `<div class="water">${cups}</div>`);
};

/** งานค้างจาก 14 วันก่อนหน้าที่ยังไม่เสร็จ */
function pendingCarry() {
  const out = [];
  for (let k = 1; k <= 14; k++) {
    const key = addDays(cur, -k);
    const day = S.days[key];
    if (!day) continue;
    day.focus.forEach((f, i) => {
      if (f.t.trim() && !f.done && !f.moved) out.push({ date: key, i, t: f.t });
    });
  }
  return out;
}
function carryOverBlock() {
  const p = pendingCarry();
  if (!p.length) return '';
  return `<div class="carry">
    <h3>⏳ งานค้างจากวันก่อนหน้า (${p.length} รายการ)</h3>
    ${p.slice(0, 8).map(x => `
      <div class="list-item">
        <span>${esc(x.t)} <small style="color:var(--muted)">· ${fmtDate(x.date)}</small></span>
        <button class="btn ghost" data-act="carry-pull" data-date="${x.date}" data-i="${x.i}">→ วันนี้</button>
        <button class="btn ghost" data-act="carry-drop" data-date="${x.date}" data-i="${x.i}" title="ปล่อยวาง">🕊️</button>
      </div>`).join('')}
  </div>`;
}

/* --- 10 Quick Wins --- */
R.quick = () => {
  const d = D();
  const lib = S.quickLib.map(q => `
    <div class="list-item">
      <input type="checkbox" class="chk" data-act="quick-toggle" data-id="${q.id}" ${d.quickDone.includes(q.id) ? 'checked' : ''}>
      <span class="${d.quickDone.includes(q.id) ? 'done' : ''}">${esc(q.t)}</span>
      <button class="icon" data-act="quicklib-del" data-id="${q.id}">✕</button>
    </div>`).join('');
  const done = d.quickDone.length;
  return card('⏱️', '5-Minute Tasks (Quick Wins)', '10',
    'สำหรับตอนที่สมองตื้อแต่อยากได้ความรู้สึกสำเร็จ — เลือกอันไหนก็ได้ที่ทำจบใน 5 นาที',
    `${lib || emptyMsg('ยังไม่มีงานจิ๋วในคลัง')}
     <div class="row" style="margin-top:12px">
       <input type="text" id="newQuick" placeholder="เพิ่มงานจิ๋วเข้าคลัง..." style="flex:1;min-width:200px">
       <button class="btn primary" data-act="quicklib-add">+ เพิ่ม</button>
     </div>
     ${done ? `<p class="hint" style="margin-top:14px">🎉 วันนี้เก็บ Quick Win ไปแล้ว <b>${done}</b> อย่าง — เก่งมาก</p>` : ''}`);
};

/* --- 08 Not Today --- */
R.nottoday = () => {
  const d = D();
  const list = d.notToday.map((x, i) => `
    <div class="list-item">
      ${checkbox(`day.notToday.${i}.done`, x.done)}
      <span class="${x.done ? 'done' : ''}">${esc(x.t)}</span>
      <button class="btn ghost" data-act="nt-tofocus" data-i="${i}">→ งานสำคัญ</button>
      <button class="icon" data-act="nt-del" data-i="${i}">✕</button>
    </div>`).join('');
  return card('🛑', 'Not Today List', '08',
    'งานหรือไอเดียที่แวบเข้ามาตอนกำลังยุ่ง จดไว้ตรงนี้ก่อน จะได้ไม่ลืมแต่ยังไม่ต้องทำวันนี้',
    `${list || emptyMsg('ยังไม่มีอะไรค้างไว้ — สมองโล่ง 👍')}
     <div class="row" style="margin-top:12px">
       <input type="text" id="newNT" placeholder="ไอเดียหรืองานที่แทรกเข้ามา..." style="flex:1;min-width:200px">
       <button class="btn primary" data-act="nt-add">+ พักไว้ก่อน</button>
     </div>`);
};

/* --- 09 Energy & Mood --- */
R.energy = () => {
  const d = D();
  const E = [['🔋', 'พลังล้น'], ['🔅', 'ปานกลาง'], ['🪫', 'แบตหมด']];
  const M = [['😊', 'แฮปปี้'], ['😐', 'เฉย ๆ'], ['😔', 'เหนื่อยใจ']];
  const btns = (arr, field, val) => arr.map(([e, t]) =>
    `<button class="${val === t ? 'sel' : ''}" data-act="set-${field}" data-v="${t}">${e} ${t}</button>`).join('');

  const week = Array.from({ length: 7 }, (_, i) => {
    const k = addDays(mondayOf(cur), i);
    const dd = S.days[k];
    const emo = dd ? (E.find(e => e[1] === dd.energy)?.[0] || '·') : '·';
    return `<div class="d ${k === cur ? 'today' : ''}"><b>${emo}</b>${DAY_SHORT[i]}</div>`;
  }).join('');

  const rest = d.energy === 'แบตหมด'
    ? `<div class="note">🪫 วันนี้แบตหมด — ระบบแนะนำให้ <b>ตัด Rule of 3 เหลืองานเดียว</b> แล้วเก็บที่เหลือไว้พรุ่งนี้ การพักคือส่วนหนึ่งของแผน ไม่ใช่ความล้มเหลว</div>`
    : '';

  return card('⚡', 'Energy & Mood Tracker', '09',
    'ประเมินตามความจริง ไม่ต้องฝืน — ข้อมูลนี้มีไว้ปรับแผน ไม่ได้มีไว้ตัดสินตัวเอง',
    `${rest}
     <label class="field">ระดับพลังงานวันนี้</label>
     <div class="choice">${btns(E, 'energy', d.energy)}</div>
     <label class="field" style="margin-top:16px">อารมณ์วันนี้</label>
     <div class="choice">${btns(M, 'mood', d.mood)}</div>
     <label class="field" style="margin-top:18px">พลังงานตลอดสัปดาห์นี้</label>
     <div class="mini">${week}</div>`);
};

/* --- 11 Meals --- */
R.meals = () => {
  const d = D();
  return card('🍳', 'Simple Meal Planner', '11',
    'ตัดสินใจล่วงหน้าเพื่อลดความล้าในการตัดสินใจ (Decision Fatigue) ตอนหิว',
    `<div class="grid2">
      <div><label class="field">มื้อเช้า</label>${textRow('day.meals.b', d.meals.b, 'เช่น ไข่ต้ม + กาแฟ')}</div>
      <div><label class="field">มื้อกลางวัน</label>${textRow('day.meals.l', d.meals.l, 'เช่น ข้าวกะเพรา')}</div>
      <div><label class="field">มื้อเย็น</label>${textRow('day.meals.d', d.meals.d, 'เช่น ต้มจืด')}</div>
     </div>`);
};

/* --- 15 Free notes --- */
R.notes = () => card('🎨', 'Free Space / Notes', '15',
  'พื้นที่อิสระสำหรับ Mind Map โยงเส้น หรือจดอะไรก็ได้ที่ไม่เข้าพวกกับช่องอื่น',
  `<textarea data-bind="day.notes" placeholder="เขียนอะไรก็ได้..." style="min-height:300px">${esc(D().notes)}</textarea>`);

/* --- End of day --- */
R.close = () => {
  const d = D();
  const total = d.focus.filter(f => f.t.trim()).length;
  const done = d.focus.filter(f => f.t.trim() && f.done).length;
  const left = d.focus.filter(f => f.t.trim() && !f.done);
  return card('🌙', 'End of Day Review — ปิดจ็อบ', '',
    'ทบทวนแบบใจดีกับตัวเอง แล้วปิดวันให้สนิท',
    `<div class="stat">
       <div class="s"><b>${done}/${total || 0}</b><span>งานสำคัญที่ปิดได้</span></div>
       <div class="s"><b>${d.quickDone.length}</b><span>Quick Wins</span></div>
       <div class="s"><b>${d.water}/8</b><span>แก้วน้ำ</span></div>
       <div class="s"><b>${d.rewards.length}</b><span>รางวัลที่ให้ตัวเอง</span></div>
     </div>
     <label class="field" style="margin-top:20px">ความภูมิใจวันนี้ (เรื่องเล็ก ๆ ก็ได้)</label>
     <textarea data-bind="day.proud" placeholder="วันนี้ฉันทำ ... ได้ และนั่นก็นับ" style="min-height:90px">${esc(d.proud)}</textarea>
     ${left.length ? `<div class="note" style="margin-top:16px">
        ยังเหลือ <b>${left.length}</b> งานที่ไม่ได้ทำ: ${left.map(f => esc(f.t)).join(' · ')}<br>
        มันจะไปโผล่ในหัวข้อ “งานค้างจากวันก่อนหน้า” ของพรุ่งนี้ให้เอง ไม่ต้องกลัวลืม
     </div>` : ''}
     <div class="list-item" style="margin-top:16px;border:0">
       ${checkbox('day.forgiven', d.forgiven)}
       <span><b>ปล่อยวางความรู้สึกผิด</b> — งานที่ยังไม่เสร็จวันนี้ เอาไว้ไปต่อพรุ่งนี้อย่างสบายใจ 💤</span>
     </div>
     ${d.forgiven ? `<p class="hint" style="color:var(--ok)">✅ ปิดวันเรียบร้อย ราตรีสวัสดิ์</p>` : ''}
     <div class="row" style="margin-top:8px">
       <button class="btn" data-act="export-md">⬇ ส่งออกวันนี้เป็น Markdown (สำหรับ Obsidian)</button>
     </div>`);
};

/* --- 05 Weekly overview --- */
R.weekly = () => {
  const w = W(), mon = mondayOf(cur);
  const rows = w.overview.map((o, i) => {
    const dk = addDays(mon, i);
    return `<tr>
      <td style="width:120px"><b>${DAY_TH[i]}</b><br><small style="color:var(--muted)">${fmtDate(dk).slice(4)}</small></td>
      <td>${textRow(`week.overview.${i}.t`, o.t, 'นัดหมาย / สิ่งสำคัญ')}</td>
      <td class="c" style="width:60px">${checkbox(`week.overview.${i}.done`, o.done)}</td>
    </tr>`;
  }).join('');
  return card('📈', `Weekly Overview — ${weekKey(cur)}`, '05',
    'มองภาพกว้างของสัปดาห์เพื่อแก้ปัญหาภาวะตาบอดเวลา (Time Blindness)',
    `<table><thead><tr><th>วัน</th><th>นัดหมาย / สิ่งสำคัญ</th><th class="c">เสร็จ</th></tr></thead><tbody>${rows}</tbody></table>`);
};

/* --- 07 Routine checker --- */
R.routine = () => {
  const w = W();
  const rows = S.routines.map(r => {
    const checks = w.routineChecks[r.id] ||= Array(7).fill(false);
    const cells = checks.map((c, i) =>
      `<td class="c"><input type="checkbox" class="chk" style="margin:auto" data-act="routine-toggle" data-id="${r.id}" data-i="${i}" ${c ? 'checked' : ''}></td>`).join('');
    const hit = checks.filter(Boolean).length;
    return `<tr>
      <td><small style="color:var(--muted)">${esc(r.slot)}</small><br>${esc(r.name)}</td>
      ${cells}
      <td class="c"><small>${hit}/7</small></td>
      <td class="c"><button class="icon" data-act="routine-del" data-id="${r.id}">✕</button></td>
    </tr>`;
  }).join('');
  return card('🔄', 'Routine Checker', '07',
    'ทำได้บ้างไม่ได้บ้างก็ยังนับ — เป้าหมายคือความสม่ำเสมอ ไม่ใช่ความสมบูรณ์แบบ',
    `<table>
       <thead><tr><th>กิจวัตร</th>${DAY_SHORT.map(d => `<th class="c">${d}</th>`).join('')}<th class="c">รวม</th><th></th></tr></thead>
       <tbody>${rows || `<tr><td colspan="10">${emptyMsg('ยังไม่มีกิจวัตร')}</td></tr>`}</tbody>
     </table>
     <div class="row" style="margin-top:14px">
       <select id="newRoutineSlot" style="width:auto"><option>เช้า</option><option>กลางวัน</option><option>ก่อนนอน</option></select>
       <input type="text" id="newRoutine" placeholder="ชื่อกิจวัตร..." style="flex:1;min-width:180px">
       <button class="btn primary" data-act="routine-add">+ เพิ่ม</button>
     </div>`);
};

/* --- 14 Weekly review --- */
R.wreview = () => {
  const w = W(), mon = mondayOf(cur);
  let done = 0, total = 0, water = 0, energyDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = S.days[addDays(mon, i)];
    if (!d) continue;
    d.focus.forEach(f => { if (f.t.trim()) { total++; if (f.done) done++; } });
    water += d.water;
    if (d.energy) energyDays++;
  }
  return card('⭐', `Gentle Weekly Review — ${weekKey(cur)}`, '14',
    'ทบทวนแบบใจดี ไม่ใช่แบบไล่บี้ตัวเอง',
    `<div class="stat">
       <div class="s"><b>${done}</b><span>งานสำคัญที่ปิดได้</span></div>
       <div class="s"><b>${total ? Math.round(done / total * 100) : 0}%</b><span>อัตราสำเร็จ</span></div>
       <div class="s"><b>${water}</b><span>แก้วน้ำรวม</span></div>
       <div class="s"><b>${energyDays}/7</b><span>วันที่บันทึกพลังงาน</span></div>
     </div>
     <label class="field" style="margin-top:20px">สิ่งที่ทำสำเร็จสัปดาห์นี้ (ชมตัวเองหน่อย!)</label>
     <textarea data-bind="week.wins" style="min-height:100px">${esc(w.wins)}</textarea>
     <label class="field" style="margin-top:14px">สิ่งที่เรียนรู้ / อยากปรับให้ง่ายขึ้น</label>
     <textarea data-bind="week.learn" style="min-height:100px">${esc(w.learn)}</textarea>`);
};

/* --- 03 Dopamine menu --- */
R.dopamine = () => {
  const d = D();
  const tiers = [['small', '🍬 รางวัลด่วน (2–5 นาที)'], ['mid', '🍰 รางวัลกลาง (10–30 นาที)'], ['big', '🎂 รางวัลใหญ่ (เมื่องานจบ)']];
  const body = tiers.map(([k, label]) => `
    <div class="tier">
      <h3>${label}</h3>
      ${S.dopamine[k].map(r => `
        <div class="reward">
          <span>${esc(r.t)}</span>
          <button class="claim" data-act="reward-claim" data-id="${r.id}">🎉 ให้รางวัลตัวเอง</button>
          <button class="icon" data-act="reward-del" data-tier="${k}" data-id="${r.id}">✕</button>
        </div>`).join('') || emptyMsg('ยังไม่มีรายการ')}
      <div class="row" style="margin-top:10px">
        <input type="text" id="newRw-${k}" placeholder="เพิ่มรางวัล..." style="flex:1;min-width:180px">
        <button class="btn" data-act="reward-add" data-tier="${k}">+ เพิ่ม</button>
      </div>
    </div>`).join('');

  const claimed = d.rewards.length
    ? `<div class="note">🎁 วันนี้ให้รางวัลตัวเองไปแล้ว: ${d.rewards.map(r => esc(r.t)).join(' · ')}</div>` : '';

  return card('🎁', 'Dopamine Menu', '03',
    'ทำสเตปย่อยเสร็จเมื่อไหร่ ให้รางวัลตัวเองทันที — dopamine คือเชื้อเพลิง ไม่ใช่ของฟุ่มเฟือย',
    claimed + body);
};

/* --- 06 Task breakdown --- */
R.breakdown = () => {
  const list = S.goals.map((g, i) => {
    const done = g.steps.filter(s => s.done).length;
    const pct = g.steps.length ? Math.round(done / g.steps.length * 100) : 0;
    return `<div class="tier">
      <div class="row">
        <input type="text" data-bind="s.goals.${i}.title" value="${esc(g.title)}" placeholder="เป้าหมายใหญ่..." style="flex:1;font-weight:600">
        <button class="icon" data-act="goal-del" data-i="${i}">✕</button>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small style="color:var(--muted)">${done}/${g.steps.length} สเตป · ${pct}%</small>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
        ${g.steps.map((s, j) => `
          <div class="row">
            ${checkbox(`s.goals.${i}.steps.${j}.done`, s.done)}
            <input type="text" data-bind="s.goals.${i}.steps.${j}.t" value="${esc(s.t)}" placeholder="ขั้นที่ ${j + 1}" style="flex:1" class="${s.done ? 'done' : ''}">
            <button class="btn ghost" data-act="goal-tofocus" data-i="${i}" data-j="${j}" title="ยกไปเป็นงานวันนี้">→</button>
            <button class="icon" data-act="gstep-del" data-i="${i}" data-j="${j}">✕</button>
          </div>`).join('')}
        <div><button class="btn ghost" data-act="gstep-add" data-i="${i}">+ เพิ่มขั้นตอน</button></div>
      </div>
    </div>`;
  }).join('');

  return card('🧩', 'Task Breakdown', '06',
    'ย่อยเป้าหมายใหญ่เป็นสเตปเล็ก ๆ จนแต่ละขั้นเล็กพอที่จะเริ่มได้ทันทีโดยไม่ต้องรวบรวมพลังใจ',
    `${list || emptyMsg('ยังไม่มีเป้าหมายใหญ่')}
     <button class="btn primary" data-act="goal-add" style="margin-top:8px">+ เพิ่มเป้าหมายใหญ่</button>`);
};

/* --- Brain dump inbox --- */
R.inbox = () => {
  const list = S.inbox.map((x, i) => `
    <div class="list-item">
      <span><small style="color:var(--muted)">${fmtDate(x.date)}</small><br>${esc(x.t).replace(/\n/g, '<br>')}</span>
      <button class="icon" data-act="inbox-del" data-i="${i}">✕</button>
    </div>`).join('');
  return card('📥', 'คลัง Brain Dump', '02',
    'ทุกอย่างที่เคยส่งเข้าคลังจากหน้า Brain Dump รวมอยู่ที่นี่',
    list || emptyMsg('คลังยังว่าง'));
};

/* --- 13 Bills --- */
R.bills = () => {
  const mk = monthKey(cur);
  const paid = S.billPaid[mk] ||= [];
  const rows = S.bills.map((b, i) => `
    <tr>
      <td>${textRow(`s.bills.${i}.name`, b.name, 'ชื่อบิล')}</td>
      <td style="width:110px">${textRow(`s.bills.${i}.due`, b.due, 'วันที่')}</td>
      <td style="width:120px">${textRow(`s.bills.${i}.amount`, b.amount, 'ยอดเงิน')}</td>
      <td class="c" style="width:80px"><input type="checkbox" class="chk" style="margin:auto" data-act="bill-toggle" data-id="${b.id}" ${paid.includes(b.id) ? 'checked' : ''}></td>
      <td class="c" style="width:40px"><button class="icon" data-act="bill-del" data-i="${i}">✕</button></td>
    </tr>`).join('');
  const unpaid = S.bills.length - paid.length;
  return card('💳', `Bill Tracker — เดือน ${mk}`, '13',
    'สถานะการจ่ายแยกตามเดือน เปลี่ยนเดือนที่แถบวันที่ด้านบนเพื่อดูเดือนอื่น',
    `${unpaid > 0 ? `<div class="note">⚠️ เดือนนี้ยังค้างจ่าย <b>${unpaid}</b> รายการ</div>` : ''}
     <table><thead><tr><th>รายการ</th><th>กำหนดชำระ</th><th>ยอดเงิน</th><th class="c">จ่ายแล้ว</th><th></th></tr></thead>
     <tbody>${rows || `<tr><td colspan="5">${emptyMsg('ยังไม่มีรายการบิล')}</td></tr>`}</tbody></table>
     <button class="btn primary" data-act="bill-add" style="margin-top:12px">+ เพิ่มบิล</button>`);
};

/* --- 12 Password hints --- */
R.passwords = () => {
  const rows = S.passwords.map((p, i) => `
    <tr>
      <td>${textRow(`s.passwords.${i}.site`, p.site, 'เว็บไซต์ / แอป')}</td>
      <td>${textRow(`s.passwords.${i}.user`, p.user, 'ชื่อผู้ใช้')}</td>
      <td>${textRow(`s.passwords.${i}.hint`, p.hint, 'คำใบ้ (ห้ามใส่รหัสจริง)')}</td>
      <td class="c" style="width:40px"><button class="icon" data-act="pw-del" data-i="${i}">✕</button></td>
    </tr>`).join('');
  return card('🔑', 'Password Keeper', '12',
    'แก้ปัญหาความขี้ลืมเฉพาะหน้า โดยไม่ต้องเสี่ยงเก็บรหัสจริง',
    `<div class="note">⚠️ <b>เก็บได้เฉพาะ “คำใบ้” เท่านั้น</b> — ห้ามพิมพ์รหัสผ่านจริงลงไป
       ข้อมูลนี้เก็บแบบไม่เข้ารหัสใน localStorage ของเบราว์เซอร์ ใครเปิดเครื่องนี้ได้ก็อ่านได้
       ถ้าต้องเก็บรหัสจริง ให้ใช้ password manager โดยเฉพาะ</div>
     <table><thead><tr><th>เว็บไซต์ / แอป</th><th>ชื่อผู้ใช้</th><th>คำใบ้รหัสผ่าน</th><th></th></tr></thead>
     <tbody>${rows || `<tr><td colspan="4">${emptyMsg('ยังไม่มีรายการ')}</td></tr>`}</tbody></table>
     <button class="btn primary" data-act="pw-add" style="margin-top:12px">+ เพิ่มรายการ</button>`);
};

/* --- 01 Cover / settings --- */
R.cover = () => {
  const usedDays = Object.keys(S.days).length;
  let allDone = 0;
  Object.values(S.days).forEach(d => d.focus.forEach(f => { if (f.t.trim() && f.done) allDone++; }));
  return card('📔', 'Cover Page', '01',
    '“ก้าวไปข้างหน้าในจังหวะของตัวเอง ไม่ต้องรีบ ไม่ต้องเปรียบเทียบกับใคร”',
    `<div class="grid2">
       <div><label class="field">ชื่อเจ้าของแพลนเนอร์</label>${textRow('s.owner', S.owner, 'ชื่อของคุณ')}</div>
       <div><label class="field">เริ่มใช้งานวันที่</label>
         <input type="date" data-bind="s.startDate" value="${esc(S.startDate)}"></div>
     </div>
     <div class="stat" style="margin-top:18px">
       <div class="s"><b>${usedDays}</b><span>วันที่บันทึกไว้</span></div>
       <div class="s"><b>${allDone}</b><span>งานสำคัญที่ปิดได้ทั้งหมด</span></div>
       <div class="s"><b>${S.goals.length}</b><span>เป้าหมายใหญ่</span></div>
     </div>`) +
    card('⚙️', 'ข้อมูลและการสำรอง', '',
      'ข้อมูลทั้งหมดอยู่ใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น ไม่มีการส่งออกไปที่ไหน — <b>ควรสำรองเป็นไฟล์ JSON เป็นระยะ</b> เพราะการล้าง cache เบราว์เซอร์จะลบข้อมูลทิ้ง',
      `<div class="row">
         <button class="btn primary" data-act="backup">⬇ สำรองข้อมูล (.json)</button>
         <button class="btn" data-act="restore">⬆ นำเข้าไฟล์สำรอง</button>
         <button class="btn" data-act="export-md">📝 ส่งออกวันนี้เป็น Markdown</button>
         <button class="btn" data-act="print">🖨 พิมพ์ / บันทึก PDF</button>
       </div>
       <div class="row" style="margin-top:20px">
         <button class="btn ghost" data-act="wipe">🗑 ล้างข้อมูลทั้งหมด</button>
       </div>`) +
    card('🧭', 'กฎ 3 ข้อของแพลนเนอร์นี้', '', '',
      `<ol style="margin:0;padding-inline-start:22px">
         <li><b>ไม่มีวันที่ต้องรู้สึกผิด</b> — ข้ามไปกี่วันก็กลับมาเริ่มใหม่ได้ ไม่มี streak มาไล่ล่า</li>
         <li><b>วันละ 3 อย่างพอ</b> — เกินกว่านั้นสมองจะปฏิเสธการลงมือทำ</li>
         <li><b>ทำเสร็จแล้วต้องได้รางวัล</b> — dopamine คือเชื้อเพลิง</li>
       </ol>`);
};

/* ===========================================================
   4) RENDER
   =========================================================== */
const THEMES = { auto: ['🌗', 'ธีม: ตามระบบ'], light: ['☀️', 'ธีม: สว่าง'], dark: ['🌙', 'ธีม: มืด'] };

function render() {
  // 'auto' = ไม่ประทับ attribute ปล่อยให้ prefers-color-scheme ตัดสิน
  if (S.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
  const tb = document.getElementById('themeBtn');
  if (tb) { tb.textContent = THEMES[S.theme][0]; tb.title = THEMES[S.theme][1] + ' (กดเพื่อเปลี่ยน)'; }
  $('#dateLabel').textContent = fmtDate(cur);
  $('#datePicker').value = cur;
  $('#ownerLabel').textContent = S.owner ? `แพลนเนอร์ของ ${S.owner}` : 'Local-First · ข้อมูลอยู่ในเครื่องคุณ';

  const groups = [...new Set(MODULES.map(m => m.group))];
  $('#nav').innerHTML = groups.map(g => `
    <div class="navgroup"><span>${g}</span>
      ${MODULES.filter(m => m.group === g).map(m => `
        <button class="navbtn ${S.tab === m.id ? 'active' : ''}" data-act="tab" data-id="${m.id}">
          <span class="num">${m.num}</span>${m.icon} ${m.title}
        </button>`).join('')}
    </div>`).join('');

  $('#panel').innerHTML = (R[S.tab] || R.focus)();

  // ตารางบนจอแคบต้องเลื่อนในกล่องของตัวเอง
  $('#panel').querySelectorAll('table').forEach(tb => {
    if (tb.parentElement.classList.contains('tscroll')) return;
    const box = document.createElement('div');
    box.className = 'tscroll';
    tb.parentNode.insertBefore(box, tb);
    box.appendChild(tb);
  });
}

/* ===========================================================
   5) DATA BINDING
   =========================================================== */
function ref(path) {
  const parts = path.split('.');
  let o = { day: D(), week: W(), s: S }[parts[0]];
  for (let i = 1; i < parts.length - 1; i++) o = o[parts[i]];
  return { obj: o, key: parts[parts.length - 1] };
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'datePicker') { cur = t.value || todayISO(); render(); return; }
  const path = t.dataset.bind;
  if (!path) return;
  const { obj, key } = ref(path);
  obj[key] = t.type === 'checkbox' ? t.checked : t.value;
  save();
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.bind && t.type === 'checkbox') render();   // re-render เพื่ออัปเดตสถานะ done / สถิติ
});

/* ===========================================================
   6) ACTIONS
   =========================================================== */
const readInput = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

const ACTIONS = {
  tab: b => { S.tab = b.dataset.id; },
  theme: () => { S.theme = { auto: 'light', light: 'dark', dark: 'auto' }[S.theme] || 'auto'; },
  'date-prev': () => { cur = addDays(cur, -1); },
  'date-next': () => { cur = addDays(cur, 1); },
  'date-today': () => { cur = todayISO(); },

  /* focus */
  'step-add': b => { D().focus[+b.dataset.i].steps.push({ t: '', done: false }); },
  'step-del': b => { D().focus[+b.dataset.i].steps.splice(+b.dataset.j, 1); },
  water: b => { const i = +b.dataset.i; const d = D(); d.water = d.water === i + 1 ? i : i + 1; },

  'carry-pull': b => {
    const src = S.days[b.dataset.date].focus[+b.dataset.i];
    const slot = D().focus.find(f => !f.t.trim());
    if (!slot) return toast('วันนี้ครบ 3 งานแล้ว — เอาออกสัก 1 อย่างก่อนนะ');
    slot.t = src.t; slot.steps = src.steps.map(s => ({ ...s }));
    src.moved = true;
    toast('ย้ายมาเป็นงานของวันนี้แล้ว');
  },
  'carry-drop': b => { S.days[b.dataset.date].focus[+b.dataset.i].moved = true; toast('ปล่อยวางแล้ว 🕊️'); },

  /* brain dump */
  'dump-archive': () => {
    const t = D().brainDump.trim();
    if (!t) return toast('ยังไม่มีอะไรให้ส่งเข้าคลัง');
    S.inbox.unshift({ date: cur, t });
    D().brainDump = '';
    toast('ส่งเข้าคลังแล้ว 📥');
  },
  'dump-to-focus': () => {
    const lines = D().brainDump.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) return toast('ยังไม่มีข้อความให้ยก');
    let n = 0;
    D().focus.forEach(f => { if (!f.t.trim() && lines[n]) f.t = lines[n++]; });
    if (!n) return toast('วันนี้ครบ 3 งานแล้ว');
    S.tab = 'focus';
    toast(`ยกมา ${n} งานแล้ว`);
  },
  'inbox-del': b => { S.inbox.splice(+b.dataset.i, 1); },

  /* quick wins */
  'quick-toggle': b => {
    const d = D(), id = b.dataset.id, i = d.quickDone.indexOf(id);
    if (i < 0) { d.quickDone.push(id); toast('✅ Quick Win! เก่งมาก'); } else d.quickDone.splice(i, 1);
  },
  'quicklib-add': () => {
    const t = readInput('newQuick'); if (!t) return;
    S.quickLib.push({ id: uid(), t });
  },
  'quicklib-del': b => { S.quickLib = S.quickLib.filter(q => q.id !== b.dataset.id); },

  /* not today */
  'nt-add': () => { const t = readInput('newNT'); if (!t) return; D().notToday.push({ t, done: false }); },
  'nt-del': b => { D().notToday.splice(+b.dataset.i, 1); },
  'nt-tofocus': b => {
    const item = D().notToday[+b.dataset.i];
    const slot = D().focus.find(f => !f.t.trim());
    if (!slot) return toast('วันนี้ครบ 3 งานแล้ว');
    slot.t = item.t; D().notToday.splice(+b.dataset.i, 1); S.tab = 'focus';
  },

  /* energy & mood */
  'set-energy': b => { const d = D(); d.energy = d.energy === b.dataset.v ? '' : b.dataset.v; },
  'set-mood': b => { const d = D(); d.mood = d.mood === b.dataset.v ? '' : b.dataset.v; },

  /* dopamine */
  'reward-add': b => {
    const tier = b.dataset.tier, t = readInput('newRw-' + tier); if (!t) return;
    S.dopamine[tier].push({ id: uid(), t });
  },
  'reward-del': b => { const k = b.dataset.tier; S.dopamine[k] = S.dopamine[k].filter(r => r.id !== b.dataset.id); },
  'reward-claim': b => {
    const all = [...S.dopamine.small, ...S.dopamine.mid, ...S.dopamine.big];
    const r = all.find(x => x.id === b.dataset.id); if (!r) return;
    D().rewards.push({ t: r.t });
    toast('🎉 คุณคู่ควรกับมัน — ไปรับรางวัลเลย');
  },

  /* goals */
  'goal-add': () => { S.goals.push({ title: '', steps: [{ t: '', done: false }] }); },
  'goal-del': b => { S.goals.splice(+b.dataset.i, 1); },
  'gstep-add': b => { S.goals[+b.dataset.i].steps.push({ t: '', done: false }); },
  'gstep-del': b => { S.goals[+b.dataset.i].steps.splice(+b.dataset.j, 1); },
  'goal-tofocus': b => {
    const s = S.goals[+b.dataset.i].steps[+b.dataset.j];
    if (!s.t.trim()) return toast('ใส่ชื่อขั้นตอนก่อนนะ');
    const slot = D().focus.find(f => !f.t.trim());
    if (!slot) return toast('วันนี้ครบ 3 งานแล้ว');
    slot.t = s.t; S.tab = 'focus'; toast('ยกมาเป็นงานวันนี้แล้ว');
  },

  /* routines */
  'routine-add': () => {
    const name = readInput('newRoutine'); if (!name) return;
    S.routines.push({ id: uid(), name, slot: readInput('newRoutineSlot') || 'เช้า' });
  },
  'routine-del': b => {
    S.routines = S.routines.filter(r => r.id !== b.dataset.id);
    Object.values(S.weeks).forEach(w => delete w.routineChecks[b.dataset.id]);
  },
  'routine-toggle': b => {
    const w = W(), id = b.dataset.id, i = +b.dataset.i;
    (w.routineChecks[id] ||= Array(7).fill(false))[i] = !w.routineChecks[id][i];
  },

  /* bills */
  'bill-add': () => { S.bills.push({ id: uid(), name: '', due: '', amount: '' }); },
  'bill-del': b => { S.bills.splice(+b.dataset.i, 1); },
  'bill-toggle': b => {
    const mk = monthKey(cur), id = b.dataset.id;
    const arr = S.billPaid[mk] ||= [];
    const i = arr.indexOf(id);
    if (i < 0) arr.push(id); else arr.splice(i, 1);
  },

  /* passwords */
  'pw-add': () => { S.passwords.push({ site: '', user: '', hint: '' }); },
  'pw-del': b => { S.passwords.splice(+b.dataset.i, 1); },

  /* data */
  backup: () => {
    download(`adhd-planner-backup-${todayISO()}.json`, JSON.stringify(S, null, 2), 'application/json');
    toast('สำรองข้อมูลแล้ว');
  },
  restore: () => {
    // สร้าง input ใหม่ทุกครั้ง เพราะ render() จะแทนที่ DOM เดิมระหว่างที่กล่องเลือกไฟล์เปิดอยู่
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json' });
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = () => {
        try {
          S = normalize(Object.assign(DEFAULTS(), JSON.parse(fr.result)));
          save(); render(); toast('นำเข้าข้อมูลสำเร็จ');
        } catch (err) { toast('⚠️ ไฟล์ไม่ถูกต้อง'); }
      };
      fr.readAsText(f);
    };
    inp.click();
  },
  'export-md': () => { download(`${cur}.md`, toMarkdown(), 'text/markdown'); toast('ส่งออก Markdown แล้ว — นำไปวางใน 01-Daily-Notes/'); },
  print: () => window.print(),
  wipe: () => {
    if (!confirm('ลบข้อมูลทั้งหมดถาวร? แนะนำให้กด "สำรองข้อมูล" ก่อน\n\nการกระทำนี้ย้อนกลับไม่ได้')) return;
    try { STORE.clear(); } catch (e) { /* ไม่เป็นไร */ }
    S = DEFAULTS(); cur = todayISO();
    try { window.__PLANNER_SYNC__ && window.__PLANNER_SYNC__(JSON.stringify(S)); } catch (e) { /* ไม่เป็นไร */ }
    toast('ล้างข้อมูลแล้ว');
  }
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const fn = ACTIONS[b.dataset.act];
  if (!fn) return;
  fn(b);
  save();
  render();
});

/* ===========================================================
   7) EXPORT / UTIL
   =========================================================== */
function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** สร้าง Markdown ให้ตรงรูปแบบ 00-Config/daily-template.md ของ Vault */
function toMarkdown() {
  const d = D(), w = W(), L = [];
  const cb = v => v ? '[x]' : '[ ]';
  L.push('---', 'type: daily', `date: ${cur}`, `energy: ${d.energy}`, `mood: ${d.mood}`,
    `water: ${d.water}`, 'tags: [daily, adhd-planner]', '---', '');
  L.push(`# 📅 ${fmtDate(cur)}`, '> "ก้าวไปข้างหน้าในจังหวะของตัวเอง ไม่ต้องรีบ ไม่ต้องเปรียบเทียบกับใคร"', '',
    `⬅️ [[${addDays(cur, -1)}|เมื่อวาน]] | [[${addDays(cur, 1)}|พรุ่งนี้]] ➡️`, '', '---', '');

  L.push('## 🌪️ 02 · Morning Brain Dump', '');
  L.push(...(d.brainDump.trim() ? d.brainDump.split('\n').map(x => '- ' + x) : ['- ']), '', '---', '');

  L.push('## 🎯 04 · Daily Focus — Rule of 3', '');
  const rank = ['งานสำคัญที่สุด', 'งานรองลงมา', 'ถ้ามีเวลาค่อยทำ'];
  d.focus.forEach((f, i) => {
    L.push(`- ${cb(f.done)} **${i + 1}. ${rank[i]}:** ${f.t}`);
    f.steps.forEach(s => L.push(`    - ${cb(s.done)} ${s.t}`));
  });
  L.push('', `💧 **ตัวนับการดื่มน้ำ:** ${Array.from({ length: 8 }, (_, i) => cb(i < d.water)).join(' ')}`, '', '---', '');

  L.push('## 🛑 08 · Not Today List', '');
  L.push(...(d.notToday.length ? d.notToday.map(x => `- ${cb(x.done)} ${x.t}`) : ['- [ ] ']), '', '---', '');

  L.push('## ⚡ 09 · Energy & Mood Tracker', '',
    `* **พลังงาน:** ${d.energy || '—'}`, `* **อารมณ์:** ${d.mood || '—'}`, '', '---', '');

  L.push('## ⏱️ 10 · 5-Minute Tasks (Quick Wins)', '');
  L.push(...(S.quickLib.length ? S.quickLib.map(q => `- ${cb(d.quickDone.includes(q.id))} ${q.t}`) : ['- [ ] ']), '', '---', '');

  L.push('## 🎁 03 · Dopamine ที่ให้ตัวเองวันนี้', '');
  L.push(...(d.rewards.length ? d.rewards.map(r => `- ${r.t}`) : ['- ']), '', '---', '');

  L.push('## 🍳 11 · Simple Meal Planner', '', '| มื้อ | เมนู |', '| :--- | :--- |',
    `| เช้า | ${d.meals.b} |`, `| กลางวัน | ${d.meals.l} |`, `| เย็น | ${d.meals.d} |`, '', '---', '');

  L.push('## 🎨 15 · Free Space / Notes', '');
  L.push(...(d.notes.trim() ? d.notes.split('\n').map(x => '> ' + x) : ['> ']), '', '---', '');

  L.push('## 🌙 End of Day Review (ปิดจ็อบ)', '',
    `* **ความภูมิใจวันนี้:** ${d.proud}`,
    `* ${cb(d.forgiven)} **ปล่อยวางความรู้สึกผิด:** งานที่ยังไม่เสร็จวันนี้ เอาไว้ไปต่อพรุ่งนี้อย่างสบายใจ 💤`, '');

  if (w.overview.some(o => o.t.trim())) {
    L.push('---', '', `## 📈 05 · Weekly Overview (${weekKey(cur)})`, '',
      '| วัน | นัดหมาย / สิ่งสำคัญ | สถานะ |', '| :--- | :--- | :---: |',
      ...w.overview.map((o, i) => `| **${DAY_TH[i]}** | ${o.t} | ${cb(o.done)} |`), '');
  }
  return L.join('\n');
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ---------- keyboard shortcuts ---------- */
document.addEventListener('keydown', e => {
  if (e.target.matches('input,textarea,select')) return;
  if (e.key === 'ArrowLeft') { cur = addDays(cur, -1); render(); }
  if (e.key === 'ArrowRight') { cur = addDays(cur, 1); render(); }
  if (e.key === 't' || e.key === 'T') { cur = todayISO(); render(); }
});

/* ---------- Enter เพื่อเพิ่มรายการ ---------- */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
  const map = { newQuick: 'quicklib-add', newNT: 'nt-add', newRoutine: 'routine-add' };
  let act = map[e.target.id];
  let extra = {};
  if (e.target.id.startsWith('newRw-')) { act = 'reward-add'; extra = { dataset: { tier: e.target.id.slice(6) } }; }
  if (!act) return;
  e.preventDefault();
  ACTIONS[act](extra.dataset ? extra : e.target);
  save(); render();
});

render();
