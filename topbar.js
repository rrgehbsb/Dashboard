// Persistent 4-row dashboard topbar.
// Drop on any page: <script src="topbar.js" defer></script>
(function () {
  'use strict';

  const TOPBAR_SUPABASE_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
  const TOPBAR_SUPABASE_KEY = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';

  // ─── CSS ─────────────────────────────────────────────────────────────────────
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
  padding-top: max(0px, env(safe-area-inset-top));
  -webkit-tap-highlight-color: transparent;
}

/* ── Row 1: Stats ticker ── */
.tb-stats {
  display: flex; align-items: center;
  padding: 7px 14px 0;
  overflow-x: auto; white-space: nowrap; scrollbar-width: none;
  gap: 0;
}
.tb-stats::-webkit-scrollbar { display: none; }
.tb-stat {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.10em;
  padding-right: 16px;
}
.tb-stat-key { color: rgba(255,255,255,0.40); text-transform: uppercase; }
.tb-stat-val { color: #FAFAFA; font-variant-numeric: tabular-nums; }
.tb-stat.good .tb-stat-val { color: #6ee7b7; }
.tb-stat.warn .tb-stat-val { color: #fbbf24; }
.tb-stat.miss .tb-stat-val { color: #ff8a8a; }
.tb-ticker-alert {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em;
  padding: 2px 7px; border-radius: 4px; margin-left: 2px;
  white-space: nowrap;
}
.tb-ticker-alert.warn { background: rgba(251,191,36,0.14); color: #fbbf24; }
.tb-ticker-alert.miss { background: rgba(239,68,68,0.14); color: #ff8a8a; }
.tb-ticker-alert-dot { font-size: 9px; }

/* ── Row 2: Goals cycling ticker ── */
.tb-goals-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px 0; min-height: 26px;
}
.tb-row-label {
  font-size: 10px; font-weight: 800; letter-spacing: 0.18em;
  color: rgba(255,255,255,0.35); flex-shrink: 0; text-transform: uppercase;
}
.tb-dot {
  width: 7px; height: 7px; border-radius: 50%;
  flex-shrink: 0; background: rgba(255,255,255,0.20);
  transition: background 0.3s, box-shadow 0.3s;
}
.tb-dot.good { background: #6ee7b7; }
.tb-dot.warn { background: #fbbf24; }
.tb-dot.miss { background: #ff8a8a; animation: tb-dot-pulse 1.5s ease-in-out infinite; }
@keyframes tb-dot-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
  50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
}
.tb-goals-stage {
  flex: 1; min-width: 0; overflow: hidden; position: relative; height: 20px;
}
.tb-goals-item {
  position: absolute; inset: 0; display: flex; align-items: center;
  font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.80);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tb-goals-item.tb-leave { animation: tb-up-out 0.38s ease forwards; }
.tb-goals-item.tb-enter { animation: tb-up-in 0.38s cubic-bezier(0.22,1,0.36,1) forwards; }
@keyframes tb-up-out { to { opacity:0; transform:translateY(-100%); } }
@keyframes tb-up-in  { from { opacity:0; transform:translateY(100%); } }
.tb-goals-count {
  font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.40); flex-shrink: 0;
}

/* ── Row 3: Streak row ── */
.tb-streak-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 14px 7px;
}
.tb-streak-dot {
  width: 7px; height: 7px; border-radius: 50%;
  flex-shrink: 0; transition: background 0.3s, box-shadow 0.3s;
}
.tb-streak-dot.active {
  background: #fbbf24;
  box-shadow: 0 0 7px rgba(251,191,36,0.55);
}
.tb-streak-dot.zero { background: rgba(255,255,255,0.16); }
.tb-streak-text {
  flex: 1; font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.70);
}
.tb-collapse-btn {
  width: 28px; height: 28px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 7px;
  color: rgba(255,255,255,0.50);
  font-size: 16px; line-height: 1; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: background 0.15s, color 0.15s;
}
.tb-collapse-btn:hover { background: rgba(255,255,255,0.10); color: #FAFAFA; }

/* ── Collapsible upper section (rows 1–3) ── */
.tb-upper {
  overflow: hidden;
  max-height: 120px; opacity: 1;
  transition: max-height 0.32s cubic-bezier(0.22,1,0.36,1), opacity 0.22s;
}
.tb-upper.is-collapsed { max-height: 0; opacity: 0; }

/* ── Row 4: Icon pills ── */
.tb-icons-row {
  display: flex; gap: 6px;
  padding: 7px 14px calc(7px + max(0px, env(safe-area-inset-bottom)));
  overflow-x: auto; scrollbar-width: none; white-space: nowrap;
}
.tb-icons-row::-webkit-scrollbar { display: none; }
.tb-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: #FAFAFA; font-family: inherit; font-size: 14px;
  cursor: pointer; text-decoration: none;
  transition: background 0.12s, transform 0.10s;
  -webkit-tap-highlight-color: transparent;
}
.tb-pill:hover { background: rgba(255,255,255,0.09); }
.tb-pill:active { transform: scale(0.94); }
.tb-pill-num {
  font-family: ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,0.85);
}
.tb-pill.water {
  background: rgba(125,211,252,0.08);
  border-color: rgba(125,211,252,0.18);
}
.tb-pill.water:hover { background: rgba(125,211,252,0.14); }
.tb-pill.water.flash { background: rgba(125,211,252,0.35); }
.tb-pill.stack-pill {
  background: rgba(110,231,183,0.07);
  border-color: rgba(110,231,183,0.15);
}
.tb-pill.done-all {
  background: rgba(110,231,183,0.10);
  border-color: rgba(110,231,183,0.22);
}
.tb-pill-icon { font-size: 15px; line-height: 1; }

/* ── Global mobile polish ── */
html, body { -webkit-text-size-adjust: 100%; }
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .w-modal-bg, .w-modal,
.wt-overlay, .wt-viewer { overscroll-behavior: contain; }
body.topbar-modal-open { overflow: hidden; touch-action: none; }
@media (max-width: 480px) {
  .tb-stats { padding-left: 10px; padding-right: 10px; }
  .tb-goals-row, .tb-streak-row { padding-left: 10px; padding-right: 10px; }
  .tb-icons-row { padding-left: 10px; padding-right: 10px; gap: 5px; }
  .tb-pill { padding: 6px 10px; font-size: 13px; }
  .tb-row-label { font-size: 9px; }
  .modal-bg, .po-modal-bg {
    padding: 0 !important; align-items: stretch !important; justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important; max-width: 100% !important;
    max-height: 100vh !important; height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    overflow-y: auto !important; overscroll-behavior: contain;
  }
}
`;

  // ─── HTML ─────────────────────────────────────────────────────────────────────
  const html = `
<header class="topbar" id="topbar" role="banner" aria-label="Dashboard stats">

  <div class="tb-upper" id="tbUpper">
    <!-- Row 1: stats ticker -->
    <div class="tb-stats" id="tbStatsRow">
      <span class="tb-stat" id="tbStatWater">
        <span class="tb-stat-key">WATER</span>
        <span class="tb-stat-val" id="tbWaterVal">-/-</span>
      </span>
      <span class="tb-stat" id="tbStatGoals">
        <span class="tb-stat-key">GOALS</span>
        <span class="tb-stat-val" id="tbGoalsVal">-/-</span>
      </span>
      <span class="tb-stat" id="tbStatStack">
        <span class="tb-stat-key">STACK</span>
        <span class="tb-stat-val" id="tbStackVal">-/-</span>
      </span>
      <span class="tb-stat" id="tbStatStreak">
        <span class="tb-stat-key">STREAK</span>
        <span class="tb-stat-val" id="tbStreakVal">0d</span>
      </span>
      <span class="tb-ticker-alert" id="tbAlert" style="display:none"></span>
    </div>

    <!-- Row 2: goals cycling ticker -->
    <div class="tb-goals-row">
      <span class="tb-row-label">GOALS</span>
      <span class="tb-dot" id="tbGoalsDot"></span>
      <div class="tb-goals-stage" id="tbGoalsStage">
        <div class="tb-goals-item" id="tbGoalsItem">No goals for today</div>
      </div>
      <span class="tb-goals-count" id="tbGoalsCount">0/0</span>
    </div>

    <!-- Row 3: streak + collapse -->
    <div class="tb-streak-row">
      <span class="tb-row-label">STREAK</span>
      <span class="tb-streak-dot zero" id="tbStreakDot"></span>
      <span class="tb-streak-text" id="tbStreakText">&#x26A1; 0 day streak &mdash; keep going</span>
      <button class="tb-collapse-btn" id="tbCollapseBtn" aria-label="Collapse topbar">&minus;</button>
    </div>
  </div>

  <!-- Row 4: icon pills (always visible) -->
  <div class="tb-icons-row">
    <button class="tb-pill water" id="tbWaterPill" type="button" aria-label="Log water">
      <span class="tb-pill-icon">&#x1F4A7;</span>
      <span class="tb-pill-num" id="tbWaterNum">0</span>
    </button>
    <a href="health.html" class="tb-pill stack-pill" id="tbStackPill" aria-label="Supplements">
      <span class="tb-pill-icon">&#x1F48A;</span>
      <span class="tb-pill-num" id="tbStackNum">-</span>
    </a>
    <a href="index.html" class="tb-pill" id="tbGoalsPill" aria-label="Goals">
      <span class="tb-pill-icon">&#x2705;</span>
      <span class="tb-pill-num" id="tbGoalsNum">-</span>
    </a>
    <a href="gym.html" class="tb-pill" aria-label="Gym">
      <span class="tb-pill-icon">&#x1F3CB;&#xFE0F;</span>
    </a>
    <a href="health.html" class="tb-pill" aria-label="Health">
      <span class="tb-pill-icon">&#x2764;&#xFE0F;</span>
    </a>
    <a href="index.html" class="tb-pill" aria-label="Main">
      <span class="tb-pill-icon">&#x1F4CB;</span>
    </a>
  </div>

</header>
`;

  // ─── Inject ───────────────────────────────────────────────────────────────────
  function inject() {
    if (document.getElementById('topbar')) return;
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    document.body.insertBefore(wrap.firstChild, document.body.firstChild);
  }

  // ─── Date helpers ─────────────────────────────────────────────────────────────
  function activeDateKey() {
    const n = new Date(), d = new Date(n);
    if (n.getHours() < 6) d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function calendarDateKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  // ─── Data reads ───────────────────────────────────────────────────────────────
  function getGoals() {
    let g = [];
    try { g = JSON.parse(localStorage.getItem('goals:' + activeDateKey())) || []; } catch(e) {}
    const total = g.length, done = g.filter(x => x && x.done).length;
    return { done, total, items: g };
  }
  function getStack() {
    let items = [], taken = {};
    try { items = JSON.parse(localStorage.getItem('stack:items')) || []; } catch(e) {}
    try { taken = JSON.parse(localStorage.getItem('stack:taken:' + activeDateKey())) || {}; } catch(e) {}
    const total = items.length, done = items.filter(i => i && taken[i.id]).length;
    return { done, total };
  }
  function getWater() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('po_water_v1')); } catch(e) {}
    if (!s) return { done: 0, total: 9 };
    const done = (s.logs || {})[calendarDateKey()] || 0;
    const p = s.profile || { weightKg: 75 };
    const wKg = s.weightUnit === 'lb' ? (p.weightKg||0)/2.20462 : (p.weightKg||0);
    const base = wKg * 35;
    const ex = (p.activityHrsPerWeek||0)/7*500;
    const caff = Math.max(0, (s.caffeineMgPerDay||0)-200)*1.5;
    const subs = (s.substances||[]).reduce((a,x)=>a+Math.max(0,((x&&x.dose!=null?x.dose:(x&&x.defaultDose))||0)*((x&&x.mlPerUnit)||0)),0);
    let adj = 0; if (p.sex==='m') adj+=200; if ((p.age||0)>=50) adj+=100;
    const totalMl = base+ex+caff+subs+adj;
    const unitVol = s.unit==='glass'?(s.glassMl||250):s.unit==='oz'?30:s.unit==='ml'?1:(s.bottleMl||500);
    return { done, total: Math.max(1, Math.ceil(totalMl/unitVol)) };
  }
  function getStreak() {
    let s = { count: 0 };
    try { s = JSON.parse(localStorage.getItem('goal_streak_v1')) || { count: 0 }; } catch(e) {}
    return s.count || 0;
  }

  function classify(done, total) {
    if (!total) return 'idle';
    if (done >= total) return 'good';
    if (new Date().getHours() >= 18 && done < total * 0.5) return 'miss';
    return 'warn';
  }

  // ─── Goals ticker state ───────────────────────────────────────────────────────
  let tickerItems = [], tickerIdx = 0, tickerTimer = null;

  function buildTickerItems(goals) {
    const undone = goals.items.filter(g => g && !g.done);
    if (!goals.total) return [{ text: 'No goals for today — add one to get rolling' }];
    if (!undone.length) return [{ text: '✓ All goals done — solid day' }];
    return undone.map(g => ({ text: g.text }));
  }

  function swapGoalsText(newText) {
    const stage = document.getElementById('tbGoalsStage');
    if (!stage) return;
    const current = stage.querySelector('.tb-goals-item');
    if (!current || current.textContent === newText) return;
    const next = document.createElement('div');
    next.className = 'tb-goals-item tb-enter';
    next.textContent = newText;
    current.classList.add('tb-leave');
    stage.appendChild(next);
    setTimeout(() => { try { stage.removeChild(current); next.classList.remove('tb-enter'); } catch(e){} }, 400);
  }

  function tickGoals() {
    if (!tickerItems.length) return;
    tickerIdx = (tickerIdx + 1) % tickerItems.length;
    swapGoalsText(tickerItems[tickerIdx].text);
  }

  function startTicker(goals) {
    tickerItems = buildTickerItems(goals);
    tickerIdx = 0;
    const el = document.getElementById('tbGoalsItem');
    if (el) el.textContent = tickerItems[0]?.text || '';
    clearInterval(tickerTimer);
    if (tickerItems.length > 1) tickerTimer = setInterval(tickGoals, 5000);
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  function render() {
    const goals = getGoals(), stack = getStack(), water = getWater(), streak = getStreak();

    // Row 1: stats
    const gs = classify(goals.done, goals.total);
    const ss = classify(stack.done, stack.total);
    const ws = classify(water.done, water.total);

    function setStatClass(id, status) {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('good','warn','miss'); if (status !== 'idle') el.classList.add(status); }
    }
    function setVal(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

    setVal('tbWaterVal', water.total ? water.done+'/'+water.total : '0/0');
    setVal('tbGoalsVal', goals.total ? goals.done+'/'+goals.total : '0/0');
    setVal('tbStackVal', stack.total ? stack.done+'/'+stack.total : '0/0');
    setVal('tbStreakVal', streak + 'd');
    setStatClass('tbStatWater', ws);
    setStatClass('tbStatGoals', gs);
    setStatClass('tbStatStack', ss);
    setStatClass('tbStatStreak', streak > 0 ? 'good' : 'idle');

    // Alert
    const alertEl = document.getElementById('tbAlert');
    if (alertEl) {
      const issues = [];
      if (ws === 'miss') issues.push('Behind on water');
      if (gs === 'miss') issues.push('Goals not on track');
      if (ss === 'miss') issues.push('Missed supplements');
      if (issues.length) {
        alertEl.style.display = '';
        alertEl.className = 'tb-ticker-alert miss';
        alertEl.innerHTML = '<span class="tb-ticker-alert-dot">▲</span> ' + issues.join(' · ');
      } else if (ws === 'warn' || gs === 'warn') {
        const warn = [];
        if (ws === 'warn') warn.push('Drink more water');
        if (gs === 'warn') warn.push('Goals in progress');
        alertEl.style.display = '';
        alertEl.className = 'tb-ticker-alert warn';
        alertEl.innerHTML = warn.join(' · ');
      } else {
        alertEl.style.display = 'none';
      }
    }

    // Row 2: goals
    const dotEl = document.getElementById('tbGoalsDot');
    if (dotEl) { dotEl.className = 'tb-dot ' + (gs === 'idle' ? '' : gs); }
    setVal('tbGoalsCount', goals.total ? goals.done+'/'+goals.total : '0/0');
    startTicker(goals);

    // Row 3: streak
    const streakDot = document.getElementById('tbStreakDot');
    if (streakDot) streakDot.className = 'tb-streak-dot ' + (streak > 0 ? 'active' : 'zero');
    const streakMsg = streak === 0
      ? '⚡ 0 day streak — keep going'
      : streak === 1 ? '⚡ 1 day streak — building'
      : `⚡ ${streak} day streak — on a roll`;
    setVal('tbStreakText', streakMsg);

    // Row 4: icon pills
    setVal('tbWaterNum', water.done);
    setVal('tbStackNum', stack.total ? stack.done+'/'+stack.total : '0');
    setVal('tbGoalsNum', goals.total ? goals.done+'/'+goals.total : '0');

    const goalsPill = document.getElementById('tbGoalsPill');
    if (goalsPill) goalsPill.classList.toggle('done-all', goals.total > 0 && goals.done === goals.total);
    const stackPill = document.getElementById('tbStackPill');
    if (stackPill) stackPill.classList.toggle('done-all', stack.total > 0 && stack.done === stack.total);
  }

  // ─── Water +1 ────────────────────────────────────────────────────────────────
  function defaultWaterState() {
    return { unit:'bottle', bottleMl:500, glassMl:250, weightUnit:'kg',
      profile:{weightKg:75,age:25,sex:'m',activityHrsPerWeek:5},
      caffeineMgPerDay:200, substances:[], logs:{} };
  }

  async function pushWaterToSupabase(state) {
    if (window.location.pathname.endsWith('health.html')) return;
    if (!window.supabase) return;
    try {
      const sb = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      const { data } = await sb.from('app_state').select('data').eq('key','health').maybeSingle();
      const merged = Object.assign({}, (data&&data.data)||{}, { po_water_v1: state });
      await sb.from('app_state').upsert({ key:'health', data:merged, updated_at: new Date().toISOString() }, { onConflict:'key' });
    } catch(e) {}
  }

  function addWater() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('po_water_v1')); } catch(e) {}
    if (!s || typeof s !== 'object') s = defaultWaterState();
    s.logs = s.logs || {};
    const k = calendarDateKey();
    s.logs[k] = (s.logs[k] || 0) + 1;
    try { localStorage.setItem('po_water_v1', JSON.stringify(s)); } catch(e) {}
    render();
    const btn = document.getElementById('tbWaterPill');
    if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 260); }
    pushWaterToSupabase(s);
  }

  // ─── Collapse toggle ─────────────────────────────────────────────────────────
  const COLLAPSE_KEY = 'topbar_collapsed';
  function applyCollapse(collapsed) {
    const upper = document.getElementById('tbUpper');
    const btn = document.getElementById('tbCollapseBtn');
    if (!upper || !btn) return;
    upper.classList.toggle('is-collapsed', collapsed);
    btn.textContent = collapsed ? '+' : '−';
    btn.setAttribute('aria-label', collapsed ? 'Expand topbar' : 'Collapse topbar');
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch(e) {}
  }

  // ─── Mobile gesture lock ──────────────────────────────────────────────────────
  function lockGestures() {
    const block = e => e.preventDefault();
    document.addEventListener('gesturestart',  block, { passive: false });
    document.addEventListener('gesturechange', block, { passive: false });
    document.addEventListener('gestureend',    block, { passive: false });
    let last = 0;
    document.addEventListener('touchend', e => {
      const now = Date.now();
      if (now - last <= 300) e.preventDefault();
      last = now;
    }, { passive: false });
  }

  function startModalLock() {
    const SEL = ['.modal-bg','.po-modal-bg','.w-modal-bg','.wt-overlay','.wt-viewer','.wt-cam'];
    function anyOpen() {
      for (const s of SEL) for (const el of document.querySelectorAll(s))
        if (el.classList.contains('show') || el.classList.contains('is-open')) return true;
      return false;
    }
    const sync = () => document.body.classList.toggle('topbar-modal-open', anyOpen());
    new MutationObserver(sync).observe(document.body, { attributes:true, attributeFilter:['class'], subtree:true });
    sync();
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────────
  function boot() {
    inject();

    // Restore collapse state
    let collapsed = false;
    try { collapsed = localStorage.getItem(COLLAPSE_KEY) === '1'; } catch(e) {}
    applyCollapse(collapsed);

    // Collapse button
    const collapseBtn = document.getElementById('tbCollapseBtn');
    if (collapseBtn) collapseBtn.addEventListener('click', () => {
      const upper = document.getElementById('tbUpper');
      applyCollapse(upper && !upper.classList.contains('is-collapsed'));
    });

    // Water +1
    const waterPill = document.getElementById('tbWaterPill');
    if (waterPill) waterPill.addEventListener('click', e => { e.preventDefault(); addWater(); });

    render();
    lockGestures();
    startModalLock();

    window.addEventListener('storage', render);
    window.addEventListener('focus', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    setInterval(render, 30_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
