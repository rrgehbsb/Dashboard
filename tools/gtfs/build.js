#!/usr/bin/env node
/* Rebuild v3/data/rail.json and v3/data/bus.json from the Ministry of Transport GTFS
   feed (https://gtfs.mot.gov.il/gtfsfiles/israel-public-transportation.zip).
   Runs weekly in GitHub Actions (.github/workflows/timetables.yml); can also run
   locally:  node tools/gtfs/build.js path/to/israel-public-transportation.zip
   Needs `unzip` on PATH. Streams the ~1 GB stop_times.txt twice; uses little memory.

   rail.json: trains Rosh HaAyin North <-> Herzliya per weekday: [dep, arr, trainNo]
              (trainNo = GTFS trip_headsign = line_name in the live SIRI feed)
   bus.json:  Rosh HaAyin lines 71–74 (operator 25) and every bus route through the
              stops within 450 m of Herzliya station; per route variant: stop codes,
              offset patterns (minutes from the first stop) and trips per weekday
              as [originMinute, patternIndex]. */
'use strict';
const fs = require('fs'), path = require('path'), rl = require('readline'), { spawn, execFileSync } = require('child_process');

const ZIP = process.argv[2];
const OUT = path.join(__dirname, '..', '..', 'v3', 'data');
const RH_CODE = '17094', HZ_CODE = '17034';     // station stop codes (stable public codes)
const NEAR_HZ_M = 450;
if (!ZIP || !fs.existsSync(ZIP)) { console.error('usage: node tools/gtfs/build.js <gtfs.zip>'); process.exit(1); }

const readText = name => execFileSync('unzip', ['-p', ZIP, name], { maxBuffer: 1 << 30 }).toString('utf8').replace(/^﻿/, '');
const rows = text => text.split(/\r?\n/).filter(Boolean).map(l => l.split(','));
function streamLines(name, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn('unzip', ['-p', ZIP, name]);
    let first = true;
    rl.createInterface({ input: p.stdout }).on('line', l => { if (first) { first = false; l = l.replace(/^﻿/, ''); } onLine(l); }).on('close', resolve);
    p.on('error', reject);
  });
}
const m2 = t => { const p = t.split(':'); return (+p[0]) * 60 + (+p[1]); };
const hm = t => t.slice(0, 5);
const ymd = d => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
const dist = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180; const dLa = r(b.lat - a.lat), dLo = r(b.lon - a.lon); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

(async () => {
  const t0 = Date.now();
  // The sample week: the next full Sunday–Saturday (Israel), one pattern per weekday.
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7 || 7));
  const WEEK = [0, 1, 2, 3, 4, 5, 6].map(i => ymd(new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i)));
  console.log('sample week', WEEK[0], '–', WEEK[6]);

  // stops
  const stops = {}, byCode = {};
  rows(readText('stops.txt')).slice(1).forEach(c => {
    const m = /עיר:\s*([^ ]+(?: [^ ]+)?)\s+רציף/.exec(c[3] || '');
    const s = { id: c[0], code: c[1], name: c[2], lat: +c[4], lon: +c[5], city: m ? m[1].trim() : '' };
    stops[c[0]] = s; if (s.code) byCode[s.code] = s;
  });
  const RH = byCode[RH_CODE], HZ = byCode[HZ_CODE];
  if (!RH || !HZ) throw new Error('station stop codes not found in stops.txt');
  const nearHz = new Set(Object.values(stops).filter(s => s.id !== HZ.id && dist(s, HZ) <= NEAR_HZ_M).map(s => s.id));
  console.log('stops near Herzliya station:', nearHz.size);

  // routes, calendar, trips
  const routes = {};
  rows(readText('routes.txt')).slice(1).forEach(c => { routes[c[0]] = { id: c[0], agency: c[1], line: c[2], name: c[3], type: c[5] }; });
  const cal = {}; const ch = rows(readText('calendar.txt')); const h = ch[0];
  ch.slice(1).forEach(c => { cal[c[h.indexOf('service_id')]] = { days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(d => c[h.indexOf(d)] === '1'), start: c[h.indexOf('start_date')], end: c[h.indexOf('end_date')] }; });
  const wdsOf = sid => { const s = cal[sid]; if (!s) return []; const out = []; WEEK.forEach((ds, wd) => { if (s.days[wd] && ds >= s.start && ds <= s.end) out.push(wd); }); return out; };
  const trips = {}; // trip_id -> {route, service, headsign, wds}
  const th = rows(readText('trips.txt')); const tH = th[0];
  const RI = tH.indexOf('route_id'), SI = tH.indexOf('service_id'), TI = tH.indexOf('trip_id'), HI = tH.indexOf('trip_headsign');
  th.slice(1).forEach(c => { const wds = wdsOf(c[SI]); if (wds.length) trips[c[TI]] = { route: c[RI], service: c[SI], head: c[HI] || '', wds }; });

  // pass 1: bus trips that touch the stops around Herzliya station
  const hzTrips = new Set(); let H1 = null;
  await streamLines('stop_times.txt', l => {
    if (!H1) { H1 = l.split(','); H1.t = H1.indexOf('trip_id'); H1.s = H1.indexOf('stop_id'); return; }
    const c = l.split(','); if (nearHz.has(c[H1.s]) && trips[c[H1.t]]) hzTrips.add(c[H1.t]);
  });
  const isHome = r => r.agency === '25' && /^7[1-4]\D*$/.test(r.line) && /ראש העין/.test(r.name);
  const keepBus = new Set(), keepRail = new Set();
  Object.keys(trips).forEach(tid => {
    const r = routes[trips[tid].route]; if (!r) return;
    if (r.type === '2') keepRail.add(tid);
    else if (isHome(r) || hzTrips.has(tid)) keepBus.add(tid);
  });
  console.log('pass 1 done: bus trips', keepBus.size, 'rail trips', keepRail.size);

  // pass 2: stop times for the kept trips
  const st = {}; let H2 = null;
  await streamLines('stop_times.txt', l => {
    if (!H2) { H2 = l.split(','); H2.t = H2.indexOf('trip_id'); H2.s = H2.indexOf('stop_id'); H2.a = H2.indexOf('arrival_time'); H2.d = H2.indexOf('departure_time'); H2.q = H2.indexOf('stop_sequence'); return; }
    const c = l.split(','), tid = c[H2.t];
    if (keepBus.has(tid) || (keepRail.has(tid) && (c[H2.s] === RH.id || c[H2.s] === HZ.id)))
      (st[tid] = st[tid] || []).push([+c[H2.q], c[H2.s], c[H2.a], c[H2.d]]);
  });

  // rail.json
  const rail = { toHerzliya: {}, toRoshHaAyin: {} };
  for (let wd = 0; wd < 7; wd++) { rail.toHerzliya[wd] = []; rail.toRoshHaAyin[wd] = []; }
  keepRail.forEach(tid => {
    const s = st[tid]; if (!s || s.length < 2) return;
    const a = s.find(x => x[1] === RH.id), b = s.find(x => x[1] === HZ.id); if (!a || !b) return;
    const dir = a[0] < b[0] ? 'toHerzliya' : 'toRoshHaAyin', from = dir === 'toHerzliya' ? a : b, to = dir === 'toHerzliya' ? b : a;
    trips[tid].wds.forEach(wd => rail[dir][wd].push([hm(from[3] || from[2]), hm(to[2] || to[3]), trips[tid].head]));
  });
  ['toHerzliya', 'toRoshHaAyin'].forEach(dir => { for (let wd = 0; wd < 7; wd++) { const seen = new Set(); rail[dir][wd] = rail[dir][wd].sort((x, y) => x[0].localeCompare(y[0])).filter(x => { const k = x.join(); if (seen.has(k)) return false; seen.add(k); return true; }); } });

  // bus.json
  const variants = {}, used = new Set();
  keepBus.forEach(tid => {
    const s = st[tid]; if (!s) return;
    const k = trips[tid], r = routes[k.route];
    s.sort((x, y) => x[0] - y[0]);
    const origin = m2(s[0][3] || s[0][2]);
    const kept = isHome(r) ? s : s.filter(x => (stops[x[1]] || {}).city === 'הרצליה');
    if (kept.length < 2) return;
    const codes = kept.map(x => stops[x[1]].code), offs = kept.map(x => m2(x[3] || x[2]) - origin);
    const sig = k.route + '|' + codes.join('.');
    const v = variants[sig] || (variants[sig] = { id: k.route, line: r.line, agency: r.agency, name: r.name, to: stops[s[s.length - 1][1]].name, stops: codes, pats: [], pk: {}, days: {} });
    const pk = offs.join('.');
    if (!(pk in v.pk)) { v.pk[pk] = v.pats.length; v.pats.push(offs); }
    k.wds.forEach(wd => (v.days[wd] = v.days[wd] || []).push([origin, v.pk[pk]]));
    codes.forEach(c => used.add(c));
  });
  const bus = { stops: {}, routes: [] };
  Object.values(stops).forEach(s => { if (used.has(s.code)) bus.stops[s.code] = [s.name, Math.round(s.lat * 1e5) / 1e5, Math.round(s.lon * 1e5) / 1e5, s.city]; });
  Object.values(variants).forEach(v => {
    Object.keys(v.days).forEach(wd => { const seen = new Set(); v.days[wd] = v.days[wd].sort((a, b) => a[0] - b[0]).filter(x => { const kk = x.join(); if (seen.has(kk)) return false; seen.add(kk); return true; }); });
    delete v.pk; bus.routes.push(v);
  });
  bus.routes.sort((a, b) => a.line.localeCompare(b.line, 'he', { numeric: true }) || a.id.localeCompare(b.id));

  // sanity checks: never publish an empty or broken timetable
  const weekdayTrains = rail.toHerzliya[1].length + rail.toRoshHaAyin[1].length;
  const homeRoutes = bus.routes.filter(r => r.agency === '25' && /^7[1-4]/.test(r.line)).length;
  if (weekdayTrains < 20 || homeRoutes < 4 || bus.routes.length < 20) throw new Error('sanity check failed: trains ' + weekdayTrains + ', home routes ' + homeRoutes + ', routes ' + bus.routes.length);

  const ends = [...keepRail].concat([...keepBus]).map(t => cal[trips[t].service].end).sort();
  const meta = { source: 'Israel Ministry of Transport GTFS (gtfs.mot.gov.il)', built: ymd(now), sampleWeek: WEEK[0] + '-' + WEEK[6], validTo: ends.length ? ends[ends.length - 1] : null };
  Object.assign(rail, meta, { note: 'Each train: [departure, arrival, train number]. The train number is the line_name in the live feed.', stations: { roshHaAyinNorth: { gtfsStopId: RH.id, code: RH_CODE }, herzliya: { gtfsStopId: HZ.id, code: HZ_CODE } } });
  Object.assign(bus, meta);
  fs.writeFileSync(path.join(OUT, 'rail.json'), JSON.stringify(rail));
  fs.writeFileSync(path.join(OUT, 'bus.json'), JSON.stringify(bus));
  console.log('rail: Mon trains', weekdayTrains, '| bus routes', bus.routes.length, '(home', homeRoutes + ') | stops', Object.keys(bus.stops).length);
  console.log('done in', Math.round((Date.now() - t0) / 1000), 's');
})().catch(e => { console.error(e); process.exit(1); });
