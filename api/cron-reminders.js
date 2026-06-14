// Cron job — fires every minute (via cron-job.org or Vercel Pro).
// Checks current time against enabled reminders, sends push to all active subscriptions,
// and records each delivery in reminder_deliveries to prevent duplicate sends.
// VAPID private key and Supabase service role key are server-side only — never in browser JS.
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
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

// "HH:MM" in a given IANA timezone
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

// "YYYY-MM-DD" in a given IANA timezone
function dateInZone(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
}

async function sbGet(path) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Supabase ${r.status}: ${body}`);
  }
  return r.json();
}

async function sbPost(path, body, extra = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: sbHeaders(extra),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Supabase POST ${path} ${r.status}: ${text}`);
  }
  return r;
}

module.exports = async function handler(req, res) {
  const now = new Date().toISOString();

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized', now });
  }

  // ── Wrap entire logic so no crash ever returns an HTML 500 ─────────────────
  try {

    // 1. Fetch enabled reminders from `reminders` table
    let reminders;
    try {
      reminders = await sbGet(
        'reminders?enabled=eq.true&select=id,title,message,time_local,timezone'
      );
    } catch (e) {
      console.error('[cron] fetch reminders failed:', e.message);
      return res.status(500).json({
        ok: false, step: 'fetch_reminders', error: e.message, now,
      });
    }

    if (!reminders?.length) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No reminders configured', now });
    }

    // 2. Filter to reminders whose time_local matches current time in their timezone
    const dueReminders = reminders.filter(r => {
      const tz = r.timezone || 'UTC';
      const cur = timeInZone(tz);
      return r.time_local === cur;
    });

    if (!dueReminders.length) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No reminders due', now });
    }

    // 3. Fetch enabled push subscriptions
    // Columns: id, endpoint, p256dh, auth
    let subs;
    try {
      subs = await sbGet(
        'push_subscriptions?enabled=eq.true&select=id,endpoint,p256dh,auth'
      );
    } catch (e) {
      console.error('[cron] fetch subscriptions failed:', e.message);
      return res.status(500).json({
        ok: false, step: 'fetch_subscriptions', error: e.message, now,
      });
    }

    if (!subs?.length) {
      return res.status(200).json({
        ok: true, sent: 0, message: 'No active push subscriptions', now,
      });
    }

    // 4. For each due reminder, send to subscriptions not already delivered today
    let totalSent = 0;
    const errors = [];

    for (const reminder of dueReminders) {
      const tz = reminder.timezone || 'UTC';
      const today = dateInZone(tz);

      // Check which subscription_ids already got this reminder today (avoid duplicates)
      let alreadySent = new Set();
      try {
        const deliveries = await sbGet(
          `reminder_deliveries?reminder_id=eq.${reminder.id}&delivery_date=eq.${today}&status=eq.sent&select=subscription_id`
        );
        alreadySent = new Set((deliveries || []).map(d => d.subscription_id));
      } catch (e) {
        // Non-fatal: if we can't check, we may double-send — acceptable over dropping
        console.error('[cron] fetch deliveries failed for reminder', reminder.id, e.message);
      }

      const payload = JSON.stringify({
        title: reminder.title,
        body: reminder.message || reminder.title,
        url: '/',
      });

      for (const sub of subs) {
        if (alreadySent.has(sub.id)) continue;

        // web-push expects { endpoint, keys: { p256dh, auth } }
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        let status = 'sent';
        let errorMsg = null;

        try {
          await webpush.sendNotification(pushSub, payload);
          totalSent++;
        } catch (e) {
          status = 'failed';
          errorMsg = e.message;
          errors.push({
            reminder_id: reminder.id,
            subscription_id: sub.id,
            error: e.message,
          });
          console.error('[cron] push failed reminder=%s sub=%s err=%s', reminder.id, sub.id, e.message);

          // 410 = subscription expired — remove it
          if (e.statusCode === 410) {
            fetch(`${SB_URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
              method: 'DELETE', headers: sbHeaders(),
            }).catch(() => {});
          }
        }

        // Record delivery (fire-and-forget — don't let a logging failure block sends)
        sbPost('reminder_deliveries', {
          reminder_id: reminder.id,
          subscription_id: sub.id,
          delivery_date: today,
          sent_at: new Date().toISOString(),
          status,
          error: errorMsg,
        }).catch(e => console.error('[cron] record delivery failed:', e.message));
      }
    }

    return res.status(200).json({
      ok: true,
      sent: totalSent,
      due: dueReminders.length,
      subscriptions: subs.length,
      ...(errors.length ? { errors } : {}),
      now,
    });

  } catch (e) {
    // Top-level safety net — should never reach here
    console.error('[cron] unhandled error:', e.message, e.stack);
    return res.status(500).json({
      ok: false,
      step: 'unknown',
      error: e.message,
      now,
    });
  }
};
