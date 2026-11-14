/* Dashboard v3 — Week: your own weekly plan, as a colour grid plus Now / Next.
   Off for everyone. You turn it on for your own account once, by opening
   /v3/week.html?on (?off turns it off again). It lives only in your synced settings row
   (uid:settings), never in the code, because the repo and the site are public:
     weekOn    true → the Week tab, and Now / Next on Today's big card
     weekText  the plan as plain text, edited in the "Edit week" sheet:
                 Sun
                 07:00 wake
                 07:30-08:00 commute Bus → train
                 08:00-14:00 school
                 19:00 food Dinner       ← no end time: until the next line (or an hour)
               Types: school commute gym vb frc study food free. A few other words work
               too (bus, eat, volleyball, robotics, home, shabbat…); anything else is free.
   Loaded on Today (window.WEEK, for the big card) and on week.html (the page). */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic;
const GRID_FROM = 6 * 60, GRID_TO = 23 * 60;
const TYPES = ['school', 'commute', 'gym', 'vb', 'frc', 'study', 'food', 'routine', 'free', 'sleep'];
const TNAME = { school: 'School', commute: 'Commute', gym: 'Gym', vb: 'VB', frc: 'FRC', study: 'Study', food: 'Food', routine: 'Routine', free: 'Free', sleep: 'Sleep', wake: 'Wake up' };
const ALIAS = { bus: 'commute', train: 'commute', travel: 'commute', walk: 'commute', eat: 'food', meal: 'food', lunch: 'food', dinner: 'food', breakfast: 'food',
  volleyball: 'vb', robotics: 'frc', homework: 'study', hw: 'study', home: 'free', rest: 'free', shabbat: 'free', workout: 'gym', wake: 'wake', class: 'school',
  shower: 'routine', stretch: 'routine', morning: 'routine', bed: 'sleep' };
const DAYW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
const EXAMPLE = 'Sun\n07:00 wake\n07:30-08:00 commute Bus → train\n08:00-14:00 school\n15:00-16:30 gym Push day\n19:00 food Dinner\n19:30-20:30 study\n\nMon\n07:30-08:00 commute\n08:00-14:30 school';
const DEMO_TEXT = 'Sun\n06:30-07:00 routine Wake + get ready\n07:00-07:15 food Breakfast\n07:15-07:45 commute Bus\n07:45-08:05 commute Train\n08:05-08:15 commute Walk\n08:15-14:30 school\n14:30-14:40 commute Walk to gym\n14:40-16:00 gym Push day\n16:00-16:45 commute Train + bus home\n17:00-19:00 free\n19:00-19:20 food Dinner\n19:30-20:30 study Math\n21:30-21:45 routine Shower\n22:00-23:00 sleep\nMon\n06:45-07:15 routine Wake + get ready\n07:30-08:15 commute Bus + train\n08:15-15:20 school\n15:30-18:00 frc\n18:15-19:00 commute Home\n19:15-19:30 food Dinner\n22:30-23:00 sleep\nTue\n07:30-08:15 commute\n08:15-14:00 school\n18:00-20:00 vb Practice\nWed\n08:15-14:30 school\n14:40-16:00 gym Pull day\nThu\n08:15-14:30 school\n16:00-18:00 frc\nFri\n09:00-09:30 routine Wake up slowly\n10:00-12:00 vb Game\nSat\n10:00-18:00 free Friends';

/* ---------- the plan ---------- */
function dayOf(line) {
  const w = line.toLowerCase().replace(/[:.,]$/, '').replace(/^יום\s+/, '');
  if (DAYW[w] != null) return DAYW[w];
  const en = w.slice(0, 3);
  return /^[a-z]+$/.test(w) && DAYW[en] != null && 'sunday monday tuesday wednesday thursday friday saturday'.indexOf(w) >= 0 ? DAYW[en] : null;
}
function parse(text) {
  const days = [[], [], [], [], [], [], []], bad = [];
  let wd = null;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = line.match(/^~?(\d{1,2})[:.](\d{2})(?:\s*[-–—]\s*~?(\d{1,2})[:.](\d{2}))?\s*(.*)$/);
    if (!m) { const d = dayOf(line); if (d != null) wd = d; else bad.push(i + 1); return; }
    if (wd == null) { bad.push(i + 1); return; }
    const s = +m[1] * 60 + +m[2], e = m[3] != null ? +m[3] * 60 + +m[4] : null;
    if (s >= 1440 || (e != null && e > 1440)) { bad.push(i + 1); return; }
    const words = m[5].split(/\s+/).filter(Boolean), k = (words[0] || '').toLowerCase();
    let type = TYPES.indexOf(k) >= 0 ? k : ALIAS[k] || null;
    const title = type ? words.slice(1).join(' ') : m[5];
    days[wd].push({ s, e, type: type || 'free', title, line: i + 1 });
  });
  days.forEach(list => {
    list.sort((a, b) => a.s - b.s);
    list.forEach((it, j) => {
      if (it.type === 'wake') { it.e = it.s; return; }
      if (it.e == null || it.e <= it.s) { const nx = list.slice(j + 1).find(x => x.s > it.s); it.e = nx ? nx.s : Math.min(it.s + 60, 1440); }
    });
  });
  return { days, bad };
}

const on = () => !!(D.DEMO ? /week/.test(location.pathname) : D.settings.get('weekOn'));
let demoEdit = null; // ?demo: edits stay on this page only
const text = () => D.DEMO ? (demoEdit != null ? demoEdit : DEMO_TEXT) : String(D.settings.get('weekText') || '');
let memo = { t: null, v: null };
const plan = () => { const t = text(); if (memo.t !== t) memo = { t, v: parse(t) }; return memo.v; };
const has = () => plan().days.some(l => l.length);
// what you wrote; gym, FRC and VB keep their name in front ("Gym Push day", "FRC (optional)")
const TAGGED = { gym: 1, frc: 1, vb: 1 };
const name = x => x.way ? 'On the way' : !x.title ? esc(TNAME[x.type]) : (TAGGED[x.type] && x.title.toLowerCase().indexOf(TNAME[x.type].toLowerCase()) < 0 ? esc(TNAME[x.type]) + ' ' : '') + '<bdi>' + esc(x.title) + '</bdi>';
const inTxt = m => m < 60 ? 'in ' + m + ' min' : 'in ' + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
const dayWord = off => off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(off).getDay()];

// Bus, wait, train, walk in a row are one trip ("On the way · until 07:51"), not four things.
function chainEnd(list, x) {
  let e = x.e;
  for (const y of list) if (y.type === 'commute' && y.s >= x.s && y.s <= e + 10) e = Math.max(e, y.e);
  return e;
}
// What you're doing now and what's next (next may be on a later day).
function nowNext() {
  const days = plan().days, wd = D.dayAt(0).getDay(), n = D.nowMin();
  let cur = days[wd].filter(x => x.type !== 'wake' && x.s <= n && n < x.e).pop() || null;
  if (cur && cur.type === 'commute') cur = { s: cur.s, e: chainEnd(days[wd], cur), type: 'commute', title: 'On the way', way: true };
  for (let off = 0; off < 8; off++) {
    const next = days[(wd + off) % 7].find(x => off > 0 || (x.s >= (cur ? cur.e : n + 1) && x !== cur));
    if (next) return { cur, next: next.type === 'commute' && off === 0 ? { s: next.s, e: chainEnd(days[wd], next), type: 'commute', title: 'On the way', way: true } : next, off, n };
  }
  return { cur, next: null, off: null, n };
}
const AREA = { gym: 'gym', school: 'school', commute: 'school', study: 'school' };
// Today's big card: Now / Next. today.js adds the bus/train line under it.
function hero() {
  if (!on() || !has()) return null;
  const { cur, next, off, n } = nowNext();
  const lead = (cur || next) ? (cur || next).type : 'free';
  return {
    area: AREA[lead] || 'todo', href: D.pageHref('week'),
    eyebrow: cur ? 'Now · ' + name(cur) + ' · until ' + D.hhmm(cur.e) : next && off === 0 ? 'Free now' : 'Next',
    big: next ? '<span class="lead">' + (off === 0 ? 'Next' : dayWord(off)) + '</span><span class="t">' + name(next) + '</span>' : '<span class="t">Nothing planned</span>',
    sub: next ? D.hhmm(next.s) + (off === 0 ? ' · ' + inTxt(next.s - n) : '') : '',
    bar: cur && cur.e > cur.s ? D.clamp((n - cur.s) / (cur.e - cur.s), 0, 1) : null,
    label: (cur ? 'Now ' + (cur.title || TNAME[cur.type]) + '. ' : '') + (next ? 'Next ' + (next.title || TNAME[next.type]) + ' at ' + D.hhmm(next.s) : '')
  };
}
// Gym / FRC / VB straight after school (each starting within 30 min of the last): the trip
// home starts when they end. commute.js asks this for the day's leaving time.
const AFTER = { gym: 1, frc: 1, vb: 1 };
function afterSchool(wd, end) {
  if (!on() || !has()) return null;
  const list = plan().days[wd], sch = list.find(x => x.type === 'school');
  if (sch && sch.e > end && sch.e - end <= 90) end = sch.e; // your week says school runs later than the timetable's last lesson
  let t = end, what = null;
  for (const x of list) {
    if (x.s < end) continue; // school itself and the morning
    if (x.s - t > 30) break; // a gap: you're home by then
    if (x.type === 'commute' && x.e - x.s <= 15) continue; // "walk to gym": look past it
    if (!AFTER[x.type]) break; // home / food / free, or the long ride home
    t = Math.max(t, x.e); what = TNAME[x.type];
  }
  return what ? { end: t, what } : null;
}
window.WEEK = { parse, on, has, nowNext, hero, afterSchool, TYPES, TNAME };

/* ---------- the page ---------- */
const view = $('#view-week');
if (!view) return;
// the trip planner and the class timetable, for the details of a bus or school block
const schoolRow = D.Row('school', { readOnly: true });
const C = window.COMMUTE, TT = window.TIMETABLE;
if (C) { C.useRow(schoolRow); if (TT) C.setDayTimes(dk => TT.dayTimes(dk, TT.settings(schoolRow))); }
const S = { day: D.dayAt(0).getDay(), mode: matchMedia('(min-width: 900px)').matches ? 'week' : 'day' };
const hh = D.hhmm, EN_DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dur = m => m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
const offOf = wd => ((wd - D.dayAt(0).getDay()) + 7) % 7; // days from today to that weekday
const dkOf = wd => D.dk(D.dayAt(offOf(wd)));
// the grid's hours: from your earliest start to your latest end (at least 06:00–23:00)
const range = () => { const all = plan().days.flat().filter(x => x.type !== 'wake'); return [Math.min(GRID_FROM, Math.floor(Math.min.apply(null, all.map(x => x.s).concat([GRID_FROM])) / 60) * 60), Math.max(GRID_TO, Math.min(1440, Math.ceil(Math.max.apply(null, all.map(x => x.e).concat([GRID_TO])) / 60) * 60))]; };
let R = [GRID_FROM, GRID_TO];
const y = m => ((Math.max(R[0], Math.min(R[1], m)) - R[0]) / (R[1] - R[0]) * 100).toFixed(2) + '%';

function renderNow() {
  const el = $('#wk-now');
  if (!has()) { el.innerHTML = ''; return; }
  const { cur, next, off, n } = nowNext();
  el.innerHTML = '<div class="wk-strip" data-t="' + (cur ? cur.type : 'free') + '">' +
    '<div><span class="k">Now</span><b>' + (cur ? name(cur) : esc('Free')) + '</b>' + (cur ? '<span class="v">until ' + hh(cur.e) + '</span>' : '') + '</div>' +
    '<div><span class="k">Next</span><b>' + (next ? name(next) : '–') + '</b>' + (next ? '<span class="v">' + (off === 0 ? hh(next.s) + ' · ' + inTxt(next.s - n) : dayWord(off) + ' ' + hh(next.s)) + '</span>' : '') + '</div></div>';
}
// One day at a glance: wake, leave, school, home, sleep.
function glance(list) {
  const real = list.filter(x => x.type !== 'wake'), sch = real.find(x => x.type === 'school');
  const leave = sch && real.find(x => x.type === 'commute' && x.s < sch.s);
  const ride = real.filter(x => x.type === 'commute' && x.e - x.s >= 20 && (!sch || x.s >= sch.e)).pop(); // the long ride home
  const sleep = real.find(x => x.type === 'sleep'), wake = list[0];
  const parts = [['sun', 'Wake', wake && wake.type !== 'sleep' ? wake.s : null], ['bus', 'Leave', leave ? leave.s : null], ['school', 'School', sch ? sch.s : null],
    ['home', 'Home', ride ? ride.e : null], ['clock', 'Sleep', sleep ? sleep.s : null]].filter(p => p[2] != null);
  return parts.length < 2 ? '' : '<div class="wk-glance">' + parts.map(p => '<span>' + ic(p[0], 'xs') + '<small>' + p[1] + '</small><b>' + hh(p[2]) + '</b></span>').join('') + '</div>';
}
// The day, top to bottom: every block shows its times; longer things are taller.
function timeline(wd) {
  const list = plan().days[wd], isToday = offOf(wd) === 0, n = D.nowMin();
  if (!list.length) return '<p class="sheet-note wk-none">Nothing planned for ' + esc(D.DOW_L[wd]) + '.</p>';
  let h = '<ol class="tl">', lastEnd = null;
  list.forEach((x, i) => {
    if (x.type === 'wake') { h += '<li class="tl-mark"><span class="tl-t">' + hh(x.s) + '</span><span>' + ic('sun', 'xs') + name(x) + '</span></li>'; return; }
    const gap = lastEnd == null ? 0 : x.s - lastEnd;
    if (gap >= 20) h += '<li class="tl-gap"><span>' + esc(dur(gap)) + ' open</span></li>';
    const d = x.e - x.s, now = isToday && x.s <= n && n < x.e, past = isToday && x.e <= n;
    h += '<li class="tl-it' + (now ? ' now' : past ? ' past' : '') + (lastEnd != null && x.s < lastEnd ? ' ov' : '') + '" data-t="' + x.type + '" style="--h:' + Math.round(D.clamp(d * 1.2, 40, 210)) + 'px">' +
      '<span class="tl-t">' + hh(x.s) + '</span><button class="tl-b" id="tl-' + wd + '-' + i + '" data-act="wk-item" data-d="' + wd + '" data-i="' + i + '">' +
      '<b>' + name(x) + '</b><span class="tl-r">' + hh(x.s) + '–' + hh(x.e) + ' · ' + esc(dur(d)) + '</span>' +
      (now ? '<span class="tl-now" style="top:' + ((n - x.s) / d * 100).toFixed(1) + '%"></span>' : '') + '</button></li>';
    lastEnd = Math.max(lastEnd || 0, x.e);
  });
  return h + '</ol>';
}
function grid() {
  const days = plan().days, today = D.dayAt(0).getDay(), n = D.nowMin();
  R = range();
  let h = '<div class="wk-head"><span></span>' + D.DOW.map((d, i) => '<button class="wk-dh' + (i === today ? ' today' : '') + '" data-act="wk-open-day" data-d="' + i + '">' + esc(d) + '</button>').join('') + '</div><div class="wk-body"><div class="wk-axis">';
  for (let m = R[0] + 60; m < R[1]; m += 120) h += '<span style="top:' + y(m) + '">' + hh(m) + '</span>';
  h += '</div>';
  days.forEach((list, wd) => {
    h += '<div class="wk-col' + (wd === today ? ' today' : '') + '">';
    list.forEach((x, i) => {
      if (x.type === 'wake' || x.e <= R[0] || x.s >= R[1]) return;
      h += '<button class="wk-b" data-t="' + x.type + '" data-act="wk-item" data-d="' + wd + '" data-i="' + i + '" style="top:' + y(x.s) + ';height:calc(' + y(x.e) + ' - ' + y(x.s) + ')" aria-label="' + esc((x.title || TNAME[x.type]) + ', ' + hh(x.s) + '–' + hh(x.e)) + '"><span class="wk-bt">' + name(x) + '<small>' + hh(x.s) + '–' + hh(x.e) + '</small></span></button>';
    });
    if (wd === today && n >= R[0] && n <= R[1]) h += '<span class="wk-now-line" style="top:' + y(n) + '"></span>';
    h += '</div>';
  });
  const used = TYPES.filter(t => days.some(l => l.some(x => x.type === t)));
  return h + '</div><div class="wk-legend">' + used.map(t => '<span><i data-t="' + t + '"></i>' + esc(TNAME[t]) + '</span>').join('') + '</div><p class="sheet-note wk-hint">Tap any block for its times and details.</p>';
}
function renderGrid() {
  const el = $('#wk-grid');
  if (!has()) {
    el.innerHTML = '<div class="card wk-empty"><h2 class="card-title">Your week is empty</h2><p class="sheet-note">Write it once, as plain text: a day, then one line per thing. Only your account can see it.</p>' +
      '<button class="btn school block" id="wk-start" data-act="sheet" data-sheet="weekedit">' + ic('edit', 'sm') + 'Write my week</button></div>';
    return;
  }
  const seg = '<div class="seg sm wk-mode" role="tablist" aria-label="Show">' + [['day', 'Day'], ['week', 'Week']].map(m => '<button id="wm-' + m[0] + '" role="tab" data-act="wk-mode" data-v="' + m[0] + '" aria-selected="' + (S.mode === m[0]) + '" aria-checked="' + (S.mode === m[0]) + '">' + m[1] + '</button>').join('') + '</div>';
  if (S.mode === 'week') { el.innerHTML = '<section class="card wk-card"><div class="wk-bar">' + seg + '</div>' + grid() + '</section>'; return; }
  const chips = [0, 1, 2, 3, 4, 5, 6].map(o => { const d = D.dayAt(o), wd = d.getDay(); return '<button class="wk-chip' + (wd === S.day ? ' on' : '') + '" id="wd-' + wd + '" data-act="wk-day" data-d="' + wd + '" aria-pressed="' + (wd === S.day) + '"><small>' + esc(o === 0 ? 'Today' : D.DOW[wd]) + '</small><b>' + d.getDate() + '</b></button>'; }).join('');
  const list = plan().days[S.day];
  el.innerHTML = '<section class="card wk-card"><div class="wk-bar">' + seg + '<button class="icon-btn flat" id="wk-add" data-act="wk-add" aria-label="Add to ' + esc(D.DOW_L[S.day]) + '">' + ic('plus') + '</button></div>' +
    '<div class="wk-chips">' + chips + '</div>' + glance(list) + timeline(S.day) +
    '<a class="wk-link" href="https://handasaim.co.il/schedule" target="_blank" rel="noopener">' + ic('school', 'xs') + 'Check today’s school schedule' + ic('go', 'xs') + '</a></section>';
}
function render() {
  $('#week-date').textContent = D.dLong(D.dayAt(0));
  renderNow(); renderGrid(); $('#wk-day').innerHTML = '';
  D.animate(view);
}

/* ---------- one block: details, and change it right there ---------- */
const ctxRow = (icon, b, s) => '<div class="wi-ctx">' + ic(icon, 'sm') + '<span><b>' + b + '</b>' + (s ? '<small>' + s + '</small>' : '') + '</span></div>';
function context(x, wd) {
  const dk = dkOf(wd), when = offOf(wd) === 0 ? 'today' : offOf(wd) === 1 ? 'tomorrow' : D.DOW_L[wd];
  let h = '';
  const c = C && C.rail() ? C.cfg(schoolRow) : null;
  if (x.type === 'commute' && c && C.isSchoolDay(c, wd, dk)) {
    if (x.s < 12 * 60) { const m = C.morning(c, wd, dk), p = m && m.pick; if (p) h += ctxRow('bus', 'The app’s plan ' + esc(when) + ': leave ' + hh(p.leave), (p.bus ? 'bus ' + esc(p.bus.line) + ' ' + hh(p.bus.at) + ' → ' : '') + hh(p.train) + ' train · at school ' + hh(p.arrive)); }
    else { const af = C.afternoon(c, wd, dk), p = af && af.pick; if (p) h += ctxRow('train', 'The app’s plan ' + esc(when) + ': leave ' + hh(p.leave), hh(p.train) + ' train · home about ' + hh(p.home)); }
    if (h) h += '<a class="wk-link" href="' + D.pageHref('school') + '">' + ic('bus', 'xs') + 'Open the trip, with live times' + ic('go', 'xs') + '</a>';
  }
  if (x.type === 'school' && TT) {
    const st = TT.settings(schoolRow), v = st.cls ? TT.day(dk, st) : null;
    const per = v ? v.periods.filter(p => p.items.length || p.status === 'cancelled') : [];
    if (per.length) h += '<p class="group-title">Lessons ' + esc(when) + (v.published ? '' : ' · weekly plan') + '</p><ul class="wi-lessons">' + per.map(p =>
      '<li class="' + (p.status === 'cancelled' ? 'off' : p.status === 'changed' || p.status === 'added' ? 'chg' : '') + '"><span>' + esc(String(p.n)) + '</span><span>' + esc(p.start || '') + '</span><bdi>' + esc((p.status === 'cancelled' ? (p.was || []).join(', ') : p.items.map(e => e.subject).join(' · ')) || '') + '</bdi></li>').join('') + '</ul>';
  }
  return h;
}
const step = (k, v) => '<div class="wi-step"><small>' + (k === 's' ? 'Starts' : 'Ends') + '</small><div><button class="step-btn" id="wi-' + k + 'm" data-act="wi-t" data-k="' + k + '" data-d="-5" aria-label="5 minutes earlier">−</button><b>' + hh(v) + '</b><button class="step-btn" id="wi-' + k + 'p" data-act="wi-t" data-k="' + k + '" data-d="5" aria-label="5 minutes later">+</button></div></div>';
D.SHEETS.wkitem = a => {
  const list = plan().days[+a.d] || [], x = a.add ? null : list[+a.i];
  if (!a.add && !x) return { title: 'Week', body: '<p class="sheet-note">This changed in the meantime. Close and tap it again.</p>' };
  if (a.s == null) {
    const n = D.nowMin(), soon = Math.ceil((n + 1) / 30) * 30; // today: the next half hour; another day: 17:00
    a.s = x ? x.s : offOf(+a.d) === 0 && soon <= 22 * 60 ? soon : 17 * 60; a.e = x ? Math.max(x.e, x.s + 5) : Math.min(a.s + 60, 23 * 60 + 55);
    a.type = x ? (x.type === 'wake' ? 'routine' : x.type) : 'free'; a.title = x ? (x.title || '') : ''; a.edit = !!a.add;
  }
  let h = '';
  if (x) {
    const k = list.indexOf(x), prev = list.slice(0, k).filter(z => z.type !== 'wake').pop(), next = list.slice(k + 1).find(z => z.type !== 'wake');
    h += '<div class="wi-top" data-t="' + x.type + '"><span class="wi-kind"><i data-t="' + x.type + '"></i>' + esc(TNAME[x.type]) + ' · ' + esc(D.DOW_L[+a.d]) + '</span>' +
      '<b class="wi-time">' + hh(x.s) + (x.e > x.s ? ' – ' + hh(x.e) : '') + '</b><span class="wi-dur">' + esc(dur(x.e - x.s)) + '</span></div>' +
      '<div class="wi-around">' + (prev ? '<span><small>Before · ' + hh(prev.s) + '</small><b>' + name(prev) + '</b></span>' : '') + (next ? '<span><small>After · ' + hh(next.s) + '</small><b>' + name(next) + '</b></span>' : '') + '</div>' +
      context(x, +a.d);
  }
  if (a.edit) {
    h += '<div class="wi-edit">' + '<div class="wi-steps">' + step('s', a.s) + step('e', a.e) + '</div>' +
      '<label class="field-label" for="wi-title">What</label><input class="text-in" id="wi-title" maxlength="60" autocomplete="off" value="' + esc(a.title) + '" placeholder="' + esc(TNAME[a.type]) + '" oninput="DASH.sheetArg().title=this.value">' +
      '<p class="field-label">Kind</p><div class="pick-row wi-kinds">' + TYPES.map(t => '<button class="pick' + (a.type === t ? ' on' : '') + '" id="wk-' + t + '" data-act="wi-type" data-v="' + t + '" aria-checked="' + (a.type === t) + '"><i class="wk-dot" data-t="' + t + '"></i>' + esc(TNAME[t]) + '</button>').join('') + '</div>' +
      '<div class="sheet-actions">' + (x ? '<button class="btn ghost" id="wi-del" data-act="wi-del">Delete</button>' : '') + '<button class="btn school" id="wi-save" data-act="wi-save">' + (x ? 'Save' : 'Add') + '</button></div></div>';
  } else h += '<button class="btn ghost block" id="wi-change" data-act="wi-change">' + ic('edit', 'sm') + 'Change it</button>';
  return { title: x ? (x.way ? 'On the way' : (x.title || TNAME[x.type])) : 'Add to ' + D.DOW_L[+a.d], own: true, body: h };
};
// the plan text, line by line: change one line, add one under its day, remove one
const lineOf = a => hh(a.s) + '-' + hh(a.e) + ' ' + a.type + (String(a.title || '').trim() ? ' ' + String(a.title).trim().replace(/\s+/g, ' ') : '');
function saveText(t, msg, undo) {
  if (D.DEMO) demoEdit = t; else D.settings.set('weekText', t);
  render(); D.toast(msg, undo);
}
function insertLine(lines, wd, line) {
  let at = lines.findIndex(l => !/^\s*~?\d/.test(l) && dayOf(l.trim()) === wd);
  if (at < 0) { while (lines.length && !lines[lines.length - 1].trim()) lines.pop(); lines.push('', EN_DAY[wd], line); return; }
  let k = at + 1;
  while (k < lines.length && (/^\s*~?\d/.test(lines[k]) || /^\s*#/.test(lines[k]))) k++;
  lines.splice(k, 0, line);
}
Object.assign(D.ACT, {
  'wk-mode': el => { S.mode = el.dataset.v; renderGrid(); },
  'wk-day': el => { S.day = +el.dataset.d; renderGrid(); },
  'wk-open-day': el => { S.day = +el.dataset.d; S.mode = 'day'; renderGrid(); window.scrollTo(0, 0); },
  'wk-item': el => D.openSheet('wkitem', { d: el.dataset.d, i: el.dataset.i }),
  'wk-add': () => D.openSheet('wkitem', { d: String(S.day), add: true }),
  'wi-change': () => { D.sheetArg().edit = true; D.renderSheet(); },
  'wi-t': el => { const a = D.sheetArg(), k = el.dataset.k; a[k] = D.clamp(a[k] + (+el.dataset.d), 0, 23 * 60 + 55); if (a.e <= a.s) { if (k === 's') a.e = Math.min(1440, a.s + 5); else a.s = Math.max(0, a.e - 5); } D.renderSheet(); },
  'wi-type': el => { D.sheetArg().type = el.dataset.v; D.renderSheet(); },
  'wi-save': () => {
    const a = D.sheetArg(), before = text(), lines = before.split(/\r?\n/), x = a.add ? null : plan().days[+a.d][+a.i];
    if (x) lines[x.line - 1] = lineOf(a); else insertLine(lines, +a.d, lineOf(a));
    D.closeSheet(); saveText(lines.join('\n'), x ? 'Saved' : 'Added', () => saveText(before, 'Undone'));
  },
  'wi-del': () => {
    const a = D.sheetArg(), before = text(), lines = before.split(/\r?\n/), x = plan().days[+a.d][+a.i]; if (!x) return;
    lines.splice(x.line - 1, 1);
    D.closeSheet(); saveText(lines.join('\n'), 'Deleted', () => saveText(before, 'Back'));
  }
});

D.SHEETS.weekedit = a => {
  if (a.v == null) a.v = text();
  const p = parse(a.v);
  return {
    title: 'Edit week', own: true,
    body: '<p class="sheet-note">A day on its own line, then one line per thing: <b>start-end type what</b>. Leave out the end and it runs until the next line. Only your account can see this.</p>' +
      '<textarea class="wk-text" id="wk-text" rows="16" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="' + esc(EXAMPLE) + '" oninput="DASH.sheetArg().v=this.value">' + esc(a.v) + '</textarea>' +
      '<p class="sheet-note">Types: ' + TYPES.map(t => '<span class="wk-type notranslate" translate="no"><i data-t="' + t + '"></i>' + t + '</span>').join(' ') + '</p>' +
      (p.bad.length ? '<p class="sheet-note warn">Couldn’t read line ' + p.bad.slice(0, 5).join(', ') + '. Each line needs a time first (07:45 or 07:45-15:20), or a day name.</p>' : '') +
      '<div class="sheet-actions">' + (D.DEMO ? '' : '<button class="btn ghost" id="wk-off" data-act="wk-off">Hide the Week tab</button>') + '<button class="btn school" id="wk-save" data-act="wk-save">Save</button></div>'
  };
};
Object.assign(D.ACT, {
  'wk-save': () => {
    const a = D.sheetArg(), v = String(a.v || '').replace(/\s+$/, ''), p = parse(v);
    if (p.bad.length && !a.warned) { a.warned = true; D.renderSheet(); return; } // show which lines, then a second tap saves anyway
    if (!D.DEMO) D.settings.set('weekText', v);
    D.closeSheet(); render(); D.toast('Week saved');
  },
  'wk-off': () => { D.settings.set('weekOn', false); D.closeSheet(); setTimeout(() => { location.href = '/v3/'; }, 600); }
});

D.settings.on(render);
setInterval(() => { if (!document.hidden) { renderNow(); renderGrid(); } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
render();
if (C) C.load().then(() => { if (D.sheetKind() === 'wkitem') D.renderSheet(); });
const ttLoad = () => { const st = TT ? TT.settings(schoolRow) : {}; if (st.cls) TT.load(st.cls).then(() => { if (D.sheetKind() === 'wkitem') D.renderSheet(); }); };
schoolRow.on(ttLoad);
D.boot('week').then(ok => {
  if (!ok) return;
  ttLoad();
  // ?on / ?off: turn the Week tab on or off for this (signed-in) account
  const q = location.search;
  if (!D.DEMO && /[?&]on\b/.test(q)) { D.settings.set('weekOn', true); history.replaceState(null, '', location.pathname); D.toast('Week tab is on for your account'); }
  if (!D.DEMO && /[?&]off\b/.test(q)) { D.settings.set('weekOn', false); setTimeout(() => { location.href = '/v3/'; }, 700); }
  render();
});
})();
