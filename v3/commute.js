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
    hz: { mode: 'bus', from: null, to: null, lines: [], transfer: 4, walk: 5 },
    days, offUntil: null
  };
}
function cfg(row) {
  const c = row && row.get(KEY);
  if (!c || !c.setup) return null;
  const d = defaults();
  return Object.assign({}, d, c, { legs: Object.assign({}, d.legs, c.legs), home: Object.assign({}, d.home, c.home), hz: Object.assign({}, d.hz, c.hz) });
}
const isSchoolDay = (c, wd) => !!(c.days && c.days[wd] && c.days[wd].start);

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

/* ---------- morning ---------- */
function morning(c, wd) {
  if (!isSchoolDay(c, wd) || !rail) return null;
  const day = c.days[wd], L = c.legs;
  const start = tm(day.start), by = day.by ? tm(day.by) : start;
  const hzBus = c.hz.mode === 'bus' && c.hz.from && c.hz.to ? tripsOf(connections(c.hz.from, c.hz.to, c.hz.lines), wd) : null;
  const homeConns = c.home.stop ? homeRoutes('to', c.home.lines).map(r => ({ r, i: r.stops.indexOf(c.home.stop), j: r.stops.length - 1 })).filter(x => x.i >= 0) : [];
  const homeBus = homeConns.length ? tripsOf(homeConns, wd) : null;
  const opts = [];
  const trains = trainsOf('toHerzliya', wd);
  // From the train onwards: the first bus you can catch in Herzliya (or the walk).
  function finish(o, t) {
    o.train = t.dep; o.trainArr = t.arr; o.trainNo = t.no;
    if (hzBus) {
      const b = hzBus.find(x => x.at >= t.arr + (c.hz.transfer || 4) && x.at <= t.arr + 45);
      if (!b) return false;
      o.hz = b; o.arrive = b.off + (c.hz.walk || 0);
    } else if (c.hz.mode === 'walk') o.arrive = t.arr + (c.hz.walkOnly || 15);
    else o.arrive = t.arr + L.wait2 + L.bus2 + L.walk2;
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
  return { wd, start, by, hasBy: !!day.by, opts, best, legs: L, real: { home: !!homeBus, hz: !!hzBus } };
}

/* ---------- afternoon ---------- */
function afternoon(c, wd) {
  if (!isSchoolDay(c, wd) || !rail) return null;
  const day = c.days[wd], L = c.legs, end = tm(day.end || '14:00');
  let hzBack = null;
  if (c.hz.mode === 'bus' && c.hz.to) {
    let conns = connectionsNear(stopLL(c.hz.to), 300, HZ_LL, 450, c.hz.lines);
    if (!conns.length) conns = connectionsNear(stopLL(c.hz.to), 300, HZ_LL, 450, null);
    if (conns.length) hzBack = tripsOf(conns, wd);
  }
  const homeBack = c.home.stop && stopLL(c.home.stop)
    ? tripsOf(homeRoutes('from', c.home.lines).map(r => { const fromI = 0; let best = null; r.stops.forEach((s, j) => { const ll = stopLL(s); if (!ll || j === 0) return; const dd = dist(ll, stopLL(c.home.stop)); if (dd <= 400 && (!best || dd < best.d)) best = { j, d: dd }; }); return best ? { r, i: fromI, j: best.j } : null; }).filter(Boolean), wd)
    : null;
  const trains = trainsOf('toRoshHaAyin', wd);
  const opts = [];
  // each Herzliya option (bus or walk) → the first train → the first bus home
  if (hzBack) {
    hzBack.filter(b => b.at >= end + (c.hz.walk || 0) && b.at <= end + 120).slice(0, 6).map(b => ({ hz: b, leave: b.at - (c.hz.walk || 0), atStation: b.off + (c.hz.transfer || 4) })).forEach(s => {
      const t = trains.find(x => x.dep >= s.atStation); if (!t) return;
      const o = Object.assign({ train: t.dep, trainArr: t.arr, trainNo: t.no }, s);
      addHome(o, t);
      if (!opts.some(x => x.train === o.train)) opts.push(o);
    });
  } else {
    const toStationMin = c.hz.mode === 'walk' ? (c.hz.walkOnly || 15) + 3 : L.walk2 + L.wait2 + L.bus2 + 3;
    trains.filter(t => t.dep >= end + toStationMin).slice(0, 4).forEach(t => {
      const o = { train: t.dep, trainArr: t.arr, trainNo: t.no, leave: t.dep - toStationMin };
      addHome(o, t); opts.push(o);
    });
  }
  function addHome(o, t) {
    if (homeBack) {
      const b = homeBack.find(x => x.at >= t.arr + 3 && x.at <= t.arr + 45);
      if (b) { o.bus = b; o.home = b.off + L.walk1; return; }
    }
    o.home = t.arr + 5 + L.bus1 + L.walk1;
  }
  return { wd, end, opts, best: opts[0] || null, legs: L, real: { home: !!homeBack, hz: !!hzBack } };
}

function nextSchoolDay(c, fromOff) {
  for (let off = fromOff; off < fromOff + 14; off++) {
    const d = D.dayAt(off);
    if (c.offUntil && D.dk(d) < c.offUntil) continue;
    if (isSchoolDay(c, d.getDay())) return off;
  }
  return null;
}
// What matters right now. kind: off | morning | school | after | next | none
function phase(c, now) {
  if (!c || !rail) return null;
  now = now == null ? D.nowMin() : now;
  const wd = D.dayAt(0).getDay();
  if (c.offUntil && D.todayKey() < c.offUntil) return { kind: 'off', until: c.offUntil, nextOff: nextSchoolDay(c, 0) };
  if (isSchoolDay(c, wd)) {
    const m = morning(c, wd), a = afternoon(c, wd);
    if (m && now < m.by) {
      let pick = m.best;
      if (!pick || now > pick.leave) pick = m.opts.find(o => o.leave >= now) || pick;
      if (pick) return { kind: 'morning', m, pick, mins: pick.leave - now };
    }
    if (a && now < a.end - 20) return { kind: 'school', a };
    if (a && a.opts.length) {
      const pick = a.opts.find(o => o.leave >= now - 2);
      if (pick) return { kind: 'after', a, pick, mins: pick.leave - now };
    }
  }
  const off = nextSchoolDay(c, 1);
  if (off == null) return { kind: 'none' };
  return { kind: 'next', off, m: morning(c, D.dayAt(off).getDay()) };
}

/* ---------- live ---------- */
let live = { at: 0, stops: {} }, liveP = null;
async function fetchLive(codes) {
  codes = Array.from(new Set(codes.filter(Boolean))).slice(0, 6);
  if (!codes.length) return live;
  if (D.DEMO) { live = { at: Date.now(), stops: demoLive(codes), ok: true }; return live; }
  if (liveP) return liveP;
  liveP = fetch('/api/transit?stops=' + codes.join(',')).then(r => r.json()).then(j => {
    if (j && j.stops) { live = { at: Date.now(), stops: Object.assign({}, live.stops, j.stops), ok: j.ok }; }
    return live;
  }).catch(() => live).finally(() => { liveP = null; });
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
    out.hz = p.hz ? liveBus(c.hz.from, p.hz) : null;
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
// stops to watch right now, for the card and the board
function watchStops(c, ph) {
  if (!c) return [];
  const s = [];
  if (!ph || ph.kind === 'morning' || ph.kind === 'next' || ph.kind === 'none') { s.push(c.home.stop, RH_STATION, HZ_STATION, c.hz.mode === 'bus' ? c.hz.from : null); }
  else { const p = ph.pick || {}; s.push(p.hz ? p.hz.from : null, HZ_STATION, RH_STATION, p.bus ? p.bus.from : null); }
  return s.filter(Boolean);
}

window.COMMUTE = {
  KEY, RH_STATION, HZ_STATION, HZ_LL, RH_LL, load, loadRail: load, rail: () => rail, bus: () => bus, defaults, cfg, morning, afternoon, phase, nextSchoolDay, isSchoolDay,
  homeRoutes, connections, connectionsNear, stopName, stopLL, dist, tm, hhmm, fetchLive, live: () => live, liveBus, liveTrain, watchStops, isoMin, schedAt, liveView, trainsOf
};
})();
