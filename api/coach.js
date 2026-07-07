// AI Fuel Coach — proxies chat to Anthropic so the API key stays server-side
// (set ANTHROPIC_API_KEY in Vercel → Project → Settings → Environment Variables).
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(200).json({ ok: false, error: 'no-key' });

  const { context, question, history } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing question' });
  }

  const system = [
    'You are "Coach" — the user\'s personal AI coach inside their life dashboard app. You cover training, nutrition, body-weight progress, hydration, sleep and daily habits — all together, like one great human coach would.',
    'Style: direct, practical, encouraging, zero fluff. Keep answers under ~200 words unless the user asks for a full plan. Use short bullets for lists. Metric units + kcal.',
    'You are grounded in the user\'s REAL data below (raw JSON pulled from their dashboard). ALWAYS reference their actual numbers, exercises, streaks and trends — never generic assumptions. Cross-connect domains when useful (e.g. bad sleep + stalled lifts, under-eating + no weight gain).',
    'Calorie/macro targets in the data were computed by the app (Mifflin-St Jeor + an energy-balance self-training check-in on real weigh-ins and logged meals). Do NOT recompute targets from scratch — coach around them. If measured burn differs from the formula, trust the measured number.',
    'Gym data: template days with exercises (sets × rep ranges, target weights, to-failure sets) and per-day set logs like "60x8" (weight×reps). Spot stalls, suggest progressions.',
    'If data is missing for something, say what to start logging and why it helps.',
    'If the question is medical (eating disorders, medication, diabetes, injuries), briefly advise seeing a professional.',
    'Reply in the same language the user writes in.',
    '',
    'USER DATA:',
    JSON.stringify(context || {}, null, 1),
  ].join('\n');

  // Keep only the last 8 turns, sanitized to plain strings.
  const msgs = (Array.isArray(history) ? history : [])
    .slice(-8)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map(m => ({ role: m.role, content: m.text.slice(0, 2000) }));
  msgs.push({ role: 'user', content: question.slice(0, 2000) });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 900,
        system,
        messages: msgs,
      }),
    });
    const j = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: false, error: (j && j.error && j.error.message) || ('api-' + r.status) });
    }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ ok: true, text: text || '…' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
};
