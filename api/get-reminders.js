// Returns reminders for a specific user from Supabase.
// Called on dashboard load so every device sees the same reminder list.
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SB_URL || !SB_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase env vars not set' });
  }

  const userId = req.query.userId || 'shared';
  const prefix = userId + '::';
  const likeFilter = 'client_id=like.' + encodeURIComponent(prefix + '%');

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/reminders?${likeFilter}&select=client_id,title,message,time_local,enabled,category,repeat_daily&order=time_local.asc`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ ok: false, error: err });
    }
    const rows = await r.json();
    const reminders = rows.map(row => ({
      id: row.client_id.slice(prefix.length), // Strip user prefix
      title: row.title,
      message: row.message || row.title,
      time: row.time_local,
      enabled: row.enabled,
      category: row.category || 'custom',
      repeatDaily: row.repeat_daily !== false,
    }));
    return res.status(200).json({ ok: true, reminders });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
