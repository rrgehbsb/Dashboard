// Daily keep-alive (Vercel cron, see vercel.json). Supabase's free plan pauses a
// project after about a week without requests, which took the whole app offline
// (sign-in and sync both fail while paused). One tiny read a day prevents that.
module.exports = async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return res.status(500).json({ ok: false, error: 'missing env' });
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_state?select=key&limit=1`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e && e.message || e) });
  }
};
