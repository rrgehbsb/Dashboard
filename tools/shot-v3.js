const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const DIR = (process.env.SHOT_DIR || require('os').tmpdir()) + '/', URL = 'http://localhost:5178/v3/?demo';
(async () => {
  let b; try { b = await chromium.launch({ channel: 'chrome', headless: true }); } catch (e) { b = await chromium.launch({ headless: true }); }
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { Date.prototype._h = 1; const RealDate = Date; const fixed = new RealDate(2026, 9, 18, 16, 20).getTime(); const off = fixed - RealDate.now(); globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + off); } static now() { return RealDate.now() + off; } }; });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(URL); await p.waitForTimeout(1500);
  const ow = async t => { const r = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (r[0] > r[1]) errs.push('overflow ' + t + ' ' + r); };
  await p.screenshot({ path: DIR + 'a-light.png' }); await ow('today');
  await p.tap('#check-0'); await p.waitForTimeout(1400);
  await p.fill('#todo-input', 'Buy a notebook'); await p.press('#todo-input', 'Enter'); await p.waitForTimeout(500);
  await p.tap('#water-today'); await p.waitForTimeout(400);
  await p.evaluate(() => scrollTo(0, 500)); await p.screenshot({ path: DIR + 'b-after.png' });
  await p.tap('#older-review'); await p.waitForTimeout(500); await p.screenshot({ path: DIR + 'c-older.png' });
  await p.tap('#older-keep'); await p.waitForTimeout(500);
  await p.tap('#gear-today'); await p.waitForTimeout(500); await p.tap('#th-dark'); await p.waitForTimeout(300);
  await p.screenshot({ path: DIR + 'd-settings-dark.png' }); await p.tap('#sheet-close'); await p.waitForTimeout(400);
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: DIR + 'e-dark.png' });
  const stored = await p.evaluate(() => Object.keys(localStorage).filter(k => /dash3|dashboard:sync|po_water/.test(k)));
  if (stored.length) errs.push('DEMO WROTE STORAGE: ' + stored.join(','));
  const d = await b.newContext({ viewport: { width: 1280, height: 860 } }); const dp = await d.newPage(); dp.on('pageerror', e => errs.push('desk: ' + e.message));
  await dp.goto(URL); await dp.waitForTimeout(1200); await dp.screenshot({ path: DIR + 'f-desktop.png' });
  console.log(errs.length ? errs.join('\n') : 'NO_ERRORS'); await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
