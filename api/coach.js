// AI Coach — proxies chat to Anthropic (key stays server-side) and gives the
// model TOOLS so it can propose changes to the user's dashboard. The browser
// executes the tools (after the user confirms) and sends results back, so the
// server never touches the user's data. Model is configurable via COACH_MODEL.
//
// Vercel env vars:  ANTHROPIC_API_KEY (required),  COACH_MODEL (optional).

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
    description: "Set the user's water-tracker profile and/or drink sizes. Only include fields you want to change. Their daily water target is computed from these.",
    input_schema: { type: 'object', properties: {
      weight_kg: { type: 'number' }, age: { type: 'number' },
      sex: { type: 'string', enum: ['m','f'] },
      activity_hours_per_week: { type: 'number' },
      cup_ml: { type: 'number' }, bottle_ml: { type: 'number' }, big_bottle_ml: { type: 'number' },
    } },
  },
];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  // Trim stray whitespace/newlines that often sneak in when pasting the key
  // into a dashboard env-var field — a common cause of "invalid x-api-key".
  const KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!KEY) return res.status(200).json({ ok: false, error: 'no-key' });
  const MODEL = process.env.COACH_MODEL || 'claude-haiku-4-5-20251001';

  const { context, question, history, messages, tools } = req.body || {};

  const persona = [
    'You are "Coach" — the user\'s personal AI coach inside their life dashboard. You cover training, nutrition, body-weight, hydration, sleep and habits together, like one great human coach.',
    'Style: direct, practical, encouraging, no fluff. Under ~180 words unless asked for a full plan. Short bullets. Metric units + kcal.',
    'You are grounded in the user\'s REAL data (JSON below). Always use their actual numbers, exercises, trends — never generic assumptions. Connect domains (bad sleep + stalled lifts, under-eating + no weight gain).',
    'Targets in the data were computed by the app (Mifflin-St Jeor + an energy-balance self-training check-in). Do NOT recompute from scratch — coach around them; trust the measured burn over the formula.',
    'YOU CAN CHANGE THE DASHBOARD via tools (set targets, replace/add meals, edit/add gym exercises). When the user asks you to change something, or clearly agrees to a change you proposed, CALL THE TOOL — do not just describe it. Briefly confirm what you did in words too. For big changes (replacing the whole plan) say one sentence first, then call the tool. The app shows the user an Apply/Skip confirmation for every tool call, so it is safe to propose concrete changes.',
    'Never invent data you were not given. If unsure, ask one short question. Medical topics (eating disorders, meds, injuries) → briefly advise a professional.',
    'Reply in the user\'s language.',
  ].join('\n');

  // Build the messages array. Preferred: caller passes a full Anthropic
  // `messages` array (supports tool_use/tool_result). Fallback: question+history.
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

  const body = {
    model: MODEL,
    max_tokens: 1200,
    // Cache the big data context so the multi-step tool loop is cheap.
    system: [
      { type: 'text', text: persona },
      { type: 'text', text: 'USER DATA:\n' + JSON.stringify(context || {}), cache_control: { type: 'ephemeral' } },
    ],
    messages: msgs,
  };
  if (tools !== false) body.tools = TOOLS;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) {
      return res.status(200).json({ ok: false, error: (j && j.error && j.error.message) || ('api-' + r.status) });
    }
    // Return the raw content blocks (text + tool_use) so the client can act.
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return res.status(200).json({ ok: true, content: j.content || [], stop_reason: j.stop_reason, text });
  } catch (e) {
    return res.status(200).json({ ok: false, error: e.message });
  }
};
