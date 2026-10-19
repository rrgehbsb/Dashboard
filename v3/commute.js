/* Dashboard v3 — trip planner shared by School and Today.
   Settings live in the synced school row under dashboard:school:v1:commute:
   { setup:true, legs:{walk1,bus1,buffer,wait2,bus2,walk2},            minutes
     days:{ "0":{start:"07:45", end:"14:00", by:"08:00"|null}, … },    weekday 0=Sun
     offUntil:"YYYY-MM-DD"|null }
   Trains come from v3/data/rail.json: real Rosh HaAyin North <-> Herzliya times per
   weekday, extracted from the Ministry of Transport GTFS feed. Bus legs are the
   user's own estimates until live bus times are added. */
(function () {
'use strict';
const D = window.DASH;
const KEY = 'dashboard:school:v1:commute';
const RAIL_URL = '/v3/data/rail.json?v=20261018';
let rail = null, railP = null;
function loadRail() {
  if (!railP) railP = fetch(RAIL_URL).then(r => r.ok ? r.json() : null).then(j => { rail = j; return j; }).catch(() => null);
  return railP;
}
const tm = s => { const p = String(s || '').split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
const hhmm = D.hhmm;

// Starting values for a new set-up: the shared part of the route (train and the
// Herzliya legs) is the same for everyone at this school; walk/bus at home vary.
function defaults() {
  const old = D.readJSON('dashboard:transport:v1') || {};
  const days = {};
  [0, 1, 2, 3, 4].forEach(d => { days[d] = { start: old.schoolTime || '08:00', end: '14:00', by: null }; });
  return {
    setup: false,
    legs: { walk1: +old.walkToBus || 3, bus1: +old.busJourney || 30, buffer: +old.stationBuffer || 5, wait2: 5, bus2: 3, walk2: +old.walkToSchool || 8 },
    days, offUntil: null
  };
}
function cfg(row) { const c = row && row.get(KEY); return (c && c.setup) ? c : null; }
const isSchoolDay = (c, wd) => !!(c.days && c.days[wd] && c.days[wd].start);
function trains(dir, wd) {
  if (!rail || !rail[dir]) return [];
  return (rail[dir][wd] || []).map(x => ({ dep: tm(x[0]), arr: tm(x[1]) }));
}
function morning(c, wd) {
  if (!isSchoolDay(c, wd)) return null;
  const day = c.days[wd], L = c.legs;
  const start = tm(day.start), by = day.by ? tm(day.by) : start;
  const head = L.walk1 + L.bus1 + L.buffer, tail = L.wait2 + L.bus2 + L.walk2;
  const opts = trains('toHerzliya', wd).map(t => ({ train: t.dep, trainArr: t.arr, leave: t.dep - head, bus: t.dep - L.buffer - L.bus1, arrive: t.arr + tail }))
    .filter(o => o.leave >= 4 * 60 && o.arrive <= by + 60);
  opts.forEach(o => { o.ok = o.arrive <= by; o.spare = by - o.arrive; });
  let best = null;
  opts.forEach(o => { if (o.ok) best = o; });
  return { wd, start, by, hasBy: !!day.by, opts, best, legs: L };
}
function afternoon(c, wd) {
  if (!isSchoolDay(c, wd)) return null;
  const day = c.days[wd], L = c.legs;
  const end = tm(day.end || '14:00');
  const toStation = L.walk2 + L.wait2 + L.bus2 + 3;
  const opts = trains('toRoshHaAyin', wd).filter(t => t.dep >= end + toStation).slice(0, 4)
    .map(t => ({ train: t.dep, trainArr: t.arr, leave: t.dep - toStation, home: t.arr + 5 + L.bus1 + L.walk1 }));
  return { wd, end, opts, best: opts[0] || null, legs: L };
}
function nextSchoolDay(c, fromOff) {
  for (let off = fromOff; off < fromOff + 14; off++) {
    const d = D.dayAt(off);
    if (c.offUntil && D.dk(d) < c.offUntil) continue;
    if (isSchoolDay(c, d.getDay())) return off;
  }
  return null;
}
// What matters right now. kind: off | morning | school | after | next
function phase(c, now) {
  if (!c) return null;
  now = now == null ? D.nowMin() : now;
  const today = D.dayAt(0), wd = today.getDay();
  if (c.offUntil && D.todayKey() < c.offUntil) return { kind: 'off', until: c.offUntil, nextOff: nextSchoolDay(c, 0) };
  if (isSchoolDay(c, wd)) {
    const m = morning(c, wd), a = afternoon(c, wd);
    if (m && now < m.by) {
      let pick = m.best;
      if (!pick || now > pick.leave) pick = m.opts.find(o => o.leave >= now) || pick;
      return { kind: 'morning', m, pick, mins: pick ? pick.leave - now : null };
    }
    if (a && now < a.end - 20) return { kind: 'school', a };
    if (a && a.best && now <= a.best.leave + 30) {
      const pick = a.opts.find(o => o.leave >= now) || a.best;
      return { kind: 'after', a, pick, mins: pick.leave - now };
    }
  }
  const off = nextSchoolDay(c, 1);
  if (off == null) return { kind: 'none' };
  const d = D.dayAt(off);
  return { kind: 'next', off, m: morning(c, d.getDay()) };
}

window.COMMUTE = { KEY, loadRail, rail: () => rail, defaults, cfg, morning, afternoon, phase, nextSchoolDay, isSchoolDay, tm, hhmm };
})();
