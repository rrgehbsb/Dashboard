// App usage — how long you actually spend in the apps that eat your day.
//
// iOS refuses to hand out total Screen Time (even native apps can't exfiltrate it),
// but Shortcuts CAN trigger when a specific app opens or closes. So the phone pings
// us twice per session and we do the arithmetic here:
//
//   GET /api/usage?u=<uid>&t=<token>&app=TikTok&e=open
//   GET /api/usage?u=<uid>&t=<token>&app=TikTok&e=close
//
// Auth reuses the same per-account token as /api/steps (one secret per phone link).
// Sessions land in the uid:screen row alongside the eye-break stats.

const SB_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
const SB_KEY = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

const MIN_SESSION = 2000;          // under 2s: a mis-tap, not usage
const MAX_SESSION = 4 * 3600000;   // over 4h: a close event never arrived — don't invent a marathon

async function readRow(key) {
  const r = await fetch(SB_URL + '/rest/v1/app_state?key=eq.' + encodeURIComponent(key) + '&select=data', { headers: H });
  if (!r.ok) return null;
  const rows = await r.json();
  return (rows && rows[0] && rows[0].data) || null;
}
async function writeRow(key, data) {
  return fetch(SB_URL + '/rest/v1/app_state?on_conflict=key', {
    method: 'POST',
    headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ key: key, data: data, updated_at: new Date().toISOString() }),
  });
}
function fmt(ms) {
  const m = Math.round(ms / 60000);
  return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = req.query || {};
  const uid = String(q.u || '').trim();
  const token = String(q.t || '').trim();
  const app = String(q.app || '').trim().slice(0, 40);
  const ev = String(q.e || '').trim().toLowerCase();

  if (!uid || !token || !app) return res.status(400).send('Link is missing the account, token or app name.');
  if (ev !== 'open' && ev !== 'close') return res.status(400).send('The link must end in &e=open or &e=close.');

  // Same secret as step sync — one link per phone, created when you open Health.
  let auth;
  try { auth = await readRow(uid + ':steps'); } catch (e) { return res.status(500).send('Could not reach the database.'); }
  if (!auth || !auth.token) return res.status(403).send('Phone sync is not set up yet. Open Health in the dashboard first.');
  if (auth.token !== token) return res.status(403).send('Wrong token — copy your link again from the dashboard.');

  const tzo = parseInt(q.tzo, 10);
  const shift = isFinite(tzo) ? tzo : 0;
  const now = Date.now();
  const date = new Date(now - shift * 60000).toISOString().slice(0, 10);

  const row = (await readRow(uid + ':screen')) || {};
  const apps = Object.assign({}, row.apps || {});
  const open = Object.assign({}, row.open || {});
  const day = Object.assign({}, apps[date] || {});
  const rec = Object.assign({ ms: 0, opens: 0 }, day[app] || {});

  let msg;
  if (ev === 'open') {
    open[app] = now;
    rec.opens += 1;
    msg = '▶️ ' + app + ' opened (' + rec.opens + ' today)';
  } else {
    const started = open[app];
    delete open[app];
    if (!started) {
      msg = '⏹️ ' + app + ' closed (no matching open — ignored)';
    } else {
      const dur = now - started;
      if (dur >= MIN_SESSION && dur <= MAX_SESSION) {
        rec.ms += dur;
        msg = '⏹️ ' + app + ' — ' + fmt(rec.ms) + ' today';
      } else {
        msg = '⏹️ ' + app + ' closed (session ignored: ' + Math.round(dur / 1000) + 's)';
      }
    }
  }

  day[app] = rec;
  apps[date] = day;

  // Keep ~120 days of app history; the coach reads this row and it shouldn't bloat.
  const keys = Object.keys(apps).sort();
  while (keys.length > 120) delete apps[keys.shift()];

  try {
    const put = await writeRow(uid + ':screen', Object.assign({}, row, { apps: apps, open: open, updatedAt: now }));
    if (!put.ok) return res.status(500).send('Could not save (' + put.status + ').');
  } catch (e) {
    return res.status(500).send('Could not save.');
  }

  return res.status(200).send(msg);
};
