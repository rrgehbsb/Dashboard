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
  school.data[C.KEY] = { setup: true, legs: { walk1: 3, bus1: 34, buffer: 5, wait2: 5, bus2: 3, walk2: 8 }, days: { 0: { start: '07:45', end: '14:00', by: '08:00' }, 1: { start: '08:00', end: '14:45', by: null }, 2: { start: '07:45', end: '13:30', by: '08:00' }, 3: { start: '08:00', end: '14:45', by: null }, 4: { start: '08:00', end: '13:00', by: null } }, offUntil: null };
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
  live(K.te).forEach(t => out.push({ kind: 'test', id: t.id, title: t.name || 'Test', subjectId: t.subjectId, type: 'Test', date: t.testDate || null }));
  out.forEach(x => { x.d = D.daysFrom(x.date); });
  return out;
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
const S = { showDone: false, folding: {}, pick: null, pickBack: null, enter: null };

/* ---------- commute card ---------- */
function legHtml(icon, label, t, key) {
  return '<div class="leg' + (key ? ' key' : '') + '"><span class="dot">' + ic(icon, 'sm') + '</span><span class="ln">' + label + '</span><span class="tm">' + C.hhmm(t) + '</span></div>';
}
function outJourney(p, L) {
  const herzBus = p.trainArr + L.wait2;
  return '<div class="journey" aria-label="Walk ' + L.walk1 + ' min, bus about ' + L.bus1 + ' min, train, bus ' + L.bus2 + ' min, walk ' + L.walk2 + ' min">' +
    legHtml('walk', 'Walk', p.leave) + legHtml('bus', 'Bus', p.leave + L.walk1) + legHtml('train', 'Train', p.train, true) +
    legHtml('bus', 'Bus', herzBus) + legHtml('walk', 'Walk', herzBus + L.bus2) + legHtml('flag', 'School', p.arrive, true) + '</div>';
}
function backJourney(p, L) {
  return '<div class="journey" aria-label="Walk, bus, train, bus, walk home">' +
    legHtml('walk', 'Walk', p.leave) + legHtml('bus', 'Bus', p.leave + L.walk2 + L.wait2) + legHtml('train', 'Train', p.train, true) +
    legHtml('bus', 'Bus', p.trainArr + 5) + legHtml('walk', 'Walk', p.home - L.walk1) + legHtml('home', 'Home', p.home, true) + '</div>';
}
function altsHtml(opts, cur, act, lateOk) {
  const now = D.nowMin(), list = [];
  for (const o of opts) {
    if (o.leave < now - 1) continue;
    list.push(o);
    if (list.length >= 3 || (lateOk && o.ok === false)) break;
  }
  if (list.length < 2) return '';
  return '<div class="alts" role="group" aria-label="Other trains">' + list.map(o => '<button class="alt" id="alt-' + o.train + '" data-act="' + act + '" data-t="' + o.train + '" aria-pressed="' + (o.train === cur) + '">' +
    C.hhmm(o.train) + (o.ok === false ? ' · late' : '') + '</button>').join('') + '</div>';
}
function renderCommute() {
  const slot = $('#commute-slot'), c = C.cfg(school);
  const tools = '<span class="tools"><span class="tt-tag">' + ic('clock', 'xs') + 'Timetable</span><button class="gear" id="commute-gear" data-act="sheet" data-sheet="commute" aria-label="Trip settings">' + ic('sliders', 'sm') + '</button></span>';
  if (!c) {
    slot.innerHTML = '<section class="commute setup-c" id="commute"><div class="row1"><span class="lbl">Your trip to school</span></div>' +
      '<p class="big sm">When to leave, every school day</p><p class="note">Add your walk and bus times once. The app works out the train and tells you when to leave.</p>' +
      '<button class="alt solid" id="commute-setup" data-act="sheet" data-sheet="commute">Set up my trip</button></section>';
    return;
  }
  if (!C.rail()) { slot.innerHTML = '<section class="commute" id="commute"><div class="row1"><span class="lbl">Your trip</span>' + tools + '</div><p class="note">Loading train times…</p></section>'; return; }
  const ph = C.phase(c), L = c.legs;
  let h = '';
  if (ph.kind === 'off') {
    h = '<div class="row1"><span class="lbl">No school</span>' + tools + '</div><div><p class="big">Back ' + (ph.nextOff != null ? D.DOW_L[D.dayAt(ph.nextOff).getDay()] : 'soon') + '</p><p class="note">Trip paused until ' + D.dShort(D.parseDk(ph.until)) + '.</p></div>';
  } else if (ph.kind === 'morning' && ph.pick) {
    const m = ph.m, p = (S.pick != null && m.opts.find(o => o.train === S.pick)) || ph.pick, mins = p.leave - D.nowMin();
    const amber = p.ok && mins <= 5;
    h = '<div class="row1"><span class="lbl">To school · ' + (m.hasBy ? 'arrive by ' + C.hhmm(m.by) + ' (starts ' + C.hhmm(m.start) + ')' : 'starts ' + C.hhmm(m.start)) + '</span>' + tools + '</div>' +
      '<div><p class="big">Leave ' + C.hhmm(p.leave) + '<small>' + (mins > 0 ? 'in ' + mins + ' min' : mins === 0 ? 'now' : (-mins) + ' min ago') + '</small></p>' +
      '<p class="note">' + (p.ok ? 'Arrive ' + C.hhmm(p.arrive) + ' · ' + p.spare + ' min to spare' : 'Arrives ' + C.hhmm(p.arrive) + ', ' + (-p.spare) + ' min late') + '</p></div>' +
      outJourney(p, L) + altsHtml(m.opts, p.train, 'alt-pick', true);
    slot.innerHTML = '<section class="commute" id="commute" data-area="' + (amber ? 'amber' : 'school') + '" aria-label="Trip to school">' + h + '</section>';
    return;
  } else if (ph.kind === 'school' || ph.kind === 'after') {
    const a = ph.a, p = (S.pickBack != null && a.opts.find(o => o.train === S.pickBack)) || ph.pick || a.best;
    if (p) {
      const mins = p.leave - D.nowMin();
      h = '<div class="row1"><span class="lbl">Going home · school ends ' + C.hhmm(a.end) + '</span>' + tools + '</div>' +
        '<div><p class="big">' + C.hhmm(p.train) + '<small>train home</small></p><p class="note">Leave school by ' + C.hhmm(p.leave) + (ph.kind === 'after' ? (mins > 0 ? ' · in ' + mins + ' min' : ' · now') : '') + ' · home about ' + C.hhmm(p.home) + '</p></div>' +
        backJourney(p, L) + altsHtml(a.opts, p.train, 'alt-back', false);
    } else h = '<div class="row1"><span class="lbl">Going home</span>' + tools + '</div><p class="note">No more trains home today in the timetable.</p>';
  } else if (ph.kind === 'next' && ph.m && ph.m.best) {
    const m = ph.m, p = m.best, when = ph.off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(ph.off).getDay()];
    h = '<div class="row1"><span class="lbl">' + when + ' · ' + (m.hasBy ? 'arrive by ' + C.hhmm(m.by) : 'starts ' + C.hhmm(m.start)) + '</span>' + tools + '</div>' +
      '<div><p class="big">Leave ' + C.hhmm(p.leave) + '<small>' + C.hhmm(p.train) + ' train</small></p><p class="note">Arrive ' + C.hhmm(p.arrive) + ' · ' + p.spare + ' min to spare</p></div>' + outJourney(p, L);
  } else {
    h = '<div class="row1"><span class="lbl">Your trip</span>' + tools + '</div><p class="note">No school days set. Open the trip settings to add them.</p>';
  }
  slot.innerHTML = '<section class="commute" id="commute" aria-label="Trip">' + h + '</section>';
}

/* ---------- up next ---------- */
const CHECK = '<span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg></span>';
function hwRow(x) {
  const late = x.d != null && x.d < 0;
  return '<li class="hw' + (x.done ? ' is-done' : '') + (S.enter === x.id ? ' enter' : '') + '" id="hw-' + x.id + '">' +
    '<button class="check" id="hwc-' + x.id + '" data-act="hw-toggle" data-id="' + x.id + '" aria-pressed="' + !!x.done + '" aria-label="' + (x.done ? 'Done' : 'Mark done') + ': ' + esc(x.title) + '">' + CHECK + '</button>' +
    '<button class="body" data-act="sheet" data-sheet="item" data-kind="hw" data-id="' + x.id + '"><span class="nm">' + esc(x.title) + '</span><span class="sub">' + esc(subjName(x.subjectId) || 'No subject') + (x.type && x.type !== 'Homework' ? ' · ' + esc(x.type) : '') + '</span></button>' +
    '<span class="due' + (x.d != null && x.d >= 0 && x.d <= 1 ? ' soon' : late ? ' late' : '') + '">' + dueLabel(x.d) + '</span></li>';
}
function testRow(x) {
  const past = x.d != null && x.d < 0;
  return '<li class="hw test-row' + (S.enter === x.id ? ' enter' : '') + '" id="hw-' + x.id + '"><span class="check t-ic" aria-hidden="true">' + ic(past ? 'check' : 'clock', 'sm') + '</span>' +
    '<button class="body" data-act="sheet" data-sheet="item" data-kind="test" data-id="' + x.id + '"><span class="nm">' + esc(x.title) + '</span><span class="sub"><span class="test">TEST</span>' + esc(subjName(x.subjectId) || '') + '</span></button>' +
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
function renderUpNext() {
  const c = classify();
  const week = c.open.filter(x => x.d != null && x.d >= 0 && x.d <= 7);
  const test = week.find(x => x.kind === 'test');
  $('#upnext-sum').innerHTML = (test ? '<b>' + esc(test.title.split('·')[0].trim()) + ' ' + (test.d === 0 ? 'today' : test.d === 1 ? 'tomorrow' : dayName(test.d)) + '.</b> ' : '') +
    (week.length ? week.length + ' ' + D.plural(week.length, 'thing', 'things') + ' this week.' : 'Nothing due this week.');
  $('#hw-list').innerHTML = (c.open.map(x => x.kind === 'test' ? testRow(x) : hwRow(x)).join('') + c.scoreable.map(testRow).join('')) ||
    '<li class="empty">Nothing coming up. Add homework or a test above.</li>';
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
function findSubject(word) {
  const w = norm(word);
  if (w.length < 2) return null;
  const subs = subjects();
  for (const s of subs) { const n = norm(s.name); const al = ALIASES[n] || [n]; if (al.indexOf(w) >= 0 || n === w) return s; }
  if (w.length >= 3) for (const s of subs) if (norm(s.name).indexOf(w) === 0) return s;
  return null;
}
function parseQuick(text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let subj = null, type = null, off = null, newSubj = null;
  const rest = [];
  words.forEach(raw => {
    const w = raw.toLowerCase().replace(/[.,!?]/g, '');
    let m;
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
  if (!subj && type && rest.length && rest[0].length >= 2) newSubj = D.cap(rest.shift());
  if (!subj && !newSubj && !type && off == null) return null;
  const isTest = type === 'TEST' || type === 'QUIZ';
  const sname = subj ? subj.name : newSubj || '';
  const extra = rest.join(' ');
  const title = isTest ? ((sname ? sname + ' ' : '') + (type === 'QUIZ' ? 'quiz' : 'test') + (extra ? ' · ' + extra : ''))
    : (extra ? (type || 'Homework') + ' ' + extra : (sname ? sname + ' ' + (type || 'Homework').toLowerCase() : (type || 'Homework')));
  return { subj, newSubj, kind: isTest ? 'test' : 'hw', type: isTest ? 'Test' : (type || 'Homework'), off, title };
}
function renderPreview() {
  const v = $('#hw-input').value.trim(), el = $('#hw-preview');
  if (!v) { el.innerHTML = ''; return; }
  const p = parseQuick(v);
  el.innerHTML = p ? '<span>Will add</span><span class="pc">' + ic(p.kind === 'test' ? 'clock' : 'school', 'xs') + esc((p.subj ? p.subj.name : p.newSubj || 'No subject')) + ' · ' + (p.kind === 'test' ? 'Test' : esc(p.type)) + ' · ' + (p.off == null ? 'No date' : esc(dueLabel(p.off))) + '</span>' + (p.newSubj ? '<span>new subject</span>' : '')
    : '<span>Try a subject, a type and a day, like “bio test tue”</span>';
}
function addQuick(v) {
  const p = parseQuick(v) || { subj: null, newSubj: null, kind: 'hw', type: 'Homework', off: null, title: D.cap(v) };
  ensureSubjectsSaved();
  let subjectId = p.subj ? p.subj.id : '';
  if (p.newSubj) { const s = upsert(K.subj, { id: newId(), name: p.newSubj, color: COLORS[live(K.subj).length % COLORS.length], hidden: false }); subjectId = s.id; }
  const date = p.off == null ? null : D.dk(D.dayAt(p.off));
  const item = p.kind === 'test'
    ? upsert(K.te, { id: newId(), subjectId, name: p.title, testDate: date, studyStatus: 'Not started', importance: 'Normal' })
    : upsert(K.as, { id: newId(), subjectId, title: p.title, type: p.type, dueDate: date, priority: 'Auto', status: 'Not started' });
  S.enter = item.id;
  render();
  const sn = subjName(subjectId), label = p.kind === 'test' ? item.name : (sn && item.title.toLowerCase().indexOf(sn.toLowerCase()) < 0 ? sn + ' · ' + item.title : item.title);
  D.toast('Added · ' + label + (date ? ', ' + dueLabel(p.off) : ''), () => { patch(p.kind === 'test' ? K.te : K.as, item.id, { deleted: true }); render(); });
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
const ASSIGN_TYPES = ['Homework', 'Project', 'Worksheet', 'Reading', 'Study', 'Presentation', 'Essay', 'Lab'];
D.SHEETS.item = a => {
  const isTest = a.kind === 'test', src = (isTest ? live(K.te) : live(K.as)).find(x => x.id === a.id);
  if (!src) return { title: 'Item', body: '<p class="sheet-note">This item was removed.</p>' };
  if (!a.f) a.f = { title: isTest ? src.name : src.title, subjectId: src.subjectId || '', date: (isTest ? src.testDate : src.dueDate) || '', type: src.type || 'Homework' };
  const f = a.f;
  return {
    title: isTest ? 'Test' : 'Homework',
    body: '<label class="field-label" for="it-title">' + (isTest ? 'What' : 'Title') + '</label><input class="text-in" id="it-title" value="' + esc(f.title) + '" maxlength="80" autocomplete="off">' +
      '<p class="field-label">Subject</p><div class="pick-row" role="radiogroup" aria-label="Subject">' + subjects().map(s => '<button class="pick" id="isub-' + esc(s.id) + '" role="radio" data-act="it-subj" data-v="' + esc(s.id) + '" aria-checked="' + (f.subjectId === s.id) + '">' + esc(s.name) + '</button>').join('') + '</div>' +
      '<label class="field-label" for="it-date">' + (isTest ? 'Date' : 'Due') + '</label><input class="text-in" id="it-date" type="date" value="' + esc(f.date) + '">' +
      (isTest ? '' : '<p class="field-label">Type</p><div class="pick-row" role="radiogroup" aria-label="Type">' + ASSIGN_TYPES.map(t => '<button class="pick" id="ity-' + t + '" role="radio" data-act="it-type" data-v="' + t + '" aria-checked="' + (f.type === t) + '">' + t + '</button>').join('') + '</div>') +
      '<div class="sheet-actions"><button class="btn ghost" id="it-del" data-act="it-del">Remove</button><button class="btn school" id="it-save" data-act="it-save">Save</button></div>'
  };
};
D.SHEETS.score = a => {
  const t = live(K.te).find(x => x.id === a.id);
  if (!t) return { title: 'Score', body: '' };
  if (a.v == null) a.v = 85;
  return {
    title: t.name + ' · score',
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
      '<div class="menu-list">' + old.map(x => '<div class="menu-item static">' + esc(x.title) + '<span class="r">' + esc(subjName(x.subjectId)) + '</span></div>').join('') + '</div>'
  };
};
D.SHEETS.schoolmenu = () => ({
  title: 'School',
  body: '<div class="menu-list">' +
    '<button class="menu-item" id="sm-trip" data-act="sheet" data-sheet="commute">' + ic('train') + 'Trip & school times</button>' +
    '<button class="menu-item" id="sm-grades" data-act="sheet" data-sheet="grades">' + ic('grid') + 'Grades</button>' +
    '<button class="menu-item" id="sm-subj" data-act="sheet" data-sheet="subjects">' + ic('edit') + 'Subjects</button></div>'
});
D.SHEETS.subjects = () => ({
  title: 'Subjects',
  body: '<p class="sheet-note">Quick-add matches these, so “bio test tue” finds Biology.</p><div class="menu-list">' + subjects().map(s => '<div class="menu-item plan-row"><span class="sdot" style="background:' + esc(s.color || '#888') + '"></span><span class="grow">' + esc(s.name) + '</span>' +
    '<button class="mini" id="sd-' + esc(s.id) + '" data-act="subj-hide" data-id="' + esc(s.id) + '" aria-label="Remove ' + esc(s.name) + '">' + ic('trash', 'xs') + '</button></div>').join('') + '</div>' +
    '<form class="add-row" id="subj-add-form" autocomplete="off"><label class="sr" for="subj-add-in">New subject</label><input id="subj-add-in" placeholder="Add a subject" maxlength="30"><button class="add-btn schbg" id="subj-add" type="submit" aria-label="Add subject">' + ic('plus') + '</button></form>'
});
const LEGS = [['walk1', 'Walk to your bus stop'], ['bus1', 'Bus to Rosh HaAyin North'], ['buffer', 'Time at the station'], ['wait2', 'Wait for the bus in Herzliya'], ['bus2', 'Bus in Herzliya'], ['walk2', 'Walk to school']];
D.SHEETS.commute = a => {
  if (!a.f) a.f = JSON.parse(JSON.stringify(C.cfg(school) || C.defaults()));
  const f = a.f;
  const tstep = (wd, k) => '<span class="mini-step"><button id="cs-' + wd + k + '-m" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="-5" aria-label="Earlier">−</button><output>' + (f.days[wd][k] || '—') + '</output><button id="cs-' + wd + k + '-p" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="5" aria-label="Later">+</button></span>';
  return {
    title: 'Trip & school times',
    body: '<p class="group-title">Your route</p><div>' + LEGS.map(l => '<div class="set-row"><span class="lbl">' + l[1] + '</span><span class="mini-step"><button id="cl-' + l[0] + '-m" data-act="cs-leg" data-k="' + l[0] + '" data-d="-1" aria-label="Less: ' + l[1] + '">−</button><output>' + f.legs[l[0]] + ' min</output><button id="cl-' + l[0] + '-p" data-act="cs-leg" data-k="' + l[0] + '" data-d="1" aria-label="More: ' + l[1] + '">+</button></span></div>').join('') + '</div>' +
      '<p class="sheet-note">Trains come from the real Rosh HaAyin North ↔ Herzliya timetable. Your bus is an estimate for now.</p>' +
      '<p class="group-title">School days</p><div>' + [0, 1, 2, 3, 4, 5, 6].map(wd => {
        const on = !!(f.days[wd] && f.days[wd].start);
        return '<div class="day-block"><div class="set-row"><span class="lbl">' + D.DOW_L[wd] + '</span><span class="switch-hit"><button class="switch" id="cs-on-' + wd + '" role="switch" aria-checked="' + on + '" data-act="cs-day" data-wd="' + wd + '" aria-label="School on ' + D.DOW_L[wd] + '"></button></span></div>' +
          (on ? '<div class="set-row sub"><span class="lbl">Starts</span>' + tstep(wd, 'start') + '</div><div class="set-row sub"><span class="lbl">Ends</span>' + tstep(wd, 'end') + '</div>' +
            '<div class="set-row sub"><span class="lbl">I can arrive by<small>' + (f.days[wd].by ? 'Plans your trip to this time' : 'Off · plans to the start time') + '</small></span>' + (f.days[wd].by ? tstep(wd, 'by') + '<button class="mini" id="cs-' + wd + 'by-x" data-act="cs-by" data-wd="' + wd + '" aria-label="Turn off arrive-by">' + ic('x', 'xs') + '</button>' : '<button class="pick" id="cs-' + wd + 'by-on" data-act="cs-by" data-wd="' + wd + '">Set</button>') + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<p class="group-title">Holidays</p><div class="set-row"><span class="lbl">No school until<small>' + (f.offUntil ? 'Back on ' + D.dShort(D.parseDk(f.offUntil)) : 'For vacations and days off') + '</small></span><input class="date-in" id="cs-off" type="date" value="' + esc(f.offUntil || '') + '"></div>' +
      '<button class="btn school block" id="cs-save" data-act="cs-save">Save</button>'
  };
};

const addMin = (s, d) => C.hhmm(D.clamp(C.tm(s) + d, 5 * 60, 23 * 60));
Object.assign(D.ACT, {
  'hw-toggle': el => toggleHw(el.dataset.id),
  'toggle-done': () => { S.showDone = !S.showDone; renderUpNext(); },
  'alt-pick': el => { S.pick = +el.dataset.t; renderCommute(); },
  'alt-back': el => { S.pickBack = +el.dataset.t; renderCommute(); },
  'it-subj': el => { syncItem(); D.sheetArg().f.subjectId = el.dataset.v; D.renderSheet(); },
  'it-type': el => { syncItem(); D.sheetArg().f.type = el.dataset.v; D.renderSheet(); },
  'it-save': () => {
    syncItem();
    const a = D.sheetArg(), f = a.f;
    if (!f.title.trim()) { D.toast('Add a title first'); return; }
    ensureSubjectsSaved();
    if (a.kind === 'test') patch(K.te, a.id, { name: f.title.trim(), subjectId: f.subjectId, testDate: f.date || null });
    else patch(K.as, a.id, { title: f.title.trim(), subjectId: f.subjectId, dueDate: f.date || null, type: f.type });
    D.closeSheet(); render(); D.toast('Saved');
  },
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
    D.toast('Saved · ' + (subjName(t.subjectId) || 'Grade') + ' ' + a.v, () => { patch(K.gr, g.id, { deleted: true }); render(); });
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
  'cs-leg': el => { const f = D.sheetArg().f; f.legs[el.dataset.k] = D.clamp(f.legs[el.dataset.k] + (+el.dataset.d), 0, 120); D.renderSheet(); },
  'cs-day': el => { syncOff(); const f = D.sheetArg().f, wd = el.dataset.wd; f.days[wd] = (f.days[wd] && f.days[wd].start) ? { start: null, end: null, by: null } : { start: '08:00', end: '14:00', by: null }; D.renderSheet(); },
  'cs-time': el => { syncOff(); const d = D.sheetArg().f.days[el.dataset.wd], k = el.dataset.k; d[k] = addMin(d[k] || d.start || '08:00', +el.dataset.d); D.renderSheet(); },
  'cs-by': el => { syncOff(); const d = D.sheetArg().f.days[el.dataset.wd]; d.by = d.by ? null : addMin(d.start, 15); D.renderSheet(); },
  'cs-save': () => {
    syncOff();
    const f = Object.assign({}, D.sheetArg().f, { setup: true });
    school.set(C.KEY, f); S.pick = null; S.pickBack = null;
    D.closeSheet(); render(); D.toast('Trip saved');
  }
});
function syncItem() { const a = D.sheetArg(); if (!a || !a.f) return; const t = $('#it-title'), d = $('#it-date'); if (t) a.f.title = t.value; if (d) a.f.date = d.value; }
function syncOff() { const a = D.sheetArg(), i = $('#cs-off'); if (a && a.f && i) a.f.offUntil = i.value || null; }
document.addEventListener('change', e => { if (e.target && e.target.id === 'cs-off') { syncOff(); D.renderSheet(); } });
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
  addQuick(v); inp.value = ''; renderPreview();
});

/* ---------- boot ---------- */
school.on(() => { if (!D.sheetKind()) render(); });
C.loadRail().then(() => renderCommute());
setInterval(() => { if (!D.sheetKind()) renderCommute(); }, 30000);
render();
D.boot('school');
})();
