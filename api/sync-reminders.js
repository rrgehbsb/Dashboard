// Upserts reminder settings from the client (localStorage) into the Supabase `reminders` table.
// Called when the user enables push notifications. This is what gives the cron job its data.
// Uses client_id (localStorage reminder id) as the upsert key — requires unique index (see SQL below).
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { reminders, timezone } = req.body || {};
  if (!Array.isArray(reminders)) {
    return res.status(400).json({ ok: false, error: 'reminders must be an array' });
  }
  if (!reminders.length) {
    return res.status(200).json({ ok: true, synced: 0 });
  }

  const tz = timezone || 'UTC';
  const rows = reminders.map(r => ({
    client_id: String(r.id),          // text id from localStorage (e.g. "rm-meal-1")
    title: r.title || '',
    message: r.message || r.title || '',
    category: r.category || 'custom',
    time_local: r.time || '08:00',    // "HH:MM" format
    timezone: tz,
    enabled: r.enabled !== false,
    repeat_daily: r.repeatDaily !== false,
    updated_at: new Date().toISOString(),
  }));

  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reminders?on_conflict=client_id`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('[sync-reminders] supabase error:', err);
      return res.status(500).json({ ok: false, error: err });
    }

    return res.status(200).json({ ok: true, synced: rows.length });
  } catch (e) {
    console.error('[sync-reminders] unhandled error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
