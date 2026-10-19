// Live arrivals for bus stops and train stations (Israel).
// Source: the Ministry of Transport real-time feed (SIRI), read through the public
// curlbus.app service, which returns it as JSON. Browsers can't call it directly
// (no CORS), so the app asks this function instead.
//
// GET /api/transit?stops=32645,17094   (up to 6 stop codes; train stations use their
//                                        station code, e.g. 17094 Rosh HaAyin North)
// -> { ok, at, stops: { "<code>": [ { line, op, eta, dep, live, ageS, trip, veh, dest, lat, lon } ] } }
//    eta  = expected arrival at the stop (ISO, Israel time)
//    dep  = scheduled departure from the line's first stop (ISO) — lets the app work
//           out the scheduled time at this stop and so the delay
//    live = the vehicle is being tracked right now (has a fresh GPS position);
//           otherwise the eta is just the schedule
const MAX_STOPS = 6;
const FRESH_S = 10 * 60;

async function getStop(code) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch('https://curlbus.app/' + encodeURIComponent(code), { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) return { error: 'http ' + r.status, visits: [] };
    const j = await r.json();
    const list = (j && j.visits && (j.visits[code] || Object.values(j.visits)[0])) || [];
    const now = Date.now();
    const visits = list.map(v => {
      const rec = v.timestamp ? Date.parse(String(v.timestamp).replace(' ', 'T')) : NaN;
      const ageS = isNaN(rec) ? null : Math.round((now - rec) / 1000);
      const loc = v.location && v.location.lat ? v.location : null;
      const dest = v.static_info && v.static_info.route && v.static_info.route.destination;
      return {
        line: String(v.line_name || ''),
        op: String(v.operator_id || ''),
        eta: v.eta ? String(v.eta).replace(' ', 'T') : null,
        dep: v.departed ? String(v.departed).replace(' ', 'T') : null,
        live: !!loc && ageS != null && ageS >= 0 && ageS < FRESH_S,
        ageS,
        trip: v.trip_id || null,
        veh: v.vehicle_ref || null,
        dest: dest && dest.name ? (dest.name.HE || dest.name.EN || '') : '',
        destEn: dest && dest.name ? (dest.name.EN || '') : '',
        lat: loc ? +loc.lat : null,
        lon: loc ? +loc.lon : null
      };
    }).filter(v => v.eta);
    return { error: j && j.errors ? String(j.errors) : null, visits };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'timeout' : 'network', visits: [] };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async function handler(req, res) {
  const raw = String((req.query && req.query.stops) || '').split(',').map(s => s.trim()).filter(s => /^\d{2,6}$/.test(s));
  const codes = Array.from(new Set(raw)).slice(0, MAX_STOPS);
  if (!codes.length) return res.status(400).json({ ok: false, error: 'Give one or more stop codes: ?stops=12345,17094' });
  const results = await Promise.all(codes.map(getStop));
  const out = { ok: true, at: new Date().toISOString(), stops: {}, errors: {} };
  codes.forEach((c, i) => { out.stops[c] = results[i].visits; if (results[i].error) out.errors[c] = results[i].error; });
  if (Object.keys(out.errors).length === codes.length) out.ok = false;
  // Live data changes every ~30 s; let Vercel's edge share answers for 15 s.
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=15');
  return res.status(200).json(out);
};
