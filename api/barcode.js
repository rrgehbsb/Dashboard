// Barcode lookup — proxies Open Food Facts. GET /api/barcode?code=5449000000996
//
// No key needed (OFF is fully open), so this is a thin proxy: normalizes the
// response into the same per-100g shape api/food.js returns, and — the part
// that actually matters — FIXES THE UNITS. USDA reports minerals/vitamins in
// mg/µg; Open Food Facts reports almost everything in plain grams per 100g,
// including sodium, calcium, vitamin D, etc. Copying OFF's numbers straight into
// mg/µg fields would be off by 1000x. Known nutrients get converted to the app's
// registry units; anything else is kept under off_<name>_g (grams, OFF's own
// stated convention) so it's still there for a future phase, just honestly
// labeled — same "keep everything" principle as the USDA endpoint.

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';

// [OFF field, registry key, multiplier to reach the registry's unit]
const CONVERT = [
  ['proteins_100g',      'protein_g',    1],
  ['carbohydrates_100g', 'carbs_g',      1],
  ['fat_100g',           'fat_g',        1],
  ['fiber_100g',         'fiber_g',      1],
  ['sugars_100g',        'sugar_g',      1],
  ['sodium_100g',        'sodium_mg',    1000],
  ['potassium_100g',     'potassium_mg', 1000],
  ['calcium_100g',       'calcium_mg',   1000],
  ['iron_100g',          'iron_mg',      1000],
  ['magnesium_100g',     'magnesium_mg', 1000],
  ['zinc_100g',          'zinc_mg',      1000],
  ['vitamin-c_100g',     'vitc_mg',      1000],
  ['vitamin-d_100g',     'vitd_ug',      1000000],
  ['vitamin-b12_100g',   'vitb12_ug',    1000000],
];
const KNOWN_FIELDS = new Set(CONVERT.map((c) => c[0]).concat(['energy-kcal_100g', 'energy_100g']));

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }

function mapNutriments(n) {
  const out = {};
  CONVERT.forEach(([field, key, mult]) => {
    const v = n[field];
    if (v != null && isFinite(v)) out[key] = Math.round(v * mult * 100) / 100;
  });
  // kcal: prefer the direct kcal field; fall back to converting kJ (÷4.184).
  if (n['energy-kcal_100g'] != null && isFinite(n['energy-kcal_100g'])) {
    out.kcal = Math.round(n['energy-kcal_100g']);
  } else if (n['energy_100g'] != null && isFinite(n['energy_100g'])) {
    out.kcal = Math.round(n['energy_100g'] / 4.184);
  }
  // Anything else numeric and per-100g: keep it, grams, honestly labeled.
  Object.keys(n).forEach((k) => {
    if (!k.endsWith('_100g') || KNOWN_FIELDS.has(k)) return;
    const v = n[k];
    if (typeof v !== 'number' || !isFinite(v)) return;
    out['off_' + slug(k.replace(/_100g$/, '')) + '_g'] = Math.round(v * 1000) / 1000;
  });
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method' });

  const code = String((req.query && req.query.code) || '').replace(/[^0-9]/g, '');
  if (code.length < 6) return res.status(200).json({ ok: false, error: 'code', message: 'That doesn\'t look like a barcode.' });

  try {
    const r = await fetch(OFF_BASE + '/' + encodeURIComponent(code) + '.json', {
      headers: { 'User-Agent': 'Dashboard-App/1.0 (personal fitness dashboard)' },
    });
    if (!r.ok) return res.status(200).json({ ok: false, error: 'upstream', message: "Couldn't reach the barcode database — try again." });
    const data = await r.json();
    if (data.status !== 1 || !data.product) {
      return res.status(200).json({ ok: false, error: 'not-found', message: 'No product found for that barcode — try Quick Add instead.' });
    }
    const p = data.product;
    const nutrients = mapNutriments(p.nutriments || {});
    if (nutrients.kcal == null) {
      return res.status(200).json({ ok: false, error: 'no-data', message: 'Found the product but it has no nutrition data logged — try Quick Add.' });
    }
    return res.status(200).json({
      ok: true,
      code: code,
      name: p.product_name || p.generic_name || ('Product ' + code),
      brand: p.brands || null,
      nutrients: nutrients, // per 100g, converted to registry units
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'network', message: "Couldn't reach the barcode database — try again." });
  }
};
