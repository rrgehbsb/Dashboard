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

// "today 19:52" / "yesterday 19:52" / "Sun 18 Oct 19:52"
function when(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const k = D.dk(d), t = D.hhmm(d.getHours() * 60 + d.getMinutes());
  return k === D.todayKey() ? 'today ' + t : k === D.dk(D.dayAt(-1)) ? 'yesterday ' + t : D.dShort(d) + ' ' + t;
}
// Is this the school's update, or still only the weekly plan? Never leave it unclear.
function stateHtml(v, isToday, n) {
  if (v.holiday) return '';
  if (v.published) return '<div class="tt-state ok" id="tt-state">' + ic('check', 'xs') + '<span><b>Updated by the school</b>' + (v.uploadedAt ? ' · ' + when(v.uploadedAt) : '') +
    ' · ' + (n ? '<b>' + n + ' ' + D.plural(n, 'change', 'changes') + '</b>' : 'no changes') + '</span></div>';
  const late = !isToday && D.nowMin() >= 20 * 60 + 30;
  return '<div class="tt-state wait" id="tt-state">' + ic('clock', 'xs') + '<span><b>Not updated yet: this is the weekly plan.</b> ' +
    (isToday ? 'The school hasn’t posted an update for today. ' : late ? 'The school usually posts it by now, so it may come late tonight. ' : 'The school posts the update for each day the day before, usually by 20:00. ') +
    'Until then cancelled lessons and absent teachers don’t show.</span></div>';
}
function checkedHtml() {
  const f = T.freshness(); if (!f.at) return '';
  const age = Math.round((Date.now() - f.at) / 60e3), at = new Date(f.at);
  const t = D.hhmm(at.getHours() * 60 + at.getMinutes());
  return f.ok ? '<span class="tt-checked">Checked ' + (age < 1 ? 'just now' : age < 60 ? age + ' min ago' : t) + '</span>'
    : '<span class="tt-checked bad">Couldn’t check for updates · saved copy from ' + t + '</span>';
}
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
  else if (p.status === 'cancelled') { chip = '<span class="tt-chip cx">Cancelled</span>'; if (p.why && p.why.teacher) extra = '<small class="was">For your group: ' + bdi(p.why.teacher) + ' isn’t listed</small>'; }
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
  const groups = T.groupSubjects();
  if (!(s.mine && s.mine.length) && groups.length) h += '<button class="tt-note act" id="tt-groups" data-act="sheet" data-sheet="ttset">' + ic('sliders', 'xs') + '<span>Some lessons are split into groups. <u>Pick yours</u> (and your teacher) to see only your lessons and plan the right trip.</span></button>';
  else {
    const noTeacher = (s.mine || []).map(T.parsePick).filter(p => !p.t && (groups.find(g => g.s === p.s) || { teachers: [] }).teachers.length > 1);
    if (noTeacher.length) h += '<button class="tt-note act" id="tt-teachers" data-act="sheet" data-sheet="ttset">' + ic('sliders', 'xs') + '<span>' + bdi(noTeacher[0].s) + ' has several teachers. <u>Pick yours</u> to see when your group is off.</span></button>';
  }
  h += stateHtml(v, isToday, T.changes(dk, s));
  const rows = v.holiday ? [] : v.periods.filter(p => p.items.length || p.status === 'cancelled');
  h += rows.length ? '<div class="tt-list' + (v.published ? '' : ' planned') + '">' + merge(rows).map(p => row(p, isToday)).join('') + '</div>' : v.holiday ? '' : '<p class="empty">No lessons.</p>';
  const tt = T.dayTimes(dk, s);
  h += '<div class="tt-foot">' + (tt && !tt.none ? '<span>' + D.hhmm(tt.start) + '–' + D.hhmm(tt.end) + (tt.by != null ? ' · by ' + D.hhmm(tt.by) : '') + checkedHtml() + '</span>' : '<span>' + checkedHtml() + '</span>') +
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
      const picks = (s.mine || []).map(T.parsePick);
      const list = p.items.length > 1 && picks.length ? p.items.filter(x => picks.some(q => q.s === T.norm(x))) : p.items;
      return '<td' + (w === today ? ' class="on"' : '') + '>' + Array.from(new Set(list)).map(x => bdi(x)).join('<br>') + '</td>';
    }).join('') + '</tr>';
  }
  return {
    title: 'Weekly timetable · ' + esc(d.name || ''),
    body: '<p class="sheet-note">The school’s regular weekly plan. It never shows changes, cancelled lessons or teachers: the School card shows each day as the school updates it.</p>' +
      '<div class="tt-week-wrap"><table class="tt-week"><thead><tr><th></th>' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].map((x, w) => '<th scope="col"' + (w === today ? ' class="on"' : '') + '>' + x + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
  };
};

/* ---------- settings ---------- */
function work(a) { if (!a.f) a.f = JSON.parse(JSON.stringify(T.settings(school))); if (a.f.trip == null) a.f.trip = true; if (!a.f.mine) a.f.mine = []; if (!a.f.hidden) a.f.hidden = []; return a.f; }
D.SHEETS.ttset = a => {
  const f = work(a);
  if (!a.list) { T.classes().then(l => { a.list = l; if (D.sheetKind() === 'ttset') D.renderSheet(); }); }
  if (f.cls && !a.gl) { a.gl = true; T.loadGroups(f.cls).then(() => { if (D.sheetKind() === 'ttset') D.renderSheet(); }); }
  const groups = T.groupSubjects(), picks = f.mine.map(T.parsePick);
  const gchip = (g, t, label, on) => '<button class="pick" data-act="tt-grp" data-s="' + esc(g.s) + '" data-t="' + esc(t) + '" role="radio" aria-checked="' + on + '">' + label + '</button>';
  const groupRow = g => {
    const cur = picks.find(p => p.s === g.s), many = g.teachers.length > 1;
    return '<div class="grp-row"><p class="grp-name">' + bdi(g.name) + '</p><div class="pick-row" role="radiogroup" aria-label="' + esc(g.name) + '">' +
      gchip(g, '', 'Not mine', !cur) +
      g.teachers.map(t => gchip(g, t, bdi(t), !!cur && (cur.t === t || (!cur.t && !many)))).join('') +
      (!g.teachers.length ? gchip(g, '*', 'Mine', !!cur) : many ? gchip(g, '*', 'Not sure', !!cur && !cur.t) : '') + '</div></div>';
  };
  const sw = (id, label, on, hint, act) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="switch-hit"><button class="switch" id="' + id + '" role="switch" aria-checked="' + !!on + '" data-act="' + act + '" aria-label="' + label + '"></button></span></div>';
  return {
    title: 'Timetable',
    body: '<p class="group-title">Your class</p>' +
      (a.list ? '<div class="pick-row cls-grid" role="radiogroup" aria-label="Class">' + a.list.map(c => '<button class="pick" id="cls-' + c.id + '" role="radio" data-act="tt-cls" data-v="' + c.id + '" aria-checked="' + (f.cls === c.id) + '">' + bdi(c.name) + '</button>').join('') + '</div>' : '<p class="sheet-note">Loading classes…</p>') +
      (f.cls && groups.length ? '<p class="group-title">Your groups</p><p class="sheet-note">These subjects split into groups, each with its own teacher and sometimes its own hours. Pick your teacher for each one you take. Then the timetable shows only your lessons, and if your teacher isn’t in, it shows your group as cancelled.</p>' +
        '<div class="grp-list">' + groups.map(groupRow).join('') + '</div>' : '') +
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
  'tt-grp': el => {
    const f = work(D.sheetArg()), sub = el.dataset.s, t = el.dataset.t;
    f.mine = f.mine.filter(x => T.parsePick(x).s !== sub);
    if (t === '*') f.mine.push(sub); else if (t) f.mine.push(sub + '|' + t);
    D.renderSheet();
  },
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
setInterval(() => { const s = T.settings(school); if (s.cls && !document.hidden) T.load(s.cls); render(); }, 60e3);
document.addEventListener('visibilitychange', () => { const s = T.settings(school); if (!document.hidden && s.cls) T.load(s.cls); });
window.TTUI = { render };
connect();
})();
