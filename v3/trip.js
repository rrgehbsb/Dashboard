/* Dashboard v3 — the trip to school on the School page: the trip card (plan +
   live status), the live board ("mini Moovit"), and trip settings with stop pickers.
   Planning and live matching live in commute.js; this file only draws and edits. */
(function () {
'use strict';
const D = window.DASH, C = window.COMMUTE, $ = D.$, esc = D.esc, ic = D.ic;
const school = window.SCHOOL_ROW;
const S = { pick: null, pickBack: null, trip: null, lastFetch: 0 };
const HOME_LINES = ['71', '72', '73', '74'];
const bdi = s => '<bdi>' + esc(s) + '</bdi>';

/* ---------- small pieces ---------- */
function badge(l, sched) {
  if (!l) return '<span class="st-b">Scheduled</span>';
  if (!l.live) return '<span class="st-b">Scheduled</span>';
  const d = Math.round(l.delay);
  if (d >= 2) return '<span class="st-b late"><i></i>Live · ' + d + ' min late</span>';
  if (d <= -2) return '<span class="st-b early"><i></i>Live · ' + (-d) + ' min early</span>';
  return '<span class="st-b ok"><i></i>Live · on time</span>';
}
const etaText = (l, sched) => (l && l.live && Math.abs(l.delay) >= 1) ? '<s>' + C.hhmm(sched) + '</s> ' + C.hhmm(l.eta) : C.hhmm(sched);
function legHtml(icon, label, t, key, isLive) {
  return '<div class="leg' + (key ? ' key' : '') + '"><span class="dot">' + ic(icon, 'sm') + '</span><span class="ln">' + label + '</span><span class="tm">' + C.hhmm(t) + (isLive ? '<i class="ld" title="Live"></i>' : '') + '</span></div>';
}
function statusRow(icon, title, where, time, b) {
  return '<div class="st-row">' + ic(icon, 'sm') + '<div class="st-main"><b>' + title + '</b><span>' + where + '</span></div><div class="st-side"><span class="st-t">' + time + '</span>' + b + '</div></div>';
}

/* ---------- the card ---------- */
function render() {
  const slot = $('#commute-slot'); if (!slot) return;
  const c = C.cfg(school);
  const liveBtn = '<button class="gear" id="trip-live" data-act="sheet" data-sheet="live" aria-label="Live buses and trains">' + ic('radar', 'sm') + '</button>';
  const gear = '<button class="gear" id="commute-gear" data-act="trip-open" aria-label="Trip settings">' + ic('sliders', 'sm') + '</button>';
  if (!c) {
    slot.innerHTML = '<section class="commute setup-c" id="commute"><div class="row1"><span class="lbl">Your trip to school</span><span class="tools">' + liveBtn + '</span></div>' +
      '<p class="big sm">When to leave, every school day</p><p class="note">Pick your bus stop and your school times once. The app plans the bus, the train and the bus in Herzliya, and follows them live.</p>' +
      '<button class="alt solid" id="commute-setup" data-act="trip-open">Set up my trip</button></section>';
    return;
  }
  if (!C.rail()) { slot.innerHTML = '<section class="commute" id="commute"><div class="row1"><span class="lbl">Your trip</span><span class="tools">' + gear + '</span></div><p class="note">Loading timetables…</p></section>'; return; }
  const ph = C.phase(c), L = c.legs, now = D.nowMin();
  maybeFetch(c, ph);
  let h = '', area = 'school';
  const tag = lv => '<span class="tt-tag' + (lv && lv.anyLive ? ' on' : '') + '">' + (lv && lv.anyLive ? '<i class="ld"></i>Live' : ic('clock', 'xs') + 'Timetable') + '</span>';
  if (ph.kind === 'off') {
    h = '<div class="row1"><span class="lbl">No school</span><span class="tools">' + liveBtn + gear + '</span></div><div><p class="big">Back ' + (ph.nextOff != null ? D.DOW_L[D.dayAt(ph.nextOff).getDay()] : 'soon') + '</p><p class="note">Trip paused until ' + D.dShort(D.parseDk(ph.until)) + '.</p></div>';
  } else if (ph.kind === 'morning') {
    const m = ph.m, p = (S.pick != null && m.opts.find(o => o.train === S.pick)) || ph.pick;
    const lv = C.liveView(c, Object.assign({}, ph, { pick: p }), now) || { leave: p.leave, mins: p.leave - now };
    if (lv.miss || (p.ok && lv.mins <= 5)) area = 'amber';
    h = '<div class="row1"><span class="lbl">To school · ' + (m.hasBy ? 'arrive by ' + C.hhmm(m.by) : 'starts ' + C.hhmm(m.start)) + '</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
      '<div><p class="big">Leave ' + C.hhmm(lv.leave) + '<small>' + (lv.mins > 0 ? 'in ' + lv.mins + ' min' : lv.mins === 0 ? 'now' : (-lv.mins) + ' min ago') + '</small></p>' +
      '<p class="note">' + (lv.miss ? 'Your bus is running late and may miss the ' + C.hhmm(p.train) + ' train. Check the next option below.' :
        p.ok ? 'At school ' + C.hhmm(p.arrive) + ' · ' + p.spare + ' min to spare' : 'At school ' + C.hhmm(p.arrive) + ', ' + (-p.spare) + ' min late') + '</p></div>' +
      outJourney(c, p, lv) + statusMorning(c, p, lv) + altsHtml(m.opts, p.train, 'alt-pick');
  } else if (ph.kind === 'school' || ph.kind === 'after') {
    const a = ph.a, p = (S.pickBack != null && a.opts.find(o => o.train === S.pickBack)) || ph.pick || a.best;
    if (p) {
      const lv = ph.kind === 'after' ? (C.liveView(c, Object.assign({}, ph, { pick: p }), now) || { leave: p.leave, mins: p.leave - now }) : { leave: p.leave, mins: null };
      h = '<div class="row1"><span class="lbl">Going home · school ends ' + C.hhmm(a.end) + '</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
        '<div><p class="big">' + C.hhmm(p.train) + '<small>train home</small></p><p class="note">Leave school by ' + C.hhmm(lv.leave) + (lv.mins != null ? (lv.mins > 0 ? ' · in ' + lv.mins + ' min' : ' · now') : '') + ' · home about ' + C.hhmm(p.home) + '</p></div>' +
        backJourney(c, p, lv) + (ph.kind === 'after' ? statusAfter(c, p, lv) : '') + altsHtml(a.opts, p.train, 'alt-back');
    } else h = '<div class="row1"><span class="lbl">Going home</span><span class="tools">' + liveBtn + gear + '</span></div><p class="note">No more trains home today.</p>';
  } else if (ph.kind === 'next' && ph.m && ph.m.best) {
    const m = ph.m, p = m.best, when = ph.off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(ph.off).getDay()];
    h = '<div class="row1"><span class="lbl">' + when + ' · ' + (m.hasBy ? 'arrive by ' + C.hhmm(m.by) : 'starts ' + C.hhmm(m.start)) + '</span><span class="tools">' + tag(null) + liveBtn + gear + '</span></div>' +
      '<div><p class="big">Leave ' + C.hhmm(p.leave) + '<small>' + (p.bus ? 'bus ' + esc(p.bus.line) + ' ' + C.hhmm(p.bus.at) : C.hhmm(p.train) + ' train') + '</small></p><p class="note">At school ' + C.hhmm(p.arrive) + ' · ' + p.spare + ' min to spare</p></div>' + outJourney(c, p, null);
  } else {
    h = '<div class="row1"><span class="lbl">Your trip</span><span class="tools">' + liveBtn + gear + '</span></div><p class="note">No school days set. Open the trip settings to add them.</p>';
  }
  const built = C.rail() && C.rail().built ? D.parseDk(String(C.rail().built).replace(/(d{4})(d{2})(d{2})/, '$1-$2-$3')) : null;
  const ageDays = built ? Math.floor((D.dayAt(0) - built) / 864e5) : null;
  if (ageDays != null && ageDays > 14) h += '<p class="note">Timetable last updated ' + ageDays + ' days ago, so times may have changed. Live times are still current.</p>';
  if (!c.home.stop) h += '<button class="alt solid hint-btn" id="pick-stop-cta" data-act="trip-open">Pick your bus stop for real bus times</button>';
  slot.innerHTML = '<section class="commute" id="commute" data-area="' + area + '" aria-label="Trip">' + h + '</section>';
}
function outJourney(c, p, lv) {
  const L = c.legs, legs = [];
  legs.push(legHtml('walk', 'Walk', lv ? lv.leave : p.leave));
  legs.push(legHtml('bus', p.bus ? 'Bus ' + esc(p.bus.line) : 'Bus', p.bus ? (lv && lv.bus && lv.bus.live ? lv.bus.eta : p.bus.at) : p.leave + L.walk1, false, lv && lv.bus && lv.bus.live));
  legs.push(legHtml('train', 'Train', lv && lv.train && lv.train.live ? lv.train.eta : p.train, true, lv && lv.train && lv.train.live));
  if (p.hz) legs.push(legHtml('bus', 'Bus ' + esc(p.hz.line), lv && lv.hz && lv.hz.live ? lv.hz.eta : p.hz.at, false, lv && lv.hz && lv.hz.live));
  else if (c.hz.mode !== 'walk') legs.push(legHtml('bus', 'Bus', p.trainArr + L.wait2));
  legs.push(legHtml('walk', 'Walk', p.hz ? p.hz.off : c.hz.mode === 'walk' ? p.trainArr : p.trainArr + L.wait2 + L.bus2));
  legs.push(legHtml('flag', 'School', p.arrive, true));
  return '<div class="journey" style="grid-template-columns:repeat(' + legs.length + ',minmax(0,1fr))">' + legs.join('') + '</div>';
}
function backJourney(c, p, lv) {
  const legs = [legHtml('walk', 'Walk', lv ? lv.leave : p.leave)];
  if (p.hz) legs.push(legHtml('bus', 'Bus ' + esc(p.hz.line), lv && lv.hz && lv.hz.live ? lv.hz.eta : p.hz.at, false, lv && lv.hz && lv.hz.live));
  legs.push(legHtml('train', 'Train', lv && lv.train && lv.train.live ? lv.train.eta : p.train, true, lv && lv.train && lv.train.live));
  legs.push(legHtml('bus', p.bus ? 'Bus ' + esc(p.bus.line) : 'Bus', p.bus ? p.bus.at : p.trainArr + 5));
  legs.push(legHtml('home', 'Home', p.home, true));
  return '<div class="journey" style="grid-template-columns:repeat(' + legs.length + ',minmax(0,1fr))">' + legs.join('') + '</div>';
}
function statusMorning(c, p, lv) {
  const rows = [];
  if (p.bus) rows.push(statusRow('bus', 'Bus ' + esc(p.bus.line), bdi(C.stopName(c.home.stop)), etaText(lv && lv.bus, p.bus.at), badge(lv && lv.bus)));
  rows.push(statusRow('train', 'Train ' + esc(p.trainNo || ''), 'Rosh HaAyin North → Herzliya', etaText(lv && lv.train, p.train), badge(lv && lv.train)));
  if (p.hz) rows.push(statusRow('bus', 'Bus ' + esc(p.hz.line), bdi(C.stopName(p.hz.from)) + ' → ' + bdi(C.stopName(p.hz.to)), etaText(lv && lv.hz, p.hz.at), badge(lv && lv.hz)));
  return '<div class="st-list">' + rows.join('') + '</div>';
}
function statusAfter(c, p, lv) {
  const rows = [];
  if (p.hz) rows.push(statusRow('bus', 'Bus ' + esc(p.hz.line), bdi(C.stopName(p.hz.from)), etaText(lv && lv.hz, p.hz.at), badge(lv && lv.hz)));
  rows.push(statusRow('train', 'Train ' + esc(p.trainNo || ''), 'Herzliya → Rosh HaAyin North', etaText(lv && lv.train, p.train), badge(lv && lv.train)));
  if (p.bus) rows.push(statusRow('bus', 'Bus ' + esc(p.bus.line), bdi(C.stopName(p.bus.from)) + ' → home', C.hhmm(p.bus.at), badge(lv && lv.bus)));
  return '<div class="st-list">' + rows.join('') + '</div>';
}
function altsHtml(opts, cur, act) {
  const now = D.nowMin(), seen = new Set(), list = opts.filter(o => o.leave >= now - 1 && !seen.has(o.leave) && seen.add(o.leave)).slice(0, 4);
  if (list.length < 2) return '';
  return '<div class="alts" role="group" aria-label="Other options">' + list.map(o => '<button class="alt" id="alt-' + o.train + '" data-act="' + act + '" data-t="' + o.train + '" aria-pressed="' + (o.train === cur) + '">' +
    'Leave ' + C.hhmm(o.leave) + (o.ok === false ? ' · late' : '') + '</button>').join('') + '</div>';
}

/* ---------- live data refresh ---------- */
let fetching = false;
function maybeFetch(c, ph) {
  if (fetching || Date.now() - S.lastFetch < 25000 || document.hidden) return;
  if (!ph || !(ph.kind === 'morning' || ph.kind === 'after' || D.sheetKind() === 'live')) return;
  fetching = true; S.lastFetch = Date.now();
  C.fetchLive(C.watchStops(c, ph)).then(() => { fetching = false; render(); if (D.sheetKind() === 'live') D.renderSheet(); });
}
function boardStops(c) { return [c && c.home.stop, C.RH_STATION, C.HZ_STATION, c && c.hz.mode === 'bus' ? c.hz.from : null].filter(Boolean); }
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
    return '<div class="bd-row"><span class="ln-pill">' + esc(r.v.line) + '</span><div class="bd-main"><b>' + (mins <= 0 ? 'Now' : mins + ' min') + '</b><span>' + C.hhmm(r.eta) + ' · to ' + bdi(r.v.dest || r.v.destEn) + '</span></div>' + st + '</div>';
  }).join('') + '</div>';
}
function trainRows(station, dir, max) {
  const wd = D.dayAt(0).getDay(), now = nowMin();
  const list = C.trainsOf(dir, wd).filter(t => t.dep >= now - 2).slice(0, max || 4);
  if (!list.length) return '<p class="sheet-note">No more trains today.</p>';
  return '<div class="board">' + list.map(t => {
    const l = C.liveTrain(station, t.dep, t.no), when = l && l.live ? l.eta : t.dep, mins = when - now;
    return '<div class="bd-row"><span class="ln-pill train">' + ic('train', 'xs') + '</span><div class="bd-main"><b>' + C.hhmm(t.dep) + (l && l.live && Math.abs(l.delay) >= 1 ? ' → ' + C.hhmm(l.eta) : '') + '</b><span>Train ' + esc(t.no) + ' · ' + (mins <= 0 ? 'now' : 'in ' + mins + ' min') + ' · arrives ' + C.hhmm(t.arr + (l && l.live ? Math.max(0, l.delay) : 0)) + '</span></div>' + badge(l) + '</div>';
  }).join('') + '</div>';
}
D.SHEETS.live = () => {
  const c = C.cfg(school), lv = C.live(), age = lv.at ? Math.round((Date.now() - lv.at) / 1000) : null;
  if (Date.now() - S.lastFetch > 25000) setTimeout(refreshBoard, 0);
  const sec = (title, body) => '<p class="group-title">' + title + '</p>' + body;
  let body = '';
  if (c && c.home.stop) body += sec('Your stop · ' + bdi(C.stopName(c.home.stop)), busRows(c.home.stop, c.home.lines && c.home.lines.length ? c.home.lines : HOME_LINES, 6));
  else body += '<button class="menu-item" id="board-pick" data-act="trip-open">' + ic('bus') + 'Pick your bus stop to see its buses here</button>';
  body += sec('Rosh HaAyin North → Herzliya', trainRows(C.RH_STATION, 'toHerzliya', 4));
  body += sec('Herzliya → Rosh HaAyin North', trainRows(C.HZ_STATION, 'toRoshHaAyin', 4));
  if (c && c.hz.mode === 'bus' && c.hz.from) body += sec('Herzliya · ' + bdi(C.stopName(c.hz.from)), busRows(c.hz.from, c.hz.lines, 5));
  body += '<p class="sheet-note">' + (lv.at ? 'Updated ' + (age < 60 ? 'just now' : Math.round(age / 60) + ' min ago') + '. ' : 'Loading live data… ') +
    '“Live” means the bus or train is being tracked right now; “Scheduled” means it hasn’t started yet, so the time is from the timetable. Live data comes from the Ministry of Transport.</p>' +
    '<button class="btn ghost block" id="board-refresh" data-act="board-refresh">' + ic('repeat') + 'Refresh</button>';
  return { title: 'Live buses & trains', body };
};

/* ---------- trip settings ---------- */
function work() {
  if (!S.trip) S.trip = JSON.parse(JSON.stringify(C.cfg(school) || C.defaults()));
  return S.trip;
}
const step = (id, label, val, act, k, hint) => '<div class="set-row"><span class="lbl">' + label + (hint ? '<small>' + hint + '</small>' : '') + '</span><span class="mini-step"><button id="' + id + '-m" data-act="' + act + '" data-k="' + k + '" data-d="-1" aria-label="Less: ' + label + '">−</button><output>' + val + ' min</output><button id="' + id + '-p" data-act="' + act + '" data-k="' + k + '" data-d="1" aria-label="More: ' + label + '">+</button></span></div>';
const pickRow = (id, label, code, act, disabled) => '<button class="menu-item pick-stop" id="' + id + '" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '><span class="grow"><small>' + label + '</small>' + (code ? bdi(C.stopName(code)) : '<span class="muted">Choose…</span>') + '</span>' + ic('chev-r', 'sm') + '</button>';
D.SHEETS.commute = () => {
  const f = work(), hz = f.hz, home = f.home;
  const conns = hz.from && hz.to ? C.connections(hz.from, hz.to, null) : [];
  const hzLines = Array.from(new Set(conns.map(x => x.r.line)));
  const tstep = (wd, k) => '<span class="mini-step"><button id="cs-' + wd + k + '-m" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="-5" aria-label="Earlier">−</button><output>' + (f.days[wd][k] || '—') + '</output><button id="cs-' + wd + k + '-p" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="5" aria-label="Later">+</button></span>';
  return {
    title: 'Trip & school times',
    body:
      '<p class="group-title">In Rosh HaAyin</p>' +
      '<div class="pick-row" role="group" aria-label="Your bus lines">' + HOME_LINES.map(l => '<button class="pick" id="hl-' + l + '" data-act="home-line" data-v="' + l + '" aria-pressed="' + (home.lines.indexOf(l) >= 0) + '">' + l + '</button>').join('') + '</div>' +
      '<div class="menu-list">' + pickRow('pick-home', 'Your bus stop', home.stop, 'pick-home') + '</div>' +
      '<div>' + step('cl-walk1', 'Walk to your stop', f.legs.walk1, 'cs-leg', 'walk1') + step('cl-buffer', 'Time at the station', f.legs.buffer, 'cs-leg', 'buffer', 'Before the train leaves') +
      (home.stop ? '' : step('cl-bus1', 'Bus ride (estimate)', f.legs.bus1, 'cs-leg', 'bus1', 'Until you pick your stop')) + '</div>' +
      '<p class="group-title">In Herzliya</p>' +
      '<div class="seg" role="radiogroup" aria-label="From Herzliya station">' + [['bus', 'Bus'], ['walk', 'Walk']].map(o => '<button id="hz-' + o[0] + '" role="radio" data-act="hz-mode" data-v="' + o[0] + '" aria-checked="' + (hz.mode === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      (hz.mode === 'bus'
        ? '<div class="menu-list">' + pickRow('pick-hzfrom', 'Get on at (near the station)', hz.from, 'pick-hzfrom') + pickRow('pick-hzto', 'Get off at', hz.to, 'pick-hzto', !hz.from) + '</div>' +
          (hzLines.length ? '<p class="field-label">Lines that go there</p><div class="pick-row" role="group" aria-label="Herzliya lines">' + hzLines.map(l => '<button class="pick" id="hzl-' + esc(l) + '" data-act="hz-line" data-v="' + esc(l) + '" aria-pressed="' + (!hz.lines.length || hz.lines.indexOf(l) >= 0) + '">' + esc(l) + '</button>').join('') + '</div>' : '') +
          '<div>' + step('hz-tr', 'From the train to the stop', hz.transfer, 'hz-step', 'transfer') + step('hz-wk', 'Walk to school', hz.walk, 'hz-step', 'walk', 'After you get off') + '</div>'
        : '<div>' + step('hz-wo', 'Walk from the station', hz.walkOnly || 15, 'hz-step', 'walkOnly') + '</div>') +
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

/* ---------- stop pickers ---------- */
function homeStopList(f) {
  const seen = new Map();
  C.homeRoutes('to', f.home.lines.length ? f.home.lines : HOME_LINES).forEach(r => r.stops.slice(0, -1).forEach((code, i) => {
    const e = seen.get(code) || { code, lines: new Set(), order: i };
    e.lines.add(r.line); seen.set(code, e);
  }));
  return Array.from(seen.values()).sort((a, b) => a.order - b.order);
}
function hzFromList() {
  const b = C.bus(); if (!b) return [];
  const lines = {};
  b.routes.forEach(r => r.stops.forEach(code => { (lines[code] = lines[code] || new Set()).add(r.line); }));
  return Object.keys(b.stops).map(code => ({ code, d: C.dist([b.stops[code][1], b.stops[code][2]], C.HZ_LL), lines: lines[code] || new Set() }))
    .filter(x => x.d <= 450).sort((a, b2) => a.d - b2.d);
}
function hzToList(from) {
  const b = C.bus(); if (!b || !from) return [];
  const seen = new Map();
  b.routes.forEach(r => { const i = r.stops.indexOf(from); if (i < 0) return; r.stops.slice(i + 1).forEach((code, k) => { const e = seen.get(code) || { code, lines: new Set(), order: k }; e.lines.add(r.line); e.order = Math.min(e.order, k); seen.set(code, e); }); });
  return Array.from(seen.values()).sort((a, b2) => a.order - b2.order);
}
function listHtml(items, q, sel, near) {
  const qq = String(q || '').trim();
  const rows = items.filter(x => !qq || C.stopName(x.code).indexOf(qq) >= 0 || x.code.indexOf(qq) === 0);
  if (!rows.length) return '<p class="sheet-note">No stop matches “' + esc(qq) + '”.</p>';
  return '<div class="menu-list stops">' + rows.slice(0, 120).map(x => '<button class="menu-item" id="st-' + x.code + '" data-act="pick-set" data-code="' + x.code + '" aria-pressed="' + (x.code === sel) + '"><span class="grow">' + bdi(C.stopName(x.code)) +
    '<small>' + Array.from(x.lines).slice(0, 8).map(esc).join(' · ') + (x.d != null ? ' · ' + Math.round(x.d) + ' m' + (near ? ' from you' : ' from the station') : '') + '</small></span>' + (x.code === sel ? ic('check', 'sm') : '') + '</button>').join('') + '</div>';
}
D.SHEETS.pick = a => {
  const f = work();
  let items = a.k === 'home' ? homeStopList(f) : a.k === 'hzfrom' ? hzFromList() : hzToList(f.hz.from);
  if (a.near) items = items.map(x => Object.assign({}, x, { d: C.dist(C.stopLL(x.code), a.near) })).sort((x, y) => x.d - y.d);
  const sel = a.k === 'home' ? f.home.stop : a.k === 'hzfrom' ? f.hz.from : f.hz.to;
  a.items = items;
  return {
    title: a.k === 'home' ? 'Your bus stop' : a.k === 'hzfrom' ? 'Get on at' : 'Get off at',
    body: '<input class="text-in" id="pick-q" placeholder="Search by street name (Hebrew)" autocomplete="off" dir="auto" value="' + esc(a.q || '') + '">' +
      (a.k !== 'hzfrom' ? '<button class="btn ghost block" id="pick-near" data-act="pick-near">' + ic('locate') + (a.near ? 'Sorted by distance from you' : 'Closest to me') + '</button>' : '') +
      '<div id="pick-list">' + listHtml(items, a.q, sel, !!a.near) + '</div>' +
      '<button class="btn ghost block" id="pick-back" data-act="trip-open">Back</button>'
  };
};
document.addEventListener('input', e => {
  if (!e.target || e.target.id !== 'pick-q') return;
  const a = D.sheetArg(), f = work(); a.q = e.target.value;
  const sel = a.k === 'home' ? f.home.stop : a.k === 'hzfrom' ? f.hz.from : f.hz.to;
  $('#pick-list').innerHTML = listHtml(a.items || [], a.q, sel, !!a.near);
});

/* ---------- actions ---------- */
const addMin = (s, d) => C.hhmm(D.clamp(C.tm(s) + d, 5 * 60, 23 * 60));
function syncOff() { const i = $('#cs-off'); if (i && S.trip) S.trip.offUntil = i.value || null; }
const reopen = () => D.openSheet('commute', {});
Object.assign(D.ACT, {
  'trip-open': () => { if (D.sheetKind() !== 'commute' && D.sheetKind() !== 'pick') S.trip = null; work(); D.openSheet('commute', {}); },
  'alt-pick': el => { S.pick = +el.dataset.t; render(); },
  'alt-back': el => { S.pickBack = +el.dataset.t; render(); },
  'board-refresh': () => { S.lastFetch = 0; refreshBoard(); D.toast('Refreshing live data'); },
  'home-line': el => { syncOff(); const f = work(), l = el.dataset.v, i = f.home.lines.indexOf(l); if (i >= 0) { if (f.home.lines.length > 1) f.home.lines.splice(i, 1); } else f.home.lines.push(l); D.renderSheet(); },
  'pick-home': () => { syncOff(); D.openSheet('pick', { k: 'home' }); },
  'pick-hzfrom': () => { syncOff(); D.openSheet('pick', { k: 'hzfrom' }); },
  'pick-hzto': () => { syncOff(); D.openSheet('pick', { k: 'hzto' }); },
  'pick-set': el => {
    const a = D.sheetArg(), f = work(), code = el.dataset.code;
    if (a.k === 'home') f.home.stop = code;
    else if (a.k === 'hzfrom') { f.hz.from = code; if (f.hz.to && !C.connections(code, f.hz.to, null).length) f.hz.to = null; f.hz.lines = []; }
    else { f.hz.to = code; f.hz.lines = []; }
    reopen();
  },
  'pick-near': () => {
    const a = D.sheetArg();
    if (!navigator.geolocation) { D.toast('Location isn’t available on this device'); return; }
    D.toast('Finding stops near you…');
    navigator.geolocation.getCurrentPosition(pos => { a.near = [pos.coords.latitude, pos.coords.longitude]; if (D.sheetKind() === 'pick') D.renderSheet(); },
      () => D.toast('Couldn’t get your location. Search by street instead.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  },
  'hz-mode': el => { syncOff(); work().hz.mode = el.dataset.v; D.renderSheet(); },
  'hz-line': el => {
    syncOff(); const f = work(), l = el.dataset.v;
    const all = Array.from(new Set(C.connections(f.hz.from, f.hz.to, null).map(x => x.r.line)));
    let cur = f.hz.lines.length ? f.hz.lines.slice() : all.slice();
    const i = cur.indexOf(l); if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); } else cur.push(l);
    f.hz.lines = cur.length === all.length ? [] : cur; D.renderSheet();
  },
  'hz-step': el => { syncOff(); const h = work().hz, k = el.dataset.k; h[k] = D.clamp((h[k] || (k === 'walkOnly' ? 15 : 0)) + (+el.dataset.d), 0, 60); D.renderSheet(); },
  'cs-leg': el => { syncOff(); const f = work(); f.legs[el.dataset.k] = D.clamp(f.legs[el.dataset.k] + (+el.dataset.d), 0, 120); D.renderSheet(); },
  'cs-day': el => { syncOff(); const f = work(), wd = el.dataset.wd; f.days[wd] = (f.days[wd] && f.days[wd].start) ? { start: null, end: null, by: null } : { start: '08:00', end: '14:00', by: null }; D.renderSheet(); },
  'cs-time': el => { syncOff(); const d = work().days[el.dataset.wd], k = el.dataset.k; d[k] = addMin(d[k] || d.start || '08:00', +el.dataset.d); D.renderSheet(); },
  'cs-by': el => { syncOff(); const d = work().days[el.dataset.wd]; d.by = d.by ? null : addMin(d.start, 15); D.renderSheet(); },
  'cs-save': () => {
    syncOff();
    const f = Object.assign({}, work(), { setup: true });
    school.set(C.KEY, f); S.trip = null; S.pick = null; S.pickBack = null; S.lastFetch = 0;
    D.closeSheet(); render(); D.toast('Trip saved');
  }
});
document.addEventListener('change', e => { if (e.target && e.target.id === 'cs-off') { syncOff(); D.renderSheet(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.lastFetch = 0; render(); } });

window.TRIPUI = { render };
C.load().then(render);
setInterval(() => { if (!document.hidden) { render(); if (D.sheetKind() === 'live' && Date.now() - S.lastFetch > 25000) refreshBoard(); } }, 30000);
})();
