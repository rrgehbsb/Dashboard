/* Dashboard v3 — Gym. Same data as the classic gym page (row uid:po-coach):
   dashboard:gym:v1:template = [{id, name, exercises:[{id, name, sets, repMin, repMax,
                                 target:"60kg", step?, bw?, unilateral?, failSets?, notes?}]}]
   dashboard:gym:v1:logs     = {"YYYY-MM-DD": {exId: {set0:"82.5kg x 6", set0R:…, nm, dn},
                                               __new:{dayId:1}}}
   dashboard:gym:v1:activeDay = dayId
   Sets are stored exactly like the classic tracker writes them, so History,
   strength rank and the classic page keep reading them. */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic;
const TPL = 'dashboard:gym:v1:template', LOG = 'dashboard:gym:v1:logs', ACT = 'dashboard:gym:v1:activeDay';
const REST = 90, BACK_AFTER_DAYS = 21;

// Same-day same-exercise conflicts: the incoming side wins (as in the classic page).
function mergeLogs(base, incoming) {
  if (!base || typeof base !== 'object') return incoming || {};
  if (!incoming || typeof incoming !== 'object') return base;
  const out = {};
  new Set(Object.keys(base).concat(Object.keys(incoming))).forEach(dk => {
    const a = base[dk] || {}, b = incoming[dk] || {}, day = {};
    new Set(Object.keys(a).concat(Object.keys(b))).forEach(id => { day[id] = b[id] !== undefined ? b[id] : a[id]; });
    out[dk] = day;
  });
  return out;
}
const gym = D.Row('po-coach', { merge: { [LOG]: mergeLogs } });

/* ---------- demo data (?demo) ---------- */
if (D.DEMO) {
  const ago = n => D.dk(D.dayAt(-n));
  const ex = (id, name, sets, rmin, rmax, target, more) => Object.assign({ id, name, sets, repMin: rmin, repMax: rmax, target }, more || {});
  gym.data[TPL] = [
    { id: 'd1', name: 'Push', exercises: [ex('bench', 'Bench press', 3, 6, 8, '80kg'), ex('ohp', 'Overhead press', 3, 6, 8, '47.5kg'), ex('incl', 'Incline dumbbell press', 3, 8, 10, '27.5kg'), ex('lat', 'Lateral raise', 3, 12, 15, '10kg'), ex('dip', 'Dips', 3, 8, 12, '', { bw: true })] },
    { id: 'd2', name: 'Pull', exercises: [ex('row', 'Barbell row', 3, 6, 8, '67.5kg'), ex('pull', 'Pull-ups', 3, 6, 10, '', { bw: true }), ex('curl', 'Dumbbell curl', 3, 8, 12, '12kg', { unilateral: true })] },
    { id: 'd3', name: 'Legs', exercises: [ex('squat', 'Back squat', 3, 5, 6, '97.5kg'), ex('rdl', 'Romanian deadlift', 3, 8, 10, '77.5kg')] }
  ];
  const L = {};
  L[ago(8)] = { bench: { set0: '80kg x 8', set1: '80kg x 8', set2: '80kg x 7', nm: 'Bench press', dn: 'Push' }, ohp: { set0: '47.5kg x 8', set1: '47.5kg x 8', set2: '47.5kg x 8' }, incl: { set0: '27.5kg x 10', set1: '27.5kg x 9', set2: '27.5kg x 8' }, lat: { set0: '10kg x 15', set1: '10kg x 14', set2: '10kg x 12' }, dip: { set0: '10', set1: '9', set2: '8' } };
  L[ago(5)] = { row: { set0: '67.5kg x 8', set1: '67.5kg x 8', set2: '67.5kg x 7' }, pull: { set0: '8', set1: '7', set2: '6' }, curl: { set0: '12kg x 10', set0R: '12kg x 10', set1: '12kg x 9', set1R: '12kg x 9', set2: '12kg x 8', set2R: '12kg x 8' } };
  L[ago(3)] = { squat: { set0: '97.5kg x 5', set1: '97.5kg x 5', set2: '97.5kg x 5' }, rdl: { set0: '77.5kg x 8', set1: '77.5kg x 8', set2: '77.5kg x 8' } };
  gym.data[LOG] = L;
}

/* ---------- model helpers ---------- */
const tpl = () => { const t = gym.get(TPL); return Array.isArray(t) ? t : []; };
const logs = () => { const l = gym.get(LOG); return (l && typeof l === 'object') ? l : {}; };
const trim = n => String(Math.round((Number(n) || 0) * 100) / 100);
const unit = ex => /lb/i.test((ex && ex.target) || '') ? 'lb' : 'kg';
const stepOf = ex => { if (ex.step) return +ex.step; const tw = parseFloat(ex.target); return (isNaN(tw) || tw > 12) ? 2.5 : 1.25; };
const nSets = ex => Math.max(1, parseInt(ex.sets, 10) || 3);
const rMin = ex => parseInt(ex.repMin, 10) || 8;
const rMax = ex => Math.max(rMin(ex), parseInt(ex.repMax, 10) || 12);
const isSetKey = k => /^set\d+R?$/.test(k);
const isDate = k => /^\d{4}-\d{2}-\d{2}$/.test(k);
const newId = p => p + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);
const fmtDay = dk => D.dShort(D.parseDk(dk));

function parseSet(txt) {
  const raw = String(txt || '').trim();
  if (!raw) return null;
  let m = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:kg|lb)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)/i);
  if (m) return { w: parseFloat(m[1].replace(',', '.')), r: parseFloat(m[2].replace(',', '.')) };
  m = raw.match(/^(\d+(?:\.\d+)?)\s*(?:reps?|\/\s*each)?$/i);
  if (m) return { w: null, r: parseFloat(m[1]) };
  const nums = raw.match(/\d+(?:\.\d+)?/g);
  if (nums && nums.length === 1) return { w: null, r: parseFloat(nums[0]) };
  return null;
}
function cells(ex) {
  const out = [];
  for (let i = 0; i < nSets(ex); i++) {
    if (ex.unilateral) { out.push({ i, side: '', tag: 'L' }); out.push({ i, side: 'R', tag: 'R' }); }
    else out.push({ i, side: '', tag: '' });
  }
  return out;
}
const cellKey = c => 'set' + c.i + c.side;
const fillText = (ex, w, r) => (ex.bw || w == null) ? String(r) : trim(w) + unit(ex) + ' x ' + r;
const showWR = (ex, p) => (ex.bw || p.w == null) ? trim(p.r) + ' reps' : trim(p.w) + '×' + trim(p.r);

function weekStartDk() { const d = D.dayAt(0); d.setDate(d.getDate() - d.getDay()); return D.dk(d); }
function dayHasLog(dl, day) {
  if (!dl || !day) return false;
  return (day.exercises || []).some(e => { const el = dl[e.id]; return el && Object.keys(el).some(k => isSetKey(k) && String(el[k] || '').trim()); });
}
// The date this day's live session belongs to: today if trained today (or a new
// session was started), else the day earlier this week it was trained.
function sessionKey(day) {
  const tk = D.todayKey(), l = logs(), t = l[tk];
  if (!day) return tk;
  if (t && ((t.__new && t.__new[day.id]) || dayHasLog(t, day))) return tk;
  const ws = weekStartDk();
  const prior = Object.keys(l).filter(d => isDate(d) && d >= ws && d < tk && dayHasLog(l[d], day)).sort();
  return prior.length ? prior[prior.length - 1] : tk;
}
function lastDone(day) {
  const l = logs();
  const ds = Object.keys(l).filter(d => isDate(d) && dayHasLog(l[d], day)).sort();
  return ds.length ? ds[ds.length - 1] : null;
}
function prevSession(ex, beforeDk) {
  const l = logs();
  const dates = Object.keys(l).filter(d => isDate(d) && d < beforeDk && l[d] && l[d][ex.id]).sort().reverse();
  for (const d of dates) {
    const log = l[d][ex.id] || {}, sets = [];
    cells(ex).forEach(c => { const p = parseSet(log[cellKey(c)]); if (p) sets.push(p); });
    if (!sets.length) Object.keys(log).filter(isSetKey).forEach(k => { const p = parseSet(log[k]); if (p) sets.push(p); });
    if (sets.length) {
      const ws = sets.map(p => p.w).filter(w => w != null);
      return { date: d, sets, reps: sets.map(p => p.r), weight: ws.length ? Math.max.apply(null, ws) : null };
    }
  }
  return null;
}
// This session's plan, worked out from the last session (classic progression rules).
// After a long break it suggests the same weight again instead of adding more.
function prescription(ex, prev, sk) {
  const lo = rMin(ex), hi = rMax(ex), step = stepOf(ex);
  if (!prev) {
    const tw = parseFloat(ex.target);
    return (ex.bw || isNaN(tw)) ? { w: null, r: lo, action: 'start', label: 'First time' } : { w: tw, r: lo, action: 'start', label: 'First time' };
  }
  const gap = (D.parseDk(sk) - D.parseDk(prev.date)) / 864e5;
  const avg = prev.reps.reduce((a, b) => a + b, 0) / prev.reps.length;
  if (ex.bw || prev.weight == null) {
    if (gap > BACK_AFTER_DAYS) return { w: null, r: Math.max(lo, Math.round(avg)), action: 'back', label: 'Back to it' };
    if (avg >= lo) { const t = Math.ceil(avg) + 1; return { w: null, r: t, action: 'beat', label: 'Go for ' + t + ' reps' }; }
    return { w: null, r: lo, action: 'repeat', label: 'Aim for ' + lo };
  }
  const w = prev.weight;
  if (gap > BACK_AFTER_DAYS) return { w, r: lo, action: 'back', label: 'Back to it' };
  if (avg >= hi) { const nw = Math.round((w + step) / step) * step; return { w: nw, r: lo, action: 'up', label: '+' + trim(nw - w) + ' ' + unit(ex) }; }
  if (avg >= lo) { const t = Math.min(hi, Math.ceil(avg) + 1); return { w, r: t, action: 'beat', label: 'Go for ' + t + ' reps' }; }
  return { w, r: lo, action: 'repeat', label: 'Same as last' };
}
const est1RM = p => (p && p.w != null) ? p.w * (1 + Math.min(p.r, 15) / 30) : 0;

/* ---------- writes ---------- */
function writeCell(ex, day, c, text) {
  const sk = sessionKey(day), all = logs();
  const l = Object.assign({}, all), d = Object.assign({}, l[sk] || {}), e = Object.assign({}, d[ex.id] || {});
  if (text == null) delete e[cellKey(c)]; else e[cellKey(c)] = text;
  e.nm = ex.name; e.dn = day.name;
  d[ex.id] = e; l[sk] = d;
  gym.set(LOG, l);
}
function saveTpl(t) { gym.set(TPL, t); }
function updateDay(dayId, fn) { const t = tpl().map(d => d.id === dayId ? fn(Object.assign({}, d, { exercises: (d.exercises || []).slice() })) : d); saveTpl(t); }

/* ---------- state ---------- */
const S = { day: null, open: {}, justDone: {}, pop: null };
function currentDay() {
  const t = tpl();
  if (!t.length) return null;
  if (S.day) { const d = t.find(x => x.id === S.day); if (d) return d; }
  const l = logs(), today = l[D.todayKey()];
  const trainedToday = t.find(d => today && ((today.__new && today.__new[d.id]) || dayHasLog(today, d)));
  if (trainedToday) return trainedToday;
  const dates = Object.keys(l).filter(isDate).sort().reverse();
  for (const dt of dates) { const i = t.findIndex(d => dayHasLog(l[dt], d)); if (i >= 0) return t[(i + 1) % t.length]; }
  const act = gym.get(ACT);
  return t.find(d => d.id === act) || t[0];
}

/* ---------- render ---------- */
function progress(day) {
  const sk = sessionKey(day), dl = logs()[sk] || {};
  let done = 0, total = 0;
  (day.exercises || []).forEach(ex => cells(ex).forEach(c => { total++; if (String(((dl[ex.id] || {})[cellKey(c)]) || '').trim()) done++; }));
  return { done, total, finished: total > 0 && done === total, sk };
}
function ghostFor(ex, c, el, rx) {
  // follow the previous set you logged in this exercise (same side first), else the plan
  const order = cells(ex);
  const idx = order.findIndex(x => x.i === c.i && x.side === c.side);
  for (let j = idx - 1; j >= 0; j--) {
    const o = order[j];
    if (ex.unilateral && o.side !== c.side) continue;
    const p = parseSet(el[cellKey(o)]);
    if (p) return p;
  }
  return { w: rx.w, r: rx.r };
}
function exHtml(ex, day, sk) {
  const el = (logs()[sk] || {})[ex.id] || {};
  const prev = prevSession(ex, sk), rx = prescription(ex, prev, sk);
  const cs = cells(ex);
  const allDone = cs.every(c => String(el[cellKey(c)] || '').trim());
  if (allDone && !S.open[ex.id] && !S.justDone[ex.id]) {
    const sets = cs.map(c => parseSet(el[cellKey(c)])).filter(Boolean);
    const same = sets.length && sets.every(p => p.w === sets[0].w);
    const line = ex.bw || sets.every(p => p.w == null) ? sets.map(p => trim(p.r)).join('·') + ' reps'
      : same ? trim(sets[0].w) + '×' + sets.map(p => trim(p.r)).join('·') : sets.map(p => showWR(ex, p)).join(' · ');
    let delta = 'First time', up = false;
    if (prev) {
      const topNow = Math.max.apply(null, sets.map(p => p.w == null ? -1 : p.w));
      const dw = Math.round(((topNow < 0 ? 0 : topNow) - (prev.weight || 0)) * 100) / 100;
      const repsNow = sets.reduce((a, p) => a + p.r, 0), repsPrev = prev.reps.reduce((a, b) => a + b, 0);
      if (!ex.bw && prev.weight != null && dw > 0) { delta = '+' + trim(dw) + ' ' + unit(ex) + ' vs last'; up = true; }
      else if ((ex.bw || dw === 0) && repsNow > repsPrev) { delta = '+' + trim(repsNow - repsPrev) + ' reps vs last'; up = true; }
      else delta = dw < 0 ? 'Lighter today' : 'Same as last';
    }
    return '<button class="ex-result" id="exr-' + ex.id + '" data-act="ex-open" data-ex="' + ex.id + '" aria-label="' + esc(ex.name) + ' done, ' + esc(line) + '. Tap to change.">' +
      '<span class="tick">' + ic('check', 'sm') + '</span><span class="body"><span class="nm">' + esc(ex.name) + '</span><span class="sets">' + esc(line) + '</span></span>' +
      '<span class="up">' + (up ? ic('up', 'xs') : '') + esc(delta) + '</span></button>';
  }
  const lastLine = prev
    ? 'Last ' + (prev.weight != null && !ex.bw ? trim(prev.weight) + ' × ' : '') + prev.reps.map(trim).join(' · ') + (ex.bw ? ' reps' : '') + ' · ' + fmtDay(prev.date)
    : 'First time: log what you lift and it will guide you next time';
  const pills = cs.map(c => {
    const v = String(el[cellKey(c)] || '').trim(), logged = !!v, p = logged ? (parseSet(v) || { w: null, r: 0 }) : ghostFor(ex, c, el, rx);
    const key = ex.id + ':' + cellKey(c);
    const txt = (ex.bw || p.w == null) ? trim(p.r) : trim(p.w) + '×' + trim(p.r);
    const lab = 'Set ' + (c.i + 1) + (c.tag ? ' · ' + c.tag : '');
    return '<button class="pill' + (logged ? ' done' : '') + (S.pop === key ? ' pop' : '') + '" id="pill-' + ex.id + '-' + cellKey(c) + '" data-act="pill" data-lp="pill-adjust" data-ex="' + ex.id + '" data-c="' + cellKey(c) + '"' +
      ' aria-pressed="' + logged + '" aria-label="' + lab + ', ' + (ex.bw || p.w == null ? trim(p.r) + ' reps' : trim(p.w) + ' ' + unit(ex) + ' for ' + trim(p.r)) + (logged ? ', logged. Tap to change.' : '. Tap to log.') + '">' +
      '<span class="pv">' + txt + '</span><span class="ps">' + (logged ? ic('check', 'xs') : '') + lab + '</span></button>';
  }).join('');
  const cols = ex.unilateral ? 2 : Math.min(cs.length, cs.length === 4 ? 2 : 3);
  const headBtn = allDone && S.open[ex.id]
    ? '<button class="btn-text gym" id="exc-' + ex.id + '" data-act="ex-close" data-ex="' + ex.id + '">Done</button>'
    : '<button class="icon-btn flat" id="exm-' + ex.id + '" data-act="ex-menu" data-ex="' + ex.id + '" aria-label="Options for ' + esc(ex.name) + '">' + ic('more') + '</button>';
  return '<article class="card ex" id="ex-' + ex.id + '"><div class="ex-head"><div><h3 class="ex-name">' + esc(ex.name) + '</h3>' +
    '<p class="ex-last">' + esc(lastLine) + (prev ? ' <span class="rx rx-' + rx.action + '">' + esc(rx.label) + '</span>' : '') + '</p></div>' + headBtn + '</div>' +
    '<div class="pills" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + pills + '</div></article>';
}
function summaryHtml(day, sk) {
  const dl = logs()[sk] || {};
  let vol = 0, lastVol = 0, comparable = true, sets = 0, best = null;
  (day.exercises || []).forEach(ex => {
    const el = dl[ex.id] || {}, now = cells(ex).map(c => parseSet(el[cellKey(c)])).filter(Boolean);
    sets += now.length;
    now.forEach(p => { if (p.w != null) vol += p.w * p.r; });
    const prev = prevSession(ex, sk);
    if (prev && (D.parseDk(sk) - D.parseDk(prev.date)) / 864e5 <= BACK_AFTER_DAYS) prev.sets.forEach(p => { if (p.w != null) lastVol += p.w * p.r; });
    else if (!ex.bw) comparable = false;
    // new best: heaviest estimated 1-rep max this exercise has ever had
    const top = now.reduce((m, p) => est1RM(p) > est1RM(m) ? p : m, null);
    if (top && top.w != null && !best) {
      const l = logs();
      let prior = 0;
      Object.keys(l).forEach(d => { if (!isDate(d) || d >= sk || !l[d][ex.id]) return; Object.keys(l[d][ex.id]).forEach(k => { if (isSetKey(k)) prior = Math.max(prior, est1RM(parseSet(l[d][ex.id][k]))); }); });
      if (prior > 0 && est1RM(top) > prior + 0.01) best = { ex, p: top };
    }
  });
  const pct = comparable && lastVol > 0 ? Math.round((vol - lastVol) / lastVol * 100) : null;
  const isToday = sk === D.todayKey();
  return '<section class="summary" id="summary" aria-label="Session summary"><p class="eb">' + (isToday ? 'Today' : fmtDay(sk)) + ' · session summary</p><h2>' + esc(day.name) + ' done</h2>' +
    '<div class="stats"><div class="stat"><b>' + sets + '</b><span>sets</span></div>' +
    '<div class="stat"><b>' + (pct == null ? '—' : (pct > 0 ? '+' : '') + (pct === 0 ? 0 : pct) + '%') + '</b><span>' + (pct == null ? 'new baseline' : 'volume vs last') + '</span></div>' +
    '<div class="stat"><b>' + D.fmtN(Math.round(vol)) + '</b><span>kg lifted</span></div></div>' +
    (best ? '<div class="best"><span class="ic">' + ic('up', 'sm') + '</span><div><b>New best · ' + esc(best.ex.name) + '</b>' + trim(best.p.w) + ' × ' + trim(best.p.r) + ' · est. 1RM ' + Math.round(est1RM(best.p)) + ' ' + unit(best.ex) + '</div></div>'
      : '<div class="best"><span class="ic">' + ic('check', 'sm') + '</span><div><b>' + (pct == null ? 'Baseline set' : 'Solid session') + '</b>' + (pct == null ? 'Next time compares against today.' : 'Every set logged.') + '</div></div>') +
    (!isToday ? '<button class="btn ghost" id="gym-new" data-act="gym-new">Start a new ' + esc(day.name) + ' session</button>' : '') + '</section>';
}
function render() {
  const t = tpl(), day = currentDay();
  const head = $('#gym-head'), list = $('#gym-list');
  $('#gym-session').innerHTML = ''; $('#gym-summary').innerHTML = '';
  if (!day) {
    head.innerHTML = '<div><p class="eyebrow">Gym</p><h1 class="gym-title">Your plan</h1></div>';
    list.innerHTML = '<section class="card setup" id="gym-setup"><h2 class="card-title">Set up your gym plan</h2>' +
      '<p class="sheet-note">Pick a split to start. You add the exercises next, and every workout after that is one tap per set.</p>' +
      '<div class="pick-row">' + [['ppl', 'Push · Pull · Legs'], ['ul', 'Upper · Lower'], ['fb', 'Full body']].map(o => '<button class="pick" id="split-' + o[0] + '" data-act="split" data-v="' + o[0] + '">' + o[1] + '</button>').join('') +
      '<button class="pick" id="split-custom" data-act="sheet" data-sheet="plan">Custom</button></div></section>';
    return;
  }
  const pr = progress(day), sk = pr.sk, ld = lastDone(day);
  const idx = t.findIndex(d => d.id === day.id);
  head.innerHTML = '<div><p class="eyebrow">' + (pr.finished ? 'Done' : sk === D.todayKey() ? 'Today’s workout' : 'This week') + ' · ' + D.dShort(D.parseDk(sk)) + '</p>' +
    '<button class="day-pick" id="day-pick" data-act="sheet" data-sheet="day" aria-label="Workout day ' + esc(day.name) + '. Change day"><h1>' + esc(day.name) + '</h1><span class="chev">' + ic('chev-d', 'sm') + '</span></button></div>' +
    '<button class="icon-btn" id="gym-more" data-act="sheet" data-sheet="gymmenu" aria-label="Gym options">' + ic('more') + '</button>' +
    '<p class="gym-meta">Day ' + (idx + 1) + ' of ' + t.length + (ld && ld !== sk ? ' · last done ' + fmtDay(ld) : '') + '</p>';
  if (!(day.exercises || []).length) {
    list.innerHTML = '<section class="card setup"><h2 class="card-title">No exercises in ' + esc(day.name) + ' yet</h2><p class="sheet-note">Add the exercises you do on this day. Next time they’re all waiting for you, pre-filled.</p>' +
      '<button class="btn gym block" id="add-first" data-act="sheet" data-sheet="exedit">' + ic('plus') + 'Add exercise</button></section>';
    return;
  }
  $('#gym-session').innerHTML = '<div class="bar" role="progressbar" aria-label="Sets logged" aria-valuemin="0" aria-valuemax="' + pr.total + '" aria-valuenow="' + pr.done + '"><span style="width:' + (pr.total ? pr.done / pr.total * 100 : 0) + '%"></span></div>' +
    '<span class="cnt">' + D.numEl('gym-done', pr.done) + '<small> / ' + pr.total + ' sets</small></span>';
  if (pr.finished) $('#gym-summary').innerHTML = summaryHtml(day, sk);
  list.innerHTML = day.exercises.map(ex => exHtml(ex, day, sk)).join('') +
    '<button class="btn ghost block" id="add-ex" data-act="sheet" data-sheet="exedit">' + ic('plus') + 'Add exercise</button>';
  S.pop = null;
  D.animate($('#view-gym'));
}

/* ---------- rest timer ---------- */
const rest = { left: 0, total: REST, t: null, hideT: null };
function startRest() {
  clearInterval(rest.t); clearTimeout(rest.hideT);
  rest.total = REST; rest.left = REST;
  const el = $('#rest');
  el.innerHTML = '<span class="lbl" id="rest-lbl">Rest</span><span class="t" id="rest-t">1:30</span>' +
    '<button class="plus" id="rest-plus" data-act="rest-plus">+30 s</button>' +
    '<button id="rest-close" data-act="rest-close" aria-label="Hide rest timer">' + ic('x', 'sm') + '</button><span class="bar" id="rest-bar"></span>';
  el.hidden = false; document.body.classList.add('resting');
  tickRest();
  rest.t = setInterval(() => {
    rest.left--; tickRest();
    if (rest.left <= 0) {
      clearInterval(rest.t); rest.t = null;
      $('#rest-lbl').textContent = 'Rest done';
      const p = $('#rest-plus'); if (p) p.hidden = true;
      try { if (navigator.vibrate) navigator.vibrate([60, 40, 60]); } catch (e) {}
      rest.hideT = setTimeout(stopRest, 2500);
    }
  }, 1000);
}
function tickRest() {
  const l = Math.max(rest.left, 0), t = $('#rest-t'), b = $('#rest-bar');
  if (t) t.textContent = Math.floor(l / 60) + ':' + D.pad(l % 60);
  if (b) b.style.width = (rest.total ? l / rest.total * 100 : 0) + '%';
}
function stopRest() { clearInterval(rest.t); clearTimeout(rest.hideT); rest.t = null; $('#rest').hidden = true; document.body.classList.remove('resting'); }

/* ---------- logging ---------- */
const findEx = id => { const day = currentDay(); return day ? { day, ex: (day.exercises || []).find(e => e.id === id) } : {}; };
const cellOf = (ex, key) => cells(ex).find(c => cellKey(c) === key);
function afterLog(ex, day, wasAllDone) {
  const sk = sessionKey(day), el = (logs()[sk] || {})[ex.id] || {};
  const allDone = cells(ex).every(c => String(el[cellKey(c)] || '').trim());
  if (allDone && !wasAllDone) {
    S.justDone[ex.id] = true;
    setTimeout(() => { delete S.justDone[ex.id]; delete S.open[ex.id]; render(); }, D.reduced() ? 0 : 700);
  }
  render();
  if (progress(day).finished) {
    stopRest();
    setTimeout(() => { const sm = $('#summary'); if (sm) sm.scrollIntoView({ behavior: D.reduced() ? 'auto' : 'smooth', block: 'start' }); }, D.reduced() ? 0 : 750);
  } else if (!wasAllDone) startRest();
}
function tapPill(exId, key) {
  const { day, ex } = findEx(exId); if (!ex) return;
  const sk = sessionKey(day), el = (logs()[sk] || {})[ex.id] || {}, c = cellOf(ex, key);
  if (String(el[key] || '').trim()) { D.openSheet('set', { ex: exId, c: key }); return; }
  const wasAll = cells(ex).every(x => String(el[cellKey(x)] || '').trim());
  const p = ghostFor(ex, c, el, prescription(ex, prevSession(ex, sk), sk));
  writeCell(ex, day, c, fillText(ex, p.w, p.r));
  S.pop = ex.id + ':' + key;
  afterLog(ex, day, wasAll);
}

/* ---------- sheets ---------- */
D.SHEETS.set = a => {
  const { day, ex } = findEx(a.ex); if (!ex) return { title: 'Set', body: '' };
  const sk = sessionKey(day), el = (logs()[sk] || {})[ex.id] || {}, c = cellOf(ex, a.c);
  const logged = parseSet(el[a.c]);
  if (a.w === undefined) { const p = logged || ghostFor(ex, c, el, prescription(ex, prevSession(ex, sk), sk)); a.w = p.w; a.r = p.r; }
  const reps = []; for (let r = Math.max(1, rMin(ex) - 3); r <= rMax(ex) + 4; r++) reps.push(r);
  if (reps.indexOf(a.r) < 0) { reps.push(a.r); reps.sort((x, y) => x - y); }
  return {
    title: ex.name + ' · Set ' + (c.i + 1) + (c.tag ? ' ' + c.tag : ''),
    body: (ex.bw || a.w == null ? '' : '<p class="field-label">Weight</p><div class="stepper"><button class="step-btn" id="set-wm" data-act="set-w" data-d="-1" aria-label="Less weight">−</button>' +
      '<span class="val" aria-live="polite"><span class="num">' + trim(a.w) + '</span><small>' + unit(ex) + '</small></span>' +
      '<button class="step-btn" id="set-wp" data-act="set-w" data-d="1" aria-label="More weight">+</button></div>') +
      '<p class="field-label">Reps</p><div class="rep-grid" role="radiogroup" aria-label="Reps">' +
      reps.map(r => '<button class="rep" id="rep-' + r + '" role="radio" data-act="set-r" data-r="' + r + '" aria-checked="' + (a.r === r) + '">' + r + '</button>').join('') + '</div>' +
      '<div class="sheet-actions">' + (logged ? '<button class="btn ghost" id="set-unlog" data-act="set-unlog">Unlog</button><button class="btn gym" id="set-save" data-act="set-save">Save</button>'
        : '<button class="btn gym block" id="set-save" data-act="set-save">Log set</button>') + '</div>'
  };
};
D.SHEETS.day = () => {
  const cur = currentDay();
  return {
    title: 'Pick a day',
    body: '<div class="menu-list">' + tpl().map(d => { const ld = lastDone(d); return '<button class="menu-item" id="day-' + esc(d.id) + '" data-act="day-set" data-day="' + esc(d.id) + '">' + ic('gym') + esc(d.name) +
      '<span class="r">' + (cur && d.id === cur.id ? 'Open now' : ld ? 'Last ' + fmtDay(ld) : 'Not done yet') + '</span></button>'; }).join('') + '</div>'
  };
};
D.SHEETS.gymmenu = () => ({
  title: 'Gym',
  body: '<div class="menu-list">' +
    '<button class="menu-item" id="gm-history" data-act="sheet" data-sheet="history">' + ic('clock') + 'History</button>' +
    '<button class="menu-item" id="gm-weigh" data-act="sheet" data-sheet="weigh">' + ic('scale') + 'Weigh-in</button>' +
    '<button class="menu-item" id="gm-plan" data-act="sheet" data-sheet="plan">' + ic('edit') + 'Edit plan</button>' +
    (currentDay() ? '<button class="menu-item" id="gm-add" data-act="sheet" data-sheet="exedit">' + ic('plus') + 'Add exercise</button>' : '') + '</div>'
});
D.SHEETS.history = () => {
  const l = logs(), t = tpl(), rows = [];
  Object.keys(l).filter(isDate).sort().reverse().forEach(dk => {
    if (rows.length >= 15) return;
    t.forEach(day => {
      if (!dayHasLog(l[dk], day)) return;
      let n = 0, top = null;
      (day.exercises || []).forEach(ex => { const el = l[dk][ex.id] || {}; Object.keys(el).filter(isSetKey).forEach(k => { const p = parseSet(el[k]); if (!p) return; n++; if (!top || est1RM(p) > est1RM(top.p)) top = { ex, p }; }); });
      rows.push({ dk, name: day.name, n, top });
    });
  });
  return {
    title: 'History',
    body: rows.length ? '<div>' + rows.map(r => '<div class="set-row"><span class="lbl">' + esc(r.name) + '<small>' + fmtDay(r.dk) + ' · ' + r.n + ' sets</small></span>' +
      (r.top ? '<span class="due">' + esc(r.top.ex.name.split(' ')[0]) + ' ' + esc(showWR(r.top.ex, r.top.p)) + '</span>' : '') + '</div>').join('') + '</div>'
      : '<p class="sheet-note">No workouts logged yet. Your sessions show up here.</p>'
  };
};
D.SHEETS.plan = a => {
  const t = tpl();
  return {
    title: 'Edit plan',
    body: '<p class="sheet-note">Your days, in the order you train them. The next workout follows this order.</p>' +
      (t.length ? '<div class="menu-list">' + t.map((d, i) => '<div class="menu-item plan-row"><input class="plan-name" id="dn-' + esc(d.id) + '" data-day="' + esc(d.id) + '" value="' + esc(d.name) + '" maxlength="30" aria-label="Day name">' +
        '<span class="r">' + (d.exercises || []).length + ' ex</span>' +
        (i > 0 ? '<button class="mini" id="du-' + esc(d.id) + '" data-act="day-up" data-day="' + esc(d.id) + '" aria-label="Move ' + esc(d.name) + ' earlier">' + ic('up', 'xs') + '</button>' : '<span class="mini-sp"></span>') +
        '<button class="mini" id="dd-' + esc(d.id) + '" data-act="day-del" data-day="' + esc(d.id) + '" aria-label="Remove ' + esc(d.name) + '">' + ic('trash', 'xs') + '</button></div>').join('') + '</div>' : '') +
      '<form class="add-row" id="day-add-form" autocomplete="off"><label class="sr" for="day-add-in">New day</label><input id="day-add-in" placeholder="Add a day, e.g. Arms" maxlength="30"><button class="add-btn gymbg" id="day-add" type="submit" aria-label="Add day">' + ic('plus') + '</button></form>'
  };
};
D.SHEETS.exmenu = a => {
  const { ex } = findEx(a.ex); if (!ex) return { title: '', body: '' };
  return {
    title: ex.name,
    body: '<div class="menu-list">' +
      '<button class="menu-item" id="em-edit" data-act="sheet" data-sheet="exedit" data-ex="' + ex.id + '">' + ic('edit') + 'Edit exercise</button>' +
      '<button class="menu-item" id="em-up" data-act="ex-move" data-ex="' + ex.id + '" data-d="-1">' + ic('up') + 'Move up</button>' +
      '<button class="menu-item" id="em-del" data-act="ex-del" data-ex="' + ex.id + '">' + ic('trash') + 'Remove from this day</button></div>'
  };
};
D.SHEETS.exedit = a => {
  const { ex } = a.ex ? findEx(a.ex) : {};
  if (!a.f) {
    const e = ex || {};
    a.f = { name: e.name || '', sets: nSets(e), lo: rMin(e), hi: rMax(e), target: parseFloat(e.target) || '', unit: e.target ? unit(e) : 'kg', bw: !!e.bw, uni: !!e.unilateral };
  }
  const f = a.f;
  const step = (id, label, k, min, max) => '<div class="set-row"><span class="lbl">' + label + '</span><span class="mini-step"><button type="button" id="' + id + '-m" data-act="exf" data-k="' + k + '" data-d="-1" aria-label="Less: ' + label + '">−</button><output>' + f[k] + '</output><button type="button" id="' + id + '-p" data-act="exf" data-k="' + k + '" data-d="1" aria-label="More: ' + label + '">+</button></span></div>';
  const sw = (id, label, k, hint) => '<div class="set-row"><span class="lbl">' + label + '<small>' + hint + '</small></span><span class="switch-hit"><button type="button" class="switch" id="' + id + '" role="switch" aria-checked="' + f[k] + '" data-act="exf-sw" data-k="' + k + '" aria-label="' + label + '"></button></span></div>';
  return {
    title: ex ? 'Edit exercise' : 'Add exercise',
    body: '<label class="field-label" for="exf-name">Name</label><input class="text-in" id="exf-name" value="' + esc(f.name) + '" placeholder="e.g. Bench press" maxlength="40" autocomplete="off"' + (ex ? '' : ' data-autofocus') + '>' +
      '<div>' + step('exf-sets', 'Sets', 'sets', 1, 8) + step('exf-lo', 'Reps, at least', 'lo', 1, 30) + step('exf-hi', 'Reps, up to', 'hi', 1, 30) + '</div>' +
      (f.bw ? '' : '<label class="field-label" for="exf-w">Starting weight (' + f.unit + ')</label><input class="text-in" id="exf-w" inputmode="decimal" value="' + esc(String(f.target)) + '" placeholder="e.g. 40">') +
      '<div>' + sw('exf-bw', 'Bodyweight', 'bw', 'Reps only, like pull-ups') + sw('exf-uni', 'One side at a time', 'uni', 'Logs left and right separately') + '</div>' +
      '<button class="btn gym block" id="exf-save" data-act="exf-save">' + (ex ? 'Save' : 'Add to ' + esc((currentDay() || {}).name || 'this day')) + '</button>'
  };
};
D.SHEETS.weigh = a => {
  if (a.w === undefined) { a.w = null; loadWeight(a); }
  return {
    title: 'Weigh-in',
    body: a.w == null && !a.loaded ? '<p class="sheet-note">Loading your last weigh-in…</p>'
      : '<div class="stepper"><button class="step-btn" id="weigh-m" data-act="weigh-step" data-d="-1" aria-label="Less">−</button><span class="val"><span class="num">' + trim(a.w == null ? 70 : a.w) +
        '</span><small>kg</small></span><button class="step-btn" id="weigh-p" data-act="weigh-step" data-d="1" aria-label="More">+</button></div>' +
        '<div class="pick-row">' + ['-1', '-0.5', '+0.5', '+1'].map(v => '<button class="pick" id="wq' + v.replace(/[^\d]/g, '') + (v[0] === '-' ? 'm' : 'p') + '" data-act="weigh-quick" data-v="' + v + '">' + v + '</button>').join('') + '</div>' +
        '<p class="sheet-note">Optional. Used for your food targets. ' + (a.last ? 'Last: ' + trim(a.last.weight) + ' kg on ' + fmtDay(a.last.dateKey) + '.' : 'No weigh-ins yet.') + '</p>' +
        '<button class="btn gym block" id="weigh-save" data-act="weigh-save">Save</button>'
  };
};
async function loadWeight(a) {
  let list = [];
  if (D.DEMO) list = [{ dateKey: D.dk(D.dayAt(-6)), weight: 68.4 }];
  else {
    try {
      await D.fresh();
      const r = await D.sb().from('app_state').select('w:data->po_coach_weights').eq('key', D.uid() + ':health').maybeSingle();
      list = (r.data && Array.isArray(r.data.w)) ? r.data.w : [];
    } catch (e) {}
  }
  const last = list.filter(e => e && e.dateKey).sort((x, y) => x.dateKey.localeCompare(y.dateKey)).pop() || null;
  a.last = last; a.w = last ? +last.weight : 70; a.loaded = true;
  if (D.sheetKind() === 'weigh') D.renderSheet();
}
async function saveWeight(w) {
  if (D.DEMO) return true;
  try {
    await D.fresh();
    const key = D.uid() + ':health';
    const r = await D.sb().from('app_state').select('data').eq('key', key).maybeSingle();
    if (r.error) throw r.error;
    const cur = (r.data && r.data.data) || {};
    const arr = (Array.isArray(cur.po_coach_weights) ? cur.po_coach_weights : []).filter(e => e && e.dateKey !== D.todayKey());
    arr.push({ dateKey: D.todayKey(), weight: Math.round(w * 10) / 10 });
    arr.sort((x, y) => x.dateKey.localeCompare(y.dateKey));
    const up = await D.sb().from('app_state').upsert({ key, data: Object.assign({}, cur, { po_coach_weights: arr, _pushAt: Date.now() }), updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (up.error) throw up.error;
    return true;
  } catch (e) { console.warn('[v3] weigh-in failed', e); return false; }
}

/* ---------- actions ---------- */
const SPLITS = { ppl: ['Push', 'Pull', 'Legs'], ul: ['Upper', 'Lower'], fb: ['Full body'] };
Object.assign(D.ACT, {
  pill: el => tapPill(el.dataset.ex, el.dataset.c),
  'ex-open': el => { S.open[el.dataset.ex] = true; render(); },
  'ex-close': el => { delete S.open[el.dataset.ex]; render(); },
  'ex-menu': el => D.openSheet('exmenu', { ex: el.dataset.ex }),
  'set-w': el => { const a = D.sheetArg(), { ex } = findEx(a.ex); a.w = Math.max(0, Math.round((a.w + (+el.dataset.d) * stepOf(ex)) * 100) / 100); D.renderSheet(); },
  'set-r': el => { D.sheetArg().r = +el.dataset.r; D.renderSheet(); },
  'set-save': () => {
    const a = D.sheetArg(), { day, ex } = findEx(a.ex); if (!ex) return;
    const sk = sessionKey(day), el = (logs()[sk] || {})[ex.id] || {}, wasAll = cells(ex).every(x => String(el[cellKey(x)] || '').trim());
    const was = String(el[a.c] || '').trim();
    writeCell(ex, day, cellOf(ex, a.c), fillText(ex, a.w, a.r));
    S.pop = ex.id + ':' + a.c;
    D.closeSheet();
    if (was) render(); else afterLog(ex, day, wasAll);
  },
  'set-unlog': () => { const a = D.sheetArg(), { day, ex } = findEx(a.ex); if (!ex) return; writeCell(ex, day, cellOf(ex, a.c), null); S.open[ex.id] = true; D.closeSheet(); render(); },
  'rest-plus': () => { rest.left += 30; rest.total = Math.max(rest.total, rest.left); tickRest(); },
  'rest-close': () => stopRest(),
  'day-set': el => { S.day = el.dataset.day; S.open = {}; gym.set(ACT, S.day); D.closeSheet(); stopRest(); render(); window.scrollTo(0, 0); },
  'gym-new': () => {
    const day = currentDay(); if (!day) return;
    const tk = D.todayKey(), l = Object.assign({}, logs()), d = Object.assign({}, l[tk] || {});
    d.__new = Object.assign({}, d.__new || {}); d.__new[day.id] = 1; l[tk] = d;
    gym.set(LOG, l); S.open = {}; render(); window.scrollTo(0, 0);
  },
  split: el => {
    const names = SPLITS[el.dataset.v] || [];
    saveTpl(names.map((n, i) => ({ id: 'day_' + Date.now() + '_' + i, name: n, exercises: [] })));
    S.day = null; render();
    D.toast('Plan created. Add the exercises for each day.');
  },
  'day-up': el => { const t = tpl().slice(), i = t.findIndex(d => d.id === el.dataset.day); if (i > 0) { const x = t.splice(i, 1)[0]; t.splice(i - 1, 0, x); saveTpl(t); D.renderSheet(); render(); } },
  'day-del': el => {
    const before = tpl(), i = before.findIndex(d => d.id === el.dataset.day); if (i < 0) return;
    const gone = before[i];
    saveTpl(before.filter(d => d.id !== gone.id)); if (S.day === gone.id) S.day = null;
    D.renderSheet(); render();
    D.toast('Removed ' + gone.name + '. Its history stays.', () => { const t = tpl().slice(); t.splice(i, 0, gone); saveTpl(t); D.renderSheet(); render(); });
  },
  'ex-move': el => {
    const day = currentDay(); if (!day) return;
    updateDay(day.id, d => { const i = d.exercises.findIndex(e => e.id === el.dataset.ex); if (i > 0) { const x = d.exercises.splice(i, 1)[0]; d.exercises.splice(i - 1, 0, x); } return d; });
    D.closeSheet(); render();
  },
  'ex-del': el => {
    const day = currentDay(); if (!day) return;
    const i = day.exercises.findIndex(e => e.id === el.dataset.ex), gone = day.exercises[i];
    updateDay(day.id, d => { d.exercises.splice(i, 1); return d; });
    D.closeSheet(); render();
    D.toast('Removed ' + gone.name + '. Its history stays.', () => { updateDay(day.id, d => { d.exercises.splice(i, 0, gone); return d; }); render(); });
  },
  exf: el => {
    const f = D.sheetArg().f, k = el.dataset.k, lim = k === 'sets' ? [1, 8] : [1, 30];
    syncExName();
    f[k] = D.clamp(f[k] + (+el.dataset.d), lim[0], lim[1]);
    if (k === 'lo' && f.hi < f.lo) f.hi = f.lo;
    if (k === 'hi' && f.lo > f.hi) f.lo = f.hi;
    D.renderSheet();
  },
  'exf-sw': el => { syncExName(); const f = D.sheetArg().f; f[el.dataset.k] = !f[el.dataset.k]; D.renderSheet(); },
  'exf-save': () => {
    syncExName();
    const a = D.sheetArg(), f = a.f, day = currentDay();
    if (!f.name.trim()) { const n = $('#exf-name'); if (n) n.focus(); D.toast('Give the exercise a name first'); return; }
    if (!day) return;
    const fields = { name: f.name.trim(), sets: f.sets, repMin: f.lo, repMax: f.hi, target: f.bw || f.target === '' ? '' : trim(f.target) + f.unit, bw: f.bw, unilateral: f.uni };
    if (a.ex) updateDay(day.id, d => { const i = d.exercises.findIndex(e => e.id === a.ex); if (i >= 0) d.exercises[i] = Object.assign({}, d.exercises[i], fields); return d; });
    else updateDay(day.id, d => { d.exercises.push(Object.assign({ id: newId('ex'), step: null, failSets: 0, notes: '' }, fields)); return d; });
    D.closeSheet(); render();
    D.toast(a.ex ? 'Saved' : 'Added ' + fields.name + ' to ' + day.name);
  },
  'weigh-step': el => { const a = D.sheetArg(); a.w = Math.round(((a.w || 70) + (+el.dataset.d) * 0.1) * 10) / 10; D.renderSheet(); },
  'weigh-quick': el => { const a = D.sheetArg(); a.w = Math.round(((a.w || 70) + parseFloat(el.dataset.v)) * 10) / 10; D.renderSheet(); },
  'weigh-save': async () => {
    const a = D.sheetArg(), w = a.w; D.closeSheet();
    D.toast((await saveWeight(w)) ? 'Saved · ' + trim(w) + ' kg' : 'Couldn’t save the weigh-in. Check your connection and try again.');
  }
});
D.LP['pill-adjust'] = el => D.openSheet('set', { ex: el.dataset.ex, c: el.dataset.c });
function syncExName() { const n = $('#exf-name'), a = D.sheetArg(); if (n && a && a.f) { a.f.name = n.value; const w = $('#exf-w'); if (w) a.f.target = w.value.replace(',', '.').trim() === '' ? '' : (parseFloat(w.value.replace(',', '.')) || ''); } }
document.addEventListener('change', e => {
  if (e.target && e.target.classList.contains('plan-name')) {
    const v = e.target.value.trim(), id = e.target.dataset.day;
    if (!v) { D.renderSheet(); return; }
    saveTpl(tpl().map(d => d.id === id ? Object.assign({}, d, { name: v }) : d)); render();
  }
});
document.addEventListener('submit', e => {
  if (e.target && e.target.id === 'day-add-form') {
    e.preventDefault();
    const inp = $('#day-add-in'), v = inp.value.trim(); if (!v) return;
    saveTpl(tpl().concat([{ id: 'day_' + Date.now(), name: v, exercises: [] }]));
    D.renderSheet(); render(); D.toast('Added ' + v);
  }
});

/* ---------- boot ---------- */
gym.on(() => { if (!D.sheetKind() || D.sheetKind() === 'history') render(); });
render();
D.boot('gym');
})();
