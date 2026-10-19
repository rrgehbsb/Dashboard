/* Dashboard v3 — School (school day + commute). Same data as the classic school
   page (row uid:school):
   dashboard:school:v1:subjects    [{id, name, color, hidden}]
   dashboard:school:v1:assignments [{id, subjectId, title, type, dueDate, priority, status:'Not started'|'In progress'|'Done', completedAt, notes, createdAt, updatedAt}]
   dashboard:school:v1:tests       [{id, subjectId, name, testDate, topics, studyStatus, importance, notes, createdAt, updatedAt}]
   dashboard:school:v1:grades      [{id, subjectId, type, gradeValue, maxGrade, date, weight, notes, testId?}]
   dashboard:school:v1:commute     see commute.js
   Lists merge per item across devices (newest edit wins); removing an item marks it
   deleted:true so the other device can't bring it back. */
(function () {
'use strict';
const D = window.DASH, C = window.COMMUTE, $ = D.$, esc = D.esc, ic = D.ic;
const K = { subj: 'dashboard:school:v1:subjects', as: 'dashboard:school:v1:assignments', te: 'dashboard:school:v1:tests', gr: 'dashboard:school:v1:grades' };
const stamp = () => new Date().toISOString();
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function mergeById(base, inc) {
  if (!Array.isArray(base)) return Array.isArray(inc) ? inc : [];
  if (!Array.isArray(inc)) return base;
  const when = x => String((x && (x.updatedAt || x.createdAt)) || '');
  const m = new Map();
  base.forEach(x => { if (x && x.id != null) m.set(x.id, x); });
  inc.forEach(x => { if (!x || x.id == null) return; const a = m.get(x.id); if (!a || when(x) >= when(a)) m.set(x.id, x); });
  const out = [], seen = new Set();
  base.concat(inc).forEach(x => { if (!x || x.id == null || seen.has(x.id)) return; seen.add(x.id); out.push(m.get(x.id)); });
  return out;
}
const school = D.Row('school', { merge: { [K.subj]: mergeById, [K.as]: mergeById, [K.te]: mergeById, [K.gr]: mergeById } });
window.SCHOOL_ROW = school; // the trip card and its settings live in trip.js

/* ---------- demo ---------- */
if (D.DEMO) {
  const day = n => D.dk(D.dayAt(n));
  school.data[K.subj] = [{ id: 'math', name: 'Math', color: '#3B82F6' }, { id: 'bio', name: 'Biology', color: '#22C55E' }, { id: 'eng', name: 'English', color: '#8B5CF6' }, { id: 'hist', name: 'History', color: '#F97316' }, { id: 'phys', name: 'Physics', color: '#06B6D4' }];
  school.data[K.as] = [
    { id: 'a1', subjectId: 'math', title: 'Homework p.112', type: 'Homework', dueDate: day(3), status: 'Not started' },
    { id: 'a2', subjectId: 'eng', title: 'Essay draft', type: 'Essay', dueDate: day(6), status: 'Not started' },
    { id: 'a3', subjectId: 'hist', title: 'Reading ch. 6', type: 'Reading', dueDate: day(9), status: 'Not started' },
    { id: 'a4', subjectId: 'math', title: 'Worksheet 4', type: 'Worksheet', dueDate: day(-1), status: 'Done', completedAt: new Date(Date.now() - 864e5).toISOString() },
    { id: 'a5', subjectId: 'hist', title: 'Old summary', type: 'Homework', dueDate: day(-40), status: 'Not started' }
  ];
  school.data[K.te] = [{ id: 't1', subjectId: 'bio', name: 'Bio test · chapters 4–5', testDate: day(2) }, { id: 't2', subjectId: 'phys', name: 'Physics quiz', testDate: day(-3) }];
  school.data[K.gr] = [{ id: 'g1', subjectId: 'math', type: 'Test', gradeValue: 91, maxGrade: 100 }, { id: 'g2', subjectId: 'bio', type: 'Test', gradeValue: 84, maxGrade: 100 }, { id: 'g3', subjectId: 'eng', type: 'Quiz', gradeValue: 88, maxGrade: 100 }];
  if (window.TIMETABLE) school.data[window.TIMETABLE.KEY] = { cls: '11-3', mine: ['מדעי המחשב', 'מתמטיקה|צפריר דלית'], trip: true, early: '08:00', hidden: [] };
  school.data[C.KEY] = { setup: true, legs: { walk1: 3, bus1: 34, buffer: 5, wait2: 5, bus2: 3, walk2: 8 }, home: { lines: ['71', '72', '73', '74'], stop: '32645' }, hz: { mode: 'bus', from: '27102', to: '20378', lines: [], transfer: 4, walk: 5 }, days: { 0: { start: '07:45', end: '14:00', by: '08:00' }, 1: { start: '08:00', end: '14:45', by: null }, 2: { start: '07:45', end: '13:30', by: '08:00' }, 3: { start: '08:00', end: '14:45', by: null }, 4: { start: '08:00', end: '13:00', by: null } }, offUntil: null };
}

/* ---------- data access ---------- */
const DEF_SUBJ = ['Math', 'English', 'Hebrew', 'Arabic', 'History', 'Science', 'Biology', 'Chemistry', 'Physics', 'Literature', 'Bible', 'Civics', 'Geography', 'Computer Science', 'Technology', 'Robotics', 'Physical Education', 'Art', 'Music'];
const COLORS = ['#3B82F6', '#8B5CF6', '#EAB308', '#14B8A6', '#F97316', '#10B981', '#22C55E', '#06B6D4', '#6366F1', '#EC4899', '#D97706', '#EF4444'];
const arr = k => { const a = school.get(k); return Array.isArray(a) ? a : []; };
const live = k => arr(k).filter(x => x && !x.deleted);
function subjects() {
  const s = live(K.subj);
  if (s.length) return s.filter(x => !x.hidden);
  return DEF_SUBJ.map((n, i) => ({ id: n.toLowerCase().replace(/[^a-z]/g, ''), name: n, color: COLORS[i % COLORS.length], _default: true }));
}
function ensureSubjectsSaved() {
  if (live(K.subj).length) return;
  school.set(K.subj, subjects().map(s => ({ id: s.id, name: s.name, color: s.color, hidden: false, createdAt: stamp() })));
}
const subjName = id => { const s = live(K.subj).concat(subjects()).find(x => x.id === id); return s ? s.name : ''; };
function upsert(k, item) {
  const now = stamp(), list = arr(k).slice(), i = list.findIndex(x => x && x.id === item.id);
  const next = Object.assign({}, i >= 0 ? list[i] : { createdAt: now }, item, { updatedAt: now });
  if (i >= 0) list[i] = next; else list.push(next);
  school.set(k, list);
  return next;
}
function patch(k, id, fields) { const cur = arr(k).find(x => x && x.id === id); if (cur) upsert(k, Object.assign({}, cur, fields)); }
function items() {
  const out = [];
  live(K.as).forEach(a => out.push({ kind: 'hw', id: a.id, title: a.title || 'Untitled', subjectId: a.subjectId, type: a.type || 'Homework', date: a.dueDate || null, done: a.status === 'Done', doneAt: a.completedAt || null }));
  live(K.te).forEach(t => out.push({ kind: 'test', id: t.id, title: t.name || 'Test', subjectId: t.subjectId, type: t.type === 'Quiz' || /quiz|בוחן/i.test(t.name || '') ? 'Quiz' : 'Test', date: t.testDate || null }));
  out.forEach(x => { x.d = D.daysFrom(x.date); });
  return out.concat(calTests());
}
// Tests from the class calendar on the school website (next 3 weeks), read-only until
// you add one to your own tests. One of yours on the same day hides the calendar copy.
const CAL_DAYS = 21;
function calTests() {
  const T = window.TIMETABLE; if (!T) return [];
  const s = T.settings(school); if (!s.cls) return [];
  return T.upcoming(s, arr(K.te), CAL_DAYS).map((t, i) => ({ kind: 'test', cal: true, id: 'cal' + i, uid: t.uid, title: t.title, he: t.subject, time: t.time, type: t.quiz ? 'Quiz' : 'Test', date: t.date, d: t.d }));
}
// Hebrew subject on the school calendar → one of your subjects, when it's clear.
const HE = { 'מתמטיקה': 'math', 'אנגלית': 'english', 'פיזיקה': 'physics', 'ביולוגיה': 'biology', 'כימיה': 'chemistry', 'היסטוריה': 'history', 'ספרות': 'literature', 'תנך': 'bible', 'אזרחות': 'civics', 'לשון': 'hebrew', 'גאוגרפיה': 'geography', 'גיאוגרפיה': 'geography', 'מדעי המחשב': 'computerscience', 'ערבית': 'arabic', 'חינוך גופני': 'physicaleducation', 'רובוטיקה': 'robotics' };
function subjFromHe(he) {
  const T = window.TIMETABLE, k = HE[T ? T.norm(he) : he]; if (!k && !he) return '';
  const subs = subjects(), n = s => String(s.name || '').toLowerCase().replace(/[^a-z֐-׿]/g, '');
  const m = subs.find(s => k && n(s) === k) || subs.find(s => n(s) === String(he).replace(/[^֐-׿]/g, ''));
  return m ? m.id : '';
}
const gradeFor = testId => live(K.gr).find(g => g.testId === testId);
const pct = g => (+g.maxGrade ? (+g.gradeValue / +g.maxGrade) * 100 : +g.gradeValue);
function averages() {
  const by = {};
  live(K.gr).forEach(g => { if (g.gradeValue == null || isNaN(+g.gradeValue)) return; const w = g.weight != null && !isNaN(+g.weight) ? +g.weight : 1; (by[g.subjectId] = by[g.subjectId] || { s: 0, w: 0, n: 0 }); by[g.subjectId].s += pct(g) * w; by[g.subjectId].w += w; by[g.subjectId].n++; });
  const rows = Object.keys(by).map(id => ({ id, name: subjName(id) || 'Other', avg: Math.round(by[id].s / by[id].w), n: by[id].n })).sort((a, b) => a.name.localeCompare(b.name));
  const all = rows.length ? Math.round(rows.reduce((a, r) => a + r.avg, 0) / rows.length) : null;
  return { rows, all };
}

/* ---------- labels ---------- */
const dayName = d => D.DOW_L[D.dayAt(d).getDay()];
function dueLabel(d) {
  if (d == null) return 'No date';
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d > 1 && d <= 6) return D.DOW[D.dayAt(d).getDay()] + ' · ' + d + 'd';
  if (d > 6) return D.dShort(D.dayAt(d));
  return 'Was due ' + D.DOW[D.dayAt(d).getDay()];
}

/* ---------- state ---------- */
const S = { showDone: false, folding: {}, pick: null, pickBack: null, enter: null, filter: 'all', qkind: null };

/* ---------- trip card: drawn by trip.js ---------- */
function renderCommute() { if (window.TRIPUI) window.TRIPUI.render(); }

/* ---------- up next ---------- */
const CHECK = '<span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg></span>';
// Every item says plainly what it is, so a test never hides among homework.
// Kinds: Homework · Assignment (project, essay, worksheet…) · Test · Quiz
const KINDS = ['Homework', 'Assignment', 'Test', 'Quiz'];
const kindOf = x => x.kind === 'test' ? (x.type === 'Quiz' ? 'Quiz' : 'Test') : (!x.type || x.type === 'Homework' ? 'Homework' : 'Assignment');
function typeChip(x) {
  const k = kindOf(x), sub = k === 'Assignment' && x.type && x.type !== 'Assignment' ? x.type : k;
  return '<span class="ty ty-' + k.toLowerCase() + '">' + (k === 'Test' || k === 'Quiz' ? ic('info', 'xs') : '') + esc(sub) + '</span>';
}
function hwRow(x) {
  const late = x.d != null && x.d < 0;
  return '<li class="hw' + (x.done ? ' is-done' : '') + (S.enter === x.id ? ' enter' : '') + '" id="hw-' + x.id + '">' +
    '<button class="check" id="hwc-' + x.id + '" data-act="hw-toggle" data-id="' + x.id + '" aria-pressed="' + !!x.done + '" aria-label="' + (x.done ? 'Done' : 'Mark done') + ': ' + esc(x.title) + '">' + CHECK + '</button>' +
    '<button class="body" data-act="sheet" data-sheet="item" data-kind="hw" data-id="' + x.id + '"><span class="nm"><bdi>' + esc(x.title) + '</bdi></span><span class="sub">' + typeChip(x) + esc(subjName(x.subjectId) || 'No subject') + '</span></button>' +
    '<span class="due' + (x.d != null && x.d >= 0 && x.d <= 1 ? ' soon' : late ? ' late' : '') + '">' + dueLabel(x.d) + '</span></li>';
}
function calRow(x) {
  return '<li class="hw test-row cal-row" id="hw-' + x.id + '"><span class="check t-ic" aria-hidden="true">' + ic('school', 'sm') + '</span>' +
    '<button class="body" data-act="sheet" data-sheet="caltest" data-uid="' + esc(x.uid) + '"><span class="nm"><bdi>' + esc(x.title) + '</bdi></span><span class="sub">' + typeChip(x) + 'From school</span></button>' +
    '<span class="due' + (x.d <= 2 ? ' soon' : '') + '">' + dueLabel(x.d) + '</span></li>';
}
function testRow(x) {
  if (x.cal) return calRow(x);
  const past = x.d != null && x.d < 0;
  return '<li class="hw test-row' + (S.enter === x.id ? ' enter' : '') + '" id="hw-' + x.id + '"><span class="check t-ic" aria-hidden="true">' + ic(past ? 'check' : 'clock', 'sm') + '</span>' +
    '<button class="body" data-act="sheet" data-sheet="item" data-kind="test" data-id="' + x.id + '"><span class="nm"><bdi>' + esc(x.title) + '</bdi></span><span class="sub">' + typeChip(x) + esc(subjName(x.subjectId) || '') + '</span></button>' +
    (past ? '<button class="score-chip" id="score-' + x.id + '" data-act="sheet" data-sheet="score" data-id="' + x.id + '">+ score</button>' : '<span class="due' + (x.d != null && x.d <= 2 ? ' soon' : '') + '">' + dueLabel(x.d) + '</span>') + '</li>';
}
function classify() {
  const all = items();
  const open = all.filter(x => (x.kind === 'hw' && (!x.done || S.folding[x.id]) && !(x.d != null && x.d < -14)) || (x.kind === 'test' && x.d != null && x.d >= 0) || (x.kind === 'test' && x.d == null))
    .sort((a, b) => (a.d == null ? 999 : a.d) - (b.d == null ? 999 : b.d) || (a.kind === 'test' ? -1 : 1));
  const scoreable = all.filter(x => x.kind === 'test' && x.d != null && x.d < 0 && x.d >= -7 && !gradeFor(x.id));
  const done = all.filter(x => x.kind === 'hw' && x.done && !S.folding[x.id] && x.doneAt && (Date.now() - new Date(x.doneAt)) < 7 * 864e5);
  const old = all.filter(x => x.kind === 'hw' && !x.done && x.d != null && x.d < -14);
  return { all, open, scoreable, done, old };
}
const passes = x => S.filter === 'all' || (S.filter === 'tests' ? x.kind === 'test' : x.kind === 'hw');
function renderUpNext() {
  const c = classify();
  const week = c.open.filter(x => x.d != null && x.d >= 0 && x.d <= 7);
  const tests = week.filter(x => x.kind === 'test'), test = tests[0];
  $('#upnext-sum').innerHTML = (test ? '<b><bdi>' + esc(test.title.split('·')[0].trim()) + '</bdi> ' + (test.d === 0 ? 'today' : test.d === 1 ? 'tomorrow' : dayName(test.d)) + '.</b> ' : '') +
    (week.length ? (tests.length ? tests.length + ' ' + D.plural(tests.length, 'test', 'tests') + ' and ' : '') + (week.length - tests.length) + ' homework or ' + D.plural(week.length - tests.length, 'assignment', 'assignments') + ' this week.' : 'Nothing due this week.');
  $('#un-filter').innerHTML = [['all', 'All'], ['hw', 'Homework'], ['tests', 'Tests']].map(o => '<button role="tab" id="unf-' + o[0] + '" data-act="un-filter" data-v="' + o[0] + '" aria-selected="' + (S.filter === o[0]) + '">' + o[1] + '</button>').join('');
  const rows = c.open.filter(passes).map(x => x.kind === 'test' ? testRow(x) : hwRow(x)).join('') + c.scoreable.filter(passes).map(testRow).join('');
  $('#hw-list').innerHTML = rows ||
    '<li class="empty">' + (S.filter === 'tests' ? 'No tests coming up.' : S.filter === 'hw' ? 'No homework coming up.' : 'Nothing coming up. Add homework or a test above.') + '</li>';
  S.enter = null;
  let ex = '';
  if (c.done.length) {
    ex += '<button class="fold-line" id="done-toggle" data-act="toggle-done" aria-expanded="' + S.showDone + '"><span class="ok sch">' + ic('check', 'xs') + '</span>' + c.done.length + ' done this week' + ic('chev-r', 'sm chev') + '</button>';
    if (S.showDone) ex += '<ul class="hw-list">' + c.done.map(hwRow).join('') + '</ul>';
  }
  if (c.old.length) ex += '<div class="older"><p><strong>' + c.old.length + ' older ' + D.plural(c.old.length, 'item', 'items') + '</strong> from before</p><button class="btn-text sch" id="old-review" data-act="sheet" data-sheet="old">Review</button></div>';
  $('#hw-extra').innerHTML = ex;
  const avg = averages(), g = $('#grades-row');
  g.hidden = avg.all == null;
  if (avg.all != null) g.innerHTML = ic('grid') + '<span>Grades</span><span class="r">avg ' + avg.all + ic('chev-r', 'sm') + '</span>';
}
function render() {
  $('#school-date').textContent = D.dLong(D.dayAt(0));
  renderCommute();
  renderUpNext();
}

/* ---------- quick add ---------- */
const ALIASES = { math: ['math', 'maths', 'mat'], biology: ['bio', 'biology'], english: ['eng', 'english'], history: ['hist', 'history'], physics: ['phys', 'physics'], hebrew: ['heb', 'hebrew', 'lashon'], chemistry: ['chem', 'chemistry'], literature: ['lit', 'literature', 'sifrut'], computerscience: ['cs', 'code', 'computer', 'comp'], bible: ['bible', 'tanakh', 'tanach', 'tanah'], civics: ['civics', 'ezrachut'], geography: ['geo', 'geography'], physicaleducation: ['pe', 'sport', 'sports', 'gym'], arabic: ['arabic'], science: ['sci', 'science'], technology: ['tech', 'technology'], robotics: ['robotics', 'robot'], art: ['art'], music: ['music'] };
const TYPES = [[/^(hw|homework|ex|exercise|exercises|tirgul)$/, 'Homework'], [/^(test|exam|bagrut|mivchan)$/, 'TEST'], [/^(quiz|bochan)$/, 'QUIZ'], [/^(essay|chibur)$/, 'Essay'], [/^(read|reading)$/, 'Reading'], [/^(project|proj|avoda)$/, 'Project'], [/^(presentation|pres|matzeget)$/, 'Presentation'], [/^(worksheet|sheet|daf)$/, 'Worksheet'], [/^(lab)$/, 'Lab'], [/^(study)$/, 'Study']];
const DAYW = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEBR = /[\u0590-\u05FF]/;
const heNorm = w => String(w || '').replace(/["״׳']/g, '');
const HE_SUBJ = { 'מתמטיקה': 'math', 'מתמ': 'math', 'חשבון': 'math', 'אנגלית': 'english', 'ביולוגיה': 'biology', 'ביו': 'biology', 'היסטוריה': 'history', 'פיזיקה': 'physics', 'כימיה': 'chemistry',
  'ספרות': 'literature', 'תנך': 'bible', 'אזרחות': 'civics', 'לשון': 'hebrew', 'עברית': 'hebrew', 'גאוגרפיה': 'geography', 'גיאוגרפיה': 'geography', 'מדמח': 'computerscience', 'מחשבים': 'computerscience',
  'ערבית': 'arabic', 'ספורט': 'physicaleducation', 'חנג': 'physicaleducation', 'רובוטיקה': 'robotics', 'מדעים': 'science', 'טכנולוגיה': 'technology', 'אמנות': 'art', 'מוזיקה': 'music' };
const HE_TYPES = [[/^(שב|שיעורי-בית|תרגיל|תרגילים|שיעורים)$/, 'Homework'], [/^(מבחן|מבחנים|בגרות)$/, 'TEST'], [/^(בוחן)$/, 'QUIZ'], [/^(חיבור)$/, 'Essay'], [/^(קריאה)$/, 'Reading'],
  [/^(פרויקט|עבודה)$/, 'Project'], [/^(מצגת)$/, 'Presentation'], [/^(דף|דף-עבודה)$/, 'Worksheet'], [/^(מעבדה)$/, 'Lab'], [/^(למידה|ללמוד)$/, 'Study']];
const HE_DAYS = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };
// "במתמטיקה" / "למבחן" / "ביום" → without the one-letter prefix
const unprefix = w => (w.length > 3 && /^[בלה]/.test(w) ? w.slice(1) : w);
function heSubject(w) {
  const key = HE_SUBJ[w] || HE_SUBJ[unprefix(w)];
  const subs = subjects();
  if (key) { const m = subs.find(x => norm(x.name) === key); if (m) return m; }
  return subs.find(x => heNorm(x.name) === w || heNorm(x.name) === unprefix(w)) || null;
}
// "Math test" in English; "מבחן במתמטיקה" in Hebrew
const kindWord = k => D.t(k === 'TEST' ? 'Test' : k === 'QUIZ' ? 'Quiz' : k);
const titleOf = (kind, sname) => D.he ? kindWord(kind) + (sname ? ' ב' + D.t(sname) : '') : (sname ? sname + ' ' : '') + String(kind === 'TEST' ? 'test' : kind === 'QUIZ' ? 'quiz' : kind).toLowerCase();
function findSubject(word) {
  const w = norm(word);
  if (w.length < 2) return null;
  const subs = subjects();
  for (const s of subs) { const n = norm(s.name); const al = ALIASES[n] || [n]; if (al.indexOf(w) >= 0 || n === w) return s; }
  if (w.length >= 3) for (const s of subs) if (norm(s.name).indexOf(w) === 0) return s;
  return null;
}
function parseQuick(text) {
  // two-word Hebrew terms become one word first
  const words = String(text).replace(/שיעורי\s+בית/g, 'שיעורי-בית').replace(/דף\s+עבודה/g, 'דף-עבודה').replace(/מדעי\s+המחשב/g, 'מדמח').replace(/חינוך\s+גופני/g, 'חנג').split(/\s+/).filter(Boolean);
  let subj = null, type = null, off = null, newSubj = null;
  const rest = [];
  words.forEach(raw => {
    const w = raw.toLowerCase().replace(/[.,!?]/g, '');
    let m;
    if (HEBR.test(w)) {
      const h = heNorm(w), u = unprefix(h);
      if (!subj && (m = heSubject(h))) { subj = m; return; }
      // a school subject you don't have yet: add it under its proper name ("בתנך" → תנ״ך)
      const key = HE_SUBJ[h] || HE_SUBJ[u], def = key && DEF_SUBJ.find(n => norm(n) === key);
      if (!subj && !newSubj && def) { newSubj = D.t(def); return; }
      if (!type && (m = HE_TYPES.find(t => t[0].test(h) || t[0].test(u)))) { type = m[1]; return; }
      if (off == null && (HE_DAYS[h] != null || HE_DAYS[u] != null)) { off = (((HE_DAYS[h] != null ? HE_DAYS[h] : HE_DAYS[u]) - D.dayAt(0).getDay()) + 7) % 7 || 7; return; }
      if (off == null && /^(היום|הערב)$/.test(h)) { off = 0; return; }
      if (off == null && /^(מחר|למחר)$/.test(h)) { off = 1; return; }
      if (/^(ביום|יום|עד|ל|ב|של)$/.test(h)) return; // "ביום חמישי", "עד מחר"
    }
    if (!subj && (m = findSubject(w))) { subj = m; return; }
    if (!type && (m = TYPES.find(t => t[0].test(w)))) { type = m[1]; return; }
    if (off == null && Object.prototype.hasOwnProperty.call(DAYW, w)) { off = ((DAYW[w] - D.dayAt(0).getDay()) + 7) % 7 || 7; return; }
    if (off == null && w === 'today') { off = 0; return; }
    if (off == null && /^(tomorrow|tmr|tmrw)$/.test(w)) { off = 1; return; }
    if (off == null && (m = w.match(/^(\d{1,2})[./](\d{1,2})$/))) {
      const now = D.dayAt(0); let d = new Date(now.getFullYear(), +m[2] - 1, +m[1], 12);
      if (d < now) d = new Date(now.getFullYear() + 1, +m[2] - 1, +m[1], 12);
      off = Math.round((d - now) / 864e5); return;
    }
    rest.push(raw);
  });
  if (!subj && !newSubj && type && rest.length && rest[0].length >= 2) newSubj = D.cap(rest.shift());
  if (!subj && !newSubj && !type && off == null) return null;
  const isTest = type === 'TEST' || type === 'QUIZ';
  const sname = subj ? subj.name : newSubj || '';
  const extra = rest.join(' ');
  const title = isTest ? (titleOf(type, sname) + (extra ? ' · ' + extra : ''))
    : (extra ? (D.he ? kindWord(type || 'Homework') : (type || 'Homework')) + ' ' + extra : (sname ? titleOf(type || 'Homework', sname) : (D.he ? kindWord(type || 'Homework') : (type || 'Homework'))));
  return { subj, newSubj, kind: isTest ? 'test' : 'hw', type: isTest ? 'Test' : (type || 'Homework'), off, title };
}
// What you're adding: the button you picked wins; otherwise what you typed ("test", "quiz", "project"…).
function withKind(p, v) {
  p = p || { subj: null, newSubj: null, kind: 'hw', type: 'Homework', off: null, title: D.cap(v) };
  const typed = p.kind === 'test' ? (/quiz|bochan|בוחן/i.test(v) ? 'Quiz' : 'Test') : (p.type && p.type !== 'Homework' ? 'Assignment' : 'Homework');
  const sn = p.subj ? p.subj.name : p.newSubj || '';
  const k = S.qkind || typed;
  if (k === 'Test' || k === 'Quiz') {
    if (p.kind !== 'test') p.title = titleOf(k === 'Quiz' ? 'QUIZ' : 'TEST', sn);
    p.kind = 'test'; p.type = k;
  } else {
    if (p.kind === 'test') p.title = titleOf(k, p.subj ? p.subj.name : '');
    p.kind = 'hw'; p.type = k === 'Assignment' ? (p.type && p.type !== 'Homework' && p.type !== 'Test' ? p.type : 'Assignment') : 'Homework';
  }
  p.k = k;
  return p;
}
function renderPreview() {
  const v = $('#hw-input').value.trim(), el = $('#hw-preview');
  const p = v ? withKind(parseQuick(v), v) : null;
  const eff = S.qkind || (p ? p.k : 'Homework');
  $('#hw-kinds').innerHTML = KINDS.map(k => '<button type="button" class="kind k-' + k.toLowerCase() + '" id="qk-' + k + '" role="radio" data-act="q-kind" data-v="' + k + '" aria-checked="' + (eff === k) + '">' + k + '</button>').join('');
  if (!v) { el.innerHTML = ''; return; }
  el.innerHTML = '<span>Will add</span><span class="pc">' + typeChip(p) + esc((p.subj ? p.subj.name : p.newSubj || 'No subject')) + ' · ' + (p.off == null ? 'No date' : esc(dueLabel(p.off))) + '</span>' + (p.newSubj ? '<span>new subject</span>' : '');
}
function addQuick(v) {
  const p = withKind(parseQuick(v), v);
  ensureSubjectsSaved();
  let subjectId = p.subj ? p.subj.id : '';
  if (p.newSubj) { const s = upsert(K.subj, { id: newId(), name: p.newSubj, color: COLORS[live(K.subj).length % COLORS.length], hidden: false }); subjectId = s.id; }
  const date = p.off == null ? null : D.dk(D.dayAt(p.off));
  const item = p.kind === 'test'
    ? upsert(K.te, { id: newId(), subjectId, name: p.title, type: p.type, testDate: date, studyStatus: 'Not started', importance: 'Normal' })
    : upsert(K.as, { id: newId(), subjectId, title: p.title, type: p.type, dueDate: date, priority: 'Auto', status: 'Not started' });
  S.enter = item.id;
  render();
  const sn = subjName(subjectId), label = p.kind === 'test' ? item.name : (sn && item.title.toLowerCase().indexOf(sn.toLowerCase()) < 0 ? sn + ' · ' + item.title : item.title);
  D.toast('Added · ' + label + (date ? ' · ' + dueLabel(p.off) : ''), () => { patch(p.kind === 'test' ? K.te : K.as, item.id, { deleted: true }); render(); });
}

/* ---------- actions ---------- */
function toggleHw(id) {
  const a = live(K.as).find(x => x.id === id); if (!a) return;
  if (a.status === 'Done') { patch(K.as, id, { status: 'Not started', completedAt: null }); render(); return; }
  patch(K.as, id, { status: 'Done', completedAt: stamp() });
  S.folding[id] = true;
  const li = $('#hw-' + id); if (li) li.classList.add('is-done');
  D.toast('Done · ' + a.title, () => { delete S.folding[id]; patch(K.as, id, { status: a.status || 'Not started', completedAt: null }); render(); });
  setTimeout(() => {
    const el = $('#hw-' + id); if (el) el.classList.add('fold');
    setTimeout(() => { delete S.folding[id]; render(); }, D.reduced() ? 0 : 280);
  }, D.reduced() ? 0 : 900);
}

/* ---------- sheets ---------- */
const ASSIGN_TYPES = ['Assignment', 'Project', 'Worksheet', 'Reading', 'Study', 'Presentation', 'Essay', 'Lab'];
D.SHEETS.item = a => {
  const isTest = a.kind === 'test', src = (isTest ? live(K.te) : live(K.as)).find(x => x.id === a.id);
  if (!src) return { title: 'Item', body: '<p class="sheet-note">This item was removed.</p>' };
  if (!a.f) {
    const t = isTest ? (src.type === 'Quiz' || /quiz|בוחן/i.test(src.name || '') ? 'Quiz' : 'Test') : (src.type || 'Homework');
    a.f = { title: isTest ? src.name : src.title, subjectId: src.subjectId || '', date: (isTest ? src.testDate : src.dueDate) || '', type: t, kind: isTest ? t : (t === 'Homework' ? 'Homework' : 'Assignment') };
  }
  const f = a.f;
  return {
    title: f.kind,
    body: '<p class="field-label">What is it?</p><div class="kinds" role="radiogroup" aria-label="Kind">' + KINDS.map(k => '<button class="kind k-' + k.toLowerCase() + '" id="ik-' + k + '" role="radio" data-act="it-kind" data-v="' + k + '" aria-checked="' + (f.kind === k) + '">' + k + '</button>').join('') + '</div>' +
      '<label class="field-label" for="it-title">Title</label><input class="text-in" id="it-title" value="' + esc(f.title) + '" maxlength="80" autocomplete="off">' +
      '<p class="field-label">Subject</p><div class="pick-row" role="radiogroup" aria-label="Subject">' + subjects().map(s => '<button class="pick" id="isub-' + esc(s.id) + '" role="radio" data-act="it-subj" data-v="' + esc(s.id) + '" aria-checked="' + (f.subjectId === s.id) + '">' + esc(s.name) + '</button>').join('') + '</div>' +
      '<label class="field-label" for="it-date">' + (f.kind === 'Test' || f.kind === 'Quiz' ? 'Date' : 'Due') + '</label><input class="text-in" id="it-date" type="date" value="' + esc(f.date) + '">' +
      (f.kind === 'Assignment' ? '<p class="field-label">Type of assignment</p><div class="pick-row" role="radiogroup" aria-label="Type">' + ASSIGN_TYPES.map(t => '<button class="pick" id="ity-' + t + '" role="radio" data-act="it-type" data-v="' + t + '" aria-checked="' + (f.type === t) + '">' + t + '</button>').join('') + '</div>' : '') +
      '<div class="sheet-actions"><button class="btn ghost" id="it-del" data-act="it-del">Remove</button><button class="btn school" id="it-save" data-act="it-save">Save</button></div>'
  };
};
const calFind = uid => { const T = window.TIMETABLE; return T ? T.tests(T.settings(school)).find(x => x.uid === uid) : null; };
D.SHEETS.caltest = a => {
  const t = calFind(a.uid);
  if (!t) return { title: 'Test', body: '<p class="sheet-note">This test isn’t on the school calendar anymore.</p>' };
  const row = (k, v) => '<div class="info-row"><b>' + k + '</b><span>' + v + '</span></div>';
  const kind = t.quiz ? 'Quiz' : 'Test';
  return {
    title: kind,
    body: '<p class="cal-title"><bdi>' + esc(t.title) + '</bdi></p><div class="info-list">' +
      row('When', esc(D.dLong(D.parseDk(t.date))) + (t.time ? ' · ' + esc(t.time) : '')) +
      (t.subject ? row('Subject', '<bdi>' + esc(t.subject) + '</bdi>') : '') +
      row('From', 'Your class calendar on the school website. If the school moves it, it moves here too.') + '</div>' +
      '<p class="sheet-note">Add it to your tests to change it, or to save your score afterwards.</p>' +
      '<div class="sheet-actions"><button class="btn ghost" id="cal-hide" data-act="cal-hide" data-uid="' + esc(t.uid) + '">Hide</button><button class="btn school" id="cal-add" data-act="cal-add" data-uid="' + esc(t.uid) + '">Add to my tests</button></div>'
  };
};
D.SHEETS.score = a => {
  const t = live(K.te).find(x => x.id === a.id);
  if (!t) return { title: 'Score', body: '' };
  if (a.v == null) a.v = 85;
  return {
    title: t.name + ' · ' + D.t('score'), own: true,
    body: '<div class="stepper"><button class="step-btn" id="score-m" data-act="score-step" data-d="-1" aria-label="Lower">−</button><span class="val"><span class="num">' + a.v + '</span><small>/ 100</small></span><button class="step-btn" id="score-p" data-act="score-step" data-d="1" aria-label="Higher">+</button></div>' +
      '<div class="pick-row" role="radiogroup" aria-label="Quick pick">' + [55, 65, 75, 80, 85, 90, 95, 100].map(v => '<button class="pick" id="sp-' + v + '" role="radio" data-act="score-pick" data-v="' + v + '" aria-checked="' + (a.v === v) + '">' + v + '</button>').join('') + '</div>' +
      '<p class="sheet-note">Saved as a ' + esc(subjName(t.subjectId) || 'school') + ' grade.</p><button class="btn school block" id="score-save" data-act="score-save">Save score</button>'
  };
};
D.SHEETS.grades = a => {
  const av = averages(), subs = subjects();
  if (!a.f) a.f = { subjectId: (subs[0] || {}).id || '', v: 85 };
  return {
    title: 'Grades' + (av.all != null ? ' · avg ' + av.all : ''),
    body: (av.rows.length ? '<div>' + av.rows.map(r => '<div class="grade"><span>' + esc(r.name) + '</span><span class="gb"><span style="width:' + D.clamp(r.avg, 0, 100) + '%"></span></span><span class="gv">' + r.avg + '</span></div>').join('') + '</div>' : '<p class="sheet-note">No grades yet.</p>') +
      '<p class="group-title">Add a grade</p><div class="pick-row" role="radiogroup" aria-label="Subject">' + subs.map(s => '<button class="pick" id="gsub-' + esc(s.id) + '" role="radio" data-act="g-subj" data-v="' + esc(s.id) + '" aria-checked="' + (a.f.subjectId === s.id) + '">' + esc(s.name) + '</button>').join('') + '</div>' +
      '<div class="stepper"><button class="step-btn" id="g-m" data-act="g-step" data-d="-1" aria-label="Lower">−</button><span class="val"><span class="num">' + a.f.v + '</span><small>/ 100</small></span><button class="step-btn" id="g-p" data-act="g-step" data-d="1" aria-label="Higher">+</button></div>' +
      '<button class="btn school block" id="g-add" data-act="g-add">Add grade</button>'
  };
};
D.SHEETS.old = () => {
  const old = classify().old;
  return {
    title: old.length + ' older ' + D.plural(old.length, 'item', 'items'),
    body: '<p class="sheet-note">These were due more than two weeks ago. They stay out of your list. Mark them done or remove them.</p>' +
      '<div class="sheet-actions"><button class="btn ghost" id="old-del" data-act="old-del">Remove all</button><button class="btn school" id="old-done" data-act="old-done">Mark all done</button></div>' +
      '<div class="menu-list">' + old.map(x => '<div class="menu-item static"><bdi>' + esc(x.title) + '</bdi><span class="r">' + esc(subjName(x.subjectId)) + '</span></div>').join('') + '</div>'
  };
};
D.SHEETS.schoolmenu = () => ({
  title: 'School',
  body: '<div class="menu-list">' +
    '<button class="menu-item" id="sm-live" data-act="sheet" data-sheet="live">' + ic('clock') + 'Live buses & trains</button>' +
    '<button class="menu-item" id="sm-trip" data-act="trip-open">' + ic('train') + 'Trip & school times</button>' +
    (window.SOCIAL ? '<button class="menu-item" id="sm-friends" data-act="sheet" data-sheet="friends">' + ic('users') + 'Friends</button>' : '') +
    '<button class="menu-item" id="sm-grades" data-act="sheet" data-sheet="grades">' + ic('grid') + 'Grades</button>' +
    '<button class="menu-item" id="sm-subj" data-act="sheet" data-sheet="subjects">' + ic('edit') + 'Subjects</button></div>'
});
D.SHEETS.subjects = () => ({
  title: 'Subjects',
  body: '<p class="sheet-note">Quick-add matches these, so “bio test tue” finds Biology.</p><div class="menu-list">' + subjects().map(s => '<div class="menu-item plan-row"><span class="sdot" style="background:' + esc(s.color || '#888') + '"></span><span class="grow">' + esc(s.name) + '</span>' +
    '<button class="mini" id="sd-' + esc(s.id) + '" data-act="subj-hide" data-id="' + esc(s.id) + '" aria-label="Remove ' + esc(s.name) + '">' + ic('trash', 'xs') + '</button></div>').join('') + '</div>' +
    '<form class="add-row" id="subj-add-form" autocomplete="off"><label class="sr" for="subj-add-in">New subject</label><input id="subj-add-in" placeholder="Add a subject" maxlength="30"><button class="add-btn schbg" id="subj-add" type="submit" aria-label="Add subject">' + ic('plus') + '</button></form>'
});
Object.assign(D.ACT, {
  'hw-toggle': el => toggleHw(el.dataset.id),
  'toggle-done': () => { S.showDone = !S.showDone; renderUpNext(); },
  'it-subj': el => { syncItem(); D.sheetArg().f.subjectId = el.dataset.v; D.renderSheet(); },
  'it-type': el => { syncItem(); D.sheetArg().f.type = el.dataset.v; D.renderSheet(); },
  'it-save': () => {
    syncItem();
    const a = D.sheetArg(), f = a.f;
    if (!f.title.trim()) { D.toast('Add a title first'); return; }
    ensureSubjectsSaved();
    const toTest = f.kind === 'Test' || f.kind === 'Quiz', wasTest = a.kind === 'test';
    if (toTest === wasTest) {
      if (wasTest) patch(K.te, a.id, { name: f.title.trim(), subjectId: f.subjectId, testDate: f.date || null, type: f.kind });
      else patch(K.as, a.id, { title: f.title.trim(), subjectId: f.subjectId, dueDate: f.date || null, type: f.kind === 'Homework' ? 'Homework' : (f.type === 'Homework' ? 'Assignment' : f.type) });
    } else {
      // homework ↔ test live in different lists: move it (the old copy is marked deleted)
      patch(wasTest ? K.te : K.as, a.id, { deleted: true });
      if (toTest) upsert(K.te, { id: newId(), subjectId: f.subjectId, name: f.title.trim(), type: f.kind, testDate: f.date || null, studyStatus: 'Not started', importance: 'Normal' });
      else upsert(K.as, { id: newId(), subjectId: f.subjectId, title: f.title.trim(), type: f.kind === 'Homework' ? 'Homework' : 'Assignment', dueDate: f.date || null, priority: 'Auto', status: 'Not started' });
    }
    D.closeSheet(); render(); D.toast('Saved · ' + f.kind);
  },
  'it-kind': el => { syncItem(); const f = D.sheetArg().f; f.kind = el.dataset.v; if (f.kind === 'Assignment' && (f.type === 'Homework' || f.type === 'Test' || f.type === 'Quiz')) f.type = 'Assignment'; D.renderSheet(); },
  'un-filter': el => { S.filter = el.dataset.v; renderUpNext(); },
  'q-kind': el => { S.qkind = S.qkind === el.dataset.v ? null : el.dataset.v; renderPreview(); },
  'it-del': () => {
    const a = D.sheetArg(), k = a.kind === 'test' ? K.te : K.as;
    patch(k, a.id, { deleted: true }); D.closeSheet(); render();
    D.toast('Removed', () => { patch(k, a.id, { deleted: false }); render(); });
  },
  'score-step': el => { const a = D.sheetArg(); a.v = D.clamp(a.v + (+el.dataset.d), 0, 100); D.renderSheet(); },
  'score-pick': el => { D.sheetArg().v = +el.dataset.v; D.renderSheet(); },
  'score-save': () => {
    const a = D.sheetArg(), t = live(K.te).find(x => x.id === a.id); if (!t) return;
    const g = upsert(K.gr, { id: newId(), subjectId: t.subjectId, type: 'Test', gradeValue: a.v, maxGrade: 100, date: t.testDate || D.todayKey(), weight: null, notes: null, testId: t.id });
    D.closeSheet(); render();
    D.toast('Saved · ' + D.t(subjName(t.subjectId) || 'Grade') + ' ' + a.v, () => { patch(K.gr, g.id, { deleted: true }); render(); });
  },
  'g-subj': el => { D.sheetArg().f.subjectId = el.dataset.v; D.renderSheet(); },
  'g-step': el => { const f = D.sheetArg().f; f.v = D.clamp(f.v + (+el.dataset.d), 0, 100); D.renderSheet(); },
  'g-add': () => {
    const f = D.sheetArg().f; if (!f.subjectId) return;
    ensureSubjectsSaved();
    upsert(K.gr, { id: newId(), subjectId: f.subjectId, type: 'Test', gradeValue: f.v, maxGrade: 100, date: D.todayKey(), weight: null, notes: null });
    D.renderSheet(); renderUpNext(); D.toast('Grade added');
  },
  'old-done': () => { const old = classify().old; old.forEach(x => patch(K.as, x.id, { status: 'Done', completedAt: stamp() })); D.closeSheet(); render(); D.toast('Marked ' + old.length + ' done', () => { old.forEach(x => patch(K.as, x.id, { status: 'Not started', completedAt: null })); render(); }); },
  'old-del': () => { const old = classify().old; old.forEach(x => patch(K.as, x.id, { deleted: true })); D.closeSheet(); render(); D.toast('Removed ' + old.length, () => { old.forEach(x => patch(K.as, x.id, { deleted: false })); render(); }); },
  'subj-hide': el => { ensureSubjectsSaved(); patch(K.subj, el.dataset.id, { hidden: true }); D.renderSheet(); },
  'cal-hide': el => {
    const T = window.TIMETABLE, uid = el.dataset.uid, s = T.settings(school), before = (s.hidden || []).slice();
    school.set(T.KEY, Object.assign({}, s, { hidden: before.concat([uid]) }));
    D.closeSheet(); render();
    D.toast('Hidden · bring it back in Timetable settings', () => { school.set(T.KEY, Object.assign({}, T.settings(school), { hidden: before })); render(); });
  },
  'cal-add': el => {
    const t = calFind(el.dataset.uid); if (!t) return;
    ensureSubjectsSaved();
    const item = upsert(K.te, { id: newId(), calUid: t.uid, subjectId: subjFromHe(t.subject), name: t.title, type: t.quiz ? 'Quiz' : 'Test', testDate: t.date, studyStatus: 'Not started', importance: 'Normal' });
    S.enter = item.id; D.closeSheet(); render();
    D.toast('Added to your tests', () => { patch(K.te, item.id, { deleted: true }); render(); });
  },
});
function syncItem() { const a = D.sheetArg(); if (!a || !a.f) return; const t = $('#it-title'), d = $('#it-date'); if (t) a.f.title = t.value; if (d) a.f.date = d.value; }
document.addEventListener('submit', e => {
  if (!e.target || e.target.id !== 'subj-add-form') return;
  e.preventDefault();
  const inp = $('#subj-add-in'), v = inp.value.trim(); if (!v) return;
  ensureSubjectsSaved();
  upsert(K.subj, { id: newId(), name: D.cap(v), color: COLORS[live(K.subj).length % COLORS.length], hidden: false });
  D.renderSheet(); D.toast('Added ' + D.cap(v));
});
$('#hw-input').addEventListener('input', renderPreview);
$('#hw-form').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#hw-input'), v = inp.value.trim(); if (!v) return;
  addQuick(v); inp.value = ''; S.qkind = null; renderPreview();
});

/* ---------- boot ---------- */
window.SCHOOL_RENDER = renderUpNext; // the timetable (ttui.js) refreshes calendar tests through this
school.on(() => { if (!D.sheetKind()) render(); });
C.load().then(() => renderCommute());
setInterval(() => { if (!D.sheetKind()) renderCommute(); }, 30000);
render();
renderPreview();
D.boot('school');
})();
