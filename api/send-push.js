// Sends a push notification to all active subscriptions.
// Used by the "Send test" button. VAPID private key stays server-side only.
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function getSubscriptions() {
  // Fetch enabled subscriptions; columns: id, endpoint, p256dh, auth
  const r = await fetch(
    `${SB_URL}/rest/v1/push_subscriptions?enabled=eq.true&select=id,endpoint,p256dh,auth`,
    {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      },
    }
  );
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}

async function deleteSubscription(id) {
  await fetch(`${SB_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  }).catch(() => {});
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { title = 'Dashboard', body = '', url = '/' } = req.body || {};
  const payload = JSON.stringify({ title, body, url });

  let subs;
  try { subs = await getSubscriptions(); }
  catch (e) {
    console.error('[send-push] fetch subscriptions failed:', e.message);
    return res.status(500).json({ ok: false, error: e.message });
  }

  if (!subs?.length) {
    return res.status(200).json({ ok: true, sent: 0, reason: 'no subscriptions' });
  }

  let sent = 0;
  const errors = [];

  await Promise.allSettled(
    subs.map(async sub => {
      // web-push expects { endpoint, keys: { p256dh, auth } }
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(pushSub, payload);
        sent++;
      } catch (e) {
        errors.push({ id: sub.id, error: e.message });
        console.error('[send-push] failed for sub', sub.id, e.message);
        if (e.statusCode === 410) await deleteSubscription(sub.id);
      }
    })
  );

  return res.status(200).json({
    ok: true,
    sent,
    failed: errors.length,
    ...(errors.length ? { errors } : {}),
  });
};
