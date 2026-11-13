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
const GRID_FROM = 6 * 60 + 30, GRID_TO = 22 * 60 + 30;
const TYPES = ['school', 'commute', 'gym', 'vb', 'frc', 'study', 'food', 'free'];
const TNAME = { school: 'School', commute: 'Commute', gym: 'Gym', vb: 'VB', frc: 'FRC', study: 'Study', food: 'Food', free: 'Free', wake: 'Wake up' };
const ALIAS = { bus: 'commute', train: 'commute', travel: 'commute', eat: 'food', meal: 'food', lunch: 'food', dinner: 'food', breakfast: 'food',
  volleyball: 'vb', robotics: 'frc', homework: 'study', hw: 'study', home: 'free', rest: 'free', shabbat: 'free', sleep: 'free', workout: 'gym', wake: 'wake', class: 'school' };
const DAYW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
const EXAMPLE = 'Sun\n07:00 wake\n07:30-08:00 commute Bus → train\n08:00-14:00 school\n15:00-16:30 gym Push day\n19:00 food Dinner\n19:30-20:30 study\n\nMon\n07:30-08:00 commute\n08:00-14:30 school';
const DEMO_TEXT = 'Sun\n07:00 wake\n07:30-08:00 commute\n08:00-14:00 school\n15:00-16:30 gym\n19:00 food Dinner\n19:30-20:30 study\nMon\n07:30-08:00 commute\n08:00-14:30 school\n16:00-18:00 frc\nTue\n08:00-14:00 school\n18:00-20:00 vb Practice\nWed\n08:00-14:00 school\n15:00-16:30 gym\nThu\n08:00-14:00 school\n16:00-18:00 frc\nFri\n10:00-12:00 vb Game\nSat\n10:00-18:00 free';

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
const text = () => D.DEMO ? DEMO_TEXT : String(D.settings.get('weekText') || '');
let memo = { t: null, v: null };
const plan = () => { const t = text(); if (memo.t !== t) memo = { t, v: parse(t) }; return memo.v; };
const has = () => plan().days.some(l => l.length);
// what you wrote; gym, FRC and VB keep their name in front ("Gym Push day", "FRC (optional)")
const TAGGED = { gym: 1, frc: 1, vb: 1 };
const name = x => !x.title ? esc(TNAME[x.type]) : (TAGGED[x.type] && x.title.toLowerCase().indexOf(TNAME[x.type].toLowerCase()) < 0 ? esc(TNAME[x.type]) + ' ' : '') + '<bdi>' + esc(x.title) + '</bdi>';
const inTxt = m => m < 60 ? 'in ' + m + ' min' : 'in ' + Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');
const dayWord = off => off === 0 ? 'Today' : off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(off).getDay()];

// What you're doing now and what's next (next may be on a later day).
function nowNext() {
  const days = plan().days, wd = D.dayAt(0).getDay(), n = D.nowMin();
  const cur = days[wd].filter(x => x.type !== 'wake' && x.s <= n && n < x.e).pop() || null;
  for (let off = 0; off < 8; off++) {
    const next = days[(wd + off) % 7].find(x => off > 0 || (x.s > n && x !== cur));
    if (next) return { cur, next, off, n };
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
  let t = end, what = null;
  for (const x of plan().days[wd]) {
    if (x.s < end) continue; // school itself and the morning
    if (x.s - t > 30 || !AFTER[x.type]) break; // a gap, or home / food / free: you're heading home
    t = Math.max(t, x.e); what = TNAME[x.type];
  }
  return what ? { end: t, what } : null;
}
window.WEEK = { parse, on, has, nowNext, hero, afterSchool, TYPES, TNAME };

/* ---------- the page ---------- */
const view = $('#view-week');
if (!view) return;
const S = { day: D.dayAt(0).getDay() };
const y = m => ((Math.max(GRID_FROM, Math.min(GRID_TO, m)) - GRID_FROM) / (GRID_TO - GRID_FROM) * 100).toFixed(2) + '%';

function renderNow() {
  const el = $('#wk-now');
  if (!has()) { el.innerHTML = ''; return; }
  const { cur, next, off, n } = nowNext();
  el.innerHTML = '<div class="wk-strip" data-t="' + (cur ? cur.type : 'free') + '">' +
    '<div><span class="k">Now</span><b>' + (cur ? name(cur) : esc('Free')) + '</b>' + (cur ? '<span class="v">until ' + D.hhmm(cur.e) + '</span>' : '') + '</div>' +
    '<div><span class="k">Next</span><b>' + (next ? name(next) : '–') + '</b>' + (next ? '<span class="v">' + (off === 0 ? D.hhmm(next.s) + ' · ' + inTxt(next.s - n) : dayWord(off) + ' ' + D.hhmm(next.s)) + '</span>' : '') + '</div></div>';
}
function renderGrid() {
  const el = $('#wk-grid'), days = plan().days, today = D.dayAt(0).getDay(), n = D.nowMin();
  if (!has()) {
    el.innerHTML = '<div class="card wk-empty"><h2 class="card-title">Your week is empty</h2><p class="sheet-note">Write it once, as plain text: a day, then one line per thing. Only your account can see it.</p>' +
      '<button class="btn school block" id="wk-start" data-act="sheet" data-sheet="weekedit">' + ic('edit', 'sm') + 'Write my week</button></div>';
    return;
  }
  let h = '<div class="card wk-card"><div class="wk-head"><span></span>' + D.DOW.map((d, i) =>
    '<button class="wk-dh' + (i === today ? ' today' : '') + '" data-act="wk-day" data-d="' + i + '" aria-pressed="' + (i === S.day) + '">' + esc(d) + '</button>').join('') + '</div><div class="wk-body"><div class="wk-axis">';
  for (let m = 7 * 60; m <= 22 * 60; m += 120) h += '<span style="top:' + y(m) + '">' + D.hhmm(m) + '</span>';
  h += '</div>';
  days.forEach((list, i) => {
    h += '<div class="wk-col' + (i === today ? ' today' : '') + (i === S.day ? ' sel' : '') + '" data-act="wk-day" data-d="' + i + '">';
    list.forEach(x => {
      if (x.type === 'wake' || x.e <= GRID_FROM || x.s >= GRID_TO) return;
      h += '<span class="wk-b" data-t="' + x.type + '" style="top:' + y(x.s) + ';height:calc(' + y(x.e) + ' - ' + y(x.s) + ')" title="' + esc(D.hhmm(x.s) + '–' + D.hhmm(x.e) + ' ' + (x.title || TNAME[x.type])) + '"><span class="wk-bt">' + name(x) + '</span></span>';
    });
    if (i === today && n >= GRID_FROM && n <= GRID_TO) h += '<span class="wk-now-line" style="top:' + y(n) + '"></span>';
    h += '</div>';
  });
  const used = TYPES.filter(t => days.some(l => l.some(x => x.type === t)));
  h += '</div><div class="wk-legend">' + used.map(t => '<span><i data-t="' + t + '"></i>' + esc(TNAME[t]) + '</span>').join('') + '</div></div>';
  el.innerHTML = h;
}
function renderDay() {
  const el = $('#wk-day'), list = plan().days[S.day];
  if (!has()) { el.innerHTML = ''; return; }
  const n = D.nowMin(), isToday = S.day === D.dayAt(0).getDay();
  el.innerHTML = '<section class="card"><h2 class="card-title">' + esc(D.DOW_L[S.day]) + (isToday ? ' · ' + esc('Today') : '') + '</h2>' +
    (list.length ? '<ul class="wk-list">' + list.map(x => {
      const now = isToday && x.type !== 'wake' && x.s <= n && n < x.e, past = isToday && x.e <= n && x.type !== 'wake';
      return '<li class="' + (now ? 'now' : past ? 'past' : '') + '"><span class="wk-dot" data-t="' + x.type + '"></span><span class="wk-time">' + D.hhmm(x.s) + (x.e > x.s ? '–' + D.hhmm(x.e) : '') + '</span><span class="wk-what">' + name(x) + '</span>' + (now ? '<span class="tag">Now</span>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="sheet-note">Nothing planned.</p>') +
    '<a class="wk-link" href="https://handasaim.co.il/schedule" target="_blank" rel="noopener">' + ic('school', 'xs') + 'Check today’s school schedule' + ic('go', 'xs') + '</a></section>';
}
function render() {
  $('#week-date').textContent = D.dLong(D.dayAt(0));
  renderNow(); renderGrid(); renderDay();
  D.animate(view);
}

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
  'wk-day': el => { S.day = +el.dataset.d; renderGrid(); renderDay(); },
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
D.boot('week').then(ok => {
  if (!ok) return;
  // ?on / ?off: turn the Week tab on or off for this (signed-in) account
  const q = location.search;
  if (!D.DEMO && /[?&]on\b/.test(q)) { D.settings.set('weekOn', true); history.replaceState(null, '', location.pathname); D.toast('Week tab is on for your account'); }
  if (!D.DEMO && /[?&]off\b/.test(q)) { D.settings.set('weekOn', false); setTimeout(() => { location.href = '/v3/'; }, 700); }
  render();
});
})();
