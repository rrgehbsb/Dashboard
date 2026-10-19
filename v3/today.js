/* Dashboard v3 — Today screen. Reads/writes the SAME data as the classic pages:
   uid:dashboard  goals:YYYY-MM-DD = [{text, done, queued?, carriedFrom?, later?, rep?}]
                  (a task for a later date simply lives in that day's list)
                  repeats = [{id, text, every:'day'|'school'|'week', wd, from, added:[dk…], at, deleted?}]
   uid:school     dashboard:school:v1:{subjects,assignments,tests}   (read)
   uid:po-coach   dashboard:gym:v1:{template,logs}                  (read)
   uid:food       days[YYYY-MM-DD].entries[].nutrients.kcal, custom.kcal (read) */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic, TT = window.TIMETABLE;

/* ---------- rows ---------- */
// Repeating tasks merge entry by entry (newest change wins; the days they were already
// put on the list are combined), so two devices never duplicate or lose one.
function mergeRepeats(a, b) {
  if (!Array.isArray(a)) return Array.isArray(b) ? b : [];
  if (!Array.isArray(b)) return a;
  const m = new Map();
  a.concat(b).forEach(r => {
    if (!r || !r.id) return;
    const c = m.get(r.id);
    if (!c) { m.set(r.id, r); return; }
    const newer = (r.at || 0) >= (c.at || 0) ? r : c;
    m.set(r.id, Object.assign({}, newer, { added: Array.from(new Set((c.added || []).concat(r.added || []))).sort().slice(-21) }));
  });
  return Array.from(m.values());
}
const dash = D.Row('dashboard', { merge: { repeats: mergeRepeats } });
const school = D.Row('school', { readOnly: true });
window.TODAY_SCHOOL_ROW = school; // social.js shares the trip from here too
const gym = D.Row('po-coach', { readOnly: true });
const food = D.Row('food', { readOnly: true });

/* ---------- demo data (only with ?demo, never written to the cloud) ---------- */
if (D.DEMO) {
  const t = D.todayKey(), tm = D.dk(D.dayAt(1)), ago = n => D.dk(D.dayAt(-n));
  dash.data = {};
  dash.data['goals:' + t] = [
    { text: 'Print bio worksheet', done: false }, { text: 'Email Dana about the project', done: false, carriedFrom: ago(3) },
    { text: 'Return library book', done: false }, { text: 'Buy protein powder', done: false },
    { text: 'Pack gym bag', done: true }, { text: 'Call grandma', done: true },
    { text: 'Renew Rav-Kav student profile', done: false, carriedFrom: ago(90) }, { text: 'Fix bike tyre', done: false, carriedFrom: ago(80) }
  ];
  dash.data['goals:' + tm] = [{ text: 'Math homework p.112', done: false }, { text: 'Bring PE clothes', done: false }];
  school.data = {
    'dashboard:school:v1:subjects': [{ id: 's1', name: 'Biology' }, { id: 's2', name: 'Math' }, { id: 's3', name: 'English' }],
    'dashboard:school:v1:assignments': [{ id: 'a1', subjectId: 's2', title: 'Homework p.112', dueDate: D.dk(D.dayAt(4)), status: 'Todo' }, { id: 'a2', subjectId: 's3', title: 'Essay draft', dueDate: D.dk(D.dayAt(7)), status: 'Todo' }],
    'dashboard:school:v1:tests': [{ id: 't1', subjectId: 's1', name: 'Bio test', testDate: D.dk(D.dayAt(2)) }],
    'dashboard:school:v1:timetable': { cls: '11-3', mine: ['מדעי המחשב'], trip: true, early: '08:00', hidden: [] },
    'dashboard:school:v1:commute': { setup: true, legs: { walk1: 3, bus1: 34, buffer: 5, wait2: 5, bus2: 3, walk2: 8 }, home: { lines: ['71', '72', '73', '74'], stop: '32645' }, hz: { mode: 'bus', from: '27102', to: '20378', lines: [], transfer: 4, walk: 5 }, days: { 0: { start: '07:45', end: '14:00', by: '08:00' }, 1: { start: '08:00', end: '14:45', by: null }, 2: { start: '07:45', end: '13:30', by: '08:00' }, 3: { start: '08:00', end: '14:45', by: null }, 4: { start: '08:00', end: '13:00', by: null } }, offUntil: null }
  };
  gym.data = {
    'dashboard:gym:v1:template': [{ id: 'd1', name: 'Push', exercises: [{ id: 'e1', name: 'Bench' }] }, { id: 'd2', name: 'Pull', exercises: [{ id: 'e2', name: 'Row' }] }, { id: 'd3', name: 'Legs', exercises: [{ id: 'e3', name: 'Squat' }] }],
    'dashboard:gym:v1:logs': (() => { const o = {}; o[ago(3)] = { e3: { set1: '100x5' } }; o[ago(5)] = { e2: { set1: '70x8' } }; return o; })()
  };
  food.data = { days: {}, custom: { kcal: 2400 } };
  food.data.days[t] = { entries: [{ nutrients: { kcal: 440 } }, { nutrients: { kcal: 620 } }, { nutrients: { kcal: 180 } }] };
  D.settings.data.name = D.settings.data.name || 'Tom';
}

/* ---------- to-do model ---------- */
const S = { day: 'today', showDone: false, showLater: false, folding: {} };
const todayK = () => 'goals:' + D.todayKey();
const tomorrowK = () => 'goals:' + D.dk(D.dayAt(1));
const listKey = () => S.day === 'today' ? todayK() : tomorrowK();
const list = k => { const a = dash.get(k); return Array.isArray(a) ? a : []; };
const isOld = g => g.carriedFrom && !g.later && (D.daysFrom(g.carriedFrom) || 0) < -7;
const save = (k, arr) => { dash.set(k, arr); };

const keyOf = dk => 'goals:' + dk;
const offOf = k => D.daysFrom(k.slice(6));
// "Today" / "Tomorrow" / "Fri" (this week) / "Fri 23 Oct"
function dayLabel(dk) { const d = D.daysFrom(dk); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 && d <= 6 ? D.DOW_L[D.parseDk(dk).getDay()] : D.dShort(D.parseDk(dk)); }

/* A date typed at the end of a task: "buy charger fri", "dentist 25/10", "call gran
   tomorrow", "essay next week", "renew card in 10 days". Shown before adding, and it
   can be switched off with ×, so "watch Friday" stays a plain task if you want. */
const WDAY = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
function parseWhen(raw) {
  const words = String(raw || '').trim().split(/\s+/);
  if (words.length < 2) return null;
  const w = i => (words[words.length - i] || '').toLowerCase().replace(/[,.!]+$/, '');
  const todayWd = D.dayAt(0).getDay();
  let off = null, n = 1, m;
  if (/^(today|tonight)$/.test(w(1))) off = 0;
  else if (/^(tomorrow|tmrw|tmr|tomo)$/.test(w(1))) off = 1;
  else if (WDAY[w(1)] != null) off = ((WDAY[w(1)] - todayWd) + 7) % 7 || 7;
  else if ((m = w(1).match(/^(\d{1,2})[./](\d{1,2})(?:[./](\d{2}|\d{4}))?$/))) {
    const now = D.dayAt(0), y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear();
    let d = new Date(y, +m[2] - 1, +m[1], 12);
    if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return null; // 31/2 and the like
    if (!m[3] && d < now) d = new Date(y + 1, +m[2] - 1, +m[1], 12);
    off = Math.round((d - now) / 864e5);
  } else if (w(1) === 'week' && w(2) === 'next') { off = (7 - todayWd) || 7; n = 2; }
  else if (/^days?$/.test(w(1)) && /^\d{1,3}$/.test(w(2)) && w(3) === 'in') { off = +w(2); n = 3; }
  if (off == null || off < 0 || off > 366) return null;
  if (n === 1 && words.length > 2 && /^(on|next|this|by)$/.test(w(2))) n = 2;
  const text = words.slice(0, words.length - n).join(' ').trim();
  return text ? { text, dk: D.dk(D.dayAt(off)) } : null;
}

// Repeating tasks: not a calendar, just "this task comes back on these days". They're put
// on today's and tomorrow's lists (once per day, never twice).
const reps = () => list('repeats').filter(r => r && !r.deleted);
const repLabel = r => r.every === 'day' ? 'every day' : r.every === 'school' ? 'school days' : 'every ' + D.DOW[r.wd];
const repDue = (r, d) => r.every === 'day' || (r.every === 'school' ? d.getDay() <= 4 : d.getDay() === r.wd);
function placeRepeats() {
  const all = list('repeats'); if (!all.length) return;
  const out = all.map(r => Object.assign({}, r));
  let touched = false;
  [0, 1].forEach(off => {
    const d = D.dayAt(off), dk = D.dk(d), k = keyOf(dk);
    let arr = null;
    out.forEach(r => {
      if (!r || !r.id || r.deleted || (r.added || []).indexOf(dk) >= 0 || (r.from && dk < r.from) || !repDue(r, d)) return;
      arr = arr || list(k).slice();
      if (!arr.some(g => g && g.text === r.text)) arr.push({ text: r.text, done: false, rep: r.id });
      r.added = (r.added || []).concat([dk]).sort().slice(-21); touched = true;
    });
    if (arr) save(k, arr);
  });
  if (touched) save('repeats', out);
}

// Move unfinished tasks from past days onto today. Past days are emptied ([]),
// not deleted — a deleted key comes straight back from the cloud on the next
// merge, which is what kept resurrecting old tasks in the classic home page.
function rollover() {
  const t = D.todayKey(), tk = todayK();
  const today = list(tk).slice();
  const have = new Set(today.map(g => g.text));
  let changed = false;
  Object.keys(dash.data).filter(k => k.indexOf('goals:') === 0 && k.slice(6) < t).forEach(k => {
    const arr = list(k);
    if (!arr.length) return;
    arr.forEach(g => {
      if (!g || g.done || have.has(g.text)) return;
      const n = { text: g.text, done: false, carriedFrom: g.carriedFrom || k.slice(6) };
      if (g.queued) n.queued = true;
      if (g.later) n.later = true;
      if (g.rep) n.rep = g.rep;
      today.push(n); have.add(g.text);
    });
    save(k, []); changed = true;
  });
  if (changed) save(tk, today);
}

/* ---------- school / gym / food readers ---------- */
const sch = k => { const a = school.get('dashboard:school:v1:' + k); return Array.isArray(a) ? a : []; };
const subjName = id => { const s = sch('subjects').find(x => x.id === id); return s ? s.name : ''; };
const dayWord = d => d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(d).getDay()];
function schoolSoon(maxDays) {
  const out = [];
  sch('assignments').forEach(a => { if (!a || a.deleted || a.status === 'Done') return; const d = D.daysFrom(a.dueDate); if (d == null || d < 0 || d > maxDays) return; out.push({ kind: 'hw', title: a.title, subj: subjName(a.subjectId), d: d }); });
  sch('tests').forEach(t => { if (!t || t.deleted) return; const d = D.daysFrom(t.testDate); if (d == null || d < 0 || d > maxDays) return; out.push({ kind: 'test', title: t.name, subj: subjName(t.subjectId), d: d }); });
  // tests on the school calendar (the School page shows them the same way)
  if (TT) { const s = TT.settings(school); if (s.cls) TT.upcoming(s, sch('tests'), maxDays).forEach(t => out.push({ kind: 'test', title: t.title, subj: 'School calendar', d: t.d, he: true })); }
  return out.sort((a, b) => a.d - b.d || (a.kind === 'test' ? -1 : 1));
}
// Changes to tomorrow's lessons, once the school posts them (around 20:00).
function ttChanges(dk) { if (!TT) return 0; const s = TT.settings(school); return s.cls ? TT.changes(dk, s) || 0 : 0; }
// is that day still only the weekly plan (the school hasn't posted its update)?
function ttWeeklyOnly(dk) { if (!TT) return false; const s = TT.settings(school); if (!s.cls) return false; const v = TT.day(dk, s); return !!v && !v.published && !v.holiday; }
const isSetKey = k => /^set\d+/.test(k);
function gymInfo() {
  const tpl = gym.get('dashboard:gym:v1:template'), logs = gym.get('dashboard:gym:v1:logs') || {};
  if (!Array.isArray(tpl) || !tpl.length) return null;
  const has = (dayLogs, day) => !!dayLogs && (day.exercises || []).some(e => { const el = dayLogs[e.id]; return el && Object.keys(el).some(k => isSetKey(k) && String(el[k] || '').trim()); });
  const dates = Object.keys(logs).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse();
  let lastIdx = -1, doneToday = null, setsDone = 0, setsTotal = 0;
  for (const dt of dates) {
    const i = tpl.findIndex(day => has(logs[dt], day));
    if (i < 0) continue;
    if (dt === D.todayKey()) {
      doneToday = tpl[i].name;
      // count logged sets the same way the Gym page does (one-sided lifts log L and R)
      (tpl[i].exercises || []).forEach(e => {
        const el = logs[dt][e.id] || {}, n = Math.max(1, parseInt(e.sets, 10) || 3) * (e.unilateral ? 2 : 1);
        setsTotal += n;
        for (let s = 0; s < (parseInt(e.sets, 10) || 3); s++) {
          if (String(el['set' + s] || '').trim()) setsDone++;
          if (e.unilateral && String(el['set' + s + 'R'] || '').trim()) setsDone++;
        }
      });
    }
    lastIdx = i;
    break;
  }
  const ws = D.dayAt(-D.dayAt(0).getDay());
  const week = dates.filter(dt => D.parseDk(dt) >= ws && tpl.some(day => has(logs[dt], day))).length;
  const next = tpl[(lastIdx + 1) % tpl.length];
  return { next: next ? next.name : '', doneToday: doneToday, finished: !!doneToday && setsDone >= setsTotal, setsDone, setsTotal, week: week, perWeek: Math.max(3, tpl.length) };
}
function foodInfo() {
  const days = food.get('days') || {}, day = days[D.todayKey()];
  const entries = ((day && day.entries) || []).filter(e => e && !e.deleted);
  if (!entries.length) return null;
  const nut = e => e.n || e.nutrients || {};
  const kcal = Math.round(entries.reduce((s, e) => s + (+nut(e).kcal || 0), 0));
  const p = Math.round(entries.reduce((s, e) => s + (+nut(e).protein_g || 0), 0));
  const custom = food.get('custom') || {}, worked = D.readJSON(D.ukey('dash3:food:targets')) || {};
  return { kcal: kcal, protein: p, target: +custom.kcal || +worked.kcal || null, pTarget: +custom.protein_g || +worked.protein_g || null };
}

/* ---------- header ---------- */
function greeting() {
  const h = new Date().getHours(), nm = D.userName();
  const part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
  return nm ? part + ', ' + nm : 'Good ' + part.toLowerCase();
}
function renderHeader() {
  $('#today-date').textContent = D.dLong(D.dayAt(0));
  $('#greeting').textContent = greeting();
}
function renderWater() { $('#water-slot-today').innerHTML = D.waterChip('today'); D.animate($('#water-slot-today')); }

/* ---------- hero + tiles ---------- */
function heroModel() {
  const n = D.nowMin();
  // The trip to school comes first while it matters: leaving soon, or heading home.
  const CM = window.COMMUTE, cc = CM && CM.rail() ? CM.cfg(school) : null, ph = cc ? CM.phase(cc) : null;
  const lvw = ph && (ph.kind === 'morning' || ph.kind === 'after') ? CM.liveView(cc, ph) : null;
  const hp = cc && CM.health ? CM.health() : {}, warn = (hp.stale || hp.expired) ? '⚠ Timetable outdated · ' : hp.liveDown ? '⚠ Live data unavailable · ' : '';
  if (lvw) { ph.mins = lvw.mins; }
  if (ph && ph.kind === 'morning' && ph.pick && ph.mins != null && ph.mins <= 120 && ph.mins >= -15) {
    const late = !ph.pick.ok || (lvw && lvw.miss);
    return { area: ph.mins <= 5 || late ? 'amber' : 'school', href: D.pageHref('school'), eyebrow: 'To school',
      big: ph.mins > 0 ? '<span class="lead">Leave in</span><span class="n">' + D.numEl('hero-min', ph.mins) + '</span><span class="u">min</span>' : '<span class="t">Leave now</span>',
      sub: warn + (lvw && lvw.miss ? 'Bus is late · may miss the ' + CM.hhmm(ph.pick.train) + ' train' : CM.hhmm(lvw ? lvw.leave : ph.pick.leave) + ' · ' + (ph.pick.bus ? 'bus ' + esc(ph.pick.bus.line) + ' → ' : '') + CM.hhmm(ph.pick.train) + ' train' + (!ph.pick.ok ? ' · arrives ' + (-ph.pick.spare) + ' min late' : '')) + ' <span class="tag">' + (lvw && lvw.anyLive ? 'Live' : 'Timetable') + '</span>',
      bar: D.clamp(ph.mins / 30, 0, 1), label: 'Leave in ' + ph.mins + ' minutes' };
  }
  if (ph && ph.kind === 'after' && ph.pick) {
    return { area: ph.mins <= 5 && ph.mins >= 0 ? 'amber' : 'school', href: D.pageHref('school'), eyebrow: 'Going home',
      big: '<span class="lead">Train home</span><span class="n">' + CM.hhmm(ph.pick.train) + '</span>',
      sub: warn + 'Leave school by ' + CM.hhmm(lvw ? lvw.leave : ph.pick.leave) + (ph.mins > 0 ? ' · in ' + ph.mins + ' min' : ' · now') + ' <span class="tag">' + (lvw && lvw.anyLive ? 'Live' : 'Timetable') + '</span>',
      bar: D.clamp(ph.mins / 30, 0, 1), label: 'Train home ' + CM.hhmm(ph.pick.train) };
  }
  const soon = schoolSoon(2);
  const test = soon.find(x => x.kind === 'test');
  if (test) return { area: 'school', href: D.pageHref('school'), eyebrow: 'Coming up', big: '<span class="t"><bdi>' + esc(test.title) + '</bdi></span>', sub: dayWord(test.d) + (test.subj ? ' · ' + esc(test.subj) : ''), label: test.title + ', ' + dayWord(test.d) };
  const due = soon.filter(x => x.kind === 'hw' && x.d <= 1);
  if (due.length) return { area: 'school', href: D.pageHref('school'), eyebrow: 'Due ' + dayWord(due[0].d).toLowerCase(), big: '<span class="t">' + esc(due[0].title) + '</span>', sub: (due[0].subj ? esc(due[0].subj) : 'School') + (due.length > 1 ? ' · ' + (due.length - 1) + ' more' : ''), label: due[0].title + ' due ' + dayWord(due[0].d) };
  if (n >= 19 * 60) {
    const tm = list(tomorrowK()).filter(g => !g.done);
    if (ph && ph.kind === 'next' && ph.off === 1 && ph.m && ph.m.best) {
      const ch = ttChanges(D.dk(D.dayAt(1)));
      return { area: 'school', href: D.pageHref('school'), eyebrow: 'Tomorrow · ' + D.dShort(D.dayAt(1)), big: '<span class="lead">Leave</span><span class="n">' + CM.hhmm(ph.m.best.leave) + '</span>',
        sub: CM.hhmm(ph.m.best.train) + ' train' + (ch ? ' · ' + ch + ' timetable ' + D.plural(ch, 'change', 'changes') : ttWeeklyOnly(D.dk(D.dayAt(1))) ? ' · weekly plan, not updated yet' : '') + (tm.length ? ' · ' + tm.length + ' on your list' : ''), label: 'Tomorrow, leave ' + CM.hhmm(ph.m.best.leave) };
    }
    return { area: 'todo', href: '#todo', eyebrow: 'Tomorrow · ' + D.dShort(D.dayAt(1)), big: tm.length ? '<span class="n">' + D.numEl('hero-tm', tm.length) + '</span><span class="u">planned</span>' : '<span class="t">Nothing planned yet</span>', sub: tm.length ? esc(tm[0].text) + (tm.length > 1 ? ' · and ' + (tm.length - 1) + ' more' : '') : 'Flip the list below to Tomorrow to add things', label: 'Tomorrow' };
  }
  const items = list(todayK()).filter(g => !g.later && !isOld(g));
  const done = items.filter(g => g.done).length;
  if (!items.length) return { area: 'todo', href: '#todo', eyebrow: 'Today', big: '<span class="t">Clear day</span>', sub: 'Nothing on your list', label: 'Clear day' };
  if (done === items.length) return { area: 'todo', href: '#todo', eyebrow: 'Today', big: '<span class="t">All done</span>', sub: items.length + ' ' + D.plural(items.length, 'thing', 'things') + ' ticked off', label: 'All done' };
  return { area: 'todo', href: '#todo', eyebrow: 'Today', big: '<span class="n">' + D.numEl('hero-done', done) + '</span><span class="u">of ' + items.length + ' done</span>', sub: 'Next: ' + esc((items.find(g => !g.done && g.queued) || items.find(g => !g.done)).text), bar: done / items.length, label: done + ' of ' + items.length + ' done' };
}
function tileModels(heroArea) {
  const out = [];
  const g = gymInfo();
  out.push(g ? (g.doneToday
    ? (g.finished
      ? { area: 'gym', href: D.pageHref('gym'), label: 'Gym', p: g.week / g.perWeek, val: 'Done', sub: esc(g.doneToday) + ' · ' + g.week + ' this week' }
      : { area: 'gym', href: D.pageHref('gym'), label: 'Gym', p: g.setsTotal ? g.setsDone / g.setsTotal : 0, val: esc(g.doneToday), sub: g.setsDone + ' of ' + g.setsTotal + ' sets' })
    : { area: 'gym', href: D.pageHref('gym'), label: 'Gym', p: g.week / g.perWeek, val: esc(g.next), sub: g.week ? 'Up next · ' + g.week + ' this week' : 'Up next' })
    : { area: 'gym', href: D.pageHref('gym'), label: 'Gym', p: 0, val: 'No plan', sub: 'Set one up in Gym' });
  if (heroArea !== 'school') {
    const w = schoolSoon(7);
    out.push(w.length ? { area: 'school', href: D.pageHref('school'), label: 'School', p: 0, val: D.numEl('tile-school', w.length) + '<small>due</small>', sub: '<bdi>' + esc(w[0].title) + '</bdi> · ' + D.DOW[D.dayAt(w[0].d).getDay()] }
      : { area: 'school', href: D.pageHref('school'), label: 'School', p: 1, val: 'All clear', sub: 'Nothing due this week' });
  }
  const f = foodInfo();
  if (f) out.push({ area: 'food', href: D.pageHref('food'), label: 'Food', p: f.target ? f.kcal / f.target : 0, val: D.numEl('tile-food', f.kcal) + '<small>kcal</small>',
    sub: f.target ? (f.kcal <= f.target ? D.fmtN(f.target - f.kcal) + ' left' : D.fmtN(f.kcal - f.target) + ' over plan') + (f.pTarget && f.protein < f.pTarget ? ' · ' + (f.pTarget - f.protein) + ' g protein to go' : '') : 'logged today' });
  return out;
}
const ICON = { gym: 'gym', school: 'school', food: 'food' };
function renderHeroTiles() {
  const h = heroModel();
  $('#hero-slot').innerHTML = '<a class="hero" id="hero" data-area="' + h.area + '" href="' + h.href + '" aria-label="' + esc(h.label) + '">' +
    '<span class="hero-top"><span>' + h.eyebrow + '</span><span class="go">' + ic('go', 'sm') + '</span></span>' +
    '<span class="hero-big">' + h.big + '</span><span class="hero-sub">' + h.sub + '</span>' +
    (h.bar != null ? '<span class="hero-bar"><span style="width:' + Math.round(h.bar * 100) + '%"></span></span>' : '') + '</a>';
  const tiles = tileModels(h.area);
  $('#tiles').innerHTML = tiles.map((t, i) =>
    '<a class="tile' + (tiles.length === 3 && i === 2 ? ' wide' : '') + '" id="tile-' + t.area + '" data-area="' + t.area + '" href="' + t.href + '">' +
    '<span class="tile-top"><span class="tile-label">' + ic(ICON[t.area], 'sm') + t.label + '</span>' + D.ring('tile-' + t.area, t.p, 44, 6) + '</span>' +
    '<span class="tile-val">' + t.val + '</span><span class="tile-sub">' + t.sub + '</span></a>').join('');
  D.animate($('#hero-slot')); D.animate($('#tiles'));
}

/* ---------- to-do card ---------- */
const CHECK = '<span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg></span>';
function row(g, i, k) {
  const r = g.rep && reps().find(x => x.id === g.rep);
  const chips = (g.carriedFrom && !isOld(g) ? '<span class="chip-s carry">' + ic('arrow', 'xs') + 'from ' + D.DOW[D.parseDk(g.carriedFrom).getDay()] + '</span>' : '') +
    (r ? '<span class="chip-s rpt">' + ic('repeat', 'xs') + esc(repLabel(r)) + '</span>' : '');
  const meta = chips ? '<span class="task-meta">' + chips + '</span>' : '';
  return '<li class="task' + (g.done ? ' is-done' : '') + (S.enter === k + '#' + i ? ' enter' : '') + '" id="task-' + i + '" data-i="' + i + '" data-lp="task-menu">' +
    '<button class="check" id="check-' + i + '" data-act="task-toggle" data-i="' + i + '" aria-pressed="' + !!g.done + '" aria-label="' + (g.done ? 'Done' : 'Not done') + ': ' + esc(g.text) + '">' + CHECK + '</button>' +
    '<div class="task-text">' + (g.queued ? '<span class="pin-ic" title="Pinned">' + ic('pin', 'xs') + '<span class="sr">Pinned. </span></span>' : '') + '<span class="tt">' + esc(g.text) + '</span>' + meta + '</div>' +
    '<button class="more-btn" id="more-' + i + '" data-act="task-menu" data-i="' + i + '" aria-label="Options for ' + esc(g.text) + '">' + ic('more') + '</button></li>';
}
function updateHead() {
  const k = listKey(), items = list(k).filter(g => S.day !== 'today' || (!g.later && !isOld(g)));
  const total = items.length, done = items.filter(g => g.done).length;
  $('#todo-title').textContent = S.day === 'today' ? 'Today' : 'Tomorrow';
  $('#todo-count').textContent = total ? done + ' of ' + total : '';
  $('#todo-prog').style.width = (total ? done / total * 100 : 0) + '%';
  $('#todo-tab-today').setAttribute('aria-selected', String(S.day === 'today'));
  $('#todo-tab-tomorrow').setAttribute('aria-selected', String(S.day === 'tomorrow'));
  $('#todo-input').placeholder = S.day === 'today' ? 'Add a task' : 'Add a task for tomorrow';
}
function renderTodo() {
  updateHead();
  const k = listKey(), arr = list(k);
  const idx = arr.map((g, i) => [g, i]);
  const visible = idx.filter(([g]) => S.day !== 'today' || (!g.later && !isOld(g)));
  const open = visible.filter(([g, i]) => !g.done || S.folding[k + '#' + i]).sort((a, b) => (b[0].queued ? 1 : 0) - (a[0].queued ? 1 : 0));
  const done = visible.filter(([g, i]) => g.done && !S.folding[k + '#' + i]);
  $('#todo-list').innerHTML = open.length ? open.map(([g, i]) => row(g, i, k)).join('') :
    '<li class="empty">' + (visible.length ? 'All done for ' + (S.day === 'today' ? 'today' : 'tomorrow') + '. Nice.' : 'Nothing here yet. Add the first thing above.') + '</li>';
  let ex = '';
  if (done.length) {
    ex += '<button class="fold-line" id="done-toggle" data-act="toggle-done" aria-expanded="' + S.showDone + '"><span class="ok">' + ic('check', 'xs') + '</span>' + done.length + ' done' + ic('chev-r', 'sm chev') + '</button>';
    if (S.showDone) ex += '<ul class="tasks done-list">' + done.map(([g, i]) => row(g, i, k)).join('') + '</ul>';
  }
  if (S.day === 'today') {
    const later = idx.filter(([g]) => g.later && !g.done);
    if (later.length) {
      ex += '<button class="fold-line" id="later-toggle" data-act="toggle-later" aria-expanded="' + S.showLater + '"><span class="ok">' + ic('clock', 'xs') + '</span>Later · ' + later.length + ic('chev-r', 'sm chev') + '</button>';
      if (S.showLater) ex += '<ul class="tasks">' + later.map(([g, i]) => row(g, i, k)).join('') + '</ul>';
    }
    // tasks for later dates: one line until you open it (this is a to-do list, not a calendar)
    const tk = D.dk(D.dayAt(1));
    const ups = Object.keys(dash.data).filter(x => x.indexOf('goals:') === 0 && x.slice(6) > tk).sort()
      .map(x => [x, list(x).map((g, j) => [g, j]).filter(([g]) => g && !g.done)]).filter(x => x[1].length);
    const nUp = ups.reduce((a, x) => a + x[1].length, 0);
    if (nUp) {
      const first = ups[0];
      ex += '<button class="fold-line" id="up-toggle" data-act="toggle-up" aria-expanded="' + !!S.showUp + '"><span class="ok up">' + ic('cal', 'xs') + '</span><span class="up-sum">Coming up · ' + nUp +
        (S.showUp ? '' : '<small>' + esc(dayLabel(first[0].slice(6))) + ': ' + esc(first[1][0][0].text) + '</small>') + '</span>' + ic('chev-r', 'sm chev') + '</button>';
      if (S.showUp) ex += '<div class="up-list">' + ups.map(([x, items]) => '<p class="up-day">' + esc(dayLabel(x.slice(6))) + '</p><ul class="tasks">' + items.map(([g, j]) =>
        '<li class="task up-task"><button class="up-row" id="up-' + x.slice(6) + '-' + j + '" data-act="up-menu" data-k="' + x + '" data-i="' + j + '"><span class="up-dot" aria-hidden="true"></span><span class="tt">' + esc(g.text) + '</span>' + ic('chev-r', 'sm') + '</button></li>').join('') + '</ul>').join('') + '</div>';
    }
    const old = idx.filter(([g]) => !g.done && isOld(g));
    if (old.length) ex += '<div class="older"><p><strong>' + old.length + ' older ' + D.plural(old.length, 'task', 'tasks') + '</strong> from before</p><button class="btn-text" id="older-review" data-act="older-review">Review</button></div>';
  }
  $('#todo-extra').innerHTML = ex;
}
function renderAll() { renderHeader(); renderWater(); renderHeroTiles(); renderTodo(); }

/* ---------- to-do actions ---------- */
function toggle(i) {
  const k = listKey(), arr = list(k).slice(), g = arr[i];
  if (!g) return;
  const fk = k + '#' + i;
  if (g.done) { arr[i] = Object.assign({}, g, { done: false }); delete S.folding[fk]; save(k, arr); renderTodo(); renderHeroTiles(); return; }
  arr[i] = Object.assign({}, g, { done: true });
  S.folding[fk] = true;
  save(k, arr);
  const li = $('#task-' + i);
  if (li) { li.classList.add('is-done'); const b = $('#check-' + i); if (b) b.setAttribute('aria-pressed', 'true'); }
  updateHead(); renderHeroTiles();
  setTimeout(() => {
    const el = $('#task-' + i);
    if (el) el.classList.add('fold');
    setTimeout(() => { delete S.folding[fk]; renderTodo(); }, D.reduced() ? 0 : 280);
  }, D.reduced() ? 0 : 900);
}
D.SHEETS.task = a => {
  const k = listKey(), g = list(k)[+a.i];
  if (!g) return { title: 'Task', body: '' };
  const other = S.day === 'today' ? 'tomorrow' : 'today';
  return {
    title: g.text,
    body: '<div class="menu-list">' +
      '<button class="menu-item" id="tm-pin" data-act="task-pin" data-i="' + a.i + '">' + ic('pin') + (g.queued ? 'Unpin' : 'Pin to top') + '</button>' +
      (g.later ? '<button class="menu-item" id="tm-now" data-act="task-now" data-i="' + a.i + '">' + ic('up') + 'Bring back to today</button>' : '') +
      '<button class="menu-item" id="tm-move" data-act="task-move" data-i="' + a.i + '">' + ic('arrow') + 'Move to ' + other + '</button>' +
      dateItem('tm-date', 'Move to a date…', k.slice(6)) +
      '<button class="menu-item" id="tm-rep" data-act="sheet" data-sheet="repeat" data-k="' + k + '" data-i="' + a.i + '">' + ic('repeat') + (g.rep && reps().some(r => r.id === g.rep) ? 'Repeats ' + esc(repLabel(reps().find(r => r.id === g.rep))) : 'Repeat…') + '</button>' +
      '<button class="menu-item" id="tm-del" data-act="task-del" data-i="' + a.i + '">' + ic('trash') + 'Delete</button></div>'
  };
};
// a menu row with the phone's own date picker inside it
const dateItem = (id, label, cur) => '<label class="menu-item date-item" for="' + id + '">' + ic('cal') + label + '<input type="date" id="' + id + '" min="' + D.todayKey() + '" value="' + esc(cur || '') + '"></label>';
// a task for a later date (from the "Coming up" list)
D.SHEETS.uptask = a => {
  const g = list(a.k)[+a.i];
  if (!g) return { title: 'Task', body: '' };
  return {
    title: g.text,
    body: '<p class="sheet-note">On your list ' + (D.daysFrom(a.k.slice(6)) <= 6 ? 'on ' : '') + esc(dayLabel(a.k.slice(6))) + '.</p><div class="menu-list">' +
      '<button class="menu-item" id="ut-today" data-act="up-today">' + ic('up') + 'Do it today</button>' +
      dateItem('ut-date', 'Change the date…', a.k.slice(6)) +
      '<button class="menu-item" id="ut-del" data-act="up-del">' + ic('trash') + 'Delete</button></div>'
  };
};
// "this task comes back": every day, school days (Sun–Thu), or one weekday
D.SHEETS.repeat = a => {
  const g = list(a.k)[+a.i];
  if (!g) return { title: 'Repeat', body: '' };
  const r = g.rep && reps().find(x => x.id === g.rep), wd = D.parseDk(a.k.slice(6)).getDay();
  const opt = (every, label) => '<button class="menu-item" data-act="rep-set" data-every="' + every + '" aria-pressed="' + !!(r && r.every === every && (every !== 'week' || r.wd === wd)) + '">' + label + '</button>';
  return {
    title: 'Repeat · ' + g.text,
    body: '<p class="sheet-note">It comes back on your list on those days. Not a calendar: no times, and it won’t pile up. If it’s still on your list, it isn’t added twice.</p>' +
      '<div class="menu-list rep-opts">' + opt('day', 'Every day') + opt('school', 'School days (Sun–Thu)') + opt('week', 'Every ' + D.DOW_L[wd]) + '</div>' +
      (r ? '<button class="btn ghost block" id="rep-stop" data-act="rep-stop">Stop repeating</button>' : '')
  };
};
function moveTo(fromK, i, dk, quiet) {
  const a = list(fromK).slice(), g = a.splice(i, 1)[0];
  if (!g || !dk) return;
  const toK = keyOf(dk), b = list(toK).slice(), moved = Object.assign({}, g, { done: false });
  delete moved.later; delete moved.carriedFrom;
  b.push(moved);
  save(fromK, a); save(toK, b); D.closeSheet(); renderTodo(); renderHeroTiles();
  const off = D.daysFrom(dk), label = off === 0 ? 'today' : off === 1 ? 'tomorrow' : dayLabel(dk);
  if (!quiet) D.toast('Moved to ' + label, () => {
    save(toK, list(toK).filter(x => x !== moved)); const back = list(fromK).slice(); back.splice(i, 0, g); save(fromK, back); renderTodo(); renderHeroTiles();
  });
}
D.SHEETS.older = () => {
  const old = list(todayK()).filter(g => !g.done && isOld(g));
  return {
    title: old.length + ' older ' + D.plural(old.length, 'task', 'tasks'),
    body: '<p class="sheet-note">These were still open from more than a week ago. They stay off today\'s list. Keep them for later, or clear them out.</p>' +
      '<div class="sheet-actions"><button class="btn ghost" id="older-clear" data-act="older-clear">Clear all</button><button class="btn todo" id="older-keep" data-act="older-keep">Keep for later</button></div>' +
      '<div class="menu-list">' + old.map(g => '<div class="menu-item static">' + esc(g.text) + '</div>').join('') + '</div>'
  };
};
Object.assign(D.ACT, {
  'todo-day': el => { S.day = el.dataset.day; renderTodo(); },
  'task-toggle': el => toggle(+el.dataset.i),
  'task-menu': el => D.openSheet('task', { i: el.dataset.i }),
  'toggle-done': () => { S.showDone = !S.showDone; renderTodo(); },
  'toggle-later': () => { S.showLater = !S.showLater; renderTodo(); },
  'task-pin': el => { const k = listKey(), arr = list(k).slice(), i = +el.dataset.i; arr[i] = Object.assign({}, arr[i], { queued: !arr[i].queued }); save(k, arr); D.closeSheet(); renderTodo(); renderHeroTiles(); },
  'task-now': el => { const k = listKey(), arr = list(k).slice(), i = +el.dataset.i, g = Object.assign({}, arr[i]); delete g.later; delete g.carriedFrom; arr[i] = g; save(k, arr); D.closeSheet(); renderTodo(); renderHeroTiles(); },
  'task-move': el => {
    const from = listKey(), to = S.day === 'today' ? tomorrowK() : todayK(), i = +el.dataset.i;
    const a = list(from).slice(), g = a.splice(i, 1)[0], b = list(to).slice();
    if (!g) return;
    b.push(Object.assign({}, g, { done: false }));
    save(from, a); save(to, b); D.closeSheet(); renderTodo(); renderHeroTiles();
    D.toast('Moved to ' + (to === tomorrowK() ? 'tomorrow' : 'today'), () => { save(from, list(from).slice(0, i).concat([g], list(from).slice(i))); save(to, list(to).filter(x => x !== b[b.length - 1])); renderTodo(); renderHeroTiles(); });
  },
  'task-del': el => {
    const k = listKey(), i = +el.dataset.i, arr = list(k).slice(), g = arr.splice(i, 1)[0];
    if (!g) return;
    save(k, arr); D.closeSheet(); renderTodo(); renderHeroTiles();
    D.toast('Deleted “' + g.text + '”', () => { const a = list(k).slice(); a.splice(i, 0, g); save(k, a); renderTodo(); renderHeroTiles(); });
  },
  'toggle-up': () => { S.showUp = !S.showUp; renderTodo(); },
  'up-menu': el => D.openSheet('uptask', { k: el.dataset.k, i: el.dataset.i }),
  'up-today': () => { const a = D.sheetArg(); moveTo(a.k, +a.i, D.todayKey()); },
  'up-del': () => {
    const a = D.sheetArg(), arr = list(a.k).slice(), g = arr.splice(+a.i, 1)[0]; if (!g) return;
    save(a.k, arr); D.closeSheet(); renderTodo();
    D.toast('Deleted “' + g.text + '”', () => { const b = list(a.k).slice(); b.splice(+a.i, 0, g); save(a.k, b); renderTodo(); });
  },
  'todo-date': () => { const inp = $('#todo-date-in'); try { if (inp.showPicker) inp.showPicker(); else inp.click(); } catch (e) { inp.click(); } },
  'when-clear': () => { S.when = null; S.noParse = $('#todo-input').value; renderWhen(); $('#todo-input').focus(); },
  'rep-set': el => {
    const a = D.sheetArg(), arr = list(a.k).slice(), g = arr[+a.i]; if (!g) return;
    const wd = D.parseDk(a.k.slice(6)).getDay(), all = list('repeats').slice(), now = Date.now();
    let r = g.rep && all.find(x => x.id === g.rep && !x.deleted);
    if (r) { r = Object.assign({}, r, { every: el.dataset.every, wd, at: now }); all[all.findIndex(x => x.id === r.id)] = r; }
    else { r = { id: now.toString(36) + Math.random().toString(36).slice(2, 6), text: g.text, every: el.dataset.every, wd, from: a.k.slice(6), added: [a.k.slice(6)], at: now }; all.push(r); arr[+a.i] = Object.assign({}, g, { rep: r.id }); save(a.k, arr); }
    save('repeats', all); placeRepeats();
    D.closeSheet(); renderTodo();
    D.toast('Repeats ' + repLabel(r));
  },
  'rep-stop': () => {
    const a = D.sheetArg(), arr = list(a.k).slice(), g = arr[+a.i]; if (!g || !g.rep) return;
    save('repeats', list('repeats').map(x => x.id === g.rep ? Object.assign({}, x, { deleted: true, at: Date.now() }) : x));
    const c = Object.assign({}, g); delete c.rep; arr[+a.i] = c; save(a.k, arr);
    D.closeSheet(); renderTodo(); D.toast('Won’t repeat any more. This one stays on your list.');
  },
  'older-review': () => D.openSheet('older'),
  'older-keep': () => {
    const k = todayK(), before = list(k), arr = before.map(g => (!g.done && isOld(g)) ? Object.assign({}, g, { later: true }) : g);
    const n = before.filter(g => !g.done && isOld(g)).length;
    save(k, arr); D.closeSheet(); renderTodo();
    D.toast('Moved ' + n + ' ' + D.plural(n, 'task', 'tasks') + ' to Later', () => { save(k, before); renderTodo(); });
  },
  'older-clear': () => {
    const k = todayK(), before = list(k), arr = before.filter(g => g.done || !isOld(g));
    const n = before.length - arr.length;
    save(k, arr); D.closeSheet(); renderTodo();
    D.toast('Cleared ' + n + ' older ' + D.plural(n, 'task', 'tasks'), () => { save(k, before); renderTodo(); renderHeroTiles(); });
  }
});
D.LP['task-menu'] = el => D.openSheet('task', { i: el.dataset.i });

// What you're about to add: for which day? (the date button wins over a typed date)
function whenFor(v) {
  if (S.when) return { text: v, dk: S.when, picked: true };
  if (S.noParse === v) return null;
  return parseWhen(v);
}
function renderWhen() {
  const el = $('#todo-when'), v = $('#todo-input').value.trim(), w = v || S.when ? whenFor(v) : null;
  const plain = w && ((S.day === 'today' && w.dk === D.todayKey()) || (S.day === 'tomorrow' && w.dk === D.dk(D.dayAt(1))));
  if (!w || plain) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<span class="when-chip">' + ic('cal', 'xs') + 'For ' + esc(dayLabel(w.dk)) + (D.daysFrom(w.dk) > 6 ? '' : ' · ' + esc(D.dShort(D.parseDk(w.dk)))) + '</span>' +
    (w.text && !w.picked && w.text !== v ? '<span class="when-text">“' + esc(w.text) + '”</span>' : '') +
    '<button type="button" class="when-x" data-act="when-clear" aria-label="No date">' + ic('x', 'xs') + '</button>';
}
// the date pickers inside the task menus
document.addEventListener('change', e => {
  const id = e.target && e.target.id, a = D.sheetArg();
  if (!e.target.value || !a) return;
  if (id === 'tm-date') moveTo(listKey(), +a.i, e.target.value);
  if (id === 'ut-date') moveTo(a.k, +a.i, e.target.value);
});
$('#todo-input').addEventListener('input', () => { if (S.noParse && S.noParse !== $('#todo-input').value) S.noParse = null; renderWhen(); });
$('#todo-date-in').addEventListener('change', e => { S.when = e.target.value || null; S.noParse = null; renderWhen(); $('#todo-input').focus(); });
$('#todo-form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#todo-input'), v = inp.value.trim();
  if (!v) return;
  const w = whenFor(v), text = w ? w.text : v;
  const k = w ? keyOf(w.dk) : listKey(), arr = list(k).slice();
  arr.push({ text, done: false });
  save(k, arr);
  S.when = null; S.noParse = null; $('#todo-date-in').value = '';
  inp.value = ''; inp.focus(); renderWhen();
  if (k === listKey()) { S.enter = k + '#' + (arr.length - 1); renderTodo(); S.enter = null; }
  else {
    renderTodo();
    D.toast('Added for ' + dayLabel(w.dk), () => { save(k, list(k).filter((x, j) => j !== arr.length - 1)); renderTodo(); renderHeroTiles(); });
  }
  renderHeroTiles();
});

/* ---------- boot ---------- */
let rolled = false, lastDay = D.todayKey();
dash.on(() => { if (!rolled) { rolled = true; rollover(); placeRepeats(); } renderTodo(); renderHeroTiles(); });
[school, gym, food].forEach(r => r.on(renderHeroTiles));
if (TT) {
  // the trip follows the class timetable (first lesson, last lesson, cancelled hours)
  if (window.COMMUTE) window.COMMUTE.setDayTimes(dk => TT.dayTimes(dk, TT.settings(school)));
  const ttLoad = () => { const s = TT.settings(school); if (s.cls && !document.hidden) TT.load(s.cls).then(renderHeroTiles); };
  TT.onChange(renderHeroTiles);
  school.on(ttLoad);
  document.addEventListener('visibilitychange', ttLoad);
  setInterval(ttLoad, 5 * 60e3);
  ttLoad();
}
if (window.COMMUTE) {
  const CMx = window.COMMUTE;
  // keep the trip card live while it matters (before leaving and on the way home)
  const liveTick = () => { const c = CMx.rail() ? CMx.cfg(school) : null, p = c ? CMx.phase(c) : null; if (!document.hidden && p && (p.kind === 'morning' || p.kind === 'after')) CMx.fetchLive(CMx.watchStops(c, p)).then(renderHeroTiles); };
  CMx.load().then(() => { renderHeroTiles(); liveTick(); });
  setInterval(liveTick, 30000);
  document.addEventListener('visibilitychange', liveTick);
}
D.settings.on(renderHeader);
D.onWater(() => { renderWater(); if (D.sheetKind() === 'water') D.renderSheet(); });
window.addEventListener('dash:name', renderHeader);
setInterval(() => {
  if (D.todayKey() !== lastDay) { lastDay = D.todayKey(); rolled = false; rollover(); placeRepeats(); rolled = true; renderAll(); }
  else { renderHeader(); renderHeroTiles(); }
}, 60000);

renderAll();
D.boot('today').then(ok => { if (ok && D.DEMO) { rolled = true; renderAll(); } });
})();
