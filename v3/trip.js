/* Dashboard v3 — the trip to school on the School page: the trip card, the pickers for
   each part of the trip, "plan a different time", the live board ("mini Moovit") and
   trip settings with the stop picker. Planning and live matching live in commute.js.

   The card is the plan in three lines — the bus, the train, Herzliya → school — and each
   line opens its own short list (the suggestion marked) when you want something else.
   What you pick is kept for that day and synced (tripDays). When you change the same
   thing the same way, the card asks once: same as last time? always? Always-habits live
   in tripRules and are listed (and removable) in trip settings. */
(function () {
'use strict';
const D = window.DASH, C = window.COMMUTE, $ = D.$, esc = D.esc, ic = D.ic;
const school = window.SCHOOL_ROW;
C.useRow(school);
const S = { trip: null, lastFetch: 0 };
const HOME_LINES = ['71', '72', '73', '74'];
const bdi = s => '<bdi>' + esc(s) + '</bdi>';
const hh = C.hhmm;

/* ---------- small pieces ---------- */
function badge(l) {
  if (!l || !l.live) return '<span class="st-b">Scheduled</span>';
  const d = Math.round(l.delay);
  if (d >= 2) return '<span class="st-b late"><i></i>Live · ' + d + ' min late</span>';
  if (d <= -2) return '<span class="st-b early"><i></i>Live · ' + (-d) + ' min early</span>';
  return '<span class="st-b ok"><i></i>Live · on time</span>';
}
const etaText = (l, sched) => (l && l.live && Math.abs(l.delay) >= 1) ? '<s>' + hh(sched) + '</s> ' + hh(l.eta) : hh(sched);
const entName = k => (C.SCHOOL[k] ? C.SCHOOL[k].name + ' (' + C.SCHOOL[k].he + ')' : 'school');
const ttOn = () => { const T = window.TIMETABLE, s = T ? T.settings(school) : {}; return !!s.cls && s.trip !== false; };
const wpNote = m => m && m.auto && !m.published && !m.byChanged ? '<p class="note wp">' + ic('clock', 'xs') + 'From the weekly plan: the school hasn’t posted this day’s update yet, so a cancelled first lesson won’t show.</p>' : '';
// "first lesson 07:45 · by 08:00" / "at school by 10:00 · your change"
const startLbl = m => m.byChanged ? 'at school by ' + hh(m.by) + ' · your change' : m.auto ? 'first lesson ' + hh(m.start) + (m.hasBy ? ' · by ' + hh(m.by) : '') : (m.hasBy ? 'arrive by ' + hh(m.by) : 'starts ' + hh(m.start));
const endLbl = a => a.endChanged ? 'leaving school ' + hh(a.end) + ' · your change' : (a.auto ? 'last lesson ends ' : 'school ends ') + hh(a.end);
const earlyTxt = sp => sp > 0 ? sp + ' min early' : sp === 0 ? 'right on time' : (-sp) + ' min late';
const dayWord = dk => { const d = D.daysFrom(dk); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : D.DOW_L[D.parseDk(dk).getDay()]; };
// minutes on the platform before the train: green (your minutes or more), amber (fewer), red (you'd miss it)
function spareChip(min, want) {
  if (min == null || isNaN(min)) return '';
  const cls = min >= want ? 'ok' : min >= 0 ? 'tight' : 'miss';
  return '<span class="sp ' + cls + '"><i></i>' + (min < 0 ? 'Might miss the train' : min + ' min on the platform') + '</span>';
}
// one line of the plan; tap it for the alternatives
function trow(o) {
  return '<button class="trow' + (o.cls ? ' ' + o.cls : '') + '" type="button"' + (o.act ? ' data-act="' + o.act + '"' + (o.data || '') : ' disabled') + '>' +
    '<span class="tr-ic">' + ic(o.icon, 'sm') + '</span><span class="tr-main"><b>' + o.title + '</b><span class="tr-sub">' + o.sub + '</span></span>' +
    '<span class="tr-side"><b>' + o.time + '</b>' + (o.label ? '<span>' + o.label + '</span>' : '') + '</span>' + (o.act ? ic('chev-r', 'sm tr-chev') : '') + (o.chip ? '<span class="tr-chip">' + o.chip + '</span>' : '') + '</button>';
}
const planData = (dk, dir) => ' data-dk="' + dk + '" data-dir="' + dir + '"';

/* ---------- the card ---------- */
function render() {
  const slot = $('#commute-slot'); if (!slot) return;
  const c = C.cfg(school);
  const menu = '<button class="gear" id="trip-menu" data-act="sheet" data-sheet="tripmenu" aria-label="Trip options">' + ic('more', 'sm') + '</button>';
  if (!c) {
    slot.innerHTML = '<section class="commute setup-c" id="commute"><div class="row1"><span class="lbl">Your trip to school</span></div>' +
      '<p class="big sm">When to leave, every school day</p><p class="note">Pick your bus stop and your school times once. The app plans the bus, the train and the bus in Herzliya, and follows them live.</p>' +
      '<button class="alt solid" id="commute-setup" data-act="trip-open">Set up my trip</button></section>';
    return;
  }
  if (!C.rail()) { slot.innerHTML = '<section class="commute" id="commute"><div class="row1"><span class="lbl">Your trip</span><span class="tools">' + menu + '</span></div>' + D.skel('Loading timetables…', ['big', 70, 45]) + '</section>'; return; }
  const ph = C.phase(c), now = D.nowMin();
  maybeFetch(c, ph);
  const tag = lv => '<span class="tt-tag' + (lv && lv.anyLive ? ' on' : '') + '">' + (lv && lv.anyLive ? '<i class="ld"></i>Live' : ic('clock', 'xs') + 'Scheduled') + '</span>';
  let h = '', area = 'school';
  if (ph.kind === 'off') {
    h = '<div class="row1"><span class="lbl">No school</span><span class="tools">' + menu + '</span></div><div><p class="big">' + (ph.nextOff != null ? 'Back on ' + D.DOW_L[D.dayAt(ph.nextOff).getDay()] : 'Back soon') + '</p><p class="note">Trip paused until ' + D.dShort(D.parseDk(ph.until)) + '.</p></div>';
  } else if (ph.kind === 'morning' || (ph.kind === 'next' && ph.m && ph.m.pick)) {
    const m = ph.m, p = m.pick, next = ph.kind === 'next';
    const lv = next ? null : (C.liveView(c, ph, now) || { leave: p.leave, mins: p.leave - now });
    const ar = C.arrivals(c, next ? { kind: 'next', m } : ph, p, lv);
    if (!next && (lv.miss || (!ph.riding && p.ok && lv.mins <= 5))) area = 'amber';
    const when = next ? (ph.off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(ph.off).getDay()]) : ph.riding ? 'On your way' : 'To school';
    h = '<div class="row1"><span class="lbl">' + when + ' · ' + startLbl(m) + '</span><span class="tools">' + tag(lv) + menu + '</span></div>';
    if (ph.riding) {
      const r = C.rideNow(ph, p, ar, now), onBus = p.bus && ar.busArr != null && now < ar.busArr;
      h += '<div><p class="big ride">' + esc(r.big) + '<small>' + esc(r.small) + '</small></p>' +
        '<p class="note">' + (lv.miss ? 'Your bus is running late and may miss the ' + hh(ar.trainDep) + ' train.' : 'At school ' + hh(ar.arrive) + ' · ' + earlyTxt(m.by - ar.arrive) + ' · ' + entName(ar.alt ? ar.alt.ent : p.ent)) + '</p></div>' +
        rowsTo(c, m, p, lv, ar, stageTo(ar, now)) +
        '<button class="alt not-on" id="not-on" data-act="sheet" data-sheet="' + (onBus ? 'buses' : 'trains') + '"' + planData(m.dk, 'to') + '>' + (onBus ? 'Not on it? See the other buses' : 'Not on it? See the other trains') + '</button>';
    } else {
      const mins = next ? null : lv.mins;
      h += '<div><p class="big">Leave ' + hh(next ? p.leave : lv.leave) + (mins != null ? '<small>' + (mins > 0 ? 'in ' + mins + ' min' : mins === 0 ? 'now' : (-mins) + ' min ago') + '</small>' : '') + '</p>' +
        '<p class="note">' + (lv && lv.miss ? 'Your bus is running late and may miss the ' + hh(p.train) + ' train. Check the other buses.' : 'At school ' + hh(ar.arrive) + ' · ' + earlyTxt(m.by - ar.arrive) + ' · ' + entName(ar.alt ? ar.alt.ent : p.ent)) + '</p>' + wpNote(m) + '</div>' +
        habitHtml(m) + rowsTo(c, m, p, lv, ar, -1);
    }
  } else if (ph.kind === 'school' || ph.kind === 'after') {
    const a = ph.a, p = a && a.pick;
    if (p) {
      const live = ph.kind === 'after';
      const lv = live ? (C.liveView(c, Object.assign({}, ph, { pick: p }), now) || { leave: p.leave, mins: p.leave - now }) : null;
      const ar = C.arrivals(c, { kind: 'after' }, p, lv);
      h = '<div class="row1"><span class="lbl">' + (ph.riding ? 'On your way home' : 'Going home · ' + endLbl(a)) + '</span><span class="tools">' + tag(lv) + menu + '</span></div>';
      if (ph.riding) {
        const r = C.rideNow({ kind: 'after' }, p, ar, now), beforeTrain = now < ar.trainDep;
        h += '<div><p class="big ride">' + esc(r.big) + '<small>' + esc(r.small) + '</small></p><p class="note">Home about ' + hh(ar.home) + '</p></div>' +
          rowsHome(c, a, p, lv, ar, stageHome(ar, now)) +
          '<button class="alt not-on" id="not-on" data-act="sheet" data-sheet="' + (beforeTrain ? 'trains' : 'buses') + '"' + planData(a.dk, 'home') + '>' + (beforeTrain ? 'Not on it? See the other trains' : 'Not on it? See the other buses') + '</button>';
      } else {
        const mins = lv ? lv.mins : null;
        h += '<div><p class="big">Leave ' + hh(lv ? lv.leave : p.leave) + (mins != null ? '<small>' + (mins > 0 ? 'in ' + mins + ' min' : 'now') + '</small>' : '') + '</p>' +
          '<p class="note">' + hh(p.train) + ' train · home about ' + hh(ar.home) + '</p></div>' + habitHtml(a) + rowsHome(c, a, p, lv, ar, -1);
      }
    } else h = '<div class="row1"><span class="lbl">Going home</span><span class="tools">' + menu + '</span></div><p class="note">No more trains home today.</p>';
  } else {
    const hol = ttOn() && window.TIMETABLE.holidayOn(D.todayKey());
    h = '<div class="row1"><span class="lbl">' + (hol ? 'No school' : 'Your trip') + '</span><span class="tools">' + menu + '</span></div>' +
      (hol ? '<p class="big">' + bdi(hol.title) + '</p><p class="note">Until ' + D.dShort(D.parseDk(hol.end)) + ' · from the school calendar</p>' : '<p class="note">No school days set. Open the trip settings to add them.</p>');
  }
  if (!c.home.stop) h += '<button class="alt solid hint-btn" id="pick-stop-cta" data-act="trip-open">Pick your bus stop for real bus times</button>';
  slot.innerHTML = '<section class="commute" id="commute" data-area="' + area + '" aria-label="Trip">' + problemsHtml() + h + '</section>';
}
// which part of the trip you're on (−1 = not started): 0 the bus, 1 the train, 2 the last bit
const stageTo = (ar, now) => (ar.busArr != null && now < ar.busArr ? 0 : now < ar.trainArr ? 1 : 2);
const stageHome = (ar, now) => (now < ar.atStation ? 0 : now < ar.trainArr ? 1 : 2);
const rowCls = (i, stage) => (stage < 0 ? '' : i < stage ? 'done' : i === stage ? 'now' : '');

// to school: the bus, the train, Herzliya → school
function rowsTo(c, m, p, lv, ar, stage) {
  const rows = [], want = c.legs.buffer, dd = planData(m.dk, 'to');
  if (p.bus) {
    const b = p.bus, lb = lv && lv.bus, live = !!(lb && lb.live);
    // on the platform: from the live arrival when the bus is tracked, else after its usual delay
    const plat = live && ar.busArr != null ? Math.round((ar.trainDep != null ? ar.trainDep : p.train) - (ar.busArr + C.PLATFORM)) : b.spare;
    rows.push(trow({ icon: 'bus', title: 'Bus ' + esc(b.line) + ' · ' + etaText(lb, b.at), sub: bdi(C.stopName(c.home.stop)), time: hh(live && ar.busArr != null ? ar.busArr : b.off), label: 'at the station',
      chip: spareChip(plat, want), act: 'sheet', data: ' data-sheet="buses"' + dd, cls: rowCls(0, stage) }));
  }
  const lt = lv && lv.train;
  rows.push(trow({ icon: 'train', title: 'Train ' + etaText(lt, p.train), sub: 'Rosh HaAyin North → Herzliya', time: hh(ar.trainArr != null ? ar.trainArr : p.trainArr), label: 'in Herzliya',
    chip: lt && lt.live ? badge(lt) : '', act: 'sheet', data: ' data-sheet="trains"' + dd, cls: rowCls(1, stage) }));
  rows.push(hzRow(c, m, p, ar, rowCls(2, stage)));
  return '<div class="trows">' + rows.join('') + '</div>';
}
// Herzliya → school: the two stops everyone uses, and walking — one tap each
function hzRow(c, m, p, ar, cls) {
  const opts = C.hzOptions(c, m.wd, ar.trainArr != null ? ar.trainArr : p.trainArr);
  const fastest = opts.reduce((x, y) => (y.arrive < x.arrive ? y : x)).kind, cur = ar.alt ? ar.alt.kind : p.hzKind;
  const chips = opts.map(o => '<button type="button" class="hzc' + (o.kind === fastest ? ' fast' : '') + '" id="hz-' + o.kind + '" data-act="hz-pick" data-k="' + o.kind + '" data-dk="' + esc(m.dk) + '" aria-pressed="' + (o.kind === cur) + '"' +
    ' aria-label="' + (o.kind === 'foot' ? 'Walk all the way' : esc(o.nick)) + ' · at school ' + hh(o.arrive) + '">' + (o.kind === 'foot' ? ic('walk', 'xs') : bdi(o.nick)) + '<small>' + hh(o.arrive) + '</small></button>').join('');
  return '<div class="trow hz2' + (cls ? ' ' + cls : '') + '"><span class="tr-ic">' + ic('flag', 'sm') + '</span><span class="tr-main"><b>Herzliya → school</b></span>' +
    '<span class="tr-side"><b>' + hh(ar.arrive) + '</b><span>at school</span></span><span class="hzcs" role="group" aria-label="From Herzliya station">' + chips + '</span></div>';
}
// going home: to Herzliya station, the train, the bus home
function rowsHome(c, a, p, lv, ar, stage) {
  const rows = [], dd = planData(a.dk, 'home');
  rows.push(trow({ icon: p.hz ? 'bus' : 'walk', title: 'Leave school ' + hh(lv ? lv.leave : p.leave), sub: p.hz ? 'Bus ' + esc(p.hz.line) + ' to the station' : 'Walk to Herzliya station', time: hh(ar.atStation), label: 'at the station',
    act: 'sheet', data: ' data-sheet="trains"' + dd, cls: rowCls(0, stage) }));
  const lt = lv && lv.train;
  rows.push(trow({ icon: 'train', title: 'Train ' + etaText(lt, p.train), sub: 'Herzliya → Rosh HaAyin North', time: hh(ar.trainArr), label: 'in Rosh HaAyin',
    chip: lt && lt.live ? badge(lt) : '', act: 'sheet', data: ' data-sheet="trains"' + dd, cls: rowCls(1, stage) }));
  if (p.bus) rows.push(trow({ icon: 'bus', title: 'Bus ' + esc(p.bus.line) + ' · ' + etaText(lv && lv.bus, p.bus.at), sub: 'From the station', time: hh(ar.home), label: 'home', act: 'sheet', data: ' data-sheet="buses"' + dd, cls: rowCls(2, stage) }));
  return '<div class="trows">' + rows.join('') + '</div>';
}

/* ---------- habits: "same as last time?" / "always?" ---------- */
function rulesNow() { const r = school.get(C.RULES_KEY); return r && typeof r === 'object' ? r : {}; }
function daysNow() { const d = school.get(C.DAYS_KEY); return d && typeof d === 'object' ? d : {}; }
const trainWords = s => s === -1 ? 'the train before the suggested one' : s < -1 ? (-s) + ' trains earlier than suggested' : s === 1 ? 'the train after the suggested one' : s + ' trains later than suggested';
const busWords = s => s === -1 ? 'the bus before the suggested one' : s < -1 ? (-s) + ' buses earlier than suggested' : s === 1 ? 'the bus after the suggested one' : s + ' buses later than suggested';
// What you did on earlier days in the same situation. Only offered for a plan you haven't
// changed, and each question only once per choice you made.
function habitFor(P) {
  if (!P || !P.trains) return null;
  const days = daysNow(), R = rulesNow(), asked = R.asked || {}, today = (days[P.dk] || {})[P.dir] || {};
  const prev = Object.keys(days).filter(k => k < P.dk).sort().reverse().map(k => (days[k] || {})[P.dir]).filter(Boolean);
  const ruleT = ((P.dir === 'to' ? R.train : R.home) || {})[P.key];
  if (ruleT == null && today.train == null) {
    const tr = prev.filter(x => x.key === P.key && x.shift != null && x.train != null).slice(0, 2);
    if (tr.length && tr[0].shift !== 0 && P.trains[P.traw + tr[0].shift]) {
      const k = 't:' + P.dir + ':' + P.key, seen = asked[k] || {}, two = tr.length === 2 && tr[1].shift === tr[0].shift;
      const where = P.dir === 'to' ? 'you had to be there by ' + hh(P.by) : 'school ended at ' + hh(P.end);
      if (two && seen.always !== tr[0].at) return { kind: 'train', k, shift: tr[0].shift, always: true, at: tr[0].at, text: 'The last 2 times ' + where + ', you took ' + trainWords(tr[0].shift) + '.' };
      if (!two && seen.last !== tr[0].at) return { kind: 'train', k, shift: tr[0].shift, always: false, at: tr[0].at, text: 'Last time ' + where + ', you took ' + trainWords(tr[0].shift) + '.' };
    }
  }
  if (P.dir === 'to' && P.buses && R.bus == null && today.bus == null && !P.chose.train) {
    const bs = prev.filter(x => x.busShift != null && x.bus != null).slice(0, 2);
    if (bs.length && bs[0].busShift !== 0 && P.buses[P.braw + bs[0].busShift]) {
      const k = 'b', seen = asked[k] || {}, two = bs.length === 2 && bs[1].busShift === bs[0].busShift;
      if (two && seen.always !== bs[0].at) return { kind: 'bus', k, shift: bs[0].busShift, always: true, at: bs[0].at, text: 'The last 2 times you took ' + busWords(bs[0].busShift) + '.' };
      if (!two && seen.last !== bs[0].at) return { kind: 'bus', k, shift: bs[0].busShift, always: false, at: bs[0].at, text: 'Last time you took ' + busWords(bs[0].busShift) + '.' };
    }
  }
  return null;
}
function habitHtml(P) {
  const hb = habitFor(P); if (!hb) return '';
  const d = ' data-kind="' + hb.kind + '" data-k="' + hb.k + '" data-shift="' + hb.shift + '" data-at="' + hb.at + '"' + planData(P.dk, P.dir);
  return '<div class="tsug" role="group" aria-label="Your habit">' + ic('repeat', 'xs') + '<p>' + hb.text + '</p><div class="tsug-b">' +
    '<button type="button" class="tsug-go" data-act="habit" data-do="same"' + d + '>' + (D.daysFrom(P.dk) === 0 ? 'Same today' : 'Same that day') + '</button>' +
    (hb.always ? '<button type="button" data-act="habit" data-do="always"' + d + '>Always</button>' : '') +
    '<button type="button" class="tsug-x" data-act="habit" data-do="no"' + d + ' aria-label="Not now">' + ic('x', 'xs') + '</button></div></div>';
}

/* ---------- saving what you pick (per day, synced) ---------- */
function saveDay(dk, fn) {
  const all = Object.assign({}, daysNow()), before = all[dk] ? JSON.parse(JSON.stringify(all[dk])) : null;
  const rec = Object.assign({}, all[dk] || {}); fn(rec); rec.at = Date.now(); all[dk] = rec;
  const cut = D.dk(D.dayAt(-35)); Object.keys(all).forEach(k => { if (k < cut) delete all[k]; });
  school.set(C.DAYS_KEY, all);
  return () => { const a = Object.assign({}, daysNow()); a[dk] = Object.assign(before || {}, { at: Date.now() }); school.set(C.DAYS_KEY, a); afterChange(); };
}
function saveRules(fn) { const r = JSON.parse(JSON.stringify(rulesNow())); fn(r); school.set(C.RULES_KEY, r); }
function afterChange() { render(); if (D.sheetKind()) D.renderSheet(); if (window.SOCIAL && window.SOCIAL.refresh) window.SOCIAL.refresh(); }
const planOf = (dk, dir) => { const c = C.cfg(school); if (!c || !C.rail() || !dk) return null; const wd = D.parseDk(dk).getDay(); return dir === 'home' ? C.afternoon(c, wd, dk) : C.morning(c, wd, dk); };
function chooseTrain(dk, dir, dep) {
  const P = planOf(dk, dir); if (!P) return;
  const i = dep == null ? -1 : P.trains.findIndex(t => t.dep === dep);
  const undo = saveDay(dk, r => {
    const leg = Object.assign({}, r[dir] || {});
    delete leg.bus; delete leg.busLine; delete leg.busShift;
    if (i < 0) { delete leg.train; delete leg.shift; } else { leg.train = dep; leg.shift = i - P.traw; leg.key = P.key; }
    leg.at = Date.now(); r[dir] = leg;
  });
  D.closeSheet(); afterChange();
  D.toast(i < 0 ? 'Back to the suggested train' : 'Train ' + hh(dep) + ' for ' + dayWord(dk), undo);
}
function chooseBus(dk, dir, at, line) {
  const P = planOf(dk, dir); if (!P || !P.buses) return;
  const i = at == null ? -1 : P.buses.findIndex(b => b.at === at && b.line === line);
  const undo = saveDay(dk, r => {
    const leg = Object.assign({}, r[dir] || {});
    if (i < 0) { delete leg.bus; delete leg.busLine; delete leg.busShift; }
    else { leg.bus = at; leg.busLine = line; leg.busShift = i - P.braw; if (P.ti !== P.tsug) { leg.train = P.trains[P.ti].dep; leg.shift = P.ti - P.traw; leg.key = P.key; } }
    leg.at = Date.now(); r[dir] = leg;
  });
  D.closeSheet(); afterChange();
  D.toast(i < 0 ? 'Back to the suggested bus' : 'Bus ' + line + ' at ' + hh(at) + ' for ' + dayWord(dk), undo);
}

/* ---------- the lists behind each line ---------- */
const tagS = '<span class="ptag">Suggested</span>';
const checkMark = on => (on ? ic('check', 'sm po-ok') : '<span class="po-ok"></span>');
D.SHEETS.trains = a => {
  const P = planOf(a.dk, a.dir);
  if (!P) return { title: 'Trains', body: '<p class="sheet-note">No trains for that day.</p>' };
  const to = a.dir !== 'home', R = rulesNow(), rule = ((to ? R.train : R.home) || {})[P.key];
  const all = P.trains.map((t, i) => [t, i]), list = to ? all.slice(Math.max(0, P.traw - 4), P.traw + 3) : all.slice(0, 6);
  const rows = list.map(([t, i]) => '<button type="button" class="popt' + (i === P.ti ? ' on' : '') + '" data-act="choose-train" data-t="' + t.dep + '"' + planData(P.dk, a.dir) + ' aria-pressed="' + (i === P.ti) + '">' +
    '<span class="po-main"><b>' + hh(t.dep) + ' → ' + hh(t.arr) + '</b><span>Train ' + esc(t.no) + (i === P.tsug ? ' ' + tagS : '') + '</span></span>' +
    (to ? '<span class="po-side"><b>School ' + hh(t.arrive) + '</b><span class="sp ' + (t.ok ? 'ok' : 'miss') + '"><i></i>' + earlyTxt(P.by - t.arrive) + '</span></span>'
      : '<span class="po-side"><b>Leave school ' + hh(t.leave) + '</b><span>' + (t.h.hz ? 'Bus ' + esc(t.h.hz.line) + ' to the station' : 'Walk to Herzliya station') + '</span></span>') +
    checkMark(i === P.ti) + '</button>').join('');
  return {
    title: to ? 'Trains to Herzliya' : 'Trains home',
    body: '<p class="sheet-note">' + esc(D.cap(dayWord(P.dk))) + ' · ' + (to ? 'at school by ' + hh(P.by) : endLbl(P)) + '</p><div class="plist">' + rows + '</div>' +
      '<p class="sheet-note"><span>' + (to ? 'Suggested: the latest train that gets you to school in time.' : 'Suggested: the first train you can make after school.') + '</span>' + (rule ? ' <span>Moved by your habit (trip settings).</span>' : '') + '</p>' +
      (P.chose.train ? '<button class="btn ghost block" data-act="choose-train" data-t=""' + planData(P.dk, a.dir) + '>Back to the suggested train</button>' : '')
  };
};
D.SHEETS.buses = a => {
  const P = planOf(a.dk, a.dir);
  if (!P || !P.buses) return { title: 'Buses', body: '<p class="sheet-note">Pick your bus stop in trip settings to see your buses.</p><button class="btn school block" data-act="trip-open">Trip settings</button>' };
  const c = C.cfg(school), to = a.dir !== 'home', want = c.legs.buffer, t = P.trains[P.ti];
  const all = P.buses.map((b, i) => [b, i]), list = to ? all.filter(([b, i]) => (i >= P.braw - 3 && i <= P.braw + 2 && b.off >= t.dep - 50) || i === P.bi || i === P.bsug) : all;
  // what we know about how late these lines are at this hour
  const lines = Array.from(new Set(list.map(([b]) => b.line.replace(/\D+$/, ''))));
  const known = to ? lines.map(l => [l, C.lateness(l, t.dep - 8)]).filter(x => x[1].known) : [];
  const lateNote = !to ? '' : known.length ? known.map(([l, x]) => '<span>' + (x.usual > 0 ? 'Line ' + esc(l) + ' usually reaches the station about ' + x.usual + ' min late at this hour' : 'Line ' + esc(l) + ' is usually on time at this hour') + (x.safe > x.usual ? ' (up to ' + x.safe + ' min late on most days).' : '.') + '</span>').join(' ') + ' <span>Measured on real trips over the last weeks.</span>'
    : 'We don’t know these lines’ delays at this hour yet, so we count on about ' + C.LATE_DEFAULT + ' min.';
  const rows = list.map(([b, i]) => '<button type="button" class="popt' + (i === P.bi ? ' on' : '') + '" data-act="choose-bus" data-t="' + b.at + '" data-line="' + esc(b.line) + '"' + planData(P.dk, a.dir) + ' aria-pressed="' + (i === P.bi) + '">' +
    '<span class="po-main"><b>' + esc(b.line) + ' · ' + hh(b.at) + '</b><span>' + (to ? '→ station ' + hh(b.off) : '→ home about ' + hh(b.off + c.legs.walk1)) + (i === P.bsug ? ' ' + tagS : '') + '</span></span>' +
    '<span class="po-side">' + (to ? spareChip(b.spare, want) : '<span class="sp ok"><i></i>' + Math.max(0, b.at - t.arr) + ' min after the train</span>') + '</span>' +
    checkMark(i === P.bi) + '</button>').join('');
  return {
    title: to ? 'Buses to the ' + hh(t.dep) + ' train' : 'Buses home',
    body: '<p class="sheet-note">' + esc(D.cap(dayWord(P.dk))) + ' · ' + (to ? 'from ' + bdi(C.stopName(c.home.stop)) + ' · ' + want + ' min on the platform' : 'the ' + hh(t.dep) + ' train arrives ' + hh(t.arr)) + '</p>' +
      '<div class="plist">' + rows + '</div>' + (lateNote ? '<p class="sheet-note">' + lateNote + '</p>' : '') +
      (P.chose.bus ? '<button class="btn ghost block" data-act="choose-bus" data-t=""' + planData(P.dk, a.dir) + '>Back to the suggested bus</button>' : '') +
      (to ? '<button class="link" data-act="trip-open">Change the minutes on the platform</button>' : '')
  };
};
D.SHEETS.tripmenu = () => {
  const c = C.cfg(school), ph = c && C.rail() ? C.phase(c) : null;
  const dk = ph && ph.kind === 'next' && ph.off != null ? D.dk(D.dayAt(ph.off)) : D.todayKey();
  return {
    title: 'Trip',
    body: '<div class="menu-list">' +
      '<button class="menu-item" id="tm-plan" data-act="sheet" data-sheet="tripplan" data-dk="' + dk + '">' + ic('cal') + 'Plan a different time</button>' +
      '<button class="menu-item" id="tm-live" data-act="sheet" data-sheet="live">' + ic('radar') + 'Live buses & trains</button>' +
      '<button class="menu-item" id="tm-set" data-act="trip-open">' + ic('sliders') + 'Trip settings</button>' +
      '<button class="menu-item" id="tm-how" data-act="sheet" data-sheet="tripinfo">' + ic('info') + 'How it works</button></div>'
  };
};

/* ---------- plan a different time (a day, when to be at school, when to leave) ---------- */
function schoolDays(c) {
  const out = [];
  for (let off = 0; off < 8 && out.length < 6; off++) { const d = D.dayAt(off), dk = D.dk(d); if (C.isSchoolDay(c, d.getDay(), dk)) out.push(dk); }
  return out;
}
D.SHEETS.tripplan = a => {
  const c = C.cfg(school); if (!c || !C.rail()) return { title: 'Plan a different time', body: '' };
  const days = schoolDays(c);
  if (!a.dk || days.indexOf(a.dk) < 0) a.dk = days[0];
  if (!a.dk) return { title: 'Plan a different time', body: '<p class="sheet-note">No school days coming up.</p>' };
  const wd = D.parseDk(a.dk).getDay(), T = C.times(c, wd, a.dk), rec = daysNow()[a.dk] || {};
  if (a.by == null) a.by = rec.by != null ? rec.by : T.by;
  if (a.end == null) a.end = rec.end != null ? rec.end : T.end;
  const m = C.morning(c, wd, a.dk, { by: a.by }), h = C.afternoon(c, wd, a.dk, { end: a.end });
  const stepper = (act, v) => '<span class="mini-step"><button type="button" data-act="' + act + '" data-d="-5" aria-label="Earlier">−</button><output>' + hh(v) + '</output><button type="button" data-act="' + act + '" data-d="5" aria-label="Later">+</button></span>';
  const mp = m && m.pick, hp = h && h.pick, changed = a.by !== (rec.by != null ? rec.by : T.by) || a.end !== (rec.end != null ? rec.end : T.end);
  return {
    title: 'Plan a different time',
    body: '<div class="pick-row" role="radiogroup" aria-label="Which day">' + days.map(dk => '<button type="button" class="pick" role="radio" data-act="tp-day" data-dk="' + dk + '" aria-checked="' + (dk === a.dk) + '">' + esc(D.cap(dayWord(dk))) + '</button>').join('') + '</div>' +
      '<p class="group-title">To school</p>' +
      '<div class="set-row"><span class="lbl">At school by<small>' + (T.auto ? 'first lesson ' + hh(T.start) : 'usually ' + hh(T.by)) + '</small></span>' + stepper('tp-by', a.by) + '</div>' +
      '<p class="tp-prev">' + (mp ? 'Leave ' + hh(mp.leave) + (mp.bus ? ' · bus ' + esc(mp.bus.line) + ' ' + hh(mp.bus.at) : '') + ' · ' + hh(mp.train) + ' train · at school ' + hh(mp.arrive) : 'No train gets you there by then.') + '</p>' +
      '<p class="group-title">Going home</p>' +
      '<div class="set-row"><span class="lbl">Leave school at<small>' + (T.auto ? 'last lesson ends ' : 'school ends ') + hh(T.end) + '</small></span>' + stepper('tp-end', a.end) + '</div>' +
      '<p class="tp-prev">' + (hp ? 'Leave ' + hh(hp.leave) + ' · ' + hh(hp.train) + ' train · home about ' + hh(hp.home) : 'No more trains home that day.') + '</p>' +
      '<div class="sheet-actions">' + (rec.by != null || rec.end != null ? '<button class="btn ghost" data-act="tp-reset">Back to the timetable</button>' : '') +
      '<button class="btn school" data-act="tp-save"' + (changed ? '' : ' disabled') + '>Save for ' + esc(dayWord(a.dk)) + '</button></div>'
  };
};

/* ---------- problems + how it works ---------- */
function problems() {
  const st = C.health(), out = [];
  if (st.expired || st.stale) out.push('<b>Problem:</b> the timetable hasn’t updated for ' + st.age + ' days, so planned times may be wrong. Live times still work. Let the app owner know.');
  if (st.liveDown) out.push('<b>Problem:</b> live data isn’t loading right now, so these times come from the timetable only.');
  return out;
}
const problemsHtml = () => problems().map(p => '<p class="problem" role="alert">' + ic('info', 'xs') + '<span>' + p + '</span></p>').join('');
D.SHEETS.tripinfo = () => {
  const st = C.health();
  const row = (t, d) => '<div class="info-row"><b>' + t + '</b><span>' + d + '</span></div>';
  return {
    title: 'How live times work',
    body: problemsHtml() + '<div class="info-list">' +
      row('The plan', 'First the train: the latest one that gets you to school in time. Then the bus to it: the latest one that still leaves you your minutes on the platform. Tap any line of the plan to pick something else; it’s kept for that day.') +
      row('Bus delays', 'Buses here are often late. The app knows how late each line usually reaches the station at each hour (from real trips over the last weeks) and plans for that, so your minutes on the platform hold on most days.') +
      row('Your habits', 'Change the same thing twice and the card asks if you want it like last time, or always. Habits you keep are in trip settings, where you can remove them.') +
      row('Live', 'The bus or train is being tracked by GPS right now. The time is when it will really get there.') +
      row('Scheduled', 'It hasn’t started its route yet, so the time comes from the official timetable.') +
      row('Orange card', 'Leave within 5 minutes, or your bus is late enough that you might miss the train.') +
      row('In Herzliya', 'Every morning the card shows the two stops everyone gets off at, fastest first. <b>החדש</b> = ז\'בוטינסקי/הרב קוק, right by the New High School entrance (bus 34 and others). <b>הליכה</b> = בן ציון מיכאלי/יוסף נבו, one or two stops from the station, then a short walk to the main entrance. Tap one to use it today; pick your usual one in trip settings. Walking the whole way (about 15 min) is there too.') +
      row('School times', 'Once you pick your class (Timetable on the School page), the trip follows your real day: on time for your first lesson, home after your last. The school posts changes around 20:00 the evening before, so a cancelled first lesson means a later bus. Until then it uses the weekly plan.') +
      row('Updates', 'The bus and train timetable updates itself every Sunday and Wednesday' + (st.age != null ? ' (last update ' + (st.age === 0 ? 'today' : st.age === 1 ? 'yesterday' : st.age + ' days ago') + ')' : '') + '. If it’s more than ' + C.STALE_DAYS + ' days old, the card shows “Problem”: planned times may be wrong.') +
      row('Where it comes from', 'The Ministry of Transport’s official timetable and live feed, the same data Moovit uses. Bus delays: the Public Knowledge Workshop’s open-bus archive.') +
      '</div>'
  };
};

/* ---------- live data refresh ---------- */
let fetching = false;
function maybeFetch(c, ph) {
  if (fetching || Date.now() - S.lastFetch < 25000 || document.hidden) return;
  if (!ph || !(ph.kind === 'morning' || ph.kind === 'after' || D.sheetKind() === 'live')) return;
  fetching = true; S.lastFetch = Date.now();
  C.fetchLive(C.watchStops(c, ph)).then(() => { fetching = false; render(); if (D.sheetKind() === 'live') D.renderSheet(); });
}
function planHz(c) { const ph = c && C.rail() ? C.phase(c) : null, p = ph && (ph.pick || (ph.m && ph.m.pick) || (ph.a && ph.a.pick)); return p && p.hz ? p.hz : null; }
function boardStops(c) { const hz = planHz(c); return [c && c.home.stop, C.RH_STATION, C.HZ_STATION, hz ? hz.from : null].filter(Boolean); }
function refreshBoard() {
  const c = C.cfg(school) || C.defaults();
  S.lastFetch = Date.now();
  C.fetchLive(boardStops(c)).then(() => { if (D.sheetKind() === 'live') D.renderSheet(); render(); });
}

/* ---------- live board ---------- */
const nowMin = () => D.nowMin();
function busRows(code, lines, max) {
  const wd = D.dayAt(0).getDay(), now = nowMin();
  const vs = (C.live().stops[code] || []).filter(v => !lines || !lines.length || lines.some(l => v.line.replace(/\D+$/, '') === l || v.line === l));
  const rows = vs.map(v => {
    const eta = C.isoMin(v.eta), sched = C.schedAt(code, v.line, v.dep ? C.isoMin(v.dep) : null, wd);
    return { v, eta, sched, delay: sched != null ? eta - sched : null };
  }).filter(r => r.eta != null && r.eta >= now - 1).sort((a, b) => a.eta - b.eta).slice(0, max || 6);
  if (!rows.length) return '<p class="sheet-note">No buses expected right now.</p>';
  return '<div class="board">' + rows.map(r => {
    const mins = r.eta - now, st = !r.v.live ? '<span class="st-b">Scheduled</span>' : r.delay == null ? '<span class="st-b ok"><i></i>Live</span>' : badge({ live: true, delay: r.delay });
    // the minutes and the clock time are when it really arrives: any delay is already counted in
    const vs2 = r.delay != null && r.v.live && Math.abs(r.delay) >= 2 ? ' · timetable said ' + hh(r.sched) : '';
    return '<div class="bd-row"><span class="ln-pill">' + esc(r.v.line) + '</span><div class="bd-main"><b>' + (mins <= 0 ? 'Arriving now' : 'in ' + mins + ' min') + '</b><span>Arrives ' + hh(r.eta) + vs2 + ' · to ' + bdi(r.v.dest || r.v.destEn) + '</span></div>' + st + '</div>';
  }).join('') + '</div>';
}
function trainRows(station, dir, max) {
  const wd = D.dayAt(0).getDay(), now = nowMin();
  const list = C.trainsOf(dir, wd).filter(t => t.dep >= now - 2).slice(0, max || 4);
  if (!list.length) return '<p class="sheet-note">No more trains today.</p>';
  return '<div class="board">' + list.map(t => {
    const l = C.liveTrain(station, t.dep, t.no), when = l && l.live ? l.eta : t.dep, mins = when - now;
    const moved = l && l.live && Math.abs(l.delay) >= 2;
    return '<div class="bd-row"><span class="ln-pill train">' + ic('train', 'xs') + '</span><div class="bd-main"><b>' + (mins <= 0 ? 'Leaving now' : 'in ' + mins + ' min') + '</b><span>Leaves ' + hh(when) + (moved ? ' · timetable said ' + hh(t.dep) : '') + ' · train ' + esc(t.no) + ' · arrives ' + hh(t.arr + (l && l.live ? Math.max(0, l.delay) : 0)) + '</span></div>' + badge(l) + '</div>';
  }).join('') + '</div>';
}
D.SHEETS.live = () => {
  const c = C.cfg(school), lv = C.live(), age = lv.at ? Math.round((Date.now() - lv.at) / 1000) : null;
  if (Date.now() - S.lastFetch > 25000) setTimeout(refreshBoard, 0);
  const sec = (title, body) => '<p class="group-title">' + title + '</p>' + body;
  let body = problemsHtml();
  if (c && c.home.stop) body += sec('Your stop · ' + bdi(C.stopName(c.home.stop)), busRows(c.home.stop, c.home.lines && c.home.lines.length ? c.home.lines : HOME_LINES, 6));
  else body += '<button class="menu-item" id="board-pick" data-act="trip-open">' + ic('bus') + 'Pick your bus stop to see its buses here</button>';
  body += sec('Rosh HaAyin North → Herzliya', trainRows(C.RH_STATION, 'toHerzliya', 4));
  body += sec('Herzliya → Rosh HaAyin North', trainRows(C.HZ_STATION, 'toRoshHaAyin', 4));
  const hzp = planHz(c);
  if (hzp) body += sec('Herzliya · ' + bdi(C.stopName(hzp.from)), busRows(hzp.from, null, 5));
  body += '<p class="sheet-note"><span>' + (lv.at ? 'Updated ' + (age < 60 ? 'just now' : Math.round(age / 60) + ' min ago') + '.' : 'Loading live data…') + '</span> ' +
    '“Live” means the bus or train is being tracked right now; “Scheduled” means it hasn’t started yet, so the time is from the timetable. Live data comes from the Ministry of Transport.</p>' +
    '<div class="sheet-actions"><button class="btn ghost" id="board-how" data-act="sheet" data-sheet="tripinfo">' + ic('info') + 'How it works</button><button class="btn ghost" id="board-refresh" data-act="board-refresh">' + ic('repeat') + 'Refresh</button></div>';
  return { title: 'Live buses & trains', body };
};

/* ---------- trip settings ---------- */
function work() {
  if (!S.trip) S.trip = JSON.parse(JSON.stringify(C.cfg(school) || C.defaults()));
  return S.trip;
}
const step = (id, label, val, act, k, hint) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="mini-step"><button id="' + id + '-m" data-act="' + act + '" data-k="' + k + '" data-d="-1" aria-label="Less: ' + label + '">−</button><output>' + val + ' min</output><button id="' + id + '-p" data-act="' + act + '" data-k="' + k + '" data-d="1" aria-label="More: ' + label + '">+</button></span></div>';
const pickRow = (id, label, code, act, disabled) => '<button class="menu-item pick-stop" id="' + id + '" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '><span class="grow"><small>' + label + '</small>' + (code ? bdi(C.stopName(code)) : '<span class="muted">Choose…</span>') + '</span>' + ic('chev-r', 'sm') + '</button>';
// the habits you kept, in words, each removable
function habitsHtml() {
  const R = rulesNow(), rows = [];
  Object.keys(R.train || {}).sort().forEach(k => { const s = +R.train[k]; if (s) rows.push(['train', k, 'At school by ' + k + ': ' + trainWords(s)]); });
  Object.keys(R.home || {}).sort().forEach(k => { const s = +R.home[k]; if (s) rows.push(['home', k, 'School ends ' + k + ': ' + trainWords(s)]); });
  if (+R.bus) rows.push(['bus', '', 'Every morning: ' + busWords(+R.bus)]);
  if (!rows.length) return '';
  return '<p class="group-title">Your habits</p><div class="menu-list">' + rows.map(r => '<div class="menu-item static habit-row"><span class="grow">' + r[2] + '</span><button class="mini" data-act="habit-rm" data-kind="' + r[0] + '" data-k="' + esc(r[1]) + '" aria-label="Remove">' + ic('x', 'xs') + '</button></div>').join('') + '</div>' +
    '<p class="sheet-note">Made when you said “Always” on the trip card.</p>';
}
D.SHEETS.commute = () => {
  const f = work(), hz = f.hz, home = f.home;
  const tstep = (wd, k) => '<span class="mini-step"><button id="cs-' + wd + k + '-m" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="-5" aria-label="Earlier">−</button><output>' + (f.days[wd][k] || '—') + '</output><button id="cs-' + wd + k + '-p" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="5" aria-label="Later">+</button></span>';
  return {
    title: 'Trip & school times',
    body:
      '<p class="group-title">In Rosh HaAyin</p>' +
      '<div class="pick-row" role="group" aria-label="Your bus lines">' + HOME_LINES.map(l => '<button class="pick" id="hl-' + l + '" data-act="home-line" data-v="' + l + '" aria-pressed="' + (home.lines.indexOf(l) >= 0) + '">' + l + '</button>').join('') + '</div>' +
      '<div class="menu-list">' + pickRow('pick-home', 'Your bus stop', home.stop, 'pick-home') + '</div>' +
      '<div>' + step('cl-walk1', 'Walk to your stop', f.legs.walk1, 'cs-leg', 'walk1') + step('cl-buffer', 'On the platform before the train', f.legs.buffer, 'cs-leg', 'buffer', 'After the walk from the bus, and after its usual delay') +
      (home.stop ? '' : step('cl-bus1', 'Bus ride (estimate)', f.legs.bus1, 'cs-leg', 'bus1', 'Until you pick your stop')) + '</div>' +
      '<p class="group-title">In Herzliya</p><p class="sheet-note">Two stops, the ones everyone uses: <b>החדש</b> (ז\'בוטינסקי/הרב קוק, right by the New High School entrance) and <b>הליכה</b> (בן ציון מיכאלי/יוסף נבו, then a short walk to the main entrance). The trip card shows both every morning. Pick your usual one:</p>' +
      '<div class="seg hz-seg" role="radiogroup" aria-label="Your usual way from Herzliya station">' + [['auto', 'Fastest'], ['chadash', 'החדש'], ['halicha', 'הליכה'], ['foot', 'Walk']].map(o => '<button id="hzp-' + o[0] + '" role="radio" data-act="hz-mode" data-v="' + o[0] + '" aria-checked="' + ((hz.prefer || (hz.mode === 'walk' ? 'foot' : 'auto')) === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      habitsHtml() +
      (ttOn() ? '<p class="group-title">School times</p><p class="sheet-note">Your trip follows your class timetable: it gets you there for your first lesson and plans the way home after your last, even when lessons are cancelled. The days below are only a backup for days the timetable can’t tell (like a school trip).</p><button class="btn ghost block" id="cs-tt" data-act="sheet" data-sheet="ttset">Timetable settings</button><p class="group-title">Backup school days</p>' : '<p class="group-title">School days</p>') +
      '<div>' + [0, 1, 2, 3, 4, 5, 6].map(wd => {
        const on = !!(f.days[wd] && f.days[wd].start);
        return '<div class="day-block"><div class="set-row"><span class="lbl">' + D.DOW_L[wd] + '</span><span class="switch-hit"><button class="switch" id="cs-on-' + wd + '" role="switch" aria-checked="' + on + '" data-act="cs-day" data-wd="' + wd + '" aria-label="School on ' + D.DOW_L[wd] + '"></button></span></div>' +
          (on ? '<div class="set-row sub"><span class="lbl">Starts</span>' + tstep(wd, 'start') + '</div><div class="set-row sub"><span class="lbl">Ends</span>' + tstep(wd, 'end') + '</div>' +
            '<div class="set-row sub"><span class="lbl">I can arrive by<small>' + (f.days[wd].by ? 'Plans your trip to this time' : 'Off · plans to the start time') + '</small></span>' + (f.days[wd].by ? tstep(wd, 'by') + '<button class="mini" id="cs-' + wd + 'by-x" data-act="cs-by" data-wd="' + wd + '" aria-label="Turn off arrive-by">' + ic('x', 'xs') + '</button>' : '<button class="pick" id="cs-' + wd + 'by-on" data-act="cs-by" data-wd="' + wd + '">Set</button>') + '</div>' : '') + '</div>';
      }).join('') + '</div>' +
      '<p class="group-title">Holidays</p><div class="set-row"><span class="lbl">No school until<small>' + (f.offUntil ? 'Back on ' + D.dShort(D.parseDk(f.offUntil)) : 'For vacations and days off') + '</small></span><input class="date-in" id="cs-off" type="date" value="' + esc(f.offUntil || '') + '"></div>' +
      '<button class="btn school block" id="cs-save" data-act="cs-save">Save</button>'
  };
};

/* ---------- your bus stop ---------- */
function homeStopList(f) {
  const seen = new Map();
  C.homeRoutes('to', f.home.lines.length ? f.home.lines : HOME_LINES).forEach(r => r.stops.slice(0, -1).forEach((code, i) => {
    const e = seen.get(code) || { code, lines: new Set(), order: i };
    e.lines.add(r.line); seen.set(code, e);
  }));
  return Array.from(seen.values()).sort((a, b) => a.order - b.order);
}
function listHtml(items, q, sel, near) {
  const qq = String(q || '').trim();
  // a bus number (e.g. 74 or 71א) shows that line's stops; 4+ digits is a stop code; anything else searches names
  const isLine = /^\d{1,3}[֐-׿]?$/.test(qq), isCode = /^\d{4,}$/.test(qq);
  const rows = items.filter(x => !qq || (isLine ? Array.from(x.lines).some(l => l === qq || l.replace(/\D+$/, '') === qq) : isCode ? x.code.indexOf(qq) === 0 : C.stopName(x.code).indexOf(qq) >= 0));
  if (!rows.length) return '<p class="sheet-note">' + (isLine ? 'No stop here on line ' + esc(qq) + '. Turn the line on above, or check the number.' : 'No stop matches “' + esc(qq) + '”.') + '</p>';
  return '<div class="menu-list stops">' + rows.slice(0, 120).map(x => '<button class="menu-item" id="st-' + x.code + '" data-act="pick-set" data-code="' + x.code + '" aria-pressed="' + (x.code === sel) + '"><span class="grow">' + bdi(C.stopName(x.code)) +
    '<small>' + Array.from(x.lines).slice(0, 8).map(esc).join(' · ') + (x.d != null ? ' · ' + Math.round(x.d) + ' m' + (near ? ' from you' : ' from the station') : '') + '</small></span>' + (x.code === sel ? ic('check', 'sm') : '') + '</button>').join('') + '</div>';
}
D.SHEETS.pick = a => {
  const f = work();
  let items = homeStopList(f);
  if (a.near) items = items.map(x => Object.assign({}, x, { d: C.dist(C.stopLL(x.code), a.near) })).sort((x, y) => x.d - y.d);
  a.items = items;
  return {
    title: 'Your bus stop',
    body: '<input class="text-in" id="pick-q" placeholder="Street name or bus number, e.g. 74" autocomplete="off" dir="auto" value="' + esc(a.q || '') + '">' +
      '<button class="btn ghost block" id="pick-near" data-act="pick-near">' + ic('locate') + (a.near ? 'Sorted by distance from you' : 'Closest to me') + '</button>' +
      '<div id="pick-list">' + listHtml(items, a.q, f.home.stop, !!a.near) + '</div>' +
      '<button class="btn ghost block" id="pick-back" data-act="trip-open">Back</button>'
  };
};
document.addEventListener('input', e => {
  if (!e.target || e.target.id !== 'pick-q') return;
  const a = D.sheetArg(), f = work(); a.q = e.target.value;
  $('#pick-list').innerHTML = listHtml(a.items || [], a.q, f.home.stop, !!a.near);
});

/* ---------- actions ---------- */
const addMin = (s, d) => hh(D.clamp(C.tm(s) + d, 5 * 60, 23 * 60));
function syncOff() { const i = $('#cs-off'); if (i && S.trip) S.trip.offUntil = i.value || null; }
const reopen = () => D.openSheet('commute', {});
Object.assign(D.ACT, {
  'trip-open': () => { if (D.sheetKind() !== 'commute' && D.sheetKind() !== 'pick') S.trip = null; work(); D.openSheet('commute', {}); },
  'choose-train': el => chooseTrain(el.dataset.dk, el.dataset.dir, el.dataset.t === '' ? null : +el.dataset.t),
  'choose-bus': el => chooseBus(el.dataset.dk, el.dataset.dir, el.dataset.t === '' ? null : +el.dataset.t, el.dataset.line),
  'hz-pick': el => {
    const dk = el.dataset.dk, k = el.dataset.k, P = C.HZ_STOPS.find(x => x.key === k);
    const undo = saveDay(dk, r => { r.to = Object.assign({}, r.to || {}, { hz: k, at: Date.now() }); });
    afterChange();
    D.toast((P ? P.nick : 'Walking from Herzliya') + ' for ' + dayWord(dk), undo);
  },
  // the card's question: same as last time / always / not now
  habit: el => {
    const d = el.dataset, dk = d.dk, dir = d.dir, shift = +d.shift, P = planOf(dk, dir);
    if (d.do === 'no') { saveRules(r => { r.asked = Object.assign({}, r.asked); r.asked[d.k] = Object.assign({}, r.asked[d.k], { last: +d.at, always: +d.at }); }); afterChange(); return; }
    if (!P) return;
    if (d.do === 'always') {
      saveRules(r => { if (d.kind === 'bus') r.bus = shift; else { const g = dir === 'home' ? 'home' : 'train'; r[g] = Object.assign({}, r[g]); r[g][P.key] = shift; } });
      afterChange(); D.toast('Saved as a habit · change it in trip settings'); return;
    }
    if (d.kind === 'bus') { const b = P.buses && P.buses[P.braw + shift]; if (b) chooseBus(dk, dir, b.at, b.line); }
    else { const t = P.trains[P.traw + shift]; if (t) chooseTrain(dk, dir, t.dep); }
  },
  'habit-rm': el => {
    const kind = el.dataset.kind, k = el.dataset.k, dir = kind === 'home' ? 'home' : 'to', days = daysNow();
    // the choices that led to it: don't ask about them again (only about new ones)
    const latest = Object.keys(days).map(d => (days[d] || {})[dir]).filter(x => x && (kind === 'bus' ? x.busShift != null : x.key === k && x.shift != null)).reduce((m, x) => Math.max(m, x.at || 0), 0);
    const qk = kind === 'bus' ? 'b' : 't:' + dir + ':' + k;
    saveRules(r => {
      if (kind === 'bus') delete r.bus; else if (r[kind]) { r[kind] = Object.assign({}, r[kind]); delete r[kind][k]; }
      r.asked = Object.assign({}, r.asked); r.asked[qk] = { last: latest, always: latest };
    });
    D.renderSheet(); render(); D.toast('Habit removed');
  },
  'tp-day': el => { const a = D.sheetArg(); a.dk = el.dataset.dk; a.by = null; a.end = null; D.renderSheet(); },
  'tp-by': el => { const a = D.sheetArg(); a.by = D.clamp(a.by + (+el.dataset.d), 5 * 60, 18 * 60); D.renderSheet(); },
  'tp-end': el => { const a = D.sheetArg(); a.end = D.clamp(a.end + (+el.dataset.d), 9 * 60, 21 * 60); D.renderSheet(); },
  'tp-save': () => {
    const a = D.sheetArg(), c = C.cfg(school), T = C.times(c, D.parseDk(a.dk).getDay(), a.dk), rec = daysNow()[a.dk] || {};
    const byNew = a.by !== T.by ? a.by : null, endNew = a.end !== T.end ? a.end : null;
    const undo = saveDay(a.dk, r => {
      if (byNew != null) r.by = byNew; else delete r.by;
      if (endNew != null) r.end = endNew; else delete r.end;
      // new times, new plan: what you picked for the old times no longer applies
      if (byNew !== (rec.by != null ? rec.by : null)) delete r.to;
      if (endNew !== (rec.end != null ? rec.end : null)) delete r.home;
    });
    D.closeSheet(); afterChange(); D.toast('Saved for ' + dayWord(a.dk), undo);
  },
  'tp-reset': () => {
    const a = D.sheetArg();
    const undo = saveDay(a.dk, r => { delete r.by; delete r.end; delete r.to; delete r.home; });
    D.closeSheet(); afterChange(); D.toast('Back to the timetable for ' + dayWord(a.dk), undo);
  },
  'board-refresh': () => { S.lastFetch = 0; refreshBoard(); D.toast('Refreshing live data'); },
  'home-line': el => { syncOff(); const f = work(), l = el.dataset.v, i = f.home.lines.indexOf(l); if (i >= 0) { if (f.home.lines.length > 1) f.home.lines.splice(i, 1); } else f.home.lines.push(l); D.renderSheet(); },
  'pick-home': () => { syncOff(); D.openSheet('pick', { k: 'home' }); },
  'pick-set': el => { work().home.stop = el.dataset.code; reopen(); },
  'pick-near': () => {
    const a = D.sheetArg();
    if (!navigator.geolocation) { D.toast('Location isn’t available on this device'); return; }
    D.toast('Finding stops near you…');
    navigator.geolocation.getCurrentPosition(pos => { a.near = [pos.coords.latitude, pos.coords.longitude]; if (D.sheetKind() === 'pick') D.renderSheet(); },
      () => D.toast('Couldn’t get your location. Search by street instead.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  },
  'hz-mode': el => { syncOff(); const hz = work().hz; hz.prefer = el.dataset.v; hz.mode = el.dataset.v === 'foot' ? 'walk' : 'auto'; D.renderSheet(); },
  'cs-leg': el => { syncOff(); const f = work(); f.legs[el.dataset.k] = D.clamp(f.legs[el.dataset.k] + (+el.dataset.d), 0, 120); D.renderSheet(); },
  'cs-day': el => { syncOff(); const f = work(), wd = el.dataset.wd; f.days[wd] = (f.days[wd] && f.days[wd].start) ? { start: null, end: null, by: null } : { start: '08:00', end: '14:00', by: null }; D.renderSheet(); },
  'cs-time': el => { syncOff(); const d = work().days[el.dataset.wd], k = el.dataset.k; d[k] = addMin(d[k] || d.start || '08:00', +el.dataset.d); D.renderSheet(); },
  'cs-by': el => { syncOff(); const d = work().days[el.dataset.wd]; d.by = d.by ? null : addMin(d.start, 15); D.renderSheet(); },
  'cs-save': () => {
    syncOff();
    const f = Object.assign({}, work(), { setup: true });
    school.set(C.KEY, f); S.trip = null; S.lastFetch = 0;
    D.closeSheet(); afterChange(); D.toast('Trip saved');
  }
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'cs-off') { syncOff(); D.renderSheet(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.lastFetch = 0; render(); } });

window.TRIPUI = { render };
C.load().then(render);
setInterval(() => { if (!document.hidden) { render(); if (D.sheetKind() === 'live' && Date.now() - S.lastFetch > 25000) refreshBoard(); } }, 30000);
})();
