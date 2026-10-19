/* Dashboard v3 — friends. A small side feature:
   • your profile: photo, name and @username (friends add you by username)
   • friends: requests by username, accept, remove
   • sharing (both off until you switch them on):
       trip     — today's planned trip, times only (walk → bus → train → school). Your
                  friends' phones work out "On bus 72" / "At Rosh HaAyin North" from it
                  by the clock, so it works even while your app is closed.
       location — this phone only, only while the app is open; friends see the nearest
                  stop and can open it in Maps. Older than 20 minutes = not shown.
   Tables (supabase/friends-v3.sql): profiles, friendships, presence. Only friends you
   accepted can read your presence row. */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic, hhmm = D.hhmm;
const LS_ME = 'dash3:me', LS_FR = 'dash3:friends', LS_LOC = 'dash3:shareLoc', LS_PUB = 'dash3:tripPub', LS_CHOSEN = 'dash3:tripPick';
const LOC_FRESH_MIN = 20;
const S = { me: D.readJSON(LS_ME), friends: D.readJSON(LS_FR) || [], reqIn: [], reqOut: [], myPres: null, loaded: false, needsSql: false, err: null, add: '', removing: null };

/* ---------- helpers ---------- */
const USER_RE = /^[a-z0-9_.]{3,20}$/;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function avatar(p, size) {
  const a = p && p.avatar, n = String((p && (p.display_name || p.username)) || '?').trim() || '?';
  if (a && PHOTO_RE.test(a)) return '<span class="fav s' + size + '"><img src="' + a + '" alt=""></span>';
  return '<span class="fav s' + size + ' ini" aria-hidden="true">' + esc(n.charAt(0).toUpperCase()) + '</span>';
}
const nameOf = p => (p && (p.display_name || p.username)) || 'Friend';
const R = 6371e3, rad = x => x * Math.PI / 180;
function dist(a, b) { const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function whenUid(f) { (function w() { D.uid() ? f() : setTimeout(w, 250); })(); }
const missingTable = e => e && (e.code === 'PGRST205' || e.code === '42P01' || /could not find the table|does not exist/i.test(e.message || ''));
async function q(fn) {
  await D.fresh(); // the signed-in session first, every time (sync recipe)
  const r = await fn(D.sb());
  if (r.error) { if (missingTable(r.error)) S.needsSql = true; throw r.error; }
  return r.data;
}

/* ---------- ?demo ---------- */
function demo() {
  const n = D.nowMin(), t = D.todayKey();
  S.me = S.me && S.me.username === 'tom' ? S.me : { id: 'demo', username: 'tom', display_name: D.userName() || 'Tom', avatar: '' };
  const trip = off => ({ v: 2, dk: t,
    to: [[n + off, 'walk', 'stop'], [n + off + 3, 'bus', '72'], [n + off + 35, 'station', 'rh'], [n + off + 40, 'train', '618'], [n + off + 60, 'walk', 'hzstop'], [n + off + 62, 'bus', '501'], [n + off + 65, 'walk', 'school'], [n + off + 67, 'school', '']],
    home: [[n + off + 480, 'walk', 'hz'], [n + off + 492, 'station', 'hz'], [n + off + 496, 'train', '641'], [n + off + 516, 'station', 'rh'], [n + off + 520, 'bus', '74'], [n + off + 555, 'home', '']] });
  S.friends = [
    { id: 'd1', fid: 1, username: 'noa.k', display_name: 'Noa', avatar: '', pres: { trip: trip(-10), updated_at: new Date().toISOString() } },
    { id: 'd2', fid: 2, username: 'dan_l', display_name: 'Dan', avatar: '', pres: { trip: trip(-37), lat: 32.1212, lng: 34.9342, loc_at: new Date(Date.now() - 3 * 60e3).toISOString() } },
    { id: 'd3', fid: 3, username: 'maya', display_name: 'Maya', avatar: '', pres: null }
  ];
  S.reqIn = [{ id: 'd4', fid: 4, username: 'yoav', display_name: 'Yoav', avatar: '' }];
  S.reqOut = [];
  S.loaded = true;
}

/* ---------- load ---------- */
let loadP = null;
function load() {
  if (D.DEMO) { if (!S.loaded) demo(); changed(); return Promise.resolve(); }
  if (loadP) return loadP;
  const uid = D.uid(); if (!uid) return Promise.resolve();
  loadP = (async () => {
    try {
      S.me = await q(sb => sb.from('profiles').select('id,username,display_name,avatar').eq('id', uid).maybeSingle()) || null;
      D.writeJSON(LS_ME, S.me);
      try { const mine = await q(sb => sb.from('presence').select('trip,lat,loc_at').eq('user_id', uid)); S.myPres = mine[0] || null; S.needsSql = false; } catch (e) { /* needsSql set */ }
      const fr = await q(sb => sb.from('friendships').select('id,requester,addressee,status'));
      const other = f => f.requester === uid ? f.addressee : f.requester;
      const ids = Array.from(new Set(fr.map(other)));
      const profs = ids.length ? await q(sb => sb.from('profiles').select('id,username,display_name,avatar').in('id', ids)) : [];
      const P = {}; profs.forEach(p => { P[p.id] = p; });
      const acc = fr.filter(f => f.status === 'accepted');
      let pres = [];
      if (acc.length && !S.needsSql) { try { pres = await q(sb => sb.from('presence').select('user_id,trip,lat,lng,loc_at,updated_at').in('user_id', acc.map(other))); } catch (e) {} }
      const PR = {}; pres.forEach(p => { PR[p.user_id] = p; });
      const card = (f, id) => Object.assign({ id, username: '', display_name: '', avatar: '' }, P[id] || {}, { fid: f.id });
      S.friends = acc.map(f => Object.assign(card(f, other(f)), { pres: PR[other(f)] || null })).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      S.reqIn = fr.filter(f => f.status === 'pending' && f.addressee === uid).map(f => card(f, f.requester));
      S.reqOut = fr.filter(f => f.status === 'pending' && f.requester === uid).map(f => card(f, f.addressee));
      S.loaded = true; S.err = null;
      D.writeJSON(LS_FR, S.friends);
    } catch (e) { S.err = (e && e.message) || 'offline'; }
    loadP = null;
    changed();
  })();
  return loadP;
}
const subs = [];
function changed() {
  subs.forEach(f => { try { f(); } catch (e) {} });
  const k = D.sheetKind();
  if ((k === 'friends' || k === 'friend') && !(document.activeElement && document.activeElement.id === 'fr-add-in')) D.renderSheet();
}

/* ---------- profile ---------- */
function suggestUser() {
  const base = String(D.userName() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
  return (base.length >= 3 ? base : 'student') + Math.floor(10 + Math.random() * 90);
}
async function saveProfile(f) {
  const username = String(f.username || '').trim().replace(/^@/, '').toLowerCase();
  if (!USER_RE.test(username)) { D.toast('Username: 3–20 letters, numbers, _ or .'); return false; }
  const row = { username, display_name: String(f.name || '').trim().slice(0, 40) || username, avatar: f.avatar || '', updated_at: new Date().toISOString() };
  if (D.DEMO) { S.me = Object.assign({ id: 'demo' }, row); changed(); return true; }
  try {
    S.me = await q(sb => sb.from('profiles').upsert(Object.assign({ id: D.uid() }, row)).select('id,username,display_name,avatar').single());
    D.writeJSON(LS_ME, S.me);
    if (!D.userName() && row.display_name) D.settings.set('name', row.display_name);
    changed();
    return true;
  } catch (e) {
    D.toast(e && e.code === '23505' ? 'That username is taken. Try another.' : 'Couldn’t save. Check your connection.');
    return false;
  }
}
// A square 160 px JPEG (about 10 KB): small enough to live in the profile row.
function photoFrom(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const N = 160, c = document.createElement('canvas'); c.width = c.height = N;
      const m = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, N, N);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That photo couldn’t be opened')); };
    img.src = url;
  });
}

/* ---------- friends ---------- */
async function addFriend(raw) {
  const name = String(raw || '').trim().replace(/^@/, '').toLowerCase();
  if (!USER_RE.test(name)) { D.toast('Type their username, like noa.k'); return; }
  if (S.me && name === S.me.username) { D.toast('That’s you'); return; }
  if (D.DEMO) { D.toast('Request sent to @' + name); S.add = ''; return; }
  try {
    // any capitals from the old app still match; _ and % are matched literally
    const hits = await q(sb => sb.from('profiles').select('id,username,display_name,avatar').ilike('username', name.replace(/[\\_%]/g, '\\$&')).limit(3));
    const p = (hits || []).find(x => String(x.username || '').toLowerCase() === name) || null;
    if (!p) { D.toast('No one with the username @' + name); return; }
    const inc = S.reqIn.find(r => r.id === p.id);
    if (inc) { await accept(inc.fid); return; }
    if (S.friends.some(f => f.id === p.id)) { D.toast('You’re already friends'); return; }
    if (S.reqOut.some(r => r.id === p.id)) { D.toast('Request already sent'); return; }
    await q(sb => sb.from('friendships').insert({ requester: D.uid(), addressee: p.id, status: 'pending' }));
    S.add = '';
    D.toast('Request sent to ' + nameOf(p));
    load();
  } catch (e) { D.toast('Couldn’t send it. Check your connection.'); }
}
async function accept(fid) {
  if (D.DEMO) { const r = S.reqIn.find(x => x.fid === fid); S.reqIn = S.reqIn.filter(x => x.fid !== fid); if (r) S.friends.push(Object.assign({ pres: null }, r)); changed(); return; }
  try { await q(sb => sb.from('friendships').update({ status: 'accepted' }).eq('id', fid)); D.toast('Friend added'); load(); }
  catch (e) { D.toast('Couldn’t accept. Check your connection.'); }
}
async function unfriend(fid, msg) {
  if (D.DEMO) { S.friends = S.friends.filter(x => x.fid !== fid); S.reqIn = S.reqIn.filter(x => x.fid !== fid); S.reqOut = S.reqOut.filter(x => x.fid !== fid); changed(); return; }
  try { await q(sb => sb.from('friendships').delete().eq('id', fid)); if (msg) D.toast(msg); load(); }
  catch (e) { D.toast('Couldn’t do that. Check your connection.'); }
}

/* ---------- what a friend is doing (from their shared plan) ---------- */
// trip = { v:2, dk, to:[seg…]|null, home:[seg…]|null }   seg = [minute, kind, detail]
// kinds: walk (detail: stop|hzstop|rh|hz|school) · bus (line) · station (rh|hz) · train (number) · school · home
const STATION = { rh: 'Rosh HaAyin North', hz: 'Herzliya station' };
function segNow(x, dir) {
  switch (x[1]) {
    case 'walk': return x[2] === 'school' ? 'Walking to school' : (x[2] === 'rh' || x[2] === 'hz') ? 'Walking to the station' : 'Walking to the bus';
    case 'bus': return 'On bus ' + x[2];
    case 'station': return 'At ' + (STATION[x[2]] || 'the station');
    case 'train': return 'On the train to ' + (dir === 'to' ? 'Herzliya' : 'Rosh HaAyin');
    case 'school': return 'At school';
    case 'home': return 'Home';
  }
  return '';
}
function segPlan(x, dir) {
  switch (x[1]) {
    case 'walk': return x[2] === 'school' ? 'Walk to school' : (x[2] === 'rh' || x[2] === 'hz') ? 'Walk to the station' : 'Walk to the bus';
    case 'bus': return 'Bus ' + x[2];
    case 'station': return STATION[x[2]] || 'Station';
    case 'train': return 'Train' + (x[2] ? ' ' + x[2] : '') + ' to ' + (dir === 'to' ? 'Herzliya' : 'Rosh HaAyin');
    case 'school': return 'School';
    case 'home': return 'Home';
  }
  return '';
}
const ICON = { walk: 'walk', bus: 'bus', station: 'train', train: 'train', school: 'school', home: 'home' };
const validLeg = s => Array.isArray(s) && s.length > 0 && s.length < 20 && s.every(x => Array.isArray(x) && typeof x[0] === 'number' && ICON[x[1]] && (x[2] == null || typeof x[2] === 'string'));
function validTrip(t) { return !!t && t.v === 2 && /^\d{4}-\d{2}-\d{2}$/.test(t.dk) && (t.to == null || validLeg(t.to)) && (t.home == null || validLeg(t.home)) && !!(t.to || t.home); }
const trainOf = s => { const x = s && s.find(y => y[1] === 'train'); return x ? x[0] : null; };
const endOf = s => s[s.length - 1][0];
// Where someone is on one leg of the trip, by the clock.
function legStatus(s, dir, dk, now) {
  const first = s[0][0], last = s[s.length - 1];
  if (now < first) return { k: 'home', icon: 'home', text: 'Leaves home ' + hhmm(first), sub: first - now <= 60 ? 'in ' + (first - now) + ' min' : '', dir, train: trainOf(s), dk, leg: s };
  let i = 0; s.forEach((x, j) => { if (x[0] <= now) i = j; });
  const done = i === s.length - 1;
  if (done && now - last[0] > 90) return null; // long over
  return { k: s[i][1], icon: ICON[s[i][1]], text: segNow(s[i], dir), sub: done ? 'since ' + hhmm(last[0]) : (dir === 'to' ? 'at school ' : 'home ') + hhmm(last[0]), dir, train: trainOf(s), dk, leg: s, i };
}
function tripStatus(t, now) {
  if (!validTrip(t)) return null;
  now = now == null ? D.nowMin() : now;
  if (t.dk === D.dk(D.dayAt(1)) && t.to) return { k: 'plan', icon: 'clock', text: 'Tomorrow · leaves ' + hhmm(t.to[0][0]), sub: trainOf(t.to) != null ? hhmm(trainOf(t.to)) + ' train' : '', dir: 'to', train: trainOf(t.to), dk: t.dk, leg: t.to };
  if (t.dk !== D.todayKey()) return null;
  if (t.to && now < endOf(t.to)) return legStatus(t.to, 'to', t.dk, now);
  if (t.home) {
    if (now < t.home[0][0]) return { k: 'school', icon: 'school', text: 'At school', sub: 'leaves ' + hhmm(t.home[0][0]), dir: 'home', train: trainOf(t.home), dk: t.dk, leg: t.home };
    return legStatus(t.home, 'home', t.dk, now);
  }
  return t.to ? legStatus(t.to, 'to', t.dk, now) : null;
}
function placeName(lat, lng) {
  const C = window.COMMUTE, ll = [lat, lng];
  if (!C) return null;
  if (dist(ll, C.RH_LL) < 350) return 'Rosh HaAyin North station';
  if (dist(ll, C.HZ_LL) < 350) return 'Herzliya station';
  if (C.SCHOOL && Object.keys(C.SCHOOL).some(k => C.SCHOOL[k].ll && dist(ll, C.SCHOOL[k].ll) < 220)) return 'School';
  const b = C.bus && C.bus();
  if (b && b.stops) {
    let best = null;
    Object.keys(b.stops).forEach(code => { const st = b.stops[code], d = dist(ll, [st[1], st[2]]); if (d < 500 && (!best || d < best.d)) best = { d, n: st[0] + (st[3] ? ', ' + st[3] : '') }; });
    if (best) return best.n;
  }
  return null;
}
function locStatus(p) {
  if (!p || p.lat == null || p.lng == null || !p.loc_at) return null;
  const age = Math.max(0, Math.round((Date.now() - Date.parse(p.loc_at)) / 60e3));
  if (!(age <= LOC_FRESH_MIN)) return null;
  return { place: placeName(+p.lat, +p.lng), age, url: 'https://maps.google.com/?q=' + (+p.lat).toFixed(5) + ',' + (+p.lng).toFixed(5) };
}
const ago = m => m <= 0 ? 'just now' : m + ' min ago';

/* ---------- sharing: your trip ---------- */
const shareTrip = () => D.settings.get('shareTrip') === true;
const locOn = () => { try { return localStorage.getItem(LS_LOC) === '1'; } catch (e) { return false; } };
async function pushPresence(fields) {
  if (D.DEMO || S.needsSql || !D.uid()) return false;
  try { await q(sb => sb.from('presence').upsert(Object.assign({ user_id: D.uid(), updated_at: new Date().toISOString() }, fields))); S.myPres = Object.assign({}, S.myPres, fields); return true; }
  catch (e) { return false; }
}
// The option you picked on the School card (otherwise the planner's choice).
function choose(dk, dir, train) { D.writeJSON(LS_CHOSEN, { dk, dir, train }); tick(); }
function pickFor(opts, dk, dir, def) {
  const ch = D.readJSON(LS_CHOSEN);
  if (ch && ch.dk === dk && ch.dir === dir) { const o = (opts || []).find(x => x.train === ch.train); if (o) return o; }
  return def;
}
function legTo(p) {
  const s = [[p.leave, 'walk', p.bus ? 'stop' : 'rh']];
  if (p.bus) s.push([p.bus.at, 'bus', String(p.bus.line)], [p.bus.off, 'station', 'rh']);
  s.push([p.train, 'train', String(p.trainNo || '')]);
  if (p.hz) s.push([p.trainArr, 'walk', 'hzstop'], [p.hz.at, 'bus', String(p.hz.line)], [p.hz.off, 'walk', 'school']);
  else s.push([p.trainArr, 'walk', 'school']);
  s.push([p.arrive, 'school', '']);
  return s;
}
function legHome(p) {
  const s = [[p.leave, 'walk', p.hz ? 'hzstop' : 'hz']];
  if (p.hz) s.push([p.hz.at, 'bus', String(p.hz.line)], [p.hz.off, 'station', 'hz']);
  else s.push([Math.min(p.train, p.leave + (p.hzWalk || 0)), 'station', 'hz']);
  s.push([p.train, 'train', String(p.trainNo || '')], [p.trainArr, 'station', 'rh']);
  if (p.bus) s.push([p.bus.at, 'bus', String(p.bus.line)]);
  s.push([p.home, 'home', '']);
  return s;
}
// The whole school day: the way there and the way home (so friends see the trip home
// even if your app stays closed all day).
function planOf(c, ph) {
  const C = window.COMMUTE;
  if (!ph) return null;
  let dk = null, to = null, home = null;
  if ((ph.kind === 'morning' || (ph.kind === 'next' && ph.off === 1)) && ph.m) {
    const m = ph.m; dk = m.dk;
    const p = pickFor(m.opts, dk, 'to', ph.pick || m.best); if (p) to = legTo(p);
    const a = C.afternoon(c, D.parseDk(dk).getDay(), dk);
    const q2 = a && pickFor(a.opts, dk, 'home', a.best); if (q2) home = legHome(q2);
  } else if ((ph.kind === 'school' || ph.kind === 'after') && ph.a) {
    const a = ph.a; dk = a.dk;
    const p = pickFor(a.opts, dk, 'home', ph.pick || a.best); if (p) home = legHome(p);
  }
  return dk && (to || home) ? { v: 2, dk, to, home } : null;
}
function myPlan() {
  const C = window.COMMUTE, row = window.SCHOOL_ROW || window.TODAY_SCHOOL_ROW;
  if (!C || !row || !C.rail()) return null;
  const c = C.cfg(row); if (!c) return null;
  return planOf(c, C.phase(c));
}
// Once a leg has started, it stays as sent: the planner moves on to the next bus when
// the leave time passes, but you're already on your way. Only a choice you make
// yourself (tapping another option) replaces it.
function keepUnderway(t, prev) {
  if (!prev || prev.dk !== t.dk) return t;
  const now = D.nowMin(), ch = D.readJSON(LS_CHOSEN);
  const chosen = (dir, leg) => !!(ch && ch.dk === t.dk && ch.dir === dir && leg && trainOf(leg) === ch.train);
  const out = Object.assign({}, t);
  ['to', 'home'].forEach(dir => {
    const p = prev[dir];
    if (!validLeg(p)) return;
    const underway = p[0][0] <= now && now < endOf(p) + 30;
    if (!out[dir] && dir === 'to') out[dir] = p; // the morning stays on record for the day
    else if (underway && !chosen(dir, out[dir])) out[dir] = p;
  });
  return out;
}
function tick() {
  if (!shareTrip() || D.DEMO || S.needsSql || !D.uid()) return;
  let t = myPlan(); if (!t) return;
  const last = D.readJSON(LS_PUB);
  t = keepUnderway(t, last && last.trip);
  const key = JSON.stringify(t);
  if (last && last.key === key && Date.now() - last.at < 30 * 60e3) return; // unchanged: no need to send again
  pushPresence({ trip: t }).then(ok => { if (ok) D.writeJSON(LS_PUB, { key, at: Date.now(), trip: t }); });
}
async function setShareTrip(on) {
  D.settings.set('shareTrip', !!on);
  D.writeJSON(LS_PUB, null);
  if (on) tick(); else await pushPresence({ trip: null });
  changed();
}

/* ---------- sharing: your location (this phone, app open) ---------- */
let watchId = null, lastLoc = null;
function startLoc() {
  if (!locOn() || D.DEMO || S.needsSql || watchId != null || document.hidden || !navigator.geolocation || !D.uid()) return;
  watchId = navigator.geolocation.watchPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (lastLoc && dist(ll, lastLoc.ll) < 120 && Date.now() - lastLoc.at < 120e3) return; // every 2 min, or when you've moved
    lastLoc = { ll, at: Date.now() };
    pushPresence({ lat: +ll[0].toFixed(5), lng: +ll[1].toFixed(5), loc_at: new Date().toISOString() });
  }, err => {
    if (err && err.code === 1) { setLoc(false); D.toast('Location is blocked for this app. Allow it in your phone’s settings to share it.'); }
  }, { enableHighAccuracy: false, maximumAge: 60e3, timeout: 30e3 });
}
function stopLoc() { if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} watchId = null; } }
function setLoc(on) {
  try { localStorage.setItem(LS_LOC, on ? '1' : '0'); } catch (e) {}
  if (on) { lastLoc = null; startLoc(); } else { stopLoc(); lastLoc = null; pushPresence({ lat: null, lng: null, loc_at: null }); }
  changed();
}

/* ---------- sheets ---------- */
const sw = (id, label, on, hint, act) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="switch-hit"><button class="switch" id="' + id + '" role="switch" aria-checked="' + !!on + '" data-act="' + act + '" aria-label="' + label + '"></button></span></div>';
function statusLine(f) {
  const t = tripStatus(f.pres && f.pres.trip), l = locStatus(f.pres);
  if (t) return { icon: t.icon, text: t.text, sub: t.sub, t, l };
  if (l) return { icon: 'locate', text: l.place ? 'Near ' + l.place : 'Sharing location', sub: ago(l.age), l };
  return null;
}
// Their train is your train (same day, same direction, same departure).
function sameTrain(st) {
  if (!st || st.train == null) return false;
  const mine = myPlan(); if (!mine || mine.dk !== st.dk) return false;
  return trainOf(mine[st.dir]) === st.train;
}
function friendRow(f, compact) {
  const st = statusLine(f);
  const same = st && sameTrain(st.t);
  return '<button class="fr-row" id="fr-' + esc(String(f.fid)) + '" data-act="sheet" data-sheet="friend" data-id="' + esc(String(f.id)) + '">' + avatar(f, compact ? 36 : 44) +
    '<span class="fr-main"><b>' + esc(nameOf(f)) + '</b><span class="fr-st">' + (st ? ic(st.icon, 'xs') + '<span>' + esc(st.text) + (st.sub ? ' · ' + esc(st.sub) : '') + '</span>' : '<span>' + (compact ? '' : 'Not sharing right now') + '</span>') + '</span></span>' +
    (same ? '<span class="fr-same">Same train</span>' : st && st.l && st.t ? '<span class="fr-loc" title="Sharing location">' + ic('locate', 'xs') + '</span>' : '') + '</button>';
}
D.SHEETS.profile = a => {
  if (!a.f) a.f = { name: (S.me && S.me.display_name) || D.userName(), username: (S.me && S.me.username) || suggestUser(), avatar: (S.me && S.me.avatar) || '' };
  const f = a.f, fresh = !S.me;
  return {
    title: fresh ? 'Your profile' : 'Profile',
    body: '<div class="pf-photo">' + avatar({ avatar: f.avatar, display_name: f.name || f.username }, 88) +
      '<div class="pf-btns"><button class="btn ghost" id="pf-pick" data-act="pf-pick">' + (PHOTO_RE.test(f.avatar || '') ? 'Change photo' : 'Add a photo') + '</button>' +
      (PHOTO_RE.test(f.avatar || '') ? '<button class="btn-text sch" id="pf-rm" data-act="pf-rm">Remove</button>' : '') + '</div>' +
      '<input type="file" accept="image/*" id="pf-file" class="sr" tabindex="-1" aria-hidden="true"></div>' +
      '<label class="field-label" for="pf-name">Name</label><input class="text-in" id="pf-name" value="' + esc(f.name || '') + '" maxlength="40" autocomplete="off">' +
      '<label class="field-label" for="pf-user">Username</label><div class="at-in"><span aria-hidden="true">@</span><input class="text-in" id="pf-user" value="' + esc(f.username || '') + '" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false"></div>' +
      '<p class="sheet-note">Friends add you by your username. Anyone who looks it up sees your name and photo, nothing else.</p>' +
      (S.needsSql ? '<p class="problem">' + ic('info', 'xs') + '<span>Friends needs a one-time database update first (supabase/friends-v3.sql).</span></p>' : '') +
      '<button class="btn school block" id="pf-save" data-act="pf-save">' + (fresh ? 'Save and continue' : 'Save') + '</button>'
  };
};
D.SHEETS.friends = () => {
  if (!S.loaded && !S.err) load();
  if (S.needsSql) return { title: 'Friends', body: '<p class="problem">' + ic('info', 'xs') + '<span>Friends needs a one-time database update. Run <b>supabase/friends-v3.sql</b> in Supabase (SQL Editor → paste → Run), then reopen this.</span></p>' };
  if (!S.me) return { title: 'Friends', body: '<p class="sheet-note">See when your friends are on the bus or the train, or already at school. Start with your profile so they can find you.</p><button class="btn school block" id="fr-setup" data-act="sheet" data-sheet="profile">Set up my profile</button>' + (S.err && !S.loaded ? '<p class="sheet-note">Couldn’t reach the server.</p>' : '') };
  let h = '<button class="fr-me" id="fr-me" data-act="sheet" data-sheet="profile">' + avatar(S.me, 44) + '<span class="fr-main"><b>' + esc(nameOf(S.me)) + '</b><span class="fr-st"><span>@' + esc(S.me.username) + '</span></span></span><span class="r">Edit' + ic('chev-r', 'sm') + '</span></button>';
  h += '<form class="add-row" id="fr-add-form" autocomplete="off"><label class="sr" for="fr-add-in">Friend’s username</label><input id="fr-add-in" placeholder="Add a friend by username" value="' + esc(S.add) + '" maxlength="21" autocapitalize="none" spellcheck="false"><button class="add-btn schbg" id="fr-add" type="submit" aria-label="Send friend request">' + ic('plus') + '</button></form>';
  if (S.reqIn.length) h += '<p class="group-title">Requests</p><div class="fr-list">' + S.reqIn.map(r => '<div class="fr-row static">' + avatar(r, 44) + '<span class="fr-main"><b>' + esc(nameOf(r)) + '</b><span class="fr-st"><span>@' + esc(r.username) + '</span></span></span><span class="fr-acts"><button class="btn-text" id="frd-' + r.fid + '" data-act="fr-decline" data-fid="' + r.fid + '">Decline</button><button class="btn school sm" id="fra-' + r.fid + '" data-act="fr-accept" data-fid="' + r.fid + '">Accept</button></span></div>').join('') + '</div>';
  h += '<p class="group-title">Friends</p>' + (S.friends.length ? '<div class="fr-list">' + S.friends.map(f => friendRow(f)).join('') + '</div>' : '<p class="sheet-note">No friends yet. Add them by username, and tell them yours: <b>@' + esc(S.me.username) + '</b></p>');
  if (S.reqOut.length) h += '<div class="fr-list">' + S.reqOut.map(r => '<div class="fr-row static muted">' + avatar(r, 36) + '<span class="fr-main"><b>' + esc(nameOf(r)) + '</b><span class="fr-st"><span>Request sent</span></span></span><button class="btn-text" id="frc-' + r.fid + '" data-act="fr-cancel" data-fid="' + r.fid + '">Cancel</button></div>').join('') + '</div>';
  h += '<p class="group-title">What friends see</p>' +
    sw('fr-share-trip', 'Share my trip', shareTrip(), 'When you leave, your bus and train, when you get there. Worked out from your plan, so it works with the app closed.', 'fr-share-trip') +
    sw('fr-share-loc', 'Share my location', locOn(), 'From this phone, only while the app is open. Friends see the nearest stop and can open it in Maps.', 'fr-share-loc');
  return { title: 'Friends', body: h };
};
D.SHEETS.friend = a => {
  const f = S.friends.find(x => String(x.id) === String(a.id));
  if (!f) return { title: 'Friend', body: '<p class="sheet-note">Not on your friends list anymore.</p>' };
  const st = tripStatus(f.pres && f.pres.trip), l = locStatus(f.pres);
  let h = '<div class="fr-hero">' + avatar(f, 64) + '<div><b>' + esc(nameOf(f)) + '</b><span>@' + esc(f.username) + '</span></div></div>';
  if (st) {
    h += '<p class="fr-now">' + ic(st.icon, 'sm') + '<span><b>' + esc(st.text) + '</b>' + (st.sub ? ' · ' + esc(st.sub) : '') + '</span></p>';
    if (sameTrain(st)) h += '<p class="fr-same big">' + ic('train', 'xs') + 'Same train as you</p>';
    h += '<p class="group-title">' + (st.k === 'plan' ? 'Tomorrow' : st.dir === 'to' ? 'To school' : 'Going home') + '</p>' +
      '<ol class="fr-plan">' + st.leg.map((x, j) => '<li class="' + (st.i == null ? '' : j < st.i ? 'past' : j === st.i ? 'now' : '') + '"><span class="t">' + hhmm(x[0]) + '</span>' + ic(ICON[x[1]], 'xs') + '<span>' + esc(segPlan(x, st.dir)) + '</span></li>').join('') + '</ol>';
    h += '<p class="sheet-note">Worked out from ' + esc(nameOf(f)) + '’s planned trip by the clock, not tracked. If they miss a bus, this won’t know.</p>';
  } else h += '<p class="sheet-note">' + esc(nameOf(f)) + ' isn’t sharing a trip right now.</p>';
  if (l) h += '<a class="menu-item fr-map" id="fr-map" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + ic('locate') + '<span class="grow">' + esc(l.place ? 'Near ' + l.place : 'Their location') + '<small>' + ago(l.age) + ' · open in Maps</small></span>' + ic('chev-r', 'sm') + '</a>';
  h += S.removing === f.fid
    ? '<div class="confirm"><p>Remove ' + esc(nameOf(f)) + '? You’ll stop seeing each other’s trips.</p><div class="sheet-actions"><button class="btn ghost" id="fr-rm-no" data-act="fr-rm-no">Cancel</button><button class="btn primary" id="fr-rm-yes" data-act="fr-rm-yes" data-fid="' + f.fid + '">Remove</button></div></div>'
    : '<button class="btn ghost block" id="fr-rm" data-act="fr-rm" data-fid="' + f.fid + '">Remove friend</button>';
  return { title: nameOf(f), body: h };
};

/* ---------- actions ---------- */
function syncProfile() { const a = D.sheetArg(); if (!a || !a.f) return; const n = $('#pf-name'), u = $('#pf-user'); if (n) a.f.name = n.value; if (u) a.f.username = u.value; }
Object.assign(D.ACT, {
  'pf-pick': () => { syncProfile(); const i = $('#pf-file'); if (i) i.click(); },
  'pf-rm': () => { syncProfile(); D.sheetArg().f.avatar = ''; D.renderSheet(); },
  'pf-save': async el => {
    syncProfile(); el.disabled = true;
    const wasNew = !S.me, ok = await saveProfile(D.sheetArg().f);
    el.disabled = false;
    if (!ok) return;
    D.toast('Profile saved');
    if (wasNew) { D.openSheet('friends'); load(); } else D.closeSheet();
    renderSettingsAvatar();
  },
  'fr-accept': el => accept(+el.dataset.fid),
  'fr-decline': el => unfriend(+el.dataset.fid, 'Request declined'),
  'fr-cancel': el => unfriend(+el.dataset.fid, 'Request cancelled'),
  'fr-rm': el => { S.removing = +el.dataset.fid; D.renderSheet(); },
  'fr-rm-no': () => { S.removing = null; D.renderSheet(); },
  'fr-rm-yes': el => { const fid = +el.dataset.fid; S.removing = null; D.closeSheet(); unfriend(fid, 'Friend removed'); },
  'fr-share-trip': () => setShareTrip(!shareTrip()),
  'fr-share-loc': () => setLoc(!locOn())
});
document.addEventListener('change', e => {
  if (!e.target || e.target.id !== 'pf-file' || !e.target.files || !e.target.files[0]) return;
  photoFrom(e.target.files[0]).then(url => { const a = D.sheetArg(); if (a && a.f) { a.f.avatar = url; D.renderSheet(); } }).catch(err => D.toast(err.message));
});
document.addEventListener('input', e => { if (e.target && e.target.id === 'fr-add-in') S.add = e.target.value; });
document.addEventListener('submit', e => {
  if (!e.target || e.target.id !== 'fr-add-form') return;
  e.preventDefault();
  const v = ($('#fr-add-in') || {}).value || '';
  if ($('#fr-add-in')) $('#fr-add-in').blur();
  addFriend(v);
});

/* ---------- settings avatar (core.js draws the sheet) ---------- */
function renderSettingsAvatar() { const el = $('#set-av'); if (el && S.me && PHOTO_RE.test(S.me.avatar || '')) el.innerHTML = '<img src="' + S.me.avatar + '" alt="">'; }

/* ---------- School page: friends on the way ---------- */
function renderStrip() {
  const slot = $('#friends-slot'); if (!slot) return;
  const active = S.friends.filter(f => statusLine(f));
  if (!active.length) { slot.innerHTML = ''; return; }
  slot.innerHTML = '<section class="card fr-card" aria-label="Friends"><div class="fr-head"><h2 class="card-title">Friends</h2><button class="btn-text sch" id="fr-all" data-act="sheet" data-sheet="friends">All</button></div>' +
    '<div class="fr-list">' + active.slice(0, 4).map(f => friendRow(f, true)).join('') + '</div></section>';
}
subs.push(renderStrip);

/* ---------- boot ---------- */
window.SOCIAL = { load, choose, avatar, tripStatus, plan: myPlan, me: () => S.me, friends: () => S.friends, renderSettingsAvatar };
if (D.DEMO) { demo(); }
whenUid(() => {
  if (D.DEMO) { renderStrip(); return; }
  // School shows friends; sharing needs to know the table is there. Otherwise wait until Friends opens.
  if ($('#friends-slot') || shareTrip() || locOn()) load().then(() => { tick(); startLoc(); });
  renderStrip();
  // friends' trips change by the minute; their rows refresh every minute while you look
  setInterval(() => { if (!document.hidden) { if ($('#friends-slot') || D.sheetKind() === 'friends' || D.sheetKind() === 'friend') load(); else changed(); tick(); } }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoc(); else { startLoc(); tick(); if ($('#friends-slot')) load(); } });
});
setInterval(() => { renderStrip(); if (D.sheetKind() === 'friend') D.renderSheet(); }, 30e3);
})();
