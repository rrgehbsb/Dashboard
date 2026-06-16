// Sends a test notification via ntfy.sh. Called by the "Send test" button.
// NTFY_TOPIC is server-side only — never exposed to the browser.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const NTFY_TOPIC = process.env.NTFY_TOPIC;
  if (!NTFY_TOPIC) {
    return res.status(500).json({ ok: false, error: 'NTFY_TOPIC env var not set on Vercel' });
  }

  const { title = 'Dashboard reminder', body = 'Test notification is working!' } = req.body || {};

  try {
    const r = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: 'POST',
      headers: { Title: title, 'Content-Type': 'text/plain' },
      body,
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ ok: false, error: `ntfy ${r.status}: ${text}` });
    }
    return res.status(200).json({ ok: true, sent: 1 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
