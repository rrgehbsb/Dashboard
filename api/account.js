// Account helper for the login page. Creates accounts that are already
// confirmed, so nobody depends on a verification email (Supabase's built-in
// mailer is rate-limited and lands in spam, and on iPhone the link opens Safari
// instead of the home-screen app, so the app never got signed in).
//
// POST { action: 'signup',  email, password, name }  -> create a confirmed user
// POST { action: 'delete',  email, password }        -> delete your own account and its data
// POST { action: 'recovery_new' } + your access token -> a new recovery code (shown once)
// POST { action: 'recover', email, code, password }  -> forgot your password: the
//      recovery code sets a new one, and you get a fresh code (each code works once).
//
// Recovery codes replace "reset by email": no mail, works in the home-screen app. Only
// a salted scrypt hash of the code is kept (in the account's app_metadata, which only
// the server can change). After 8 wrong codes an account's recovery locks for an hour.
// POST { action: 'confirm', email, password }        -> unstick an older account
//      that was never confirmed. Supabase only answers "email not confirmed"
//      after the password has been checked, so the password proves ownership.
//
// Responses: { ok: true } or { ok: false, code, error } with a plain-language error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const crypto = require('crypto');
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to mix up
const MAX_FAILS = 8, LOCK_MS = 3600e3;
// 16 characters from 32 = 80 random bits, shown as XXXX-XXXX-XXXX-XXXX
function newCode() { const b = crypto.randomBytes(16); let s = ''; for (let i = 0; i < 16; i++) s += ALPHA[b[i] % 32]; return s.match(/.{4}/g).join('-'); }
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function hashCode(code, salt) { return crypto.scryptSync(normCode(code), Buffer.from(salt, 'hex'), 32).toString('hex'); }
function recoveryFor(code) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashCode(code, salt), at: new Date().toISOString(), fails: 0, lockUntil: 0 }; }
async function findUser(SB_URL, admin, email) {
  for (let page = 1; page <= 20; page++) {
    const l = await fetch(`${SB_URL}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: admin });
    if (!l.ok) return null;
    const users = ((await l.json().catch(() => ({}))).users) || [];
    const u = users.find(x => String(x.email || '').toLowerCase() === email);
    if (u) return u;
    if (users.length < 200) return null;
  }
  return null;
}

function fail(res, status, code, error) {
  return res.status(status).json({ ok: false, code, error });
}

module.exports = async function handler(req, res) {
  // Use only the origin: the env value in Vercel carries an extra path ("/rest/v1"),
  // which doubled every request path (PGRST125 "Invalid path").
  let SB_URL = String(process.env.SUPABASE_URL || '').trim();
  try { SB_URL = new URL(SB_URL).origin; } catch (e) { SB_URL = SB_URL.replace(/\/+$/, ''); }
  const SB_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!SB_URL || !SB_KEY) return fail(res, 500, 'config', 'The server is missing its settings. Try again later.');

  // GET = daily keep-alive (Vercel cron in vercel.json). Supabase's free plan pauses
  // a project after about a week without requests, which took the whole app
  // offline. One tiny read a day prevents that. (Lives here because the Hobby plan
  // allows only 12 functions.)
  if (req.method === 'GET') {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/app_state?select=key&limit=1`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
      const out = { ok: r.ok, status: r.status, at: new Date().toISOString() };
      // Non-secret hints for diagnosing a misconfigured server (never the key itself).
      if (!r.ok) {
        out.host = SB_URL.replace(/^https?:\/\//, '').split('/')[0];
        out.keyType = SB_KEY.startsWith('eyJ') ? 'jwt' : SB_KEY.startsWith('sb_secret_') ? 'sb_secret' : SB_KEY.startsWith('sb_publishable_') ? 'publishable' : 'other';
        out.detail = (await r.text().catch(() => '')).slice(0, 160);
      }
      return res.status(r.ok ? 200 : 502).json(out);
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

  const admin = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };
  const getUser = async id => { const r = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { headers: admin }); return r.ok ? r.json() : null; };
  const setUser = (id, fields) => fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'PUT', headers: admin, body: JSON.stringify(fields) });

  if (action === 'recovery_new') {
    try {
      const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const me = tok ? await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } }).then(r => (r.ok ? r.json() : null)) : null;
      if (!me || !me.id) return fail(res, 401, 'signed_out', 'Sign in again, then make your code.');
      const user = await getUser(me.id);
      if (!user) return fail(res, 502, 'failed', 'Couldn’t make a code right now. Try again in a minute.');
      const code = newCode();
      const u = await setUser(me.id, { app_metadata: Object.assign({}, user.app_metadata, { recovery: recoveryFor(code) }) });
      if (!u.ok) return fail(res, 502, 'failed', 'Couldn’t make a code right now. Try again in a minute.');
      return res.status(200).json({ ok: true, code });
    } catch (e) { return fail(res, 502, 'network', 'Couldn’t reach the account server. Try again in a minute.'); }
  }

  if (!EMAIL_RE.test(email) || email.length > 200) return fail(res, 400, 'bad_email', 'That doesn’t look like an email address.');
  if (password.length < 6) return fail(res, 400, 'short_password', 'Use a password with at least 6 characters.');
  if (password.length > 72) return fail(res, 400, 'long_password', 'That password is too long. Keep it under 72 characters.');

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

    if (action === 'recover') {
      const nope = () => fail(res, 401, 'wrong_code', 'That email and recovery code don’t match.');
      if (normCode(body.code).length !== 16) return nope();
      const user = await findUser(SB_URL, admin, email);
      const rec = user && user.app_metadata && user.app_metadata.recovery;
      if (!rec || !rec.salt || !rec.hash) return nope();
      if (rec.lockUntil && Date.now() < rec.lockUntil) return fail(res, 429, 'locked', 'Too many wrong codes. Try again in an hour.');
      const good = crypto.timingSafeEqual(Buffer.from(hashCode(body.code, rec.salt), 'hex'), Buffer.from(rec.hash, 'hex'));
      if (!good) {
        const fails = (rec.fails || 0) + 1;
        await setUser(user.id, { app_metadata: Object.assign({}, user.app_metadata, { recovery: Object.assign({}, rec, { fails, lockUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 }) }) });
        return nope();
      }
      // the code is used up: set the new password and hand out a fresh code
      const code = newCode();
      const u = await setUser(user.id, { password, email_confirm: true, app_metadata: Object.assign({}, user.app_metadata, { recovery: recoveryFor(code) }) });
      if (!u.ok) {
        const j = await u.json().catch(() => ({}));
        if (j.error_code === 'weak_password' || /password/i.test(String(j.msg || j.message || ''))) return fail(res, 400, 'weak_password', 'Pick a stronger password: at least 6 characters, not something common.');
        return fail(res, 502, 'failed', 'Couldn’t set the new password right now. Try again in a minute.');
      }
      return res.status(200).json({ ok: true, code });
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
      const user = await findUser(SB_URL, admin, email);
      if (!user) return fail(res, 404, 'not_found', 'Couldn’t find that account. Try creating it again.');
      const u = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
        method: 'PUT',
        headers: admin,
        body: JSON.stringify({ email_confirm: true }),
      });
      if (!u.ok) return fail(res, 502, 'confirm_failed', 'Couldn’t fix the account right now. Try again in a minute.');
      return res.status(200).json({ ok: true });
    }

    if (action === 'delete') {
      // Delete your own account and everything saved in it. The password is checked
      // first, so only the owner can do this.
      const t = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!t.ok) return fail(res, 401, 'wrong', 'That email and password don’t match.');
      const tj = await t.json().catch(() => ({}));
      const id = tj.user && tj.user.id;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail(res, 502, 'delete_failed', 'Couldn’t delete the account right now.');
      await fetch(`${SB_URL}/rest/v1/app_state?key=like.${id}:*`, { method: 'DELETE', headers: admin });
      const d = await fetch(`${SB_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: admin }); // friends, trips, … go with it
      if (!d.ok) return fail(res, 502, 'delete_failed', 'Couldn’t delete the account right now.');
      return res.status(200).json({ ok: true });
    }

    return fail(res, 400, 'bad_action', 'Unknown action.');
  } catch (e) {
    console.warn('[account] error', e);
    return fail(res, 502, 'network', 'Couldn’t reach the account server. Try again in a minute.');
  }
};
