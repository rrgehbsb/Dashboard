/* Dashboard v3 — language (English / עברית). Loaded before everything else.

   The app writes its text in English; in Hebrew, this layer translates what appears on
   screen, as it appears (a MutationObserver), from the dictionary in he.js:
     • exact phrases      "Coming up"            → "בקרוב"
     • fill-in patterns    "At school {t}"        → "בבית הספר {t}"
   The blanks are typed, so a pattern only matches what it should:
     {n} {m} {k} {w} {r}   a number      {t} {u}  a time (07:45)     {b} {c}  a bus/train line
     {d} {x}               words, translated too ("Every {d}" with d = "Monday")
     {s} {name}            anything, kept exactly as it is (names, what you typed)
   Text joined with "·" is translated part by part, so "At school 07:53 · 7 min early"
   becomes two dictionary entries. Arrows flip to read right-to-left.
   Never translated: what you wrote yourself (tasks, names, subjects you typed) — anything
   inside <bdi>, translate="no" or .notranslate, and form fields' values.
   t('…', {vars}) does the same for text built in code (e.g. a toast).
   The choice is kept on this device (read before the page paints, so Hebrew opens
   right-to-left with no flash) and in the synced settings (lang). */
(function () {
'use strict';
const KEY = 'dash3:lang';
const read = () => { try { const v = localStorage.getItem(KEY); return v === 'he' || v === 'en' ? v : null; } catch (e) { return null; } };
const lang = read() || 'en';
const he = lang === 'he';
const SRC = window.I18N_HE || {};
const EXACT = new Map(), PATTERNS = [];
const missing = new Set();
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TYPE = { n: '(-?\\d[\\d.,]*)', m: '(-?\\d[\\d.,]*)', k: '(-?\\d[\\d.,]*)', w: '(-?\\d[\\d.,]*)', r: '(-?\\d[\\d.,]*)', t: '(\\d{1,2}:\\d{2})', u: '(\\d{1,2}:\\d{2})', b: '([^\\s·]+)', c: '([^\\s·]+)' };
const INNER = { d: 1, x: 1 }; // blanks whose words are translated too
Object.keys(SRC).forEach(k => {
  if (!/\{\w+\}/.test(k)) { EXACT.set(k, SRC[k]); return; }
  const names = []; let lit = 0, typed = 0;
  const body = k.split(/(\{\w+\})/).map(part => {
    const m = part.match(/^\{(\w+)\}$/);
    if (m) { names.push(m[1]); if (TYPE[m[1]]) typed++; return TYPE[m[1]] || '(.+?)'; }
    lit += part.length; return reEsc(part);
  }).join('');
  PATTERNS.push({ re: new RegExp('^' + body + '$'), names, to: SRC[k], score: lit * 10 + typed });
});
PATTERNS.sort((a, b) => b.score - a.score); // the most specific pattern wins

function fill(to, names, vals) {
  let out = to;
  names.forEach((n, i) => { const v = vals[i]; out = out.split('{' + n + '}').join(INNER[n] ? (EXACT.has(v) ? EXACT.get(v) : seg(v, true)) : v); });
  return out;
}
// one piece of text (no "·" inside)
function seg(s, inner) {
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  const core = s.trim();
  if (!core || !/[A-Za-z]/.test(core)) return s;
  const pm = core.match(/^(.*?)([.:!?…]+)$/); // keep trailing punctuation outside the lookup
  if (EXACT.has(core)) return lead + EXACT.get(core) + trail;
  if (pm && EXACT.has(pm[1])) return lead + EXACT.get(pm[1]) + pm[2] + trail;
  for (const p of PATTERNS) { const m = core.match(p.re); if (m) return lead + fill(p.to, p.names, m.slice(1)) + trail; }
  if (pm) { for (const p of PATTERNS) { const m = pm[1].match(p.re); if (m) return lead + fill(p.to, p.names, m.slice(1)) + pm[2] + trail; } }
  if (!inner && /[A-Za-z]{2,}/.test(core) && !/[֐-׿]/.test(core) && !/^[A-Z0-9 ._@:/-]+$/.test(core)) missing.add(core); // text that is already Hebrew is done
  return s;
}
// numbers read left to right inside Hebrew: "07:45–11:45", "80×8", "12 / 140" (kept together, never reversed)
const NUMX = /\d[\d.,:]*(?: ?[×·–\-/] ?\d[\d.,:]*)+/g;
const LRI = '⁦', PDI = '⁩';
const ltrNums = s => s.replace(NUMX, (m, i, all) => (all[i - 1] === LRI ? m : LRI + m + PDI));
function translate(s) {
  if (!s) return s;
  let out;
  if (!/[A-Za-z]/.test(s)) out = s;
  else if (EXACT.has(s.trim()) || s.indexOf('·') < 0) out = seg(s);
  else out = s.split(/(\s*·\s*)/).map((x, i) => (i % 2 ? x : seg(x))).join('');
  out = out.replace(/→/g, '←');
  return he ? ltrNums(out) : out;
}
function t(s, v) {
  let out = he ? translate(s) : s;
  if (v) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m));
  return out;
}

/* ---------- the page ---------- */
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const skip = el => !!(el && el.closest && el.closest('[translate="no"], .notranslate, bdi, script, style, textarea, code'));
function doNode(n) {
  if (n.nodeType === 3) {
    if (n._tr === n.nodeValue || skip(n.parentElement)) return;
    const v = translate(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
    n._tr = n.nodeValue;
    return;
  }
  if (n.nodeType !== 1 || skip(n)) return;
  ATTRS.forEach(a => { const v = n.getAttribute(a); if (v && /[A-Za-z→]/.test(v)) { const x = translate(v); if (x !== v) n.setAttribute(a, x); } });
  if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) n.value = translate(n.value);
  for (let c = n.firstChild; c; c = c.nextSibling) doNode(c);
}
function apply(root) { if (he) doNode(root || document.body); }
if (he) {
  const ob = new MutationObserver(list => {
    list.forEach(m => {
      if (m.type === 'childList') m.addedNodes.forEach(doNode);
      else if (m.type === 'characterData') doNode(m.target);
      else if (m.type === 'attributes' && !skip(m.target)) { const v = m.target.getAttribute(m.attributeName); if (v && /[A-Za-z→]/.test(v)) { const x = translate(v); if (x !== v) m.target.setAttribute(m.attributeName, x); } }
    });
  });
  const start = () => {
    apply(document.body);
    ob.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const tt = translate(document.title); if (tt !== document.title) document.title = tt;
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
}

// Choose a language: kept on this device; the caller reloads the page in it.
function set(l) { if (l === 'he' || l === 'en') { try { localStorage.setItem(KEY, l); } catch (e) {} } }

window.I18N = {
  lang, he, dir: he ? 'rtl' : 'ltr', t, apply, set, translate,
  missing: () => Array.from(missing),
  arrow: he ? '←' : '→'
};
})();
