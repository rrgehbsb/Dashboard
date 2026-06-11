// Sends a push notification to all stored subscriptions.
// Used by the "Send test" button and can be called manually.
// VAPID private key stays server-side only.
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function getSubscriptions() {
  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?select=subscription`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  );
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function deleteSubscription(endpoint) {
  await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
    {
      method: 'DELETE',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    }
  ).catch(() => {});
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title = 'Dashboard', body = '', url = '/' } = req.body || {};
  const payload = JSON.stringify({ title, body, url });

  let subs;
  try { subs = await getSubscriptions(); }
  catch (e) { return res.status(500).json({ error: e.message }); }

  if (!subs?.length) {
    return res.status(200).json({ sent: 0, reason: 'no subscriptions' });
  }

  const results = await Promise.allSettled(
    subs.map(row =>
      webpush.sendNotification(row.subscription, payload).catch(err => {
        if (err.statusCode === 410) deleteSubscription(row.subscription.endpoint);
        throw err;
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  return res.status(200).json({ sent, failed });
};
