/* Dashboard v3 — the tour (Settings → Take the tour; offered once to new accounts).
   Fourteen short chapters. Each one plays a live demo built from the app's real cards
   (the same classes, so it looks exactly like the app), with a "finger" that taps,
   types and presses the way you would, next to a short plain explanation.
   • Next / Back, swipe, or the arrow keys; × or Escape closes. Demos replay on a loop.
   • Reduced motion: no finger, no loop: each demo shows its end state.
   • Both languages: the copy goes through the dictionary like the rest of the app, and
     the example content (tasks, foods…) is written in the language you use.
   Loaded on demand (core.js), so it costs nothing until you open it. */
(function () {
'use strict';
const D = window.DASH, ic = D.ic, esc = D.esc, HE = D.he;
const L = (en, he) => (HE ? he : en);
const own = s => '<bdi>' + esc(s) + '</bdi>';
const STOP = {};
const reduced = () => D.reduced();
let SEQ = 0, WK = '';

/* ---------- look ---------- */
const CSS = `
@property --ta { syntax:'<color>'; inherits:true; initial-value:#6A43E8; }
.tour { --ta:#6A43E8; position:fixed; inset:0; z-index:300; display:flex; flex-direction:column; color:#fff;
  background:radial-gradient(140% 75% at 50% -12%, color-mix(in srgb, var(--ta) 78%, #000) 0%, color-mix(in srgb, var(--ta) 34%, #07080d) 52%, #07080d 100%);
  transition:--ta .8s ease;
  padding:calc(env(safe-area-inset-top, 0px) + 10px) max(16px, env(safe-area-inset-right, 0px)) calc(env(safe-area-inset-bottom, 0px) + 14px) max(16px, env(safe-area-inset-left, 0px));
  animation:tourIn .5s cubic-bezier(.2,.8,.2,1) both; overscroll-behavior:contain; -webkit-user-select:none; user-select:none; }
@keyframes tourIn { from { opacity:0; transform:scale(1.04); } }
.tour.out { animation:tourOut .28s ease both; }
@keyframes tourOut { to { opacity:0; transform:scale(.98); } }
.tour button { color:inherit; }
.tour-top { display:flex; align-items:center; gap:14px; min-height:44px; max-width:1040px; width:100%; margin:0 auto; }
.tour-bars { flex:1; display:flex; gap:4px; }
.tour-bars span { flex:1; height:3px; border-radius:3px; background:rgba(255,255,255,.22); overflow:hidden; }
.tour-bars i { display:block; height:100%; width:0; background:#fff; border-radius:inherit; }
.tour-bars .done i { width:100%; }
.tour-bars .now i { animation:tourBar var(--dur, 8s) linear forwards; }
@keyframes tourBar { to { width:100%; } }
.tour-x { width:40px; height:40px; border-radius:999px; display:grid; place-items:center; background:rgba(255,255,255,.14); flex:none; }
.tour-body { flex:1; min-height:0; display:flex; flex-direction:column; gap:20px; padding-top:14px; max-width:1040px; width:100%; margin:0 auto; touch-action:pan-y; }
.tour-stage { flex:1; min-height:180px; position:relative; display:flex; align-items:center; justify-content:center; }
.tour-fit { position:relative; }
.tour-frame { position:absolute; top:0; left:0; width:388px; transform-origin:0 0; background:var(--ground); color:var(--ink); border-radius:34px; padding:14px; overflow:hidden;
  box-shadow:0 40px 90px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.08); text-align:start; }
.tour-frame * { pointer-events:none !important; }
.tour-frame.bare { background:transparent; box-shadow:none; }
.tour-screen { position:relative; min-height:inherit; display:flex; flex-direction:column; gap:12px; transition:opacity .35s ease; }
.tour-screen.fade { opacity:0; }
.tour-copy { min-height:0; }
.tour-eb { font-size:13px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:rgba(255,255,255,.72); }
.tour-h { font-family:var(--f-display); font-size:30px; line-height:1.08; font-weight:800; margin-top:6px; letter-spacing:-.02em; color:#fff; text-wrap:balance; }
.tour-p { font-size:16px; line-height:1.5; color:rgba(255,255,255,.88); margin-top:8px; max-width:46ch; }
.tour-tips { display:grid; gap:8px; margin-top:12px; font-size:14px; color:rgba(255,255,255,.86); }
.tour-tips li { display:flex; gap:10px; align-items:flex-start; line-height:1.4; }
.tour-tips li::before { content:""; flex:none; width:9px; height:9px; border-radius:999px; margin-top:5px; background:var(--c, rgba(255,255,255,.7)); box-shadow:0 0 0 3px color-mix(in srgb, var(--c, #fff) 22%, transparent); }
.tour-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.tour-chip { min-height:38px; padding:0 14px; border-radius:999px; background:rgba(255,255,255,.12); font-weight:700; font-size:14px; display:inline-flex; align-items:center; gap:6px; }
.tour-chip:active { background:rgba(255,255,255,.22); }
.tour-nav { display:flex; gap:10px; padding-top:14px; max-width:1040px; width:100%; margin:0 auto; }
.tour-nav button { min-height:54px; border-radius:999px; font-weight:800; font-size:17px; display:inline-flex; align-items:center; justify-content:center; gap:8px; transition:transform .12s, opacity .2s; }
.tour-nav button:active { transform:scale(.97); }
.tour-back { padding:0 22px; background:rgba(255,255,255,.12); }
.tour-back[disabled] { opacity:0; pointer-events:none; }
.tour-next { flex:1; background:#fff; color:#0B0D12 !important; box-shadow:0 10px 30px -8px rgba(0,0,0,.5); }
.tour button:focus-visible { outline:3px solid rgba(255,255,255,.7); outline-offset:3px; }
.tour-copy.in-next, .tour-fit.in-next { animation:tourNext .45s cubic-bezier(.2,.8,.2,1) both; }
.tour-copy.in-prev, .tour-fit.in-prev { animation:tourPrev .45s cubic-bezier(.2,.8,.2,1) both; }
@keyframes tourNext { from { opacity:0; transform:translateX(28px); } }
@keyframes tourPrev { from { opacity:0; transform:translateX(-28px); } }
[dir="rtl"] .tour-copy.in-next, [dir="rtl"] .tour-fit.in-next { animation-name:tourPrev; }
[dir="rtl"] .tour-copy.in-prev, [dir="rtl"] .tour-fit.in-prev { animation-name:tourNext; }
/* the finger */
.tour-finger { position:absolute; left:0; top:0; width:46px; height:46px; margin:-23px 0 0 -23px; border-radius:999px; z-index:9; pointer-events:none;
  background:radial-gradient(circle at 40% 35%, rgba(255,255,255,.95), rgba(255,255,255,.55)); border:2px solid #fff; box-shadow:0 8px 24px rgba(0,0,0,.35), 0 0 0 6px rgba(255,255,255,.18);
  opacity:0; transition:transform .6s cubic-bezier(.3,.7,.2,1), opacity .25s, scale .14s ease; }
.tour-finger.on { opacity:.92; }
.tour-finger.press { scale:.78; }
.tour-finger.hold::after { content:""; position:absolute; inset:-10px; border-radius:inherit; border:3px solid #fff; animation:tourHold .65s ease-out forwards; }
@keyframes tourHold { from { opacity:1; transform:scale(.6); } to { opacity:0; transform:scale(1.5); } }
.tour-ripple { position:absolute; width:60px; height:60px; margin:-30px 0 0 -30px; border-radius:999px; background:rgba(255,255,255,.55); pointer-events:none; z-index:8; animation:tourRip .5s ease-out forwards; }
@keyframes tourRip { from { transform:scale(.3); opacity:.9; } to { transform:scale(1.6); opacity:0; } }
/* demo pieces that live in fixed places in the real app */
.tour-clock { align-self:flex-start; display:inline-flex; align-items:center; gap:6px; font-weight:800; font-size:14px; padding:6px 12px; border-radius:999px; background:var(--surface); box-shadow:var(--shadow); font-variant-numeric:tabular-nums; }
.tour-toast { position:absolute; left:8px; right:8px; bottom:8px; z-index:4; border-radius:18px; box-shadow:0 12px 30px rgba(0,0,0,.28); animation:slideUp .3s cubic-bezier(.2,.9,.3,1.2) both; }
.tour-sheet { position:absolute; left:0; right:0; bottom:0; z-index:5; background:var(--surface); border-radius:26px 26px 0 0; padding:10px 14px 16px; box-shadow:0 -10px 40px rgba(0,0,0,.25);
  transform:translateY(105%); transition:transform .38s cubic-bezier(.2,.9,.25,1); }
.tour-sheet.open { transform:none; }
.tour-sheet .grab { width:40px; height:5px; border-radius:9px; background:var(--line); margin:0 auto 10px; }
.tour-sheet h4 { font-size:19px; font-weight:800; padding:2px 4px 10px; }
.tour-scrim { position:absolute; inset:0; z-index:4; background:rgba(0,0,0,.32); opacity:0; transition:opacity .3s; }
.tour-scrim.on { opacity:1; }
.tour-rest { position:absolute; left:8px; right:8px; bottom:8px; z-index:4; border-radius:20px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,.25); animation:slideUp .3s cubic-bezier(.2,.9,.3,1.2) both; }
.tour-notif { position:absolute; left:8px; right:8px; top:8px; z-index:6; display:flex; gap:10px; align-items:center; padding:10px 12px; border-radius:20px;
  background:color-mix(in srgb, var(--surface) 88%, transparent); -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); box-shadow:0 14px 40px rgba(0,0,0,.28);
  transform:translateY(-130%); transition:transform .5s cubic-bezier(.2,.9,.25,1.1); }
.tour-notif.on { transform:none; }
.tour-notif img { width:38px; height:38px; border-radius:10px; flex:none; }
.tour-notif b { display:flex; justify-content:space-between; font-size:15px; }
.tour-notif b small { font-weight:500; color:var(--ink-3); font-size:13px; }
.tour-notif span { font-size:14px; color:var(--ink-2); display:block; line-height:1.3; }
.tour-swap { transition:opacity .3s ease, transform .3s ease; }
.tour-swap.fade { opacity:0; transform:translateY(6px); }
.tour-cloud { display:flex; align-items:center; gap:12px; padding:14px 16px; border-radius:var(--r-l); background:var(--surface); box-shadow:var(--shadow); font-weight:700; }
.tour-cloud .ci { width:42px; height:42px; border-radius:999px; display:grid; place-items:center; background:var(--surface-2); color:var(--ink-2); transition:background-color .3s, color .3s; }
.tour-cloud.ok .ci { background:var(--food-soft); color:var(--food-ink); }
.tour-cloud small { display:block; font-weight:500; color:var(--ink-3); font-size:13px; }
.tour-done { display:grid; place-items:center; flex:1; position:relative; }
.tour-done svg.big { width:150px; height:150px; }
.tour-done circle.r { fill:none; stroke:#fff; stroke-width:8; stroke-dasharray:440; stroke-dashoffset:440; transform:rotate(-90deg); transform-origin:center; animation:tourDraw 1s .2s cubic-bezier(.6,0,.2,1) forwards; }
.tour-done path.c { fill:none; stroke:#fff; stroke-width:10; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:120; stroke-dashoffset:120; animation:tourDraw .5s 1s ease forwards; }
@keyframes tourDraw { to { stroke-dashoffset:0; } }
.tour-done i { position:absolute; width:10px; height:10px; border-radius:3px; top:50%; left:50%; opacity:0; animation:tourBurst 1.1s 1.1s cubic-bezier(.2,.8,.3,1) forwards; }
@keyframes tourBurst { 0% { opacity:1; transform:translate(-50%,-50%) rotate(0); } 100% { opacity:0; transform:translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(220deg); } }
@media (min-width: 900px) {
  .tour-body { flex-direction:row; align-items:center; gap:56px; }
  .tour-stage { flex:1.15; height:100%; }
  .tour-copy { flex:1; }
  .tour-h { font-size:44px; }
  .tour-p { font-size:18px; }
  .tour-nav { justify-content:flex-end; }
  .tour-next { flex:none; min-width:220px; }
}
@media (max-height: 700px) and (max-width: 899px) { .tour-h { font-size:24px; } .tour-p { font-size:15px; } .tour-tips { display:none; } }
@media (prefers-reduced-motion: reduce) { .tour, .tour-copy, .tour-fit { animation:none !important; } .tour-bars .now i { animation:none; width:100%; } }
`;

/* ---------- small builders (the app's own markup) ---------- */
const CHECK = '<span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4L18 8"/></svg></span>';
const task = (text, opt) => '<li class="task' + (opt && opt.done ? ' is-done' : '') + '"' + (opt && opt.id ? ' id="' + opt.id + '"' : '') + '><span class="check">' + CHECK + '</span><div class="task-text"><span class="tt">' + own(text) + '</span>' + (opt && opt.meta ? '<span class="task-meta">' + opt.meta + '</span>' : '') + '</div></li>';
const leg = (icon, label, t, key) => '<div class="leg' + (key ? ' key' : '') + '"><span class="dot">' + ic(icon, 'sm') + '</span><span class="ln">' + label + '</span><span class="tm">' + t + '</span></div>';
const journey = legs => '<div class="journey" style="grid-template-columns:repeat(' + legs.length + ',minmax(0,1fr))">' + legs.join('') + '</div>';
const stRow = (icon, title, where, t, badge, id) => '<div class="st-row"' + (id ? ' id="' + id + '"' : '') + '>' + ic(icon, 'sm') + '<div class="st-main"><b>' + title + '</b><span>' + where + '</span></div><div class="st-side"><span class="st-t">' + t + '</span>' + badge + '</div></div>';
const badge = (kind, text) => '<span class="st-b' + (kind ? ' ' + kind : '') + '">' + (kind ? '<i></i>' : '') + text + '</span>';
const wait = (cls, text, id) => '<div class="st-wait ' + cls + '"' + (id ? ' id="' + id + '"' : '') + '><i aria-hidden="true"></i><span>' + text + '</span></div>';
const avatar = (n, size) => '<span class="fav s' + size + ' ini" aria-hidden="true">' + esc(n.charAt(0)) + '</span>';
const nextDow = wd => { const t = D.dayAt(0).getDay(); return ((wd - t) + 7) % 7 || 7; };
const dayName = off => D.DOW_L[D.dayAt(off).getDay()];

/* ---------- the chapters ---------- */
const CH = [
  { key: 'welcome', area: 'todo', chip: '', eb: 'Welcome', h: 'Your whole day, in one place',
    p: 'Tasks, the trip to school, your timetable, gym and food. Each works on its own, and the Today screen pulls them together. Here’s how it all works, in about two minutes.',
    dur: 5000, height: 420, minH: 0,
    build: () => '<div class="tour-swap"><p class="eyebrow">' + esc(D.dLong(D.dayAt(0))) + '</p><h1 style="font-size:34px;margin-top:2px">' + (HE ? 'בוקר טוב' : 'Morning') + '</h1></div>' +
      '<div class="tiles" id="tw-tiles">' + [['todo', 'sun', 'Today', '4<small>of 6</small>', 'Next: ' + own(L('Return library book', 'להחזיר ספר לספרייה'))], ['school', 'school', 'School', '2<small>due</small>', own(L('Bio test', 'מבחן בביו')) + ' · ' + esc(D.DOW[D.dayAt(2).getDay()])], ['gym', 'gym', 'Gym', own(L('Push', 'דחיפה')), 'Up next'], ['food', 'food', 'Food', '1,240<small>kcal</small>', '1,160 left']]
        .map((t, i) => '<a class="tile" data-area="' + t[0] + '" id="tw-' + i + '"' + (t[0] === 'todo' ? ' style="--tb:var(--todo-soft);--ta:var(--todo-ink);--tr:var(--todo);opacity:0;transform:scale(.85)"' : ' style="opacity:0;transform:scale(.85)"') + '><span class="tile-top"><span class="tile-label">' + ic(t[1], 'sm') + t[2] + '</span><span class="tw-ring">' + D.ring('tw' + i + '-' + SEQ, 0, 44, 6) + '</span></span><span class="tile-val">' + t[3] + '</span><span class="tile-sub">' + t[4] + '</span></a>').join('') + '</div>',
    play: async x => {
      for (let i = 0; i < 4; i++) { const t = x.$('#tw-' + i); t.style.transition = 'opacity .45s ease, transform .55s cubic-bezier(.3,1.5,.5,1)'; t.style.opacity = 1; t.style.transform = 'none'; await x.wait(220); }
      await x.wait(300);
      const k = ++SEQ;
      [0.66, 0.4, 0.66, 0.52].forEach((p, i) => { x.$('#tw-' + i + ' .tw-ring').innerHTML = D.ring('tw' + i + '-' + k, p, 44, 6); });
      D.animate(x.screen);
      await x.wait(1600);
    } },

  { key: 'today', area: 'school', chip: 'Today', eb: 'Today', h: 'One card that knows what’s next',
    p: 'The big card on top changes through the day. Tap it to open the details.',
    tips: [['Morning: when to leave, counting down', 'school'], ['Afternoon: how your list is going', 'todo'], ['Evening: tomorrow’s first train', 'school']],
    dur: 11000, height: 290, minH: 0,
    build: () => '<span class="tour-clock" id="tt-clock">' + ic('clock', 'xs') + '<span>06:57</span></span>' +
      '<a class="hero" data-area="school" id="tt-hero"><span class="hero-top"><span>To school</span><span class="go">' + ic('go', 'sm') + '</span></span>' +
      '<span class="hero-big"><span class="lead">Leave in</span><span class="n" id="tt-n">12</span><span class="u">min</span></span>' +
      '<span class="hero-sub">07:09 · bus 74 → 07:19 train <span class="tag">Live</span></span><span class="hero-bar"><span id="tt-bar" style="width:40%"></span></span></a>',
    play: async x => {
      const n = x.$('#tt-n'), bar = x.$('#tt-bar'), clock = x.$('#tt-clock span');
      for (let m = 12; m >= 5; m--) { n.textContent = m; bar.style.width = (m / 30 * 100) + '%'; clock.textContent = D.hhmm(7 * 60 + 9 - m); await x.wait(420); }
      x.$('#tt-hero').dataset.area = 'amber';
      await x.wait(1600);
      await x.swap('#tt-hero', () => {
        clock.textContent = '13:40';
        const h = x.$('#tt-hero'); h.dataset.area = 'todo';
        h.innerHTML = '<span class="hero-top"><span>Today</span><span class="go">' + ic('go', 'sm') + '</span></span><span class="hero-big"><span class="n">4</span><span class="u">of 6 done</span></span><span class="hero-sub"><span>Next: ' + own(L('Return library book', 'להחזיר ספר לספרייה')) + '</span></span><span class="hero-bar"><span style="width:66%"></span></span>';
      });
      await x.wait(2600);
      await x.swap('#tt-hero', () => {
        clock.textContent = '20:30';
        const h = x.$('#tt-hero'); h.dataset.area = 'school';
        h.innerHTML = '<span class="hero-top"><span>Tomorrow · ' + esc(D.dShort(D.dayAt(1))) + '</span><span class="go">' + ic('go', 'sm') + '</span></span><span class="hero-big"><span class="lead">Leave</span><span class="n">07:09</span></span><span class="hero-sub">07:19 train · 2 on your list</span>';
      });
      await x.wait(2400);
    } },

  { key: 'tasks', area: 'todo', chip: 'Tasks', eb: 'Tasks', h: 'Write it, tick it, done',
    p: 'Add a task and tick it off when it’s done. End it with a day, and it waits for that day instead.',
    tips: [['“fri”, “tomorrow”, “25/10” or “in 3 days” all work', 'todo'], ['Anything unfinished moves to the next day by itself', 'todo']],
    dur: 12000, height: 440, minH: 380,
    build: () => '<section class="card todo"><div class="todo-head"><div class="todo-title"><h2>Today</h2><span class="todo-count" id="tk-count">2 of 4</span></div></div>' +
      '<div class="progress"><span id="tk-prog" style="width:50%"></span></div>' +
      '<form class="add-row"><input id="tk-in" placeholder="Add a task" readonly><span class="date-btn">' + ic('cal') + '</span><span class="add-btn" id="tk-add">' + ic('plus') + '</span></form>' +
      '<div class="todo-when" id="tk-when" hidden></div>' +
      '<ul class="tasks" id="tk-list">' + task(L('Print bio worksheet', 'להדפיס דף עבודה בביו'), { id: 'tk-0' }) + task(L('Email Dana about the project', 'לשלוח לדנה מייל על הפרויקט')) + '</ul>' +
      '<div id="tk-extra"><div class="fold-line"><span class="ok">' + ic('check', 'xs') + '</span><span id="tk-done">2 done</span>' + ic('chev-r', 'sm chev') + '</div></div></section>',
    play: async x => {
      const off = nextDow(5), word = L('buy charger fri', 'לקנות מטען שישי');
      await x.tap('#tk-in');
      await x.type('#tk-in', word);
      const w = x.$('#tk-when'); w.hidden = false;
      w.innerHTML = '<span class="when-chip">' + ic('cal', 'xs') + 'For ' + esc(off === 1 ? 'Tomorrow' : dayName(off)) + ' · ' + esc(D.dShort(D.dayAt(off))) + '</span><span class="when-text">“' + own(L('buy charger', 'לקנות מטען')) + '”</span>';
      await x.wait(1300);
      await x.tap('#tk-add');
      x.$('#tk-in').value = ''; w.hidden = true;
      x.toast('Added for ' + (off === 1 ? 'Tomorrow' : dayName(off)));
      const ex = x.$('#tk-extra');
      ex.insertAdjacentHTML('beforeend', '<div class="fold-line" style="animation:taskIn .3s both"><span class="ok up">' + ic('cal', 'xs') + '</span><span class="up-sum">Coming up · 1</span>' + ic('chev-r', 'sm chev') + '</div>');
      await x.wait(1500);
      await x.tap('#tk-0 .check');
      x.$('#tk-0').classList.add('is-done');
      x.$('#tk-count').textContent = '3 of 4'; x.$('#tk-prog').style.width = '75%';
      await x.wait(900);
      x.$('#tk-0').classList.add('fold'); x.$('#tk-done').textContent = '3 done';
      x.lift();
      await x.wait(1800);
    } },

  { key: 'more', area: 'todo', chip: 'Press and hold', eb: 'Tasks', h: 'Press and hold for more',
    p: 'Pin a task to the top, move it to another day, or make it come back. Repeats stay simple on purpose: no times, and they never pile up.',
    tips: [['Every day, school days, or one day a week', 'todo']],
    dur: 10000, height: 400, minH: 400,
    build: () => '<section class="card todo"><div class="todo-head"><div class="todo-title"><h2>Today</h2><span class="todo-count">0 of 3</span></div></div><div class="progress"><span style="width:0"></span></div>' +
      '<ul class="tasks">' + task(L('Pack gym bag', 'לארוז תיק לחדר כושר'), { id: 'mo-0' }) + task(L('Return library book', 'להחזיר ספר לספרייה')) + task(L('Call grandma', 'להתקשר לסבתא')) + '</ul></section>' +
      '<div class="tour-scrim" id="mo-scrim"></div><div class="tour-sheet" id="mo-sheet"><div class="grab"></div><h4>' + own(L('Pack gym bag', 'לארוז תיק לחדר כושר')) + '</h4><div class="menu-list" id="mo-menu">' +
      '<div class="menu-item">' + ic('pin') + 'Pin to top</div><div class="menu-item">' + ic('arrow') + 'Move to tomorrow</div><div class="menu-item">' + ic('cal') + 'Move to a date…</div><div class="menu-item" id="mo-rep">' + ic('repeat') + 'Repeat…</div></div></div>',
    play: async x => {
      await x.tap('#mo-0 .task-text', { hold: true });
      x.$('#mo-0').classList.add('pressing'); await x.wait(250); x.$('#mo-0').classList.remove('pressing');
      x.$('#mo-scrim').classList.add('on'); x.$('#mo-sheet').classList.add('open');
      await x.wait(1100);
      await x.tap('#mo-rep');
      const menu = x.$('#mo-menu');
      menu.style.transition = 'opacity .2s'; menu.style.opacity = 0; await x.wait(220);
      menu.innerHTML = '<div class="menu-item">Every day</div><div class="menu-item" id="mo-sd">School days (Sun–Thu)</div><div class="menu-item">Every ' + esc(D.DOW_L[D.dayAt(0).getDay()]) + '</div>';
      menu.style.opacity = 1;
      await x.wait(900);
      await x.tap('#mo-sd');
      x.$('#mo-sheet').classList.remove('open'); x.$('#mo-scrim').classList.remove('on'); x.lift();
      await x.wait(350);
      x.$('#mo-0 .task-text').insertAdjacentHTML('beforeend', '<span class="task-meta" style="animation:taskIn .3s both"><span class="chip-s rpt">' + ic('repeat', 'xs') + 'school days</span></span>');
      x.toast('Repeats school days');
      await x.wait(2200);
    } },

  { key: 'trip', area: 'school', chip: 'Trip to school', eb: 'Trip to school', h: 'Leave at the right minute',
    p: 'Pick your bus stop once. Every school day it plans the bus, the train and the bus in Herzliya around your first lesson, and follows them live.',
    tips: [['Green: plenty of time to make the change', '#2EE59D'], ['Amber: tight, walk fast', '#FFB21E'], ['Red: you might miss it, so check the next option', '#FF5A6E']],
    dur: 11000, height: 520, minH: 0,
    build: () => '<section class="commute"><div class="row1"><span class="lbl">To school · first lesson 08:30</span><span class="tools"><span class="tt-tag on"><i class="ld"></i>Live</span></span></div>' +
      '<div><p class="big">Leave 07:24<small id="tr-in">in 12 min</small></p><p class="note" id="tr-note">At school 08:22 · 8 min early · Main entrance (הנדסאים)</p></div>' +
      journey([leg('walk', 'Walk', '07:24'), leg('bus', 'Bus 74', '07:27'), leg('train', 'Train', '07:49', 1), leg('bus', 'Bus 501', '08:16'), leg('flag', 'School', '08:22', 1)]) +
      '<div class="st-list">' + stRow('bus', 'Bus 74', own('יהודה הלוי/ שילה'), '<span id="tr-bt">07:27</span><span class="arr"> → 07:42</span>', badge('', 'Scheduled'), 'tr-bus') +
      wait('ok', '7 min at Rosh HaAyin North before the train (2-min walk)', 'tr-w1') +
      stRow('train', 'Train 618', 'Rosh HaAyin North → Herzliya', '07:49<span class="arr"> → 08:11</span>', badge('ok', 'Live · on time')) + '</div></section>',
    play: async x => {
      const inn = x.$('#tr-in');
      for (let m = 12; m >= 10; m--) { inn.textContent = 'in ' + m + ' min'; await x.wait(800); }
      await x.wait(400);
      // the bus is running late: everything after it moves with it
      const b = x.$('#tr-bus');
      b.querySelector('.st-t').innerHTML = '<s>07:27</s> 07:31<span class="arr"> → 07:46</span>';
      b.querySelector('.st-b').outerHTML = badge('late', 'Live · 4 min late');
      b.animate([{ background: 'rgba(255,255,255,.18)' }, { background: 'transparent' }], { duration: 900 });
      await x.wait(700);
      const w = x.$('#tr-w1'); w.className = 'st-wait tight'; w.querySelector('span').textContent = 'Tight: 3 min at Rosh HaAyin North before the train (2-min walk)';
      w.animate([{ transform: 'scale(1.04)' }, { transform: 'none' }], { duration: 400 });
      inn.textContent = 'in 14 min';
      await x.wait(2400);
    } },

  { key: 'hz', area: 'school', chip: 'Herzliya stops', eb: 'Trip to school', h: 'החדש or הליכה?',
    p: 'In Herzliya you get the two stops everyone uses, side by side, with the faster one marked. Tap one to use it today; set your usual one in trip settings.',
    dur: 9000, height: 470, minH: 0,
    build: () => '<section class="commute"><div><p class="big" style="font-size:40px">Leave 07:24</p><p class="note" id="hz-note">At school 08:21 · 9 min early · New High School entrance (תיכון חדש)</p></div>' +
      '<div class="hz-block"><p class="hz-h">Recommended in Herzliya · train arrives 08:11</p>' +
      '<div class="hz-opt" id="hz-a" aria-pressed="true"><span class="nick"><bdi>החדש</bdi></span><span class="hz-main"><b>Bus 3 · 08:16 <em>fastest</em></b><span>from <bdi>ת. רכבת הרצליה</bdi></span></span><span class="hz-t">08:21<small>at school</small></span></div>' +
      '<div class="hz-opt" id="hz-b" aria-pressed="false"><span class="nick"><bdi>הליכה</bdi></span><span class="hz-main"><b>Bus 501 · 08:16</b><span>from <bdi>ת. רכבת הרצליה</bdi></span></span><span class="hz-t">08:22<small>at school</small></span></div>' +
      '<div class="hz-opt foot" aria-pressed="false"><span class="nick foot">' + ic('walk', 'xs') + '</span><span class="hz-main"><b>Walk all the way</b><span>Main entrance (הנדסאים)</span></span><span class="hz-t">08:25<small>at school</small></span></div></div></section>',
    play: async x => {
      await x.wait(1200);
      await x.tap('#hz-b');
      x.$('#hz-a').setAttribute('aria-pressed', 'false'); x.$('#hz-b').setAttribute('aria-pressed', 'true');
      x.$('#hz-note').textContent = 'At school 08:22 · 8 min early · Main entrance (הנדסאים)';
      x.lift();
      await x.wait(2600);
    } },

  { key: 'ride', area: 'school', chip: 'On the way', eb: 'On the way', h: 'It follows you',
    p: 'Once you leave, the card shows the next step and exactly when you’ll reach school. Missed the bus? “Not on it?” switches to the next one.',
    dur: 12000, height: 430, minH: 0,
    build: () => '<section class="commute"><div class="row1"><span class="lbl">On your way · first lesson 08:30</span><span class="tools"><span class="tt-tag on"><i class="ld"></i>Live</span></span></div>' +
      '<div class="tour-swap" id="rd-txt"><p class="big ride">Bus 74 at 07:27<small>in 3 min · at the station 07:42</small></p></div>' +
      '<p class="note">At school 08:22 · 8 min early</p>' +
      journey([leg('walk', 'Walk', '07:24', 1), leg('bus', 'Bus 74', '07:27'), leg('train', 'Train', '07:49'), leg('bus', 'Bus 501', '08:16'), leg('flag', 'School', '08:22')]) +
      '<button class="alt not-on" id="rd-not">Not on it? Leave 07:39 instead</button></section>',
    play: async x => {
      const steps = [['At the station 07:42', '7 min before the 07:49 train', 1], ['Train 07:49', 'leaves in 2 min · Herzliya 08:11', 2], ['Herzliya 08:11', 'then bus 501 (הליכה) at 08:16 · 5 min to get there (5-min walk)', 3], ['At school 08:22', '8 min early', 4]];
      const legs = Array.from(x.screen.querySelectorAll('.leg'));
      for (const s of steps) {
        await x.wait(1700);
        await x.swap('#rd-txt', () => { x.$('#rd-txt').innerHTML = '<p class="big ride">' + s[0] + '<small>' + s[1] + '</small></p>'; legs.forEach((l, i) => l.classList.toggle('key', i === s[2])); });
      }
      await x.wait(1000);
      await x.tap('#rd-not');
      await x.swap('#rd-txt', () => { x.$('#rd-txt').innerHTML = '<p class="big ride">Bus 74 at 07:42<small>in 3 min · at the station 07:57</small></p>'; legs.forEach((l, i) => l.classList.toggle('key', i === 0)); });
      x.lift();
      await x.wait(2000);
    } },

  { key: 'tt', area: 'school', chip: 'Timetable', eb: 'Timetable', h: 'Changes, the night before',
    p: 'Pick your class and your groups once. Around 20:00 the school posts tomorrow’s changes. They show up here, and your trip moves with them.',
    tips: [['Not updated yet: still the weekly plan', '#FFB21E'], ['Updated by the school: every change marked', '#2EE59D']],
    dur: 10000, height: 470, minH: 0,
    build: () => '<span class="tour-clock">' + ic('clock', 'xs') + '<span id="ti-clock">19:58</span></span>' +
      '<section class="card tt"><div class="tt-head"><h2 class="card-title">Timetable <small><bdi>יא3</bdi></small></h2><div class="seg sm"><button aria-selected="false">Today</button><button aria-selected="true">Tomorrow</button></div></div>' +
      '<div class="tour-swap" id="ti-state"><div class="tt-state wait">' + ic('clock', 'xs') + '<span><b>Not updated yet: this is the weekly plan.</b> The school posts the update for each day the day before, usually by 20:00. Until then cancelled lessons and absent teachers don’t show.</span></div></div>' +
      '<div class="tt-list planned" id="ti-list">' + [[1, '08:00', 'מתמטיקה'], [2, '08:45', 'אנגלית'], [3, '09:45', 'ספרות'], [4, '10:30', 'היסטוריה']].map(r => '<div class="tt-row" id="ti-' + r[0] + '"><span class="tt-n">' + r[0] + '</span><span class="tt-t">' + r[1] + '</span><div class="tt-main"><span class="tt-s"><b>' + own(r[2]) + '</b></span></div></div>').join('') + '</div></section>',
    play: async x => {
      await x.wait(1400); x.$('#ti-clock').textContent = '19:59'; await x.wait(900); x.$('#ti-clock').textContent = '20:00';
      await x.swap('#ti-state', () => { x.$('#ti-state').innerHTML = '<div class="tt-state ok">' + ic('check', 'xs') + '<span><b>Updated by the school</b> · today 20:00 · <b>2 changes</b></span></div>'; x.$('#ti-list').classList.remove('planned'); });
      await x.wait(600);
      const r1 = x.$('#ti-1'); r1.classList.add('cancelled');
      r1.querySelector('.tt-main').innerHTML = '<span class="tt-s"><b class="gone">' + own('מתמטיקה') + '</b></span><small class="was">For your group: ' + own('צפריר דלית') + ' isn’t listed</small>';
      r1.insertAdjacentHTML('beforeend', '<span class="tt-chip cx">Cancelled</span>');
      r1.animate([{ transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
      await x.wait(800);
      const r3 = x.$('#ti-3');
      r3.querySelector('.tt-main').innerHTML = '<span class="tt-s"><b>' + own('תנ״ך') + '</b></span><small class="was">Was ' + own('ספרות') + '</small>';
      r3.insertAdjacentHTML('beforeend', '<span class="tt-chip ch">Changed</span>');
      r3.animate([{ transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 300 });
      await x.wait(2600);
    } },

  { key: 'hw', area: 'school', chip: 'Homework & tests', eb: 'School', h: 'Typed the way you say it',
    p: '“math test thu” becomes a math test on Thursday. Tests stand out, and the ones on your class calendar show up by themselves.',
    dur: 10000, height: 430, minH: 0,
    build: () => '<section class="card upnext"><div class="upnext-head"><h2 class="card-title">Up next</h2></div>' +
      '<form class="add-row school"><input id="hw-in" placeholder="e.g. math hw thu" readonly><button type="button" class="go-btn" id="hw-go">Add</button></form>' +
      '<div class="preview" id="hw-pre"></div>' +
      '<ul class="hw-list" id="hw-l">' + '<li class="hw"><span class="check">' + CHECK + '</span><span class="body"><span class="nm">' + own(L('Homework p.112', 'שיעורי בית עמ׳ 112')) + '</span><span class="sub"><span class="ty ty-homework">Homework</span>Math</span></span><span class="due soon">Tomorrow</span></li>' +
      '<li class="hw"><span class="check">' + CHECK + '</span><span class="body"><span class="nm">' + own(L('Essay draft', 'טיוטה לחיבור')) + '</span><span class="sub"><span class="ty ty-assignment">Essay</span>English</span></span><span class="due">' + esc(D.DOW[D.dayAt(5).getDay()]) + ' · 5d</span></li></ul></section>',
    play: async x => {
      const off = nextDow(4), due = off === 1 ? 'Tomorrow' : D.DOW[D.dayAt(off).getDay()] + ' · ' + off + 'd';
      await x.tap('#hw-in');
      await x.type('#hw-in', L('math test thu', 'מבחן מתמטיקה חמישי'));
      x.$('#hw-pre').innerHTML = '<span>Will add</span><span class="pc"><span class="ty ty-test">' + ic('info', 'xs') + 'Test</span>Math · ' + esc(due) + '</span>';
      await x.wait(1300);
      await x.tap('#hw-go');
      x.$('#hw-in').value = ''; x.$('#hw-pre').innerHTML = '';
      x.$('#hw-l').insertAdjacentHTML('afterbegin', '<li class="hw test-row enter"><span class="check t-ic">' + ic('clock', 'sm') + '</span><span class="body"><span class="nm">' + own(L('Math test', 'מבחן במתמטיקה')) + '</span><span class="sub"><span class="ty ty-test">' + ic('info', 'xs') + 'Test</span>Math</span></span><span class="due soon">' + esc(due) + '</span></li>');
      x.toast('Added · ' + L('Math test', 'מבחן במתמטיקה') + ' · ' + due);
      x.lift();
      await x.wait(2400);
    } },

  { key: 'gym', area: 'gym', chip: 'Gym', eb: 'Gym', h: 'One tap per set',
    p: 'Each set is filled in from last time. Tap it to log it, and a rest timer starts. Reach the top of your reps and it tells you to add weight.',
    dur: 11000, height: 320, minH: 300,
    build: () => '<article class="card ex" id="gy-card"><div class="ex-head"><div><h3 class="ex-name">' + own(L('Bench press', 'לחיצת חזה')) + '</h3><p class="ex-last">Last 80 × 8 · 8 · 7 · ' + esc(D.dShort(D.dayAt(-7))) + ' <span class="rx rx-beat">Go for 8 reps</span></p></div></div>' +
      '<div class="pills" style="grid-template-columns:repeat(3,minmax(0,1fr))">' + [1, 2, 3].map(i => '<span class="pill" id="gy-' + i + '"><span class="pv">80×8</span><span class="ps">Set ' + i + '</span></span>').join('') + '</div></article>' +
      '<div id="gy-rest"></div>',
    play: async x => {
      for (let i = 1; i <= 3; i++) {
        await x.tap('#gy-' + i);
        const p = x.$('#gy-' + i); p.classList.add('done', 'pop'); p.querySelector('.ps').innerHTML = ic('check', 'xs') + 'Set ' + i;
        if (i < 3) {
          x.$('#gy-rest').innerHTML = '<div class="tour-rest"><div class="rest" style="position:relative"><span class="lbl">Rest</span><span class="t" id="gy-t">1:30</span><span class="plus">+30 s</span><span class="bar" id="gy-bar" style="width:100%"></span></div></div>';
          for (let s = 90; s >= 87; s--) { const t = x.$('#gy-t'); if (t) t.textContent = Math.floor(s / 60) + ':' + D.pad(s % 60); const b = x.$('#gy-bar'); if (b) b.style.width = (s / 90 * 100) + '%'; await x.wait(450); }
        }
      }
      x.$('#gy-rest').innerHTML = ''; x.lift();
      await x.wait(700);
      await x.swap('#gy-card', () => {
        x.$('#gy-card').outerHTML = '<div class="ex-result" id="gy-card" style="animation:taskIn .35s both"><span class="tick">' + ic('check', 'sm') + '</span><span class="body"><span class="nm">' + own(L('Bench press', 'לחיצת חזה')) + '</span><span class="sets">80×8·8·8</span></span><span class="up">' + ic('up', 'xs') + '+1 reps vs last</span></div>';
      });
      await x.wait(2400);
    } },

  { key: 'food', area: 'food', chip: 'Food & water', eb: 'Food & water', h: 'Just say what you ate',
    p: 'Describe a meal in your own words and it works out the calories and protein. Tap the water drop for each bottle you drink.',
    dur: 11000, height: 460, minH: 0,
    build: () => (WK = 'fdw' + (++SEQ), '') + '<div style="display:flex;justify-content:space-between;align-items:center"><h1 style="font-size:32px">Food</h1><span class="water" id="fd-w">' + D.ring(WK, 0.25, 32, 4.5) + D.numEl(WK, 0.5, 1) + '<span class="unit">L</span></span></div>' +
      '<section class="card ai"><form class="ai"><label>What did you eat?</label><div class="add-row food"><input id="fd-in" placeholder="e.g. 2 eggs and toast" readonly><button type="button" class="food-go" id="fd-go">Add</button></div></form><div id="fd-out"></div></section>',
    play: async x => {
      D.animate(x.$('#fd-w'));
      await x.tap('#fd-in');
      await x.type('#fd-in', L('2 eggs and toast', '2 ביצים וטוסט'));
      await x.tap('#fd-go');
      const out = x.$('#fd-out');
      out.innerHTML = '<div class="thinking"><span>Working it out…</span><span class="tb"><span></span></span></div>';
      await x.wait(1300);
      const items = [[L('2 eggs', '2 ביצים'), L('2 large', '2 גדולות'), 156, 12], [L('Toast', 'טוסט'), L('1 slice', 'פרוסה אחת'), 80, 3]];
      out.innerHTML = '<div class="parsed">' + items.map(it => '<div class="it"><span>' + own(it[0]) + '<small>' + own(it[1]) + ' · ' + it[3] + ' g protein</small></span><span class="k">' + it[2] + ' kcal</span></div>').join('') +
        '<div class="tot"><span>Goes in Breakfast</span><span>236 kcal · 15 g protein</span></div><div class="sheet-actions"><span class="btn food" id="fd-all" style="flex:1">Add all 2</span></div></div>';
      await x.wait(1400);
      await x.tap('#fd-all');
      out.innerHTML = ''; x.$('#fd-in').value = '';
      x.toast('Added 2 to Breakfast');
      await x.wait(1300);
      await x.tap('#fd-w');
      const w = x.$('#fd-w'); w.innerHTML = D.ring(WK, 0.5, 32, 4.5) + D.numEl(WK, 1, 1) + '<span class="unit">L</span>'; D.animate(w);
      x.toast('Added a bottle · 1.0 L today');
      x.lift();
      await x.wait(2200);
    } },

  { key: 'friends', area: 'school', chip: 'Friends', eb: 'Friends', h: 'See who’s on your train',
    p: 'Share your trip with the friends you choose. See where they are on the way, and get a notification when they leave or arrive.',
    tips: [['Location stays off unless you turn it on, and only the friends you pick can see it', '#2EE59D']],
    dur: 10000, height: 320, minH: 0,
    build: () => '<section class="card"><h2 class="card-title" style="margin-bottom:6px">Friends</h2><div class="fr-list">' +
      [[L('Noa', 'נועה'), 'nb', 'home', 'Leaves home 07:10', 'in 6 min'], [L('Dan', 'דן'), 'db', 'bus', 'On bus 72', 'at school 07:53'], [L('Maya', 'מאיה'), 'mb', 'school', 'At school', 'since 07:40']].map(f =>
        '<div class="fr-row">' + avatar(f[0], 44) + '<span class="fr-main"><b>' + own(f[0]) + '</b><span class="fr-st" id="fr-' + f[1] + '">' + ic(f[2], 'xs') + '<span>' + f[3] + ' · ' + f[4] + '</span></span></span></div>').join('') + '</div></section>' +
      '<div class="tour-notif" id="fr-n"><img src="/apple-touch-icon.png?v=3" alt=""><div style="flex:1;min-width:0"><b>' + own(L('Noa', 'נועה')) + '<small>now</small></b><span>On the 07:19 train · same train as you</span></div></div>',
    play: async x => {
      await x.wait(1500);
      const nb = x.$('#fr-nb'); nb.innerHTML = ic('bus', 'xs') + '<span>On bus 74 · at school 07:53</span>'; nb.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      await x.wait(1300);
      nb.innerHTML = ic('train', 'xs') + '<span>At Rosh HaAyin North station · at school 07:53</span>';
      const row = nb.closest('.fr-row'); row.insertAdjacentHTML('beforeend', '<span class="fr-same">Same train</span>');
      await x.wait(900);
      x.$('#fr-n').classList.add('on');
      await x.wait(2800);
      x.$('#fr-n').classList.remove('on');
      await x.wait(900);
    } },

  { key: 'safe', area: 'todo', chip: 'Your account', eb: 'Your account', h: 'Safe, even offline',
    p: 'Your recovery code lets you set a new password, no email needed. No signal? Keep going: everything is saved on your phone and syncs once you’re back.',
    tips: [['Language: Settings → English / עברית', 'todo']],
    dur: 9000, height: 380, minH: 0,
    build: () => '<section class="card"><h2 class="card-title">Recovery code</h2><p class="sheet-note" style="margin:6px 0 10px">If you ever forget your password, this code lets you set a new one.</p><output class="code-box" id="sf-code" translate="no">&nbsp;</output></section>' +
      '<div class="tour-cloud" id="sf-c"><span class="ci">' + ic('cloud') + '</span><span id="sf-t">No connection<small>Your changes are saved on this phone</small></span></div>' +
      '<div class="seg" translate="no" style="align-self:flex-start"><button id="sf-en" aria-checked="' + !HE + '">English</button><button id="sf-he" aria-checked="' + HE + '">עברית</button></div>',
    play: async x => {
      const code = 'K7QF-3MXP-9RTA-W2HD', el = x.$('#sf-code');
      for (let i = 1; i <= code.length; i++) { el.textContent = code.slice(0, i); await x.wait(55); }
      await x.wait(1500);
      const c = x.$('#sf-c'); c.classList.add('ok'); c.querySelector('.ci').innerHTML = ic('check');
      x.$('#sf-t').innerHTML = 'Synced<small>Back online: everything is up to date</small>';
      await x.wait(1400);
      await x.tap(HE ? '#sf-en' : '#sf-he');
      x.$('#sf-en').setAttribute('aria-checked', String(HE)); x.$('#sf-he').setAttribute('aria-checked', String(!HE));
      await x.wait(900);
      x.$('#sf-en').setAttribute('aria-checked', String(!HE)); x.$('#sf-he').setAttribute('aria-checked', String(HE));
      x.lift();
      await x.wait(1600);
    } },

  { key: 'done', area: 'todo', chip: '', eb: 'That’s it', h: 'You’re all set',
    p: 'You can watch this again any time in Settings.',
    dur: 2500, height: 330, minH: 330,
    build: () => '<div class="tour-done"><svg class="big" viewBox="0 0 150 150" aria-hidden="true"><circle class="r" cx="75" cy="75" r="68"/><path class="c" d="M46 77l20 20 38-42"/></svg>' +
      Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2, d = 90 + (i % 3) * 22, col = ['var(--todo)', 'var(--gym)', 'var(--school)', 'var(--food)', 'var(--water)'][i % 5]; return '<i style="background:' + col + ';--x:' + Math.round(Math.cos(a) * d) + 'px;--y:' + Math.round(Math.sin(a) * d) + 'px"></i>'; }).join('') + '</div>',
    play: async x => { await x.wait(2600); } }
];
const N = CH.length;

/* ---------- the player ---------- */
let root = null, cur = 0, runId = 0, lastFocus = null, finger = null, fit = null, frame = null, screen = null;
const areaColor = a => (getComputedStyle(document.documentElement).getPropertyValue('--' + (a === 'amber' ? 'amber' : a)).trim() || '#6A43E8');
function ctx(id) {
  const alive = () => id === runId && root;
  const x = {
    get screen() { return screen; },
    $: s => screen.querySelector(s),
    wait: ms => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(STOP)), reduced() ? 0 : ms)),
    // the finger glides to an element, presses (or holds), and lets go
    async tap(sel, o) {
      const el = typeof sel === 'string' ? x.$(sel) : sel; if (!el) return;
      if (reduced()) return;
      const fr = fit.getBoundingClientRect(), r = el.getBoundingClientRect();
      const px = r.left - fr.left + Math.min(r.width / 2, 120), py = r.top - fr.top + r.height / 2;
      finger.classList.add('on'); finger.style.transform = 'translate(' + px + 'px,' + py + 'px)';
      await x.wait(650);
      finger.classList.add('press');
      if (o && o.hold) { finger.classList.add('hold'); await x.wait(650); finger.classList.remove('hold'); }
      const rip = document.createElement('span'); rip.className = 'tour-ripple'; rip.style.left = px + 'px'; rip.style.top = py + 'px'; fit.appendChild(rip); setTimeout(() => rip.remove(), 600);
      try { if (navigator.vibrate && o && o.hold) navigator.vibrate(6); } catch (e) {}
      await x.wait(140);
      finger.classList.remove('press');
      await x.wait(120);
    },
    lift() { finger.classList.remove('on', 'press', 'hold'); },
    async type(sel, text) {
      const el = x.$(sel); el.value = '';
      for (const ch of Array.from(text)) { el.value += ch; await x.wait(55 + Math.random() * 60); }
    },
    toast(text) {
      const old = screen.querySelector('.tour-toast'); if (old) old.remove();
      screen.insertAdjacentHTML('beforeend', '<div class="toast tour-toast"><p>' + esc(text) + '</p><button>Undo</button></div>');
      const t = screen.querySelector('.tour-toast'); setTimeout(() => { if (t.isConnected) t.remove(); }, 2400);
    },
    // fade a part out, change it, fade it back in
    async swap(sel, change) {
      const el = x.$(sel); if (el && !reduced()) { el.classList.add('tour-swap', 'fade'); await x.wait(300); }
      change();
      const el2 = x.$(sel); if (el2) { el2.classList.add('tour-swap', 'fade'); void el2.offsetWidth; el2.classList.remove('fade'); }
    }
  };
  return x;
}
async function run(i) {
  const id = ++runId, ch = CH[i], x = ctx(id);
  for (;;) {
    screen.innerHTML = ch.build();
    screen.classList.remove('fade');
    try { await ch.play(x); } catch (e) { if (e !== STOP) console.warn('[tour]', e); return; }
    if (reduced() || id !== runId) return;
    x.lift();
    try { await x.wait(1800); screen.classList.add('fade'); await x.wait(380); } catch (e) { return; }
  }
}
// The demo is the real 388px-wide app, scaled to fit: by the most it grows to (so the
// scale never changes mid-demo), wrapped tightly around what it shows right now.
let scale = 1, ro = null;
function size() {
  if (!root) return;
  const st = root.querySelector('.tour-stage'), ch = CH[cur], w = 388;
  scale = Math.min(1, st.clientWidth / w, st.clientHeight / ch.height);
  frame.style.minHeight = (ch.minH || 0) + 'px'; frame.style.transform = 'scale(' + scale + ')';
  frame.classList.toggle('bare', ch.key === 'done');
  wrap();
}
function wrap() { if (!root) return; fit.style.width = Math.round(388 * scale) + 'px'; fit.style.height = Math.round(frame.offsetHeight * scale) + 'px'; }
function bars() {
  return CH.map((c, i) => '<span class="' + (i < cur ? 'done' : i === cur ? 'now' : '') + '"><i></i></span>').join('');
}
function show(i, dirn) {
  cur = Math.max(0, Math.min(N - 1, i));
  const ch = CH[cur];
  root.style.setProperty('--ta', areaColor(ch.area));
  const b = root.querySelector('.tour-bars'); b.innerHTML = bars(); b.style.setProperty('--dur', ch.dur + 'ms');
  const copy = root.querySelector('.tour-copy');
  const n = cur > 0 && cur < N - 1 ? '<p class="tour-eb">' + cur + ' of ' + (N - 2) + ' · ' + ch.eb + '</p>' : '<p class="tour-eb">' + ch.eb + '</p>';
  copy.innerHTML = n + '<h2 class="tour-h" id="tour-h">' + ch.h + '</h2><p class="tour-p">' + ch.p + '</p>' +
    (ch.tips ? '<ul class="tour-tips">' + ch.tips.map(t => '<li style="--c:' + (t[1].charAt(0) === '#' ? t[1] : 'var(--' + t[1] + ')') + '">' + t[0] + '</li>').join('') + '</ul>' : '') +
    (cur === 0 ? '<div class="tour-chips">' + CH.slice(1, N - 1).map((c, k) => '<button class="tour-chip" data-tour-go="' + (k + 1) + '">' + c.chip + '</button>').join('') + '</div>' : '');
  root.querySelector('.tour-back').disabled = cur === 0;
  root.querySelector('.tour-next').innerHTML = cur === 0 ? 'Watch it all' : cur === N - 1 ? 'Start' : 'Next' + ic('chev-r', 'sm');
  [copy, fit].forEach(el => { el.classList.remove('in-next', 'in-prev'); if (dirn) { void el.offsetWidth; el.classList.add(dirn > 0 ? 'in-next' : 'in-prev'); } });
  finger.classList.remove('on', 'press', 'hold');
  size();
  run(cur);
}
function open(start) {
  if (root) return;
  if (!document.getElementById('tour-css')) { const st = document.createElement('style'); st.id = 'tour-css'; st.textContent = CSS; document.head.appendChild(st); }
  if (D.sheetKind()) D.closeSheet();
  lastFocus = document.activeElement;
  root = document.createElement('div');
  root.className = 'tour'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'tour-h');
  root.innerHTML = '<div class="tour-top"><div class="tour-bars" aria-hidden="true"></div><button class="tour-x" type="button" data-tour="x" aria-label="Close tour">' + ic('x', 'sm') + '</button></div>' +
    '<div class="tour-body"><div class="tour-stage" aria-hidden="true"><div class="tour-fit"><div class="tour-frame"><div class="tour-screen"></div></div><span class="tour-finger"></span></div></div><div class="tour-copy" aria-live="polite"></div></div>' +
    '<div class="tour-nav"><button class="tour-back" type="button" data-tour="back">Back</button><button class="tour-next" type="button" data-tour="next"></button></div>';
  document.body.appendChild(root);
  fit = root.querySelector('.tour-fit'); frame = root.querySelector('.tour-frame'); screen = root.querySelector('.tour-screen'); finger = root.querySelector('.tour-finger');
  document.documentElement.style.overflow = 'hidden';
  if (window.ResizeObserver) { ro = new ResizeObserver(wrap); ro.observe(frame); }
  root.addEventListener('click', onClick);
  wireSwipe(root.querySelector('.tour-body'));
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', size);
  show(start || 0, 0);
  setTimeout(() => { const n = root && root.querySelector('.tour-next'); if (n) n.focus({ preventScroll: true }); }, 60);
}
function close() {
  if (!root) return;
  runId++;
  if (ro) { ro.disconnect(); ro = null; }
  const r = root; root = null;
  r.classList.add('out');
  setTimeout(() => r.remove(), reduced() ? 0 : 280);
  document.documentElement.style.overflow = '';
  document.removeEventListener('keydown', onKey);
  window.removeEventListener('resize', size);
  if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
const next = () => (cur >= N - 1 ? close() : show(cur + 1, 1));
const prev = () => { if (cur > 0) show(cur - 1, -1); };
function onClick(e) {
  const b = e.target.closest('[data-tour], [data-tour-go]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.dataset.tourGo) return show(+b.dataset.tourGo, 1);
  ({ x: close, next, back: prev })[b.dataset.tour]();
}
function onKey(e) {
  if (!root) return;
  const rtl = document.documentElement.dir === 'rtl';
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); rtl ? prev() : next(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); rtl ? next() : prev(); }
}
function wireSwipe(el) {
  let sx = null, sy = 0;
  el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
  el.addEventListener('pointerup', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const fwd = document.documentElement.dir === 'rtl' ? dx > 0 : dx < 0;
    fwd ? next() : prev();
  });
}

window.TOUR = { open, close, chapters: () => CH.map(c => c.key) };
})();
