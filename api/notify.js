// Push notifications: standard Web Push signed with this app's own VAPID keys, so no
// third-party service. Ways in:
//
//   POST from the Supabase scheduler every minute (Authorization: Bearer CRON_SECRET)
//     • friends' trip moments that just happened (leaving, at the station, on the
//       train, arrived), to the friends who asked for them
//     • in the evening, tomorrow's timetable changes, to whoever asked for them
//   POST with a signed-in user's access token:
//     { test: true }                 a test notification to yourself
//     { event: 'request', to }       tell someone you sent them a friend request
//     { event: 'accepted', to }      tell someone you accepted their request
//     (both events are checked against the friendships table first)
//   GET  → { ok, ready } (is the server configured? never shows any key)
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
function momentsOf(leg) {
  const st = leg.find(x => x[1] === 'station'), tr = leg.find(x => x[1] === 'train');
  const out = [{ m: 'leave', t: leg[0][0] }];
  if (st) out.push({ m: 'station', t: st[0], where: st[2] });
  if (tr) out.push({ m: 'train', t: tr[0] });
  out.push({ m: 'arrive', t: leg[leg.length - 1][0] });
  return out;
}
function near(loc, place) {
  if (!loc || loc.lat == null || !loc.loc_at) return false;
  if ((Date.now() - Date.parse(loc.loc_at)) / 60e3 > LOC_FRESH_MIN) return false;
  const ll = [+loc.lat, +loc.lng];
  if (place === 'school') return SCHOOL_LL.some(s => dist(ll, s) < 250);
  return !!PLACE[place] && dist(ll, PLACE[place].ll) < PLACE[place].r;
}
function bodyFor(mo, dir, leg, loc, same) {
  const tr = leg.find(x => x[1] === 'train'), bus = leg.find(x => x[1] === 'bus');
  const train = tr ? hh(tr[0]) + ' train' : '';
  const busTxt = bus ? 'bus ' + String(bus[2] || '') + ' at ' + hh(bus[0]) : '';
  let t = '';
  if (mo.m === 'leave') t = (dir === 'to' ? 'Leaving home about now' : 'Leaving school about now') + (dir === 'to' && busTxt ? ' · ' + busTxt : train ? ' · ' + train : '');
  else if (mo.m === 'station') { const p = PLACE[mo.where] || { name: 'the station' }; t = (near(loc, mo.where) ? 'At ' : 'Should be at ') + p.name + (train ? ' · ' + train : ''); }
  else if (mo.m === 'train') t = 'On the ' + train + ' to ' + (dir === 'to' ? 'Herzliya' : 'Rosh HaAyin');
  else t = dir === 'to' ? (near(loc, 'school') ? 'At school' : 'Should be at school now') : 'Should be home now';
  return t + (same && (mo.m === 'station' || mo.m === 'train') ? ' · same train as you' : '');
}

async function friendMoments(C, D, now, prefs, subsBy) {
  const viewers = prefs.filter(p => Array.isArray(p.friends) && p.friends.length && subsBy[p.user_id]);
  if (!viewers.length) return 0;
  const sharers = Array.from(new Set(viewers.reduce((a, p) => a.concat(p.friends), [])));
  const [pres, fr, locs, profs] = await Promise.all([
    D.get('presence?select=user_id,trip,trip_to&user_id=' + inList(sharers.concat(viewers.map(v => v.user_id)))),
    D.get('friendships?select=requester,addressee&status=eq.accepted&or=(requester.' + inList(sharers) + ',addressee.' + inList(sharers) + ')'),
    D.get('locations?select=user_id,lat,lng,loc_at,share_to&user_id=' + inList(sharers)).catch(() => []),
    D.get('profiles?select=id,username,display_name&id=' + inList(sharers))
  ]);
  const P = {}; pres.forEach(p => { P[p.user_id] = p; });
  const L = {}; locs.forEach(l => { L[l.user_id] = l; });
  const N = {}; profs.forEach(p => { N[p.id] = p.display_name || p.username || 'A friend'; });
  const friends = new Set(fr.map(f => f.requester + '|' + f.addressee));
  const isFriend = (a, b) => friends.has(a + '|' + b) || friends.has(b + '|' + a);

  const jobs = [];
  viewers.forEach(V => {
    const want = Array.isArray(V.moments) && V.moments.length ? V.moments : ['leave', 'station', 'arrive'];
    const mine = dayOf(P[V.user_id] && P[V.user_id].trip, now.dk);
    V.friends.forEach(S => {
      const pr = P[S];
      if (!pr || !isFriend(V.user_id, S)) return;
      if (Array.isArray(pr.trip_to) && pr.trip_to.indexOf(V.user_id) < 0) return; // not shared with this viewer
      const day = dayOf(pr.trip, now.dk); if (!day) return;
      const loc = L[S] && Array.isArray(L[S].share_to) && L[S].share_to.indexOf(V.user_id) >= 0 ? L[S] : null;
      ['to', 'home'].forEach(dir => {
        const leg = day[dir]; if (!validLeg(leg)) return;
        const myTrain = mine && validLeg(mine[dir]) ? (mine[dir].find(x => x[1] === 'train') || [])[0] : null;
        const theirTrain = (leg.find(x => x[1] === 'train') || [])[0];
        momentsOf(leg).forEach(mo => {
          if (want.indexOf(mo.m) < 0 || now.min < mo.t || now.min > mo.t + WINDOW) return;
          jobs.push({ key: ['f', S, V.user_id, now.dk, dir, mo.m].join(':'), to: V.user_id, payload: { title: N[S] || 'A friend', body: bodyFor(mo, dir, leg, loc, myTrain != null && myTrain === theirTrain), tag: 'fr-' + S, url: '/v3/school.html' } });
        });
      });
    });
  });
  if (!jobs.length) return 0;
  const fresh = await D.claim(jobs.map(j => j.key));
  let sent = 0;
  for (const j of jobs) if (fresh.has(j.key)) sent += await sendTo(C, D, subsBy[j.to], j.payload);
  return sent;
}

/* ---------- tomorrow's timetable (evenings) ---------- */
// The same "your lessons" rules as the app (v3/timetable.js).
const ALIAS = { 'מעבדת פיזיקה': 'פיזיקה', 'מעבדת פיסיקה': 'פיזיקה', 'פיסיקה': 'פיזיקה', 'שעת מחנך': 'חינוך', 'מתמטיקה טכניונית': 'מתמטיקה מואץ' };
function norm(s) { let t = String(s || '').replace(/["״׳']/g, '').replace(/(^|\s)תלן(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim(); t = t.replace(/\s+\d+$/, ''); return ALIAS[t] || t; }
function myItems(items, mine) { const l = (items || []).map(e => typeof e === 'string' ? { subject: e } : e); return l.length <= 1 || !mine.length ? l : l.filter(e => mine.indexOf(norm(e.subject)) >= 0); }
const subjKey = l => Array.from(new Set(l.map(x => norm(typeof x === 'string' ? x : x.subject)))).sort().join('|');
function myStatus(st, items, was) {
  if (st !== 'changed' && st !== 'added' && st !== 'cancelled') return st;
  if (!items.length) return was.length ? 'cancelled' : 'same';
  if (!was.length) return 'added';
  return subjKey(items) === subjKey(was) ? 'same' : 'changed';
}
function changesFor(day, mine) {
  const out = [];
  (day.periods || []).forEach(p => {
    const items = myItems(p.items, mine), was = p.was ? myItems(p.was, mine).map(e => e.subject) : [];
    const st = mine.length ? myStatus(p.status, items, was) : p.status;
    const names = l => Array.from(new Set(l.map(x => typeof x === 'string' ? x : x.subject))).join(', ');
    if (st === 'cancelled') out.push('Lesson ' + p.n + ' cancelled' + (was.length ? ' (' + names(was) + ')' : ''));
    else if (st === 'changed') out.push('Lesson ' + p.n + ': ' + names(items) + (was.length ? ' instead of ' + names(was) : ''));
    else if (st === 'added') out.push('Lesson ' + p.n + ': ' + names(items) + ' (new)');
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
  const byClass = {}, jobs = [];
  for (const p of people) {
    const row = rows.find(r => r.key === p.user_id + ':school');
    const tt = row && row.data && row.data['dashboard:school:v1:timetable'];
    if (!tt || !tt.cls || !/^\d{1,2}-\d{1,2}$/.test(tt.cls)) continue;
    if (!byClass[tt.cls]) byClass[tt.cls] = fetch(SITE + '/api/school?cls=' + encodeURIComponent(tt.cls)).then(r => r.json()).catch(() => null);
    const j = await byClass[tt.cls];
    const day = j && j.days && j.days[tomorrow];
    if (!day || !day.published) continue;
    const ch = changesFor(day, Array.isArray(tt.mine) ? tt.mine : []);
    const notes = (day.notes || []).map(n => n.text).filter(Boolean);
    if (!ch.length && !notes.length) continue;
    const lines = notes.slice(0, 1).concat(ch);
    const body = lines.slice(0, 3).join(' · ') + (lines.length > 3 ? ' · +' + (lines.length - 3) + ' more' : '');
    // a new key if the school changes the day again later
    const sig = require('crypto').createHash('sha1').update(lines.join('|')).digest('hex').slice(0, 10);
    jobs.push({ key: ['tt', p.user_id, tomorrow, sig].join(':'), to: p.user_id, payload: { title: 'Tomorrow’s timetable · ' + DOW[wd], body, tag: 'tt-' + tomorrow, url: '/v3/school.html' } });
  }
  if (!jobs.length) return 0;
  const fresh = await D.claim(jobs.map(j => j.key));
  let sent = 0;
  for (const j of jobs) if (fresh.has(j.key)) sent += await sendTo(C, D, subsBy[j.to], j.payload);
  return sent;
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
  if (req.method === 'GET') return res.status(200).json({ ok: true, ready, scheduler: !!C.cron });
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
      const prefs = await D.get('notify_prefs?select=user_id,friends,moments,timetable');
      const ids = prefs.map(p => p.user_id);
      const subs = ids.length ? await D.get('push_subs?select=user_id,endpoint,p256dh,auth&user_id=' + inList(ids)) : [];
      const subsBy = {}; subs.forEach(s => { (subsBy[s.user_id] = subsBy[s.user_id] || []).push(s); });
      const a = await friendMoments(C, D, now, prefs, subsBy);
      const b = await timetableAlerts(C, D, now, prefs, subsBy);
      return res.status(200).json({ ok: true, at: now, sent: a + b });
    }

    // a signed-in user
    const u = await userFrom(C, req);
    if (!u) return res.status(401).json({ ok: false, error: 'Sign in again.' });
    const subsOf = id => D.get('push_subs?select=user_id,endpoint,p256dh,auth&user_id=eq.' + encodeURIComponent(id));
    const nameOf = async id => { const p = (await D.get('profiles?select=username,display_name&id=eq.' + encodeURIComponent(id)))[0]; return (p && (p.display_name || p.username)) || 'Someone'; };

    if (body.test) {
      const subs = await subsOf(u.id);
      if (!subs.length) return res.status(200).json({ ok: false, code: 'no_subs', error: 'This phone isn’t signed up for notifications yet.' });
      const sent = await sendTo(C, D, subs, { title: 'Notifications are on', body: 'Your friends’ trips and timetable changes will show up here.', tag: 'test', url: '/v3/' });
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
      const who = await nameOf(u.id);
      const sent = await sendTo(C, D, subs, body.event === 'request'
        ? { title: 'Friend request', body: who + ' wants to be friends', tag: 'req-' + u.id, url: '/v3/school.html#friends' }
        : { title: who, body: 'Accepted your friend request', tag: 'acc-' + u.id, url: '/v3/school.html#friends' });
      return res.status(200).json({ ok: true, sent });
    }
    return res.status(400).json({ ok: false, error: 'Unknown request' });
  } catch (e) {
    console.warn('[notify]', e && e.message);
    return res.status(502).json({ ok: false, error: 'Something went wrong sending notifications.' });
  }
};

// for tests
module.exports._test = { israelNow, momentsOf, bodyFor, changesFor, dayOf, addDays };
