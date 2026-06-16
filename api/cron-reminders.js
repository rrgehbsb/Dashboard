// Cron job — fires every minute via cron-job.org.
// Reads due reminders from Supabase and sends push via ntfy.sh.
// No web-push/VAPID needed — ntfy is a simple HTTP POST.
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NTFY_TOPIC = process.env.NTFY_TOPIC;

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

module.exports = async function handler(req, res) {
  const now = new Date().toISOString();

  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized', now });
  }

  if (!NTFY_TOPIC) {
    return res.status(500).json({ ok: false, error: 'NTFY_TOPIC env var not set on Vercel', now });
  }

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/reminders?enabled=eq.true&select=id,title,message,time_local,timezone`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ ok: false, step: 'fetch_reminders', error: err, now });
    }
    const reminders = await r.json();

    if (!reminders?.length) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No reminders configured', now });
    }

    const due = reminders.filter(rm => {
      const tz = rm.timezone || 'UTC';
      return rm.time_local === timeInZone(tz);
    });

    if (!due.length) {
      return res.status(200).json({ ok: true, sent: 0, message: 'No reminders due', now });
    }

    let sent = 0;
    const errors = [];

    await Promise.all(due.map(async rm => {
      try {
        const nr = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
          method: 'POST',
          headers: { Title: rm.title, 'Content-Type': 'text/plain' },
          body: rm.message || rm.title,
        });
        if (nr.ok) sent++;
        else errors.push({ id: rm.id, error: `ntfy ${nr.status}` });
      } catch (e) {
        errors.push({ id: rm.id, error: e.message });
      }
    }));

    return res.status(200).json({
      ok: true, sent, due: due.length,
      ...(errors.length ? { errors } : {}),
      now,
    });

  } catch (e) {
    return res.status(500).json({ ok: false, step: 'unknown', error: e.message, now });
  }
};
