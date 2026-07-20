// Food data endpoint — two jobs, split by HTTP method:
//
//   GET  /api/food?q=...          → USDA FoodData Central search (see below)
//   POST /api/food  {text,token}  → AI estimate: "3 eggs and toast" → food items
//
// Vercel env vars:
//   USDA_API_KEY                              (free, fdc.nal.usda.gov/api-key-signup.html)
//   OPENROUTER_API_KEY or ANTHROPIC_API_KEY    (same key api/coach.js uses)
//
// Design goal (per project spec): store EVERYTHING USDA gives us, display only the
// app's highlighted subset. Every nutrient USDA returns is mapped into the result —
// known ones get a friendly registry key (kcal, protein_g, iron_mg, ...), anything
// else rides along under usda_<nutrientNumber> so it's never thrown away. A future
// phase can surface any of those just by adding one line to food.html's NUTR list —
// no re-fetching, no migration, the data's already sitting in the user's library.

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA nutrient numbers → this app's registry keys (see NUTR in food.html).
// Anything not listed here is still kept, just under a usda_<number> key.
const NUTRIENT_MAP = {
  '208': 'kcal',        '203': 'protein_g',   '204': 'fat_g',      '205': 'carbs_g',
  '291': 'fiber_g',     '269': 'sugar_g',     '307': 'sodium_mg',  '306': 'potassium_mg',
  '301': 'calcium_mg',  '303': 'iron_mg',     '304': 'magnesium_mg','309': 'zinc_mg',
  '401': 'vitc_mg',     '328': 'vitd_ug',     '418': 'vitb12_ug',
};

// Lab-analyzed generic entries first (richest, most trustworthy data); branded
// packaged products last (label-only, usually just macros + sodium).
const TYPE_ORDER = { Foundation: 0, 'SR Legacy': 1, 'Survey (FNDDS)': 2, Branded: 3 };

function mapNutrients(foodNutrients) {
  const out = {};
  (foodNutrients || []).forEach((n) => {
    const num = String(n.nutrientNumber || (n.nutrient && n.nutrient.number) || '').trim();
    const val = n.value != null ? n.value : n.amount;
    if (!num || val == null || !isFinite(val)) return;
    const key = NUTRIENT_MAP[num] || ('usda_' + num);
    // USDA reports one row per nutrient per food — no dupes expected, but keep the
    // larger value defensively rather than silently overwriting with a stray 0.
    if (out[key] == null || val > out[key]) out[key] = Math.round(val * 100) / 100;
  });
  return out;
}

async function searchUSDA(req, res) {
  const KEY = (process.env.USDA_API_KEY || '').trim();
  if (!KEY) {
    return res.status(200).json({ ok: false, error: 'no-key',
      message: "Food search isn't set up yet — add USDA_API_KEY in Vercel (Settings → Environment Variables) and redeploy." });
  }

  const q = String((req.query && req.query.q) || '').trim();
  if (q.length < 2) return res.status(200).json({ ok: false, error: 'query', message: 'Type at least 2 characters.' });

  try {
    const url = USDA_BASE + '/foods/search?api_key=' + encodeURIComponent(KEY)
      + '&query=' + encodeURIComponent(q) + '&pageSize=25&requireAllWords=false';
    const r = await fetch(url);
    if (r.status === 403) {
      return res.status(200).json({ ok: false, error: 'bad-key', message: 'USDA rejected the key — check USDA_API_KEY in Vercel.' });
    }
    if (r.status === 429) {
      return res.status(200).json({ ok: false, error: 'rate-limited', message: 'Food database is busy — try again in a moment.' });
    }
    if (!r.ok) {
      return res.status(200).json({ ok: false, error: 'upstream', message: "Couldn't reach the food database (" + r.status + ')' });
    }
    const data = await r.json();
    const foods = Array.isArray(data.foods) ? data.foods : [];

    const results = foods
      .map((f) => {
        const nutrients = mapNutrients(f.foodNutrients);
        if (nutrients.kcal == null) return null; // no usable energy value — not worth showing
        return {
          fdcId: f.fdcId,
          name: f.description || 'Unknown food',
          brand: f.brandName || f.brandOwner || null,
          dataType: f.dataType || null,
          nutrients: nutrients, // per 100g — USDA's convention across all dataTypes
        };
      })
      .filter(Boolean)
      .sort((a, b) => (TYPE_ORDER[a.dataType] ?? 4) - (TYPE_ORDER[b.dataType] ?? 4))
      .slice(0, 20);

    return res.status(200).json({ ok: true, query: q, results: results });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network', message: "Couldn't reach the food database — try again." });
  }
}

// ── AI estimate: "3 eggs and toast with butter" → structured food items ──────
const SYS_PROMPT = 'You are a nutrition estimator inside a fitness app. The user describes what they ate in plain '
  + 'language. Break it into distinct food items and estimate calories and macros for each using typical, realistic '
  + 'portion sizes when none is given. Respond with ONLY a JSON array — no markdown fences, no commentary, no extra '
  + 'text before or after. Each item must look exactly like this shape: '
  + '{"name":"Scrambled eggs","qty_desc":"3 eggs","kcal":234,"protein_g":18,"carbs_g":2,"fat_g":17}. '
  + 'kcal/protein_g/carbs_g/fat_g must all be plain numbers (no units, no ranges). Keep names short and specific.';

function extractJsonArray(text) {
  try { const v = JSON.parse(text); if (Array.isArray(v)) return v; } catch (e) {}
  const m = String(text || '').match(/\[[\s\S]*\]/);
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v; } catch (e) {} }
  return null;
}

async function aiEstimate(req, res) {
  // ── ACCESS CONTROL (identical to api/coach.js) ──────────────────────────────
  // This spends the owner's LLM credit exactly like the coach does, so it must be
  // gated the same way: verify the caller's real Supabase account server-side,
  // then check the admin's allowlist. No bypassing this for a "smaller" feature.
  const SB_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
  const SB_ANON = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';
  const ADMIN_EMAIL = 'tomayala55@gmail.com';

  const { text, token } = req.body || {};

  let caller = null;
  if (token) {
    try {
      const ur = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + token } });
      if (ur.ok) caller = await ur.json();
    } catch (e) {}
  }
  if (!caller || !caller.id) {
    return res.status(200).json({ ok: false, error: 'auth', message: 'Please sign out and sign back in — your session expired.' });
  }
  const isAdmin = String(caller.email || '').toLowerCase() === ADMIN_EMAIL;
  if (!isAdmin) {
    let allowed = false;
    try {
      const alr = await fetch(SB_URL + '/rest/v1/app_state?key=eq.ai%3Aallowlist&select=data', {
        headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      });
      const rows = await alr.json();
      const list = (rows && rows[0] && rows[0].data && rows[0].data.allowed) || {};
      allowed = !!list[caller.id];
    } catch (e) {}
    if (!allowed) {
      return res.status(200).json({ ok: false, error: 'not-allowed',
        message: '🔒 AI food logging isn\'t enabled for your account. Ask the owner to switch it on in Settings → AI Access.' });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const desc = String(text || '').trim().slice(0, 500);
  if (!desc) return res.status(200).json({ ok: false, error: 'empty', message: 'Describe what you ate first.' });

  const cands = [process.env.OPENROUTER_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.COACH_API_KEY]
    .map((k) => (k || '').trim()).filter(Boolean);
  const KEY = cands.find((k) => k.indexOf('sk-or-') === 0) || cands.find((k) => k.indexOf('sk-ant-') === 0) || cands[0] || '';
  if (!KEY) return res.status(200).json({ ok: false, error: 'no-key', message: 'AI logging isn\'t set up yet — the owner needs to add an API key.' });
  const isOR = KEY.indexOf('sk-or-') === 0;
  const MODEL = process.env.COACH_MODEL || (isOR ? 'google/gemini-2.5-flash' : 'claude-haiku-4-5-20251001');

  try {
    let raw;
    if (isOR) {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY, 'HTTP-Referer': 'https://dashboard.app', 'X-Title': 'Dashboard Food AI' },
        body: JSON.stringify({ model: MODEL, temperature: 0.3, messages: [{ role: 'system', content: SYS_PROMPT }, { role: 'user', content: desc }] }),
      });
      if (!r.ok) return res.status(200).json({ ok: false, error: 'upstream', message: 'The AI is busy right now — try again in a moment.' });
      const data = await r.json();
      raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    } else {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYS_PROMPT, messages: [{ role: 'user', content: desc }] }),
      });
      if (!r.ok) return res.status(200).json({ ok: false, error: 'upstream', message: 'The AI is busy right now — try again in a moment.' });
      const data = await r.json();
      raw = data && data.content && data.content[0] && data.content[0].text;
    }

    const items = extractJsonArray(raw);
    if (!items || !items.length) {
      return res.status(200).json({ ok: false, error: 'parse', message: "Couldn't make sense of that — try rephrasing (e.g. \"2 eggs, toast, a banana\")." });
    }
    const clean = items
      .filter((it) => it && it.name)
      .slice(0, 12)
      .map((it) => ({
        name: String(it.name).slice(0, 60),
        qty_desc: it.qty_desc ? String(it.qty_desc).slice(0, 40) : '',
        kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
        protein_g: Math.max(0, Math.round((Number(it.protein_g) || 0) * 10) / 10),
        carbs_g: Math.max(0, Math.round((Number(it.carbs_g) || 0) * 10) / 10),
        fat_g: Math.max(0, Math.round((Number(it.fat_g) || 0) * 10) / 10),
      }));
    return res.status(200).json({ ok: true, items: clean });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network', message: 'Could not reach the AI — try again.' });
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return searchUSDA(req, res);
  if (req.method === 'POST') return aiEstimate(req, res);
  return res.status(405).json({ ok: false, error: 'method' });
};
