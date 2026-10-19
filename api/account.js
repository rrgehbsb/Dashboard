// Account helper for the login page. Creates accounts that are already
// confirmed, so nobody depends on a verification email (Supabase's built-in
// mailer is rate-limited and lands in spam, and on iPhone the link opens Safari
// instead of the home-screen app, so the app never got signed in).
//
// POST { action: 'signup',  email, password, name }  -> create a confirmed user
// POST { action: 'confirm', email, password }        -> unstick an older account
//      that was never confirmed. Supabase only answers "email not confirmed"
//      after the password has been checked, so the password proves ownership.
//
// Responses: { ok: true } or { ok: false, code, error } with a plain-language error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(res, status, code, error) {
  return res.status(status).json({ ok: false, code, error });
}

module.exports = async function handler(req, res) {
  const SB_URL = process.env.SUPABASE_URL;
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SB_KEY) return fail(res, 500, 'config', 'The server is missing its settings. Try again later.');

  // GET = daily keep-alive (Vercel cron in vercel.json). Supabase's free plan pauses
  // a project after about a week without requests, which took the whole app
  // offline. One tiny read a day prevents that. (Lives here because the Hobby plan
  // allows only 12 functions.)
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/app_state?select=key&limit=1`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
    } catch (e) {
      return res.status(502).json({ ok: false, error: String((e && e.message) || e) });
    }
  }
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const action = body.action;
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim().slice(0, 40);

  if (!EMAIL_RE.test(email) || email.length > 200) return fail(res, 400, 'bad_email', 'That doesn’t look like an email address.');
  if (password.length < 6) return fail(res, 400, 'short_password', 'Use a password with at least 6 characters.');
  if (password.length > 72) return fail(res, 400, 'long_password', 'That password is too long. Keep it under 72 characters.');

  const admin = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (action === 'signup') {
      const r = await fetch(`${SB_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: admin,
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: name ? { name } : {} }),
      });
      if (r.ok) return res.status(200).json({ ok: true });
      const j = await r.json().catch(() => ({}));
      const msg = String(j.msg || j.message || j.error_description || j.error || '');
      if (j.error_code === 'email_exists' || /already (been )?registered|already exists/i.test(msg)) {
        return fail(res, 409, 'exists', 'There’s already an account with that email. Sign in instead.');
      }
      if (j.error_code === 'weak_password' || /password/i.test(msg)) {
        return fail(res, 400, 'weak_password', 'Pick a stronger password: at least 6 characters, not something common.');
      }
      console.warn('[account] signup failed', r.status, msg);
      return fail(res, 502, 'signup_failed', 'Couldn’t create the account right now. Try again in a minute.');
    }

    if (action === 'confirm') {
      const t = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (t.ok) return res.status(200).json({ ok: true, already: true });
      const tj = await t.json().catch(() => ({}));
      const tmsg = String(tj.msg || tj.error_description || tj.message || '');
      if (!(tj.error_code === 'email_not_confirmed' || /not confirmed/i.test(tmsg))) {
        return fail(res, 401, 'wrong', 'That email and password don’t match.');
      }
      // Password is correct; find the user and mark the email confirmed.
      let user = null;
      for (let page = 1; page <= 20 && !user; page++) {
        const l = await fetch(`${SB_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: admin });
        if (!l.ok) break;
        const lj = await l.json().catch(() => ({}));
        const users = lj.users || [];
        user = users.find(u => String(u.email || '').toLowerCase() === email) || null;
        if (users.length < 200) break;
      }
      if (!user) return fail(res, 404, 'not_found', 'Couldn’t find that account. Try creating it again.');
      const u = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: admin,
        body: JSON.stringify({ email_confirm: true }),
      });
      if (!u.ok) return fail(res, 502, 'confirm_failed', 'Couldn’t fix the account right now. Try again in a minute.');
      return res.status(200).json({ ok: true });
    }

    return fail(res, 400, 'bad_action', 'Unknown action.');
  } catch (e) {
    console.warn('[account] error', e);
    return fail(res, 502, 'network', 'Couldn’t reach the account server. Try again in a minute.');
  }
};
