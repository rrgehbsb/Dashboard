/* Dashboard v3 — Food. Same data as the classic food page (row uid:food):
   { library:[{id, name, kind:'per100'|'serving', per, nutrients:{kcal, protein_g, …}, updatedAt}],
     meals:[{id, name, items:[{foodId, qty}]}],
     days:{ "YYYY-MM-DD": { entries:[{id, group, foodId, name, qty, unit, n:{kcal, protein_g, carbs_g, fat_g, …}, src, at, updatedAt, deleted?}] } },
     profile:{sex, age, heightCm, activity, goalRate, proteinPerKg, _at}, custom:{kcal?, protein_g?, …, _at} }
   Entries merge per id across devices; removing one marks it deleted so the other
   device can't bring it back. Bodyweight for targets comes from uid:health. */
(function () {
'use strict';
const D = window.DASH, $ = D.$, esc = D.esc, ic = D.ic;
const GROUPS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks'], ['supplements', 'Supplements']];
const NKEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'magnesium_mg', 'zinc_mg', 'vitd_ug', 'vitc_mg', 'vitb12_ug', 'omega3_g'];
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function mergeById(a, b) {
  const out = new Map();
  (Array.isArray(a) ? a : []).forEach(x => x && x.id && out.set(x.id, x));
  (Array.isArray(b) ? b : []).forEach(x => { if (!x || !x.id) return; const cur = out.get(x.id); if (!cur || (x.updatedAt || x.at || 0) >= (cur.updatedAt || cur.at || 0)) out.set(x.id, x); });
  return Array.from(out.values());
}
function mergeDays(a, b) {
  const out = {};
  new Set(Object.keys(a || {}).concat(Object.keys(b || {}))).forEach(dk => {
    const da = (a || {})[dk] || {}, db = (b || {})[dk] || {};
    out[dk] = { entries: mergeById(da.entries, db.entries) };
    if (da.note || db.note) out[dk].note = db.note || da.note;
  });
  return out;
}
const newer = (a, b) => (b && (b._at || 0) >= ((a && a._at) || 0)) ? b : (a || b);
const food = D.Row('food', { merge: { library: mergeById, meals: mergeById, days: mergeDays, profile: newer, custom: newer, settings: newer } });

/* ---------- demo ---------- */
if (D.DEMO) {
  const t = D.todayKey(), y = D.dk(D.dayAt(-1)), now = Date.now();
  const lib = [
    { id: 'f-oat', name: 'Oatmeal with banana', kind: 'serving', per: 1, nutrients: { kcal: 380, protein_g: 12, carbs_g: 68, fat_g: 8 } },
    { id: 'f-cof', name: 'Coffee with milk', kind: 'serving', per: 1, nutrients: { kcal: 60, protein_g: 3, carbs_g: 5, fat_g: 3 } },
    { id: 'f-chk', name: 'Chicken & rice', kind: 'serving', per: 1, nutrients: { kcal: 620, protein_g: 55, carbs_g: 60, fat_g: 22 } },
    { id: 'f-yog', name: 'Greek yogurt', kind: 'serving', per: 1, nutrients: { kcal: 180, protein_g: 18, carbs_g: 7, fat_g: 5 } },
    { id: 'f-shk', name: 'Protein shake', kind: 'serving', per: 1, nutrients: { kcal: 160, protein_g: 30, carbs_g: 5, fat_g: 2 } }
  ];
  const e = (id, g, f, q) => ({ id, group: g, foodId: f.id, name: f.name, qty: q, unit: 'serving', n: Object.assign({}, f.nutrients), src: 'lib', at: now, updatedAt: now });
  food.data = { library: lib, meals: [], profile: { sex: 'male', age: 17, heightCm: 178, activity: '1.55', goalRate: 0.25, proteinPerKg: 1.8, _at: 1 }, custom: { _at: 1 }, days: {} };
  food.data.days[t] = { entries: [e('e1', 'breakfast', lib[0], 1), e('e2', 'breakfast', lib[1], 1), e('e3', 'lunch', lib[2], 1), e('e4', 'snacks', lib[3], 1)] };
  food.data.days[y] = { entries: [e('e5', 'breakfast', lib[0], 1), e('e6', 'lunch', lib[2], 1), e('e7', 'snacks', lib[4], 1)] };
}

/* ---------- data ---------- */
const S = { day: 0, ai: null, bw: null, bwLoaded: false };
const viewDk = () => D.dk(D.dayAt(S.day));
const lib = () => (Array.isArray(food.get('library')) ? food.get('library') : []);
const days = () => (food.get('days') && typeof food.get('days') === 'object') ? food.get('days') : {};
const entries = dk => (((days()[dk] || {}).entries) || []).filter(e => e && !e.deleted);
const foodById = id => lib().find(f => f.id === id) || null;
function snap(f, qty) {
  const mult = f.kind === 'per100' ? qty / 100 : qty / (f.per || 1), n = {};
  NKEYS.forEach(k => { const v = f.nutrients && f.nutrients[k]; if (v != null && isFinite(v)) n[k] = v * mult; });
  return n;
}
function totals(dk) {
  const t = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  entries(dk).forEach(e => { const n = e.n || e.nutrients || {}; Object.keys(t).forEach(k => { t[k] += +n[k] || 0; }); });
  return t;
}
function setDayEntries(dk, list) {
  const all = Object.assign({}, days()), cur = all[dk] || {};
  all[dk] = Object.assign({}, cur, { entries: list });
  food.set('days', all);
}
function allEntries(dk) { return (((days()[dk] || {}).entries) || []).slice(); }
function addEntries(dk, group, items) {
  const list = allEntries(dk), now = Date.now(), ids = [];
  items.forEach(it => { const id = rid('e'); ids.push(id); list.push(Object.assign({ id, group, unit: 'serving', src: 'lib', at: now, updatedAt: now }, it)); });
  setDayEntries(dk, list);
  return ids;
}
function markDeleted(dk, ids, on) {
  const now = Date.now();
  setDayEntries(dk, allEntries(dk).map(e => ids.indexOf(e.id) >= 0 ? Object.assign({}, e, { deleted: on !== false, updatedAt: now }) : e));
}
function addLib(f) { const now = Date.now(), item = Object.assign({ id: rid('f'), updatedAt: now }, f); food.set('library', lib().concat([item])); return item; }
function autoGroup() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }
const groupName = g => (GROUPS.find(x => x[0] === g) || [g, D.cap(g)])[1];

/* ---------- targets (Mifflin-St Jeor + activity + goal; same as the classic page) ---------- */
async function loadBodyweight() {
  if (D.DEMO) { S.bw = 68.4; S.bwLoaded = true; return; }
  try {
    await D.fresh();
    const r = await D.sb().from('app_state').select('w:data->po_coach_weights, p:data->po_water_v1->profile').eq('key', D.uid() + ':health').maybeSingle();
    const ws = (r.data && Array.isArray(r.data.w) ? r.data.w : []).filter(e => e && e.dateKey).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    const last = ws[ws.length - 1];
    S.bw = last ? (parseFloat(last.weight ?? last.kg ?? last.weightKg) || null) : null;
    const prof = (r.data && r.data.p) || {};
    if (!S.bw && prof.weightKg) S.bw = parseFloat(prof.weightKg) || null;
  } catch (e) {}
  S.bwLoaded = true;
}
function targets() {
  const p = food.get('profile') || {}, c = food.get('custom') || {}, BW = S.bw;
  const out = { kcal: +c.kcal || null, protein_g: +c.protein_g || null, carbs_g: +c.carbs_g || null, fat_g: +c.fat_g || null };
  if (BW && p.heightCm && p.age) {
    const s = String(p.sex || 'male') === 'female' ? -161 : 5;
    const bmr = 10 * BW + 6.25 * p.heightCm - 5 * p.age + s;
    const tdee = bmr * (parseFloat(p.activity) || 1.55);
    const surplus = (parseFloat(p.goalRate) || 0) * 7700 / 7;
    if (!out.kcal) out.kcal = Math.round((tdee + surplus) / 10) * 10;
    if (!out.protein_g) out.protein_g = Math.round(BW * (parseFloat(p.proteinPerKg) || 1.8));
  }
  if (out.kcal) {
    if (!out.fat_g) out.fat_g = Math.round(out.kcal * 0.25 / 9);
    if (!out.carbs_g && out.protein_g) out.carbs_g = Math.max(0, Math.round((out.kcal - out.protein_g * 4 - out.fat_g * 9) / 4));
  }
  // Today's Food tile reads this device-local copy (it doesn't load bodyweight itself)
  if (out.kcal && !D.DEMO) D.writeJSON('dash3:food:targets', { kcal: out.kcal, protein_g: out.protein_g, at: Date.now() });
  return out;
}

/* ---------- render ---------- */
function quickList() {
  const freq = {}, cut = D.dk(D.dayAt(-14));
  Object.keys(days()).filter(dk => dk >= cut).forEach(dk => entries(dk).forEach(e => { if (e.foodId) freq[e.foodId] = (freq[e.foodId] || 0) + 1; }));
  const meals = (Array.isArray(food.get('meals')) ? food.get('meals') : []).filter(m => m && !m.deleted).slice(0, 2).map(m => ({ t: 'meal', id: m.id, name: m.name, kcal: (m.items || []).reduce((a, it) => { const f = foodById(it.foodId); return a + (f ? (snap(f, it.qty).kcal || 0) : 0); }, 0) }));
  const foods = Object.keys(freq).sort((a, b) => freq[b] - freq[a]).map(foodById).filter(Boolean).slice(0, 6).map(f => ({ t: 'food', id: f.id, name: f.name, kcal: snap(f, f.kind === 'per100' ? 100 : 1).kcal || 0 }));
  return meals.concat(foods);
}
function macroRow(k, label, v, T) {
  return '<div class="macro ' + k + '"><div class="mh"><span>' + label + '</span><span>' + Math.round(v) + (T ? ' / ' + T : '') + ' g</span></div><div class="mb"><span style="width:' + (T ? Math.min(100, v / T * 100) : 0) + '%"></span></div></div>';
}
function renderAi() {
  const a = S.ai, el = $('#ai-out');
  if (!a) { el.innerHTML = ''; return; }
  if (a.state === 'thinking') { el.innerHTML = '<div class="thinking"><span>Working it out…</span><span class="tb"><span></span></span></div>'; return; }
  if (a.state === 'error') { el.innerHTML = '<p class="sheet-note">' + esc(a.msg) + '</p>'; return; }
  const items = a.items.filter(it => !it.skip);
  const tot = items.reduce((t, i) => { t.kcal += +i.kcal || 0; t.p += +i.protein_g || 0; return t; }, { kcal: 0, p: 0 });
  el.innerHTML = '<div class="parsed">' + a.items.map((it, i) => '<div class="it' + (it.skip ? ' skip' : '') + '"><span>' + esc(it.name) + '<small>' + esc(it.qty_desc || '') + (it.qty_desc ? ' · ' : '') + Math.round(+it.protein_g || 0) + ' g protein</small></span><span class="k">' + Math.round(+it.kcal || 0) + ' kcal</span>' +
    '<button class="mini" id="ai-x-' + i + '" data-act="ai-skip" data-i="' + i + '" aria-label="' + (it.skip ? 'Keep ' : 'Leave out ') + esc(it.name) + '">' + ic(it.skip ? 'plus' : 'x', 'xs') + '</button></div>').join('') +
    '<div class="tot"><span>Goes in ' + groupName(a.group) + '</span><span>' + D.fmtN(Math.round(tot.kcal)) + ' kcal · ' + Math.round(tot.p) + ' g protein</span></div>' +
    '<p class="hint-s">An estimate. Check anything that matters.</p>' +
    '<div class="sheet-actions"><button class="btn ghost" id="ai-cancel" data-act="ai-cancel">Cancel</button><button class="btn food" id="ai-addall" data-act="ai-addall"' + (items.length ? '' : ' disabled') + '>Add ' + (items.length === 1 ? 'it' : 'all ' + items.length) + '</button></div></div>';
}
function render() {
  const dk = viewDk(), T = targets(), t = totals(dk);
  $('#food-date').textContent = S.day === 0 ? 'Today' : S.day === -1 ? 'Yesterday' : D.dShort(D.dayAt(S.day));
  $('#food-next').disabled = S.day >= 0;
  $('#water-slot-food').innerHTML = D.waterChip('food');
  renderAi();
  const q = quickList();
  $('#qchips').innerHTML = q.map(c => '<button class="qchip" id="q-' + esc(c.id) + '" data-act="qchip" data-t="' + c.t + '" data-id="' + esc(c.id) + '">' + ic(c.t === 'meal' ? 'grid' : 'plus', 'xs') + esc(c.name) + ' <small>' + Math.round(c.kcal) + '</small></button>').join('');
  $('#qchips').hidden = !q.length;
  const p = T.kcal ? t.kcal / T.kcal : 0;
  $('#food-sum').innerHTML = '<div class="fsum"><div class="fring">' + D.ring('food-main', p, 132, 12) + '<div class="c"><b>' + D.numEl('food-kcal', Math.round(t.kcal)) + '</b><span>' + (T.kcal ? 'of ' + D.fmtN(T.kcal) + ' kcal' : 'kcal') + '</span></div></div>' +
    '<div class="macros">' + macroRow('p', 'Protein', t.protein_g, T.protein_g) + macroRow('c', 'Carbs', t.carbs_g, T.carbs_g) + macroRow('f', 'Fat', t.fat_g, T.fat_g) + '</div></div>' +
    (T.kcal ? '' : '<button class="link" id="set-targets" data-act="sheet" data-sheet="targets">Set daily targets</button>');
  const list = entries(dk);
  const groups = GROUPS.map(g => g[0]).concat(Array.from(new Set(list.map(e => e.group))).filter(g => !GROUPS.some(x => x[0] === g))).filter(g => list.some(e => e.group === g));
  $('#diary').innerHTML = '<div class="diary-head"><h2 class="card-title">Diary</h2>' + (entries(D.dk(D.dayAt(S.day - 1))).length && !list.length ? '<button class="chip-btn" id="copy-yday" data-act="copy-yday">' + ic('copy', 'sm') + 'Same as yesterday</button>' : '') + '</div>' +
    (groups.length ? groups.map(g => {
      const es = list.filter(e => e.group === g), k = es.reduce((a, e) => a + (+((e.n || {}).kcal) || 0), 0);
      return '<div class="meal"><div class="meal-h"><span>' + groupName(g) + '</span><span>' + D.fmtN(Math.round(k)) + ' kcal</span></div>' +
        es.map(e => '<button class="entry" id="entry-' + esc(e.id) + '" data-act="sheet" data-sheet="entry" data-id="' + esc(e.id) + '"><span>' + esc(e.name) + (e.qty && e.qty !== 1 ? ' <small>×' + D.fmtN(e.qty, e.unit === 'g' ? 0 : 1) + (e.unit === 'g' ? ' g' : '') + '</small>' : '') + '</span><span class="k">' + D.fmtN(Math.round(+((e.n || {}).kcal) || 0)) + '</span></button>').join('') + '</div>';
    }).join('') : '<p class="empty">Nothing added for ' + (S.day === 0 ? 'today' : 'this day') + ' yet.</p>');
  D.animate($('#view-food'));
}

/* ---------- AI ---------- */
async function askAi(text) {
  S.ai = { state: 'thinking' }; renderAi();
  if (D.DEMO) {
    await new Promise(r => setTimeout(r, 600));
    S.ai = { state: 'done', group: autoGroup(), items: [{ name: '2 eggs', qty_desc: '2 large', kcal: 156, protein_g: 12, carbs_g: 1, fat_g: 10 }, { name: 'Toast', qty_desc: '1 slice', kcal: 80, protein_g: 3, carbs_g: 14, fat_g: 1 }] };
    renderAi(); return;
  }
  try {
    await D.fresh();
    const s = await D.sb().auth.getSession();
    const token = (s.data && s.data.session && s.data.session.access_token) || '';
    const r = await fetch('/api/food', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, token }) });
    const j = await r.json();
    if (!j.ok || !Array.isArray(j.items) || !j.items.length) { S.ai = { state: 'error', msg: (j && j.message) || 'Couldn’t work that out. Try describing it a bit differently.' }; }
    else S.ai = { state: 'done', group: autoGroup(), items: j.items };
  } catch (e) { S.ai = { state: 'error', msg: 'Can’t connect right now. Try again in a moment.' }; }
  renderAi();
}

/* ---------- sheets ---------- */
D.SHEETS.entry = a => {
  const e = entries(viewDk()).find(x => x.id === a.id);
  if (!e) return { title: 'Entry', body: '<p class="sheet-note">This entry was removed.</p>' };
  if (a.q == null) { a.q = +e.qty || 1; a.g = e.group; }
  const f = e.foodId ? foodById(e.foodId) : null, grams = e.unit === 'g';
  const base = f ? snap(f, a.q) : (() => { const m = a.q / (+e.qty || 1), n = {}; Object.keys(e.n || {}).forEach(k => { n[k] = e.n[k] * m; }); return n; })();
  return {
    title: e.name,
    body: '<p class="field-label">' + (grams ? 'Amount' : 'Portions') + '</p><div class="stepper"><button class="step-btn" id="eq-m" data-act="entry-q" data-d="-1" aria-label="Less">−</button><span class="val"><span class="num">' + D.fmtN(a.q, grams ? 0 : 1) + '</span><small>' + (grams ? 'g' : '×') + '</small></span><button class="step-btn" id="eq-p" data-act="entry-q" data-d="1" aria-label="More">+</button></div>' +
      '<p class="sheet-note">' + D.fmtN(Math.round(base.kcal || 0)) + ' kcal · ' + Math.round(base.protein_g || 0) + ' g protein</p>' +
      '<p class="field-label">Meal</p><div class="pick-row" role="radiogroup" aria-label="Meal">' + GROUPS.map(g => '<button class="pick" id="eg-' + g[0] + '" role="radio" data-act="entry-g" data-v="' + g[0] + '" aria-checked="' + (a.g === g[0]) + '">' + g[1] + '</button>').join('') + '</div>' +
      '<div class="sheet-actions"><button class="btn ghost" id="entry-del" data-act="entry-del">Remove</button><button class="btn food" id="entry-save" data-act="entry-save">Save</button></div>'
  };
};
D.SHEETS.targets = a => {
  const p = food.get('profile') || {};
  if (!a.f) a.f = { heightCm: p.heightCm || '', age: p.age || '', sex: p.sex || 'male', goal: p.goalRate != null ? +p.goalRate : 0, kcal: (food.get('custom') || {}).kcal || '' };
  const f = a.f, GOALS = [[-0.5, 'Lose'], [0, 'Keep'], [0.25, 'Gain slowly'], [0.5, 'Gain']];
  return {
    title: 'Daily targets',
    body: '<p class="sheet-note">' + (S.bw ? 'Worked out from your weight (' + D.fmtN(S.bw, 1) + ' kg), height and age.' : 'Add a weigh-in from the Gym menu to work these out. Or type a daily calorie number below.') + '</p>' +
      '<div class="qa-grid two"><label for="tg-h">Height (cm)<input class="text-in" id="tg-h" inputmode="numeric" value="' + esc(f.heightCm) + '" placeholder="175"></label><label for="tg-a">Age<input class="text-in" id="tg-a" inputmode="numeric" value="' + esc(f.age) + '" placeholder="17"></label></div>' +
      '<div class="pick-row" role="radiogroup" aria-label="Sex">' + [['male', 'Male'], ['female', 'Female']].map(o => '<button class="pick" id="tg-s-' + o[0] + '" role="radio" data-act="tg-sex" data-v="' + o[0] + '" aria-checked="' + (f.sex === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      '<p class="field-label">Goal</p><div class="pick-row" role="radiogroup" aria-label="Goal">' + GOALS.map(o => '<button class="pick" id="tg-g' + String(o[0]).replace(/[.-]/g, '') + '" role="radio" data-act="tg-goal" data-v="' + o[0] + '" aria-checked="' + (f.goal === o[0]) + '">' + o[1] + '</button>').join('') + '</div>' +
      '<label class="field-label" for="tg-k">Or a fixed daily calorie target</label><input class="text-in" id="tg-k" inputmode="numeric" value="' + esc(f.kcal) + '" placeholder="Leave empty to work it out">' +
      '<button class="btn food block" id="tg-save" data-act="tg-save">Save</button>'
  };
};
D.SHEETS.foodmenu = () => ({
  title: 'Food',
  body: '<div class="menu-list"><button class="menu-item" id="fm-targets" data-act="sheet" data-sheet="targets">' + ic('sliders') + 'Daily targets</button></div>'
});

/* ---------- actions ---------- */
function syncTargets() { const a = D.sheetArg(); if (!a || !a.f) return; const h = $('#tg-h'), ag = $('#tg-a'), k = $('#tg-k'); if (h) a.f.heightCm = h.value; if (ag) a.f.age = ag.value; if (k) a.f.kcal = k.value; }
Object.assign(D.ACT, {
  'food-day': el => { S.day = Math.min(0, S.day + (+el.dataset.dir)); S.ai = null; render(); },
  qchip: el => {
    const dk = viewDk(), g = autoGroup();
    let ids = [];
    if (el.dataset.t === 'meal') {
      const m = (food.get('meals') || []).find(x => x.id === el.dataset.id); if (!m) return;
      ids = addEntries(dk, g, (m.items || []).map(it => { const f = foodById(it.foodId); return f ? { foodId: f.id, name: f.name, qty: it.qty, unit: f.kind === 'per100' ? 'g' : 'serving', n: snap(f, it.qty), src: 'meal' } : null; }).filter(Boolean));
    } else {
      const f = foodById(el.dataset.id); if (!f) return;
      const qty = f.kind === 'per100' ? 100 : 1;
      ids = addEntries(dk, g, [{ foodId: f.id, name: f.name, qty, unit: f.kind === 'per100' ? 'g' : 'serving', n: snap(f, qty), src: 'quick' }]);
    }
    render();
    D.toast('Added to ' + groupName(g), () => { markDeleted(dk, ids); render(); });
  },
  'ai-skip': el => { const it = S.ai && S.ai.items[+el.dataset.i]; if (it) { it.skip = !it.skip; renderAi(); } },
  'ai-cancel': () => { S.ai = null; renderAi(); },
  'ai-addall': () => {
    const a = S.ai; if (!a || !a.items) return;
    const dk = viewDk(), items = a.items.filter(i => !i.skip);
    const newFoods = items.map(it => addLib({ name: it.name, kind: 'serving', per: 1, unit: 'serving', nutrients: { kcal: +it.kcal || 0, protein_g: +it.protein_g || 0, carbs_g: +it.carbs_g || 0, fat_g: +it.fat_g || 0 }, src: 'ai' }));
    const ids = addEntries(dk, a.group, newFoods.map(f => ({ foodId: f.id, name: f.name, qty: 1, unit: 'serving', n: snap(f, 1), src: 'ai' })));
    S.ai = null; $('#ai-input').value = ''; render();
    D.toast('Added ' + ids.length + ' to ' + groupName(a.group), () => { markDeleted(dk, ids); render(); });
  },
  'copy-yday': () => {
    const dk = viewDk(), src = entries(D.dk(D.dayAt(S.day - 1)));
    const list = allEntries(dk), now = Date.now(), added = [];
    src.forEach(e => { const id = rid('e'); added.push(id); list.push(Object.assign({}, e, { id, at: now, updatedAt: now })); });
    setDayEntries(dk, list); render();
    D.toast('Copied ' + added.length + ' from yesterday', () => { markDeleted(dk, added); render(); });
  },
  'entry-q': el => { const a = D.sheetArg(), e = entries(viewDk()).find(x => x.id === a.id); const grams = e && e.unit === 'g'; a.q = Math.max(grams ? 10 : 0.5, Math.round((a.q + (+el.dataset.d) * (grams ? 10 : 0.5)) * 10) / 10); D.renderSheet(); },
  'entry-g': el => { D.sheetArg().g = el.dataset.v; D.renderSheet(); },
  'entry-save': () => {
    const a = D.sheetArg(), dk = viewDk();
    setDayEntries(dk, allEntries(dk).map(e => {
      if (e.id !== a.id) return e;
      const f = e.foodId ? foodById(e.foodId) : null;
      let n = e.n || {};
      if (f) n = snap(f, a.q); else if (+e.qty) { const m = a.q / +e.qty; n = {}; Object.keys(e.n || {}).forEach(k => { n[k] = e.n[k] * m; }); }
      return Object.assign({}, e, { qty: a.q, group: a.g, n, updatedAt: Date.now() });
    }));
    D.closeSheet(); render();
  },
  'entry-del': () => { const a = D.sheetArg(), dk = viewDk(); markDeleted(dk, [a.id]); D.closeSheet(); render(); D.toast('Removed', () => { markDeleted(dk, [a.id], false); render(); }); },
  'tg-sex': el => { syncTargets(); D.sheetArg().f.sex = el.dataset.v; D.renderSheet(); },
  'tg-goal': el => { syncTargets(); D.sheetArg().f.goal = +el.dataset.v; D.renderSheet(); },
  'tg-save': () => {
    syncTargets();
    const f = D.sheetArg().f, p = Object.assign({}, food.get('profile') || {});
    p.heightCm = parseFloat(f.heightCm) || null; p.age = parseFloat(f.age) || null; p.sex = f.sex; p.goalRate = f.goal; p.activity = p.activity || '1.55'; p.proteinPerKg = p.proteinPerKg || 1.8; p._at = Date.now();
    food.set('profile', p);
    const k = parseInt(f.kcal, 10);
    food.set('custom', k ? { kcal: k, _at: Date.now() } : { _at: Date.now() });
    D.closeSheet(); render(); D.toast('Targets saved');
  }
});

$('#ai-form').addEventListener('submit', e => { e.preventDefault(); const v = $('#ai-input').value.trim(); if (v) askAi(v); });
let searchT = null, searchSeq = 0;
$('#food-search').addEventListener('input', () => {
  clearTimeout(searchT);
  const q = $('#food-search').value.trim(), el = $('#search-res');
  if (q.length < 2) { el.innerHTML = ''; return; }
  const mine = lib().filter(f => f && !f.deleted && f.name.toLowerCase().indexOf(q.toLowerCase()) >= 0).slice(0, 4);
  const row = (f, src, i) => '<div class="res"><span class="nm">' + esc(f.name) + '<small>' + Math.round(+(f.nutrients || {}).kcal || 0) + ' kcal' + (f.kind === 'per100' ? ' per 100 g' : '') + '</small></span><button class="chip-btn" id="sr-' + src + i + '" data-act="search-add" data-src="' + src + '" data-i="' + i + '">Add</button></div>';
  S.found = { mine, usda: [] };
  el.innerHTML = mine.map((f, i) => row(f, 'mine', i)).join('') + '<p class="sheet-note" id="usda-note">Searching the food database…</p>';
  const seq = ++searchSeq;
  searchT = setTimeout(async () => {
    if (D.DEMO) { if (seq === searchSeq) { const n = $('#usda-note'); if (n) n.textContent = ''; } return; }
    try {
      const r = await fetch('/api/food?q=' + encodeURIComponent(q)), j = await r.json();
      if (seq !== searchSeq) return;
      S.found.usda = (j.ok && Array.isArray(j.results)) ? j.results.slice(0, 6) : [];
      el.innerHTML = mine.map((f, i) => row(f, 'mine', i)).join('') + S.found.usda.map((f, i) => row({ name: f.name + (f.brand ? ' (' + f.brand + ')' : ''), nutrients: f.nutrients, kind: 'per100' }, 'usda', i)).join('') +
        (!mine.length && !S.found.usda.length ? '<p class="sheet-note">No matches. Try the “What did you eat?” box instead.</p>' : '');
    } catch (e) { if (seq === searchSeq) { const n = $('#usda-note'); if (n) n.textContent = 'Couldn’t search right now.'; } }
  }, 350);
});
D.ACT['search-add'] = el => {
  const dk = viewDk(), g = autoGroup(), i = +el.dataset.i;
  let f = el.dataset.src === 'mine' ? S.found.mine[i] : null;
  if (el.dataset.src === 'usda') { const u = S.found.usda[i]; if (!u) return; f = addLib({ name: u.name + (u.brand ? ' (' + u.brand + ')' : ''), kind: 'per100', per: 100, nutrients: Object.assign({}, u.nutrients), src: 'usda', ref: { fdcId: u.fdcId } }); }
  if (!f) return;
  const qty = f.kind === 'per100' ? 100 : 1;
  const ids = addEntries(dk, g, [{ foodId: f.id, name: f.name, qty, unit: f.kind === 'per100' ? 'g' : 'serving', n: snap(f, qty), src: el.dataset.src }]);
  render(); D.toast('Added to ' + groupName(g) + (qty === 100 ? ' · 100 g' : ''), () => { markDeleted(dk, ids); render(); });
};
$('#qa-form').addEventListener('submit', e => {
  e.preventDefault();
  const k = parseInt($('#qa-kcal').value, 10), p = parseInt($('#qa-prot').value, 10) || 0;
  if (!k) { $('#qa-kcal').focus(); D.toast('Add the calories first'); return; }
  const dk = viewDk(), g = autoGroup();
  const ids = addEntries(dk, g, [{ foodId: null, name: 'Quick add', qty: 1, unit: 'serving', n: { kcal: k, protein_g: p }, src: 'quick' }]);
  $('#qa-kcal').value = ''; $('#qa-prot').value = ''; render();
  D.toast('Added ' + k + ' kcal', () => { markDeleted(dk, ids); render(); });
});

/* ---------- boot ---------- */
food.on(() => { if (!D.sheetKind()) render(); });
D.onWater(() => { $('#water-slot-food').innerHTML = D.waterChip('food'); D.animate($('#water-slot-food')); if (D.sheetKind() === 'water') D.renderSheet(); });
render();
D.boot('food').then(ok => { if (ok) loadBodyweight().then(render); });
})();
