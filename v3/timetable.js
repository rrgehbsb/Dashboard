/* Dashboard v3 — the school timetable (Handasaim), shared by School, Today and the
   trip planner. Data comes from /api/school (the school's daily timetable, weekly
   timetable and class calendar); settings live in the synced school row:
     dashboard:school:v1:timetable = { cls:"11-3", mine:["מתמטיקה|צפריר דלית", "מדעי המחשב", …],
                                       trip:true, early:"08:00"|null, hidden:[uid…] }
   mine     = your groups where lessons split: "subject|teacher" (your teacher's group)
              or just "subject" (any teacher). Unpicked split subjects aren't yours.
   trip     = plan the trip from the timetable (first lesson → arrival, last → leaving)
   early    = on days that start at 07:45 you may arrive by this time */
(function () {
'use strict';
const D = window.DASH;
const KEY = 'dashboard:school:v1:timetable';
const LS = cls => 'dash3:tt:' + cls;
// Evenings (when the school posts tomorrow) check every 2 minutes, otherwise every 5.
const freshMs = () => { const m = D.nowMin(); return m >= 18 * 60 && m <= 23 * 60 + 30 ? 2 * 60e3 : 5 * 60e3; };
let data = null, loading = null, loadingCls = null, classesP = null, lastTry = null, lastOk = true;
const groupsP = {};
const subs = [];

const ALIAS = { 'מעבדת פיזיקה': 'פיזיקה', 'מעבדת פיסיקה': 'פיזיקה', 'פיסיקה': 'פיזיקה', 'שעת מחנך': 'חינוך', 'מתמטיקה טכניונית': 'מתמטיקה מואץ' };
function norm(s) {
  let t = String(s || '').replace(/["״׳']/g, '').replace(/(^|\s)תלן(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s+\d+$/, '');
  return ALIAS[t] || t;
}
const tm = s => { if (!s) return null; const p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };

function settings(row) { const s = row && row.get(KEY); return s && typeof s === 'object' ? s : {}; }

function load(cls, force) {
  if (!cls) return Promise.resolve(null);
  if (!data || data.cls !== cls) {
    const c = D.readJSON(LS(cls));
    data = c && c.data ? Object.assign(c.data, { _at: c.at }) : null; // never show another class's day
  }
  if (!force && data && Date.now() - (data._at || 0) < freshMs()) return Promise.resolve(data);
  if (D.DEMO) { data = demoData(cls); data._at = Date.now(); subs.forEach(f => f()); return Promise.resolve(data); }
  if (loading && loadingCls === cls) return loading;
  loadingCls = cls;
  lastTry = Date.now();
  const p = loading = fetch('/api/school?cls=' + encodeURIComponent(cls)).then(r => r.json()).then(j => {
    if (j && j.ok && loadingCls === cls) { lastOk = true; data = j; data._at = Date.now(); D.writeJSON(LS(cls), { at: data._at, data: j }); subs.forEach(f => { try { f(); } catch (e) {} }); }
    else lastOk = false;
    return data;
  }).catch(() => { lastOk = false; subs.forEach(f => { try { f(); } catch (e) {} }); return data; }).finally(() => { if (loading === p) { loading = null; loadingCls = null; } });
  return p;
}
function classes() {
  if (!classesP) {
    const c = D.readJSON('dash3:tt:classes');
    if (c && c.list && Date.now() - c.at < 7 * 864e5) classesP = Promise.resolve(c.list);
    else classesP = (D.DEMO ? Promise.resolve([{ id: '11-3', name: 'יא3' }, { id: '11-4', name: 'יא4' }, { id: '10-1', name: 'י1' }]) : fetch('/api/school?classes=1').then(r => r.json()).then(j => { const l = (j && j.classes) || []; D.writeJSON('dash3:tt:classes', { at: Date.now(), list: l }); return l; }).catch(() => { classesP = null; return []; }));
  }
  return classesP;
}

/* ---------- your lessons ---------- */
// Your groups: "subject|teacher" or "subject" (any teacher).
const parsePick = x => { const i = String(x).indexOf('|'); return i < 0 ? { s: norm(x), t: null } : { s: norm(String(x).slice(0, i)), t: String(x).slice(i + 1) }; };
// Which of a period's lessons are yours.
//  • a split period (several lessons at once): only your groups. A split subject you
//    didn't pick isn't yours; for a subject you picked with a teacher, only that
//    teacher's group. If other groups of your subject are on but your teacher isn't
//    listed, ctx.teacherMissing says so (your group is most likely off).
//  • a whole-class lesson (one item) stays yours, whoever teaches it (substitutes).
//  The weekly page has no teachers, so there it goes by subject only.
function myItems(items, mine, ctx) {
  const list = (items || []).map(e => typeof e === 'string' ? { subject: e, teacher: '' } : e);
  if (!mine || !mine.length || list.length <= 1) return list;
  const picks = mine.map(parsePick), keep = new Set();
  list.forEach(e => {
    const P = picks.filter(p => p.s === norm(e.subject));
    if (!P.length) return;
    const T = P.map(p => p.t).filter(Boolean);
    if (!T.length || !e.teacher || T.indexOf(e.teacher) >= 0) keep.add(e);
  });
  if (ctx) {
    const missing = picks.find(p => p.t && !list.some(e => keep.has(e) && norm(e.subject) === p.s) && list.some(e => norm(e.subject) === p.s));
    if (missing) ctx.teacherMissing = { s: missing.s, t: missing.t };
  }
  return list.filter(e => keep.has(e));
}
const subjKey = l => Array.from(new Set(l.map(x => norm(typeof x === 'string' ? x : x.subject)))).sort().join('|');
// The school marks changes for the whole class; with your groups picked, judge them by your lessons.
function myStatus(st, items, was) {
  if (st !== 'changed' && st !== 'added' && st !== 'cancelled') return st;
  const w = was || [];
  if (!items.length) return w.length ? 'cancelled' : 'same';
  if (!w.length) return 'added';
  return subjKey(items) === subjKey(w) ? 'same' : 'changed';
}
// Subjects that come in groups for this class, with their teachers (the ones you pick
// from). The full list comes from two weeks of daily timetables (/api/school?groups=1);
// until it arrives, what's in the loaded days.
function groupSubjects() {
  const out = {}, add = (s, t) => { if (!s) return; const g = out[s] = out[s] || { s, name: s, teachers: [] }; if (t && g.teachers.indexOf(t) < 0) g.teachers.push(t); };
  const g = data && groupsP[data.cls] && groupsP[data.cls].list;
  (g || []).forEach(x => { add(x.s); (x.teachers || []).forEach(t => add(x.s, t)); });
  if (data) {
    Object.values(data.week || {}).forEach(day => day.forEach(p => { if (p.items.length > 1) p.items.forEach(x => add(norm(x))); }));
    Object.values(data.days || {}).forEach(d => (d.periods || []).forEach(p => { if (p.items.length > 1) p.items.forEach(e => add(norm(e.subject), e.teacher)); }));
  }
  return Object.values(out).map(x => Object.assign(x, { teachers: x.teachers.sort((a, b) => a.localeCompare(b, 'he')) })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
}
function loadGroups(cls) {
  if (!cls) return Promise.resolve([]);
  if (groupsP[cls] && groupsP[cls].p) return groupsP[cls].p;
  const k = 'dash3:tt:groups:' + cls, c = D.readJSON(k);
  const G = groupsP[cls] = { list: c && c.list || null };
  if (c && c.list && Date.now() - c.at < 864e5) { G.p = Promise.resolve(c.list); return G.p; }
  if (D.DEMO) { G.list = [{ s: 'מתמטיקה', teachers: ['בראל מאיה', 'צפריר דלית'] }, { s: 'מדעי המחשב', teachers: ['כהן ערן משה'] }, { s: 'סייבר', teachers: ['אביטוב יורם', 'שביט אופיר'] }]; G.p = Promise.resolve(G.list); return G.p; }
  G.p = fetch('/api/school?groups=1&cls=' + encodeURIComponent(cls)).then(r => r.json()).then(j => { if (j && j.ok) { G.list = j.groups; D.writeJSON(k, { at: Date.now(), list: j.groups }); } return G.list || []; }).catch(() => { G.p = null; return G.list || []; });
  return G.p;
}
function holidayOn(dk) { return data && data.calendar ? (data.calendar.holidays || []).find(h => dk >= h.date && dk <= h.end) || null : null; }
// One day for display: the school's update for that day (with changes marked), or —
// until the school posts it — the weekly plan (published:false: it can't show
// cancellations or absent teachers). uploadedAt = when the school last posted the day.
function day(dk, s) {
  if (!data) return null;
  const mine = (s && s.mine) || [];
  const hol = holidayOn(dk);
  const d = data.days && data.days[dk];
  const wd = D.parseDk(dk).getDay();
  if (d && d.published) {
    return { dk, published: true, uploadedAt: d.uploadedAt || null, holiday: hol, notes: d.notes || [], periods: (d.periods || []).map(p => {
      const ctx = {}, items = myItems(p.items, mine, ctx);
      let was = p.was ? myItems(p.was, mine).map(e => e.subject) : p.was;
      let status = mine.length ? myStatus(p.status, items, was) : p.status, why = null;
      // your subject is on with other groups' teachers, but your teacher isn't listed
      if (ctx.teacherMissing && !items.length) {
        const raw = (p.items || []).find(e => norm(e.subject) === ctx.teacherMissing.s);
        status = 'cancelled'; why = { teacher: ctx.teacherMissing.t }; was = [raw ? raw.subject : ctx.teacherMissing.s];
      }
      return Object.assign({}, p, { items, was, status, why });
    }) };
  }
  const base = wd <= 4 && data.week ? data.week[wd] : null;
  return { dk, published: false, holiday: hol, notes: [], periods: (base || []).map(p => ({ n: p.n, start: p.start, end: p.end, items: myItems(p.items, mine), status: 'planned' })) };
}
// How fresh the timetable is: when it was last fetched, and whether the last try failed.
function freshness() { return { at: data && data._at || null, ok: lastOk, tried: lastTry }; }
// When your day starts and ends (for the trip). none = no school for you that day.
function dayTimes(dk, s) {
  if (!data || !s || s.trip === false) return null;
  if (holidayOn(dk)) return { none: true, why: holidayOn(dk).title };
  const v = day(dk, s); if (!v) return null;
  if (v.notes.some(n => n.full)) return null; // e.g. a trip day: leave it to the manual times
  const real = v.periods.filter(p => p.status !== 'cancelled' && p.items.length && p.start);
  if (!real.length) return v.published ? { none: true, why: 'No lessons' } : null;
  const start = tm(real[0].start), end = tm(real[real.length - 1].end || real[real.length - 1].start);
  const by = s.early && real[0].start === '07:45' ? tm(s.early) : null;
  return { start, end, by, published: v.published, firstN: real[0].n };
}
function tests(s) {
  if (!data || !data.calendar) return [];
  const hidden = (s && s.hidden) || [];
  return (data.calendar.tests || []).filter(t => hidden.indexOf(t.uid) < 0);
}
// School-calendar tests in the next maxDays days that aren't already one of your own
// tests (added from the calendar, or any test of yours on the same day: the school
// allows one test a day per class).
function upcoming(s, own, maxDays) {
  const ownDays = new Set(), linked = new Set();
  (own || []).forEach(t => { if (!t || t.deleted) return; if (t.testDate) ownDays.add(t.testDate); if (t.calUid) linked.add(t.calUid); });
  return tests(s).map(t => Object.assign({ d: D.daysFrom(t.date) }, t))
    .filter(t => t.d != null && t.d >= 0 && t.d <= maxDays && !linked.has(t.uid) && !ownDays.has(t.date));
}
// How many lessons changed on a published day (null = not published yet).
function changes(dk, s) {
  const v = day(dk, s);
  if (!v || !v.published) return null;
  return v.periods.filter(p => p.status === 'changed' || p.status === 'cancelled' || p.status === 'added').length;
}
function events() { return data && data.calendar ? data.calendar.events || [] : []; }

/* ---------- ?demo ---------- */
function demoData(cls) {
  const t = D.todayKey(), tm1 = D.dk(D.dayAt(1)), d2 = D.dk(D.dayAt(3)), d6 = D.dk(D.dayAt(7));
  const grp = ['מדעי המחשב 2', 'מעבדת ביו', 'אלגוריתמיקה', 'סייבר 1'];
  const per = (n, s, e, items, status, was) => ({ n, start: s, end: e, items: items.map(x => typeof x === 'string' ? { subject: x, teacher: '' } : x), status: status || 'same', was });
  const week = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  [0, 1, 2, 3, 4].forEach(wd => { week[wd] = [{ n: 1, start: '08:30', end: '09:15', items: ['מתמטיקה'] }, { n: 2, start: '09:15', end: '10:00', items: ['אנגלית'] }, { n: 3, start: '10:15', end: '11:00', items: grp.map(g => g.replace(/ \d$/, '')) }, { n: 4, start: '11:00', end: '11:45', items: ['ספרות'] }, { n: 5, start: '12:10', end: '12:55', items: ['היסטוריה'] }]; });
  return {
    ok: true, cls, name: 'יא3', days: {
      [t]: { published: true, uploadedAt: new Date(Date.now() - 14 * 3600e3).toISOString(), notes: [], periods: [per(0, '07:45', '08:30', ['פיזיקה'], 'added'), per(1, '08:30', '09:15', [{ subject: 'מתמטיקה', teacher: 'בראל מאיה' }, { subject: 'מתמטיקה טכניונית', teacher: 'שפיר גיל' }]), per(2, '09:15', '10:00', ['תנ"ך'], 'changed', ['אנגלית']), per(3, '10:15', '11:00', grp), per(4, '11:00', '11:45', ['ספרות']), per(5, '12:10', '12:55', [], 'cancelled', ['היסטוריה'])] },
      [tm1]: { published: false }
    },
    week, calendar: { tests: [{ date: d2, end: d2, time: '08:30', title: 'מבחן בפיזיקה', subject: 'פיזיקה', uid: 'demo-t1' }, { date: d6, end: d6, time: null, title: 'מבחן במתמטיקה', subject: 'מתמטיקה', uid: 'demo-t2' }], events: [{ date: tm1, end: tm1, time: '10:15', title: 'מפגש עדות', uid: 'demo-e1' }], holidays: [] }
  };
}

window.TIMETABLE = { KEY, load, classes, settings, day, dayTimes, tests, upcoming, changes, events, groupSubjects, loadGroups, parsePick, norm, holidayOn, freshness, data: () => data, onChange: f => subs.push(f) };
})();
