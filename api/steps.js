// Step sync — the bridge between the phone's health data and the dashboard.
//
// A web page cannot read Apple Health or Android Health Connect; only the OS can.
// So the phone pushes to us instead: an iOS Shortcut (or MacroDroid on Android)
// reads today's step count and calls this URL. One GET, no body, no login — which
// is the whole point, because Shortcuts can't hold a Supabase session.
//
//   GET /api/steps?u=<uid>&t=<token>&s=<steps>[&d=YYYY-MM-DD]
//
// The token is a per-account secret stored in that account's own steps row, so a
// URL only ever writes to the account it belongs to and nowhere else.

const SB_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
const SB_KEY = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

async function readRow(key) {
  const r = await fetch(SB_URL + '/rest/v1/app_state?key=eq.' + encodeURIComponent(key) + '&select=data', { headers: H });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows && rows[0] && rows[0].data) || null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query || {};
  const uid = String(q.u || '').trim();
  const token = String(q.t || '').trim();
  const steps = parseInt(q.s, 10);

  if (!uid || !token) return res.status(400).send('Missing account or token in the link.');
  if (!isFinite(steps) || steps < 0 || steps > 300000) return res.status(400).send('Step count looks wrong: ' + q.s);

  let row;
  try { row = await readRow(uid + ':steps'); } catch (e) { return res.status(500).send('Could not reach the database.'); }

  // Token must already exist — it's created when you open Step Sync in the app.
  if (!row || !row.token) return res.status(403).send('Step sync is not set up for this account yet. Open Health → Steps → Set up in the dashboard first.');
  if (row.token !== token) return res.status(403).send('Wrong token — regenerate your link in the dashboard.');

  // Work out which DAY this count belongs to. The server runs on UTC, so around
  // midnight local time that's the wrong day. The dashboard bakes the account's
  // timezone offset into the link (tzo, as JS getTimezoneOffset() reports it) so
  // this stays right without asking the user to add a date step to their Shortcut.
  let date = String(q.d || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const tzo = parseInt(q.tzo, 10);
    const shift = isFinite(tzo) ? tzo : 0; // local = UTC − tzo minutes
    date = new Date(Date.now() - shift * 60000).toISOString().slice(0, 10);
  }

  const days = Object.assign({}, row.days || {});
  days[date] = steps; // latest reading for a day replaces the earlier one — it only grows

  // Keep roughly a year; the row is fetched by the coach and doesn't need to be huge.
  const keys = Object.keys(days).sort();
  while (keys.length > 400) delete days[keys.shift()];

  const data = Object.assign({}, row, { days, updatedAt: Date.now() });

  try {
    const put = await fetch(SB_URL + '/rest/v1/app_state?on_conflict=key', {
      method: 'POST',
      headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: uid + ':steps', data, updated_at: new Date().toISOString() }),
    });
    if (!put.ok) return res.status(500).send('Could not save (' + put.status + ').');
  } catch (e) {
    return res.status(500).send('Could not save.');
  }

  // Plain text: this is what you see if you tap the link, and what a Shortcut shows.
  return res.status(200).send('✅ ' + steps.toLocaleString() + ' steps saved for ' + date);
};
