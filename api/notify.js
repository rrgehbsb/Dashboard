// Push notifications: standard Web Push signed with this app's own VAPID keys, so no
// third-party service. Ways in:
//
//   POST from the Supabase scheduler every minute (Authorization: Bearer CRON_SECRET)
//     • a friend REALLY at a station or at school: from the location they share with
//       you (their app open), never from the clock: the clock can't know they missed
//       the bus. To the friends who asked for them.
//     • tomorrow's ride: at 20:30 who's on which train tomorrow; then, until the trip,
//       when one of those friends switches trains
//     • in the evening, tomorrow's timetable changes, to whoever asked for them
//   POST with a signed-in user's access token:
//     { test: true }                 a test notification to yourself
//     { event: 'request', to }       tell someone you sent them a friend request
//     { event: 'accepted', to }      tell someone you accepted their request
//     (both events are checked against the friendships table first)
//   GET  → { ok, ready } (is the server configured? never shows any key)
//   GET ?checkin=<key>&at=rh|hz|school  an auto check-in from the phone (iPhone Shortcuts
//        "Arrive" automation, app closed): your location is set to that place, so the
//        friends who see your location see you there and get the notification. Only
//        while "Auto check-ins" is on in your settings (key and switch in uid:settings).
//
// Tables (supabase/friends-v4.sql): push_subs, notify_prefs, notify_log, presence,
// locations, friendships, profiles; app_state for your class (timetable alerts).
const webpush = require('web-push');

const TZ = 'Asia/Jerusalem';
const SITE = 'https://y-tdashh1-black.vercel.app';
const WINDOW = 5; // a moment can still go out this many minutes late (the scheduler can lag)
const LOC_FRESH_MIN = 10;
const PLACE = {
  rh: { name: 'Rosh HaAyin North', ll: [32.120865, 34.934527], r: 350 },
  hz: { name: 'Herzliya station', ll: [32.163558, 34.817406], r: 350 }
};
const SCHOOL_LL = [[32.16397, 34.82495], [32.16410, 34.82615]];

function cfg() {
  let url = String(process.env.SUPABASE_URL || '').trim();
  try { url = new URL(url).origin; } catch (e) { url = url.replace(/\/+$/, ''); }
  return {
    url, key: String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    pub: String(process.env.VAPID_PUBLIC_KEY || '').trim(), priv: String(process.env.VAPID_PRIVATE_KEY || '').trim(),
    cron: String(process.env.CRON_SECRET || '').trim()
  };
}

/* ---------- database (service key: this runs on the server only) ---------- */
function db(C) {
  const h = { apikey: C.key, Authorization: 'Bearer ' + C.key, 'Content-Type': 'application/json' };
  const get = async path => { const r = await fetch(C.url + '/rest/v1/' + path, { headers: h }); if (!r.ok) throw new Error(path.split('?')[0] + ' ' + r.status + ' ' + (await r.text()).slice(0, 120)); return r.json(); };
  // Claim log keys: only the ones not sent before come back, so two runs can't both send.
  const claim = async keys => {
    if (!keys.length) return new Set();
    const r = await fetch(C.url + '/rest/v1/notify_log?on_conflict=key', { method: 'POST', headers: Object.assign({ Prefer: 'resolution=ignore-duplicates,return=representation' }, h), body: JSON.stringify(keys.map(key => ({ key }))) });
    if (!r.ok) throw new Error('notify_log ' + r.status);
    return new Set((await r.json()).map(x => x.key));
  };
  const del = async path => { await fetch(C.url + '/rest/v1/' + path, { method: 'DELETE', headers: h }).catch(() => {}); };
  return { get, claim, del };
}
const inList = ids => 'in.(' + ids.map(x => '"' + String(x).replace(/["\\]/g, '') + '"').join(',') + ')';

/* ---------- time (Israel) ---------- */
function israelNow(d) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d || new Date());
  const g = t => (parts.find(p => p.type === t) || {}).value;
  return { dk: g('year') + '-' + g('month') + '-' + g('day'), min: (+g('hour') % 24) * 60 + +g('minute') };
}
const addDays = (dk, n) => { const [y, m, d] = dk.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const weekday = dk => { const [y, m, d] = dk.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ---------- words: each person gets notifications in the language their app is in ---------- */
const M = {
  en: {
    dow: DOW, place: { rh: 'Rosh HaAyin North', hz: 'Herzliya station' }, theStation: 'the station', friend: 'A friend', someone: 'Someone',
    train: t => t + ' train', bus: (l, t) => 'bus ' + l + ' at ' + t,
    leaveTo: 'Leaving home about now', leaveHome: 'Leaving school about now',
    at: p => 'At ' + p, shouldBeAt: p => 'Should be at ' + p,
    onTrain: (tr, to) => 'On the ' + tr + ' to ' + (to ? 'Herzliya' : 'Rosh HaAyin'),
    atSchool: 'At school', shouldSchool: 'Should be at school now', shouldHome: 'Should be home now', same: 'same train as you',
    cancelled: (n, w) => 'Lesson ' + n + ' cancelled' + (w ? ' (' + w + ')' : ''),
    changed: (n, a, w) => 'Lesson ' + n + ': ' + a + (w ? ' instead of ' + w : ''),
    added: (n, a) => 'Lesson ' + n + ': ' + a + ' (new)',
    notListed: (s, t) => s + ' · ' + t + ' isn’t listed', more: n => '+' + n + ' more',
    ttTitle: d => 'Tomorrow’s timetable · ' + d,
    testTitle: 'Notifications are on', testBody: 'Your friends’ trips and timetable changes will show up here.',
    reqTitle: 'Friend request', reqBody: w => w + ' wants to be friends', accBody: 'Accepted your friend request',
    rideTitle: d => 'Tomorrow’s ride · ' + d, you: t => 'you: ' + t, nowOn: tr => 'Now on the ' + tr, yourTrain: 'your train'
  },
  he: {
    dow: ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'],
    place: { rh: 'תחנת ראש העין צפון', hz: 'תחנת הרצליה' }, theStation: 'התחנה', friend: 'חבר', someone: 'מישהו',
    train: t => 'הרכבת של ' + t, bus: (l, t) => 'אוטובוס ' + l + ' ב־' + t,
    leaveTo: 'יציאה מהבית, בערך עכשיו', leaveHome: 'יציאה מבית הספר, בערך עכשיו',
    at: p => 'ב' + p.replace(/^ה/, ''), shouldBeAt: p => 'כנראה ב' + p.replace(/^ה/, ''),
    onTrain: (tr, to) => 'ב' + tr.replace(/^ה/, '') + (to ? ' להרצליה' : ' לראש העין'),
    atSchool: 'בבית הספר', shouldSchool: 'כנראה כבר בבית הספר', shouldHome: 'כנראה כבר בבית', same: 'באותה רכבת כמוך',
    cancelled: (n, w) => 'שיעור ' + n + ' בוטל' + (w ? ' (' + w + ')' : ''),
    changed: (n, a, w) => 'שיעור ' + n + ': ' + a + (w ? ' במקום ' + w : ''),
    added: (n, a) => 'שיעור ' + n + ': ' + a + ' (חדש)',
    notListed: (s, t) => s + ' · ' + t + ' לא ברשימה', more: n => '+' + n + ' נוספים',
    ttTitle: d => 'המערכת של מחר · ' + d,
    testTitle: 'ההתראות פועלות', testBody: 'נסיעות של חברים ושינויים במערכת יופיעו כאן.',
    reqTitle: 'בקשת חברות', reqBody: w => w + ' רוצה להיות חברים', accBody: 'בקשת החברות שלך אושרה',
    rideTitle: d => 'הנסיעה של מחר · ' + d, you: t => 'שלך: ' + t, nowOn: tr => 'עכשיו ב' + tr.replace(/^ה/, ''), yourTrain: 'הרכבת שלך'
  }
};
const W = lang => M[lang === 'he' ? 'he' : 'en'];
// everyone's language, from their synced settings (uid:settings → lang)
async function langsOf(D, ids) {
  const out = {};
  if (!ids.length) return out;
  try { (await D.get('app_state?select=key,lang:data->>lang&key=' + inList(ids.map(id => id + ':settings')))).forEach(r => { out[r.key.split(':')[0]] = r.lang; }); } catch (e) {}
  return out;
}
const hh = m => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function dist(a, b) { const R = 6371e3, r = x => x * Math.PI / 180; const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }

/* ---------- sending ---------- */
async function sendTo(C, D, subs, payload) {
  let sent = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 900, urgency: 'high' });
      sent++;
    } catch (e) {
      // the phone unsubscribed or the app was removed: forget that subscription
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await D.del('push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint));
      else console.warn('[notify] push failed', e && e.statusCode, e && e.body);
    }
  }));
  return sent;
}

/* ---------- friends' trips ---------- */
// Trip plans: v3 = { days: { dk: { to, home } } }; v2 = { dk, to, home }.
function dayOf(trip, dk) {
  if (!trip || typeof trip !== 'object') return null;
  if (trip.v === 3 && trip.days && typeof trip.days === 'object') return trip.days[dk] || null;
  if (trip.v === 2 && trip.dk === dk) return { to: trip.to, home: trip.home };
  return null;
}
const validLeg = s => Array.isArray(s) && s.length > 0 && s.length < 20 && s.every(x => Array.isArray(x) && typeof x[0] === 'number');
const trainOf = leg => { const x = validLeg(leg) && leg.find(y => y[1] === 'train'); return x ? x[0] : null; };
// Which notifications someone wants. Saved before Nov 2026 = the old clock moments: give
// them the real ones, and tomorrow's ride.
function wants(V) {
  const m = Array.isArray(V.moments) ? V.moments : [];
  if (!m.length || m.indexOf('leave') >= 0 || m.indexOf('train') >= 0) return ['station', 'arrive', 'ride'].concat(m.filter(x => x !== 'leave' && x !== 'train'));
  return m;
}
function near(loc, place) {
  if (!loc || loc.lat == null || !loc.loc_at) return false;
  if ((Date.now() - Date.parse(loc.loc_at)) / 60e3 > LOC_FRESH_MIN) return false;
  const ll = [+loc.lat, +loc.lng];
  if (place === 'school') return SCHOOL_LL.some(s => dist(ll, s) < 250);
  return !!PLACE[place] && dist(ll, PLACE[place].ll) < PLACE[place].r;
}
// where their shared location puts them on this trip (null: nowhere we can name)
function placeOn(loc, dir) {
  if (dir === 'to' && near(loc, 'school')) return 'school';
  return near(loc, 'rh') ? 'rh' : near(loc, 'hz') ? 'hz' : null;
}
function arrivalBody(at, dir, leg, same, lang) {
  const w = W(lang), tr = trainOf(leg);
  if (at === 'school') return w.atSchool;
  const boarding = (dir === 'to' && at === 'rh') || (dir === 'home' && at === 'hz');
  return w.at(w.place[at]) + (boarding && tr != null ? ' · ' + w.train(hh(tr)) + (same ? ' · ' + w.same : '') : '');
}

async function friendArrivals(C, D, now, prefs, subsBy) {
  const viewers = prefs.filter(p => Array.isArray(p.friends) && p.friends.length && subsBy[p.user_id]);
  if (!viewers.length) return 0;
  const sharers = Array.from(new Set(viewers.reduce((a, p) => a.concat(p.friends), [])));
  const locs = await D.get('locations?select=user_id,lat,lng,loc_at,share_to&user_id=' + inList(sharers)).catch(() => []);
  const L = {}; locs.forEach(l => { if (l.loc_at && (Date.now() - Date.parse(l.loc_at)) / 60e3 <= LOC_FRESH_MIN) L[l.user_id] = l; });
  if (!Object.keys(L).length) return 0; // nobody is sharing a fresh location: nothing real to tell
  const [pres, fr, profs] = await Promise.all([
    D.get('presence?select=user_id,trip,trip_to&user_id=' + inList(Object.keys(L).concat(viewers.map(v => v.user_id)))),
    D.get('friendships?select=requester,addressee&status=eq.accepted&or=(requester.' + inList(sharers) + ',addressee.' + inList(sharers) + ')'),
    D.get('profiles?select=id,username,display_name&id=' + inList(Object.keys(L)))
  ]);
  const P = {}; pres.forEach(p => { P[p.user_id] = p; });
  const N = {}; profs.forEach(p => { N[p.id] = p.display_name || p.username || ''; });
  const LANG = await langsOf(D, viewers.map(v => v.user_id));
  const friends = new Set(fr.map(f => f.requester + '|' + f.addressee));
  const isFriend = (a, b) => friends.has(a + '|' + b) || friends.has(b + '|' + a);

  const jobs = [];
  viewers.forEach(V => {
    const want = wants(V);
    const mine = dayOf(P[V.user_id] && P[V.user_id].trip, now.dk);
    V.friends.forEach(S => {
      const loc = L[S], pr = P[S];
      if (!loc || !pr || !isFriend(V.user_id, S)) return;
      if (!Array.isArray(loc.share_to) || loc.share_to.indexOf(V.user_id) < 0) return; // location not shared with this viewer
      if (Array.isArray(pr.trip_to) && pr.trip_to.indexOf(V.user_id) < 0) return; // nor the trip
      const day = dayOf(pr.trip, now.dk); if (!day) return;
      ['to', 'home'].forEach(dir => {
        const leg = day[dir]; if (!validLeg(leg)) return;
        if (now.min < leg[0][0] - 20 || now.min > leg[leg.length - 1][0] + 45) return; // only around that trip
        const at = placeOn(loc, dir); if (!at) return;
        if (want.indexOf(at === 'school' ? 'arrive' : 'station') < 0) return;
        const same = trainOf(leg) != null && mine && trainOf(mine[dir]) === trainOf(leg);
        jobs.push({ key: ['at', S, V.user_id, now.dk, dir, at].join(':'), to: V.user_id, payload: { title: N[S] || W(LANG[V.user_id]).friend, body: arrivalBody(at, dir, leg, same, LANG[V.user_id]), tag: 'fr-' + S, url: '/v3/school.html#friends' } });
      });
    });
  });
  if (!jobs.length) return 0;
  const fresh = await D.claim(jobs.map(j => j.key));
  let sent = 0;
  for (const j of jobs) if (fresh.has(j.key)) sent += await sendTo(C, D, subsBy[j.to], j.payload);
  return sent;
}

/* ---------- tomorrow's ride: who's on which train ---------- */
// "07:19: Noa ✓, Dan · 07:34: Maya · you: 07:19"
function rideSummary(myTrain, list, lang) {
  const w = W(lang), by = {};
  list.forEach(f => { (by[f.train] = by[f.train] || []).push(f.name + (f.ok ? ' ✓' : '')); });
  const parts = Object.keys(by).map(Number).sort((a, b) => a - b).map(t => hh(t) + ': ' + by[t].join(', '));
  return parts.join(' · ') + (myTrain != null ? ' · ' + w.you(hh(myTrain)) : '');
}
// 20:30–23:00: tomorrow's ride, then switches. 05:00–07:30: switches for this morning.
async function rideAlerts(C, D, now, prefs, subsBy) {
  const evening = now.min >= 20 * 60 + 30 && now.min <= 23 * 60, morning = now.min >= 5 * 60 && now.min <= 7 * 60 + 30;
  if (!evening && !morning) return 0;
  const dk = evening ? addDays(now.dk, 1) : now.dk, wd = weekday(dk);
  if (wd === 5 || wd === 6) return 0;
  const viewers = prefs.filter(p => Array.isArray(p.friends) && p.friends.length && subsBy[p.user_id] && wants(p).indexOf('ride') >= 0);
  if (!viewers.length) return 0;
  const sharers = Array.from(new Set(viewers.reduce((a, p) => a.concat(p.friends), [])));
  const [pres, fr, profs] = await Promise.all([
    D.get('presence?select=user_id,trip,trip_to&user_id=' + inList(sharers.concat(viewers.map(v => v.user_id)))),
    D.get('friendships?select=requester,addressee&status=eq.accepted&or=(requester.' + inList(sharers) + ',addressee.' + inList(sharers) + ')'),
    D.get('profiles?select=id,username,display_name&id=' + inList(sharers))
  ]);
  const P = {}; pres.forEach(p => { P[p.user_id] = p; });
  const N = {}; profs.forEach(p => { N[p.id] = p.display_name || p.username || ''; });
  const LANG = await langsOf(D, viewers.map(v => v.user_id));
  const friends = new Set(fr.map(f => f.requester + '|' + f.addressee));
  const isFriend = (a, b) => friends.has(a + '|' + b) || friends.has(b + '|' + a);
  let sent = 0;
  for (const V of viewers) {
    const lang = LANG[V.user_id], w = W(lang);
    const md = dayOf(P[V.user_id] && P[V.user_id].trip, dk), myTrain = md ? trainOf(md.to) : null;
    if (!evening && md && validLeg(md.to) && now.min >= md.to[0][0]) continue; // you've left: no more switches
    const list = [];
    V.friends.forEach(S => {
      const pr = P[S]; if (!pr || !isFriend(V.user_id, S)) return;
      if (Array.isArray(pr.trip_to) && pr.trip_to.indexOf(V.user_id) < 0) return;
      const d = dayOf(pr.trip, dk), t = d ? trainOf(d.to) : null;
      if (t != null) list.push({ id: S, name: N[S] || w.friend, train: t, ok: !!d.ok });
    });
    if (!list.length) continue;
    const base = ['ride', V.user_id, dk].join(':'), seen = list.map(f => ['rs', V.user_id, f.id, dk, f.train].join(':'));
    if (evening && (await D.claim([base])).has(base)) {
      await D.claim(seen); // where everyone is now: later changes are switches
      sent += await sendTo(C, D, subsBy[V.user_id], { title: w.rideTitle(w.dow[wd]), body: rideSummary(myTrain, list, lang), tag: 'ride-' + dk, url: '/v3/school.html#friends' });
      continue;
    }
    const had = await D.get('notify_log?select=key&key=eq.' + encodeURIComponent(base)).catch(() => []);
    if (!had.length) continue; // no summary that night: nothing to compare with
    const fresh = await D.claim(seen);
    for (const f of list) {
      if (!fresh.has(['rs', V.user_id, f.id, dk, f.train].join(':'))) continue;
      sent += await sendTo(C, D, subsBy[V.user_id], { title: f.name, body: w.nowOn(w.train(hh(f.train))) + (f.train === myTrain ? ' · ' + w.yourTrain : ''), tag: 'ride-' + f.id, url: '/v3/school.html#friends' });
    }
  }
  return sent;
}

/* ---------- tomorrow's timetable (evenings) ---------- */
// The same "your lessons" rules as the app (v3/timetable.js).
const ALIAS = { 'מעבדת פיזיקה': 'פיזיקה', 'מעבדת פיסיקה': 'פיזיקה', 'פיסיקה': 'פיזיקה', 'שעת מחנך': 'חינוך', 'מתמטיקה טכניונית': 'מתמטיקה מואץ' };
function norm(s) { let t = String(s || '').replace(/["״׳']/g, '').replace(/(^|\s)תלן(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim(); t = t.replace(/\s+\d+$/, ''); return ALIAS[t] || t; }
const parsePick = x => { const i = String(x).indexOf('|'); return i < 0 ? { s: norm(x), t: null } : { s: norm(String(x).slice(0, i)), t: String(x).slice(i + 1) }; };
// split periods: only your groups (your teacher's, if you picked one); whole-class lessons stay
function myItems(items, mine, ctx) {
  const list = (items || []).map(e => typeof e === 'string' ? { subject: e, teacher: '' } : e);
  if (!mine.length || list.length <= 1) return list;
  const picks = mine.map(parsePick), keep = new Set();
  list.forEach(e => { const P = picks.filter(p => p.s === norm(e.subject)); if (!P.length) return; const T = P.map(p => p.t).filter(Boolean); if (!T.length || !e.teacher || T.indexOf(e.teacher) >= 0) keep.add(e); });
  if (ctx) { const m = picks.find(p => p.t && !list.some(e => keep.has(e) && norm(e.subject) === p.s) && list.some(e => norm(e.subject) === p.s)); if (m) ctx.teacherMissing = m; }
  return list.filter(e => keep.has(e));
}
const subjKey = l => Array.from(new Set(l.map(x => norm(typeof x === 'string' ? x : x.subject)))).sort().join('|');
function myStatus(st, items, was) {
  if (st !== 'changed' && st !== 'added' && st !== 'cancelled') return st;
  if (!items.length) return was.length ? 'cancelled' : 'same';
  if (!was.length) return 'added';
  return subjKey(items) === subjKey(was) ? 'same' : 'changed';
}
function changesFor(day, mine, lang) {
  const w = W(lang), out = [];
  (day.periods || []).forEach(p => {
    const ctx = {}, items = myItems(p.items, mine, ctx);
    let was = p.was ? myItems(p.was, mine).map(e => e.subject) : [];
    let st = mine.length ? myStatus(p.status, items, was) : p.status;
    if (ctx.teacherMissing && !items.length) { st = 'cancelled'; was = [w.notListed(ctx.teacherMissing.s, ctx.teacherMissing.t)]; }
    const names = l => Array.from(new Set(l.map(x => typeof x === 'string' ? x : x.subject))).join(', ');
    if (st === 'cancelled') out.push(w.cancelled(p.n, was.length ? names(was) : ''));
    else if (st === 'changed') out.push(w.changed(p.n, names(items), was.length ? names(was) : ''));
    else if (st === 'added') out.push(w.added(p.n, names(items)));
  });
  return out;
}
async function timetableAlerts(C, D, now, prefs, subsBy) {
  if (now.min < 19 * 60 + 30 || now.min > 23 * 60 || now.min % 5) return 0; // evenings, every 5 minutes
  const tomorrow = addDays(now.dk, 1), wd = weekday(tomorrow);
  if (wd === 5 || wd === 6) return 0;
  const people = prefs.filter(p => p.timetable && subsBy[p.user_id]);
  if (!people.length) return 0;
  const rows = await D.get('app_state?select=key,data&key=' + inList(people.map(p => p.user_id + ':school')));
  const LANG = await langsOf(D, people.map(p => p.user_id));
  const byClass = {}, jobs = [];
  for (const p of people) {
    const row = rows.find(r => r.key === p.user_id + ':school');
    const tt = row && row.data && row.data['dashboard:school:v1:timetable'];
    if (!tt || !tt.cls || !/^\d{1,2}-\d{1,2}$/.test(tt.cls)) continue;
    if (!byClass[tt.cls]) byClass[tt.cls] = fetch(SITE + '/api/school?cls=' + encodeURIComponent(tt.cls)).then(r => r.json()).catch(() => null);
    const j = await byClass[tt.cls];
    const day = j && j.days && j.days[tomorrow];
    if (!day || !day.published) continue;
    const lang = LANG[p.user_id], w = W(lang);
    const ch = changesFor(day, Array.isArray(tt.mine) ? tt.mine : [], lang);
    const notes = (day.notes || []).map(n => n.text).filter(Boolean);
    if (!ch.length && !notes.length) continue;
    const lines = notes.slice(0, 1).concat(ch);
    const body = lines.slice(0, 3).join(' · ') + (lines.length > 3 ? ' · ' + w.more(lines.length - 3) : '');
    // a new key if the school changes the day again later
    const sig = require('crypto').createHash('sha1').update(lines.join('|')).digest('hex').slice(0, 10);
    jobs.push({ key: ['tt', p.user_id, tomorrow, sig].join(':'), to: p.user_id, payload: { title: w.ttTitle(w.dow[wd]), body, tag: 'tt-' + tomorrow, url: '/v3/school.html' } });
  }
  if (!jobs.length) return 0;
  const fresh = await D.claim(jobs.map(j => j.key));
  let sent = 0;
  for (const j of jobs) if (fresh.has(j.key)) sent += await sendTo(C, D, subsBy[j.to], j.payload);
  return sent;
}

/* ---------- auto check-ins (a link opened by the phone, app closed) ---------- */
const CHECKIN_LL = { rh: PLACE.rh.ll, hz: PLACE.hz.ll, school: SCHOOL_LL[0] };
async function checkin(C, res, key, at) {
  if (!/^[A-Za-z0-9]{20,40}$/.test(key) || !CHECKIN_LL[at]) return res.status(400).json({ ok: false, error: 'This link isn’t complete. Copy it again from the app.' });
  if (!C.url || !C.key) return res.status(500).json({ ok: false, error: 'Not set up on the server.' });
  const D = db(C);
  const rows = await D.get('app_state?select=key,on:data->>autoCheckin&key=like.*%3Asettings&data->>checkinKey=eq.' + key);
  if (rows.length !== 1) return res.status(404).json({ ok: false, error: 'This link isn’t active anymore. Make a new one in the app.' });
  if (rows[0].on !== 'true') return res.status(200).json({ ok: false, off: true, error: 'Auto check-ins are off in the app.' });
  const uid = rows[0].key.split(':')[0], ll = CHECKIN_LL[at];
  const r = await fetch(C.url + '/rest/v1/locations?on_conflict=user_id', { method: 'POST', headers: { apikey: C.key, Authorization: 'Bearer ' + C.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: uid, lat: ll[0], lng: ll[1], loc_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  if (!r.ok) return res.status(500).json({ ok: false, error: 'Couldn’t save it. Try again.' });
  return res.status(200).json({ ok: true, at });
}

/* ---------- requests from a signed-in user ---------- */
async function userFrom(C, req) {
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok || tok === C.cron) return null;
  const r = await fetch(C.url + '/auth/v1/user', { headers: { apikey: C.key, Authorization: 'Bearer ' + tok } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && u.id ? u : null;
}

module.exports = async function handler(req, res) {
  const C = cfg();
  const ready = !!(C.url && C.key && C.pub && C.priv);
  if (req.method === 'GET') {
    const qs = req.query || {};
    if (qs.checkin) { try { return await checkin(C, res, String(qs.checkin), String(qs.at || '')); } catch (e) { return res.status(500).json({ ok: false, error: 'Couldn’t save it. Try again.' }); } }
    const out = { ok: true, ready, scheduler: !!C.cron };
    // with the scheduler secret: when did the scheduler last call? (proves it runs)
    if (C.cron && String(req.headers.authorization || '') === 'Bearer ' + C.cron && ready) {
      try { const hb = (await db(C).get('notify_log?select=at&key=eq.heartbeat'))[0]; out.lastCall = hb ? hb.at : null; out.secondsAgo = hb ? Math.round((Date.now() - Date.parse(hb.at)) / 1000) : null; } catch (e) { out.lastCall = 'unknown'; }
    }
    return res.status(200).json(out);
  }
  if (req.method !== 'POST') return res.status(405).end();
  if (!ready) return res.status(500).json({ ok: false, error: 'Notifications aren’t set up on the server yet.' });
  webpush.setVapidDetails(SITE, C.pub, C.priv);
  const D = db(C);
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const auth = String(req.headers.authorization || '');

  try {
    // the scheduler
    if (C.cron && auth === 'Bearer ' + C.cron) {
      const now = israelNow();
      await fetch(C.url + '/rest/v1/notify_log?on_conflict=key', { method: 'POST', headers: { apikey: C.key, Authorization: 'Bearer ' + C.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'heartbeat', at: new Date().toISOString() }) }).catch(() => {});
      const prefs = await D.get('notify_prefs?select=user_id,friends,moments,timetable');
      const ids = prefs.map(p => p.user_id);
      const subs = ids.length ? await D.get('push_subs?select=user_id,endpoint,p256dh,auth&user_id=' + inList(ids)) : [];
      const subsBy = {}; subs.forEach(s => { (subsBy[s.user_id] = subsBy[s.user_id] || []).push(s); });
      const a = await friendArrivals(C, D, now, prefs, subsBy);
      const b = await timetableAlerts(C, D, now, prefs, subsBy);
      const c = await rideAlerts(C, D, now, prefs, subsBy);
      return res.status(200).json({ ok: true, at: now, sent: a + b + c });
    }

    // a signed-in user
    const u = await userFrom(C, req);
    if (!u) return res.status(401).json({ ok: false, error: 'Sign in again.' });
    const subsOf = id => D.get('push_subs?select=user_id,endpoint,p256dh,auth&user_id=eq.' + encodeURIComponent(id));
    const nameOf = async (id, w) => { const p = (await D.get('profiles?select=username,display_name&id=eq.' + encodeURIComponent(id)))[0]; return (p && (p.display_name || p.username)) || w.someone; };

    if (body.test) {
      const subs = await subsOf(u.id);
      if (!subs.length) return res.status(200).json({ ok: false, code: 'no_subs', error: 'This phone isn’t signed up for notifications yet.' });
      const w = W((await langsOf(D, [u.id]))[u.id]);
      const sent = await sendTo(C, D, subs, { title: w.testTitle, body: w.testBody, tag: 'test', url: '/v3/' });
      return res.status(200).json({ ok: sent > 0, sent });
    }
    if ((body.event === 'request' || body.event === 'accepted') && /^[0-9a-f-]{36}$/i.test(String(body.to || ''))) {
      const to = String(body.to);
      const q = body.event === 'request'
        ? 'friendships?select=id&status=eq.pending&requester=eq.' + u.id + '&addressee=eq.' + to
        : 'friendships?select=id&status=eq.accepted&addressee=eq.' + u.id + '&requester=eq.' + to;
      const row = (await D.get(q))[0];
      if (!row) return res.status(200).json({ ok: false, code: 'no_request' });
      const fresh = await D.claim([['ev', body.event, row.id].join(':')]);
      if (!fresh.size) return res.status(200).json({ ok: true, sent: 0 });
      const subs = await subsOf(to); if (!subs.length) return res.status(200).json({ ok: true, sent: 0 });
      const w = W((await langsOf(D, [to]))[to]), who = await nameOf(u.id, w);
      const sent = await sendTo(C, D, subs, body.event === 'request'
        ? { title: w.reqTitle, body: w.reqBody(who), tag: 'req-' + u.id, url: '/v3/school.html#friends' }
        : { title: who, body: w.accBody, tag: 'acc-' + u.id, url: '/v3/school.html#friends' });
      return res.status(200).json({ ok: true, sent });
    }
    return res.status(400).json({ ok: false, error: 'Unknown request' });
  } catch (e) {
    console.warn('[notify]', e && e.message);
    return res.status(502).json({ ok: false, error: 'Something went wrong sending notifications.' });
  }
};

// for tests
module.exports._test = { checkin, israelNow, arrivalBody, placeOn, rideSummary, rideAlerts, friendArrivals, wants, changesFor, dayOf, addDays };
