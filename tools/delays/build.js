#!/usr/bin/env node
/* How late do lines 71–74 really reach Rosh HaAyin North station? Builds
   v3/data/delays.json from the real bus positions recorded by the Public Knowledge
   Workshop's open-bus "Stride" archive (https://open-bus-stride-api.hasadna.org.il),
   so the trip planner can leave room for the delay your bus usually has.

   Measured where every line passes 2–3 minutes before the station (צומת קסם, 32024):
   the first recorded position within ~110 m of it, minus the timetable time there.
   (At the station itself buses stop reporting, so the stop before is the clean signal.)
   School-day mornings (Sun–Thu, 05:30–10:30 Israel time), the last 35 days, kept in
   tools/delays/obs.json so each weekly run only fetches the days it hasn't seen.

   Runs in GitHub Actions with the timetables (.github/workflows/timetables.yml).
   Locally:  node tools/delays/build.js [days]      (needs Node 18+; no packages) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const OBS = path.join(__dirname, 'obs.json'), OUT = path.join(ROOT, 'v3', 'data', 'delays.json');
const API = 'https://open-bus-stride-api.hasadna.org.il/siri_vehicle_locations/list';
const KESEM = { code: '32024', lat: 32.12059, lon: 34.93879, box: 0.0010 };
const KEEP_DAYS = 35, DAYS = +process.argv[2] || 28, WINDOWS = [['05:30', '08:00'], ['08:00', '10:30']];

const bus = JSON.parse(fs.readFileSync(path.join(ROOT, 'v3', 'data', 'bus.json'), 'utf8'));
const ROUTES = {}; // GTFS route id = SIRI line_ref, for lines 71–74 towards the station
bus.routes.filter(r => r.agency === '25' && /^7[1-4]/.test(r.line) && /תחנת רכבת ראש העין צפון/.test(r.to) && r.stops.indexOf(KESEM.code) > 0).forEach(r => { ROUTES[r.id] = r; });

const tz = 'Asia/Jerusalem';
const parts = d => { const o = {}; new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(p => { o[p.type] = p.value; }); return o; };
const localMin = iso => { const p = parts(new Date(iso)); return (+p.hour) * 60 + (+p.minute) + (+p.second) / 60; };
const localDay = d => { const p = parts(d); return p.year + '-' + p.month + '-' + p.day; };
// a local Israel time on a day → the UTC ISO string
function utc(day, hm) {
  const guess = new Date(day + 'T' + hm + ':00Z');
  const p = parts(guess), shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString().replace('.000Z', 'Z');
}
const wait = ms => new Promise(r => setTimeout(r, ms));
async function get(url, tries) {
  for (let i = 0; i < (tries || 3); i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(120000) }); const j = await r.json(); if (Array.isArray(j)) return j; } catch (e) {}
    await wait(4000 * (i + 1));
  }
  return null;
}
// one day: [[line, plannedMinute, minutesLate], …] (null if the archive didn't answer)
async function day(dk) {
  const wd = new Date(dk + 'T12:00:00Z').getUTCDay(), first = {};
  for (const [a, b] of WINDOWS) {
    const q = '?limit=5000&lat__greater_or_equal=' + (KESEM.lat - KESEM.box) + '&lat__lower_or_equal=' + (KESEM.lat + KESEM.box) +
      '&lon__greater_or_equal=' + (KESEM.lon - KESEM.box) + '&lon__lower_or_equal=' + (KESEM.lon + KESEM.box) +
      '&recorded_at_time_from=' + utc(dk, a) + '&recorded_at_time_to=' + utc(dk, b);
    const pings = await get(API + q);
    if (!pings) return null;
    pings.forEach(p => { if (!ROUTES[p.siri_route__line_ref]) return; const k = p.siri_ride__id; if (!first[k] || p.recorded_at_time < first[k].recorded_at_time) first[k] = p; });
  }
  const out = [];
  Object.values(first).forEach(p => {
    const r = ROUTES[p.siri_route__line_ref], o = Math.round(localMin(p.siri_ride__scheduled_start_time));
    const t = (r.days[wd] || []).find(x => x[0] === o); if (!t) return;
    const planned = o + r.pats[t[1]][r.stops.indexOf(KESEM.code)], late = localMin(p.recorded_at_time) - planned;
    if (late > -10 && late < 45) out.push([r.line.replace(/\D+$/, ''), planned, Math.round(late * 10) / 10]);
  });
  return out.sort((x, y) => x[1] - y[1]);
}
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), i = (s.length - 1) * f, lo = Math.floor(i); return Math.round((s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo)) * 10) / 10; };

(async () => {
  const t0 = Date.now();
  let obs = {}; try { obs = JSON.parse(fs.readFileSync(OBS, 'utf8')); } catch (e) {}
  // school days we haven't fetched yet (yesterday back to DAYS ago)
  const todo = [];
  for (let i = 1; i <= DAYS; i++) { const d = new Date(Date.now() - i * 864e5), dk = localDay(d), wd = new Date(dk + 'T12:00:00Z').getUTCDay(); if (wd <= 4 && !obs[dk]) todo.push(dk); }
  console.log('days to fetch:', todo.length);
  const POOL = 3; let next = 0, fails = 0;
  await Promise.all(Array.from({ length: POOL }, async () => {
    while (next < todo.length) {
      const dk = todo[next++], r = await day(dk);
      if (r && r.length) { obs[dk] = r; console.log(dk, r.length + ' rides'); }
      else { fails++; console.log(dk, r ? 'no rides (holiday?)' : 'archive did not answer'); if (r) obs[dk] = []; }
    }
  }));
  // keep the last KEEP_DAYS days
  const cut = localDay(new Date(Date.now() - KEEP_DAYS * 864e5));
  Object.keys(obs).forEach(dk => { if (dk < cut) delete obs[dk]; });
  const keys = Object.keys(obs).sort(), out = {}; obs = keys.reduce((o, k) => { o[k] = obs[k]; return o; }, {});
  // per line and hour (by the timetable time at the stop): how late, usually and on a bad day
  const by = {};
  keys.forEach(dk => obs[dk].forEach(([line, planned, late]) => { const h = Math.floor(planned / 60); ((by[line] = by[line] || {})[h] = by[line][h] || []).push(late); }));
  Object.keys(by).sort().forEach(line => { out[line] = {}; Object.keys(by[line]).sort((a, b) => a - b).forEach(h => { const a = by[line][h]; out[line][h] = [a.length, q(a, 0.5), q(a, 0.75), q(a, 0.9)]; }); });
  const n = keys.reduce((s, k) => s + obs[k].length, 0);
  if (n < 20) { console.log('Too little data (' + n + ' rides); keeping the old delays.json.'); process.exit(0); }
  fs.writeFileSync(OBS, JSON.stringify(obs));
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const body = { at: 'kesem', stopCode: KESEM.code, from: keys[0], to: keys[keys.length - 1], days: keys.filter(k => obs[k].length).length, rides: n,
    note: 'minutes late passing צומת קסם (2–3 min before Rosh HaAyin North station): line → hour → [rides, median, p75, p90]', lines: out };
  const json = JSON.stringify(body);
  if (json !== prev) fs.writeFileSync(OUT, json);
  console.log('rides', n, 'days', body.days, 'fails', fails, Math.round((Date.now() - t0) / 1000) + 's');
  Object.keys(out).forEach(l => console.log(l, Object.keys(out[l]).map(h => h + ':' + out[l][h].join('/')).join('  ')));
})();
