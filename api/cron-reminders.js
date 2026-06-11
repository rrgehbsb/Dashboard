// Cron job: checks current time against enabled reminders and sends push notifications.
// Triggered every minute by Vercel Cron (Pro plan) or an external service like cron-job.org.
// VAPID private key and Supabase service role key are server-side only.
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders(extra = {}) {
  return {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// Returns "HH:MM" in the given IANA timezone
function timeInZone(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date());
    const h = parts.find(p => p.type === 'hour').value;
    const m = parts.find(p => p.type === 'minute').value;
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  } catch {
    const n = new Date();
    return `${String(n.getUTCHours()).padStart(2, '0')}:${String(n.getUTCMinutes()).padStart(2, '0')}`;
  }
}

// Returns "YYYY-MM-DD" in the given IANA timezone
function dateInZone(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

module.exports = async function handler(req, res) {
  // Vercel Cron automatically sets Authorization: Bearer <CRON_SECRET>
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1. Fetch all push subscriptions (with timezone per device)
  const subRes = await fetch(
    `${SB_URL}/rest/v1/push_subscriptions?select=subscription,timezone`,
    { headers: sbHeaders() }
  );
  if (!subRes.ok) return res.status(500).json({ error: 'Failed to fetch subscriptions' });
  const subs = await subRes.json();
  if (!subs?.length) return res.status(200).json({ fired: 0, reason: 'no subscriptions' });

  // 2. Fetch reminders + sent log from app_state
  const stateRes = await fetch(
    `${SB_URL}/rest/v1/app_state?key=eq.dashboard&select=data&limit=1`,
    { headers: sbHeaders() }
  );
  if (!stateRes.ok) return res.status(500).json({ error: 'Failed to fetch app_state' });
  const stateRows = await stateRes.json();
  const stateData = stateRows?.[0]?.data || {};

  const reminders = stateData['dashboard:reminders:v1'] || [];
  if (!reminders.length) return res.status(200).json({ fired: 0, reason: 'no reminders' });

  const sentLog = stateData['dashboard:reminders:sent:v1'] || {};
  const newSentLog = { ...sentLog };

  // 3. Group subscriptions by timezone, check each group's local time
  const byTZ = {};
  subs.forEach(row => {
    const tz = row.timezone || 'UTC';
    (byTZ[tz] = byTZ[tz] || []).push(row.subscription);
  });

  let fired = 0;

  for (const [tz, subList] of Object.entries(byTZ)) {
    const curTime = timeInZone(tz);
    const today = dateInZone(tz);
    const daySent = newSentLog[today] || {};

    const due = reminders.filter(r => r.enabled && r.time === curTime && !daySent[r.id]);
    if (!due.length) continue;

    for (const r of due) {
      const payload = JSON.stringify({ title: r.title, body: r.message || r.title, url: '/' });
      await Promise.allSettled(
        subList.map(sub =>
          webpush.sendNotification(sub, payload).catch(err => {
            // 410 Gone = subscription expired, clean it up
            if (err.statusCode === 410) {
              fetch(
                `${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
                { method: 'DELETE', headers: sbHeaders() }
              ).catch(() => {});
            }
          })
        )
      );
      if (!newSentLog[today]) newSentLog[today] = {};
      newSentLog[today][r.id] = Date.now();
      fired++;
    }
  }

  // 4. Prune sent log entries older than 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  Object.keys(newSentLog).forEach(d => { if (new Date(d) < cutoff) delete newSentLog[d]; });

  // 5. Write updated sent log back to app_state so client stays in sync
  if (fired > 0) {
    const newData = { ...stateData, 'dashboard:reminders:sent:v1': newSentLog };
    await fetch(`${SB_URL}/rest/v1/app_state`, {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: 'dashboard', data: newData, updated_at: new Date().toISOString() }),
    });
  }

  return res.status(200).json({ fired, checkedAt: new Date().toISOString() });
};
