/* Dashboard v3 — friends. A small side feature:
   • your profile: photo (cropped and rotated in photo.js), name, @username — usernames
     are unique, capitals or not
   • friends: requests by username, accept, remove
   • sharing — off until you switch it on, and you pick who:
       trip     — your planned trips for the coming school days, times only (walk → bus
                  → train → school, and home). Friends' phones work out "On bus 72" /
                  "At Rosh HaAyin North" by the clock, even while your app is closed.
                  Everyone, or only the friends you pick.
       location — this phone only, only while the app is open, only to the friends you
                  pick. They see the nearest stop and can open it in Maps.
   • notifications (Web Push, sent by api/notify.js): when the friends you pick leave,
     reach the station, get on the train, arrive — and tomorrow's timetable changes.
   Tables (supabase/friends-v3.sql + friends-v4.sql): profiles, friendships, presence
   (trip, trip_to), locations (share_to), push_subs, notify_prefs. */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic, hhmm = D.hhmm;
const VAPID_PUBLIC = 'BPHqx3CLnpghjbbgLMSDvLK4nIpqN6Lp7DtDxUDbQ-B7zehrpiCLxcKHhUb-2w9FewCUiPboX5-Yo5cB5YHYxko';
const LS_ME = 'dash3:me', LS_FR = 'dash3:friends', LS_LOC = 'dash3:shareLoc', LS_PUB = 'dash3:tripPub', LS_CHOSEN = 'dash3:tripPick', LS_KNOWN = 'dash3:knownFriends';
const LOC_FRESH_MIN = 20;
const MOMENTS = [['leave', 'Leaving'], ['station', 'At the station'], ['train', 'On the train'], ['arrive', 'Arrived']];
const S = {
  me: D.readJSON(LS_ME), friends: D.readJSON(LS_FR) || [], reqIn: [], reqOut: [],
  loaded: false, needsSql: false, needsV4: false, err: null, add: '', removing: null,
  tripTo: null, locTo: [], prefs: null, push: 'unknown', pf: null, user: { v: '', state: '' }
};

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
const missingTable = e => e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === '42703' || /could not find the table|does not exist/i.test(e.message || ''));
async function q(fn) {
  await D.fresh(); // the signed-in session first, every time (sync recipe)
  const r = await fn(D.sb());
  if (r.error) throw r.error;
  return r.data;
}
const ilikeExact = name => name.replace(/[\\_%]/g, '\\$&'); // _ and % matched literally
async function token() { try { const r = await D.sb().auth.getSession(); return r.data && r.data.session && r.data.session.access_token; } catch (e) { return null; } }
async function api(body) {
  const t = await token(); if (!t) return { ok: false };
  try { const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) }); return await r.json(); }
  catch (e) { return { ok: false }; }
}

/* ---------- ?demo ---------- */
function demo() {
  const n = D.nowMin(), t = D.todayKey();
  S.me = S.me && S.me.username === 'tom' ? S.me : { id: 'demo', username: 'tom', display_name: D.userName() || 'Tom', avatar: '' };
  const trip = off => ({ v: 3, days: { [t]: {
    to: [[n + off, 'walk', 'stop'], [n + off + 3, 'bus', '72'], [n + off + 35, 'station', 'rh'], [n + off + 40, 'train', '618'], [n + off + 60, 'walk', 'hzstop'], [n + off + 62, 'bus', '34 · החדש'], [n + off + 65, 'walk', 'school'], [n + off + 67, 'school', '']],
    home: [[n + off + 480, 'walk', 'hz'], [n + off + 492, 'station', 'hz'], [n + off + 496, 'train', '641'], [n + off + 516, 'station', 'rh'], [n + off + 520, 'bus', '74'], [n + off + 555, 'home', '']] } } });
  S.friends = [
    { id: 'd1', fid: 1, username: 'noa.k', display_name: 'Noa', avatar: '', pres: { trip: trip(-10) }, loc: null },
    { id: 'd2', fid: 2, username: 'dan_l', display_name: 'Dan', avatar: '', pres: { trip: trip(-37) }, loc: { lat: 32.1212, lng: 34.9342, loc_at: new Date(Date.now() - 3 * 60e3).toISOString() } },
    { id: 'd3', fid: 3, username: 'maya', display_name: 'Maya', avatar: '', pres: null, loc: null }
  ];
  S.reqIn = [{ id: 'd4', fid: 4, username: 'yoav', display_name: 'Yoav', avatar: '' }];
  S.reqOut = [];
  S.tripTo = null; S.locTo = ['d2'];
  S.prefs = S.prefs || { friends: ['d1'], moments: ['leave', 'station', 'arrive'], timetable: true };
  S.push = S.push === 'unknown' ? 'off' : S.push;
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
      // my own sharing choices (friends-v4); an older database just lacks them
      S.needsSql = false; S.needsV4 = false;
      try {
        const [pr, lo, np] = await Promise.all([
          q(sb => sb.from('presence').select('trip_to').eq('user_id', uid)),
          q(sb => sb.from('locations').select('share_to').eq('user_id', uid)),
          q(sb => sb.from('notify_prefs').select('friends,moments,timetable').eq('user_id', uid))
        ]);
        S.tripTo = pr[0] ? pr[0].trip_to || null : null;
        S.locTo = lo[0] && Array.isArray(lo[0].share_to) ? lo[0].share_to : [];
        S.prefs = np[0] || null;
      } catch (e) {
        if (!missingTable(e)) throw e;
        try { await q(sb => sb.from('presence').select('user_id').limit(1)); S.needsV4 = true; } catch (e2) { if (missingTable(e2)) S.needsSql = true; else throw e2; }
      }
      const fr = await q(sb => sb.from('friendships').select('id,requester,addressee,status'));
      const other = f => f.requester === uid ? f.addressee : f.requester;
      const ids = Array.from(new Set(fr.map(other)));
      const profs = ids.length ? await q(sb => sb.from('profiles').select('id,username,display_name,avatar').in('id', ids)) : [];
      const P = {}; profs.forEach(p => { P[p.id] = p; });
      const acc = fr.filter(f => f.status === 'accepted'), accIds = acc.map(other);
      const PR = {}, LO = {};
      if (accIds.length && !S.needsSql) {
        try { (await q(sb => sb.from('presence').select('user_id,trip,updated_at').in('user_id', accIds))).forEach(p => { PR[p.user_id] = p; }); } catch (e) {}
        if (!S.needsV4) { try { (await q(sb => sb.from('locations').select('user_id,lat,lng,loc_at').in('user_id', accIds))).forEach(l => { LO[l.user_id] = l; }); } catch (e) {} }
      }
      const card = (f, id) => Object.assign({ id, username: '', display_name: '', avatar: '' }, P[id] || {}, { fid: f.id });
      S.friends = acc.map(f => Object.assign(card(f, other(f)), { pres: PR[other(f)] || null, loc: LO[other(f)] || null })).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      S.reqIn = fr.filter(f => f.status === 'pending' && f.addressee === uid).map(f => card(f, f.requester));
      S.reqOut = fr.filter(f => f.status === 'pending' && f.requester === uid).map(f => card(f, f.addressee));
      S.loaded = true; S.err = null;
      D.writeJSON(LS_FR, S.friends);
      await pushState();
      newFriendsGetAlerts(accIds);
    } catch (e) { S.err = (e && e.message) || 'offline'; }
    loadP = null;
    changed();
  })();
  return loadP;
}
const subs = [];
function changed() {
  subs.forEach(f => { try { f(); } catch (e) {} });
  const k = D.sheetKind(), a = document.activeElement;
  if ((k === 'friends' || k === 'friend') && !(a && (a.id === 'fr-add-in'))) D.renderSheet();
}

/* ---------- profile ---------- */
function suggestUser() {
  const base = String(D.userName() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
  return (base.length >= 3 ? base : 'student') + Math.floor(10 + Math.random() * 90);
}
// Is this username free? (Nobody else, in any capitals.)
let userT = null;
function checkUser(raw) {
  const v = String(raw || '').trim().replace(/^@/, '').toLowerCase();
  S.user = { v, state: !v ? '' : !USER_RE.test(v) ? 'bad' : (S.me && v === String(S.me.username).toLowerCase()) ? 'mine' : 'checking' };
  paintUser();
  clearTimeout(userT);
  if (S.user.state !== 'checking') return;
  userT = setTimeout(async () => {
    if (D.DEMO) { S.user.state = ['noa.k', 'dan_l', 'maya', 'yoav'].indexOf(v) >= 0 ? 'taken' : 'free'; paintUser(); return; }
    try {
      const hits = await q(sb => sb.from('profiles').select('id,username').ilike('username', ilikeExact(v)).limit(3));
      if (S.user.v !== v) return;
      S.user.state = (hits || []).some(h => String(h.username).toLowerCase() === v && (!S.me || h.id !== S.me.id)) ? 'taken' : 'free';
    } catch (e) { S.user.state = ''; }
    paintUser();
  }, 350);
}
function paintUser() {
  const el = $('#pf-user-st'); if (!el) return;
  const st = S.user.state;
  el.className = 'pf-user-st ' + st;
  el.textContent = st === 'bad' ? '3–20 letters, numbers, _ or .' : st === 'taken' ? 'Taken: someone already has this username' : st === 'free' ? '✓ Available' : st === 'checking' ? 'Checking…' : '';
  const b = $('#pf-save'); if (b) b.disabled = st === 'bad' || st === 'taken' || st === 'checking';
}
async function saveProfile(f) {
  const username = String(f.username || '').trim().replace(/^@/, '').toLowerCase();
  if (!USER_RE.test(username)) { D.toast('Username: 3–20 letters, numbers, _ or .'); return false; }
  const row = { username, display_name: String(f.name || '').trim().slice(0, 40) || username, avatar: f.avatar || '', updated_at: new Date().toISOString() };
  if (D.DEMO) { S.me = Object.assign({ id: 'demo' }, row); changed(); return true; }
  try {
    const hits = await q(sb => sb.from('profiles').select('id,username').ilike('username', ilikeExact(username)).limit(3));
    if ((hits || []).some(h => String(h.username).toLowerCase() === username && h.id !== D.uid())) { S.user = { v: username, state: 'taken' }; paintUser(); D.toast('That username is taken. Try another.'); return false; }
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

/* ---------- friends ---------- */
async function addFriend(raw) {
  const name = String(raw || '').trim().replace(/^@/, '').toLowerCase();
  if (!USER_RE.test(name)) { D.toast('Type their username, like noa.k'); return; }
  if (S.me && name === String(S.me.username).toLowerCase()) { D.toast('That’s you'); return; }
  if (D.DEMO) { D.toast('Request sent to @' + name); S.add = ''; changed(); return; }
  try {
    const hits = await q(sb => sb.from('profiles').select('id,username,display_name,avatar').ilike('username', ilikeExact(name)).limit(3));
    const p = (hits || []).find(x => String(x.username || '').toLowerCase() === name) || null;
    if (!p) { D.toast('No one with the username @' + name); return; }
    const inc = S.reqIn.find(r => r.id === p.id);
    if (inc) { await accept(inc.fid); return; }
    if (S.friends.some(f => f.id === p.id)) { D.toast('You’re already friends'); return; }
    if (S.reqOut.some(r => r.id === p.id)) { D.toast('Request already sent'); return; }
    await q(sb => sb.from('friendships').insert({ requester: D.uid(), addressee: p.id, status: 'pending' }));
    S.add = '';
    D.toast('Request sent to ' + nameOf(p));
    api({ event: 'request', to: p.id });
    load();
  } catch (e) { D.toast('Couldn’t send it. Check your connection.'); }
}
async function accept(fid) {
  const r = S.reqIn.find(x => x.fid === fid);
  if (D.DEMO) { S.reqIn = S.reqIn.filter(x => x.fid !== fid); if (r) S.friends.push(Object.assign({ pres: null, loc: null }, r)); changed(); return; }
  try {
    await q(sb => sb.from('friendships').update({ status: 'accepted' }).eq('id', fid));
    D.toast('Friend added');
    if (r) api({ event: 'accepted', to: r.id });
    load();
  } catch (e) { D.toast('Couldn’t accept. Check your connection.'); }
}
async function unfriend(fid, msg) {
  if (D.DEMO) { S.friends = S.friends.filter(x => x.fid !== fid); S.reqIn = S.reqIn.filter(x => x.fid !== fid); S.reqOut = S.reqOut.filter(x => x.fid !== fid); changed(); return; }
  try { await q(sb => sb.from('friendships').delete().eq('id', fid)); if (msg) D.toast(msg); load(); }
  catch (e) { D.toast('Couldn’t do that. Check your connection.'); }
}

/* ---------- what a friend is doing (from their shared plan) ---------- */
// trip v3 = { v:3, days:{ dk:{ to:[seg…], home:[seg…] } } }  (v2 = one day: { v:2, dk, to, home })
// seg = [minute, kind, detail]; kinds: walk (stop|hzstop|rh|hz|school) · bus (line) · station (rh|hz) · train (number) · school · home
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
function daysOf(t) {
  if (!t || typeof t !== 'object') return null;
  if (t.v === 3 && t.days && typeof t.days === 'object') return t.days;
  if (t.v === 2 && /^\d{4}-\d{2}-\d{2}$/.test(t.dk)) return { [t.dk]: { to: t.to, home: t.home } };
  return null;
}
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
  const days = daysOf(t); if (!days) return null;
  now = now == null ? D.nowMin() : now;
  const dk = D.todayKey(), d = days[dk];
  if (d) {
    const to = validLeg(d.to) ? d.to : null, home = validLeg(d.home) ? d.home : null;
    let st = null;
    if (to && now < endOf(to)) st = legStatus(to, 'to', dk, now);
    else if (home) st = now < home[0][0] ? { k: 'school', icon: 'school', text: 'At school', sub: 'leaves ' + hhmm(home[0][0]), dir: 'home', train: trainOf(home), dk, leg: home } : legStatus(home, 'home', dk, now);
    else if (to) st = legStatus(to, 'to', dk, now);
    if (st) return st;
  }
  // in the afternoon and evening, tomorrow's plan
  const tk = D.dk(D.dayAt(1)), tm = days[tk];
  if (now >= 12 * 60 && tm && validLeg(tm.to)) return { k: 'plan', icon: 'clock', text: 'Tomorrow · leaves ' + hhmm(tm.to[0][0]), sub: trainOf(tm.to) != null ? hhmm(trainOf(tm.to)) + ' train' : '', dir: 'to', train: trainOf(tm.to), dk: tk, leg: tm.to };
  return null;
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
function locStatus(l) {
  if (!l || l.lat == null || l.lng == null || !l.loc_at) return null;
  const age = Math.max(0, Math.round((Date.now() - Date.parse(l.loc_at)) / 60e3));
  if (!(age <= LOC_FRESH_MIN)) return null;
  return { place: placeName(+l.lat, +l.lng), age, url: 'https://maps.google.com/?q=' + (+l.lat).toFixed(5) + ',' + (+l.lng).toFixed(5) };
}
const ago = m => m <= 0 ? 'just now' : m + ' min ago';

/* ---------- sharing: your trip ---------- */
const shareTrip = () => D.settings.get('shareTrip') === true;
const locOn = () => { try { return localStorage.getItem(LS_LOC) === '1'; } catch (e) { return false; } };
async function upsertOwn(table, fields) {
  if (D.DEMO || S.needsSql || !D.uid()) return false;
  if (S.needsV4 && table !== 'presence') return false;
  try { await q(sb => sb.from(table).upsert(Object.assign({ user_id: D.uid(), updated_at: new Date().toISOString() }, fields))); return true; }
  catch (e) { return false; }
}
// The option you tapped on the School card (otherwise the planner's choice).
function choose(dk, dir, train, leave) { D.writeJSON(LS_CHOSEN, { dk, dir, train, leave }); tick(); }
function pickFor(opts, dk, dir, def) {
  const ch = D.readJSON(LS_CHOSEN);
  if (ch && ch.dk === dk && ch.dir === dir) { const o = (opts || []).find(x => (ch.leave != null ? x.leave === ch.leave : x.train === ch.train)); if (o) return o; }
  return def;
}
function legTo(p) {
  const s = [[p.leave, 'walk', p.bus ? 'stop' : 'rh']];
  if (p.bus) s.push([p.bus.at, 'bus', String(p.bus.line)], [p.bus.off, 'station', 'rh']);
  s.push([p.train, 'train', String(p.trainNo || '')]);
  if (p.hz) s.push([p.trainArr, 'walk', 'hzstop'], [p.hz.at, 'bus', String(p.hz.line) + (p.hz.nick ? ' · ' + p.hz.nick : '')], [p.hz.off, 'walk', 'school']);
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
// The coming school week: there and back for each day, so friends (and their
// notifications) know your plan even if you don't open the app for a few days.
function planWeek(c) {
  const C = window.COMMUTE, ph = C.phase(c), days = {};
  for (let off = 0; off < 7; off++) {
    const d = D.dayAt(off), dk = D.dk(d), wd = d.getDay();
    if (c.offUntil && dk < c.offUntil) continue;
    if (!C.isSchoolDay(c, wd, dk)) continue;
    const m = C.morning(c, wd, dk), a = C.afternoon(c, wd, dk);
    const p = m && pickFor(m.opts, dk, 'to', (off === 0 && ph && ph.kind === 'morning' && ph.pick) || m.best || m.opts[0]);
    const h = a && pickFor(a.opts, dk, 'home', (off === 0 && ph && (ph.kind === 'school' || ph.kind === 'after') && ph.pick) || a.best);
    const day = {}; if (p) day.to = legTo(p); if (h) day.home = legHome(h);
    if (day.to || day.home) days[dk] = day;
  }
  return Object.keys(days).length ? { v: 3, days } : null;
}
function myPlan() {
  const C = window.COMMUTE, row = window.SCHOOL_ROW || window.TODAY_SCHOOL_ROW;
  if (!C || !row || !C.rail()) return null;
  const c = C.cfg(row); if (!c) return null;
  return planWeek(c);
}
// Today's legs stay as sent once they've started: the planner moves on to the next
// bus when the leave time passes, but you're already on your way. Only a choice you
// make yourself (tapping another option) replaces one.
function keepUnderway(t, prev) {
  const dk = D.todayKey(), P = prev && daysOf(prev) && daysOf(prev)[dk];
  if (!P || !t.days[dk]) return t;
  const now = D.nowMin(), ch = D.readJSON(LS_CHOSEN), day = Object.assign({}, t.days[dk]);
  const chosen = (dir, leg) => !!(ch && ch.dk === dk && ch.dir === dir && leg && trainOf(leg) === ch.train);
  ['to', 'home'].forEach(dir => { const p = P[dir]; if (validLeg(p) && p[0][0] <= now && !chosen(dir, day[dir])) day[dir] = p; });
  return { v: 3, days: Object.assign({}, t.days, { [dk]: day }) };
}
function tick() {
  if (!shareTrip() || D.DEMO || S.needsSql || !D.uid()) return;
  let t = myPlan(); if (!t) return;
  const last = D.readJSON(LS_PUB);
  t = keepUnderway(t, last && last.trip);
  const key = JSON.stringify(t);
  if (last && last.key === key && Date.now() - last.at < 30 * 60e3) return; // unchanged: no need to send again
  upsertOwn('presence', { trip: t }).then(ok => { if (ok) D.writeJSON(LS_PUB, { key, at: Date.now(), trip: t }); });
}
async function setShareTrip(on) {
  D.settings.set('shareTrip', !!on);
  D.writeJSON(LS_PUB, null);
  if (on) tick(); else await upsertOwn('presence', { trip: null });
  changed();
}
// who sees your trip: null = all your friends
function setTripTo(list) {
  S.tripTo = list;
  if (!D.DEMO) upsertOwn('presence', { trip_to: list });
  changed();
}
const seesTrip = id => S.tripTo == null || S.tripTo.indexOf(id) >= 0;
function toggleTripFor(id) {
  const all = S.friends.map(f => f.id);
  let list = S.tripTo == null ? all.slice() : S.tripTo.slice();
  const i = list.indexOf(id); if (i >= 0) list.splice(i, 1); else list.push(id);
  setTripTo(all.every(x => list.indexOf(x) >= 0) ? null : list);
}

/* ---------- sharing: your location (this phone, app open, picked friends) ---------- */
let watchId = null, lastLoc = null;
function startLoc() {
  if (!locOn() || D.DEMO || S.needsSql || S.needsV4 || watchId != null || document.hidden || !navigator.geolocation || !D.uid()) return;
  watchId = navigator.geolocation.watchPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude];
    if (lastLoc && dist(ll, lastLoc.ll) < 120 && Date.now() - lastLoc.at < 120e3) return; // every 2 min, or when you've moved
    lastLoc = { ll, at: Date.now() };
    upsertOwn('locations', { lat: +ll[0].toFixed(5), lng: +ll[1].toFixed(5), loc_at: new Date().toISOString(), share_to: S.locTo });
  }, err => {
    if (err && err.code === 1) { setLoc(false); D.toast('Location is blocked for this app. Allow it in your phone’s settings to share it.'); }
  }, { enableHighAccuracy: false, maximumAge: 60e3, timeout: 30e3 });
}
function stopLoc() { if (watchId != null) { try { navigator.geolocation.clearWatch(watchId); } catch (e) {} watchId = null; } }
function setLoc(on) {
  try { localStorage.setItem(LS_LOC, on ? '1' : '0'); } catch (e) {}
  if (on) { lastLoc = null; startLoc(); } else { stopLoc(); lastLoc = null; upsertOwn('locations', { lat: null, lng: null, loc_at: null }); }
  changed();
}
function toggleLocFor(id) {
  const list = S.locTo.slice(), i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  S.locTo = list;
  if (!D.DEMO) upsertOwn('locations', { share_to: list });
  changed();
}

/* ---------- notifications ---------- */
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const pushCapable = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
function b64ToBytes(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); }
async function pushState() {
  if (D.DEMO) return;
  if (!pushCapable()) { S.push = isIOS() && !standalone() ? 'install' : 'unsupported'; return; }
  if (Notification.permission === 'denied') { S.push = 'blocked'; return; }
  try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); S.push = sub && Notification.permission === 'granted' ? 'on' : 'off'; }
  catch (e) { S.push = 'off'; }
}
async function enablePush() {
  if (D.DEMO) { S.push = 'on'; changed(); D.toast('Notifications on (demo)'); return true; }
  if (S.needsV4) { D.toast('Notifications need the database update first'); return false; }
  if (!pushCapable()) { D.toast(isIOS() && !standalone() ? 'Add the app to your Home Screen first, then open it from there' : 'This browser can’t show notifications'); return false; }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { S.push = perm === 'denied' ? 'blocked' : 'off'; changed(); D.toast('Notifications weren’t allowed'); return false; }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    const j = sub.toJSON();
    await q(sb => sb.from('push_subs').upsert({ user_id: D.uid(), endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }));
    // the first time: hear about every friend; you can turn people off one by one
    if (!S.prefs) await savePrefs({ friends: S.friends.map(f => f.id), moments: ['leave', 'station', 'arrive'], timetable: true });
    S.push = 'on'; changed();
    D.toast('Notifications are on');
    return true;
  } catch (e) { console.warn('[push]', e); D.toast('Couldn’t turn notifications on. Try again.'); return false; }
}
async function disablePush() {
  if (D.DEMO) { S.push = 'off'; changed(); return; }
  try {
    const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
    if (sub) { const ep = sub.endpoint; await sub.unsubscribe().catch(() => {}); await q(sb => sb.from('push_subs').delete().eq('user_id', D.uid()).eq('endpoint', ep)).catch(() => {}); }
  } catch (e) {}
  S.push = 'off'; changed(); D.toast('Notifications off on this device');
}
async function savePrefs(patch) {
  S.prefs = Object.assign({ friends: [], moments: ['leave', 'station', 'arrive'], timetable: false }, S.prefs || {}, patch);
  changed();
  if (D.DEMO) return true;
  return upsertOwn('notify_prefs', { friends: S.prefs.friends, moments: S.prefs.moments, timetable: !!S.prefs.timetable });
}
const alertsFor = id => !!(S.prefs && S.prefs.friends.indexOf(id) >= 0);
function toggleAlertsFor(id) {
  const list = (S.prefs ? S.prefs.friends : []).slice(), i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1); else list.push(id);
  savePrefs({ friends: list });
}
// friends you just made get notifications too (if you have them on)
function newFriendsGetAlerts(ids) {
  const known = D.readJSON(LS_KNOWN);
  D.writeJSON(LS_KNOWN, ids);
  if (!known || !S.prefs || S.push !== 'on') return;
  const fresh = ids.filter(id => known.indexOf(id) < 0 && S.prefs.friends.indexOf(id) < 0);
  if (fresh.length) savePrefs({ friends: S.prefs.friends.concat(fresh) });
}
async function testPush(el) {
  if (D.DEMO) { D.toast('Test sent (demo)'); return; }
  if (el) el.disabled = true;
  const r = await api({ test: true });
  if (el) el.disabled = false;
  D.toast(r && r.ok ? 'Sent. It should pop up in a few seconds' : (r && r.error) || 'Couldn’t send a test right now');
}

/* ---------- sheets ---------- */
const sw = (id, label, on, hint, act, extra) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="switch-hit"><button class="switch" id="' + id + '" role="switch" aria-checked="' + !!on + '" data-act="' + act + '"' + (extra || '') + ' aria-label="' + label + '"></button></span></div>';
const chip = (id, label, on, act, data) => '<button class="pick" id="' + id + '" data-act="' + act + '"' + (data || '') + ' aria-pressed="' + !!on + '">' + label + '</button>';
function statusLine(f) {
  const t = tripStatus(f.pres && f.pres.trip), l = locStatus(f.loc);
  if (t) return { icon: t.icon, text: t.text, sub: t.sub, t, l };
  if (l) return { icon: 'locate', text: l.place ? 'Near ' + l.place : 'Sharing location', sub: ago(l.age), l };
  return null;
}
// Their train is your train (same day, same direction, same departure).
function sameTrain(st) {
  if (!st || st.train == null) return false;
  const mine = myPlan(), d = mine && mine.days[st.dk];
  return !!d && trainOf(d[st.dir]) === st.train;
}
function friendRow(f, compact) {
  const st = statusLine(f);
  const same = st && sameTrain(st.t);
  return '<button class="fr-row" id="fr-' + esc(String(f.fid)) + '" data-act="sheet" data-sheet="friend" data-id="' + esc(String(f.id)) + '">' + avatar(f, compact ? 36 : 44) +
    '<span class="fr-main"><b>' + esc(nameOf(f)) + '</b><span class="fr-st">' + (st ? ic(st.icon, 'xs') + '<span>' + esc(st.text) + (st.sub ? ' · ' + esc(st.sub) : '') + '</span>' : '<span>' + (compact ? '' : 'Not sharing right now') + '</span>') + '</span></span>' +
    (same ? '<span class="fr-same">Same train</span>' : st && st.l && st.t ? '<span class="fr-loc" title="Sharing location">' + ic('locate', 'xs') + '</span>' : '') + '</button>';
}
function pushBlock() {
  const st = S.push;
  if (st === 'install') return '<p class="sheet-note">On iPhone, notifications work from the Home Screen app: tap Share → <b>Add to Home Screen</b>, open the app from there, then turn them on here.</p>';
  if (st === 'unsupported') return '<p class="sheet-note">This browser can’t show notifications. Use the app on your phone.</p>';
  if (st === 'blocked') return '<p class="sheet-note">Notifications are blocked for this app. Allow them in your phone’s settings (Settings → Notifications), then come back.</p>';
  if (st !== 'on') return '<button class="btn school block" id="nt-on" data-act="nt-on">Turn on notifications</button>';
  return '<div class="nt-on-row"><span>' + ic('check', 'xs') + 'On for this device</span><button class="btn-text sch" id="nt-test" data-act="nt-test">Send a test</button><button class="btn-text" id="nt-off" data-act="nt-off">Turn off</button></div>';
}
D.SHEETS.profile = a => {
  if (!a._init) { a._init = true; if (!a.keep || !S.pf) { S.pf = { name: (S.me && S.me.display_name) || D.userName(), username: (S.me && S.me.username) || suggestUser(), avatar: (S.me && S.me.avatar) || '' }; S.user = { v: '', state: '' }; } }
  const f = S.pf, fresh = !S.me, has = PHOTO_RE.test(f.avatar || '');
  setTimeout(() => { if (D.sheetKind() === 'profile' && !S.user.v) checkUser(f.username); else paintUser(); }, 0);
  return {
    title: fresh ? 'Your profile' : 'Profile',
    body: '<div class="pf-photo">' + avatar({ avatar: f.avatar, display_name: f.name || f.username }, 88) +
      '<div class="pf-btns"><button class="btn ghost" id="pf-pick" data-act="pf-pick">' + (has ? 'Change photo' : 'Add a photo') + '</button>' +
      (has ? '<button class="btn-text sch" id="pf-rm" data-act="pf-rm">Remove</button>' : '') + '</div>' +
      '<input type="file" accept="image/*" id="pf-file" class="sr" tabindex="-1" aria-hidden="true"></div>' +
      '<label class="field-label" for="pf-name">Name</label><input class="text-in" id="pf-name" value="' + esc(f.name || '') + '" maxlength="40" autocomplete="off">' +
      '<label class="field-label" for="pf-user">Username</label><div class="at-in"><span aria-hidden="true">@</span><input class="text-in" id="pf-user" value="' + esc(f.username || '') + '" maxlength="20" autocomplete="off" autocapitalize="none" spellcheck="false" aria-describedby="pf-user-st"></div>' +
      '<p class="pf-user-st" id="pf-user-st" aria-live="polite"></p>' +
      '<p class="sheet-note">Friends add you by your username, and no one else can have it. Anyone who looks it up sees your name and photo, nothing else.</p>' +
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
  if (S.needsV4) h += '<p class="problem">' + ic('info', 'xs') + '<span>Choosing who sees what, location and notifications need one more database update: run <b>supabase/friends-v4.local.sql</b> in Supabase.</span></p>';
  // what friends see
  h += '<p class="group-title">What friends see</p>' +
    sw('fr-share-trip', 'Share my trip', shareTrip(), 'When you leave, your bus and train, when you get there. Worked out from your plan, so it works with the app closed.', 'fr-share-trip');
  // the chips show who sees it; "Everyone" also covers friends you add later
  if (shareTrip() && S.friends.length && !S.needsV4) h += '<div class="pick-row fr-who" role="group" aria-label="Who sees your trip">' + chip('tt-all', 'Everyone', S.tripTo == null, 'fr-trip-all') + S.friends.map(f => chip('tw-' + f.fid, esc(nameOf(f)), seesTrip(f.id), 'fr-trip-who', ' data-id="' + esc(f.id) + '"')).join('') + '</div>' +
    (S.tripTo != null && !S.tripTo.length ? '<p class="sheet-note warn">Nobody can see your trip right now. Pick friends, or tap Everyone.</p>' : '');
  if (!S.needsV4) {
    h += sw('fr-share-loc', 'Share my location', locOn(), 'From this phone, only while the app is open, only to the friends you pick. They see the nearest stop and can open it in Maps.', 'fr-share-loc');
    if (locOn() && S.friends.length) h += '<div class="pick-row fr-who" role="group" aria-label="Who sees your location">' + S.friends.map(f => chip('lw-' + f.fid, esc(nameOf(f)), S.locTo.indexOf(f.id) >= 0, 'fr-loc-who', ' data-id="' + esc(f.id) + '"')).join('') + '</div>' +
      (S.locTo.length ? '' : '<p class="sheet-note warn">Pick who can see it. Right now nobody can.</p>');
  }
  // notifications
  if (!S.needsV4) {
    h += '<p class="group-title">Notifications</p>' + pushBlock();
    if (S.push === 'on' || D.DEMO) {
      const P = S.prefs || { friends: [], moments: [], timetable: false };
      h += '<p class="sheet-note">Tell me when a friend is:</p><div class="pick-row" role="group" aria-label="Moments">' + MOMENTS.map(m => chip('nm-' + m[0], m[1], P.moments.indexOf(m[0]) >= 0, 'nt-moment', ' data-m="' + m[0] + '"')).join('') + '</div>' +
        (S.friends.length ? '<p class="sheet-note">About:</p><div class="pick-row" role="group" aria-label="Friends to hear about">' + S.friends.map(f => chip('nf-' + f.fid, esc(nameOf(f)), alertsFor(f.id), 'nt-friend', ' data-id="' + esc(f.id) + '"')).join('') + '</div>' : '') +
        sw('nt-tt', 'Tomorrow’s timetable changes', P.timetable, 'Around 20:00, when the school posts them: cancelled lessons and swaps', 'nt-tt');
    }
  }
  return { title: 'Friends', body: h };
};
D.SHEETS.friend = a => {
  const f = S.friends.find(x => String(x.id) === String(a.id));
  if (!f) return { title: 'Friend', body: '<p class="sheet-note">Not on your friends list anymore.</p>' };
  const st = tripStatus(f.pres && f.pres.trip), l = locStatus(f.loc);
  let h = '<div class="fr-hero">' + avatar(f, 64) + '<div><b>' + esc(nameOf(f)) + '</b><span>@' + esc(f.username) + '</span></div></div>';
  if (st) {
    h += '<p class="fr-now">' + ic(st.icon, 'sm') + '<span><b>' + esc(st.text) + '</b>' + (st.sub ? ' · ' + esc(st.sub) : '') + '</span></p>';
    if (sameTrain(st)) h += '<p class="fr-same big">' + ic('train', 'xs') + 'Same train as you</p>';
    h += '<p class="group-title">' + (st.k === 'plan' ? 'Tomorrow' : st.dir === 'to' ? 'To school' : 'Going home') + '</p>' +
      '<ol class="fr-plan">' + st.leg.map((x, j) => '<li class="' + (st.i == null ? '' : j < st.i ? 'past' : j === st.i ? 'now' : '') + '"><span class="t">' + hhmm(x[0]) + '</span>' + ic(ICON[x[1]], 'xs') + '<span>' + esc(segPlan(x, st.dir)) + '</span></li>').join('') + '</ol>';
    h += '<p class="sheet-note">Worked out from ' + esc(nameOf(f)) + '’s planned trip by the clock, not tracked. If they miss a bus, this won’t know.</p>';
  } else h += '<p class="sheet-note">' + esc(nameOf(f)) + ' isn’t sharing a trip right now.</p>';
  if (l) h += '<a class="menu-item fr-map" id="fr-map" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + ic('locate') + '<span class="grow">' + esc(l.place ? 'Near ' + l.place : 'Their location') + '<small>' + ago(l.age) + ' · open in Maps</small></span>' + ic('chev-r', 'sm') + '</a>';
  if (!S.needsV4) {
    const nm = esc(nameOf(f));
    h += '<p class="group-title">With ' + nm + '</p>' +
      sw('ff-trip', 'Sees my trip', shareTrip() && seesTrip(f.id), shareTrip() ? '' : 'Your trip sharing is off', 'ff-trip', ' data-id="' + esc(f.id) + '"' + (shareTrip() ? '' : ' disabled')) +
      sw('ff-loc', 'Sees my location', S.locTo.indexOf(f.id) >= 0, locOn() ? 'While your app is open on this phone' : 'Only when your location sharing is on', 'ff-loc', ' data-id="' + esc(f.id) + '"') +
      sw('ff-alert', 'Notify me about ' + nm, S.push === 'on' && alertsFor(f.id), S.push === 'on' ? 'When they leave, reach the station, arrive' : 'Turns on notifications for this device', 'ff-alert', ' data-id="' + esc(f.id) + '"');
  }
  h += S.removing === f.fid
    ? '<div class="confirm"><p>Remove ' + esc(nameOf(f)) + '? You’ll stop seeing each other’s trips.</p><div class="sheet-actions"><button class="btn ghost" id="fr-rm-no" data-act="fr-rm-no">Cancel</button><button class="btn primary" id="fr-rm-yes" data-act="fr-rm-yes" data-fid="' + f.fid + '">Remove</button></div></div>'
    : '<button class="btn ghost block" id="fr-rm" data-act="fr-rm" data-fid="' + f.fid + '">Remove friend</button>';
  return { title: nameOf(f), body: h };
};

/* ---------- actions ---------- */
function syncProfile() { if (!S.pf) return; const n = $('#pf-name'), u = $('#pf-user'); if (n) S.pf.name = n.value; if (u) S.pf.username = u.value; }
Object.assign(D.ACT, {
  'pf-pick': () => { syncProfile(); const i = $('#pf-file'); if (i) i.click(); },
  'pf-rm': () => { syncProfile(); S.pf.avatar = ''; D.renderSheet(); },
  'pf-save': async el => {
    syncProfile(); el.disabled = true;
    const wasNew = !S.me, ok = await saveProfile(S.pf);
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
  'fr-share-loc': () => setLoc(!locOn()),
  'fr-trip-all': () => setTripTo(S.tripTo == null ? [] : null),
  'fr-trip-who': el => toggleTripFor(el.dataset.id),
  'fr-loc-who': el => toggleLocFor(el.dataset.id),
  'ff-trip': el => toggleTripFor(el.dataset.id),
  'ff-loc': el => { toggleLocFor(el.dataset.id); if (S.locTo.indexOf(el.dataset.id) >= 0 && !locOn()) D.toast('Turn on “Share my location” in Friends to start sharing'); },
  'ff-alert': async el => {
    const id = el.dataset.id, wasOn = S.push === 'on';
    if (!wasOn && !(await enablePush())) return;
    if (wasOn) toggleAlertsFor(id); // flip it
    else if (!alertsFor(id)) toggleAlertsFor(id); // notifications just came on: make sure this friend is included
  },
  'nt-on': () => enablePush(),
  'nt-off': () => disablePush(),
  'nt-test': el => testPush(el),
  'nt-moment': el => { const m = el.dataset.m, list = ((S.prefs && S.prefs.moments) || []).slice(), i = list.indexOf(m); if (i >= 0) list.splice(i, 1); else list.push(m); savePrefs({ moments: list }); },
  'nt-friend': el => toggleAlertsFor(el.dataset.id),
  'nt-tt': () => savePrefs({ timetable: !(S.prefs && S.prefs.timetable) })
});
document.addEventListener('change', e => {
  if (!e.target || e.target.id !== 'pf-file' || !e.target.files || !e.target.files[0]) return;
  const file = e.target.files[0]; e.target.value = '';
  syncProfile();
  // crop and rotate first, then back to the profile with the new photo
  window.PHOTO.edit(file, url => { if (url && S.pf) S.pf.avatar = url; D.openSheet('profile', { keep: true }); });
});
document.addEventListener('input', e => {
  if (!e.target) return;
  if (e.target.id === 'fr-add-in') S.add = e.target.value;
  if (e.target.id === 'pf-user') { if (S.pf) S.pf.username = e.target.value; checkUser(e.target.value); }
  if (e.target.id === 'pf-name' && S.pf) S.pf.name = e.target.value;
});
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
window.SOCIAL = { load, choose, refresh: () => { D.writeJSON(LS_PUB, null); tick(); }, avatar, tripStatus, plan: myPlan, me: () => S.me, friends: () => S.friends, renderSettingsAvatar };
if (D.DEMO) { demo(); }
whenUid(() => {
  if (D.DEMO) { renderStrip(); return; }
  // School shows friends; sharing needs to know the tables are there. Otherwise wait until Friends opens.
  if ($('#friends-slot') || shareTrip() || locOn()) load().then(() => { tick(); startLoc(); });
  renderStrip();
  // a notification tap can open School at #friends
  if (location.hash === '#friends') setTimeout(() => D.openSheet('friends'), 300);
  // friends' trips change by the minute; their rows refresh every minute while you look
  setInterval(() => { if (!document.hidden) { if ($('#friends-slot') || D.sheetKind() === 'friends' || D.sheetKind() === 'friend') load(); else changed(); tick(); } }, 60e3);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopLoc(); else { startLoc(); tick(); if ($('#friends-slot')) load(); } });
});
setInterval(() => { renderStrip(); if (D.sheetKind() === 'friend') D.renderSheet(); }, 30e3);
})();
