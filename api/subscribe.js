// Saves a push subscription + timezone to Supabase.
// Called by the browser after the user grants notification permission.
// Uses service role key — never exposed to the browser.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { subscription, timezone } = req.body || {};
  if (!subscription?.endpoint) {
    return res.status(400).json({ error: 'Missing subscription.endpoint' });
  }

  const url = `${process.env.SUPABASE_URL}/rest/v1/push_subscriptions`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      subscription,
      timezone: timezone || 'UTC',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('subscribe: supabase error', err);
    return res.status(500).json({ error: err });
  }

  return res.status(200).json({ ok: true });
};
