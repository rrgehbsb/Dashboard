// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS, reads progress from localStorage,
// and renders the water +1 button in the top bar plus the
// Main/Health/Fitness bottom tabs. Skips chrome on finance.html
// and inside iframes (so the water tracker can embed cleanly).
// =============================================================
const DASHBOARD_VERSION = '1.6.0';

// =============================================================
// THEME STYLES ("skins") — single source of truth.
// Each entry fully describes a style: colors, font, background,
// nav emojis, splash, water-burst, welcome line, and the rotating
// character banner. Add a new skin by adding one object here +
// one card in settings.html. The CSS engine below is generic and
// reads everything from CSS variables (--accent, --accent2,
// --skin-font), so no per-skin CSS is required.
// =============================================================
const SKIN_DEFS = {
  onepiece: {
    name: 'One Piece',
    accent: '#F4A91F', accent2: '#E63946',
    font: { href: 'https://fonts.googleapis.com/css2?family=Bangers&display=swap', family: "'Bangers', -apple-system, sans-serif" },
    bgDark: 'radial-gradient(ellipse 95% 55% at 50% -10%, #2a1206 0%, #0a0a0b 58%)',
    bgLight: 'linear-gradient(180deg, #fff3e0 0%, #f2f2f7 42%)',
    pattern: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cg fill='none' stroke='%23F4A91F' stroke-width='2' stroke-linecap='round' opacity='0.05'%3E%3Cpath d='M20 20 L28 28 M28 20 L20 28'/%3E%3Cpath d='M44 44 L52 52 M52 44 L44 52'/%3E%3C/g%3E%3C/svg%3E\")",
    mark: '🏴‍☠️', label: 'WANTED · DEAD OR ALIVE',
    splashMark: '🏴‍☠️', splashTag: 'King of the Pirates',
    welcome: 'Welcome aboard, Captain! 🏴‍☠️', burst: ['🍖', '💰', '⭐'],
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
    name: 'Blue Lock',
    accent: '#1FA2FF', accent2: '#00E5FF',
    font: { href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap', family: "'Orbitron', -apple-system, sans-serif" },
    bgDark: 'radial-gradient(ellipse 95% 55% at 50% -10%, #04203f 0%, #06080d 58%)',
    bgLight: 'linear-gradient(180deg, #e2f1ff 0%, #f2f2f7 42%)',
    pattern: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='64'%3E%3Cg fill='none' stroke='%231FA2FF' stroke-width='1.5' opacity='0.06'%3E%3Cpolygon points='28,2 52,16 52,44 28,58 4,44 4,16'/%3E%3C/g%3E%3C/svg%3E\")",
    mark: '⚽', label: 'BLUE LOCK · EGOIST No.{n}',
    splashMark: '⚽', splashTag: "World's #1 Striker",
    welcome: 'Step onto the pitch ⚡', burst: ['⚡', '⚽', '💥'],
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
  sololeveling: {
    name: 'Solo Leveling',
    accent: '#9D6CFF', accent2: '#2DD4FF',
    font: { href: 'https://fonts.googleapis.com/css2?family=Oxanium:wght@600;800&display=swap', family: "'Oxanium', -apple-system, sans-serif" },
    bgDark: 'radial-gradient(ellipse 90% 52% at 50% -10%, #1a0b2e 0%, #06060d 60%)',
    bgLight: 'linear-gradient(180deg, #ede9fe 0%, #f2f2f7 42%)',
    pattern: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cg stroke='%239D6CFF' stroke-width='1' opacity='0.07'%3E%3Cpath d='M24 17 V31 M17 24 H31'/%3E%3C/g%3E%3C/svg%3E\")",
    mark: '🌑', label: 'SHADOW MONARCH · LV.{n}',
    splashMark: '🌑', splashTag: 'Arise',
    welcome: 'Arise, Monarch. 🌑', burst: ['🌑', '⚔️', '💜'],
    nav: { main:'🌑', health:'💜', fitness:'⚔️', school:'📜', habits:'🔥', transport:'🐉', projects:'👑', settings:'⚙️' },
    chars: [
      { emoji:'🌑', name:'Sung Jinwoo', quote:"I alone level up." },
      { emoji:'⚔️', name:'Igris', quote:"My loyalty is to the Monarch." },
      { emoji:'👑', name:'Ashborn', quote:"Arise, and rule the shadows." },
      { emoji:'🐜', name:'Beru', quote:"Kasaka! For my liege!" },
      { emoji:'🗡️', name:'Cha Hae-In', quote:"Strength is its own answer." },
      { emoji:'🛡️', name:'Go Gunhee', quote:"Hunters protect the world." },
    ],
  },
  jujutsu: {
    name: 'Jujutsu Kaisen',
    accent: '#3B82F6', accent2: '#EF4444',
    font: { href: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&display=swap', family: "'Rajdhani', -apple-system, sans-serif" },
    bgDark: 'radial-gradient(ellipse 95% 55% at 50% -10%, #101034 0%, #07060c 60%)',
    bgLight: 'linear-gradient(180deg, #e0e7ff 0%, #f2f2f7 42%)',
    pattern: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cg fill='none' stroke='%233B82F6' stroke-width='1.2' opacity='0.06'%3E%3Ccircle cx='30' cy='30' r='11'/%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/svg%3E\")",
    mark: '🌀', label: 'CURSED ENERGY · No.{n}',
    splashMark: '🌀', splashTag: 'Domain Expansion',
    welcome: 'Domain expanded. 🌀', burst: ['🌀', '🟣', '💥'],
    nav: { main:'🌀', health:'🩸', fitness:'👊', school:'📖', habits:'🔥', transport:'⛩️', projects:'🟣', settings:'⚙️' },
    chars: [
      { emoji:'🌀', name:'Satoru Gojo', quote:"Throughout heaven and earth, I alone am honored." },
      { emoji:'👊', name:'Yuji Itadori', quote:"I'll decide how people die." },
      { emoji:'🐶', name:'Megumi Fushiguro', quote:"I save the people I want to save." },
      { emoji:'🔨', name:'Nobara Kugisaki', quote:"I'm Nobara Kugisaki — never forget it." },
      { emoji:'👹', name:'Ryomen Sukuna', quote:"Know your place, fool." },
      { emoji:'🟣', name:'Satoru Gojo', quote:"Hollow Purple." },
    ],
  },
  demonslayer: {
    name: 'Demon Slayer',
    accent: '#2DD4BF', accent2: '#FB7185',
    font: { href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;800&display=swap', family: "'Cinzel', Georgia, serif" },
    bgDark: 'radial-gradient(ellipse 95% 55% at 50% -10%, #062a25 0%, #0a0a0b 58%)',
    bgLight: 'linear-gradient(180deg, #d9f5ef 0%, #f2f2f7 42%)',
    pattern: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='%232DD4BF' opacity='0.05'%3E%3Crect x='0' y='0' width='16' height='16'/%3E%3Crect x='16' y='16' width='16' height='16'/%3E%3C/g%3E%3C/svg%3E\")",
    mark: '🗡️', label: 'DEMON SLAYER CORPS · No.{n}',
    splashMark: '🗡️', splashTag: 'Total Concentration',
    welcome: 'Breathe. Total Concentration. 🌊', burst: ['🌊', '🌸', '🗡️'],
    nav: { main:'🌊', health:'🍃', fitness:'🗡️', school:'📜', habits:'🔥', transport:'⛩️', projects:'🌸', settings:'⚙️' },
    chars: [
      { emoji:'🌊', name:'Tanjiro Kamado', quote:"Total Concentration — Water Breathing!" },
      { emoji:'🌸', name:'Nezuko Kamado', quote:"I will protect my family." },
      { emoji:'⚡', name:'Zenitsu Agatsuma', quote:"I'll protect you, even fast asleep." },
      { emoji:'🐗', name:'Inosuke Hashibira', quote:"I am the great Inosuke-sama!" },
      { emoji:'🔥', name:'Kyojuro Rengoku', quote:"Set your heart ablaze!" },
      { emoji:'🌊', name:'Giyu Tomioka', quote:"I won't let anyone else die." },
    ],
  },
};
if (typeof window !== 'undefined') window.SKIN_DEFS = SKIN_DEFS;

// ── Companion personas (the on-screen buddy) ──
// "default" is used when no skin is active; the rest mirror each Theme Style's lead.
const DEFAULT_BUDDY = {
  name:'Nova', face:'🌟', react:['✨','💫','⚡','🔮','🌟'], burst:['✨','💫','⭐'],
  intro:"I'm Nova ✨ — your little spark of motivation. Talk to me anytime: vent, celebrate, or just say hi. I'll keep you company and help you win the day!",
  lines:[
    "Hey! Ready to make today count? ✨","Tiny steps still move you forward. 🚀",
    "I believe in you — let's go!","One task at a time. You've got this. 💫","Future you is already cheering. ⭐"],
};
const BUDDY_DEFS = {
  onepiece:{name:'Luffy', face:'👒', react:['😄','🤣','💪','🍖','🏴‍☠️'], burst:['🍖','⭐','🏴‍☠️'],
    intro:"I'm Luffy! 👒 Your nakama on this adventure. Tell me anything — we're conquering today together. Shishishi!",
    lines:[
    "Let's make today an adventure! 🏴‍☠️","Shishishi! You got this, nakama!",
    "I'm gonna be King — what'll YOU be?","Meat first, then conquer the day! 🍖","A real captain never gives up!"]},
  bluelock:{name:'Isagi', face:'⚽', react:['🔥','😼','⚡','💢','🥅'], burst:['⚡','⚽','🔥'],
    intro:"Isagi here. ⚽ Think of me as your striker instinct — talk to me and I'll keep you sharp and pushing for the goal.",
    lines:[
    "Devour every goal today. ⚽","Awaken your ego — go score!","Picture the win, then take it.",
    "No spectators. You're the striker.","Reaction speed: max. Move. ⚡"]},
  sololeveling:{name:'Monarch', face:'🌑', react:['😼','⚔️','💜','👑','🐉'], burst:['⚔️','💜','🌑'],
    intro:"They call me the Monarch. 🌑 Consider me your shadow — always at your side. Speak, and I'll help you level up.",
    lines:[
    "Arise. Today is yours to conquer. 🌑","Every task is XP. Keep leveling.",
    "The weak have no will. You're not weak.","Only I level up — and so do you.","Shadows ready. Give the command. ⚔️"]},
  jujutsu:{name:'Gojo', face:'🌀', react:['😎','🤙','🟣','💙','🫰'], burst:['🟣','💙','🌀'],
    intro:"Gojo. 🌀 The strongest companion you could ask for. Relax and talk to me — with me around, you've got this.",
    lines:[
    "Relax — you've literally got me. 😎","Nah, you're the strongest today. 🟣",
    "Throughout the day, you alone are honored.","Bored? Go clear a task. 🤙","Domain: Productive Today. Expand it."]},
  demonslayer:{name:'Tanjiro', face:'🌊', react:['😊','🔥','🗡️','🌸','💢'], burst:['🌊','🌸','🔥'],
    intro:"I'm Tanjiro. 🌊 I'll breathe steady beside you. Tell me what's on your heart and we'll keep it ablaze, together.",
    lines:[
    "Set your heart ablaze! 🔥","Total concentration — one task at a time. 🌊",
    "Kindness and grit win the day.","Breathe. Then push forward.","Protect your goals like family. 🌸"]},
};

// Apply saved theme + skin before anything renders (prevents flash)
(function() {
  try {
    var _s = JSON.parse(localStorage.getItem('dashboard:settings:v1') || '{}');
    var _dark = _s.theme !== 'light';
    document.documentElement.setAttribute('data-theme', _dark ? 'dark' : 'light');
    var _acMap = {purple:{d:'#a78bfa',l:'#7c3aed'},blue:{d:'#60a5fa',l:'#2563eb'},green:{d:'#34d399',l:'#059669'},orange:{d:'#fb923c',l:'#ea580c'},pink:{d:'#f472b6',l:'#db2777'},red:{d:'#f87171',l:'#dc2626'},yellow:{d:'#fbbf24',l:'#d97706'},teal:{d:'#2dd4bf',l:'#0d9488'}};
    var _ac = _acMap[_s.accent || 'purple'] || _acMap.purple;
    var _accentVal = _dark ? _ac.d : _ac.l;

    var _skin = _s.skin || 'none';
    document.documentElement.setAttribute('data-skin', _skin);
    var _def = SKIN_DEFS[_skin];
    if (_def) {
      _accentVal = _def.accent;
      document.documentElement.style.setProperty('--accent2', _def.accent2);
      document.documentElement.style.setProperty('--skin-font', _def.font.family);
      // Themed display font
      var _fl = document.createElement('link');
      _fl.rel = 'stylesheet'; _fl.href = _def.font.href; _fl.id = 'skin-font';
      (document.head || document.documentElement).appendChild(_fl);
      // Themed background: motif pattern over signature gradient
      var _grad = _dark ? _def.bgDark : _def.bgLight;
      var _se = document.createElement('style');
      _se.id = 'skin-early';
      _se.textContent = 'body{background:' + _def.pattern + ' , ' + _grad + ' !important; background-attachment:fixed, fixed !important;}';
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

  // Skins are defined once at the top of the file (SKIN_DEFS).
  const SKINS = SKIN_DEFS;
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

/* =============================================================
   THEME-STYLE ENGINE — generic, variable-driven.
   Every skin shares ONE rule set; only CSS variables differ
   (--accent, --accent2 set per skin in JS; --skin-font too).
   "sk" = any active skin: html[data-skin]:not([data-skin="none"]).
   ============================================================= */
:root { --accent2: var(--accent); --skin-font: inherit; }

/* ---- Character banner ---- */
.skin-banner { display: none; }
html[data-skin]:not([data-skin="none"]) .skin-banner {
  display: flex; align-items: center; gap: 13px;
  padding: 11px 15px; margin: 6px 10px; position: relative; overflow: hidden; z-index: 30;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, transparent);
  background: linear-gradient(100deg,
    color-mix(in srgb, var(--accent) 18%, transparent),
    color-mix(in srgb, var(--accent2) 10%, transparent) 60%, transparent);
  box-shadow: inset 0 0 18px color-mix(in srgb, var(--accent) 12%, transparent),
              0 0 18px -7px color-mix(in srgb, var(--accent) 55%, transparent);
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
.skin-banner-label {
  font-size: 9px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent); opacity: 0.85; margin-bottom: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.skin-banner-name {
  font-size: 14px; font-weight: 800; letter-spacing: 0.05em; margin-bottom: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-family: var(--skin-font);
  background: linear-gradient(90deg, var(--accent),
              color-mix(in srgb, var(--accent) 35%, #fff), var(--accent2), var(--accent));
  background-size: 200% auto; -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: transparent;
  animation: skin-name-shine 4.5s linear infinite;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 45%, transparent));
}
@keyframes skin-name-shine { to { background-position: 200% center; } }
.skin-banner-quote {
  font-size: 12.5px; font-style: italic; color: rgba(255,255,255,0.74);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: opacity 0.32s;
}
html[data-theme="light"] .skin-banner-quote { color: rgba(0,0,0,0.62); }
.skin-banner-mark { font-size: 23px; opacity: 0.6; flex-shrink: 0; animation: skin-mark-bob 3.2s ease-in-out infinite; }
@keyframes skin-mark-bob { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(7deg); } }
.skin-banner.swap .skin-banner-emoji { transform: scale(0.3) rotate(-14deg); opacity: 0; }
.skin-banner.swap .skin-banner-name, .skin-banner.swap .skin-banner-quote { opacity: 0; }
/* Per-skin banner shape flavor: poster (One Piece) vs cut-corner HUD (sci-fi skins) */
html[data-skin="onepiece"] .skin-banner { border-width: 2px; border-radius: 4px; }
html[data-skin="bluelock"] .skin-banner,
html[data-skin="sololeveling"] .skin-banner,
html[data-skin="jujutsu"] .skin-banner {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%);
}

/* ---- Section titles: gradient-filled, glowing, themed font ---- */
html[data-skin]:not([data-skin="none"]) .section-title {
  font-family: var(--skin-font);
  background: linear-gradient(90deg, var(--accent), var(--accent2)) !important;
  -webkit-background-clip: text !important; background-clip: text !important;
  -webkit-text-fill-color: transparent !important; color: transparent !important;
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--accent) 45%, transparent));
  border-bottom-color: color-mix(in srgb, var(--accent) 32%, transparent) !important;
}
/* Decorative fonts read better un-uppercased */
html[data-skin="onepiece"] .section-title,
html[data-skin="demonslayer"] .section-title { text-transform: none !important; letter-spacing: 0.04em !important; }
html[data-skin="onepiece"] .section-title { font-size: 15px !important; }

/* ---- Cards / chrome ---- */
html[data-skin]:not([data-skin="none"]) .section {
  border-color: color-mix(in srgb, var(--accent) 16%, transparent) !important;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 12%, transparent),
              0 0 22px -12px color-mix(in srgb, var(--accent) 55%, transparent);
}
html[data-skin]:not([data-skin="none"]) .topbar,
html[data-skin]:not([data-skin="none"]) .bottombar {
  background: rgba(8,8,12,0.94) !important;
  border-color: color-mix(in srgb, var(--accent) 18%, transparent) !important;
}
html[data-theme="light"][data-skin]:not([data-skin="none"]) .topbar,
html[data-theme="light"][data-skin]:not([data-skin="none"]) .bottombar {
  background: rgba(245,245,250,0.95) !important;
}
html[data-skin]:not([data-skin="none"]) .topbar-settings-btn { border-color: var(--accent) !important; }
html[data-skin]:not([data-skin="none"]) .topbar-version { color: var(--accent) !important; opacity: 0.5; }

/* ---- Bottom-tab: full-color emoji + active glow + pulse ---- */
html[data-skin]:not([data-skin="none"]) .bottombar-tab { position: relative; }
html[data-skin]:not([data-skin="none"]) .bottombar-tab.active { color: var(--accent) !important; }
html[data-skin]:not([data-skin="none"]) .bottombar-tab.active span:last-child { text-shadow: 0 0 8px var(--accent); }
html[data-skin]:not([data-skin="none"]) .bottombar-tab-icon { filter: none !important; opacity: 0.72 !important; }
html[data-skin]:not([data-skin="none"]) .bottombar-tab.active .bottombar-tab-icon {
  filter: none !important; opacity: 1 !important; animation: skin-pulse 1.6s ease-in-out infinite;
}
@keyframes skin-pulse {
  0%, 100% { filter: drop-shadow(0 0 3px var(--accent)); transform: scale(1.06); }
  50%      { filter: drop-shadow(0 0 11px var(--accent)); transform: scale(1.12); }
}
html[data-skin]:not([data-skin="none"]) .bottombar-tab.active::before {
  content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 22px; height: 3px; border-radius: 0 0 3px 3px;
  background: var(--accent); box-shadow: 0 0 9px var(--accent);
}

/* ---- Themed water pill ---- */
html[data-skin]:not([data-skin="none"]) .topbar-water-pill {
  background: color-mix(in srgb, var(--accent) 11%, transparent) !important;
  border-color: color-mix(in srgb, var(--accent) 30%, transparent) !important;
}
html[data-skin]:not([data-skin="none"]) .topbar-water-pill .topbar-pill-dot { background: var(--accent) !important; }
html[data-skin]:not([data-skin="none"]) .topbar-water-add {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 55%, transparent),
              color-mix(in srgb, var(--accent2) 55%, transparent)) !important;
  border-color: color-mix(in srgb, var(--accent) 30%, transparent) !important;
}

/* ---- Themed font on display headings + selection + controls ---- */
html[data-skin]:not([data-skin="none"]) .st-title,
html[data-skin]:not([data-skin="none"]) .skin-splash-tag,
html[data-skin]:not([data-skin="none"]) .skin-toast { font-family: var(--skin-font); }
html[data-skin]:not([data-skin="none"]) ::selection { background: var(--accent); color: #0a0a0b; }
html[data-skin]:not([data-skin="none"]) input,
html[data-skin]:not([data-skin="none"]) progress { accent-color: var(--accent); }
html[data-skin]:not([data-skin="none"]) #saveBtn {
  box-shadow: 0 8px 22px -8px var(--accent); letter-spacing: 0.05em; font-weight: 800;
}

/* ---- Skin-switch splash ---- */
.skin-splash {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  opacity: 0; transition: opacity 0.28s ease; pointer-events: none;
  background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 22%, transparent), rgba(6,6,10,0.96) 62%);
}
.skin-splash.show { opacity: 1; }
.skin-splash-mark {
  font-size: 92px; line-height: 1; text-align: center; transform: scale(0.35); opacity: 0;
  animation: splash-pop 0.6s cubic-bezier(.34,1.56,.64,1) forwards;
  filter: drop-shadow(0 8px 22px rgba(0,0,0,0.6));
}
.skin-splash-tag {
  margin-top: 16px; font-size: 19px; font-weight: 900; letter-spacing: 0.28em;
  text-align: center; text-transform: uppercase; opacity: 0; padding: 0 24px;
  animation: splash-tag 0.6s ease 0.18s forwards; font-family: var(--skin-font);
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent;
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--accent) 55%, transparent));
}
@keyframes splash-pop { to { transform: scale(1); opacity: 1; } }
@keyframes splash-tag { from { opacity: 0; letter-spacing: 0.5em; } to { opacity: 1; letter-spacing: 0.24em; } }

/* ---- Water-log emoji burst ---- */
.skin-burst {
  position: fixed; z-index: 9998; font-size: 18px; pointer-events: none;
  transform: translate(-50%, -50%); animation: skin-burst 0.72s ease-out forwards; will-change: transform, opacity;
}
@keyframes skin-burst {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.6); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--bx)), calc(-50% + var(--by))) scale(1.15); }
}

/* ---- Page-load light sweep ---- */
.skin-sweep {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 9997;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  box-shadow: 0 0 14px var(--accent); transform-origin: left; animation: skin-sweep 0.85s ease-out forwards;
}
@keyframes skin-sweep {
  0% { transform: scaleX(0); opacity: 1; } 70% { transform: scaleX(1); opacity: 1; } 100% { transform: scaleX(1); opacity: 0; }
}

/* ---- Welcome toast ---- */
.skin-toast {
  position: fixed; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom));
  transform: translateX(-50%) translateY(18px); z-index: 9996;
  background: rgba(10,10,11,0.94); border: 1px solid var(--accent); color: #fff;
  font-weight: 800; font-size: 15px; padding: 11px 18px; border-radius: 30px;
  box-shadow: 0 10px 28px -8px var(--accent); opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease; white-space: nowrap; font-family: var(--skin-font);
}
.skin-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
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

    // ---- Active skin: swap nav emojis + inject rotating character banner ----
    const skin = getSkin();
    if (SKINS[skin]) {
      const navMap = SKINS[skin].nav;
      document.querySelectorAll('.bottombar-tab').forEach((t) => {
        const k = t.getAttribute('data-page');
        const ic = t.querySelector('.bottombar-tab-icon');
        if (ic && navMap[k]) ic.textContent = navMap[k];
      });
      if (!document.getElementById('skinBanner')) mountBanner(skin);
    }
  }

  const DEFAULT_NAV = { main:'🏠', health:'💊', fitness:'💪', school:'📚', habits:'🔥', transport:'🚌', projects:'🗂️', settings:'⚙️' };

  // Cinematic splash shown when switching style
  window.dashSkinSplash = function(skin) {
    const def = SKINS[skin];
    if (!def) return;
    const o = document.createElement('div');
    o.className = 'skin-splash';
    o.setAttribute('data-skin-splash', skin);
    o.innerHTML =
      '<div class="skin-splash-mark">' + def.splashMark + '</div>' +
      '<div class="skin-splash-tag">' + def.splashTag + '</div>';
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('show'));
    setTimeout(() => o.classList.remove('show'), 1150);
    setTimeout(() => o.remove(), 1500);
  };

  function ensureSkinFont(skin) {
    const def = SKINS[skin];
    let fl = document.getElementById('skin-font');
    if (!def) { if (fl) fl.remove(); return; }
    if (!fl) { fl = document.createElement('link'); fl.rel = 'stylesheet'; fl.id = 'skin-font'; document.head.appendChild(fl); }
    if (fl.href !== def.font.href) fl.href = def.font.href;
  }

  // Markup for the rotating character banner (shared by boot + live switch)
  function bannerInnerHTML(skin) {
    return '<div class="skin-banner-emoji" id="skinBE"></div>' +
      '<div class="skin-banner-text">' +
        '<div class="skin-banner-label" id="skinBL"></div>' +
        '<div class="skin-banner-name" id="skinBN"></div>' +
        '<div class="skin-banner-quote" id="skinBQ"></div>' +
      '</div>' +
      '<div class="skin-banner-mark">' + SKINS[skin].mark + '</div>';
  }
  function mountBanner(skin) {
    const b = document.createElement('div');
    b.className = 'skin-banner';
    b.id = 'skinBanner';
    b.innerHTML = bannerInnerHTML(skin);
    const tb = document.getElementById('topbar');
    if (tb && tb.parentNode) tb.parentNode.insertBefore(b, tb.nextSibling);
    else document.body.insertBefore(b, document.body.firstChild);
    startSkinRotation(skin);
  }

  // Apply a skin live (called from settings.html when the user switches style)
  window.dashApplySkin = function(skin) {
    const root = document.documentElement;
    root.setAttribute('data-skin', skin || 'none');
    ensureSkinFont(skin);
    const def = SKINS[skin];
    // Drive the CSS engine: accent + accent2 + display font (or reset for "none")
    if (def) {
      root.style.setProperty('--accent', def.accent);
      root.style.setProperty('--accent2', def.accent2);
      root.style.setProperty('--skin-font', def.font.family);
    } else {
      root.style.removeProperty('--accent2');
      root.style.removeProperty('--skin-font');
    }
    const map = (def && def.nav) || DEFAULT_NAV;
    document.querySelectorAll('.bottombar-tab').forEach((t) => {
      const k = t.getAttribute('data-page');
      const ic = t.querySelector('.bottombar-tab-icon');
      if (ic && map[k]) ic.textContent = map[k];
    });
    const existing = document.getElementById('skinBanner');
    if (existing) existing.remove();
    if (_skinTimer) { clearInterval(_skinTimer); _skinTimer = null; }
    if (def) mountBanner(skin);
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
      // Label supports a {n} placeholder → live "No.NN" counter
      if (bl) bl.textContent = data.label.replace('{n}', String(idx + 1).padStart(2, '0'));
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
    if (_buddyOnWater) _buddyOnWater();
  }

  // Themed emoji burst when logging water
  function spawnWaterBurst() {
    const skin = getSkin();
    if (!SKINS[skin]) return;
    const btn = document.getElementById('topbarWaterAdd');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const em = SKINS[skin].burst;
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
    const t = document.createElement('div');
    t.className = 'skin-toast';
    t.textContent = SKINS[skin].welcome;
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

  // =============================================================
  // INTERACTIVE COMPANION — self-contained, lives on every page
  // except settings (and inside iframes). Tap opens a chat panel
  // where you can talk to a theme-aware character who reads your
  // mood, replies with motivation, reacts with facial expressions,
  // remembers the conversation, and levels up a bond meter.
  // =============================================================
  let _buddyOnWater = null;
  const buddyCss = `
.buddy{position:fixed;z-index:45;width:60px;height:60px;cursor:grab;touch-action:none;
  right:16px;bottom:calc(96px + env(safe-area-inset-bottom));
  -webkit-tap-highlight-color:transparent;user-select:none;}
.buddy[hidden]{display:none;}
.buddy.dragging{cursor:grabbing;}
.buddy.dragging .buddy-disc{animation:none;}
.buddy-aura{position:absolute;inset:-6px;border-radius:50%;
  background:radial-gradient(circle,color-mix(in srgb,var(--accent,#a78bfa) 50%,transparent),transparent 70%);
  filter:blur(7px);animation:buddy-aura 3s ease-in-out infinite;pointer-events:none;}
@keyframes buddy-aura{0%,100%{transform:scale(0.9);opacity:0.65;}50%{transform:scale(1.14);opacity:1;}}
html[data-skin="none"] .buddy-aura,
html:not([data-skin]) .buddy-aura{animation:buddy-aura 3s ease-in-out infinite, buddy-spin 9s linear infinite;}
@keyframes buddy-spin{to{transform:rotate(360deg);}}
.buddy-disc{position:absolute;inset:0;border-radius:50%;
  background:rgba(18,18,22,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
  border:1.5px solid color-mix(in srgb,var(--accent,#a78bfa) 60%,transparent);
  box-shadow:0 7px 22px -5px rgba(0,0,0,0.65),inset 0 0 16px color-mix(in srgb,var(--accent,#a78bfa) 22%,transparent);
  display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1;
  animation:buddy-float 4s ease-in-out infinite;}
@keyframes buddy-float{0%,100%{transform:translateY(0) rotate(0);}50%{transform:translateY(-7px) rotate(2deg);}}
.buddy-disc.react{animation:buddy-bounce 0.55s cubic-bezier(.34,1.7,.5,1);}
@keyframes buddy-bounce{0%{transform:scale(1);}28%{transform:scale(1.28) rotate(-9deg);}58%{transform:scale(0.9) rotate(7deg);}100%{transform:scale(1);}}
.buddy-pip{position:absolute;right:-3px;top:-3px;min-width:20px;height:18px;padding:0 5px;border-radius:9px;
  background:var(--accent,#a78bfa);color:#0a0a0b;font-size:10px;font-weight:800;
  display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;
  box-shadow:0 2px 7px rgba(0,0,0,0.45);pointer-events:none;}
.buddy-bubble{position:absolute;bottom:70px;right:0;width:max-content;max-width:212px;
  background:rgba(15,15,19,0.97);border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 45%,transparent);
  border-radius:14px;padding:10px 13px;
  box-shadow:0 12px 32px -8px rgba(0,0,0,0.72),0 0 20px -6px color-mix(in srgb,var(--accent,#a78bfa) 55%,transparent);
  opacity:0;transform:translateY(8px) scale(0.9);transform-origin:bottom right;
  transition:opacity 0.22s ease,transform 0.22s cubic-bezier(.34,1.56,.64,1);pointer-events:none;}
.buddy-bubble.show{opacity:1;transform:translateY(0) scale(1);}
.buddy-bubble::after{content:'';position:absolute;bottom:-7px;right:22px;width:12px;height:12px;
  background:rgba(15,15,19,0.97);
  border-right:1px solid color-mix(in srgb,var(--accent,#a78bfa) 45%,transparent);
  border-bottom:1px solid color-mix(in srgb,var(--accent,#a78bfa) 45%,transparent);transform:rotate(45deg);}
.buddy-bubble-name{font-size:10px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;
  color:var(--accent,#a78bfa);margin-bottom:4px;display:flex;align-items:center;gap:6px;}
.buddy-bubble-hearts{font-size:9px;letter-spacing:1px;opacity:0.95;}
.buddy-bubble-text{font-size:12.5px;line-height:1.45;color:var(--text-primary,#fafafa);}
.buddy-particle{position:fixed;z-index:9998;font-size:18px;pointer-events:none;
  transform:translate(-50%,-50%);animation:buddy-particle 0.74s ease-out forwards;will-change:transform,opacity;}
@keyframes buddy-particle{0%{opacity:1;transform:translate(-50%,-50%) scale(0.6);}
  100%{opacity:0;transform:translate(calc(-50% + var(--bx)),calc(-50% + var(--by))) scale(1.15);}}

/* ── Chat panel ── */
.bc-panel{position:fixed;right:16px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:60;
  width:min(330px,calc(100vw - 24px));height:min(460px,calc(100vh - 150px));
  display:flex;flex-direction:column;overflow:hidden;
  background:rgba(13,13,17,0.97);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 40%,transparent);border-radius:20px;
  box-shadow:0 24px 60px -14px rgba(0,0,0,0.82),0 0 30px -8px color-mix(in srgb,var(--accent,#a78bfa) 55%,transparent);
  opacity:0;transform:translateY(18px) scale(0.9);transform-origin:bottom right;pointer-events:none;
  transition:opacity .26s ease,transform .28s cubic-bezier(.34,1.5,.5,1);}
.bc-panel.open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}
html[data-theme="light"] .bc-panel{background:rgba(252,252,255,0.98);}
.bc-head{display:flex;align-items:center;gap:11px;padding:12px 12px 11px;flex-shrink:0;
  border-bottom:1px solid color-mix(in srgb,var(--accent,#a78bfa) 22%,transparent);
  background:linear-gradient(120deg,color-mix(in srgb,var(--accent,#a78bfa) 16%,transparent),transparent 70%);}
.bc-av{position:relative;width:44px;height:44px;flex-shrink:0;}
.bc-av-aura{position:absolute;inset:-4px;border-radius:50%;
  background:radial-gradient(circle,color-mix(in srgb,var(--accent,#a78bfa) 55%,transparent),transparent 70%);
  filter:blur(5px);animation:buddy-aura 3s ease-in-out infinite;}
.bc-av-face{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:24px;background:rgba(18,18,22,0.9);
  border:1.5px solid color-mix(in srgb,var(--accent,#a78bfa) 60%,transparent);
  box-shadow:inset 0 0 14px color-mix(in srgb,var(--accent,#a78bfa) 25%,transparent);}
.bc-av-face.react{animation:buddy-bounce 0.55s cubic-bezier(.34,1.7,.5,1);}
.bc-head-info{flex:1;min-width:0;}
.bc-name{font-size:14.5px;font-weight:800;color:var(--accent,#a78bfa);font-family:var(--skin-font,inherit);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bc-status{font-size:11px;color:var(--text-secondary,rgba(255,255,255,0.55));display:flex;align-items:center;gap:5px;}
.bc-status::before{content:'';width:7px;height:7px;border-radius:50%;background:#6BE3A4;box-shadow:0 0 6px #6BE3A4;flex-shrink:0;}
.bc-close{width:30px;height:30px;border-radius:9px;border:none;flex-shrink:0;cursor:pointer;
  background:rgba(255,255,255,0.06);color:var(--text-secondary,#aaa);font-size:17px;line-height:1;
  display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;transition:background .15s;}
.bc-close:hover{background:rgba(255,255,255,0.12);}
html[data-theme="light"] .bc-close{background:rgba(0,0,0,0.05);color:#444;}
.bc-body{flex:1;overflow-y:auto;padding:13px 12px;display:flex;flex-direction:column;gap:9px;
  scrollbar-width:none;}
.bc-body::-webkit-scrollbar{display:none;}
.bc-msg{max-width:82%;padding:8px 11px;font-size:13px;line-height:1.42;word-wrap:break-word;
  animation:bc-pop .28s cubic-bezier(.34,1.56,.64,1);}
@keyframes bc-pop{from{opacity:0;transform:translateY(6px) scale(0.96);}to{opacity:1;transform:none;}}
.bc-msg.bot{align-self:flex-start;background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.08);border-radius:14px 14px 14px 5px;color:var(--text-primary,#fafafa);}
.bc-msg.user{align-self:flex-end;background:var(--accent,#a78bfa);color:#0a0a0b;font-weight:600;
  border-radius:14px 14px 5px 14px;}
html[data-theme="light"] .bc-msg.bot{background:rgba(0,0,0,0.05);border-color:rgba(0,0,0,0.08);color:#1a1a1a;}
.bc-typing{align-self:flex-start;display:flex;gap:4px;padding:11px 13px;border-radius:14px;
  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);}
html[data-theme="light"] .bc-typing{background:rgba(0,0,0,0.05);}
.bc-dot{width:6px;height:6px;border-radius:50%;background:var(--accent,#a78bfa);animation:bc-dot 1.2s infinite;}
.bc-dot:nth-child(2){animation-delay:.18s;}
.bc-dot:nth-child(3){animation-delay:.36s;}
@keyframes bc-dot{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-3px);}}
.bc-chips{display:flex;gap:6px;overflow-x:auto;padding:7px 10px 0;flex-shrink:0;scrollbar-width:none;}
.bc-chips::-webkit-scrollbar{display:none;}
.bc-chip{white-space:nowrap;font-size:11px;font-weight:600;padding:6px 11px;border-radius:999px;cursor:pointer;
  background:rgba(255,255,255,0.05);color:var(--text-primary,#fafafa);
  border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 28%,transparent);
  -webkit-tap-highlight-color:transparent;transition:background .15s;flex-shrink:0;}
.bc-chip:hover{background:color-mix(in srgb,var(--accent,#a78bfa) 18%,transparent);}
html[data-theme="light"] .bc-chip{background:rgba(0,0,0,0.04);color:#1a1a1a;}
.bc-input-row{display:flex;gap:7px;padding:10px;flex-shrink:0;
  border-top:1px solid color-mix(in srgb,var(--accent,#a78bfa) 18%,transparent);}
.bc-input{flex:1;min-width:0;background:rgba(255,255,255,0.06);border-radius:12px;font-size:13px;
  border:1px solid rgba(255,255,255,0.1);padding:10px 12px;color:var(--text-primary,#fafafa);
  outline:none;font-family:inherit;transition:border-color .15s;}
.bc-input:focus{border-color:color-mix(in srgb,var(--accent,#a78bfa) 55%,transparent);}
.bc-input::placeholder{color:var(--text-tertiary,rgba(255,255,255,0.35));}
html[data-theme="light"] .bc-input{background:rgba(0,0,0,0.05);border-color:rgba(0,0,0,0.12);color:#1a1a1a;}
.bc-send{width:42px;flex-shrink:0;border:none;border-radius:12px;cursor:pointer;
  background:var(--accent,#a78bfa);color:#0a0a0b;font-size:18px;font-weight:800;line-height:1;
  -webkit-tap-highlight-color:transparent;transition:transform .1s,filter .15s;}
.bc-send:active{transform:scale(0.92);}
.bc-send:hover{filter:brightness(1.08);}
@media(max-width:480px){.buddy{right:12px;}.bc-panel{right:12px;}}
`;

  function setupBuddy() {
    if (isEmbedded() || isSettingsPage()) return;
    if (document.getElementById('buddy')) return;

    const st = document.createElement('style');
    st.id = 'buddy-style'; st.textContent = buddyCss;
    document.head.appendChild(st);

    // Floating disc
    const buddy = document.createElement('div');
    buddy.className = 'buddy'; buddy.id = 'buddy'; buddy.hidden = true;
    buddy.innerHTML =
      '<div class="buddy-bubble" id="buddyBubble">' +
        '<div class="buddy-bubble-name"><span id="buddyName">Nova</span>' +
        '<span class="buddy-bubble-hearts" id="buddyHearts"></span></div>' +
        '<div class="buddy-bubble-text" id="buddyText"></div>' +
      '</div>' +
      '<div class="buddy-aura"></div>' +
      '<div class="buddy-disc" id="buddyDisc">🌟</div>' +
      '<div class="buddy-pip" id="buddyPip">Lv1</div>';
    document.body.appendChild(buddy);

    // Chat panel
    const panel = document.createElement('div');
    panel.className = 'bc-panel'; panel.id = 'bcPanel';
    panel.innerHTML =
      '<div class="bc-head">' +
        '<div class="bc-av"><div class="bc-av-aura"></div><div class="bc-av-face" id="bcFace">🌟</div></div>' +
        '<div class="bc-head-info"><div class="bc-name" id="bcName">Nova</div>' +
          '<div class="bc-status" id="bcStatus">online · Lv1</div></div>' +
        '<button class="bc-close" id="bcClose" aria-label="Close chat">×</button>' +
      '</div>' +
      '<div class="bc-body" id="bcBody"></div>' +
      '<div class="bc-chips" id="bcChips"></div>' +
      '<div class="bc-input-row">' +
        '<input class="bc-input" id="bcInput" type="text" placeholder="Say something…" autocomplete="off" maxlength="240">' +
        '<button class="bc-send" id="bcSend" aria-label="Send">➤</button>' +
      '</div>';
    document.body.appendChild(panel);

    const disc = buddy.querySelector('#buddyDisc');
    const bubble = buddy.querySelector('#buddyBubble');
    const nameEl = buddy.querySelector('#buddyName');
    const textEl = buddy.querySelector('#buddyText');
    const heartsEl = buddy.querySelector('#buddyHearts');
    const pip = buddy.querySelector('#buddyPip');
    const faceEl = panel.querySelector('#bcFace');
    const bcName = panel.querySelector('#bcName');
    const bcStatus = panel.querySelector('#bcStatus');
    const bcBody = panel.querySelector('#bcBody');
    const bcChips = panel.querySelector('#bcChips');
    const bcInput = panel.querySelector('#bcInput');

    let persona = DEFAULT_BUDDY;
    function loadPersona() {
      persona = BUDDY_DEFS[getSkin()] || DEFAULT_BUDDY;
      disc.textContent = persona.face;
      nameEl.textContent = persona.name;
      bcName.textContent = persona.name;
      faceEl.textContent = persona.face;
      updateStatus();
    }

    const getAff = () => parseInt(localStorage.getItem('buddy_affinity') || '0', 10) || 0;
    const setAff = (n) => { try { localStorage.setItem('buddy_affinity', String(n)); } catch (e) {} };
    const level = (t) => Math.floor(t / 10) + 1;
    function renderMeters() {
      const lv = level(getAff());
      pip.textContent = 'Lv' + lv;
      heartsEl.textContent = '★'.repeat(Math.min(lv, 5));
    }
    let curStatus = 'online';
    function updateStatus() { bcStatus.textContent = curStatus + ' · Lv' + level(getAff()); }

    function burst(emojis, n) {
      const r = (panel.classList.contains('open') ? faceEl : disc).getBoundingClientRect();
      for (let i = 0; i < (n || 6); i++) {
        const s = document.createElement('span');
        s.className = 'buddy-particle';
        s.textContent = emojis[i % emojis.length];
        s.style.left = (r.left + r.width / 2) + 'px';
        s.style.top = (r.top + r.height / 2) + 'px';
        s.style.setProperty('--bx', ((Math.random() * 2 - 1) * 72).toFixed(0) + 'px');
        s.style.setProperty('--by', (-(40 + Math.random() * 62)).toFixed(0) + 'px');
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 760);
      }
    }
    let bubbleTimer = null;
    function say(text, dur) { // floating bubble (used when chat is closed)
      textEl.textContent = text; renderMeters();
      bubble.classList.add('show');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => bubble.classList.remove('show'), dur || 3800);
    }

    // ── Expression engine: the character reacts by mood ──
    const MOOD_FACE = { happy:'😄', hype:'🔥', care:'🫂', calm:'😌', cool:'😎', love:'🥰', think:'🤔', party:'🎉' };
    const MOOD_STATUS = { happy:'feeling great', hype:'hyped for you', care:'here for you', calm:'all good', cool:'locked in', love:'so wholesome', think:'thinking…', party:'celebrating!' };
    let faceReset = null;
    function expr(mood, hold) {
      faceEl.classList.remove('react'); void faceEl.offsetWidth; faceEl.classList.add('react');
      disc.classList.remove('react'); void disc.offsetWidth; disc.classList.add('react');
      const f = (mood === 'hype') ? (persona.react[0] || MOOD_FACE.hype) : (MOOD_FACE[mood] || persona.face);
      faceEl.textContent = f; disc.textContent = f;
      curStatus = MOOD_STATUS[mood] || 'online'; updateStatus();
      clearTimeout(faceReset);
      faceReset = setTimeout(() => { faceEl.textContent = persona.face; disc.textContent = persona.face; }, hold || 2600);
    }

    // ── Conversation memory (persists across pages) ──
    function getMsgs() { try { return JSON.parse(localStorage.getItem('buddy_chat')) || []; } catch (e) { return []; } }
    function saveMsgs(a) { try { localStorage.setItem('buddy_chat', JSON.stringify(a.slice(-40))); } catch (e) {} }
    function bubbleEl(from, text) {
      const d = document.createElement('div');
      d.className = 'bc-msg ' + from; d.textContent = text;
      return d;
    }
    function scrollBottom() { bcBody.scrollTop = bcBody.scrollHeight; }
    function renderHistory() {
      bcBody.innerHTML = '';
      getMsgs().forEach((m) => bcBody.appendChild(bubbleEl(m.from, m.text)));
      scrollBottom();
    }
    function pushMsg(from, text) {
      const a = getMsgs(); a.push({ from, text }); saveMsgs(a);
      bcBody.appendChild(bubbleEl(from, text)); scrollBottom();
    }

    // ── Context lines (goals/streak on home, water everywhere) ──
    function contextLine() {
      const h = new Date().getHours(); const out = [];
      if (typeof window.storeGet === 'function' && typeof window.getActiveDateString === 'function') {
        try {
          const goals = window.storeGet('goals:' + window.getActiveDateString()) || [];
          const total = goals.length, done = goals.filter((g) => g.done).length;
          if (total === 0) out.push("You've got no goals set today — want to add one? ✍️");
          else if (done === total) out.push("By the way — every goal's done today. Legend. 🔥");
          else out.push("You've still got " + (total - done) + " goal" + (total - done > 1 ? "s" : "") + " today. We've got this.");
          const s = window.storeGet('goal_streak_v1') || { count: 0 };
          if (s.count > 1) out.push("That " + s.count + "-day streak is looking strong. 🔥");
        } catch (e) {}
      }
      try { const w = getWaterProgress(); if (w.total > 0 && w.done === 0 && h >= 16) out.push("Quick reminder: drink some water for me? 💧"); } catch (e) {}
      return out;
    }

    // ── Reply engine: classify intent → persona-flavored answer ──
    function classify(t) {
      t = ' ' + t.toLowerCase() + ' ';
      const has = (...a) => a.some((w) => t.indexOf(w) !== -1);
      if (has("can't do", "cant do", "i can't", "i cant", 'give up', 'giving up', 'motivat', 'inspire', 'pump me', 'hype me', 'encourage', 'push me', 'no motivation')) return 'motivate';
      if (has('exhaust', 'so tired', 'tired', 'sleepy', 'no energy', 'drained', 'burnt out', 'burned out', 'burnout')) return 'tired';
      if (has('depress', 'lonely', 'hopeless', 'anxious', 'anxiety', 'stress', 'overwhelm', 'worried', 'scared', 'afraid', 'i feel sad', "i'm sad", 'im sad', 'feel down', 'feeling down', 'upset', 'cry')) return 'down';
      if (has('thank', ' thx ', ' ty ', 'appreciate')) return 'thanks';
      if (has('love you', ' ily ', "you're the best", 'youre the best', 'i like you', 'best friend', 'love u')) return 'love';
      if (has('how are you', 'how r u', 'hows it going', "how's it going", 'you good', 'how you doing', 'how do you do', "what's up", 'whats up', ' sup ', ' wyd ')) return 'howareyou';
      if (has('who are you', 'your name', 'what are you', 'who r u', "what's your name")) return 'whoareyou';
      if (has('joke', 'funny', 'make me laugh')) return 'joke';
      if (has('bored', 'boring', 'nothing to do')) return 'bored';
      if (has('goodnight', 'good night', ' bye ', 'see ya', 'see you', ' later ', ' gtg ', 'good bye', ' cya ')) return 'bye';
      if (has('finished', 'i did it', 'did it', 'crushed', 'smashed', 'completed', 'i won', ' aced ', 'passed', 'nailed', 'got it done')) return 'win';
      if (has('happy', 'great', 'awesome', 'amazing', 'excited', 'feeling good', 'wonderful', 'fantastic', 'so good')) return 'happy';
      if (has('gym', 'workout', 'work out', 'exercise', 'lift', 'training', ' run ', 'cardio')) return 'gym';
      if (has('study', 'exam', ' test ', 'homework', 'school', ' class ', 'assignment', 'quiz', 'revision')) return 'school';
      if (has(' goal', ' task', 'todo', 'to-do', 'to do', 'productive', 'focus', 'procrastinat')) return 'goals';
      if (has(' hi ', 'hello', ' hey', ' yo ', 'heya', 'hiya', "what's good")) return 'greet';
      if (has('?')) return 'question';
      return 'fallback';
    }
    const REPLY = {
      greet:     { mood:'happy', lines:["Hey hey! Great to see you. 😄 What's on your mind?","Yo! I'm right here. How's it going?","Hi! Ready to take on the day together?"] },
      howareyou: { mood:'cool',  lines:["Charged up and ready — but more importantly, how are YOU?","Feeling unstoppable, especially now you're here. You good?","Living my best pixel life. 😎 How about you?"] },
      motivate:  { mood:'hype',  lines:["Listen — you've survived 100% of your hardest days. Today's no match for you. 🔥","One small move right now beats a perfect plan later. Pick ONE thing and go. 💪","You don't have to feel ready. You just have to start. I'm right behind you.","Whatever's in your way — it's smaller than you. Go prove it."] },
      tired:     { mood:'care',  lines:["Resting isn't quitting. Drink some water, breathe, and we'll take it slow. 💧","Even 5 minutes of doing nothing is allowed. You've earned a breather. 😌","Tired is data, not failure. Recharge, then we go again."] },
      down:      { mood:'care',  lines:["I'm really glad you told me. Whatever it is, you're not facing it alone. 🫂","That sounds heavy. Be as kind to yourself as you'd be to a friend, okay?","Bad moments aren't the whole story. I've got you — want to talk about it?","Breathe with me for a sec. In… and out. You're safe. We'll get through this."] },
      thanks:    { mood:'happy', lines:["Anytime! That's what I'm here for. ✨","You got it — now go be amazing.","Always. Proud of you, you know that?"] },
      love:      { mood:'love',  lines:["Aww — right back at you! You've got a friend for life here. 🥰","You're the best part of my day too. 💜","Stuck with you forever. Deal? 🤝"] },
      joke:      { mood:'happy', lines:["Why did the to-do list go to therapy? Too many unchecked issues. 😂","I'd tell you a procrastination joke… but I'll do it later. 😏","My favorite workout? Jumping… to conclusions. 🏃"] },
      bored:     { mood:'cool',  lines:["Bored = free energy. Knock out one tiny task and ride the momentum. ⚡","Let's fix that — pick the smallest thing on your list and beat it in 2 minutes.","Adventure starts with one move. What've you been putting off?"] },
      bye:       { mood:'calm',  lines:["Catch you later! I'll be right here when you're back. 👋","Go get 'em. Proud of you. 🌙","See ya! Rest well and come back strong."] },
      win:       { mood:'party', lines:["LET'S GOOO! 🎉 That's the energy. I'm hyped for you!","Knew you had it in you. Put that W on the board. 🏆","Incredible. Now ride that momentum into the next one. 🔥"] },
      happy:     { mood:'happy', lines:["Love to hear it! Keep that energy rolling. 😄","That's the spirit! Days like this are fuel.","Yes! Bottle that feeling and bring it tomorrow. ✨"] },
      gym:       { mood:'hype',  lines:["Gym time? Every rep is a vote for who you're becoming. 💪","Warm up, lock in, leave it all on the floor. You've got this.","Strong body, strong mind. Go make those muscles earn it. 🔥"] },
      school:    { mood:'cool',  lines:["Break it into tiny chunks — one page, one problem, one win. 📚","Future you will be SO grateful you studied today. Start with 10 minutes.","You don't have to ace it — just show up and try. That's enough."] },
      goals:     { mood:'cool',  lines:["Pick the one that scares you a little and do it first. Momentum loves courage. 🎯","Tiny progress is still progress. What's the next checkbox?","Focus beats hustle. One task, full attention. Let's go."] },
      question:  { mood:'think', lines:["Good question! Honestly, I think you already know — what does your gut say?","Hmm — my take: start small, stay kind to yourself, keep going.","I'd trust yourself on this one. You're sharper than you give yourself credit for."] },
      fallback:  { mood:'cool',  lines:["I hear you. Tell me more — what's really on your mind?","Got it. Want a pep talk, a plan, or just someone to listen?","I'm with you. What would help most right now?","Mhm. Keep going, I'm listening. 👂"] },
    };
    function generateReply(text) {
      const intent = classify(text);
      if (intent === 'whoareyou') return { text: persona.intro, mood: 'cool' };
      const pool = REPLY[intent] || REPLY.fallback;
      let reply;
      // Persona flavor: sometimes answer with the character's own catchphrase
      if ((intent === 'motivate' || intent === 'greet' || intent === 'win') && Math.random() < 0.45) {
        reply = persona.lines[Math.floor(Math.random() * persona.lines.length)];
      } else {
        reply = pool.lines[Math.floor(Math.random() * pool.lines.length)];
      }
      // Occasionally tack on a live dashboard nudge
      const ctx = contextLine();
      if (ctx.length && (intent === 'greet' || intent === 'howareyou' || intent === 'goals') && Math.random() < 0.6) {
        reply += '\n\n' + ctx[Math.floor(Math.random() * ctx.length)];
      }
      return { text: reply, mood: pool.mood };
    }

    let typingEl = null;
    function showTyping() {
      if (typingEl) return;
      typingEl = document.createElement('div');
      typingEl.className = 'bc-typing';
      typingEl.innerHTML = '<span class="bc-dot"></span><span class="bc-dot"></span><span class="bc-dot"></span>';
      bcBody.appendChild(typingEl); scrollBottom();
      faceEl.textContent = MOOD_FACE.think;
    }
    function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }
    function botReply(text, mood, party) {
      showTyping();
      const delay = 500 + Math.min(1500, text.length * 16);
      setTimeout(() => {
        hideTyping();
        pushMsg('bot', text);
        expr(mood);
        burst(party ? ['🎉', '🎊', '⭐'] : persona.burst, party ? 12 : 5);
      }, delay);
    }
    function sendUser(text) {
      text = (text || '').trim();
      if (!text) return;
      pushMsg('user', text);
      const aff = getAff() + 1; setAff(aff); renderMeters(); updateStatus();
      const r = generateReply(text);
      botReply(r.text, r.mood);
    }

    // Quick-reply chips
    const CHIPS = [['💪 Motivate me', 'motivate me'], ['😴 I\'m tired', "i'm tired"], ['🎯 My goals', 'my goals'], ['😄 How are you?', 'how are you?'], ['😂 Tell a joke', 'tell me a joke']];
    CHIPS.forEach(([label, payload]) => {
      const c = document.createElement('button');
      c.className = 'bc-chip'; c.type = 'button'; c.textContent = label;
      c.addEventListener('click', () => sendUser(payload));
      bcChips.appendChild(c);
    });

    // ── Open / close chat ──
    let opened = false;
    function openChat() {
      panel.classList.add('open');
      buddy.hidden = true;
      renderHistory();
      if (getMsgs().length === 0) {
        // First-ever open: introduce + greet
        botReply(persona.intro, 'happy');
      } else if (!opened) {
        // Returning: a warm welcome-back line
        const ctx = contextLine();
        const greet = ctx.length ? ctx[0] : pickGreet();
        botReply(greet, 'happy');
      }
      opened = true;
      setTimeout(() => bcInput.focus({ preventScroll: true }), 200);
    }
    function pickGreet() { return ["Welcome back! 😄 What's up?", "Hey, missed you! How's it going?", "There you are! Ready to win?"][Math.floor(Math.random() * 3)]; }
    function closeChat() { panel.classList.remove('open'); buddy.hidden = false; }
    panel.querySelector('#bcClose').addEventListener('click', closeChat);
    panel.querySelector('#bcSend').addEventListener('click', () => { sendUser(bcInput.value); bcInput.value = ''; });
    bcInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { sendUser(bcInput.value); bcInput.value = ''; } });

    // ── Drag the disc (tap opens chat) ──
    let down = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function place(x, y) {
      const w = buddy.offsetWidth || 60, h = buddy.offsetHeight || 60;
      x = Math.max(6, Math.min(window.innerWidth - w - 6, x));
      y = Math.max(60, Math.min(window.innerHeight - h - 6, y));
      buddy.style.left = x + 'px'; buddy.style.top = y + 'px';
      buddy.style.right = 'auto'; buddy.style.bottom = 'auto';
    }
    function loadPos() { try { const p = JSON.parse(localStorage.getItem('buddy_pos')); if (p) place(p.x, p.y); } catch (e) {} }
    buddy.addEventListener('pointerdown', (e) => {
      down = true; moved = false; buddy.classList.add('dragging');
      const r = buddy.getBoundingClientRect(); ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
      try { buddy.setPointerCapture(e.pointerId); } catch (err) {}
    });
    buddy.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (moved) { place(ox + dx, oy + dy); bubble.classList.remove('show'); }
    });
    buddy.addEventListener('pointerup', () => {
      down = false; buddy.classList.remove('dragging');
      if (moved) { const r = buddy.getBoundingClientRect(); try { localStorage.setItem('buddy_pos', JSON.stringify({ x: r.left, y: r.top })); } catch (e) {} }
      else openChat();
    });
    window.addEventListener('resize', () => { if (buddy.style.left) { const r = buddy.getBoundingClientRect(); place(r.left, r.top); } });

    // ── Ambient reactions (chat message if open, floating bubble if closed) ──
    function ambient(text, mood, party) {
      if (panel.classList.contains('open')) { pushMsg('bot', text); expr(mood, 3200); burst(party ? ['🎉', '🎊', '⭐'] : persona.burst, party ? 12 : 6); }
      else { expr(mood, 2400); say(text, party ? 4500 : 3000); }
    }
    let celebrated = false;
    window.addEventListener('goals-changed', () => {
      if (typeof window.storeGet !== 'function' || typeof window.getActiveDateString !== 'function') return;
      try {
        const goals = window.storeGet('goals:' + window.getActiveDateString()) || [];
        if (goals.length > 0 && goals.every((g) => g.done)) {
          if (!celebrated) { celebrated = true; ambient("Every goal done today! You're unstoppable. 🏆", 'party', true); }
        } else celebrated = false;
      } catch (e) {}
    });
    _buddyOnWater = () => ambient(["Nice, stay hydrated! 💧", "Glug glug — keep going! 💧", "Hydration = focus. 💧"][Math.floor(Math.random() * 3)], 'happy');
    window.dashRefreshBuddy = loadPersona;

    loadPersona(); renderMeters(); updateStatus(); loadPos(); buddy.hidden = false;
  }

  function boot() {
    injectStyleAndHTML();
    injectLoadSweep();
    showWelcomeToast();
    setupBuddy();
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
