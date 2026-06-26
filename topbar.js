// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS, reads progress from localStorage,
// and renders the water +1 button in the top bar plus the
// Main/Health/Fitness bottom tabs. Skips chrome on finance.html
// and inside iframes (so the water tracker can embed cleanly).
// =============================================================
const DASHBOARD_VERSION = '1.3.3';

// Apply saved theme before anything renders (prevents flash)
(function() {
  try {
    var _s = JSON.parse(localStorage.getItem('dashboard:settings:v1') || '{}');
    var _dark = _s.theme !== 'light';
    document.documentElement.setAttribute('data-theme', _dark ? 'dark' : 'light');
    var _acMap = {purple:{d:'#a78bfa',l:'#7c3aed'},blue:{d:'#60a5fa',l:'#2563eb'},green:{d:'#34d399',l:'#059669'},orange:{d:'#fb923c',l:'#ea580c'},pink:{d:'#f472b6',l:'#db2777'},red:{d:'#f87171',l:'#dc2626'},yellow:{d:'#fbbf24',l:'#d97706'},teal:{d:'#2dd4bf',l:'#0d9488'}};
    var _ac = _acMap[_s.accent || 'purple'] || _acMap.purple;
    var _accentVal = _dark ? _ac.d : _ac.l;

    // ---- Anime skin (One Piece / Blue Lock) ----
    var _skin = _s.skin || 'none';
    document.documentElement.setAttribute('data-skin', _skin);
    if (_skin === 'onepiece' || _skin === 'bluelock') {
      _accentVal = (_skin === 'onepiece') ? '#F4A91F' : '#1FA2FF';
      // Themed display font (One Piece = comic Bangers, Blue Lock = techy Orbitron)
      var _fontHref = (_skin === 'onepiece')
        ? 'https://fonts.googleapis.com/css2?family=Bangers&display=swap'
        : 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap';
      var _fl = document.createElement('link');
      _fl.rel = 'stylesheet'; _fl.href = _fontHref; _fl.id = 'skin-font';
      (document.head || document.documentElement).appendChild(_fl);
      // Themed background: subtle motif pattern layered over a signature gradient
      var _pat = (_skin === 'onepiece')
        ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%23F4A91F' stroke-width='2' stroke-linecap='round' opacity='0.05'%3E%3Cpath d='M20 20 L28 28 M28 20 L20 28'/%3E%3Cpath d='M44 44 L52 52 M52 44 L44 52'/%3E%3C/g%3E%3C/svg%3E\")"
        : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64'%3E%3Cg fill='none' stroke='%231FA2FF' stroke-width='1.5' opacity='0.06'%3E%3Cpolygon points='28,2 52,16 52,44 28,58 4,44 4,16'/%3E%3C/g%3E%3C/svg%3E\")";
      var _grad = _dark
        ? (_skin === 'onepiece'
            ? 'radial-gradient(ellipse 95% 55% at 50% -10%, #2a1206 0%, #0a0a0b 58%)'
            : 'radial-gradient(ellipse 95% 55% at 50% -10%, #04203f 0%, #06080d 58%)')
        : (_skin === 'onepiece'
            ? 'linear-gradient(180deg, #fff3e0 0%, #f2f2f7 42%)'
            : 'linear-gradient(180deg, #e2f1ff 0%, #f2f2f7 42%)');
      var _se = document.createElement('style');
      _se.id = 'skin-early';
      _se.textContent = 'body{background:' + _pat + ' , ' + _grad + ' !important; background-attachment:fixed, fixed !important;}';
      (document.head || document.documentElement).appendChild(_se);
    }

    document.documentElement.style.setProperty('--accent', _accentVal);
    document.documentElement.style.setProperty('--card-radius', {sharp:'6px',rounded:'14px',pill:'24px'}[_s.cardStyle||'rounded']||'14px');
    document.documentElement.style.setProperty('--base-font', {small:'13px',medium:'15px',large:'17px'}[_s.fontSize||'medium']||'15px');
  } catch(e) {}
})();

(function () {
  'use strict';

  // -------- Supabase config (replace with your own project URL + publishable key) --------
  const TOPBAR_SUPABASE_URL = 'https://mtuoqwbrujxutofhyahb.supabase.co';
  const TOPBAR_SUPABASE_KEY = 'sb_publishable_tYgBycEksvhfB-2sBenWHA_dLTeVO9F';

  // -------- Anime skins: nav emojis + rotating character banner --------
  const SKINS = {
    onepiece: {
      mark: '🏴‍☠️',
      label: 'WANTED · DEAD OR ALIVE',
      nav: { main:'🏴‍☠️', health:'🍖', fitness:'👊', school:'🗺️', habits:'☀️', transport:'⚓', projects:'💰', settings:'🧭' },
      chars: [
        { emoji:'👒', name:'Monkey D. Luffy', quote:"I'm gonna be King of the Pirates!" },
        { emoji:'⚔️', name:'Roronoa Zoro', quote:"Nothing happened." },
        { emoji:'🦵', name:'Sanji', quote:"A man who makes a woman cry isn't worth a damn." },
        { emoji:'🍊', name:'Nami', quote:"I want to draw a map of the entire world!" },
        { emoji:'🎯', name:'Usopp', quote:"I'm a brave warrior of the sea!" },
        { emoji:'🩺', name:'Chopper', quote:"Being alone hurts more than any wound." },
        { emoji:'📖', name:'Nico Robin', quote:"I want to live! Take me out to sea with you!" },
        { emoji:'🔥', name:'Portgas D. Ace', quote:"Thank you... for loving me." },
        { emoji:'🌅', name:'Gol D. Roger', quote:"My treasure? It's all right where I left it." },
      ],
    },
    bluelock: {
      mark: '⚽',
      label: 'BLUE LOCK · EGOIST No.',
      nav: { main:'⚽', health:'🧬', fitness:'⚡', school:'🧠', habits:'🔥', transport:'👟', projects:'🏆', settings:'⚙️' },
      chars: [
        { emoji:'⚽', name:'Yoichi Isagi', quote:"I'll devour every last one of you." },
        { emoji:'💙', name:'Meguru Bachira', quote:"My monster is finally dancing." },
        { emoji:'❄️', name:'Rin Itoshi', quote:"I'll crush everything in my path." },
        { emoji:'🎮', name:'Seishiro Nagi', quote:"This is such a pain... but fine." },
        { emoji:'🦊', name:'Reo Mikage', quote:"I always get exactly what I want." },
        { emoji:'👑', name:'Shoei Baro', quote:"I am the protagonist of this field." },
        { emoji:'⚡', name:'Rensuke Kunigami', quote:"Hard work will never betray me." },
        { emoji:'🐉', name:'Jinpachi Ego', quote:"Forget teamwork. Awaken your ego." },
        { emoji:'🏆', name:'Sae Itoshi', quote:"Mediocrity is the real sin." },
      ],
    },
  };
  function getSkin() {
    try { return (JSON.parse(localStorage.getItem('dashboard:settings:v1') || '{}').skin) || 'none'; }
    catch (e) { return 'none'; }
  }

  // -------- CSS --------
  const css = `
.topbar {
  position: sticky; top: 0; z-index: 40;
  display: flex; justify-content: flex-end; align-items: center;
  gap: 8px;
  padding: max(10px, env(safe-area-inset-top)) 14px 8px;
  background: #0a0a0b;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.topbar-water-wrap { display: flex; align-items: stretch; }
.topbar-water-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px;
  background: rgba(125, 211, 252, 0.08);
  border: 1px solid rgba(125, 211, 252, 0.16);
  border-right: none;
  border-radius: 12px 0 0 12px;
  text-decoration: none; color: #FAFAFA;
  -webkit-tap-highlight-color: transparent;
}
.topbar-water-pill .topbar-pill-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #7DD3FC; flex-shrink: 0;
}
.topbar-water-pill.warn .topbar-pill-dot { background: #fbbf24; }
.topbar-water-pill.miss .topbar-pill-dot {
  background: #ff8a8a;
  animation: topbar-miss-pulse 1.6s ease-in-out infinite;
}
@keyframes topbar-miss-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
  50%      { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0); }
}
.topbar-pill-count {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px; font-weight: 700; color: #FAFAFA;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.topbar-water-add {
  width: 44px;
  border: 1px solid rgba(125, 211, 252, 0.16);
  background: linear-gradient(180deg, rgba(125, 211, 252, 0.28), rgba(110, 231, 183, 0.28));
  color: #FFFFFF; font-family: inherit;
  font-size: 20px; font-weight: 700; line-height: 1;
  cursor: pointer; border-radius: 0 12px 12px 0;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, transform 0.10s;
}
.topbar-water-add:active { transform: scale(0.94); }
.topbar-water-add.flash {
  background: linear-gradient(180deg, rgba(125, 211, 252, 0.7), rgba(110, 231, 183, 0.7));
}
.topbar-finance-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px; text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}
.topbar-finance-btn:hover { background: rgba(255, 255, 255, 0.08); }
.topbar-finance-icon {
  font-size: 20px; line-height: 1;
  filter: grayscale(100%) brightness(1.4); opacity: 0.85;
}
.bottombar {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
  display: flex; justify-content: space-around; align-items: stretch;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  background: #0a0a0b;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
}
.bottombar-tab {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; padding: 6px 0 4px; text-decoration: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  -webkit-tap-highlight-color: transparent; transition: color 0.15s;
}
.bottombar-tab-icon {
  font-size: 24px; line-height: 1;
  filter: grayscale(100%) brightness(1.2); opacity: 0.55;
  transition: opacity 0.15s, filter 0.15s, transform 0.10s;
}
.bottombar-tab.active { color: #FAFAFA; }
.bottombar-tab.active .bottombar-tab-icon {
  filter: grayscale(100%) brightness(1.6); opacity: 1;
}
.bottombar-tab:active .bottombar-tab-icon { transform: scale(0.92); }
body.has-bottombar {
  padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important;
}
@media (max-width: 480px) {
  .topbar { padding-left: 10px; padding-right: 10px; gap: 6px; }
  .topbar-water-pill { padding: 8px 11px; gap: 6px; }
  .topbar-pill-count { font-size: 12px; }
  .topbar-water-add { width: 40px; font-size: 18px; }
  .topbar-finance-btn { width: 40px; height: 38px; }
  .topbar-finance-icon { font-size: 18px; }
  .bottombar-tab-icon { font-size: 20px; }
  .bottombar-tab { font-size: 9px; gap: 2px; padding: 5px 0 3px; }
}
@media (max-width: 360px) {
  .bottombar-tab-icon { font-size: 18px; }
  .bottombar-tab { font-size: 8px; }
}
html, body { -webkit-text-size-adjust: 100%; }
@media (max-width: 768px) {
  html { touch-action: pan-y; }
  ::-webkit-scrollbar { width: 0; height: 0; display: none; }
  html, body { scrollbar-width: none; -ms-overflow-style: none; }
}
.modal-bg, .modal, .po-modal-bg, .po-modal, .wt-overlay, .wt-viewer {
  overscroll-behavior: contain;
}
body.topbar-modal-open { overflow: hidden; touch-action: none; }
@media (max-width: 480px) {
  .modal-bg, .po-modal-bg {
    padding: 0 !important;
    align-items: stretch !important;
    justify-content: stretch !important;
  }
  .modal, .po-modal {
    width: 100% !important; max-width: 100% !important;
    max-height: 100vh !important; height: 100vh !important;
    border-radius: 0 !important;
    padding-top: max(20px, env(safe-area-inset-top)) !important;
    padding-bottom: max(28px, env(safe-area-inset-bottom)) !important;
    overflow-y: auto !important; overscroll-behavior: contain;
  }
}

/* ===== GLOBAL POLISH ===== */

/* Section cards — consistent radius from settings + breathing room */
.section {
  border-radius: var(--card-radius, 14px) !important;
  padding: 18px 18px 20px !important;
  margin-bottom: 14px;
}

/* Section titles — same look on every page */
.section-title {
  font-size: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
  color: rgba(255,255,255,0.35) !important;
  margin-bottom: 16px !important;
  padding-bottom: 11px !important;
  border-bottom: 1px solid rgba(255,255,255,0.07) !important;
  display: block !important;
}
html[data-theme="light"] .section-title {
  color: rgba(0,0,0,0.35) !important;
  border-bottom-color: rgba(0,0,0,0.07) !important;
}

/* Cards — more internal breathing room, consistent radius */
.gm-card, .hb-card, .hb-header-card, .fin-card, .sch-card, .hth-card, .dash-mini-card, .pom-card {
  border-radius: calc(var(--card-radius, 14px) - 2px) !important;
}
.gm-card { padding: 16px !important; margin-bottom: 10px; }
.hth-card { padding: 16px !important; margin-bottom: 10px; }
.sch-card { padding: 16px !important; margin-bottom: 10px; }

/* Font size from settings */
body { font-size: var(--base-font, 15px); }

/* ===== THEME SYSTEM ===== */
:root { --accent: #a78bfa; --card-radius: 14px; --base-font: 15px; }
.topbar-version {
  font-size: 10px; color: rgba(255,255,255,0.22); font-family: monospace; margin-right: auto;
  transition: color 0.25s;
}
html[data-theme="light"] .topbar-version { color: rgba(0,0,0,0.28); }
.topbar-settings-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 44px; height: 42px;
  border: 1px solid rgba(255,255,255,0.10);
  background: rgba(255,255,255,0.04);
  border-radius: 12px; text-decoration: none; font-size: 18px;
  -webkit-tap-highlight-color: transparent; transition: background 0.15s, border-color 0.25s;
}
.topbar-settings-btn:hover { background: rgba(255,255,255,0.09); }
html[data-theme="light"] .topbar-settings-btn {
  border-color: rgba(0,0,0,0.1); background: rgba(0,0,0,0.04);
}
html[data-theme="light"] .topbar-settings-btn:hover { background: rgba(0,0,0,0.08); }

/* Smooth theme transitions */
body { transition: background-color 0.25s, color 0.25s; }
.topbar { transition: background-color 0.25s, border-color 0.25s; }
.bottombar { transition: background-color 0.25s, border-color 0.25s; }
.bottombar-tab { transition: color 0.15s; }
.section, .gm-card, .hb-card, .hb-header-card, .fin-card, .sch-card, .hth-card, .dash-mini-card, .pom-card, .kn-col, .sum-stat {
  transition: background-color 0.25s, border-color 0.25s, color 0.25s;
}

/* Light mode overrides */
html[data-theme="light"] body { background: #f2f2f7 !important; color: #1a1a1a !important; }
html[data-theme="light"] .topbar { background: rgba(242,242,247,0.97) !important; border-bottom-color: rgba(0,0,0,0.09) !important; }
html[data-theme="light"] .bottombar { background: rgba(242,242,247,0.97) !important; border-top-color: rgba(0,0,0,0.09) !important; }
html[data-theme="light"] .bottombar-tab { color: rgba(0,0,0,0.36) !important; }
html[data-theme="light"] .bottombar-tab.active { color: #111 !important; }
html[data-theme="light"] .topbar-water-pill { color: #111 !important; background: rgba(125,211,252,0.13) !important; border-color: rgba(125,211,252,0.28) !important; }
html[data-theme="light"] .topbar-finance-btn { border-color: rgba(0,0,0,0.1) !important; background: rgba(0,0,0,0.04) !important; }
html[data-theme="light"] .section { background: rgba(255,255,255,0.82) !important; border-color: rgba(0,0,0,0.08) !important; }
html[data-theme="light"] .section-title { color: #111 !important; }
html[data-theme="light"] .gm-card,
html[data-theme="light"] .hb-card,
html[data-theme="light"] .hb-header-card,
html[data-theme="light"] .fin-card,
html[data-theme="light"] .sch-card,
html[data-theme="light"] .hth-card,
html[data-theme="light"] .dash-mini-card,
html[data-theme="light"] .pom-card,
html[data-theme="light"] .kn-col,
html[data-theme="light"] .sum-stat { background: rgba(255,255,255,0.9) !important; border-color: rgba(0,0,0,0.08) !important; color: #111 !important; }
html[data-theme="light"] input:not([type=range]):not([type=checkbox]):not([type=radio]),
html[data-theme="light"] textarea,
html[data-theme="light"] select { background: rgba(0,0,0,0.05) !important; border-color: rgba(0,0,0,0.11) !important; color: #111 !important; }
html[data-theme="light"] .dm-eyebrow,
html[data-theme="light"] .dm-sub { color: rgba(0,0,0,0.42) !important; }
html[data-theme="light"] .dm-value { color: #111 !important; }

/* ===== ANIME SKINS (One Piece / Blue Lock) ===== */

/* Character banner */
.skin-banner { display: none; }
html[data-skin="onepiece"] .skin-banner,
html[data-skin="bluelock"] .skin-banner {
  display: flex; align-items: center; gap: 13px;
  padding: 11px 15px; position: relative; overflow: hidden;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  z-index: 30;
}
html[data-skin="onepiece"] .skin-banner {
  background: linear-gradient(100deg, rgba(230,57,70,0.18), rgba(244,169,31,0.10) 58%, transparent);
}
html[data-skin="bluelock"] .skin-banner {
  background: linear-gradient(100deg, rgba(31,162,255,0.20), rgba(0,229,255,0.10) 58%, transparent);
}
.skin-banner::after {
  content: ''; position: absolute; top: 0; bottom: 0; width: 38%; left: -60%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
  animation: skin-shimmer 5s ease-in-out infinite; pointer-events: none;
}
@keyframes skin-shimmer { 0% { left: -60%; } 55%, 100% { left: 135%; } }
.skin-banner-emoji {
  font-size: 31px; line-height: 1; flex-shrink: 0;
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.55));
  transition: transform 0.32s cubic-bezier(.34,1.56,.64,1), opacity 0.32s;
}
.skin-banner-text { flex: 1; min-width: 0; }
.skin-banner-name {
  font-size: 11px; font-weight: 800; letter-spacing: 0.13em;
  color: var(--accent); text-transform: uppercase; margin-bottom: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 0.32s;
}
.skin-banner-quote {
  font-size: 12.5px; font-style: italic; color: rgba(255,255,255,0.74);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 0.32s;
}
html[data-theme="light"] .skin-banner-quote { color: rgba(0,0,0,0.62); }
.skin-banner-mark { font-size: 23px; opacity: 0.55; flex-shrink: 0; }
.skin-banner.swap .skin-banner-emoji { transform: scale(0.3) rotate(-14deg); opacity: 0; }
.skin-banner.swap .skin-banner-name,
.skin-banner.swap .skin-banner-quote { opacity: 0; }

/* Themed structural chrome */
html[data-skin="onepiece"] .section-title,
html[data-skin="bluelock"] .section-title { color: var(--accent) !important; }
html[data-skin="onepiece"] .section { border-color: rgba(244,169,31,0.16) !important; }
html[data-skin="bluelock"] .section { border-color: rgba(31,162,255,0.18) !important; }
html[data-skin="onepiece"] .topbar,
html[data-skin="onepiece"] .bottombar { background: rgba(15,7,3,0.94) !important; border-color: rgba(244,169,31,0.16) !important; }
html[data-skin="bluelock"] .topbar,
html[data-skin="bluelock"] .bottombar { background: rgba(3,11,22,0.94) !important; border-color: rgba(31,162,255,0.18) !important; }
html[data-skin="onepiece"] .bottombar-tab.active,
html[data-skin="bluelock"] .bottombar-tab.active { color: var(--accent) !important; }
/* Themed emojis show in full color (no grayscale) */
html[data-skin="onepiece"] .bottombar-tab-icon,
html[data-skin="bluelock"] .bottombar-tab-icon { filter: none !important; opacity: 0.72 !important; }
html[data-skin="onepiece"] .bottombar-tab.active .bottombar-tab-icon,
html[data-skin="bluelock"] .bottombar-tab.active .bottombar-tab-icon {
  filter: none !important; opacity: 1 !important; transform: scale(1.06);
}
html[data-skin="onepiece"] .topbar-settings-btn,
html[data-skin="bluelock"] .topbar-settings-btn { border-color: var(--accent) !important; }
html[data-skin="onepiece"] .topbar-version,
html[data-skin="bluelock"] .topbar-version { color: var(--accent) !important; opacity: 0.5; }

/* Themed display fonts on headings */
html[data-skin="onepiece"] .section-title,
html[data-skin="onepiece"] .skin-banner-name,
html[data-skin="onepiece"] .st-title,
html[data-skin="onepiece"] .skin-splash-tag {
  font-family: 'Bangers', -apple-system, BlinkMacSystemFont, sans-serif !important;
  text-transform: none !important;
}
html[data-skin="onepiece"] .section-title { font-size: 15px !important; letter-spacing: 1.4px !important; }
html[data-skin="onepiece"] .skin-banner-name { font-size: 14px !important; letter-spacing: 1px !important; }
html[data-skin="bluelock"] .section-title,
html[data-skin="bluelock"] .skin-banner-name,
html[data-skin="bluelock"] .st-title,
html[data-skin="bluelock"] .skin-splash-tag {
  font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, sans-serif !important;
  font-weight: 900 !important;
}
html[data-skin="bluelock"] .section-title { letter-spacing: 0.16em !important; }

/* Themed water pill */
html[data-skin="onepiece"] .topbar-water-pill { background: rgba(244,169,31,0.10) !important; border-color: rgba(244,169,31,0.30) !important; }
html[data-skin="onepiece"] .topbar-water-pill .topbar-pill-dot { background: #F4A91F !important; }
html[data-skin="onepiece"] .topbar-water-add { background: linear-gradient(180deg, rgba(244,169,31,0.55), rgba(230,57,70,0.55)) !important; border-color: rgba(244,169,31,0.30) !important; }
html[data-skin="bluelock"] .topbar-water-pill { background: rgba(31,162,255,0.12) !important; border-color: rgba(31,162,255,0.32) !important; }
html[data-skin="bluelock"] .topbar-water-pill .topbar-pill-dot { background: #1FA2FF !important; }
html[data-skin="bluelock"] .topbar-water-add { background: linear-gradient(180deg, rgba(31,162,255,0.55), rgba(0,229,255,0.55)) !important; border-color: rgba(31,162,255,0.32) !important; }

/* Active bottom-tab glow indicator */
html[data-skin="onepiece"] .bottombar-tab,
html[data-skin="bluelock"] .bottombar-tab { position: relative; }
html[data-skin="onepiece"] .bottombar-tab.active::before,
html[data-skin="bluelock"] .bottombar-tab.active::before {
  content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 22px; height: 3px; border-radius: 0 0 3px 3px;
  background: var(--accent); box-shadow: 0 0 9px var(--accent);
}

/* Themed text selection */
html[data-skin="onepiece"] ::selection,
html[data-skin="bluelock"] ::selection { background: var(--accent); color: #0a0a0b; }

/* ===== Skin switch splash ===== */
.skin-splash {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.28s ease; pointer-events: none;
}
.skin-splash.show { opacity: 1; }
.skin-splash[data-skin-splash="onepiece"] { background: radial-gradient(circle at 50% 45%, rgba(244,169,31,0.22), rgba(10,6,2,0.96) 62%); }
.skin-splash[data-skin-splash="bluelock"] { background: radial-gradient(circle at 50% 45%, rgba(31,162,255,0.22), rgba(2,8,16,0.96) 62%); }
.skin-splash-mark {
  font-size: 92px; line-height: 1; text-align: center;
  transform: scale(0.35); opacity: 0;
  animation: splash-pop 0.6s cubic-bezier(.34,1.56,.64,1) forwards;
  filter: drop-shadow(0 8px 22px rgba(0,0,0,0.6));
}
.skin-splash-tag {
  margin-top: 16px; font-size: 19px; font-weight: 900;
  letter-spacing: 0.28em; color: var(--accent); text-align: center;
  text-transform: uppercase; opacity: 0;
  animation: splash-tag 0.6s ease 0.18s forwards; padding: 0 24px;
}
@keyframes splash-pop { to { transform: scale(1); opacity: 1; } }
@keyframes splash-tag { from { opacity: 0; letter-spacing: 0.5em; } to { opacity: 1; letter-spacing: 0.24em; } }

/* ===== STYLISH TEXT & IDENTITY ===== */

/* Gradient-filled, glowing section titles */
html[data-skin="onepiece"] .section-title {
  background: linear-gradient(90deg, #F4A91F, #E63946) !important;
  -webkit-background-clip: text !important; background-clip: text !important;
  -webkit-text-fill-color: transparent !important; color: transparent !important;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.35));
  border-bottom-color: rgba(244,169,31,0.32) !important;
}
html[data-skin="bluelock"] .section-title {
  background: linear-gradient(90deg, #1FA2FF, #00E5FF) !important;
  -webkit-background-clip: text !important; background-clip: text !important;
  -webkit-text-fill-color: transparent !important; color: transparent !important;
  filter: drop-shadow(0 0 7px rgba(31,162,255,0.5));
  border-bottom-color: rgba(31,162,255,0.32) !important;
}

/* Banner: poster (One Piece) vs neon HUD (Blue Lock) */
.skin-banner-label {
  font-size: 9px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent); opacity: 0.85; margin-bottom: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
html[data-skin="onepiece"] .skin-banner {
  border: 2px solid rgba(244,169,31,0.45); border-radius: 4px;
  margin: 6px 10px; box-shadow: inset 0 0 0 1px rgba(230,57,70,0.25), 0 4px 14px -8px rgba(244,169,31,0.6);
  background: linear-gradient(100deg, rgba(244,169,31,0.14), rgba(230,57,70,0.10) 60%, rgba(0,0,0,0));
}
html[data-skin="bluelock"] .skin-banner {
  margin: 6px 10px; border: 1px solid rgba(31,162,255,0.4);
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 13px), calc(100% - 13px) 100%, 0 100%);
  box-shadow: inset 0 0 18px rgba(31,162,255,0.12), 0 0 16px -4px rgba(31,162,255,0.5);
}
/* Animated shimmering character name (gradient text) */
.skin-banner-name {
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent !important;
  animation: skin-name-shine 4.5s linear infinite;
}
html[data-skin="onepiece"] .skin-banner-name { background-image: linear-gradient(90deg, #F4A91F, #ffe6a0, #E63946, #F4A91F); }
html[data-skin="bluelock"] .skin-banner-name {
  background-image: linear-gradient(90deg, #1FA2FF, #aef0ff, #00E5FF, #1FA2FF);
  filter: drop-shadow(0 0 6px rgba(31,162,255,0.55));
}
@keyframes skin-name-shine { to { background-position: 200% center; } }

/* Themed card edges */
html[data-skin="onepiece"] .section { box-shadow: inset 0 2px 0 rgba(244,169,31,0.4); }
html[data-skin="bluelock"] .section {
  box-shadow: inset 0 0 0 1px rgba(31,162,255,0.14), 0 0 20px -10px rgba(31,162,255,0.5);
}

/* Glowing accent action buttons (settings save, etc.) */
html[data-skin="onepiece"] #saveBtn,
html[data-skin="bluelock"] #saveBtn {
  box-shadow: 0 8px 22px -8px var(--accent); letter-spacing: 0.05em; font-weight: 800;
}
html[data-skin="bluelock"] #saveBtn { text-shadow: 0 0 10px rgba(0,0,0,0.3); }

/* Active bottom-tab label glow (Blue Lock neon) */
html[data-skin="bluelock"] .bottombar-tab.active span:last-child { text-shadow: 0 0 8px var(--accent); }
html[data-skin="onepiece"] .bottombar-tab.active span:last-child { text-shadow: 0 1px 4px rgba(244,169,31,0.6); }

/* Splash tag uses gradient text too */
html[data-skin="onepiece"] .skin-splash-tag {
  background: linear-gradient(90deg, #F4A91F, #ffe6a0, #E63946);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
}
html[data-skin="bluelock"] .skin-splash-tag {
  background: linear-gradient(90deg, #1FA2FF, #aef0ff, #00E5FF);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  filter: drop-shadow(0 0 10px rgba(31,162,255,0.6));
}

/* ===== MOTION & MICRO-INTERACTIONS ===== */

/* Active tab: flame flicker (One Piece) / electric pulse (Blue Lock) */
html[data-skin="onepiece"] .bottombar-tab.active .bottombar-tab-icon {
  animation: skin-flicker 1.5s ease-in-out infinite;
}
@keyframes skin-flicker {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(244,169,31,0.7)); transform: scale(1.07) rotate(-2deg); }
  50%      { filter: drop-shadow(0 0 9px rgba(244,169,31,0.95)); transform: scale(1.13) rotate(2deg); }
}
html[data-skin="bluelock"] .bottombar-tab.active .bottombar-tab-icon {
  animation: skin-pulse 1.5s ease-in-out infinite;
}
@keyframes skin-pulse {
  0%, 100% { filter: drop-shadow(0 0 3px var(--accent)); transform: scale(1.06); }
  50%      { filter: drop-shadow(0 0 11px var(--accent)); transform: scale(1.12); }
}

/* Banner mark gently bobs */
html[data-skin="onepiece"] .skin-banner-mark,
html[data-skin="bluelock"] .skin-banner-mark { animation: skin-mark-bob 3.2s ease-in-out infinite; }
@keyframes skin-mark-bob { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(7deg); } }

/* Water-log emoji burst */
.skin-burst {
  position: fixed; z-index: 9998; font-size: 18px; pointer-events: none;
  transform: translate(-50%, -50%); animation: skin-burst 0.72s ease-out forwards;
  will-change: transform, opacity;
}
@keyframes skin-burst {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1.15); }
}

/* Page-load light sweep */
.skin-sweep {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9997;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 14px var(--accent); transform-origin: left;
  animation: skin-sweep 0.85s ease-out forwards;
}
@keyframes skin-sweep {
  0%   { transform: scaleX(0); opacity: 1; }
  70%  { transform: scaleX(1); opacity: 1; }
  100% { transform: scaleX(1); opacity: 0; }
}

/* Welcome toast */
.skin-toast {
  position: fixed; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom));
  transform: translateX(-50%) translateY(18px); z-index: 9996;
  background: rgba(10,10,11,0.94); border: 1px solid var(--accent); color: #fff;
  font-weight: 800; font-size: 14px; padding: 11px 18px; border-radius: 30px;
  box-shadow: 0 10px 28px -8px var(--accent); opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease; white-space: nowrap;
}
.skin-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
html[data-skin="onepiece"] .skin-toast { font-family: 'Bangers', sans-serif; letter-spacing: 1px; font-size: 16px; }
html[data-skin="bluelock"] .skin-toast { font-family: 'Orbitron', sans-serif; }

/* Themed form controls everywhere */
html[data-skin="onepiece"] input,
html[data-skin="onepiece"] progress,
html[data-skin="bluelock"] input,
html[data-skin="bluelock"] progress { accent-color: var(--accent); }
`;

  const topbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <span class="topbar-version">v${DASHBOARD_VERSION}</span>
  <div class="topbar-water-wrap">
    <a href="health.html#water" class="topbar-water-pill" id="topbarWater" aria-label="Water progress">
      <span class="topbar-pill-dot"></span>
      <span class="topbar-pill-count" id="topbarWaterCount">0/0</span>
    </a>
    <button class="topbar-water-add" id="topbarWaterAdd" aria-label="Log one drink" type="button">+</button>
  </div>
  <a href="finance.html" class="topbar-finance-btn" id="topbarFinance" aria-label="Finance">
    <span class="topbar-finance-icon">📊</span>
  </a>
  <a href="settings.html" class="topbar-settings-btn" id="topbarSettings" aria-label="Settings">⚙️</a>
</header>`;

  const minimalTopbarHtml = `
<header class="topbar" id="topbar" role="navigation" aria-label="Quick actions">
  <span class="topbar-version">v${DASHBOARD_VERSION}</span>
  <a href="settings.html" class="topbar-settings-btn" id="topbarSettings" aria-label="Settings">⚙️</a>
</header>`;

  const bottombarHtml = `
<nav class="bottombar" id="bottombar" role="navigation" aria-label="Main tabs">
  <a href="index.html" class="bottombar-tab" data-page="main">
    <span class="bottombar-tab-icon">🏠</span><span>Main</span>
  </a>
  <a href="health.html" class="bottombar-tab" data-page="health">
    <span class="bottombar-tab-icon">💊</span><span>Health</span>
  </a>
  <a href="gym.html" class="bottombar-tab" data-page="fitness">
    <span class="bottombar-tab-icon">💪</span><span>Fitness</span>
  </a>
  <a href="school.html" class="bottombar-tab" data-page="school">
    <span class="bottombar-tab-icon">📚</span><span>School</span>
  </a>
  <a href="habits.html" class="bottombar-tab" data-page="habits">
    <span class="bottombar-tab-icon">🔥</span><span>Habits</span>
  </a>
  <a href="transport.html" class="bottombar-tab" data-page="transport">
    <span class="bottombar-tab-icon">🚌</span><span>Transport</span>
  </a>
  <a href="projects.html" class="bottombar-tab" data-page="projects">
    <span class="bottombar-tab-icon">🗂️</span><span>Projects</span>
  </a>
  <a href="settings.html" class="bottombar-tab" data-page="settings">
    <span class="bottombar-tab-icon">⚙️</span><span>Settings</span>
  </a>
</nav>`;

  function isFinancePage() {
    const p = (window.location.pathname || '').toLowerCase();
    return p.endsWith('/finance.html') || p.endsWith('finance.html');
  }
  function isHomePage() {
    const p = (window.location.pathname || '').toLowerCase();
    return p.endsWith('/index.html') || p.endsWith('index.html') || p.endsWith('/');
  }
  function isSettingsPage() {
    const p = (window.location.pathname || '').toLowerCase();
    return p.endsWith('/settings.html') || p.endsWith('settings.html');
  }
  function isEmbedded() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  function currentPageKey() {
    const p = (window.location.pathname || '').toLowerCase();
    if (p.endsWith('health.html')) return 'health';
    if (p.endsWith('gym.html')) return 'fitness';
    if (p.endsWith('school.html')) return 'school';
    if (p.endsWith('habits.html')) return 'habits';
    if (p.endsWith('transport.html')) return 'transport';
    if (p.endsWith('projects.html')) return 'projects';
    if (p.endsWith('settings.html')) return 'settings';
    return 'main';
  }

  function injectStyleAndHTML() {
    if (isEmbedded() || isFinancePage()) return;
    const style = document.createElement('style');
    style.id = 'topbar-style';
    style.textContent = css;
    document.head.appendChild(style);
    // Topbar: full (water+finance+gear) on home, minimal (version+gear) elsewhere, skip on settings (has own header)
    if (!document.getElementById('topbar') && !isSettingsPage()) {
      const topWrap = document.createElement('div');
      topWrap.innerHTML = (isHomePage() ? topbarHtml : minimalTopbarHtml).trim();
      document.body.insertBefore(topWrap.firstChild, document.body.firstChild);
    }
    // Bottom tabs on all non-finance, non-iframe pages
    if (!document.getElementById('bottombar')) {
      const bottomWrap = document.createElement('div');
      bottomWrap.innerHTML = bottombarHtml.trim();
      document.body.appendChild(bottomWrap.firstChild);
      const active = currentPageKey();
      document.querySelectorAll('.bottombar-tab').forEach((t) => {
        t.classList.toggle('active', t.getAttribute('data-page') === active);
      });
      document.body.classList.add('has-bottombar');
    }

    // ---- Anime skin: swap nav emojis + inject rotating character banner ----
    const skin = getSkin();
    if (skin && SKINS[skin]) {
      const navMap = SKINS[skin].nav;
      document.querySelectorAll('.bottombar-tab').forEach((t) => {
        const k = t.getAttribute('data-page');
        const ic = t.querySelector('.bottombar-tab-icon');
        if (ic && navMap[k]) ic.textContent = navMap[k];
      });
      if (!document.getElementById('skinBanner')) {
        const b = document.createElement('div');
        b.className = 'skin-banner';
        b.id = 'skinBanner';
        b.innerHTML =
          '<div class="skin-banner-emoji" id="skinBE"></div>' +
          '<div class="skin-banner-text">' +
            '<div class="skin-banner-label" id="skinBL"></div>' +
            '<div class="skin-banner-name" id="skinBN"></div>' +
            '<div class="skin-banner-quote" id="skinBQ"></div>' +
          '</div>' +
          '<div class="skin-banner-mark">' + SKINS[skin].mark + '</div>';
        const tb = document.getElementById('topbar');
        if (tb && tb.parentNode) tb.parentNode.insertBefore(b, tb.nextSibling);
        else document.body.insertBefore(b, document.body.firstChild);
        startSkinRotation(skin);
      }
    }
  }

  const DEFAULT_NAV = { main:'🏠', health:'💊', fitness:'💪', school:'📚', habits:'🔥', transport:'🚌', projects:'🗂️', settings:'⚙️' };

  const SKIN_SPLASH = {
    onepiece: { mark: '🏴‍☠️', tag: 'King of the Pirates' },
    bluelock: { mark: '⚽', tag: "World's #1 Striker" },
  };
  // Cinematic splash shown when switching style
  window.dashSkinSplash = function(skin) {
    if (!SKIN_SPLASH[skin]) return;
    const o = document.createElement('div');
    o.className = 'skin-splash';
    o.setAttribute('data-skin-splash', skin);
    o.innerHTML =
      '<div class="skin-splash-mark">' + SKIN_SPLASH[skin].mark + '</div>' +
      '<div class="skin-splash-tag">' + SKIN_SPLASH[skin].tag + '</div>';
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('show'));
    setTimeout(() => o.classList.remove('show'), 1150);
    setTimeout(() => o.remove(), 1500);
  };

  function ensureSkinFont(skin) {
    const href = (skin === 'onepiece')
      ? 'https://fonts.googleapis.com/css2?family=Bangers&display=swap'
      : (skin === 'bluelock')
        ? 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap'
        : null;
    let fl = document.getElementById('skin-font');
    if (!href) { if (fl) fl.remove(); return; }
    if (!fl) { fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.id = 'skin-font'; document.head.appendChild(fl); }
    if (fl.href !== href) fl.href = href;
  }

  // Apply a skin live (called from settings.html when the user switches style)
  window.dashApplySkin = function(skin) {
    const root = document.documentElement;
    root.setAttribute('data-skin', skin || 'none');
    ensureSkinFont(skin);
    const map = (SKINS[skin] && SKINS[skin].nav) || DEFAULT_NAV;
    document.querySelectorAll('.bottombar-tab').forEach((t) => {
      const k = t.getAttribute('data-page');
      const ic = t.querySelector('.bottombar-tab-icon');
      if (ic && map[k]) ic.textContent = map[k];
    });
    const existing = document.getElementById('skinBanner');
    if (existing) existing.remove();
    if (_skinTimer) { clearInterval(_skinTimer); _skinTimer = null; }
    if (SKINS[skin]) {
      const b = document.createElement('div');
      b.className = 'skin-banner';
      b.id = 'skinBanner';
      b.innerHTML =
        '<div class="skin-banner-emoji" id="skinBE"></div>' +
        '<div class="skin-banner-text">' +
          '<div class="skin-banner-name" id="skinBN"></div>' +
          '<div class="skin-banner-quote" id="skinBQ"></div>' +
        '</div>' +
        '<div class="skin-banner-mark">' + SKINS[skin].mark + '</div>';
      const tb = document.getElementById('topbar');
      if (tb && tb.parentNode) tb.parentNode.insertBefore(b, tb.nextSibling);
      else document.body.insertBefore(b, document.body.firstChild);
      startSkinRotation(skin);
    }
  };

  let _skinTimer = null;
  function startSkinRotation(skin) {
    const data = SKINS[skin];
    if (!data) return;
    const chars = data.chars;
    const banner = document.getElementById('skinBanner');
    const be = document.getElementById('skinBE');
    const bl = document.getElementById('skinBL');
    const bn = document.getElementById('skinBN');
    const bq = document.getElementById('skinBQ');
    if (!banner || !be) return;
    let i = Math.floor(Math.random() * chars.length);
    function show(idx) {
      const c = chars[idx];
      be.textContent = c.emoji;
      bn.textContent = c.name;
      bq.textContent = '“' + c.quote + '”';
      if (bl) {
        bl.textContent = (skin === 'bluelock')
          ? 'BLUE LOCK · EGOIST No.' + String(idx + 1).padStart(2, '0')
          : data.label;
      }
    }
    show(i);
    if (_skinTimer) clearInterval(_skinTimer);
    _skinTimer = setInterval(() => {
      i = (i + 1) % chars.length;
      banner.classList.add('swap');
      setTimeout(() => { show(i); banner.classList.remove('swap'); }, 320);
    }, 5500);
  }

  function calendarDateKey() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function getWaterProgress() {
    let state = null;
    // On health.html, read from the shared sync store; elsewhere from localStorage
    if (window._dbH && window._dbH['po_water_v1']) {
      state = window._dbH['po_water_v1'];
    } else {
      try { state = JSON.parse(localStorage.getItem('po_water_v1')); } catch (e) {}
    }
    if (!state) return { done: 0, total: 0 };
    const todayKey = calendarDateKey();
    const done = (state.logs || {})[todayKey] || 0;
    const p = state.profile || { weightKg: 75 };
    const wKg = state.weightUnit === 'lb' ? (p.weightKg || 0) / 2.20462 : (p.weightKg || 0);
    const base = wKg * 35;
    const exercise = (p.activityHrsPerWeek || 0) / 7 * 500;
    const caffeine = Math.max(0, (state.caffeineMgPerDay || 0) - 200) * 1.5;
    const subs = (state.substances || []).reduce((s, x) => {
      const dose = (x && x.dose != null ? x.dose : (x && x.defaultDose)) || 0;
      return s + Math.max(0, dose * ((x && x.mlPerUnit) || 0));
    }, 0);
    let adjust = 0;
    if (p.sex === 'm') adjust += 200;
    if ((p.age || 0) >= 50) adjust += 100;
    const totalMl = base + exercise + caffeine + subs + adjust;
    let unitVol;
    if (state.unit === 'glass') unitVol = state.glassMl || 250;
    else if (state.unit === 'oz') unitVol = 30;
    else if (state.unit === 'ml') unitVol = 1;
    else unitVol = state.bottleMl || 500;
    const total = Math.max(1, Math.ceil(totalMl / unitVol));
    return { done, total };
  }
  function classifyStatus(done, total) {
    if (total === 0) return 'idle';
    if (done >= total) return 'good';
    if (done >= total * 0.5) return 'warn';
    const h = new Date().getHours();
    if (h >= 18 && done < total * 0.5) return 'miss';
    return 'warn';
  }
  function setPillStatus(pillEl, status) {
    pillEl.classList.remove('good', 'warn', 'miss');
    if (status === 'warn' || status === 'miss') pillEl.classList.add(status);
  }
  function render() {
    const waterEl = document.getElementById('topbarWater');
    if (!waterEl) return;
    const w = getWaterProgress();
    const countEl = document.getElementById('topbarWaterCount');
    if (countEl) countEl.textContent = w.total ? w.done + '/' + w.total : '0/0';
    setPillStatus(waterEl, classifyStatus(w.done, w.total));
  }

  function defaultWaterState() {
    return {
      unit: 'bottle', bottleMl: 500, glassMl: 250, weightUnit: 'kg',
      profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 },
      caffeineMgPerDay: 200, substances: [], logs: {}
    };
  }
  async function pushWaterMergedToSupabase(localWater) {
    if (!window.supabase || !TOPBAR_SUPABASE_URL || !TOPBAR_SUPABASE_KEY) return;
    if (TOPBAR_SUPABASE_URL.indexOf('PASTE-') === 0) return;
    try {
      const supa = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      const _wUid = localStorage.getItem('_dashUid');
      const _wKey = _wUid ? _wUid + ':health' : 'health';
      const { data } = await supa
        .from('app_state').select('data').eq('key', _wKey).maybeSingle();
      const current = (data && data.data) || {};
      // Always stamp _pushAt so health.html's poll detects the change
      const merged = Object.assign({}, current, { po_water_v1: localWater, _pushAt: Date.now() });
      await supa.from('app_state').upsert(
        { key: _wKey, data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
    } catch (e) {}
  }
  function addWater() {
    let state = null;
    // On health.html, use the shared sync store so the change goes through health sync
    if (window._dbH && typeof window._dbHSchedulePush === 'function') {
      state = window._dbH['po_water_v1'] ? JSON.parse(JSON.stringify(window._dbH['po_water_v1'])) : defaultWaterState();
      state.logs = state.logs || {};
      const k = calendarDateKey();
      state.logs[k] = (state.logs[k] || 0) + 1;
      window._dbH['po_water_v1'] = state;
      window._dbHSchedulePush();
    } else {
      try { state = JSON.parse(localStorage.getItem('po_water_v1')); } catch (e) {}
      if (!state || typeof state !== 'object') state = defaultWaterState();
      state.logs = state.logs || {};
      const k = calendarDateKey();
      state.logs[k] = (state.logs[k] || 0) + 1;
      try { localStorage.setItem('po_water_v1', JSON.stringify(state)); } catch (e) {}
      pushWaterMergedToSupabase(state);
    }
    render();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 220); }
    spawnWaterBurst();
  }

  // Themed emoji burst when logging water
  function spawnWaterBurst() {
    const skin = getSkin();
    if (!SKINS[skin]) return;
    const btn = document.getElementById('topbarWaterAdd');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const em = skin === 'onepiece' ? ['🍖', '💰', '⭐', '🍖'] : ['⚡', '⚽', '💥', '⚡'];
    for (let k = 0; k < 6; k++) {
      const s = document.createElement('span');
      s.className = 'skin-burst';
      s.textContent = em[k % em.length];
      s.style.left = (r.left + r.width / 2) + 'px';
      s.style.top = (r.top + r.height / 2) + 'px';
      s.style.setProperty('--bx', ((Math.random() * 2 - 1) * 64).toFixed(0) + 'px');
      s.style.setProperty('--by', (-(38 + Math.random() * 54)).toFixed(0) + 'px');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 760);
    }
  }

  // Light sweep across the top on page load (skin only)
  function injectLoadSweep() {
    if (!SKINS[getSkin()]) return;
    const el = document.createElement('div');
    el.className = 'skin-sweep';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  // One-per-session themed welcome toast on the home screen
  function showWelcomeToast() {
    const skin = getSkin();
    if (!SKINS[skin] || !isHomePage()) return;
    try {
      if (sessionStorage.getItem('skinWelcome:' + skin)) return;
      sessionStorage.setItem('skinWelcome:' + skin, '1');
    } catch (e) {}
    const msg = skin === 'onepiece' ? 'Welcome aboard, Captain! 🏴‍☠️' : 'Step onto the pitch ⚡';
    const t = document.createElement('div');
    t.className = 'skin-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => t.classList.remove('show'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  function blockGesture(e) { e.preventDefault(); }
  function lockGestures() {
    document.addEventListener('gesturestart', blockGesture, { passive: false });
    document.addEventListener('gesturechange', blockGesture, { passive: false });
    document.addEventListener('gestureend', blockGesture, { passive: false });
    let lastTouch = 0;
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouch <= 300) e.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }
  function startModalLock() {
    const MODAL_SELECTORS = ['.modal-bg', '.po-modal-bg', '.wt-overlay', '.wt-viewer', '.wt-cam'];
    function anyOpen() {
      for (const sel of MODAL_SELECTORS) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.classList.contains('show') || el.classList.contains('is-open')) return true;
        }
      }
      return false;
    }
    function sync() { document.body.classList.toggle('topbar-modal-open', anyOpen()); }
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
    sync();
  }

  function boot() {
    injectStyleAndHTML();
    injectLoadSweep();
    showWelcomeToast();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); addWater(); });
    render();
    lockGestures();
    startModalLock();
    window.addEventListener('storage', render);
    window.addEventListener('focus', render);
    window.addEventListener('health-synced', render);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    setInterval(render, 30 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
