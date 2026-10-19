/* Dashboard v3 — trip planner shared by School and Today.

   Timetables (static, from the Ministry of Transport GTFS feed):
     v3/data/rail.json  Rosh HaAyin North <-> Herzliya trains, per weekday
     v3/data/bus.json   Rosh HaAyin lines 71–74 (both directions) and every bus
                        route through the stops around Herzliya station, per weekday:
                        routes[{id, line, to, stops:[code…], pats:[[min from first stop…]], days:{wd:[[originMin, patIdx]]}}]
   Live (api/transit.js, the Ministry's real-time SIRI feed): expected arrival of each
   bus/train at a stop, whether it is tracked right now, and its scheduled start,
   which lets us match it to the timetable and work out the delay.

   Settings (synced, uid:school → dashboard:school:v1:commute):
     { setup, legs:{walk1, bus1, buffer, wait2, bus2, walk2},
       home:{ lines:["71",…], stop:"<code>" },            your bus in Rosh HaAyin
       hz:{ mode:"bus"|"walk", from, to, lines:[…], transfer, walk },   Herzliya leg
       days:{ "0":{start, end, by}, … }, offUntil } */
(function () {
'use strict';
const D = window.DASH;
const KEY = 'dashboard:school:v1:commute';
const RAIL_URL = '/v3/data/rail.json?v=20261019', BUS_URL = '/v3/data/bus.json?v=20261019', DELAY_URL = '/v3/data/delays.json';
const RH_STATION = '17094', HZ_STATION = '17034';
const HZ_LL = [32.163558, 34.817406], RH_LL = [32.120865, 34.934527];
let rail = null, bus = null, delays = null, loadP = null;
function load() {
  if (!loadP) loadP = Promise.all([
    fetch(RAIL_URL).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(BUS_URL).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(DELAY_URL).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([r, b, d]) => { rail = r; bus = b; delays = d; return { rail, bus }; });
  return loadP;
}

/* ---------- how late your bus usually is ----------
   v3/data/delays.json (tools/delays/build.js, refreshed weekly): for lines 71–74, by
   hour, how late they really passed the stop just before Rosh HaAyin North station over
   the last weeks — median, 75th and 90th percentile. The planner leaves room for the
   75th ("3 days out of 4 it's no later than this"). No data for that line and hour:
   assume 3 minutes. Live data, once the bus is tracked, replaces all of this. */
const LATE_DEFAULT = 3;
function lateness(line, at) {
  const L = delays && delays.lines && delays.lines[String(line || '').replace(/\D+$/, '')], h = Math.floor(at / 60);
  const s = L && [L[h], L[h - 1], L[h + 1]].find(x => x && x[0] >= 4);
  if (!s) return { usual: null, safe: LATE_DEFAULT, known: false };
  return { usual: Math.max(0, Math.round(s[1])), safe: Math.max(0, Math.ceil(s[2])), bad: Math.max(0, Math.ceil(s[3])), n: s[0], known: true };
}

/* ---------- your choices and habits (synced, uid:school) ----------
   tripDays  { "YYYY-MM-DD": { to:{train, bus, busLine, hz, shift, busShift, key, at},
                                home:{train, bus, busLine, shift, key, at}, by, end, at } }
             what you picked for a day (train / bus / Herzliya stop), and a different
             arrival or leaving time for that day. shift = how many trains earlier (−)
             or later (+) than the suggestion, so habits can be spotted.
   tripRules { train:{ "08:30": -1 }, home:{ "13:30": 1 }, bus: -1, asked:{…} }
             habits you made permanent ("always one train earlier when I need to be
             there by 08:30"), and which questions you already answered. */
const DAYS_KEY = 'dashboard:school:v1:tripDays', RULES_KEY = 'dashboard:school:v1:tripRules';
let srow = null;
const useRow = r => { srow = r; };
const dayRec = dk => { const a = srow && srow.get(DAYS_KEY); return (a && typeof a === 'object' && a[dk]) || {}; };
const rulesOf = () => { const r = srow && srow.get(RULES_KEY); return r && typeof r === 'object' ? r : {}; };
const clampI = (i, n) => Math.max(0, Math.min(n - 1, i));
const tm = s => { const p = String(s || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
const hhmm = D.hhmm;
const dist = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180; const dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const stopLL = code => { const s = bus && bus.stops[code]; return s ? [s[1], s[2]] : null; };
const stopName = code => (bus && bus.stops[code] ? bus.stops[code][0] : code);

/* ---------- settings ---------- */
function defaults() {
  const old = D.readJSON('dashboard:transport:v1') || {};
  const days = {};
  [0, 1, 2, 3, 4].forEach(d => { days[d] = { start: old.schoolTime || '08:00', end: '14:00', by: null }; });
  return {
    setup: false,
    legs: { walk1: +old.walkToBus || 3, bus1: +old.busJourney || 30, buffer: +old.stationBuffer || 5, wait2: 5, bus2: 3, walk2: +old.walkToSchool || 8 },
    home: { lines: ['71', '72', '73', '74'], stop: null },
    hz: { mode: 'auto' },
    days, offUntil: null
  };
}
function cfg(row) {
  const c = row && row.get(KEY);
  if (!c || !c.setup) return null;
  const d = defaults();
  const out = Object.assign({}, d, c, { legs: Object.assign({}, d.legs, c.legs), home: Object.assign({}, d.home, c.home), hz: Object.assign({}, d.hz, c.hz) });
  if (out.hz.mode !== 'walk') out.hz.mode = 'auto'; // older settings (picked stops) now use the automatic choice
  if (['auto', 'chadash', 'halicha', 'foot'].indexOf(out.hz.prefer) < 0) out.hz.prefer = out.hz.mode === 'walk' ? 'foot' : 'auto';
  return out;
}
// A school day's times: from the school timetable when it's connected (first lesson →
// arrival, last lesson → leaving, the 07:45 "arrive by" rule), else your own settings.
let dayTimesFn = null;
function setDayTimes(fn) { dayTimesFn = fn; }
function times(c, wd, dk) {
  const t = dayTimesFn && dk ? dayTimesFn(dk) : null;
  if (t && t.none) return null;
  if (t && t.start != null) return { start: t.start, end: t.end, by: t.by != null ? t.by : t.start, hasBy: t.by != null, auto: true, published: !!t.published };
  const day = c.days && c.days[wd];
  if (!day || !day.start) return null;
  return { start: tm(day.start), end: tm(day.end || '14:00'), by: day.by ? tm(day.by) : tm(day.start), hasBy: !!day.by, auto: false };
}
const isSchoolDay = (c, wd, dk) => !!times(c, wd, dk);

/* ---------- bus timetable helpers ---------- */
const HOME_RE = /^7[1-4]/;
const toStation = r => /תחנת רכבת ראש העין צפון/.test(r.to);
function homeRoutes(dir, lines) {
  if (!bus) return [];
  return bus.routes.filter(r => r.agency === '25' && HOME_RE.test(r.line) && (dir === 'to' ? toStation(r) : !toStation(r)) &&
    (!lines || !lines.length || lines.indexOf(r.line.replace(/\D+$/, '')) >= 0));
}
// every scheduled trip of a route on weekday wd, with its times at stop indexes i and j
function trips(r, wd, i, j) {
  const list = (r.days && r.days[wd]) || [];
  return list.map(([o, p]) => ({ line: r.line, route: r.id, origin: o, at: o + r.pats[p][i], off: o + r.pats[p][j] }));
}
// lines that serve stop A then stop B (in that order) — optionally only some lines
function connections(fromCode, toCode, lines) {
  if (!bus || !fromCode || !toCode) return [];
  const out = [];
  bus.routes.forEach(r => {
    if (lines && lines.length && lines.indexOf(r.line) < 0) return;
    const i = r.stops.indexOf(fromCode), j = r.stops.lastIndexOf(toCode);
    if (i >= 0 && j > i) out.push({ r, i, j });
  });
  return out;
}
// nearest-stop connections between two places (used for the trips back)
function connectionsNear(fromLL, fromR, toLL, toR, lines) {
  if (!bus || !fromLL || !toLL) return [];
  const out = [];
  bus.routes.forEach(r => {
    if (lines && lines.length && lines.indexOf(r.line) < 0) return;
    let best = null;
    r.stops.forEach((a, i) => {
      const la = stopLL(a); if (!la) return; const da = dist(la, fromLL); if (da > fromR) return;
      for (let j = i + 1; j < r.stops.length; j++) {
        const lb = stopLL(r.stops[j]); if (!lb) continue; const db = dist(lb, toLL); if (db > toR) continue;
        const score = da + db; if (!best || score < best.score) best = { r, i, j, score, walkA: da, walkB: db };
      }
    });
    if (best) out.push(best);
  });
  return out;
}
const tripsOf = (conns, wd) => conns.reduce((a, c) => a.concat(trips(c.r, wd, c.i, c.j).map(t => Object.assign(t, { from: c.r.stops[c.i], to: c.r.stops[c.j] }))), []).sort((a, b) => a.at - b.at);
const trainsOf = (dir, wd) => (rail && rail[dir] ? (rail[dir][wd] || []).map(x => ({ dep: tm(x[0]), arr: tm(x[1]), no: x[2] || '' })) : []);

/* ---------- Herzliya: station <-> school, picked automatically ----------
   Everyone goes to the same school, so this part needs no settings. The campus has
   two entrances: the New High School (תיכון חדש) on Sderot Shivat HaKochavim, by the
   33/34 stop, and the main Handasaim entrance, the gate just past Kanyon Shivat
   HaKochavim. Each time the app compares walking with every bus that runs from the
   stops by the station to a stop by either entrance, and takes the fastest. */
const SCHOOL = {
  main: { key: 'main', name: 'Main entrance', he: 'הנדסאים', ll: [32.16397, 34.82495] },
  nw: { key: 'nw', name: 'New High School entrance', he: 'תיכון חדש', ll: [32.16410, 34.82615] }
};
const WALK_M_PER_MIN = 75, DETOUR = 1.3, PLATFORM = 2; // street-route factor; minutes train door ↔ station street
const walkMin = (a, b) => Math.max(1, Math.round(dist(a, b) * DETOUR / WALK_M_PER_MIN));
/* The two stops students actually get off at, by the names they use for them:
     החדש  — ז'בוטינסקי/הרב קוק (20633): right by the New High School entrance (bus 34, 19, …)
     הליכה — בן ציון מיכאלי/יוסף נבו (27103): one or two stops from the station, then a
             short walk to the main entrance (almost every line stops there)
   Mornings offer exactly these two (plus walking the whole way). */
const HZ_STOPS = [
  { key: 'chadash', nick: 'החדש', code: '20633', ent: 'nw' },
  { key: 'halicha', nick: 'הליכה', code: '27103', ent: 'main' }
];
const HZ_NICK = {}; HZ_STOPS.forEach(P => { HZ_NICK[P.code] = P.nick; });
const hzCache = {};
// Every bus from a stop by the station to one of the two stops, on weekday wd.
function hzBuses(wd) {
  if (hzCache[wd]) return hzCache[wd];
  const out = [];
  if (bus) HZ_STOPS.forEach(P => {
    const E = SCHOOL[P.ent], toLL = stopLL(P.code); if (!toLL) return;
    bus.routes.forEach(r => {
      const j = r.stops.indexOf(P.code); if (j <= 0) return;
      let best = null; // the boarding stop nearest the station, before the stop you get off at
      for (let i = 0; i < j; i++) { const ll = stopLL(r.stops[i]); if (!ll) continue; const d = dist(ll, HZ_LL); if (d <= 320 && (!best || d < best.d)) best = { i, d }; }
      if (!best) return;
      const from = r.stops[best.i];
      trips(r, wd, best.i, j).forEach(t => out.push(Object.assign(t, { from, to: P.code, ent: P.ent, kind: P.key, nick: P.nick, walkA: walkMin(HZ_LL, stopLL(from)) + PLATFORM, walkB: walkMin(toLL, E.ll) })));
    });
  });
  return (hzCache[wd] = out.sort((a, b) => a.at - b.at));
}
const hzWalk = E => PLATFORM + walkMin(HZ_LL, E.ll);
// Your choice for that day (tapped on the trip card, synced) wins over the setting.
function hzPickFor(dk) { const t = dayRec(dk).to; return (t && t.hz) || null; }
// morning: the ways from a train arriving at Herzliya to school — החדש, הליכה, walking
function hzOptions(c, wd, arr) {
  const out = [];
  HZ_STOPS.forEach(P => {
    const b = hzBuses(wd).find(x => x.kind === P.key && x.at >= arr + x.walkA && x.at <= arr + 30);
    if (b) out.push({ kind: P.key, nick: P.nick, arrive: b.off + b.walkB, ent: P.ent, hz: b, walk: b.walkB });
  });
  out.push({ kind: 'foot', nick: '', arrive: arr + hzWalk(SCHOOL.main), ent: 'main', walk: hzWalk(SCHOOL.main) });
  return out;
}
function hzArrive(c, wd, arr, dk, pick) {
  const opts = hzOptions(c, wd, arr), want = pick || hzPickFor(dk) || (c.hz.mode === 'walk' ? 'foot' : c.hz.prefer) || 'auto';
  const chosen = opts.find(o => o.kind === want);
  if (chosen) return chosen;
  return opts.reduce((a, b) => (b.arrive < a.arrive ? b : a)); // fastest
}
// afternoon: the latest you can leave school and still catch a train leaving at dep
function hzLeave(c, wd, end, dep) {
  const E = SCHOOL.main, w = hzWalk(E);
  let best = dep - w >= end ? { leave: dep - w, ent: 'main', walk: w } : null;
  if (c.hz.mode === 'walk') return best;
  [SCHOOL.main, SCHOOL.nw].forEach(E2 => {
    connectionsNear(E2.ll, 260, HZ_LL, 320, null).forEach(cn => trips(cn.r, wd, cn.i, cn.j).forEach(t => {
      const from = cn.r.stops[cn.i], to = cn.r.stops[cn.j], wa = walkMin(E2.ll, stopLL(from)), wb = walkMin(stopLL(to), HZ_LL) + PLATFORM;
      if (t.off + wb > dep || t.at - wa < end) return;
      const leave = t.at - wa;
      if (!best || leave > best.leave) best = { leave, ent: E2.key, hz: Object.assign(t, { from, to }), walk: wa };
    }));
  });
  return best;
}

/* ---------- morning: the way you'd plan it yourself ----------
   1. When do you need to be at school? (first lesson, your "arrive by", or a time you
      set for that day)
   2. The train: the latest one that gets you there in time (moved by your habit, if you
      have one for that time). You can pick another.
   3. The bus to that train: the latest one that still leaves you your minutes on the
      platform — after the walk from the bus, and after the delay that line usually has
      at that hour. You can pick another.
   4. Herzliya → school: החדש, הליכה or walking (fastest unless you pick).
   over: { by } plans a "what if" without saving anything. */
function morning(c, wd, dk, over) {
  const T = times(c, wd, dk);
  if (!T || !rail) return null;
  const L = c.legs, rec = dayRec(dk), ch = (!over && rec.to) || {}, R = over ? {} : rulesOf();
  const by = over && over.by != null ? over.by : rec.by != null ? rec.by : T.by, key = hhmm(by);
  const trains = trainsOf('toHerzliya', wd).map(t => {
    const h = hzArrive(c, wd, t.arr, dk, ch.hz);
    return { dep: t.dep, arr: t.arr, no: t.no, h, arrive: h.arrive, ok: h.arrive <= by, spare: by - h.arrive };
  }).filter(t => t.arrive <= by + 90);
  if (!trains.length) return null;
  let traw = -1; trains.forEach((t, i) => { if (t.ok) traw = i; });
  if (traw < 0) traw = 0; // nothing in time: the first train there is
  const tsug = clampI(traw + (+((R.train || {})[key]) || 0), trains.length);
  let ti = tsug;
  if (ch.train != null) { const i = trains.findIndex(t => t.dep === ch.train); if (i >= 0) ti = i; }
  const t = trains[ti];
  // the buses from your stop that reach the station before that train
  const conns = c.home.stop ? homeRoutes('to', c.home.lines).map(r => ({ r, i: r.stops.indexOf(c.home.stop), j: r.stops.length - 1 })).filter(x => x.i >= 0) : [];
  let buses = null, bi = -1, bsug = -1, braw = -1;
  if (conns.length) {
    buses = tripsOf(conns, wd).filter(b => b.off + PLATFORM <= t.dep && b.off >= t.dep - 80).map(b => {
      const late = lateness(b.line, b.off), spare = t.dep - (b.off + late.safe + PLATFORM);
      return Object.assign({}, b, { late, spare, sched: t.dep - b.off - PLATFORM, safe: spare >= L.buffer, risky: spare < 0 });
    });
    if (buses.length) {
      buses.forEach((b, i) => { if (b.safe) braw = i; });
      if (braw < 0) buses.forEach((b, i) => { if (!b.risky) braw = i; });
      if (braw < 0) braw = buses.length - 1;
      bsug = clampI(braw + (+R.bus || 0), buses.length);
      bi = bsug;
      if (ch.bus != null) { const i = buses.findIndex(b => b.at === ch.bus && (!ch.busLine || b.line === ch.busLine)); if (i >= 0) bi = i; }
    } else buses = null;
  }
  const b = buses ? buses[bi] : null;
  const pick = { leave: b ? b.at - L.walk1 : t.dep - L.buffer - LATE_DEFAULT - PLATFORM - L.bus1 - L.walk1, bus: b, train: t.dep, trainArr: t.arr, trainNo: t.no,
    arrive: t.arrive, ent: t.h.ent, hzWalk: t.h.walk, hzKind: t.h.kind, ok: t.ok, spare: t.spare, busSpare: b ? b.spare : null };
  if (t.h.hz) pick.hz = t.h.hz;
  return { dir: 'to', wd, dk, start: T.start, by, key, byChanged: over ? over.by != null && over.by !== T.by : rec.by != null, hasBy: T.hasBy, auto: T.auto, published: T.published,
    trains, ti, tsug, traw, buses, bi, bsug, braw, pick, best: pick, opts: [pick], legs: L, chose: { train: ti !== tsug, bus: bi !== bsug, hz: !!ch.hz } };
}

/* ---------- afternoon: home ----------
   The first train you can make after your last lesson (moved by your habit), how to get
   to Herzliya station for it, then the first bus from Rosh HaAyin North that you can
   walk to after the train arrives. Each can be changed. over: { end } = "what if". */
function afternoon(c, wd, dk, over) {
  const T = times(c, wd, dk);
  if (!T || !rail) return null;
  const L = c.legs, rec = dayRec(dk), ch = (!over && rec.home) || {}, R = over ? {} : rulesOf();
  const end = over && over.end != null ? over.end : rec.end != null ? rec.end : T.end, key = hhmm(end);
  const trains = trainsOf('toRoshHaAyin', wd).map(t => { const h = hzLeave(c, wd, end, t.dep); return h ? { dep: t.dep, arr: t.arr, no: t.no, h, leave: h.leave } : null; }).filter(Boolean).slice(0, 8);
  if (!trains.length) return null;
  const tsug = clampI(+((R.home || {})[key]) || 0, trains.length);
  let ti = tsug;
  if (ch.train != null) { const i = trains.findIndex(t => t.dep === ch.train); if (i >= 0) ti = i; }
  const t = trains[ti];
  const homeBack = c.home.stop && stopLL(c.home.stop)
    ? tripsOf(homeRoutes('from', c.home.lines).map(r => { let best = null; r.stops.forEach((s, j) => { const ll = stopLL(s); if (!ll || j === 0) return; const dd = dist(ll, stopLL(c.home.stop)); if (dd <= 400 && (!best || dd < best.d)) best = { j, d: dd }; }); return best ? { r, i: 0, j: best.j } : null; }).filter(Boolean), wd)
    : null;
  let buses = homeBack ? homeBack.filter(b => b.at >= t.arr + 4 && b.at <= t.arr + 60).slice(0, 6) : null;
  if (buses && !buses.length) buses = null;
  let bi = buses ? 0 : -1;
  if (buses && ch.bus != null) { const i = buses.findIndex(b => b.at === ch.bus && (!ch.busLine || b.line === ch.busLine)); if (i >= 0) bi = i; }
  const b = buses ? buses[bi] : null;
  const pick = { leave: t.h.leave, ent: t.h.ent, hzWalk: t.h.walk, train: t.dep, trainArr: t.arr, trainNo: t.no, bus: b, home: b ? b.off + L.walk1 : t.arr + 5 + L.bus1 + L.walk1 };
  if (t.h.hz) pick.hz = t.h.hz;
  return { dir: 'home', wd, dk, end, key, endChanged: over ? over.end != null && over.end !== T.end : rec.end != null, auto: T.auto,
    trains, ti, tsug, traw: 0, buses, bi, bsug: buses ? 0 : -1, braw: 0, pick, best: pick, opts: [pick], legs: L, chose: { train: ti !== tsug, bus: buses ? bi !== 0 : false } };
}

function nextSchoolDay(c, fromOff) {
  for (let off = fromOff; off < fromOff + 14; off++) {
    const d = D.dayAt(off);
    if (c.offUntil && D.dk(d) < c.offUntil) continue;
    if (isSchoolDay(c, d.getDay(), D.dk(d))) return off;
  }
  return null;
}
// What matters right now. kind: off | morning | school | after | next | none
function phase(c, now) {
  if (!c || !rail) return null;
  now = now == null ? D.nowMin() : now;
  const wd = D.dayAt(0).getDay(), dk = D.todayKey();
  if (c.offUntil && dk < c.offUntil) return { kind: 'off', until: c.offUntil, nextOff: nextSchoolDay(c, 0) };
  if (isSchoolDay(c, wd, dk)) {
    const m = morning(c, wd, dk), a = afternoon(c, wd, dk);
    // Once the trip you're following has started you're most likely on it: keep following
    // it until you arrive. Not on it? The card's "Not on it?" opens the other buses.
    if (m && m.pick) {
      const p = m.pick;
      if (now >= p.leave && now < p.arrive + 5) return { kind: 'morning', m, pick: p, riding: true, mins: p.leave - now };
      if (now < p.leave) return { kind: 'morning', m, pick: p, mins: p.leave - now };
    }
    if (a && now < a.end - 20) return { kind: 'school', a };
    if (a && a.pick) {
      const p = a.pick;
      if (now >= p.leave && now < p.home + 5) return { kind: 'after', a, pick: p, riding: true, mins: p.leave - now };
      if (now < p.leave) return { kind: 'after', a, pick: p, mins: p.leave - now };
    }
  }
  const off = nextSchoolDay(c, 1);
  if (off == null) return { kind: 'none' };
  return { kind: 'next', off, m: morning(c, D.dayAt(off).getDay(), D.dk(D.dayAt(off))) };
}

/* ---------- live ---------- */
let live = { at: 0, stops: {} }, liveP = null;
async function fetchLive(codes) {
  codes = Array.from(new Set(codes.filter(Boolean))).slice(0, 6);
  if (!codes.length) return live;
  if (D.DEMO) { live = { at: Date.now(), stops: demoLive(codes), ok: true }; return live; }
  if (liveP) return liveP;
  liveP = fetch('/api/transit?stops=' + codes.join(',')).then(r => r.json()).then(j => {
    if (j && j.stops && j.ok !== false) { live = { at: Date.now(), stops: Object.assign({}, live.stops, j.stops), ok: true, err: false }; }
    else { live.err = true; live.errAt = Date.now(); }
    return live;
  }).catch(() => { live.err = true; live.errAt = Date.now(); return live; }).finally(() => { liveP = null; });
  return liveP;
}
const isoMin = iso => { const d = new Date(iso); return isNaN(d) ? null : d.getHours() * 60 + d.getMinutes() + (D.dk(d) > D.todayKey() ? 1440 : 0); };
// ?demo: realistic live data from the timetable (first few tracked, a bit late)
function demoLive(codes) {
  const out = {}, wd = D.dayAt(0).getDay(), now = D.nowMin(), d0 = D.dayAt(0);
  const iso = m => { const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate(), 0, Math.round(m)); return D.dk(d) + 'T' + D.pad(d.getHours()) + ':' + D.pad(d.getMinutes()) + ':00'; };
  codes.forEach(code => {
    const vs = [];
    if (code === RH_STATION || code === HZ_STATION) {
      trainsOf(code === RH_STATION ? 'toHerzliya' : 'toRoshHaAyin', wd).filter(t => t.dep >= now - 2).slice(0, 4).forEach((t, k) => vs.push({ line: t.no, op: '2', eta: iso(t.dep + (k === 0 ? 3 : 0)), dep: null, live: k < 2, dest: '', destEn: code === RH_STATION ? 'Hertsliya' : 'Rosh HaAyin North' }));
    } else if (bus) {
      bus.routes.forEach(r => { const i = r.stops.indexOf(code); if (i < 0) return; ((r.days && r.days[wd]) || []).forEach(([o, p]) => { const at = o + r.pats[p][i]; if (at >= now - 1 && at <= now + 60) vs.push({ line: r.line, op: r.agency, eta: iso(at + (at < now + 15 ? 2 : 0)), dep: iso(o), live: at < now + 15, dest: r.to, destEn: '', _at: at }); }); });
      vs.sort((a, b) => a._at - b._at);
    }
    out[code] = vs.slice(0, 10);
  });
  return out;
}
// A planned bus trip ↔ the live vehicle doing it: same line, same scheduled start.
function liveBus(stopCode, trip) {
  if (!trip) return null;
  const vs = live.stops[stopCode] || [];
  const v = vs.find(x => x.line === trip.line && x.dep && isoMin(x.dep) === trip.origin);
  if (!v) return null;
  const eta = isoMin(v.eta);
  return { eta, live: v.live, delay: eta - trip.at, v };
}
// A planned train ↔ the live train: the timetable and the live feed share the train number.
function liveTrain(station, sched, trainNo) {
  if (!trainNo) return null;
  const v = (live.stops[station] || []).find(x => x.op === '2' && x.line === String(trainNo));
  if (!v) return null;
  const eta = isoMin(v.eta);
  return { eta, live: v.live, delay: eta - sched, v };
}
// Scheduled time of a bus at a stop, from its line and scheduled start (for the board).
function schedAt(code, line, origin, wd) {
  if (!bus || origin == null) return null;
  for (const r of bus.routes) {
    if (r.line !== line) continue;
    const i = r.stops.indexOf(code); if (i < 0) continue;
    const t = ((r.days && r.days[wd]) || []).find(x => x[0] === origin);
    if (t) return origin + r.pats[t[1]][i];
  }
  return null;
}
// The plan for right now, corrected by live data: follow the live bus, and warn
// when a late bus would miss the train.
function liveView(c, ph, now) {
  const p = ph && ph.pick; if (!p) return null;
  now = now == null ? D.nowMin() : now;
  const L = c.legs, out = { leave: p.leave };
  if (ph.kind === 'morning') {
    out.bus = p.bus ? liveBus(c.home.stop, p.bus) : null;
    out.train = liveTrain(RH_STATION, p.train, p.trainNo);
    out.hz = p.hz ? liveBus(p.hz.from, p.hz) : null;
    if (out.bus && out.bus.live) out.leave = out.bus.eta - L.walk1;
    if (out.bus && out.bus.live && p.bus) {
      // from the bus to the platform takes a couple of minutes: count them
      const atStation = p.bus.off + Math.max(0, out.bus.delay) + PLATFORM, dep = p.train + (out.train ? out.train.delay : 0);
      out.miss = atStation > dep;
    }
  } else if (ph.kind === 'after') {
    out.hz = p.hz ? liveBus(p.hz.from, p.hz) : null;
    out.train = liveTrain(HZ_STATION, p.train, p.trainNo);
    out.bus = p.bus ? liveBus(p.bus.from, p.bus) : null;
    if (out.hz && out.hz.live) out.leave = out.hz.eta - (c.hz.walk || 0);
  }
  out.mins = out.leave - now;
  out.anyLive = !!((out.bus && out.bus.live) || (out.train && out.train.live) || (out.hz && out.hz.live));
  return out;
}
// When you get to each place (live where the feed knows), and how long you have at each
// change. Positive spare = early, negative = late.
//   to school: busDep → busArr (at the station) · waitStation · trainDep → trainArr
//              · waitHz · hzDep → hzArr · arrive, spare
//   going home: hzDep → atStation · waitHz · trainDep → trainArr · waitRh · busDep → home
function arrivals(c, ph, p, lv) {
  if (!p) return null;
  const L = c.legs, out = {}, d = x => (x && x.live ? x.delay : 0);
  if (ph.kind === 'morning' || ph.kind === 'next') {
    if (p.bus) {
      out.busDep = lv && lv.bus ? lv.bus.eta : p.bus.at;
      const atSt = p.bus.to ? liveBus(p.bus.to, Object.assign({}, p.bus, { at: p.bus.off })) : null; // the same bus, at the station
      out.busArr = atSt && atSt.live ? atSt.eta : p.bus.off + Math.max(0, d(lv && lv.bus));
      out.busArrLive = !!(atSt && atSt.live);
    }
    out.trainDep = lv && lv.train ? lv.train.eta : p.train;
    const tA = liveTrain(HZ_STATION, p.trainArr, p.trainNo);
    out.trainArr = tA && tA.live ? tA.eta : p.trainArr + Math.max(0, d(lv && lv.train));
    out.trainArrLive = !!(tA && tA.live);
    if (p.bus) { out.waitStation = out.trainDep - out.busArr; out.walkStation = PLATFORM; }
    if (p.hz) {
      out.hzDep = lv && lv.hz ? lv.hz.eta : p.hz.at;
      out.hzArr = p.hz.off + Math.max(0, d(lv && lv.hz));
      out.waitHz = out.hzDep - out.trainArr; out.walkHz = p.hz.walkA || PLATFORM;
      out.arrive = out.hzArr + (p.hzWalk || 0);
      // a late train misses this bus: the next way from Herzliya (another bus, or walking)
      if (out.waitHz - out.walkHz < 0 && ph.m) {
        const alt = hzOptions(c, ph.m.wd, out.trainArr).reduce((a, b) => (b.arrive < a.arrive ? b : a));
        out.missHz = true; out.alt = alt; out.arrive = alt.arrive;
      }
    } else out.arrive = out.trainArr + (p.hzWalk || 0);
    out.by = ph.m ? ph.m.by : p.arrive + (p.spare || 0);
    out.spare = out.by - out.arrive;
  } else {
    if (p.hz) {
      out.hzDep = lv && lv.hz ? lv.hz.eta : p.hz.at;
      out.atStation = p.hz.off + Math.max(0, d(lv && lv.hz)) + PLATFORM;
    } else out.atStation = p.leave + (p.hzWalk || 0);
    out.trainDep = lv && lv.train ? lv.train.eta : p.train;
    out.waitHz = out.trainDep - out.atStation; out.walkHz = 0;
    const tA = liveTrain(RH_STATION, p.trainArr, p.trainNo);
    out.trainArr = tA && tA.live ? tA.eta : p.trainArr + Math.max(0, d(lv && lv.train));
    out.trainArrLive = !!(tA && tA.live);
    if (p.bus) {
      out.busDep = lv && lv.bus ? lv.bus.eta : p.bus.at;
      out.waitRh = out.busDep - out.trainArr; out.walkRh = 3;
      out.home = p.bus.off + Math.max(0, d(lv && lv.bus)) + L.walk1;
    } else out.home = p.home;
  }
  return out;
}
// What's next on a trip that's under way: { big, small } for the card and the Today screen.
function rideNow(ph, p, ar, now) {
  if (!p || !ar) return null;
  const n = now == null ? D.nowMin() : now, mins = t => Math.max(0, Math.round(t - n));
  const early = s => s >= 0 ? (s === 0 ? 'right on time' : s + ' min early') : (-s) + ' min late';
  if (ph.kind === 'morning') {
    if (p.bus && n < ar.busDep) return { big: 'Bus ' + p.bus.line + ' at ' + hhmm(ar.busDep), small: 'in ' + mins(ar.busDep) + ' min · at the station ' + hhmm(ar.busArr) };
    if (p.bus && n < ar.busArr) return { big: 'At the station ' + hhmm(ar.busArr), small: (ar.waitStation >= 0 ? ar.waitStation + ' min before the ' + hhmm(ar.trainDep) + ' train' : 'the ' + hhmm(ar.trainDep) + ' train may leave first') };
    if (n < ar.trainDep) return { big: 'Train ' + hhmm(ar.trainDep), small: 'leaves in ' + mins(ar.trainDep) + ' min · Herzliya ' + hhmm(ar.trainArr) };
    if (n < ar.trainArr && ar.missHz) return { big: 'Herzliya ' + hhmm(ar.trainArr), small: 'the train is late, so ' + (ar.alt.hz ? 'take bus ' + ar.alt.hz.line + ' at ' + hhmm(ar.alt.hz.at) : 'walk') + ' · at school ' + hhmm(ar.arrive) };
    if (n < ar.trainArr) return { big: 'Herzliya ' + hhmm(ar.trainArr), small: p.hz ? 'then bus ' + p.hz.line + (p.hz.nick ? ' (' + p.hz.nick + ')' : '') + ' at ' + hhmm(ar.hzDep) + ' · ' + Math.max(0, ar.waitHz) + ' min to get there (' + ar.walkHz + '-min walk)' : 'then a ' + (p.hzWalk || 12) + '-min walk · at school ' + hhmm(ar.arrive) };
    if (p.hz && n < ar.hzDep) return { big: 'Bus ' + p.hz.line + ' at ' + hhmm(ar.hzDep), small: 'in ' + mins(ar.hzDep) + ' min · at school ' + hhmm(ar.arrive) };
    return { big: 'At school ' + hhmm(ar.arrive), small: early(ar.spare) };
  }
  if (p.hz && n < ar.hzDep) return { big: 'Bus ' + p.hz.line + ' at ' + hhmm(ar.hzDep), small: 'in ' + mins(ar.hzDep) + ' min · at the station ' + hhmm(ar.atStation) };
  if (n < ar.atStation) return { big: 'At the station ' + hhmm(ar.atStation), small: (ar.waitHz >= 0 ? ar.waitHz + ' min before the ' + hhmm(ar.trainDep) + ' train' : 'the ' + hhmm(ar.trainDep) + ' train may leave first') };
  if (n < ar.trainDep) return { big: 'Train ' + hhmm(ar.trainDep), small: 'leaves in ' + mins(ar.trainDep) + ' min · Rosh HaAyin ' + hhmm(ar.trainArr) };
  if (n < ar.trainArr) return { big: 'Rosh HaAyin ' + hhmm(ar.trainArr), small: p.bus ? 'then bus ' + p.bus.line + ' at ' + hhmm(ar.busDep) + ' · ' + Math.max(0, ar.waitRh) + ' min to get there' : 'home about ' + hhmm(ar.home) };
  if (p.bus && n < ar.busDep) return { big: 'Bus ' + p.bus.line + ' at ' + hhmm(ar.busDep), small: 'in ' + mins(ar.busDep) + ' min · home ' + hhmm(ar.home) };
  return { big: 'Home ' + hhmm(ar.home), small: 'about ' + mins(ar.home) + ' min' };
}

// Is anything wrong with the data? The timetable refreshes twice a week, so more
// than 7 days old means the automatic update has failed at least twice.
const STALE_DAYS = 7;
function health() {
  const out = { age: null, stale: false, expired: false, liveDown: false };
  if (rail && rail.built) {
    const b = String(rail.built), d = new Date(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8), 12);
    out.age = Math.max(0, Math.floor((D.dayAt(0) - d) / 864e5)); out.stale = out.age > STALE_DAYS;
  }
  if (rail && rail.validTo) out.expired = D.todayKey().replace(/-/g, '') > String(rail.validTo);
  out.liveDown = !!(live.err && Date.now() - (live.errAt || 0) < 5 * 60 * 1000);
  return out;
}
// stops to watch right now, for the card and the board
function watchStops(c, ph) {
  if (!c) return [];
  const s = [];
  if (!ph || ph.kind === 'morning' || ph.kind === 'next' || ph.kind === 'none') { const p = ph && (ph.pick || (ph.m && ph.m.best)); s.push(c.home.stop, RH_STATION, HZ_STATION, p && p.hz ? p.hz.from : null, p && p.bus ? p.bus.to : null); }
  else { const p = ph.pick || {}; s.push(p.hz ? p.hz.from : null, HZ_STATION, RH_STATION, p.bus ? p.bus.from : null); }
  return s.filter(Boolean);
}

window.COMMUTE = {
  KEY, RH_STATION, HZ_STATION, HZ_LL, RH_LL, load, loadRail: load, rail: () => rail, bus: () => bus, defaults, cfg, morning, afternoon, phase, nextSchoolDay, isSchoolDay,
  SCHOOL, HZ_STOPS, HZ_NICK, hzOptions, hzPickFor, homeRoutes, lateness, LATE_DEFAULT, PLATFORM, useRow, DAYS_KEY, RULES_KEY, delays: () => delays, connections, connectionsNear, stopName, stopLL, dist, tm, hhmm, fetchLive, live: () => live, liveBus, liveTrain, watchStops, isoMin, schedAt, liveView, arrivals, rideNow, trainsOf, health, STALE_DAYS, setDayTimes, times
};
})();
