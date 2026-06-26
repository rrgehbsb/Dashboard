// Full sync: upserts current reminders into Supabase (per-user) and deletes removed ones.
// Called whenever the user adds, edits, deletes, or toggles a reminder.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const { reminders, timezone, userId } = req.body || {};
  if (!Array.isArray(reminders)) {
    return res.status(400).json({ ok: false, error: 'reminders must be an array' });
  }

  const uid = userId || 'shared';
  const prefix = uid + '::';
  const tz = timezone || 'UTC';

  try {
    // Delete all of this user's existing reminders, then re-upsert current list
    const likeFilter = 'client_id=like.' + encodeURIComponent(prefix + '%');
    await fetch(`${SB_URL}/rest/v1/reminders?${likeFilter}`, {
      method: 'DELETE',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });

    if (!reminders.length) {
      return res.status(200).json({ ok: true, synced: 0 });
    }

    const rows = reminders.map(r => ({
      client_id: prefix + String(r.id),
      title: r.title || '',
      message: r.message || r.title || '',
      category: r.category || 'custom',
      time_local: r.time || '08:00',
      timezone: tz,
      enabled: r.enabled !== false,
      repeat_daily: r.repeatDaily !== false,
      updated_at: new Date().toISOString(),
    }));

    const r = await fetch(
      `${SB_URL}/rest/v1/reminders?on_conflict=client_id`,
      {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(rows),
      }
    );

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ ok: false, error: err });
    }

    return res.status(200).json({ ok: true, synced: rows.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
