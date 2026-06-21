// Proxies Israel Railways (rail.co.il) internal API.
// Add ?debug=1 to see raw response. Add ?stations=1 to list all station IDs.
module.exports = async function handler(req, res) {
  const HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'he-IL,he;q=0.9',
    'Referer': 'https://www.rail.co.il/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Origin': 'https://www.rail.co.il',
  };

  // ?stations=1 — return full station list so we can find correct IDs
  if (req.query.stations === '1') {
    try {
      const r = await fetch('https://www.rail.co.il/apiinfo/api/Plan/GetStations', { headers: HEADERS });
      const text = await r.text();
      try {
        const data = JSON.parse(text);
        return res.status(200).json({ ok: true, stations: data });
      } catch {
        return res.status(200).json({ ok: false, raw: text.slice(0, 2000) });
      }
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  const from = req.query.from || '2300';
  const to   = req.query.to   || '8600';
  const debug = req.query.debug === '1';

  const now = new Date();
  const d  = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const y  = now.getFullYear();
  const date = `${d}${mo}${y}`;
  const hour = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');

  const url = `https://www.rail.co.il/apiinfo/api/Plan/GetRoutes` +
    `?OId=${from}&TId=${to}&Date=${date}&Hour=${hour}&Minute=${min}` +
    `&Seats=1&Children=0&toFromPicker=1&Handicap=0`;

  try {
    const r = await fetch(url, { headers: HEADERS });
    const text = await r.text();

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Israel Railways API ${r.status}`, ...(debug ? { body: text.slice(0, 1000) } : {}) });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ ok: false, error: 'Non-JSON response from Israel Railways', ...(debug ? { body: text.slice(0, 1000) } : {}) });
    }

    if (debug) {
      return res.status(200).json({ ok: true, raw: data });
    }

    const routes = data?.Data?.Routes || [];

    const trains = routes.slice(0, 6).map(route => {
      const segs = route.Train || [];
      const first = segs[0];
      const last  = segs[segs.length - 1];
      if (!first) return null;
      return {
        depart:    first.DepartureTime,
        arrive:    last?.ArrivalTime || first.ArrivalTime,
        platform:  first.Platform,
        delay:     first.Delay || 0,
        transfers: segs.length - 1,
      };
    }).filter(Boolean);

    res.setHeader('Cache-Control', 's-maxage=90, stale-while-revalidate=30');
    return res.status(200).json({ ok: true, trains, routes_found: routes.length, url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message, url });
  }
};
