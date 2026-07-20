// Food search — proxies USDA FoodData Central so the key stays server-side (same
// pattern as api/coach.js). GET /api/food?q=chicken+breast
//
// Vercel env var:  USDA_API_KEY   (free key from fdc.nal.usda.gov/api-key-signup.html)
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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' });

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
};
