// Proxies Israel Railways (rail.co.il) internal API — same endpoint their website uses.
// Defaults: ראש העין צפון (2300) → הרצליה (8600)
module.exports = async function handler(req, res) {
  const from = req.query.from || '2300';
  const to   = req.query.to   || '8600';

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
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'he-IL,he;q=0.9',
        'Referer': 'https://www.rail.co.il/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!r.ok) {
      return res.status(502).json({ ok: false, error: `Israel Railways API ${r.status}` });
    }

    const data = await r.json();
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
    return res.status(200).json({ ok: true, trains });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
