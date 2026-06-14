// Saves a browser push subscription to Supabase push_subscriptions table.
// Extracts endpoint, p256dh, auth from the PushSubscription object — stored as separate columns.
// Uses service role key — never exposed to the browser.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subscription, timezone, device_label } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ ok: false, error: 'Missing subscription.endpoint' });
  }

  // PushSubscription.toJSON() → { endpoint, expirationTime, keys: { p256dh, auth } }
  const { endpoint, keys: { p256dh, auth } = {} } = subscription;
  if (!p256dh || !auth) {
    return res.status(400).json({ ok: false, error: 'Missing subscription keys (p256dh or auth)' });
  }

  try {
    // Upsert on endpoint (requires unique constraint — see Supabase SQL below)
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: 'POST',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          endpoint,
          p256dh,
          auth,
          timezone: timezone || 'UTC',
          user_agent: req.headers['user-agent'] || '',
          device_label: device_label || '',
          enabled: true,
          updated_at: new Date().toISOString(),
        }),
      }
    );

    if (!r.ok) {
      const err = await r.text();
      console.error('[subscribe] supabase error:', err);
      return res.status(500).json({ ok: false, error: err });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[subscribe] unhandled error:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
