/* Dashboard v3 — Today screen. Reads/writes the SAME data as the classic pages:
   uid:dashboard  goals:YYYY-MM-DD = [{text, done, queued?, carriedFrom?, later?}]
   uid:school     dashboard:school:v1:{subjects,assignments,tests}   (read)
   uid:po-coach   dashboard:gym:v1:{template,logs}                  (read)
   uid:food       days[YYYY-MM-DD].entries[].nutrients.kcal, custom.kcal (read) */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic;
const SYNC_LS = 'dashboard:sync:v1';

/* ---------- rows ---------- */
const dash = D.Row('dashboard', {
  seed: d => { const b = D.readJSON(SYNC_LS); if (b && typeof b === 'object') Object.keys(b).forEach(k => { if (k !== '_localAt' && !(k in d)) d[k] = b[k]; }); },
  // keep the classic home page's local mirror in step, so switching back never shows stale lists
  onLocal: (k, v) => { const b = D.readJSON(SYNC_LS) || {}; b[k] = v; b._localAt = Date.now(); D.writeJSON(SYNC_LS, b); },
  afterPush: at => { const b = D.readJSON(SYNC_LS) || {}; b._localAt = at; D.writeJSON(SYNC_LS, b); },
  onRemote: data => { const b = D.readJSON(SYNC_LS) || {}; Object.keys(data).forEach(k => { if (k !== '_pushAt') b[k] = data[k]; }); b._localAt = data._pushAt || b._localAt || 0; D.writeJSON(SYNC_LS, b); }
});
const school = D.Row('school', { readOnly: true });
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
  return out.sort((a, b) => a.d - b.d || (a.kind === 'test' ? -1 : 1));
}
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
  const custom = food.get('custom') || {}, worked = D.readJSON('dash3:food:targets') || {};
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
  if (lvw) { ph.mins = lvw.mins; }
  if (ph && ph.kind === 'morning' && ph.pick && ph.mins != null && ph.mins <= 120 && ph.mins >= -15) {
    const late = !ph.pick.ok || (lvw && lvw.miss);
    return { area: ph.mins <= 5 || late ? 'amber' : 'school', href: D.pageHref('school'), eyebrow: 'To school',
      big: ph.mins > 0 ? '<span class="lead">Leave in</span><span class="n">' + D.numEl('hero-min', ph.mins) + '</span><span class="u">min</span>' : '<span class="t">Leave now</span>',
      sub: (lvw && lvw.miss ? 'Bus is late · may miss the ' + CM.hhmm(ph.pick.train) + ' train' : CM.hhmm(lvw ? lvw.leave : ph.pick.leave) + ' · ' + (ph.pick.bus ? 'bus ' + esc(ph.pick.bus.line) + ' → ' : '') + CM.hhmm(ph.pick.train) + ' train' + (!ph.pick.ok ? ' · arrives ' + (-ph.pick.spare) + ' min late' : '')) + ' <span class="tag">' + (lvw && lvw.anyLive ? 'Live' : 'Timetable') + '</span>',
      bar: D.clamp(ph.mins / 30, 0, 1), label: 'Leave in ' + ph.mins + ' minutes' };
  }
  if (ph && ph.kind === 'after' && ph.pick) {
    return { area: ph.mins <= 5 && ph.mins >= 0 ? 'amber' : 'school', href: D.pageHref('school'), eyebrow: 'Going home',
      big: '<span class="lead">Train home</span><span class="n">' + CM.hhmm(ph.pick.train) + '</span>',
      sub: 'Leave school by ' + CM.hhmm(lvw ? lvw.leave : ph.pick.leave) + (ph.mins > 0 ? ' · in ' + ph.mins + ' min' : ' · now') + ' <span class="tag">' + (lvw && lvw.anyLive ? 'Live' : 'Timetable') + '</span>',
      bar: D.clamp(ph.mins / 30, 0, 1), label: 'Train home ' + CM.hhmm(ph.pick.train) };
  }
  const soon = schoolSoon(2);
  const test = soon.find(x => x.kind === 'test');
  if (test) return { area: 'school', href: D.pageHref('school'), eyebrow: 'Coming up', big: '<span class="t">' + esc(test.title) + '</span>', sub: dayWord(test.d) + (test.subj ? ' · ' + esc(test.subj) : ''), label: test.title + ', ' + dayWord(test.d) };
  const due = soon.filter(x => x.kind === 'hw' && x.d <= 1);
  if (due.length) return { area: 'school', href: D.pageHref('school'), eyebrow: 'Due ' + dayWord(due[0].d).toLowerCase(), big: '<span class="t">' + esc(due[0].title) + '</span>', sub: (due[0].subj ? esc(due[0].subj) : 'School') + (due.length > 1 ? ' · ' + (due.length - 1) + ' more' : ''), label: due[0].title + ' due ' + dayWord(due[0].d) };
  if (n >= 19 * 60) {
    const tm = list(tomorrowK()).filter(g => !g.done);
    if (ph && ph.kind === 'next' && ph.off === 1 && ph.m && ph.m.best) {
      return { area: 'school', href: D.pageHref('school'), eyebrow: 'Tomorrow · ' + D.dShort(D.dayAt(1)), big: '<span class="lead">Leave</span><span class="n">' + CM.hhmm(ph.m.best.leave) + '</span>',
        sub: CM.hhmm(ph.m.best.train) + ' train' + (tm.length ? ' · ' + tm.length + ' on your list' : ''), label: 'Tomorrow, leave ' + CM.hhmm(ph.m.best.leave) };
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
    out.push(w.length ? { area: 'school', href: D.pageHref('school'), label: 'School', p: 0, val: D.numEl('tile-school', w.length) + '<small>due</small>', sub: esc(w[0].title) + ' · ' + D.DOW[D.dayAt(w[0].d).getDay()] }
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
  const meta = g.carriedFrom && !isOld(g) ? '<span class="task-meta"><span class="chip-s carry">' + ic('repeat', 'xs') + 'from ' + D.DOW[D.parseDk(g.carriedFrom).getDay()] + '</span></span>' : '';
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
      '<button class="menu-item" id="tm-del" data-act="task-del" data-i="' + a.i + '">' + ic('trash') + 'Delete</button></div>'
  };
};
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

$('#todo-form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#todo-input'), v = inp.value.trim();
  if (!v) return;
  const k = listKey(), arr = list(k).slice();
  arr.push({ text: v, done: false });
  save(k, arr);
  S.enter = k + '#' + (arr.length - 1);
  inp.value = ''; inp.focus();
  renderTodo(); S.enter = null; renderHeroTiles();
});

/* ---------- boot ---------- */
let rolled = false, lastDay = D.todayKey();
dash.on(() => { if (!rolled) { rolled = true; rollover(); } renderTodo(); renderHeroTiles(); });
[school, gym, food].forEach(r => r.on(renderHeroTiles));
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
  if (D.todayKey() !== lastDay) { lastDay = D.todayKey(); rolled = false; rollover(); rolled = true; renderAll(); }
  else { renderHeader(); renderHeroTiles(); }
}, 60000);

renderAll();
D.boot('today').then(ok => { if (ok && D.DEMO) { rolled = true; renderAll(); } });
})();
