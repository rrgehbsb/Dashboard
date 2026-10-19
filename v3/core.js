/* Dashboard v3 core — session, merge-safe cloud rows, water, settings and the
   shared UI kit (icons, rings, sheets, toasts, long-press, bottom nav).
   Sync recipe (do NOT regress): getSession() before every push/pull; push =
   read cloud row → overlay only the keys changed here → stamp _pushAt; pull =
   overlay remote onto local (never wipe), change-detect with === on _pushAt;
   flush on pagehide; pull on focus/visibility plus a slow poll. */
(function () {
'use strict';

const VERSION = '2.8.5';
const SB_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
const SB_KEY = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';
const DEMO = /[?&]demo\b/.test(location.search);
const SETTINGS_LS = 'dashboard:settings:v1';

/* ================= Small helpers ================= */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
const reduced = () => !!RM.matches;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const plural = (n, one, many) => n === 1 ? one : many;
const fmtN = (n, dec) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
const ic = (n, cls) => '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
const readJSON = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dk = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const dayAt = off => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + off); return d; };
const todayKey = () => dk(new Date());
const parseDk = s => { const p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); };
const daysFrom = s => { if (!s) return null; const d = parseDk(s); if (isNaN(d)) return null; return Math.round((d - dayAt(0)) / 864e5); };
const dShort = d => DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
const dLong = d => DOW_L[d.getDay()] + ', ' + d.getDate() + ' ' + MON_L[d.getMonth()];
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };

/* ================= Supabase + session ================= */
// Signed-in user's access token, read synchronously from the Supabase session in
// localStorage. Used by the last-chance "keepalive" saves on page close: the
// database only accepts writes from the signed-in owner of a row (RLS).
window.__sbToken = window.__sbToken || function () {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!/^sb-.*-auth-token$/.test(k)) continue;
      let v = localStorage.getItem(k);
      if (v && v.slice(0, 7) === 'base64-') { try { v = decodeURIComponent(escape(atob(v.slice(7)))); } catch (e) { v = atob(v.slice(7)); } }
      const s = JSON.parse(v);
      const t = s && (s.access_token || (s.currentSession && s.currentSession.access_token));
      if (t) return t;
    }
  } catch (e) {}
  return null;
};

let _sb = null, uid = null;
function sb() { if (!_sb) _sb = window.supabase.createClient(SB_URL, SB_KEY); return _sb; }
function waitSupabase() { return new Promise(res => { (function w() { window.supabase ? res() : setTimeout(w, 40); })(); }); }
async function fresh() { try { await sb().auth.getSession(); } catch (e) {} }
async function session() {
  if (DEMO) { uid = 'demo'; return uid; }
  await waitSupabase();
  let s = null;
  try { const r = await sb().auth.getSession(); s = r.data && r.data.session; } catch (e) {}
  if (!s) { location.href = '/login.html'; return null; }
  uid = s.user.id;
  try { localStorage.setItem('_dashUid', uid); } catch (e) {}
  return uid;
}

/* ================= Merge-safe synced row ================= */
const ROWS = [];
function Row(area, opt) {
  opt = opt || {};
  const LS = 'dash3:row:' + area;
  const r = { area: area, data: DEMO ? {} : (readJSON(LS) || {}), lastRemoteAt: null, ready: false, readOnly: !!opt.readOnly };
  if (opt.seed && !DEMO) { try { opt.seed(r.data); } catch (e) {} }
  const gen = {}, dirty = new Set(), subs = [];
  let pushT = null, pushing = false;
  const mirror = () => { if (!DEMO) writeJSON(LS, r.data); };
  const key = () => uid + ':' + area;
  const emit = src => subs.forEach(f => { try { f(src); } catch (e) { console.error(e); } });

  r.get = k => r.data[k];
  r.on = f => subs.push(f);
  r.set = (k, v) => {
    r.data[k] = v; gen[k] = (gen[k] || 0) + 1; dirty.add(k);
    mirror();
    if (opt.onLocal && !DEMO) { try { opt.onLocal(k, v); } catch (e) {} }
    clearTimeout(pushT); pushT = setTimeout(push, 500);
  };
  r.pending = () => !!pushT || pushing || dirty.size > 0;

  async function push() {
    pushT = null;
    if (DEMO) { dirty.clear(); return; }
    if (!uid || !dirty.size || pushing) return;
    pushing = true;
    const keys = Array.from(dirty), snap = {};
    keys.forEach(k => { snap[k] = gen[k]; });
    try {
      await fresh();
      const res = await sb().from('app_state').select('data').eq('key', key()).maybeSingle();
      if (res.error) throw res.error;
      const cloud = (res.data && res.data.data && typeof res.data.data === 'object') ? res.data.data : {};
      const out = Object.assign({}, cloud);
      // keys holding growing collections merge entry-level (opt.merge[k]); local wins ties
      keys.forEach(k => { out[k] = (opt.merge && opt.merge[k]) ? opt.merge[k](cloud[k], r.data[k]) : r.data[k]; });
      const at = Date.now();
      out._pushAt = at;
      const up = await sb().from('app_state').upsert({ key: key(), data: out, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (up.error) throw up.error;
      keys.forEach(k => {
        if (gen[k] !== snap[k]) return;
        dirty.delete(k);
        // merged keys: keep what the cloud now holds (includes the other device's entries)
        if (opt.merge && opt.merge[k]) r.data[k] = out[k];
      });
      r.lastRemoteAt = at;
      // adopt keys other devices changed meanwhile (overlay, never wipe)
      Object.keys(cloud).forEach(k => {
        if (k === '_pushAt' || k === '_localAt' || dirty.has(k) || keys.indexOf(k) >= 0) return;
        r.data[k] = (opt.merge && opt.merge[k]) ? opt.merge[k](r.data[k], cloud[k]) : cloud[k];
      });
      mirror();
      if (opt.afterPush) { try { opt.afterPush(at); } catch (e) {} }
    } catch (e) {
      console.warn('[v3] push ' + area + ' failed, retrying', e);
      setTimeout(() => { if (dirty.size && !pushT) pushT = setTimeout(push, 0); }, 5000);
    } finally {
      pushing = false;
      if (dirty.size && !pushT) pushT = setTimeout(push, 500);
    }
  }
  r.flush = () => { if (dirty.size) { clearTimeout(pushT); return push(); } return Promise.resolve(); };

  r.pull = async force => {
    if (DEMO) { r.ready = true; emit('remote'); return; }
    if (!uid || r.pending()) return;
    try {
      await fresh();
      const res = await sb().from('app_state').select('data').eq('key', key()).maybeSingle();
      if (res.error) throw res.error;
      const data = res.data && res.data.data;
      const first = !r.ready;
      r.ready = true;
      if (!data || typeof data !== 'object') { if (first) emit('remote'); return; }
      const at = data._pushAt || 0;
      if (!force && !first && at === r.lastRemoteAt) return;
      if (r.pending()) return;
      r.lastRemoteAt = at;
      Object.keys(data).forEach(k => { if (k !== '_pushAt' && k !== '_localAt') r.data[k] = (opt.merge && opt.merge[k]) ? opt.merge[k](r.data[k], data[k]) : data[k]; });
      mirror();
      if (opt.onRemote) { try { opt.onRemote(data); } catch (e) {} }
      emit('remote');
    } catch (e) { console.warn('[v3] pull ' + area + ' failed', e); }
  };

  // Last-chance save when the app is closed mid-edit (same approach as the classic pages).
  r.keepalive = () => {
    if (DEMO || !uid || !dirty.size) return;
    const out = Object.assign({}, r.data, { _pushAt: Date.now() });
    try {
      fetch(SB_URL + '/rest/v1/app_state', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + (window.__sbToken() || SB_KEY), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ key: key(), data: out, updated_at: new Date().toISOString() })
      });
    } catch (e) {}
  };
  ROWS.push(r);
  return r;
}

/* ================= Settings (row: settings, mirrored to the classic localStorage copy) ================= */
const settings = Row('settings', {
  seed: d => { const s = readJSON(SETTINGS_LS); if (s && typeof s === 'object') Object.keys(s).forEach(k => { if (!(k in d)) d[k] = s[k]; }); },
  onLocal: () => { const s = Object.assign({}, settings.data); s._pushAt = Date.now(); writeJSON(SETTINGS_LS, s); },
  onRemote: data => { const s = Object.assign({}, readJSON(SETTINGS_LS) || {}, data); writeJSON(SETTINGS_LS, s); }
});
function setTheme(v) {
  const t = (v === 'light' || v === 'dark') ? v : 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  return t;
}
const theme = () => settings.get('v3Theme') || 'system';
const userName = () => String(settings.get('name') || '').trim();
// The classic design is retired. Its extra pages leave the old nav too (data kept,
// only settings.pages flags change), once per account. Gym/School/Food/Transport stay
// reachable until their new versions ship.
const RETIRED = ['health', 'habits', 'finance', 'projects', 'friends', 'trends'];
function retireClassicOnce() {
  if (settings.get('v3Archive')) return;
  const pages = Object.assign({}, settings.get('pages') || {});
  RETIRED.forEach(k => { pages[k] = false; });
  settings.set('pages', pages);
  settings.set('ui', 'v3');
  settings.set('v3Archive', 1);
}

/* ================= Water (lives in the health row; only po_water_v1 is read) ================= */
const WATER_LS = 'po_water_v1';
let waterRemoteAt = -1, waterLocalAt = 0;
function waterDefault() {
  return { unit: 'bottle', bottleMl: 500, glassMl: 250, weightUnit: 'kg', sizes: { cup: 250, bottle: 500, big: 1000 }, _mlV2: true,
    profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 }, caffeineMgPerDay: 200, substances: [], logs: {} };
}
let demoWater = null;
const readWater = () => DEMO ? demoWater : readJSON(WATER_LS);
const writeWater = s => { if (DEMO) demoWater = s; else writeJSON(WATER_LS, s); };
const waterState = () => { const s = readWater(); return (s && typeof s === 'object') ? JSON.parse(JSON.stringify(s)) : waterDefault(); };
function waterProgress() {
  const st = readWater();
  if (!st) return { done: 0, total: 0, ml: true, set: false };
  const done = (st.logs || {})[todayKey()] || 0;
  const p = st.profile || { weightKg: 75 };
  const wKg = st.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : (p.weightKg || 0);
  const subs = (st.substances || []).reduce((s, x) => s + Math.max(0, ((x && x.dose != null ? x.dose : (x && x.defaultDose)) || 0) * ((x && x.mlPerUnit) || 0)), 0);
  let adjust = 0;
  if (p.sex === 'm') adjust += 200;
  if ((p.age || 0) >= 50) adjust += 100;
  const totalMl = wKg * 35 + (p.activityHrsPerWeek || 0) / 7 * 500 + Math.max(0, (st.caffeineMgPerDay || 0) - 200) * 1.5 + subs + adjust;
  if (st._mlV2) return { done: done, total: Math.max(1, Math.round(totalMl)), ml: true, set: true };
  let unitVol = st.unit === 'glass' ? (st.glassMl || 250) : st.unit === 'oz' ? 30 : st.unit === 'ml' ? 1 : (st.bottleMl || 500);
  return { done: done, total: Math.max(1, Math.ceil(totalMl / unitVol)), ml: false, set: true };
}
const bottleMl = () => { const s = waterState(); return s._mlV2 ? ((s.sizes && s.sizes.bottle) || 500) : 1; };
async function pushWater(state) {
  if (DEMO || !uid) return;
  try {
    await fresh();
    const res = await sb().from('app_state').select('data').eq('key', uid + ':health').maybeSingle();
    const cur = (res.data && res.data.data) || {};
    const at = Date.now();
    const merged = Object.assign({}, cur, { po_water_v1: state, _pushAt: at });
    const up = await sb().from('app_state').upsert({ key: uid + ':health', data: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (up.error) throw up.error;
    waterRemoteAt = at;
  } catch (e) { console.warn('[v3] water push failed', e); }
}
async function pullWater(force) {
  if (DEMO || !uid) return;
  if (Date.now() - waterLocalAt < 4000) return;
  try {
    await fresh();
    const res = await sb().from('app_state').select('w:data->po_water_v1, at:data->_pushAt').eq('key', uid + ':health').maybeSingle();
    if (res.error || !res.data) return;
    const at = res.data.at || 0;
    if (!force && at === waterRemoteAt) return;
    waterRemoteAt = at;
    if (res.data.w) { writeWater(res.data.w); emitWater(); }
  } catch (e) {}
}
const waterSubs = [];
const emitWater = () => waterSubs.forEach(f => { try { f(); } catch (e) {} });
function addWater(sign) {
  const st = waterState(), k = todayKey(), inc = bottleMl();
  st.logs = st.logs || {};
  st.hist = st.hist || {};
  if (sign < 0) {
    const h = st.hist[k] || [];
    const last = h.length ? h.pop() : inc;
    st.logs[k] = Math.max(0, (st.logs[k] || 0) - last);
  } else {
    st.logs[k] = (st.logs[k] || 0) + inc;
    if (st._mlV2) (st.hist[k] = st.hist[k] || []).push(inc);
  }
  st._ts = Date.now();
  waterLocalAt = Date.now();
  writeWater(st);
  emitWater();
  pushWater(st);
}
function setBottle(ml) {
  const st = waterState();
  st.sizes = Object.assign({}, st.sizes || {}, { bottle: ml });
  st.bottleMl = ml; st._ts = Date.now();
  waterLocalAt = Date.now();
  writeWater(st); emitWater(); pushWater(st);
}
const litres = ml => fmtN(ml / 1000, 1);
function waterChip(slot) {
  const w = waterProgress();
  const label = w.ml ? litres(w.done) : String(w.done);
  return '<button class="water" id="water-' + slot + '" data-act="water-add" data-lp="water-sheet" aria-label="Water today ' + label + (w.ml ? ' litres' : '') +
    '. Tap to add a bottle, press and hold for options.">' + ring('water-' + slot, w.total ? w.done / w.total : 0, 32, 4.5) +
    numEl('water-' + slot, w.ml ? w.done / 1000 : w.done, w.ml ? 1 : 0) + '<span class="unit">' + (w.ml ? 'L' : '') + '</span></button>';
}

/* ================= Rings + count-up numbers ================= */
const prev = new Map();
function ring(k, p, size, sw) {
  const r = (size - sw) / 2, c = 2 * Math.PI * r, pp = clamp(p || 0, 0, 1), h = size / 2;
  return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true">' +
    '<circle class="ring-track" cx="' + h + '" cy="' + h + '" r="' + r + '" fill="none" stroke-width="' + sw + '"/>' +
    '<circle class="ring-fill" data-ring="' + k + '" data-p="' + pp + '" data-c="' + c + '" cx="' + h + '" cy="' + h + '" r="' + r +
    '" fill="none" stroke-width="' + sw + '" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + (c * (1 - pp)) +
    '" transform="rotate(-90 ' + h + ' ' + h + ')"' + (pp <= 0.001 ? ' opacity="0"' : '') + '/></svg>';
}
const numEl = (k, v, dec) => '<span class="num" data-num="' + k + '" data-v="' + v + '" data-dec="' + (dec || 0) + '">' + fmtN(v, dec) + '</span>';
function animate(root) {
  if (!root || !root.getClientRects().length) return;
  $$('[data-ring]', root).forEach(el => {
    const k = 'r:' + el.dataset.ring, p = +el.dataset.p, c = +el.dataset.c;
    const from = prev.has(k) ? prev.get(k) : 0;
    prev.set(k, p);
    if (reduced() || from === p) return;
    el.style.transition = 'none'; el.style.strokeDashoffset = String(c * (1 - from));
    el.getBoundingClientRect();
    el.style.transition = ''; el.style.strokeDashoffset = String(c * (1 - p));
  });
  $$('[data-num]', root).forEach(el => {
    const k = 'n:' + el.dataset.num, v = +el.dataset.v, dec = +(el.dataset.dec || 0);
    const from = prev.has(k) ? prev.get(k) : 0;
    prev.set(k, v);
    if (reduced() || from === v) return;
    const dur = from === 0 ? 650 : 360;
    let t0 = null;
    const step = t => { if (t0 === null) t0 = t; const q = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - q, 3); el.textContent = fmtN(from + (v - from) * e, dec); if (q < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

/* ================= Toast ================= */
let toastT = null, toastUndo = null;
function toast(text, undo) {
  const el = $('#toast');
  clearTimeout(toastT);
  toastUndo = undo || null;
  el.innerHTML = '<p>' + esc(text) + '</p>' + (undo ? '<button id="toast-undo" data-act="undo">Undo</button>' : '');
  el.hidden = false;
  el.style.animation = 'none'; void el.offsetHeight; el.style.animation = '';
  toastT = setTimeout(hideToast, 4000);
}
function hideToast() { $('#toast').hidden = true; toastUndo = null; }

/* ================= Sheets ================= */
const SHEETS = {};
let sheetKind = null, sheetArg = null, lastFocus = null, sheetT = null;
function openSheet(kind, arg) {
  const root = $('#sheet-root'), wasOpen = !!sheetKind;
  sheetKind = kind; sheetArg = arg || {};
  if (!wasOpen) lastFocus = document.activeElement;
  clearTimeout(sheetT);
  root.hidden = false;
  renderSheet();
  $('#sheet').scrollTop = 0;
  if (!wasOpen) {
    void root.offsetHeight;
    root.classList.add('open');
    setTimeout(() => { const f = $('#sheet [data-autofocus]') || $('#sheet-close'); if (f) f.focus({ preventScroll: true }); }, 40);
  }
}
function renderSheet() {
  if (!sheetKind || !SHEETS[sheetKind]) return;
  const r = SHEETS[sheetKind](sheetArg);
  $('#sheet-title').textContent = r.title;
  $('#sheet-body').innerHTML = r.body;
  animate($('#sheet-body'));
}
function closeSheet() {
  if (!sheetKind) return;
  const root = $('#sheet-root');
  sheetKind = null; confirmLogout = false;
  root.classList.remove('open');
  sheetT = setTimeout(() => { root.hidden = true; $('#sheet-body').innerHTML = ''; }, reduced() ? 0 : 290);
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}

SHEETS.water = () => {
  const w = waterProgress(), st = waterState(), b = (st.sizes && st.sizes.bottle) || 500;
  const sizes = [[330, '330 ml'], [500, '0.5 L'], [750, '0.75 L'], [1000, '1 L']];
  return {
    title: 'Water',
    body: '<div class="stepper"><span class="val"><span class="num">' + (w.ml ? litres(w.done) : w.done) + '</span><small>of ' + (w.ml ? litres(w.total) + ' L' : w.total) + '</small></span></div>' +
      '<button class="btn ghost block" id="water-undo" data-act="water-undo"' + (w.done > 0 ? '' : ' disabled') + '>Undo last bottle</button>' +
      (st._mlV2 ? '<p class="field-label">Bottle size</p><div class="pick-row" role="radiogroup" aria-label="Bottle size">' +
        sizes.map(s => '<button class="pick" id="bottle-' + s[0] + '" role="radio" data-act="bottle" data-v="' + s[0] + '" aria-checked="' + (b === s[0]) + '">' + s[1] + '</button>').join('') + '</div>' : '') +
      '<p class="sheet-note">Tap the water chip to add one bottle.</p>'
  };
};

let confirmLogout = false;
SHEETS.settings = () => {
  const t = theme(), nm = userName();
  return {
    title: 'Settings',
    body: '<div class="set-avatar"><span class="av" id="set-av">' + esc((nm || '?').charAt(0).toUpperCase()) + '</span><div style="flex:1;min-width:0"><label class="field-label" for="set-name">Name</label><input class="text-in" id="set-name" value="' + esc(nm) + '" autocomplete="off" maxlength="40"></div></div>' +
      '<p class="group-title">Appearance</p><div class="seg" role="radiogroup" aria-label="Appearance">' +
      [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(o => '<button id="th-' + o[0] + '" role="radio" data-act="theme" data-v="' + o[0] + '" aria-checked="' + (t === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      '<p class="group-title">Account</p><div class="menu-list">' +
      '<div class="menu-item static">' + ic('info') + 'About<span class="r">Version ' + VERSION + '</span></div>' +
      '<button class="menu-item" id="st-logout" data-act="logout">' + ic('logout') + 'Log out</button></div>' +
      (confirmLogout ? '<div class="confirm"><p>Log out on this device? Your data stays in your account.</p><div class="sheet-actions"><button class="btn ghost" id="lo-cancel" data-act="logout-cancel">Cancel</button><button class="btn primary" id="lo-yes" data-act="logout-yes">Log out</button></div></div>' : '')
  };
};

/* ================= Nav ================= */
// Pages that exist in the new design. The others still open the classic page.
const LIVE_PAGES = ['today', 'gym', 'school', 'food'];
const TABS = [['today', 'Today', 'sun', '/v3/'], ['gym', 'Gym', 'gym', '/gym.html'], ['school', 'School', 'school', '/school.html'], ['food', 'Food', 'food', '/food.html']];
const pageHref = key => { const t = TABS.find(x => x[0] === key); if (!t) return '/v3/'; return LIVE_PAGES.indexOf(key) >= 0 ? '/v3/' + (key === 'today' ? '' : key + '.html') : t[3]; };
function renderNav(current) {
  const el = $('#tabs');
  if (!el) return;
  el.innerHTML = '<div class="tabs-in">' + TABS.map(t => {
    const href = pageHref(t[0]);
    return '<a class="tab" id="tab-' + t[0] + '" data-view="' + t[0] + '" href="' + href + '"' + (t[0] === current ? ' aria-current="page"' : '') + '><span class="tab-ic">' + ic(t[2]) + '</span>' + t[1] + '</a>';
  }).join('') + '</div>';
}

/* ================= Actions + long press ================= */
const ACT = {
  undo: () => { const u = toastUndo; hideToast(); if (u) u(); },
  'sheet-close': () => closeSheet(),
  sheet: el => openSheet(el.dataset.sheet, Object.assign({}, el.dataset)),
  settings: () => openSheet('settings'),
  'water-add': () => { addWater(1); const w = waterProgress(); toast('Added a bottle · ' + (w.ml ? litres(w.done) + ' L' : w.done) + ' today', () => addWater(-1)); },
  'water-undo': () => { addWater(-1); renderSheet(); },
  bottle: el => { setBottle(+el.dataset.v); renderSheet(); },
  theme: el => { settings.set('v3Theme', setTheme(el.dataset.v)); renderSheet(); },
  logout: () => { confirmLogout = true; renderSheet(); },
  'logout-cancel': () => { confirmLogout = false; renderSheet(); },
  'logout-yes': async () => { try { if (!DEMO) await sb().auth.signOut(); } catch (e) {} location.href = '/login.html'; }
};
const LP = { 'water-sheet': () => openSheet('water') };

let lp = null, suppressClick = false, lastLp = 0;
function longPress(el) { lastLp = Date.now(); const f = LP[el.dataset.lp]; if (f) f(el); }
function cancelLp() { if (lp) { clearTimeout(lp.t); lp.el.classList.remove('pressing'); lp = null; } }
function wire() {
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('[data-lp]');
    if (!el || e.button > 0) return;
    cancelLp();
    lp = { el: el, x: e.clientX, y: e.clientY, t: setTimeout(() => {
      el.classList.remove('pressing');
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 700);
      try { if (navigator.vibrate) navigator.vibrate(8); } catch (_) {}
      lp = null; longPress(el);
    }, 480) };
    if (el.classList.contains('task')) el.classList.add('pressing');
  });
  document.addEventListener('pointermove', e => { if (lp && (Math.abs(e.clientX - lp.x) > 10 || Math.abs(e.clientY - lp.y) > 10)) cancelLp(); });
  document.addEventListener('pointerup', cancelLp);
  document.addEventListener('pointercancel', cancelLp);
  document.addEventListener('contextmenu', e => {
    const el = e.target.closest('[data-lp]');
    if (!el) return;
    e.preventDefault(); cancelLp();
    if (Date.now() - lastLp > 800) longPress(el);
  });
  document.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACT[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetKind) closeSheet(); });
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'set-name') {
      settings.set('name', e.target.value);
      const av = $('#set-av'); if (av) av.textContent = (e.target.value.trim() || '?').charAt(0).toUpperCase();
      window.dispatchEvent(new CustomEvent('dash:name'));
    }
  });

  const pullAll = force => { ROWS.forEach(r => r.pull(force)); pullWater(force); };
  window.addEventListener('focus', () => pullAll(true));
  window.addEventListener('pageshow', () => pullAll(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ROWS.forEach(r => r.keepalive());
    else pullAll(true);
  });
  window.addEventListener('pagehide', () => ROWS.forEach(r => r.keepalive()));
  setInterval(() => pullAll(false), 8000);
}

/* ================= Boot ================= */
async function boot(page) {
  setTheme(theme());
  renderNav(page);
  wire();
  if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('/sw.js').catch(() => {});
  const id = await session();
  if (!id) return false;
  ROWS.forEach(r => r.pull(true));
  pullWater(true);
  settings.on(() => { setTheme(theme()); if (!DEMO) retireClassicOnce(); });
  return true;
}

window.DASH = {
  VERSION, DEMO, $, $$, esc, pad, clamp, cap, plural, fmtN, ic, readJSON, writeJSON, reduced,
  DOW, DOW_L, MON, dk, dayAt, todayKey, parseDk, daysFrom, dShort, dLong, nowMin, hhmm,
  Row, settings, userName, theme, setTheme,
  waterProgress, waterChip, addWater, onWater: f => waterSubs.push(f),
  ring, numEl, animate, toast, hideToast, SHEETS, openSheet, renderSheet, closeSheet,
  sheetArg: () => sheetArg, sheetKind: () => sheetKind, ACT, LP, boot,
  sb, fresh, uid: () => uid, pageHref
};
})();
