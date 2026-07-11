// AI Coach — proxies chat to an LLM (key stays server-side) and gives the model
// TOOLS so it can propose changes to the user's dashboard. The browser executes
// tools (after the user confirms) and sends results back.
//
// Works with EITHER provider, auto-detected from the key prefix:
//   • Anthropic  (key starts "sk-ant-")  → api.anthropic.com
//   • OpenRouter (key starts "sk-or-")   → openrouter.ai  (has free models)
// The browser always talks to us in Anthropic block format; we translate.
//
// Vercel env vars:  ANTHROPIC_API_KEY  or  OPENROUTER_API_KEY  (either works),
//                   COACH_MODEL (optional).

const TOOLS = [
  {
    name: 'set_nutrition_targets',
    description: "Set the user's daily calorie + macro target RANGES in the meal-prep tracker. Only call after the user agrees to specific numbers.",
    input_schema: { type: 'object', properties: {
      kcal_min: { type: 'number' }, kcal_max: { type: 'number' },
      protein_min: { type: 'number' }, protein_max: { type: 'number' },
      carbs_min: { type: 'number' }, carbs_max: { type: 'number' },
      fat_min: { type: 'number' }, fat_max: { type: 'number' },
    }, required: ['kcal_min','kcal_max','protein_min','protein_max','carbs_min','carbs_max','fat_min','fat_max'] },
  },
  {
    name: 'replace_meal_plan',
    description: "Replace the user's whole daily meal plan (the checklist). Give real portions in `foods`. Per-meal macros should sum toward their daily target.",
    input_schema: { type: 'object', properties: {
      meals: { type: 'array', items: { type: 'object', properties: {
        name: { type: 'string', description: 'e.g. "Breakfast" or "Lunch — Chicken & rice"' },
        foods: { type: 'string', description: 'e.g. "250g chicken breast, 300g rice, 150g veg, 7g olive oil"' },
        kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
      }, required: ['name','foods','kcal','protein','carbs','fat'] } },
    }, required: ['meals'] },
  },
  {
    name: 'add_meal',
    description: 'Add ONE meal to the existing meal plan (does not remove others).',
    input_schema: { type: 'object', properties: {
      name: { type: 'string' }, foods: { type: 'string' },
      kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
    }, required: ['name','foods','kcal','protein','carbs','fat'] },
  },
  {
    name: 'set_gym_exercise',
    description: "Update an EXISTING exercise in the gym plan. Match by day_name + exercise_name (case-insensitive, partial ok). Only include the fields you want to change.",
    input_schema: { type: 'object', properties: {
      day_name: { type: 'string' }, exercise_name: { type: 'string' },
      sets: { type: 'number' }, rep_min: { type: 'number' }, rep_max: { type: 'number' },
      target: { type: 'string', description: 'target weight, e.g. "50 kg"' },
      fail_sets: { type: 'number', description: 'how many of the sets are taken to failure' },
    }, required: ['day_name','exercise_name'] },
  },
  {
    name: 'add_gym_exercise',
    description: 'Add a new exercise to a day in the gym plan.',
    input_schema: { type: 'object', properties: {
      day_name: { type: 'string' }, name: { type: 'string' },
      sets: { type: 'number' }, rep_min: { type: 'number' }, rep_max: { type: 'number' },
      target: { type: 'string' }, fail_sets: { type: 'number' },
      bodyweight: { type: 'boolean' }, unilateral: { type: 'boolean' },
    }, required: ['day_name','name','sets','rep_min','rep_max'] },
  },
  {
    name: 'set_water_setup',
    description: "Set the user's water-tracker profile and/or drink sizes. Only include fields you want to change.",
    input_schema: { type: 'object', properties: {
      weight_kg: { type: 'number' }, age: { type: 'number' },
      sex: { type: 'string', enum: ['m','f'] },
      activity_hours_per_week: { type: 'number' },
      cup_ml: { type: 'number' }, bottle_ml: { type: 'number' }, big_bottle_ml: { type: 'number' },
    } },
  },
];

const PERSONA = [
  'You are "Coach" — the user\'s personal AI coach inside their life dashboard. You cover training, nutrition, body-weight, hydration, sleep and habits together, like one great human coach.',
  'Style: direct, practical, encouraging, no fluff. Under ~180 words unless asked for a full plan. Short bullets. Metric units + kcal.',
  'You are grounded in the user\'s REAL data (JSON below). Always use their actual numbers, exercises, trends — never generic assumptions. Connect domains (bad sleep + stalled lifts, under-eating + no weight gain).',
  'Targets in the data were computed by the app (Mifflin-St Jeor + an energy-balance self-training check-in). Do NOT recompute from scratch — coach around them; trust the measured burn over the formula.',
  'YOU CAN CHANGE THE DASHBOARD via tools (set targets, replace/add meals, edit/add gym exercises, water setup). When the user asks you to change something, or clearly agrees to a change you proposed, CALL THE TOOL — do not just describe it. Briefly confirm what you did in words too. The app shows the user an Apply/Skip confirmation for every tool call, so it is safe to propose concrete changes.',
  'Never invent data you were not given. If unsure, ask one short question. Medical topics (eating disorders, meds, injuries) → briefly advise a professional.',
  'Reply in the user\'s language.',
].join('\n');

// ── format translation for OpenRouter (OpenAI-compatible) ──
function toOpenAI(msgs) {
  const out = [];
  for (const m of msgs) {
    if (typeof m.content === 'string') { out.push({ role: m.role, content: m.content }); continue; }
    if (!Array.isArray(m.content)) continue;
    if (m.role === 'assistant') {
      const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
      const calls = m.content.filter(b => b.type === 'tool_use')
        .map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input || {}) } }));
      const a = { role: 'assistant', content: text || null };
      if (calls.length) a.tool_calls = calls;
      out.push(a);
    } else { // user turn — may hold tool_result blocks and/or text
      const texts = [];
      for (const b of m.content) {
        if (b.type === 'tool_result') out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: typeof b.content === 'string' ? b.content : JSON.stringify(b.content) });
        else if (b.type === 'text') texts.push(b.text);
      }
      if (texts.length) out.push({ role: 'user', content: texts.join('\n') });
    }
  }
  return out;
}
function fromOpenAI(choice) {
  const msg = (choice && choice.message) || {};
  const content = [];
  if (msg.content) content.push({ type: 'text', text: msg.content });
  (msg.tool_calls || []).forEach(tc => {
    let input = {}; try { input = JSON.parse(tc.function.arguments || '{}'); } catch (e) {}
    content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
  });
  const stop_reason = (choice && choice.finish_reason === 'tool_calls') ? 'tool_use' : 'end_turn';
  return { content, stop_reason };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  // Pick the real key out of whatever env vars are set (people end up with a
  // stray ANTHROPIC_API_KEY too). Prefer an OpenRouter key, then Anthropic,
  // then whatever's there. Trims stray whitespace/newlines.
  const cands = [process.env.OPENROUTER_API_KEY, process.env.ANTHROPIC_API_KEY, process.env.COACH_API_KEY]
    .map(k => (k || '').trim()).filter(Boolean);
  const KEY = cands.find(k => k.indexOf('sk-or-') === 0) || cands.find(k => k.indexOf('sk-ant-') === 0) || cands[0] || '';
  if (!KEY) return res.status(200).json({ ok: false, error: 'no-key' });
  const isOR = KEY.indexOf('sk-or-') === 0;
  // OpenRouter default = a capable FREE model with tool support (no credit needed).
  // Default OpenRouter model: cheap+smart Gemini 2.5 Flash (needs a little credit).
  // If it fails (e.g. no credit), we fall back to free models automatically.
  const OR_DEFAULT = 'google/gemini-2.5-flash';
  const OR_FREE = 'meta-llama/llama-3.3-70b-instruct:free';
  const OR_FREE_FALLBACK = 'qwen/qwen3-next-80b-a3b-instruct:free';
  const MODEL = process.env.COACH_MODEL || (isOR ? OR_DEFAULT : 'claude-haiku-4-5-20251001');

  const { context, question, history, messages, tools, token } = req.body || {};

  // ── ACCESS CONTROL ───────────────────────────────────────────────────────
  // The LLM key is the OWNER's and costs real money, so only the admin and
  // accounts the admin has explicitly allowed may call it. We verify the
  // caller's Supabase access token server-side (can't be spoofed), then check
  // the admin-managed allowlist stored in app_state under key "ai:allowlist".
  const SB_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
  const SB_ANON = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';
  const ADMIN_EMAIL = 'tomayala55@gmail.com';

  let caller = null;
  if (token) {
    try {
      const ur = await fetch(SB_URL + '/auth/v1/user', {
        headers: { apikey: SB_ANON, Authorization: 'Bearer ' + token },
      });
      if (ur.ok) caller = await ur.json();
    } catch (e) {}
  }
  if (!caller || !caller.id) {
    return res.status(200).json({ ok: false, error: 'auth',
      message: 'Please sign out and sign back in — your session expired.' });
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
        message: '🔒 The AI coach isn\'t enabled for your account. Ask the owner to switch it on for you.' });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const contextText = 'USER DATA:\n' + JSON.stringify(context || {});

  // Build the neutral message list (Anthropic block format). Preferred: caller
  // passes a full `messages` array (supports tool_use/tool_result). Fallback:
  // question + history of {role,text}.
  let msgs;
  if (Array.isArray(messages) && messages.length) {
    msgs = messages;
  } else {
    msgs = (Array.isArray(history) ? history : [])
      .slice(-8)
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
      .map(m => ({ role: m.role, content: m.text.slice(0, 4000) }));
    if (question) msgs.push({ role: 'user', content: String(question).slice(0, 4000) });
  }
  if (!msgs.length) return res.status(400).json({ ok: false, error: 'no messages' });
  const withTools = tools !== false;

  try {
    if (isOR) {
      const oaMessages = [{ role: 'system', content: PERSONA + '\n\n' + contextText }, ...toOpenAI(msgs)];
      const oaTools = withTools ? TOOLS.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
      async function callOR(model) {
        const body = { model, max_tokens: 1200, messages: oaMessages };
        if (oaTools) body.tools = oaTools;
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY, 'HTTP-Referer': 'https://dashboard.app', 'X-Title': 'Dashboard Coach' },
          body: JSON.stringify(body),
        });
        return { r, j: await r.json() };
      }
      // Free OpenRouter endpoints are heavily rate-limited. Try the default free
      // model, then ONE alternate — don't hammer (that only makes limits worse).
      const tryList = process.env.COACH_MODEL ? [MODEL] : [OR_DEFAULT, OR_FREE, OR_FREE_FALLBACK];
      let r, j, lastErr = '', lastDetail = '';
      for (const m of tryList) {
        ({ r, j } = await callOR(m));
        if (r.ok && j && j.choices && j.choices.length) break;
        lastErr = (j && j.error && (j.error.message || JSON.stringify(j.error))) || ('http-' + r.status);
        const meta = (j && j.error && j.error.metadata) ? j.error.metadata : null;
        lastDetail = meta ? String(meta.raw || JSON.stringify(meta)) : '';
        const retryable = /provider returned error|no endpoints|not found|overload|timeout|unavailable|payment|credit|insufficient|quota|402|429|502|503|500/i.test(lastErr + ' ' + lastDetail + ' ' + r.status);
        if (!retryable) break;
      }
      if (!r.ok || !(j && j.choices && j.choices.length)) {
        const rateLimited = /rate.?limit|429|quota|temporarily/i.test(lastErr + ' ' + lastDetail);
        const message = rateLimited
          ? "🕐 The free AI model is rate-limited right now (OpenRouter caps the free tier). Wait ~30s and retry — or for instant, reliable answers add ~$5 credit at openrouter.ai and set COACH_MODEL to a cheap model like `anthropic/claude-3.5-haiku`."
          : "The AI provider returned an error: " + (lastDetail || lastErr).slice(0, 200);
        return res.status(200).json({ ok: false, error: rateLimited ? 'rate-limited' : lastErr, message });
      }
      const conv = fromOpenAI(j.choices[0]);
      const text = conv.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      return res.status(200).json({ ok: true, content: conv.content, stop_reason: conv.stop_reason, text });
    }

    // Anthropic
    const body = {
      model: MODEL,
      max_tokens: 1200,
      system: [
        { type: 'text', text: PERSONA },
        { type: 'text', text: contextText, cache_control: { type: 'ephemeral' } },
      ],
      messages: msgs,
    };
    if (withTools) body.tools = TOOLS;
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) return res.status(200).json({ ok: false, error: (j && j.error && j.error.message) || ('api-' + r.status) });
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ ok: true, content: j.content || [], stop_reason: j.stop_reason, text });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
};
