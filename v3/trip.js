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

// The option you tap is the one your friends see (when you share your trip).
function shareChoice(dir, leave) {
  const c = C.cfg(school), ph = c && C.rail() ? C.phase(c) : null, m = ph && (dir === 'to' ? ph.m : ph.a);
  const o = m && m.opts.find(x => x.leave === leave);
  if (o && window.SOCIAL) window.SOCIAL.choose(m.dk, dir, o.train, o.leave);
}
const entName = k => (C.SCHOOL[k] ? C.SCHOOL[k].name + ' (' + C.SCHOOL[k].he + ')' : 'school');
const ttOn = () => { const T = window.TIMETABLE, s = T ? T.settings(school) : {}; return !!s.cls && s.trip !== false; };
// "first lesson 07:45 · by 08:00" when the timetable sets the day, else the times you set
// the first-lesson time is from the weekly plan until the school posts the day
const wpNote = m => m && m.auto && !m.published ? '<p class="note wp">' + ic('clock', 'xs') + 'From the weekly plan: the school hasn’t posted this day’s update yet, so a cancelled first lesson won’t show.</p>' : '';
const startLbl = m => m.auto ? 'first lesson ' + C.hhmm(m.start) + (m.hasBy ? ' · by ' + C.hhmm(m.by) : '') : (m.hasBy ? 'arrive by ' + C.hhmm(m.by) : 'starts ' + C.hhmm(m.start));
// "7 min early" / "right on time" / "2 min late"
const earlyTxt = sp => sp > 0 ? sp + ' min early' : sp === 0 ? 'right on time' : (-sp) + ' min late';
// the time you have between two legs: plenty (green), tight (amber), might miss (red)
// min = the time between arriving and the next one leaving; walk = how much of it is walking.
// Green: 3+ minutes to spare after the walk; amber: 1–2; red: you'd miss it.
function waitRow(min, text, walk, missTxt) {
  if (min == null || isNaN(min)) return '';
  const spare = min - (walk || 0), cls = spare >= 3 ? 'ok' : spare >= 1 ? 'tight' : 'miss';
  const body = spare < 0 ? (missTxt || 'Might miss it: ' + min + ' min ' + text) : (spare < 3 ? 'Tight: ' : '') + min + ' min ' + text + (walk > 2 ? ' (' + walk + '-min walk)' : '');
  return '<div class="st-wait ' + cls + '"><i aria-hidden="true"></i><span>' + body + '</span></div>';
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
    const m = ph.m, p = (S.pick != null && m.opts.find(o => o.leave === S.pick)) || ph.pick;
    const lv = C.liveView(c, Object.assign({}, ph, { pick: p }), now) || { leave: p.leave, mins: p.leave - now };
    const ar = C.arrivals(c, ph, p, lv);
    const riding = now >= lv.leave && now < ar.arrive + 5;
    if (lv.miss || (!riding && p.ok && lv.mins <= 5)) area = 'amber';
    if (riding) {
      // on your way: what's next and when you get there, with a way out if you missed it
      const r = C.rideNow(ph, p, ar, now), nx = m.opts.find(o => o.leave > now && o !== p);
      h = '<div class="row1"><span class="lbl">On your way · ' + startLbl(m) + '</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
        '<div><p class="big ride">' + esc(r.big) + '<small>' + esc(r.small) + '</small></p>' +
        '<p class="note">' + (lv.miss ? 'Your bus is running late and may miss the ' + C.hhmm(ar.trainDep) + ' train.' : 'At school ' + C.hhmm(ar.arrive) + ' · ' + earlyTxt(ar.spare) + ' · ' + entName(p.ent)) + '</p>' +
        (nx ? '<button class="alt not-on" id="not-on" data-act="alt-pick" data-t="' + nx.leave + '">Not on it? Leave ' + C.hhmm(nx.leave) + ' instead</button>' : '') + '</div>' +
        outJourney(c, p, lv, ar) + statusMorning(c, p, lv, ar);
    } else {
      h = '<div class="row1"><span class="lbl">To school · ' + startLbl(m) + '</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
        '<div><p class="big">Leave ' + C.hhmm(lv.leave) + '<small>' + (lv.mins > 0 ? 'in ' + lv.mins + ' min' : lv.mins === 0 ? 'now' : (-lv.mins) + ' min ago') + '</small></p>' +
        '<p class="note">' + (lv.miss ? 'Your bus is running late and may miss the ' + C.hhmm(p.train) + ' train. Check the next option below.' :
          'At school ' + C.hhmm(ar.arrive) + ' · ' + earlyTxt(ar.spare) + ' · ' + entName(p.ent)) + '</p>' + wpNote(m) + '</div>' +
        outJourney(c, p, lv, ar) + statusMorning(c, p, lv, ar) + hzHtml(c, m, p) + altsHtml(m.opts, p.leave, 'alt-pick');
    }
  } else if (ph.kind === 'school' || ph.kind === 'after') {
    const a = ph.a, p = (S.pickBack != null && a.opts.find(o => o.leave === S.pickBack)) || ph.pick || a.best;
    if (p) {
      const lv = ph.kind === 'after' ? (C.liveView(c, Object.assign({}, ph, { pick: p }), now) || { leave: p.leave, mins: p.leave - now }) : { leave: p.leave, mins: null };
      const ar = C.arrivals(c, { kind: 'after' }, p, ph.kind === 'after' ? lv : null);
      const riding = ph.kind === 'after' && now >= lv.leave && now < ar.home + 5;
      if (riding) {
        const r = C.rideNow({ kind: 'after' }, p, ar, now), nx = a.opts.find(o => o.leave > now && o !== p);
        h = '<div class="row1"><span class="lbl">On your way home</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
          '<div><p class="big ride">' + esc(r.big) + '<small>' + esc(r.small) + '</small></p><p class="note">Home about ' + C.hhmm(ar.home) + '</p>' +
          (nx ? '<button class="alt not-on" id="not-on" data-act="alt-back" data-t="' + nx.leave + '">Not on it? Leave ' + C.hhmm(nx.leave) + ' instead</button>' : '') + '</div>' +
          backJourney(c, p, lv) + statusAfter(c, p, lv, ar);
      } else {
        h = '<div class="row1"><span class="lbl">Going home · ' + (a.auto ? 'last lesson ends ' : 'school ends ') + C.hhmm(a.end) + '</span><span class="tools">' + tag(lv) + liveBtn + gear + '</span></div>' +
          '<div><p class="big">' + C.hhmm(p.train) + '<small>train home</small></p><p class="note">Leave school by ' + C.hhmm(lv.leave) + (lv.mins != null ? (lv.mins > 0 ? ' · in ' + lv.mins + ' min' : ' · now') : '') + ' from the ' + entName(p.ent) + ' · home about ' + C.hhmm(ar.home) + '</p></div>' +
          backJourney(c, p, lv) + statusAfter(c, p, ph.kind === 'after' ? lv : null, ar) + altsHtml(a.opts, p.leave, 'alt-back');
      }
    } else h = '<div class="row1"><span class="lbl">Going home</span><span class="tools">' + liveBtn + gear + '</span></div><p class="note">No more trains home today.</p>';
  } else if (ph.kind === 'next' && ph.m && ph.m.best) {
    const m = ph.m, p = m.best, when = ph.off === 1 ? 'Tomorrow' : D.DOW_L[D.dayAt(ph.off).getDay()];
    h = '<div class="row1"><span class="lbl">' + when + ' · ' + startLbl(m) + '</span><span class="tools">' + tag(null) + liveBtn + gear + '</span></div>' +
      '<div><p class="big">Leave ' + C.hhmm(p.leave) + '<small>' + (p.bus ? 'bus ' + esc(p.bus.line) + ' ' + C.hhmm(p.bus.at) : C.hhmm(p.train) + ' train') + '</small></p><p class="note">At school ' + C.hhmm(p.arrive) + ' · ' + earlyTxt(p.spare) + ' · ' + entName(p.ent) + '</p>' + wpNote(m) + '</div>' + outJourney(c, p, null) + statusMorning(c, p, null, C.arrivals(c, ph, p, null)) + hzHtml(c, m, p);
  } else {
    const hol = ttOn() && window.TIMETABLE.holidayOn(D.todayKey());
    h = '<div class="row1"><span class="lbl">' + (hol ? 'No school' : 'Your trip') + '</span><span class="tools">' + liveBtn + gear + '</span></div>' +
      (hol ? '<p class="big">' + bdi(hol.title) + '</p><p class="note">Until ' + D.dShort(D.parseDk(hol.end)) + ' · from the school calendar</p>' : '<p class="note">No school days set. Open the trip settings to add them.</p>');
  }
  h += '<button class="link how" id="trip-how" data-act="sheet" data-sheet="tripinfo">' + ic('info', 'xs') + 'How live times work</button>';
  if (!c.home.stop) h += '<button class="alt solid hint-btn" id="pick-stop-cta" data-act="trip-open">Pick your bus stop for real bus times</button>';
  slot.innerHTML = '<section class="commute" id="commute" data-area="' + area + '" aria-label="Trip">' + problemsHtml() + h + '</section>';
}
function outJourney(c, p, lv, ar) {
  const L = c.legs, legs = [];
  legs.push(legHtml('walk', 'Walk', lv ? lv.leave : p.leave));
  legs.push(legHtml('bus', p.bus ? 'Bus ' + esc(p.bus.line) : 'Bus', p.bus ? (lv && lv.bus && lv.bus.live ? lv.bus.eta : p.bus.at) : p.leave + L.walk1, false, lv && lv.bus && lv.bus.live));
  legs.push(legHtml('train', 'Train', lv && lv.train && lv.train.live ? lv.train.eta : p.train, true, lv && lv.train && lv.train.live));
  if (p.hz) legs.push(legHtml('bus', 'Bus ' + esc(p.hz.line), lv && lv.hz && lv.hz.live ? lv.hz.eta : p.hz.at, false, lv && lv.hz && lv.hz.live));
  legs.push(legHtml('walk', p.hzWalk ? 'Walk ' + p.hzWalk + '′' : 'Walk', p.hz ? p.hz.off : p.trainArr));
  legs.push(legHtml('flag', 'School', ar && ar.arrive != null ? ar.arrive : p.arrive, true));
  return '<div class="journey" style="grid-template-columns:repeat(' + legs.length + ',minmax(0,1fr))">' + legs.join('') + '</div>';
}
function backJourney(c, p, lv) {
  const legs = [legHtml('walk', p.hzWalk ? 'Walk ' + p.hzWalk + '′' : 'Walk', lv ? lv.leave : p.leave)];
  if (p.hz) legs.push(legHtml('bus', 'Bus ' + esc(p.hz.line), lv && lv.hz && lv.hz.live ? lv.hz.eta : p.hz.at, false, lv && lv.hz && lv.hz.live));
  legs.push(legHtml('train', 'Train', lv && lv.train && lv.train.live ? lv.train.eta : p.train, true, lv && lv.train && lv.train.live));
  legs.push(legHtml('bus', p.bus ? 'Bus ' + esc(p.bus.line) : 'Bus', p.bus ? p.bus.at : p.trainArr + 5));
  legs.push(legHtml('home', 'Home', p.home, true));
  return '<div class="journey" style="grid-template-columns:repeat(' + legs.length + ',minmax(0,1fr))">' + legs.join('') + '</div>';
}
// "06:52 → 07:11": leaves (struck-through timetable time if live differs) → gets there
const legTime = (l, dep, arr, arrLive) => etaText(l, dep) + '<span class="arr"> → ' + C.hhmm(arr) + (arrLive ? '<i class="ld" title="Live"></i>' : '') + '</span>';
function statusMorning(c, p, lv, ar) {
  const rows = [];
  ar = ar || {};
  if (p.bus) {
    rows.push(statusRow('bus', 'Bus ' + esc(p.bus.line), bdi(C.stopName(c.home.stop)), legTime(lv && lv.bus, p.bus.at, ar.busArr != null ? ar.busArr : p.bus.off, ar.busArrLive), badge(lv && lv.bus)));
    rows.push(waitRow(ar.waitStation, 'at Rosh HaAyin North before the train', ar.walkStation));
  }
  rows.push(statusRow('train', 'Train ' + esc(p.trainNo || ''), 'Rosh HaAyin North → Herzliya', legTime(lv && lv.train, p.train, ar.trainArr != null ? ar.trainArr : p.trainArr, ar.trainArrLive), badge(lv && lv.train)));
  if (p.hz) {
    rows.push(waitRow(ar.waitHz, 'in Herzliya to reach bus ' + esc(p.hz.line), ar.walkHz, ar.missHz ? 'The train is late, so you’ll miss bus ' + esc(p.hz.line) + ': ' + (ar.alt && ar.alt.hz ? 'take bus ' + esc(ar.alt.hz.line) + ' at ' + C.hhmm(ar.alt.hz.at) + (ar.alt.nick ? ' (' + bdi(ar.alt.nick) + ')' : '') : 'walk') + ' instead' : null));
    rows.push(statusRow('bus', 'Bus ' + esc(p.hz.line) + (p.hz.nick ? ' · ' + bdi(p.hz.nick) : ''), 'from ' + bdi(C.stopName(p.hz.from)), legTime(lv && lv.hz, p.hz.at, ar.hzArr != null ? ar.hzArr : p.hz.off), badge(lv && lv.hz)));
  }
  if (ar.arrive != null) rows.push('<div class="st-end">' + ic('flag', 'xs') + '<span>At school <b>' + C.hhmm(ar.arrive) + '</b> · ' + earlyTxt(ar.spare) + '</span></div>');
  return '<div class="st-list">' + rows.join('') + '</div>';
}
function statusAfter(c, p, lv, ar) {
  const rows = [];
  ar = ar || {};
  if (p.hz) rows.push(statusRow('bus', 'Bus ' + esc(p.hz.line), bdi(C.stopName(p.hz.from)), legTime(lv && lv.hz, p.hz.at, (ar.atStation != null ? ar.atStation : p.hz.off)), badge(lv && lv.hz)));
  rows.push(waitRow(ar.waitHz, 'at Herzliya station before the train', ar.walkHz));
  rows.push(statusRow('train', 'Train ' + esc(p.trainNo || ''), 'Herzliya → Rosh HaAyin North', legTime(lv && lv.train, p.train, ar.trainArr != null ? ar.trainArr : p.trainArr, ar.trainArrLive), badge(lv && lv.train)));
  if (p.bus) {
    rows.push(waitRow(ar.waitRh, 'at Rosh HaAyin North to reach bus ' + esc(p.bus.line), ar.walkRh));
    rows.push(statusRow('bus', 'Bus ' + esc(p.bus.line), bdi(C.stopName(p.bus.from)) + ' → home', legTime(lv && lv.bus, p.bus.at, p.bus.off), badge(lv && lv.bus)));
  }
  if (ar.home != null) rows.push('<div class="st-end">' + ic('home', 'xs') + '<span>Home about <b>' + C.hhmm(ar.home) + '</b></span></div>');
  return '<div class="st-list">' + rows.join('') + '</div>';
}
// Herzliya, mornings: the two stops everyone uses (החדש, הליכה) first, then walking.
// Tap one to use it today; your usual choice is in trip settings.
function hzHtml(c, m, p) {
  if (!p || p.trainArr == null) return '';
  const opts = C.hzOptions(c, m.wd, p.trainArr), cur = p.hzKind;
  const presets = opts.filter(o => o.kind !== 'foot').sort((a, b) => a.arrive - b.arrive), foot = opts.find(o => o.kind === 'foot');
  const fastest = presets.length ? presets[0].kind : null;
  const missing = C.HZ_STOPS.filter(P => !presets.some(o => o.kind === P.key));
  const row = o => {
    const isFoot = o.kind === 'foot';
    return '<button class="hz-opt' + (isFoot ? ' foot' : '') + '" id="hz-' + o.kind + '" data-act="hz-pick" data-k="' + o.kind + '" data-dk="' + esc(m.dk) + '" aria-pressed="' + (o.kind === cur) + '">' +
      (isFoot ? '<span class="nick foot">' + ic('walk', 'xs') + '</span>' : '<span class="nick">' + bdi(o.nick) + '</span>') +
      '<span class="hz-main"><b>' + (isFoot ? 'Walk all the way' : 'Bus ' + esc(o.hz.line) + ' · ' + C.hhmm(o.hz.at)) + (o.kind === fastest ? ' <em>fastest</em>' : '') + '</b>' +
      '<span>' + (isFoot ? entName('main') : 'from ' + bdi(C.stopName(o.hz.from))) + '</span></span>' +
      '<span class="hz-t">' + C.hhmm(o.arrive) + '<small>at school</small></span></button>';
  };
  return '<div class="hz-block" role="group" aria-label="Recommended in Herzliya"><p class="hz-h">Recommended in Herzliya · train arrives ' + C.hhmm(p.trainArr) + '</p>' +
    presets.map(row).join('') +
    missing.map(P => '<div class="hz-opt off"><span class="nick">' + bdi(P.nick) + '</span><span class="hz-main"><b>No bus soon</b><span>' + bdi(C.stopName(P.code)) + '</span></span></div>').join('') +
    (foot ? row(foot) : '') + '</div>';
}
function altsHtml(opts, cur, act) {
  const now = D.nowMin(), seen = new Set(), list = opts.filter(o => o.leave >= now - 1 && !seen.has(o.leave) && seen.add(o.leave)).slice(0, 4);
  if (list.length < 2) return '';
  return '<div class="alts" role="group" aria-label="Other options">' + list.map(o => '<button class="alt" id="alt-' + o.leave + '" data-act="' + act + '" data-t="' + o.leave + '" aria-pressed="' + (o.leave === cur) + '">' +
    'Leave ' + C.hhmm(o.leave) + (o.ok === false ? ' · late' : '') + '</button>').join('') + '</div>';
}

/* ---------- problems + how it works ---------- */
function problems() {
  const hh = C.health(), out = [];
  if (hh.expired || hh.stale) out.push('<b>Problem:</b> the timetable hasn’t updated for ' + hh.age + ' days, so planned times may be wrong. Live times still work. Let the app owner know.');
  if (hh.liveDown) out.push('<b>Problem:</b> live data isn’t loading right now, so these times come from the timetable only.');
  return out;
}
const problemsHtml = () => problems().map(p => '<p class="problem" role="alert">' + ic('info', 'xs') + '<span>' + p + '</span></p>').join('');
D.SHEETS.tripinfo = () => {
  const hh = C.health();
  const row = (t, d) => '<div class="info-row"><b>' + t + '</b><span>' + d + '</span></div>';
  return {
    title: 'How live times work',
    body: problemsHtml() + '<div class="info-list">' +
      row('Live', 'The bus or train is being tracked by GPS right now. The time is when it will really get there.') +
      row('Scheduled', 'It hasn’t started its route yet, so the time comes from the official timetable.') +
      row('Late or early', '“in 2 min” and the clock time are when it will really arrive. Any delay is already counted in. “15 min late” only tells you how far behind its timetable it is (shown when it’s 2 minutes or more). Your leave time moves with your bus.') +
      row('Orange card', 'Leave within 5 minutes, or your bus is late enough that you might miss the train.') +
      row('In Herzliya', 'Every morning the card shows the two stops everyone gets off at, fastest first. <b>החדש</b> = ז\'בוטינסקי/הרב קוק, right by the New High School entrance (bus 34 and others). <b>הליכה</b> = בן ציון מיכאלי/יוסף נבו, one or two stops from the station, then a short walk to the main entrance. Tap one to use it today; pick your usual one in trip settings. Walking the whole way (about 15 min) is there too.') +
      row('Entrances', 'New High School (תיכון חדש): on Sderot Shivat HaKochavim, by the 33/34 stop. Main entrance (הנדסאים): the gate just past Kanyon Shivat HaKochavim. The card tells you which one you’ll use.') +
      row('Trains home', 'Trains to Rosh HaAyin start at Herzliya, so they only turn Live once they leave. They almost always leave on time.') +
      row('School times', 'Once you pick your class (Timetable on the School page), the trip follows your real day: on time for your first lesson, home after your last. The school posts changes around 20:00 the evening before, so a cancelled first lesson means a later bus. Until then it uses the weekly plan.') +
      row('Updates', 'The bus and train timetable updates itself every Sunday and Wednesday' + (hh.age != null ? ' (last update ' + (hh.age === 0 ? 'today' : hh.age === 1 ? 'yesterday' : hh.age + ' days ago') + ')' : '') + '. If it’s more than ' + C.STALE_DAYS + ' days old, the card shows “Problem”: planned times may be wrong.') +
      row('Where it comes from', 'The Ministry of Transport’s official timetable and live feed, the same data Moovit uses.') +
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
function planHz(c) { const ph = c && C.rail() ? C.phase(c) : null, p = ph && (ph.pick || (ph.m && ph.m.best) || (ph.a && ph.a.best)); return p && p.hz ? p.hz : null; }
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
    // The minutes and the clock time are when it really arrives: any delay is already counted in.
    const vs2 = r.delay != null && r.v.live && Math.abs(r.delay) >= 2 ? ' · timetable said ' + C.hhmm(r.sched) : '';
    return '<div class="bd-row"><span class="ln-pill">' + esc(r.v.line) + '</span><div class="bd-main"><b>' + (mins <= 0 ? 'Arriving now' : 'in ' + mins + ' min') + '</b><span>Arrives ' + C.hhmm(r.eta) + vs2 + ' · to ' + bdi(r.v.dest || r.v.destEn) + '</span></div>' + st + '</div>';
  }).join('') + '</div>';
}
function trainRows(station, dir, max) {
  const wd = D.dayAt(0).getDay(), now = nowMin();
  const list = C.trainsOf(dir, wd).filter(t => t.dep >= now - 2).slice(0, max || 4);
  if (!list.length) return '<p class="sheet-note">No more trains today.</p>';
  return '<div class="board">' + list.map(t => {
    const l = C.liveTrain(station, t.dep, t.no), when = l && l.live ? l.eta : t.dep, mins = when - now;
    const moved = l && l.live && Math.abs(l.delay) >= 2;
    return '<div class="bd-row"><span class="ln-pill train">' + ic('train', 'xs') + '</span><div class="bd-main"><b>' + (mins <= 0 ? 'Leaving now' : 'in ' + mins + ' min') + '</b><span>Leaves ' + C.hhmm(when) + (moved ? ' · timetable said ' + C.hhmm(t.dep) : '') + ' · train ' + esc(t.no) + ' · arrives ' + C.hhmm(t.arr + (l && l.live ? Math.max(0, l.delay) : 0)) + '</span></div>' + badge(l) + '</div>';
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
  body += '<p class="sheet-note">' + (lv.at ? 'Updated ' + (age < 60 ? 'just now' : Math.round(age / 60) + ' min ago') + '. ' : 'Loading live data… ') +
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
D.SHEETS.commute = () => {
  const f = work(), hz = f.hz, home = f.home;
  const tstep = (wd, k) => '<span class="mini-step"><button id="cs-' + wd + k + '-m" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="-5" aria-label="Earlier">−</button><output>' + (f.days[wd][k] || '—') + '</output><button id="cs-' + wd + k + '-p" data-act="cs-time" data-wd="' + wd + '" data-k="' + k + '" data-d="5" aria-label="Later">+</button></span>';
  return {
    title: 'Trip & school times',
    body:
      '<p class="group-title">In Rosh HaAyin</p>' +
      '<div class="pick-row" role="group" aria-label="Your bus lines">' + HOME_LINES.map(l => '<button class="pick" id="hl-' + l + '" data-act="home-line" data-v="' + l + '" aria-pressed="' + (home.lines.indexOf(l) >= 0) + '">' + l + '</button>').join('') + '</div>' +
      '<div class="menu-list">' + pickRow('pick-home', 'Your bus stop', home.stop, 'pick-home') + '</div>' +
      '<div>' + step('cl-walk1', 'Walk to your stop', f.legs.walk1, 'cs-leg', 'walk1') + step('cl-buffer', 'Time at the station', f.legs.buffer, 'cs-leg', 'buffer', 'Before the train leaves') +
      (home.stop ? '' : step('cl-bus1', 'Bus ride (estimate)', f.legs.bus1, 'cs-leg', 'bus1', 'Until you pick your stop')) + '</div>' +
      '<p class="group-title">In Herzliya</p><p class="sheet-note">Two stops, the ones everyone uses: <b>החדש</b> (ז\'בוטינסקי/הרב קוק, right by the New High School entrance) and <b>הליכה</b> (בן ציון מיכאלי/יוסף נבו, then a short walk to the main entrance). The trip card shows both every morning. Pick your usual one:</p>' +
      '<div class="seg hz-seg" role="radiogroup" aria-label="Your usual way from Herzliya station">' + [['auto', 'Fastest'], ['chadash', 'החדש'], ['halicha', 'הליכה'], ['foot', 'Walk']].map(o => '<button id="hzp-' + o[0] + '" role="radio" data-act="hz-mode" data-v="' + o[0] + '" aria-checked="' + ((hz.prefer || (hz.mode === 'walk' ? 'foot' : 'auto')) === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
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
  // a bus number (e.g. 74 or 71א) shows that line's stops; 4+ digits is a stop code; anything else searches names
  const isLine = /^\d{1,3}[֐-׿]?$/.test(qq), isCode = /^\d{4,}$/.test(qq);
  const rows = items.filter(x => !qq || (isLine ? Array.from(x.lines).some(l => l === qq || l.replace(/\D+$/, '') === qq) : isCode ? x.code.indexOf(qq) === 0 : C.stopName(x.code).indexOf(qq) >= 0));
  if (!rows.length) return '<p class="sheet-note">' + (isLine ? 'No stop here on line ' + esc(qq) + '. Turn the line on above, or check the number.' : 'No stop matches “' + esc(qq) + '”.') + '</p>';
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
    body: '<input class="text-in" id="pick-q" placeholder="Street name or bus number, e.g. 74" autocomplete="off" dir="auto" value="' + esc(a.q || '') + '">' +
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
  'alt-pick': el => { S.pick = +el.dataset.t; render(); shareChoice('to', S.pick); },
  'hz-pick': el => { C.setHzPick(el.dataset.dk, el.dataset.k); render(); if (window.SOCIAL && window.SOCIAL.refresh) window.SOCIAL.refresh(); },
  'alt-back': el => { S.pickBack = +el.dataset.t; render(); shareChoice('home', S.pickBack); },
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
  'hz-mode': el => { syncOff(); const hz = work().hz; hz.prefer = el.dataset.v; hz.mode = el.dataset.v === 'foot' ? 'walk' : 'auto'; D.renderSheet(); },
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
