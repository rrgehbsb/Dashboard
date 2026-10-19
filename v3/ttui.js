/* Dashboard v3 — the timetable card on the School page: today / the next school day
   with changes marked, the weekly plan, and timetable settings (class, your groups,
   the 07:45 arrive-by rule, using it for the trip). Data: timetable.js. */
(function () {
'use strict';
const D = window.DASH, T = window.TIMETABLE, $ = D.$, esc = D.esc, ic = D.ic;
const school = window.SCHOOL_ROW;
const S = { view: 'today', week: false };
const bdi = s => '<bdi>' + esc(s) + '</bdi>';
const tmin = s => { if (!s) return null; const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };

function nextDay() {
  for (let i = 1; i <= 7; i++) { const d = D.dayAt(i); if (d.getDay() <= 4) return D.dk(d); }
  return D.dk(D.dayAt(1));
}
const dayLabel = dk => dk === D.todayKey() ? 'Today' : dk === D.dk(D.dayAt(1)) ? 'Tomorrow' : D.DOW_L[D.parseDk(dk).getDay()];

// Back-to-back lessons of the same thing (a double or triple lesson) show as one row.
function merge(list) {
  const sig = q => q.status === 'same' || q.status === 'planned' ? Array.from(new Set(q.items.map(e => e.subject + '/' + (e.teacher || '')))).sort().join('|') : null;
  const out = [];
  list.forEach(p => {
    const last = out[out.length - 1];
    if (last && sig(p) && sig(p) === sig(last) && last.nTo === p.n - 1) { last.nTo = p.n; last.end = p.end; }
    else out.push(Object.assign({}, p, { nTo: p.n }));
  });
  return out;
}
function row(p, isToday) {
  const now = D.nowMin(), cur = isToday && p.start && p.end && tmin(p.start) <= now && now < tmin(p.end);
  // the same subject often comes in several groups (other teachers): name it once
  const uniq = l => Array.from(new Set(l)).map(bdi).join(' · ');
  const names = uniq(p.items.map(e => e.subject));
  const teach = p.items.length === 1 && p.items[0].teacher ? '<small class="tch">' + bdi(p.items[0].teacher) + '</small>' : '';
  let chip = '', extra = '';
  if (p.status === 'changed') { chip = '<span class="tt-chip ch">Changed</span>'; extra = p.was && p.was.length ? '<small class="was">Was ' + uniq(p.was) + '</small>' : ''; }
  else if (p.status === 'cancelled') chip = '<span class="tt-chip cx">Cancelled</span>';
  else if (p.status === 'added') chip = '<span class="tt-chip ad">New</span>';
  const body = p.status === 'cancelled' ? '<b class="gone">' + uniq(p.was || []) + '</b>' : '<b>' + (names || '—') + '</b>';
  const n = p.nTo != null && p.nTo !== p.n ? p.n + '–' + p.nTo : p.n;
  return '<div class="tt-row' + (cur ? ' now' : '') + (p.status === 'cancelled' ? ' cancelled' : '') + '"><span class="tt-n">' + n + '</span><span class="tt-t">' + esc(p.start || '') + '</span>' +
    '<div class="tt-main"><span class="tt-s">' + body + teach + '</span>' + extra + '</div>' + chip + '</div>';
}

function render() {
  const slot = $('#tt-slot'); if (!slot) return;
  const s = T.settings(school);
  if (!s.cls) {
    slot.innerHTML = '<section class="card tt" id="tt"><div class="tt-head"><h2 class="card-title">Timetable</h2></div>' +
      '<p class="sheet-note">See your class’s day with every change marked: cancelled lessons, swaps and new ones. It comes straight from the school website, and tomorrow’s shows up when the school posts it in the evening.</p>' +
      '<button class="btn school block" id="tt-setup" data-act="sheet" data-sheet="ttset">Pick your class</button></section>';
    return;
  }
  const d = T.data();
  if (!d || d.cls !== s.cls) {
    // load once per class; if the school site can't be reached, say so (no retry loop)
    if (!S.loading && !(S.failed && S.want === s.cls)) {
      S.want = s.cls; S.loading = true; S.failed = false;
      T.load(s.cls).then(x => { S.loading = false; S.failed = !x || x.cls !== s.cls; render(); });
    }
    slot.innerHTML = '<section class="card tt" id="tt"><div class="tt-head"><h2 class="card-title">Timetable</h2></div>' +
      (S.failed ? '<p class="sheet-note">Couldn’t reach the school website.</p><button class="btn ghost block" id="tt-retry" data-act="tt-retry">Try again</button>' : '<p class="sheet-note">Loading your timetable…</p>') + '</section>';
    return;
  }
  const today = D.todayKey(), nd = nextDay();
  const tv = T.day(today, s), last = tv && !tv.holiday ? tv.periods.filter(p => p.items.length && p.status !== 'cancelled' && p.end).pop() : null;
  const schoolToday = !!last;
  // Once today's lessons are over (or there are none), the next school day matters more.
  if (!S.picked) S.view = schoolToday && D.nowMin() < tmin(last.end) ? 'today' : 'next';
  if (!schoolToday) S.view = 'next';
  const dk = S.view === 'today' ? today : nd;
  const v = T.day(dk, s), isToday = dk === today;
  const seg = '<div class="seg sm" role="tablist" aria-label="Which day">' +
    (schoolToday ? '<button role="tab" id="tt-v-today" data-act="tt-view" data-v="today" aria-selected="' + (S.view === 'today') + '">Today</button>' : '') +
    '<button role="tab" id="tt-v-next" data-act="tt-view" data-v="next" aria-selected="' + (S.view === 'next') + '">' + dayLabel(nd) + '</button></div>';
  let h = '<div class="tt-head"><h2 class="card-title">Timetable <small>' + bdi(d.name || '') + '</small></h2>' + seg + '</div>';
  if (v.holiday) h += '<p class="tt-note hol">' + ic('info', 'xs') + '<span>' + bdi(v.holiday.title) + ' · no school</span></p>';
  v.notes.forEach(n => { h += '<p class="tt-note">' + ic('info', 'xs') + '<span>' + (n.n != null ? 'Lesson ' + n.n + ': ' : '') + bdi(n.text) + '</span></p>'; });
  if (!(s.mine && s.mine.length) && T.groupSubjects().length) h += '<button class="tt-note act" id="tt-groups" data-act="sheet" data-sheet="ttset">' + ic('sliders', 'xs') + '<span>Some lessons are split into groups. <u>Pick yours</u> to see only your lessons and plan the right trip.</span></button>';
  const n = T.changes(dk, s);
  if (!v.published) h += '<p class="tt-sum">' + (isToday ? 'Today’s update isn’t on the school site, so this is the weekly plan.' : 'Weekly plan. The school posts changes around 20:00 the evening before.') + '</p>';
  else h += '<p class="tt-sum' + (n ? ' has' : '') + '">' + (n ? '<b>' + n + ' ' + D.plural(n, 'change', 'changes') + '</b> from the weekly plan' : 'Updated by the school · no changes') + '</p>';
  const rows = v.holiday ? [] : v.periods.filter(p => p.items.length || p.status === 'cancelled');
  h += rows.length ? '<div class="tt-list' + (v.published ? '' : ' planned') + '">' + merge(rows).map(p => row(p, isToday)).join('') + '</div>' : v.holiday ? '' : '<p class="empty">No lessons.</p>';
  const tt = T.dayTimes(dk, s);
  h += '<div class="tt-foot">' + (tt && !tt.none ? '<span>' + D.hhmm(tt.start) + '–' + D.hhmm(tt.end) + (tt.by != null ? ' · by ' + D.hhmm(tt.by) : '') + '</span>' : '<span></span>') +
    '<span class="tt-btns"><button class="btn-text sch" id="tt-week" data-act="sheet" data-sheet="ttweek">Week</button><button class="icon-btn flat" id="tt-gear" data-act="sheet" data-sheet="ttset" aria-label="Timetable settings">' + ic('sliders', 'sm') + '</button></span></div>';
  slot.innerHTML = '<section class="card tt" id="tt" aria-label="Timetable">' + h + '</section>';
}

/* ---------- week ---------- */
D.SHEETS.ttweek = () => {
  const d = T.data(), s = T.settings(school);
  if (!d || !d.week) return { title: 'Weekly timetable', body: '<p class="sheet-note">The weekly timetable isn’t available right now.</p>' };
  const days = [0, 1, 2, 3, 4], today = D.dayAt(0).getDay(), maxN = Math.max.apply(null, days.map(w => (d.week[w] || []).reduce((m, p) => Math.max(m, p.n), 0)));
  const minN = Math.min.apply(null, days.map(w => (d.week[w] || []).reduce((m, p) => Math.min(m, p.n), 99)));
  let rows = '';
  for (let n = minN; n <= maxN; n++) {
    const any = days.some(w => (d.week[w] || []).some(p => p.n === n)); if (!any) continue;
    const t = days.map(w => (d.week[w] || []).find(p => p.n === n)).find(Boolean);
    rows += '<tr><th scope="row"><b>' + n + '</b><small>' + esc((t && t.start) || '') + '</small></th>' + days.map(w => {
      const p = (d.week[w] || []).find(x => x.n === n);
      if (!p) return '<td></td>';
      // same rule as the day view: with your groups picked, a split lesson without yours is free
      const list = p.items.length > 1 && s.mine && s.mine.length ? p.items.filter(x => s.mine.indexOf(T.norm(x)) >= 0) : p.items;
      return '<td' + (w === today ? ' class="on"' : '') + '>' + Array.from(new Set(list)).map(x => bdi(x)).join('<br>') + '</td>';
    }).join('') + '</tr>';
  }
  return {
    title: 'Weekly timetable · ' + esc(d.name || ''),
    body: '<p class="sheet-note">The school’s weekly plan. The day itself can change: the School card shows the updated day with changes marked.</p>' +
      '<div class="tt-week-wrap"><table class="tt-week"><thead><tr><th></th>' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((x, w) => '<th scope="col"' + (w === today ? ' class="on"' : '') + '>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
  };
};

/* ---------- settings ---------- */
function work(a) { if (!a.f) a.f = JSON.parse(JSON.stringify(T.settings(school))); if (a.f.trip == null) a.f.trip = true; if (!a.f.mine) a.f.mine = []; if (!a.f.hidden) a.f.hidden = []; return a.f; }
D.SHEETS.ttset = a => {
  const f = work(a);
  if (!a.list) { T.classes().then(l => { a.list = l; if (D.sheetKind() === 'ttset') D.renderSheet(); }); }
  const groups = T.groupSubjects();
  const sw = (id, label, on, hint, act) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="switch-hit"><button class="switch" id="' + id + '" role="switch" aria-checked="' + !!on + '" data-act="' + act + '" aria-label="' + label + '"></button></span></div>';
  return {
    title: 'Timetable',
    body: '<p class="group-title">Your class</p>' +
      (a.list ? '<div class="pick-row cls-grid" role="radiogroup" aria-label="Class">' + a.list.map(c => '<button class="pick" id="cls-' + c.id + '" role="radio" data-act="tt-cls" data-v="' + c.id + '" aria-checked="' + (f.cls === c.id) + '">' + bdi(c.name) + '</button>').join('') + '</div>' : '<p class="sheet-note">Loading classes…</p>') +
      (f.cls && groups.length ? '<p class="group-title">Your groups</p><p class="sheet-note">Some lessons split into groups. Pick every one you’re in: a split lesson with none of yours counts as a free period, so your trip skips it.</p><div class="pick-row" role="group" aria-label="Your groups">' +
        groups.map(g => '<button class="pick" id="grp-' + esc(g).replace(/[^\w֐-׿]/g, '') + '" data-act="tt-grp" data-v="' + esc(g) + '" aria-pressed="' + (f.mine.indexOf(g) >= 0) + '">' + bdi(g) + '</button>').join('') + '</div>' : '') +
      '<p class="group-title">Your trip</p>' +
      sw('tt-trip', 'Plan my trip from the timetable', f.trip, 'Get there for your first lesson and head home after your last, cancelled lessons included. Off: the times in trip settings.', 'tt-trip') +
      sw('tt-early', 'On 07:45 days I can arrive by 08:00', !!f.early, 'Plans those mornings to 08:00', 'tt-early') +
      (f.hidden.length ? '<div class="set-row"><span class="lbl">' + f.hidden.length + ' hidden calendar ' + D.plural(f.hidden.length, 'test', 'tests') + '</span><button class="btn-text sch" id="tt-unhide" data-act="tt-unhide">Show again</button></div>' : '') +
      '<button class="btn school block" id="tt-save" data-act="tt-save">Save</button>'
  };
};

Object.assign(D.ACT, {
  'tt-view': el => { S.view = el.dataset.v; S.picked = true; render(); },
  'tt-retry': () => { S.failed = false; render(); },
  'tt-cls': el => { const a = D.sheetArg(), f = work(a); if (f.cls !== el.dataset.v) { f.cls = el.dataset.v; f.mine = []; } T.load(f.cls, true).then(() => { if (D.sheetKind() === 'ttset') D.renderSheet(); }); D.renderSheet(); },
  'tt-grp': el => { const f = work(D.sheetArg()), g = el.dataset.v, i = f.mine.indexOf(g); if (i >= 0) f.mine.splice(i, 1); else f.mine.push(g); D.renderSheet(); },
  'tt-trip': () => { const f = work(D.sheetArg()); f.trip = !f.trip; D.renderSheet(); },
  'tt-early': () => { const f = work(D.sheetArg()); f.early = f.early ? null : '08:00'; D.renderSheet(); },
  'tt-unhide': () => { const f = work(D.sheetArg()); f.hidden = []; D.renderSheet(); },
  'tt-save': () => {
    const f = work(D.sheetArg());
    if (!f.cls) { D.toast('Pick your class first'); return; }
    school.set(T.KEY, f);
    D.closeSheet();
    T.load(f.cls).then(() => { render(); if (window.TRIPUI) window.TRIPUI.render(); if (window.SCHOOL_RENDER) window.SCHOOL_RENDER(); });
    D.toast('Timetable saved');
  }
});

/* ---------- boot ---------- */
function connect() {
  const s = T.settings(school);
  if (window.COMMUTE) window.COMMUTE.setDayTimes(dk => T.dayTimes(dk, T.settings(school)));
  if (s.cls) T.load(s.cls).then(() => { render(); if (window.TRIPUI) window.TRIPUI.render(); if (window.SCHOOL_RENDER) window.SCHOOL_RENDER(); });
  render();
}
T.onChange(() => { if (D.sheetKind()) return; render(); if (window.TRIPUI) window.TRIPUI.render(); if (window.SCHOOL_RENDER) window.SCHOOL_RENDER(); });
school.on(() => { if (!D.sheetKind()) connect(); });
setInterval(() => { const s = T.settings(school); if (s.cls && !document.hidden) T.load(s.cls); }, 5 * 60e3);
document.addEventListener('visibilitychange', () => { const s = T.settings(school); if (!document.hidden && s.cls) T.load(s.cls); });
window.TTUI = { render };
connect();
})();
