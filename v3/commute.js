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
const RAIL_URL = '/v3/data/rail.json?v=20261019', BUS_URL = '/v3/data/bus.json?v=20261019';
const RH_STATION = '17094', HZ_STATION = '17034';
const HZ_LL = [32.163558, 34.817406], RH_LL = [32.120865, 34.934527];
let rail = null, bus = null, loadP = null;
function load() {
  if (!loadP) loadP = Promise.all([
    fetch(RAIL_URL).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(BUS_URL).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([r, b]) => { rail = r; bus = b; return { rail, bus }; });
  return loadP;
}
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
// Your choice for today (tapped on the trip card) wins over the setting.
const PICK_LS = D.ukey('dash3:hzPick');
function hzPickFor(dk) { const p = D.readJSON(PICK_LS); return p && p.dk === dk ? p.k : null; }
function setHzPick(dk, k) { D.writeJSON(PICK_LS, k ? { dk, k } : null); }
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
function hzArrive(c, wd, arr, dk) {
  const opts = hzOptions(c, wd, arr), want = hzPickFor(dk) || (c.hz.mode === 'walk' ? 'foot' : c.hz.prefer) || 'auto';
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

/* ---------- morning ---------- */
function morning(c, wd, dk) {
  const T = times(c, wd, dk);
  if (!T || !rail) return null;
  const L = c.legs, start = T.start, by = T.by;
  const homeConns = c.home.stop ? homeRoutes('to', c.home.lines).map(r => ({ r, i: r.stops.indexOf(c.home.stop), j: r.stops.length - 1 })).filter(x => x.i >= 0) : [];
  const homeBus = homeConns.length ? tripsOf(homeConns, wd) : null;
  const opts = [];
  const trains = trainsOf('toHerzliya', wd);
  function finish(o, t) {
    o.train = t.dep; o.trainArr = t.arr; o.trainNo = t.no;
    const h = hzArrive(c, wd, t.arr, dk);
    o.arrive = h.arrive; o.ent = h.ent; o.hzWalk = h.walk; o.hzKind = h.kind; if (h.hz) o.hz = h.hz;
    if (o.leave < 4 * 60 || o.arrive > by + 60) return false;
    o.ok = o.arrive <= by; o.spare = by - o.arrive;
    return true;
  }
  if (homeBus) {
    // Real buses: each bus from your stop → the first train after it reaches the station.
    homeBus.forEach(b => {
      const t = trains.find(x => x.dep >= b.off + L.buffer && x.dep <= b.off + L.buffer + 40);
      if (!t) return;
      const o = { bus: b, leave: b.at - L.walk1 };
      if (finish(o, t)) opts.push(o);
    });
  } else {
    trains.forEach(t => { const o = { leave: t.dep - L.buffer - L.bus1 - L.walk1 }; if (finish(o, t)) opts.push(o); });
  }
  opts.sort((x, y) => x.leave - y.leave);
  // Leave as late as possible while still arriving on time.
  let best = null;
  opts.forEach(o => { if (o.ok) best = o; });
  return { wd, dk, start, by, hasBy: T.hasBy, auto: T.auto, published: T.published, opts, best, legs: L, real: { home: !!homeBus, hz: true } };
}

/* ---------- afternoon ---------- */
function afternoon(c, wd, dk) {
  const T = times(c, wd, dk);
  if (!T || !rail) return null;
  const L = c.legs, end = T.end;
  const homeBack = c.home.stop && stopLL(c.home.stop)
    ? tripsOf(homeRoutes('from', c.home.lines).map(r => { let best = null; r.stops.forEach((s, j) => { const ll = stopLL(s); if (!ll || j === 0) return; const dd = dist(ll, stopLL(c.home.stop)); if (dd <= 400 && (!best || dd < best.d)) best = { j, d: dd }; }); return best ? { r, i: 0, j: best.j } : null; }).filter(Boolean), wd)
    : null;
  const opts = [];
  trainsOf('toRoshHaAyin', wd).forEach(t => {
    if (opts.length >= 4) return;
    const h = hzLeave(c, wd, end, t.dep); if (!h) return;
    const o = { train: t.dep, trainArr: t.arr, trainNo: t.no, leave: h.leave, ent: h.ent, hzWalk: h.walk };
    if (h.hz) o.hz = h.hz;
    if (homeBack) {
      const b = homeBack.find(x => x.at >= t.arr + 3 && x.at <= t.arr + 45);
      if (b) { o.bus = b; o.home = b.off + L.walk1; }
    }
    if (o.home == null) o.home = t.arr + 5 + L.bus1 + L.walk1;
    opts.push(o);
  });
  return { wd, dk, end, auto: T.auto, opts, best: opts[0] || null, legs: L, real: { home: !!homeBack, hz: true } };
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
    // Once the planned trip has started you're most likely on it: keep following it until
    // you arrive (the next option is offered as "Not on it?"), instead of jumping ahead.
    if (m) {
      const best = m.best || m.opts.find(o => o.leave >= now) || null;
      const going = !!best && now >= best.leave && now < best.arrive + 5;
      if (best && going) return { kind: 'morning', m, pick: best, riding: true, next: m.opts.find(o => o.leave > now) || null, mins: best.leave - now };
      if (best && now < m.by) {
        const pick = now <= best.leave ? best : m.opts.find(o => o.leave >= now) || best;
        return { kind: 'morning', m, pick, mins: pick.leave - now };
      }
    }
    if (a && now < a.end - 20) return { kind: 'school', a };
    if (a && a.opts.length) {
      const first = a.best || a.opts[0];
      if (first && now >= first.leave && now < first.home + 5) return { kind: 'after', a, pick: first, riding: true, next: a.opts.find(o => o.leave > now) || null, mins: first.leave - now };
      const pick = a.opts.find(o => o.leave >= now - 2);
      if (pick) return { kind: 'after', a, pick, mins: pick.leave - now };
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
      const atStation = p.bus.off + Math.max(0, out.bus.delay), dep = p.train + (out.train ? out.train.delay : 0);
      out.miss = atStation > dep - 1;
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
  SCHOOL, HZ_STOPS, HZ_NICK, hzOptions, setHzPick, hzPickFor, homeRoutes, connections, connectionsNear, stopName, stopLL, dist, tm, hhmm, fetchLive, live: () => live, liveBus, liveTrain, watchStops, isoMin, schedAt, liveView, arrivals, rideNow, trainsOf, health, STALE_DAYS, setDayTimes, times
};
})();
