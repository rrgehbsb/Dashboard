// =============================================================
// Persistent dashboard top bar + bottom tab bar.
// Drop this on any page with:
//     <script src="topbar.js" defer></script>
// It self-injects HTML + CSS, reads progress from localStorage,
// and renders the water +1 button in the top bar plus the
// Main/Health/Fitness bottom tabs. Skips chrome on finance.html
// and inside iframes (so the water tracker can embed cleanly).
// =============================================================
const DASHBOARD_VERSION = '2.5.45';

// Auto-update: when a new service worker takes control (new deploy), reload once
// so the installed app always runs the latest code instead of a stale cached
// version. Guarded so it can't loop.
(function(){
  try{
    if('serviceWorker' in navigator){
      var _swReloaded=false;
      navigator.serviceWorker.addEventListener('controllerchange', function(){
        if(_swReloaded) return; _swReloaded=true; window.location.reload();
      });
      // Actively check for a newer service worker on each load
      navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.update(); }).catch(function(){});
    }
  }catch(e){}
})();

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

// Page backgrounds per surface style — injected in the early boot below so the
// final look renders in one shot (no flash from the skin bg to the UI-style bg).
const UI_BG = {
  skeuomorphism: 'linear-gradient(180deg,#2a251e,#171310)',
  neomorphism: '#23262c',
  glassmorphism: 'radial-gradient(at 18% 18%, #6d28d9 0%, transparent 42%), radial-gradient(at 82% 12%, #1d6fb8 0%, transparent 42%), radial-gradient(at 50% 88%, #be185d 0%, transparent 48%), #0a0a14',
  claymorphism: 'linear-gradient(160deg,#2e2a55,#3b2c58)',
  minimalism: '#0b0b0c',
  maximalism: 'linear-gradient(135deg,#ff2d75,#7a2cff 48%,#00c2ff)',
  brutalism: '#0c0c0c',
  liquidglass: 'radial-gradient(at 28% 18%, rgba(58,160,255,0.5) 0%, transparent 46%), radial-gradient(at 76% 26%, rgba(255,94,199,0.5) 0%, transparent 46%), radial-gradient(at 50% 84%, rgba(34,224,192,0.45) 0%, transparent 50%), #06060c',
  bento: '#0d0d10',
  spatial: 'radial-gradient(at 50% 0%, #1a2340 0%, transparent 60%), #05060a',
};
const UI_BG_LIGHT = { brutalism: '#f2f0e9', neomorphism: '#e6e9ef', minimalism: '#fbfbfa' };
// Dashboard Style (home look) backgrounds — injected in early boot so the
// cinematic look renders in one shot, flash-free (wins over skin/ui bg).
const HOME_BG = {
  cinematic: 'radial-gradient(130% 90% at 50% -12%, rgba(45,212,191,0.16), rgba(8,11,16,0) 55%), radial-gradient(90% 70% at 82% 8%, rgba(56,189,248,0.10), rgba(8,11,16,0) 50%), #06090e',
  neon: 'radial-gradient(120% 80% at 15% -8%, rgba(255,45,149,0.20), rgba(8,6,16,0) 50%), radial-gradient(120% 80% at 85% 6%, rgba(58,160,255,0.20), rgba(8,6,16,0) 52%), radial-gradient(140% 120% at 50% 120%, rgba(122,44,255,0.18), rgba(8,6,16,0) 55%), #0a0713',
  aurora: 'radial-gradient(90% 60% at 12% 6%, rgba(56,189,248,0.22), rgba(9,12,20,0) 50%), radial-gradient(90% 60% at 88% 0%, rgba(167,139,250,0.22), rgba(9,12,20,0) 50%), radial-gradient(120% 80% at 50% 110%, rgba(52,211,153,0.18), rgba(9,12,20,0) 55%), #0a0e17',
  ember: 'radial-gradient(120% 85% at 50% -12%, rgba(251,146,60,0.16), rgba(14,10,8,0) 52%), radial-gradient(90% 70% at 82% 8%, rgba(244,63,94,0.10), rgba(14,10,8,0) 50%), #100b08',
  mono: '#0b0b0c',
};

// Apply saved theme + skin. Reusable so a settings change synced from another
// device can be re-applied live (not just on the settings page / on reload).
window.applyDashSettings = function(_s) {
  try {
    _s = _s || {};
    var root = document.documentElement;
    var _dark = _s.theme !== 'light';
    root.setAttribute('data-theme', _dark ? 'dark' : 'light');
    var _acMap = {purple:{d:'#a78bfa',l:'#7c3aed'},blue:{d:'#60a5fa',l:'#2563eb'},green:{d:'#34d399',l:'#059669'},orange:{d:'#fb923c',l:'#ea580c'},pink:{d:'#f472b6',l:'#db2777'},red:{d:'#f87171',l:'#dc2626'},yellow:{d:'#fbbf24',l:'#d97706'},teal:{d:'#2dd4bf',l:'#0d9488'}};
    var _ac = _acMap[_s.accent || 'purple'] || _acMap.purple;
    var _accentVal = _dark ? _ac.d : _ac.l;

    var _skin = _s.skin || 'none';
    root.setAttribute('data-skin', _skin);
    root.setAttribute('data-ui', _s.uiStyle || 'default');
    // Clear previously injected dynamic tags so re-apply is clean
    ['skin-font','skin-early','ui-early','home-early'].forEach(function(id){ var e=document.getElementById(id); if(e) e.remove(); });
    var _def = SKIN_DEFS[_skin];
    if (_def) {
      _accentVal = _def.accent;
      root.style.setProperty('--accent2', _def.accent2);
      root.style.setProperty('--skin-font', _def.font.family);
      var _fl = document.createElement('link');
      _fl.rel = 'stylesheet'; _fl.href = _def.font.href; _fl.id = 'skin-font';
      (document.head || root).appendChild(_fl);
      var _grad = _dark ? _def.bgDark : _def.bgLight;
      var _se = document.createElement('style');
      _se.id = 'skin-early';
      _se.textContent = 'body{background:' + _def.pattern + ' , ' + _grad + ' !important; background-attachment:fixed, fixed !important;}';
      (document.head || root).appendChild(_se);
    }

    var _uiStyle = _s.uiStyle || 'default';
    var _uiBg = _dark ? UI_BG[_uiStyle] : (UI_BG_LIGHT[_uiStyle] || UI_BG[_uiStyle]);
    if (_uiBg) {
      var _ue = document.createElement('style'); _ue.id = 'ui-early';
      _ue.textContent = 'body{background:' + _uiBg + ' !important; background-attachment:fixed !important;}';
      (document.head || root).appendChild(_ue);
    }

    // Kids mode — a simpler, clearer layout with some pages hidden.
    root.setAttribute('data-mode', _s.mode === 'kid' ? 'kid' : 'adult');

    var _home = _s.home || 'classic';
    root.setAttribute('data-home', _home);
    if (HOME_BG[_home]) {
      var _he = document.createElement('style'); _he.id = 'home-early';
      _he.textContent = 'body{background:' + HOME_BG[_home] + ' !important; background-attachment:fixed !important;}';
      (document.head || root).appendChild(_he);
    }

    root.style.setProperty('--accent', _accentVal);
    root.style.setProperty('--card-radius', {sharp:'6px',rounded:'14px',pill:'24px'}[_s.cardStyle||'rounded']||'14px');
    root.style.setProperty('--base-font', {small:'13px',medium:'15px',large:'17px'}[_s.fontSize||'medium']||'15px');
    // Live-update nav emojis + character banner for the (possibly new) skin
    if (typeof window.dashApplySkin === 'function') { try { window.dashApplySkin(_skin); } catch(e){} }
  } catch(e) {}
};
// Apply immediately from local storage before anything renders (prevents flash)
window.applyDashSettings(JSON.parse(localStorage.getItem('dashboard:settings:v1') || '{}'));

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
  background: rgba(10, 10, 13, 0.72);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
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
  background: rgba(10, 10, 13, 0.72);
  backdrop-filter: blur(20px) saturate(1.4);
  -webkit-backdrop-filter: blur(20px) saturate(1.4);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
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
/* Default theme: accent active indicator + glow for a designed feel */
html[data-skin="none"] .bottombar-tab { position: relative; }
html[data-skin="none"] .bottombar-tab.active { color: var(--accent); }
html[data-skin="none"] .bottombar-tab.active .bottombar-tab-icon { opacity: 1; }
html[data-skin="none"] .bottombar-tab.active span:last-child { text-shadow: 0 0 10px color-mix(in srgb, var(--accent) 60%, transparent); }
html[data-skin="none"] .bottombar-tab.active::before {
  content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
  width: 20px; height: 3px; border-radius: 0 0 3px 3px;
  background: var(--accent); box-shadow: 0 0 9px var(--accent);
}
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
  <button class="topbar-level" id="topbarLevel" type="button" aria-label="Your level and XP">
    <span class="tl-star">⭐</span><span class="tl-lv" id="topbarLevelNum">Lv1</span>
    <span class="tl-bar"><span class="tl-fill" id="topbarLevelFill"></span></span>
  </button>
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
  <button class="topbar-level" id="topbarLevel" type="button" aria-label="Your level and XP">
    <span class="tl-star">⭐</span><span class="tl-lv" id="topbarLevelNum">Lv1</span>
    <span class="tl-bar"><span class="tl-fill" id="topbarLevelFill"></span></span>
  </button>
  <a href="settings.html" class="topbar-settings-btn" id="topbarSettings" aria-label="Settings">⚙️</a>
</header>`;

  // Canonical list of every bottom-bar destination.
  const ALL_TABS = [
    { key:'main',      href:'index.html',     icon:'🏠',  label:'Main' },
    { key:'health',    href:'health.html',    icon:'💊',  label:'Health' },
    { key:'fitness',   href:'gym.html',       icon:'💪',  label:'Fitness' },
    { key:'school',    href:'school.html',    icon:'📚',  label:'School' },
    { key:'habits',    href:'habits.html',    icon:'🔥',  label:'Habits' },
    { key:'transport', href:'transport.html', icon:'🚌',  label:'Transport' },
    { key:'projects',  href:'projects.html',  icon:'🗂️', label:'Projects' },
    { key:'friends',   href:'friends.html',   icon:'👥',  label:'Friends' },
    { key:'settings',  href:'settings.html',  icon:'⚙️',  label:'Settings' },
  ];
  const TAB_BY_KEY = {}; ALL_TABS.forEach((t) => { TAB_BY_KEY[t.key] = t; });

  function readSettings() {
    try { return JSON.parse(localStorage.getItem('dashboard:settings:v1')) || {}; } catch (e) { return {}; }
  }
  // Pages the user can turn on/off (onboarding + kids mode). 'main' and
  // 'settings' can never be hidden. Stored SYNCED in dashboard:settings:v1
  // as `pages: { finance:false, ... }` — absent/true = visible.
  const HIDEABLE_PAGES = ['health','fitness','school','habits','transport','projects','friends','finance','trends'];
  function pageVisible(key) {
    if (key === 'main' || key === 'settings') return true;
    const s = readSettings();
    if (s.pages && s.pages[key] === false) return false;
    return true;
  }
  // Bottom-bar layout is DEVICE-ONLY (localStorage 'dashboard:nav:v1') — never synced,
  // since the ideal bar differs per screen. Falls back to legacy synced fields once.
  function readNavCfg() {
    let n = null;
    try { n = JSON.parse(localStorage.getItem('dashboard:nav:v1')); } catch (e) {}
    if (n && typeof n === 'object' && n.navCustom !== undefined) return n;
    const s = readSettings();
    return { navCustom: s.navCustom, navCount: s.navCount, navPinned: s.navPinned };
  }
  // Resolve which tabs are visible vs. tucked into "More", per the custom config.
  function resolveNav() {
    const n = readNavCfg();
    // Drop any pages hidden by onboarding / kids mode first.
    const allowed = ALL_TABS.filter((t) => pageVisible(t.key));
    if (!n.navCustom) return { visible: allowed.slice(), leftover: [] };
    let pinned = Array.isArray(n.navPinned)
      ? n.navPinned.map((k) => TAB_BY_KEY[k]).filter(Boolean).filter((t) => pageVisible(t.key))
      : [];
    if (!pinned.length) pinned = allowed.slice(0, 4);
    const pinnedKeys = pinned.map((t) => t.key);
    const leftover = allowed.filter((t) => pinnedKeys.indexOf(t.key) === -1);
    return { visible: pinned, leftover };
  }

  const navExtraCss = `
.bottombar-tab.more-tab{cursor:pointer;background:none;border:none;font-family:inherit;}
.nav-more-backdrop{position:fixed;inset:0;z-index:55;background:rgba(0,0,0,0.5);
  opacity:0;pointer-events:none;transition:opacity .25s;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}
.nav-more-backdrop.show{opacity:1;pointer-events:auto;}
.nav-more-sheet{position:fixed;left:0;right:0;bottom:0;z-index:56;max-width:460px;
  margin:0 auto;padding:8px 12px calc(14px + env(safe-area-inset-bottom));
  background:#0e0e12;border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 24%,transparent);border-bottom:none;
  border-radius:22px 22px 0 0;box-shadow:0 -18px 44px -14px rgba(0,0,0,0.7);
  transform:translateY(112%);transition:transform .32s cubic-bezier(.34,1.4,.5,1);}
.nav-more-sheet.show{transform:translateY(0);}
html[data-theme="light"] .nav-more-sheet{background:#fff;}
.nav-more-grip{width:38px;height:4px;border-radius:2px;background:rgba(255,255,255,0.18);margin:6px auto 10px;}
html[data-theme="light"] .nav-more-grip{background:rgba(0,0,0,0.18);}
.nav-more-title{font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
  color:var(--text-tertiary,rgba(255,255,255,0.4));padding:0 6px 8px;}
.nav-more-item{display:flex;align-items:center;gap:13px;padding:12px;border-radius:13px;text-decoration:none;
  color:var(--text-primary,#fafafa);-webkit-tap-highlight-color:transparent;transition:background .15s;}
.nav-more-item:active{background:rgba(255,255,255,0.06);}
.nav-more-item.active{background:color-mix(in srgb,var(--accent,#a78bfa) 16%,transparent);}
.nav-more-item-icon{font-size:23px;width:28px;text-align:center;}
.nav-more-item-label{font-size:15px;font-weight:600;}
html[data-theme="light"] .nav-more-item:active{background:rgba(0,0,0,0.05);}
/* Kids mode — bigger, clearer bottom tabs */
html[data-mode="kid"] .bottombar-tab{font-size:11px;font-weight:700;gap:4px;}
html[data-mode="kid"] .bottombar-tab-icon{font-size:26px;}
html[data-mode="kid"] .nav-more-item-icon{font-size:26px;}
html[data-mode="kid"] .nav-more-item-label{font-size:16px;}
`;

  const xpCss = `
/* Level chip in the top bar */
.topbar-level{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 9px;
  border-radius:9px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;
  background:rgba(255,255,255,0.05);border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 38%,transparent);
  transition:background .15s;}
.topbar-level:hover{background:rgba(255,255,255,0.1);}
html[data-theme="light"] .topbar-level{background:rgba(0,0,0,0.04);}
.tl-star{font-size:12px;line-height:1;}
.tl-lv{font-size:11px;font-weight:800;color:var(--accent,#a78bfa);font-variant-numeric:tabular-nums;}
.tl-bar{width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,0.14);overflow:hidden;}
html[data-theme="light"] .tl-bar{background:rgba(0,0,0,0.12);}
.tl-fill{display:block;height:100%;width:0;border-radius:3px;background:var(--accent,#a78bfa);
  box-shadow:0 0 7px color-mix(in srgb,var(--accent,#a78bfa) 70%,transparent);transition:width .6s cubic-bezier(.22,1,.36,1);}

/* iOS-style XP gain banner */
.xp-toast{position:fixed;top:calc(env(safe-area-inset-top) + 8px);left:50%;z-index:9999;
  width:min(390px,calc(100vw - 24px));display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:18px;
  background:rgba(20,20,24,0.92);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);
  border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 40%,transparent);
  box-shadow:0 16px 40px -10px rgba(0,0,0,0.7),0 0 24px -8px color-mix(in srgb,var(--accent,#a78bfa) 55%,transparent);
  transform:translateX(-50%) translateY(-170%);opacity:0;pointer-events:none;
  transition:transform .42s cubic-bezier(.22,1.2,.36,1),opacity .3s;}
.xp-toast.show{transform:translateX(-50%) translateY(0);opacity:1;}
html[data-theme="light"] .xp-toast{background:rgba(255,255,255,0.95);}
.xp-toast.levelup{border-color:#F2C063;box-shadow:0 16px 44px -8px rgba(0,0,0,0.7),0 0 32px -4px rgba(242,192,99,0.7);}
.xp-toast-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:44px;height:44px;border-radius:13px;flex-shrink:0;
  background:color-mix(in srgb,var(--accent,#a78bfa) 22%,transparent);
  border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 45%,transparent);}
.xp-tb-star{font-size:15px;line-height:1;}
.xp-tb-lv{font-size:10px;font-weight:800;color:var(--accent,#a78bfa);font-variant-numeric:tabular-nums;margin-top:1px;}
.xp-toast-mid{flex:1;min-width:0;}
.xp-toast-reason{font-size:12.5px;font-weight:700;color:var(--text-primary,#fafafa);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.xp-toast.levelup .xp-toast-reason{color:#F2C063;letter-spacing:0.04em;}
.xp-toast-bar{height:7px;border-radius:4px;margin:5px 0 3px;background:rgba(255,255,255,0.14);overflow:hidden;}
html[data-theme="light"] .xp-toast-bar{background:rgba(0,0,0,0.1);}
.xp-toast-fill{display:block;height:100%;width:0;border-radius:4px;
  background:linear-gradient(90deg,var(--accent,#a78bfa),color-mix(in srgb,var(--accent,#a78bfa) 40%,#fff));
  box-shadow:0 0 8px color-mix(in srgb,var(--accent,#a78bfa) 70%,transparent);}
.xp-toast-sub{font-size:10px;font-weight:600;color:var(--text-tertiary,rgba(255,255,255,0.45));font-variant-numeric:tabular-nums;}
.xp-toast-gain{display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;line-height:1;
  font-size:19px;font-weight:800;color:var(--accent,#a78bfa);font-variant-numeric:tabular-nums;}
.xp-toast-gain span{font-size:9px;font-weight:700;letter-spacing:0.08em;opacity:0.7;margin-top:1px;}
.xp-toast.levelup .xp-toast-gain{color:#F2C063;}

/* Level / XP modal */
.xp-modal-bg{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;
  background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .2s;}
.xp-modal-bg.show{opacity:1;pointer-events:auto;}
.xp-modal{width:100%;max-width:380px;max-height:86vh;overflow-y:auto;position:relative;scrollbar-width:none;
  background:#131318;border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 35%,transparent);
  border-radius:20px;padding:22px 20px;box-shadow:0 24px 60px -12px rgba(0,0,0,0.8);}
.xp-modal::-webkit-scrollbar{display:none;}
html[data-theme="light"] .xp-modal{background:#fff;}
.xp-modal-close{position:absolute;top:14px;right:14px;width:30px;height:30px;border:none;border-radius:9px;cursor:pointer;
  background:rgba(255,255,255,0.06);color:var(--text-secondary,#aaa);font-size:18px;line-height:1;}
html[data-theme="light"] .xp-modal-close{background:rgba(0,0,0,0.05);color:#444;}
.xp-modal-lv{font-size:26px;font-weight:800;letter-spacing:-0.02em;color:var(--text-primary,#fafafa);
  margin-bottom:14px;font-family:var(--skin-font,inherit);}
.xp-modal-bar{height:12px;border-radius:7px;background:rgba(255,255,255,0.1);overflow:hidden;}
html[data-theme="light"] .xp-modal-bar{background:rgba(0,0,0,0.08);}
.xp-modal-fill{display:block;height:100%;border-radius:7px;
  background:linear-gradient(90deg,var(--accent,#a78bfa),color-mix(in srgb,var(--accent,#a78bfa) 35%,#fff));
  box-shadow:0 0 10px color-mix(in srgb,var(--accent,#a78bfa) 70%,transparent);}
.xp-modal-meta{display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-top:7px;
  color:var(--text-tertiary,rgba(255,255,255,0.45));font-variant-numeric:tabular-nums;}
.xp-modal-sub{font-size:12px;color:var(--accent,#a78bfa);font-weight:700;margin-top:3px;}
.xp-modal-h{font-size:10px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;
  color:var(--text-tertiary,rgba(255,255,255,0.4));margin:18px 0 8px;}
.xp-logrow,.xp-rate{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;
  border-radius:11px;background:rgba(255,255,255,0.04);margin-bottom:5px;font-size:13px;color:var(--text-primary,#fafafa);}
html[data-theme="light"] .xp-logrow,html[data-theme="light"] .xp-rate{background:rgba(0,0,0,0.04);}
.xp-logamt,.xp-rate-amt{font-weight:800;color:var(--accent,#a78bfa);font-variant-numeric:tabular-nums;flex-shrink:0;}
.xp-rate-ic{font-size:17px;flex-shrink:0;}
.xp-rate-name{flex:1;min-width:0;}
.xp-rate-name em{font-style:normal;color:var(--text-tertiary,rgba(255,255,255,0.4));font-size:11px;}
.xp-log-empty{font-size:12px;color:var(--text-tertiary,rgba(255,255,255,0.4));font-style:italic;padding:6px 2px;}
/* Achievement-unlock banner variant */
.xp-toast.achievement{border-color:#F2C063;box-shadow:0 16px 44px -8px rgba(0,0,0,0.7),0 0 34px -4px rgba(242,192,99,0.75);}
.xp-toast.achievement .xp-toast-badge{background:rgba(242,192,99,0.2);border-color:rgba(242,192,99,0.5);font-size:22px;}
.xp-toast.achievement .xp-tb-star{display:none;}
.xp-toast.achievement .xp-toast-reason{color:#F2C063;}
.xp-toast.achievement .xp-toast-fill{background:linear-gradient(90deg,#F2C063,#ffe6a0);}
.xp-toast.achievement .xp-toast-gain{font-size:22px;}
/* Achievements grid */
.xp-ach-count{float:right;color:var(--accent,#a78bfa);font-weight:800;}
.xp-badges{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
.xp-badge{display:flex;flex-direction:column;align-items:center;gap:5px;padding:11px 4px;border-radius:12px;
  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);text-align:center;opacity:0.5;
  filter:grayscale(0.8);transition:transform .12s;}
.xp-badge.got{opacity:1;filter:none;background:color-mix(in srgb,var(--accent,#a78bfa) 12%,transparent);
  border-color:color-mix(in srgb,var(--accent,#a78bfa) 35%,transparent);}
.xp-badge.got:active{transform:scale(0.94);}
html[data-theme="light"] .xp-badge{background:rgba(0,0,0,0.04);}
.xp-badge-ic{font-size:23px;line-height:1;}
.xp-badge-name{font-size:8.5px;font-weight:700;line-height:1.15;color:var(--text-secondary,rgba(255,255,255,0.6));}
.xp-badge.got .xp-badge-name{color:var(--text-primary,#fafafa);}
/* Streak freeze box */
.xp-freeze{background:rgba(255,255,255,0.04);border:1px solid color-mix(in srgb,var(--accent,#a78bfa) 22%,transparent);
  border-radius:13px;padding:13px;}
html[data-theme="light"] .xp-freeze{background:rgba(0,0,0,0.04);}
.xp-freeze-top{display:flex;align-items:center;gap:11px;}
.xp-freeze-ic{font-size:26px;flex-shrink:0;}
.xp-freeze-title{font-size:14px;font-weight:700;color:var(--text-primary,#fafafa);}
.xp-freeze-title strong{color:var(--accent,#a78bfa);}
.xp-freeze-desc{font-size:11.5px;color:var(--text-tertiary,rgba(255,255,255,0.5));line-height:1.35;margin-top:2px;}
.xp-freeze-buy{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px;
  padding-top:11px;border-top:1px solid rgba(255,255,255,0.07);}
.xp-freeze-bal{font-size:12px;font-weight:700;color:var(--text-secondary,rgba(255,255,255,0.6));font-variant-numeric:tabular-nums;}
.xp-freeze-btn{border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;
  padding:9px 14px;background:var(--accent,#a78bfa);color:#0a0a0b;-webkit-tap-highlight-color:transparent;transition:filter .15s,opacity .15s;}
.xp-freeze-btn:hover{filter:brightness(1.08);}
.xp-freeze-btn:disabled{opacity:0.4;cursor:not-allowed;}
`;

  // ===== SURFACE / UI STYLE ENGINE =====
  // Each style is a full design language — surfaces, inputs, buttons, headings
  // and the page background all shift together. Layered on the theme + skin.
  const UI_SURFACES = '.section,.gm-card,.hb-card,.hb-header-card,.fin-card,.sch-card,.hth-card,.dash-mini-card,.pom-card,.kn-col,.sum-stat,.gt-card,.gt-today-card,.mood-card,.rm-card,.day-ring-card,.do-now-card,.goal-ticker,.st-body,.card,.me-card,.row';
  const UI_INPUTS = 'input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,select,.gt-set-input,.gt-set-input-mobile,.st-input,.bc-input';
  const UI_BTNS = '.gm-add-btn,.m-save,.bc-send,.rm-add-btn-top,.water-q-btn';
  const uiCss = `
html[data-ui]:not([data-ui="default"]) :is(${UI_SURFACES}){
  background: var(--ui-bg) !important; border: var(--ui-border) !important;
  border-radius: var(--ui-radius) !important; box-shadow: var(--ui-shadow) !important;
  backdrop-filter: var(--ui-blur, none) !important; -webkit-backdrop-filter: var(--ui-blur, none) !important;
}
html[data-ui]:not([data-ui="default"]) :is(${UI_INPUTS}){
  background: var(--ui-input-bg, rgba(255,255,255,0.05)) !important;
  border: var(--ui-input-border, 1px solid rgba(255,255,255,0.1)) !important;
  border-radius: var(--ui-input-radius, 10px) !important;
  box-shadow: var(--ui-input-shadow, none) !important;
}

/* ─ SKEUOMORPHISM · tactile, glossy, beveled ─ */
html[data-ui="skeuomorphism"]{ --ui-bg:linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.05) 9%,rgba(255,255,255,0.015) 50%,rgba(0,0,0,0.22)); --ui-border:1px solid rgba(0,0,0,0.45); --ui-radius:13px; --ui-shadow:inset 0 1px 0 rgba(255,255,255,0.55), inset 0 0 0 1px rgba(255,255,255,0.06), 0 2px 3px rgba(0,0,0,0.5), 0 10px 22px -6px rgba(0,0,0,0.6); --ui-input-bg:linear-gradient(180deg,rgba(0,0,0,0.4),rgba(0,0,0,0.15)); --ui-input-border:1px solid rgba(0,0,0,0.5); --ui-input-radius:8px; --ui-input-shadow:inset 0 2px 4px rgba(0,0,0,0.55), inset 0 -1px 0 rgba(255,255,255,0.07); }
html[data-ui="skeuomorphism"] body{ background:linear-gradient(180deg,#2a251e,#171310) fixed !important; }
html[data-ui="skeuomorphism"] :is(${UI_BTNS}){ background:linear-gradient(180deg,#5b5b64,#333339) !important; border:1px solid rgba(0,0,0,0.55) !important; border-radius:10px !important; color:#fff !important; text-shadow:0 -1px 0 rgba(0,0,0,0.5); box-shadow:inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 4px rgba(0,0,0,0.55) !important; }

/* ─ NEOMORPHISM · soft monochrome extrusion (bg = cards) ─ */
html[data-ui="neomorphism"]{ --ui-bg:#23262c; --ui-border:1px solid rgba(255,255,255,0.02); --ui-radius:22px; --ui-shadow:8px 8px 18px rgba(0,0,0,0.55), -8px -8px 18px rgba(255,255,255,0.045); --ui-input-bg:#23262c; --ui-input-border:1px solid transparent; --ui-input-radius:14px; --ui-input-shadow:inset 5px 5px 10px rgba(0,0,0,0.5), inset -5px -5px 10px rgba(255,255,255,0.04); }
html[data-ui="neomorphism"] body{ background:#23262c fixed !important; }
html[data-ui="neomorphism"] :is(${UI_BTNS}){ background:#23262c !important; border:none !important; border-radius:14px !important; box-shadow:5px 5px 10px rgba(0,0,0,0.5), -5px -5px 10px rgba(255,255,255,0.045) !important; }
html[data-theme="light"][data-ui="neomorphism"]{ --ui-bg:#e6e9ef; --ui-shadow:8px 8px 18px rgba(0,0,0,0.12), -8px -8px 18px #ffffff; --ui-input-bg:#e6e9ef; --ui-input-shadow:inset 5px 5px 10px rgba(0,0,0,0.1), inset -5px -5px 10px #ffffff; }
html[data-theme="light"][data-ui="neomorphism"] body{ background:#e6e9ef fixed !important; }

/* ─ GLASSMORPHISM · frosted translucency over colour ─ */
html[data-ui="glassmorphism"]{ --ui-bg:rgba(255,255,255,0.1); --ui-border:1px solid rgba(255,255,255,0.22); --ui-radius:18px; --ui-shadow:0 8px 32px rgba(0,0,0,0.3); --ui-blur:blur(18px) saturate(1.6); --ui-input-bg:rgba(255,255,255,0.08); --ui-input-border:1px solid rgba(255,255,255,0.2); --ui-input-radius:12px; }
html[data-ui="glassmorphism"] body{ background:radial-gradient(at 18% 18%, #6d28d9 0%, transparent 42%), radial-gradient(at 82% 12%, #1d6fb8 0%, transparent 42%), radial-gradient(at 50% 88%, #be185d 0%, transparent 48%), #0a0a14 fixed !important; }

/* ─ CLAYMORPHISM · puffy, inflated clay ─ */
html[data-ui="claymorphism"]{ --ui-bg:linear-gradient(145deg,rgba(255,255,255,0.16),rgba(255,255,255,0.05)); --ui-border:1px solid rgba(255,255,255,0.08); --ui-radius:32px; --ui-shadow:inset 6px 6px 12px rgba(255,255,255,0.12), inset -8px -8px 18px rgba(0,0,0,0.4), 0 22px 44px -12px rgba(0,0,0,0.5); --ui-input-bg:rgba(0,0,0,0.18); --ui-input-border:1px solid transparent; --ui-input-radius:18px; --ui-input-shadow:inset 4px 4px 9px rgba(0,0,0,0.35), inset -3px -3px 7px rgba(255,255,255,0.08); }
html[data-ui="claymorphism"] body{ background:linear-gradient(160deg,#2e2a55,#3b2c58) fixed !important; }
html[data-ui="claymorphism"] :is(${UI_BTNS}){ border-radius:18px !important; box-shadow:inset 2px 2px 5px rgba(255,255,255,0.25), inset -3px -3px 6px rgba(0,0,0,0.3), 0 8px 18px -6px rgba(0,0,0,0.5) !important; }

/* ─ MINIMALISM · flat, bare, typographic ─ */
html[data-ui="minimalism"]{ --ui-bg:rgba(255,255,255,0.022); --ui-border:none; --ui-radius:10px; --ui-shadow:none; --ui-input-bg:transparent; --ui-input-border:none; --ui-input-radius:0px; }
html[data-ui="minimalism"] body{ background:#0b0b0c fixed !important; }
html[data-ui="minimalism"] :is(${UI_INPUTS}){ border-bottom:1px solid rgba(255,255,255,0.16) !important; }
html[data-ui="minimalism"] :is(.section-title,.st-group-label){ font-weight:400 !important; letter-spacing:0.16em !important; opacity:0.65; }
html[data-theme="light"][data-ui="minimalism"]{ --ui-bg:rgba(0,0,0,0.02); }
html[data-theme="light"][data-ui="minimalism"] body{ background:#fbfbfa fixed !important; }
html[data-theme="light"][data-ui="minimalism"] :is(${UI_INPUTS}){ border-bottom:1px solid rgba(0,0,0,0.16) !important; }

/* ─ MAXIMALISM · loud, saturated, bold ─ */
html[data-ui="maximalism"]{ --ui-bg:linear-gradient(135deg, color-mix(in srgb,var(--accent) 30%, #000), rgba(0,0,0,0.55)); --ui-border:3px solid var(--accent); --ui-radius:22px; --ui-shadow:6px 6px 0 var(--accent), 0 22px 50px -12px color-mix(in srgb,var(--accent) 65%, transparent); --ui-input-bg:rgba(0,0,0,0.35); --ui-input-border:2px solid var(--accent); --ui-input-radius:12px; }
html[data-ui="maximalism"] body{ background:linear-gradient(135deg,#ff2d75,#7a2cff 48%,#00c2ff) fixed !important; }
html[data-ui="maximalism"] :is(.section-title,.st-group-label,.dash-title){ color:var(--accent) !important; font-weight:900 !important; letter-spacing:0.02em !important; }

/* ─ BRUTALISM · raw, hard edges, offset shadows, mono ─ */
html[data-ui="brutalism"]{ --ui-bg:#1a1a1c; --ui-border:3px solid #ffffff; --ui-radius:0px; --ui-shadow:8px 8px 0 var(--accent); --ui-input-bg:#0e0e0e; --ui-input-border:2px solid #fff; --ui-input-radius:0px; }
html[data-ui="brutalism"] body{ background:#0c0c0c fixed !important; }
html[data-ui="brutalism"] :is(button,input,select,textarea,.tab,.bottombar-tab,.ui-opt,.gt-day-tab,.st-pbtn,.st-theme-btn,.fr-tab){ border-radius:0 !important; }
html[data-ui="brutalism"] :is(.section-title,.dash-title,.st-title,.gt-card-name,.me-name){ font-family:ui-monospace,"SF Mono",Menlo,monospace !important; text-transform:uppercase; }
html[data-ui="brutalism"] :is(${UI_BTNS}){ background:var(--accent) !important; color:#000 !important; border:3px solid #fff !important; border-radius:0 !important; box-shadow:4px 4px 0 rgba(255,255,255,0.35) !important; font-weight:800 !important; text-shadow:none !important; }
html[data-theme="light"][data-ui="brutalism"]{ --ui-bg:#fff; --ui-border:3px solid #111; --ui-shadow:8px 8px 0 #111; --ui-input-bg:#fff; --ui-input-border:2px solid #111; }
html[data-theme="light"][data-ui="brutalism"] body{ background:#f2f0e9 fixed !important; }

/* ─ LIQUID GLASS · luminous, refractive, glossy ─ */
html[data-ui="liquidglass"]{ --ui-bg:linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0.06)); --ui-border:1px solid rgba(255,255,255,0.35); --ui-radius:26px; --ui-shadow:inset 0 1px 1px rgba(255,255,255,0.65), inset 0 -12px 30px rgba(255,255,255,0.05), 0 20px 55px -12px rgba(0,0,0,0.55); --ui-blur:blur(24px) saturate(2); --ui-input-bg:rgba(255,255,255,0.12); --ui-input-border:1px solid rgba(255,255,255,0.4); --ui-input-radius:16px; }
html[data-ui="liquidglass"] body{ background:radial-gradient(at 28% 18%, rgba(58,160,255,0.5) 0%, transparent 46%), radial-gradient(at 76% 26%, rgba(255,94,199,0.5) 0%, transparent 46%), radial-gradient(at 50% 84%, rgba(34,224,192,0.45) 0%, transparent 50%), #06060c fixed !important; }

/* ─ BENTO GRID · tidy solid tiles ─ */
html[data-ui="bento"]{ --ui-bg:rgba(255,255,255,0.05); --ui-border:1px solid rgba(255,255,255,0.09); --ui-radius:20px; --ui-shadow:inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 16px rgba(0,0,0,0.35); --ui-input-bg:rgba(255,255,255,0.05); --ui-input-border:1px solid rgba(255,255,255,0.09); --ui-input-radius:12px; }
html[data-ui="bento"] body{ background:#0d0d10 fixed !important; }

/* ─ SPATIAL UI · floating translucent panels, deep shadow ─ */
html[data-ui="spatial"]{ --ui-bg:rgba(255,255,255,0.06); --ui-border:1px solid rgba(255,255,255,0.14); --ui-radius:28px; --ui-shadow:0 40px 80px -20px rgba(0,0,0,0.8), 0 8px 22px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18); --ui-blur:blur(20px); --ui-input-bg:rgba(255,255,255,0.08); --ui-input-border:1px solid rgba(255,255,255,0.16); --ui-input-radius:16px; }
html[data-ui="spatial"] body{ background:radial-gradient(at 50% 0%, #1a2340 0%, transparent 60%), #05060a fixed !important; }

/* Light-theme fallback bg for the glassy families */
html[data-theme="light"] :is([data-ui="glassmorphism"],[data-ui="liquidglass"],[data-ui="spatial"],[data-ui="bento"]){ --ui-bg:rgba(0,0,0,0.05); --ui-border:1px solid rgba(0,0,0,0.1); }

/* ══════════════════════════════════════════════════════════════════
   DASHBOARD STYLE · CINEMATIC — dark, hairline, numbered, cyan glow
   (home look; applied via html[data-home="cinematic"])
   ══════════════════════════════════════════════════════════════════ */
html[data-home="cinematic"] body{
  background:
    radial-gradient(130% 90% at 50% -12%, rgba(45,212,191,0.16), rgba(8,11,16,0) 55%),
    radial-gradient(90% 70% at 82% 8%, rgba(56,189,248,0.10), rgba(8,11,16,0) 50%),
    #06090e !important;
  background-attachment: fixed !important;
  color:#e8edf2;
}
html[data-home="cinematic"] .bg-wash{ display:none !important; }

/* Greeting — serif, cinematic, with an uppercase date line */
html[data-home="cinematic"] .dash-title{
  font-family: Georgia, 'Times New Roman', serif !important;
  font-style: italic; font-weight: 500;
  font-size: 30px; letter-spacing: 0.2px; line-height: 1.05;
  color:#f3f6f9; text-shadow:0 1px 22px rgba(45,212,191,0.14);
  margin-bottom: 4px;
}
html[data-home="cinematic"] .dash-title .dt-date{
  display:block; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  font-style:normal; font-size:10.5px; font-weight:700; letter-spacing:0.22em;
  text-transform:uppercase; color:rgba(232,237,242,0.42); margin-top:9px;
}

/* Micro uppercase section titles */
html[data-home="cinematic"] .section-title{
  text-transform:uppercase; font-size:10.5px !important; font-weight:700 !important;
  letter-spacing:0.2em !important; color:rgba(232,237,242,0.4) !important;
}

/* Cards — hairline, dark, glassy */
html[data-home="cinematic"] .mood-card,
html[data-home="cinematic"] .do-now-card,
html[data-home="cinematic"] .day-ring-card,
html[data-home="cinematic"] .gm-card,
html[data-home="cinematic"] .rm-card,
html[data-home="cinematic"] .dash-mini-card{
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015)) !important;
  border:1px solid rgba(255,255,255,0.09) !important;
  border-radius:18px !important;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 34px rgba(0,0,0,0.36) !important;
  -webkit-backdrop-filter: blur(9px) saturate(1.05); backdrop-filter: blur(9px) saturate(1.05);
}

/* Mini-card grid — numbered 01/02…, monochrome, hairline divider */
html[data-home="cinematic"] .dash-grid{ counter-reset: dmc; gap:12px !important; }
html[data-home="cinematic"] .dash-mini-card{ position:relative; padding-top:32px !important; overflow:hidden; }
html[data-home="cinematic"] .dash-mini-card::before{
  counter-increment: dmc; content:"0" counter(dmc);
  position:absolute; top:13px; left:15px; font-size:10px; font-weight:700;
  letter-spacing:0.14em; color:rgba(45,212,191,0.8); font-variant-numeric:tabular-nums;
}
html[data-home="cinematic"] .dash-mini-card::after{
  content:""; position:absolute; left:15px; right:15px; top:29px; height:1px;
  background:linear-gradient(90deg, rgba(255,255,255,0.11), rgba(255,255,255,0));
}
html[data-home="cinematic"] .dm-eyebrow{
  position:absolute; top:13px; right:15px; margin:0 !important;
  text-transform:uppercase; font-size:9.5px !important; letter-spacing:0.18em !important;
  color:rgba(232,237,242,0.42) !important;
}
html[data-home="cinematic"] .dm-value{ font-family: Georgia, serif; font-weight:500; letter-spacing:0.3px; }

/* Day ring — cyan glow instead of amber */
html[data-home="cinematic"] #ringFill{ stroke:#2dd4bf !important; filter:drop-shadow(0 0 6px rgba(45,212,191,0.55)) !important; }
html[data-home="cinematic"] .day-ring-percent{ color:#f3f6f9; }
html[data-home="cinematic"] .day-ring-phase{ color:rgba(45,212,191,0.85) !important; letter-spacing:0.16em; }

/* Ticker, command chips, do-now — hairline dark */
html[data-home="cinematic"] .goal-ticker{
  background:rgba(255,255,255,0.03) !important; border:1px solid rgba(255,255,255,0.08) !important; border-radius:14px !important;
}
html[data-home="cinematic"] .cmd-chip{
  background:rgba(255,255,255,0.035) !important; border:1px solid rgba(255,255,255,0.08) !important; color:rgba(232,237,242,0.85) !important;
}
html[data-home="cinematic"] .do-now-label{ color:rgba(45,212,191,0.85) !important; letter-spacing:0.2em; }

/* Chrome — quiet translucent bars */
html[data-home="cinematic"] .topbar,
html[data-home="cinematic"] .bottombar{
  background:rgba(8,11,16,0.72) !important; -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px);
  border-color:rgba(255,255,255,0.07) !important;
}

/* Shared: every non-Classic style shows the "Good evening" greeting + date line */
html[data-home]:not([data-home="classic"]) .dash-title .dt-date{
  display:block; font-family:ui-sans-serif,system-ui,-apple-system,sans-serif; font-style:normal;
  font-size:10.5px; font-weight:700; letter-spacing:0.22em; text-transform:uppercase;
  margin-top:9px; color:rgba(236,238,244,0.48); -webkit-text-fill-color:rgba(236,238,244,0.48);
}

/* ═══ NEON · synthwave — magenta+cyan glow, glowing borders ═══ */
html[data-home="neon"] .bg-wash{ display:none !important; }
html[data-home="neon"] body{ color:#eae6ff; }
html[data-home="neon"] .dash-title{
  font-weight:900; font-size:27px; letter-spacing:0.5px;
  background:linear-gradient(90deg,#ff2d95,#7a5cff 55%,#2ad4ff); -webkit-background-clip:text; background-clip:text;
  color:transparent; -webkit-text-fill-color:transparent; text-shadow:0 0 26px rgba(255,45,149,0.25);
}
html[data-home="neon"] .dash-title .dt-date{ color:#c9c2ee; -webkit-text-fill-color:#c9c2ee; }
html[data-home="neon"] .section-title{ text-transform:uppercase; letter-spacing:0.22em; font-size:10.5px !important; color:rgba(122,92,255,0.9) !important; }
html[data-home="neon"] :is(.mood-card,.do-now-card,.day-ring-card,.gm-card,.rm-card,.dash-mini-card,.coach-card){
  background:rgba(20,12,36,0.55) !important; border:1px solid rgba(255,45,149,0.28) !important; border-radius:16px !important;
  box-shadow:0 0 0 1px rgba(58,160,255,0.06), 0 0 24px rgba(122,44,255,0.14), inset 0 1px 0 rgba(255,255,255,0.05) !important;
  -webkit-backdrop-filter:blur(8px); backdrop-filter:blur(8px);
}
html[data-home="neon"] .coach-item{ background:rgba(255,45,149,0.06) !important; border-color:rgba(122,92,255,0.22) !important; }
html[data-home="neon"] .coach-dot{ background:#ff2d95 !important; box-shadow:0 0 10px #ff2d95 !important; }
html[data-home="neon"] #ringFill{ stroke:#ff2d95 !important; filter:drop-shadow(0 0 7px rgba(255,45,149,0.7)) !important; }
html[data-home="neon"] .day-ring-phase{ color:#2ad4ff !important; }
html[data-home="neon"] .cmd-chip{ background:rgba(122,92,255,0.12) !important; border:1px solid rgba(122,92,255,0.3) !important; color:#eae6ff !important; }
html[data-home="neon"] .goal-ticker{ background:rgba(20,12,36,0.5) !important; border:1px solid rgba(255,45,149,0.25) !important; }
html[data-home="neon"] :is(.topbar,.bottombar){ background:rgba(10,7,19,0.75) !important; border-color:rgba(122,92,255,0.2) !important; -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); }

/* ═══ AURORA · colorful frosted glass — airy, rounded ═══ */
html[data-home="aurora"] .bg-wash{ display:none !important; }
html[data-home="aurora"] body{ color:#e9eef5; }
html[data-home="aurora"] .dash-title{ font-weight:800; font-size:27px; letter-spacing:-0.01em; color:#f2f6fb; }
html[data-home="aurora"] .section-title{ text-transform:uppercase; letter-spacing:0.16em; font-size:10.5px !important; color:rgba(233,238,245,0.55) !important; }
html[data-home="aurora"] :is(.mood-card,.do-now-card,.day-ring-card,.gm-card,.rm-card,.dash-mini-card,.coach-card){
  background:linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03)) !important;
  border:1px solid rgba(255,255,255,0.16) !important; border-radius:22px !important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), 0 16px 40px -12px rgba(0,0,0,0.5) !important;
  -webkit-backdrop-filter:blur(18px) saturate(1.4); backdrop-filter:blur(18px) saturate(1.4);
}
html[data-home="aurora"] .coach-item{ background:rgba(255,255,255,0.07) !important; border-color:rgba(255,255,255,0.12) !important; border-radius:16px !important; }
html[data-home="aurora"] .coach-dot{ background:linear-gradient(90deg,#38bdf8,#a78bfa) !important; box-shadow:0 0 10px rgba(167,139,250,0.6) !important; }
html[data-home="aurora"] #ringFill{ stroke:#a78bfa !important; filter:drop-shadow(0 0 6px rgba(167,139,250,0.6)) !important; }
html[data-home="aurora"] .day-ring-phase{ color:rgba(56,189,248,0.9) !important; }
html[data-home="aurora"] .cmd-chip{ background:rgba(255,255,255,0.09) !important; border:1px solid rgba(255,255,255,0.16) !important; }
html[data-home="aurora"] .goal-ticker{ background:rgba(255,255,255,0.06) !important; border:1px solid rgba(255,255,255,0.14) !important; border-radius:18px !important; }
html[data-home="aurora"] :is(.topbar,.bottombar){ background:rgba(10,14,23,0.6) !important; border-color:rgba(255,255,255,0.1) !important; -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); }

/* ═══ EMBER · warm cozy — amber glow, serif greeting ═══ */
html[data-home="ember"] .bg-wash{ display:none !important; }
html[data-home="ember"] body{ color:#f0e7dc; }
html[data-home="ember"] .dash-title{
  font-family:Georgia,'Times New Roman',serif !important; font-style:italic; font-weight:500;
  font-size:30px; letter-spacing:0.2px; color:#f6ede1; text-shadow:0 1px 22px rgba(251,146,60,0.16);
}
html[data-home="ember"] .dash-title .dt-date{ color:rgba(240,231,220,0.5); -webkit-text-fill-color:rgba(240,231,220,0.5); }
html[data-home="ember"] .section-title{ text-transform:uppercase; letter-spacing:0.2em; font-size:10.5px !important; color:rgba(251,191,120,0.75) !important; }
html[data-home="ember"] :is(.mood-card,.do-now-card,.day-ring-card,.gm-card,.rm-card,.dash-mini-card,.coach-card){
  background:linear-gradient(180deg, rgba(255,235,215,0.055), rgba(255,235,215,0.02)) !important;
  border:1px solid rgba(251,146,60,0.18) !important; border-radius:16px !important;
  box-shadow:inset 0 1px 0 rgba(255,240,220,0.06), 0 12px 30px rgba(0,0,0,0.4) !important;
}
html[data-home="ember"] .coach-item{ background:rgba(251,146,60,0.06) !important; border-color:rgba(251,146,60,0.16) !important; }
html[data-home="ember"] .coach-dot{ background:#fb923c !important; box-shadow:0 0 9px rgba(251,146,60,0.7) !important; }
html[data-home="ember"] #ringFill{ stroke:#fb923c !important; filter:drop-shadow(0 0 6px rgba(251,146,60,0.6)) !important; }
html[data-home="ember"] .day-ring-phase{ color:rgba(251,191,120,0.9) !important; }
html[data-home="ember"] .cmd-chip{ background:rgba(251,146,60,0.10) !important; border:1px solid rgba(251,146,60,0.24) !important; color:#f0e7dc !important; }
html[data-home="ember"] .goal-ticker{ background:rgba(255,235,215,0.04) !important; border:1px solid rgba(251,146,60,0.2) !important; }
html[data-home="ember"] :is(.topbar,.bottombar){ background:rgba(16,11,8,0.75) !important; border-color:rgba(251,146,60,0.16) !important; -webkit-backdrop-filter:blur(14px); backdrop-filter:blur(14px); }

/* ═══ MONO · stark monochrome — hairline, no color, minimal ═══ */
html[data-home="mono"] body{ background:#0b0b0c !important; background-attachment:fixed !important; color:#e7e7e8; }
html[data-home="mono"] .bg-wash{ display:none !important; }
html[data-home="mono"] .dash-title{ font-weight:800; font-size:26px; letter-spacing:-0.02em; color:#fafafa; }
html[data-home="mono"] .dash-title .dt-date{ color:rgba(231,231,232,0.42); -webkit-text-fill-color:rgba(231,231,232,0.42); }
html[data-home="mono"] .section-title{ text-transform:uppercase; letter-spacing:0.24em; font-size:10px !important; font-weight:700 !important; color:rgba(231,231,232,0.38) !important; }
html[data-home="mono"] :is(.mood-card,.do-now-card,.day-ring-card,.gm-card,.rm-card,.dash-mini-card,.coach-card){
  background:transparent !important; border:1px solid rgba(255,255,255,0.12) !important; border-radius:12px !important; box-shadow:none !important;
}
html[data-home="mono"] .coach-item{ background:transparent !important; border-color:rgba(255,255,255,0.10) !important; border-radius:10px !important; }
html[data-home="mono"] .coach-dot{ background:#fafafa !important; box-shadow:none !important; }
html[data-home="mono"] #ringFill{ stroke:#fafafa !important; filter:none !important; }
html[data-home="mono"] .day-ring-phase{ color:rgba(231,231,232,0.6) !important; letter-spacing:0.18em; }
html[data-home="mono"] .cmd-chip{ background:transparent !important; border:1px solid rgba(255,255,255,0.14) !important; color:rgba(231,231,232,0.85) !important; }
html[data-home="mono"] .goal-ticker{ background:transparent !important; border:1px solid rgba(255,255,255,0.12) !important; }
html[data-home="mono"] :is(.topbar,.bottombar){ background:rgba(11,11,12,0.85) !important; border-color:rgba(255,255,255,0.08) !important; }
html[data-home="mono"] .dash-grid{ counter-reset:dmm; }
html[data-home="mono"] .dash-mini-card{ position:relative; padding-top:30px !important; }
html[data-home="mono"] .dash-mini-card::before{ counter-increment:dmm; content:"0" counter(dmm); position:absolute; top:12px; left:14px; font-size:10px; font-weight:700; letter-spacing:0.12em; color:rgba(255,255,255,0.35); }
`;
  function injectUiStyle() {
    if (document.getElementById('ui-style')) return;
    const u = document.createElement('style'); u.id = 'ui-style'; u.textContent = uiCss;
    document.head.appendChild(u);
  }
  // Live-apply from settings (CSS is injected globally; just toggle the attribute)
  window.dashApplyUi = function (v) {
    v = v || 'default';
    injectUiStyle();
    document.documentElement.setAttribute('data-ui', v);
    // keep the critical early-bg in sync so switching back to Default clears it
    let ue = document.getElementById('ui-early');
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    const bg = dark ? UI_BG[v] : (UI_BG_LIGHT[v] || UI_BG[v]);
    if (bg) {
      if (!ue) { ue = document.createElement('style'); ue.id = 'ui-early'; document.head.appendChild(ue); }
      ue.textContent = 'body{background:' + bg + ' !important; background-attachment:fixed !important;}';
    } else if (ue) { ue.textContent = ''; }
  };

  // Cinematic greeting: turn "My Dashboard" into "Good evening" + a date line.
  function applyHomeGreeting() {
    const el = document.querySelector('.dash-title');
    if (!el) return;
    const home = document.documentElement.getAttribute('data-home') || 'classic';
    const cine = home !== 'classic';
    if (cine) {
      if (!el.dataset.origTitle) el.dataset.origTitle = el.textContent;
      const h = new Date().getHours();
      let g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      let nm = ''; try { nm = (readSettings().name || '').trim(); } catch (e) {}
      if (nm) g += ', ' + nm;
      const d = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
      el.innerHTML = g + '<span class="dt-date">' + d + '</span>';
    } else if (el.dataset.origTitle) {
      el.textContent = el.dataset.origTitle;
    }
  }
  window.dashApplyHome = function (v) {
    v = v || 'classic';
    document.documentElement.setAttribute('data-home', v);
    let he = document.getElementById('home-early');
    const bg = HOME_BG[v];
    if (bg) {
      if (!he) { he = document.createElement('style'); he.id = 'home-early'; document.head.appendChild(he); }
      he.textContent = 'body{background:' + bg + ' !important; background-attachment:fixed !important;}';
    } else if (he) { he.textContent = ''; }
    applyHomeGreeting();
  };

  function buildTabEl(tab) {
    const a = document.createElement('a');
    a.href = tab.href; a.className = 'bottombar-tab'; a.setAttribute('data-page', tab.key);
    a.innerHTML = '<span class="bottombar-tab-icon">' + tab.icon + '</span><span>' + tab.label + '</span>';
    return a;
  }
  function closeMoreSheet() {
    const bd = document.getElementById('navMoreBackdrop'), sheet = document.getElementById('navMoreSheet');
    if (bd) bd.classList.remove('show');
    if (sheet) sheet.classList.remove('show');
  }
  function openMoreSheet(leftover) {
    let bd = document.getElementById('navMoreBackdrop'), sheet = document.getElementById('navMoreSheet');
    if (!bd) { bd = document.createElement('div'); bd.className = 'nav-more-backdrop'; bd.id = 'navMoreBackdrop'; document.body.appendChild(bd); bd.addEventListener('click', closeMoreSheet); }
    if (!sheet) { sheet = document.createElement('div'); sheet.className = 'nav-more-sheet'; sheet.id = 'navMoreSheet'; document.body.appendChild(sheet); }
    const active = currentPageKey();
    const navMap = (SKINS[getSkin()] && SKINS[getSkin()].nav) || null;
    sheet.innerHTML = '<div class="nav-more-grip"></div><div class="nav-more-title">More</div>' +
      leftover.map((t) => '<a class="nav-more-item' + (t.key === active ? ' active' : '') + '" href="' + t.href + '">' +
        '<span class="nav-more-item-icon">' + ((navMap && navMap[t.key]) || t.icon) + '</span>' +
        '<span class="nav-more-item-label">' + t.label + '</span></a>').join('');
    requestAnimationFrame(() => { bd.classList.add('show'); sheet.classList.add('show'); });
  }
  function makeBottombar() {
    const nav = document.createElement('nav');
    nav.className = 'bottombar'; nav.id = 'bottombar';
    nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'Main tabs');
    const { visible, leftover } = resolveNav();
    const active = currentPageKey();
    visible.forEach((t) => { const el = buildTabEl(t); if (t.key === active) el.classList.add('active'); nav.appendChild(el); });
    if (leftover.length) {
      const more = document.createElement('button');
      more.type = 'button'; more.className = 'bottombar-tab more-tab'; more.setAttribute('data-page', 'more');
      more.innerHTML = '<span class="bottombar-tab-icon">⋯</span><span>More</span>';
      if (leftover.some((t) => t.key === active)) more.classList.add('active');
      more.addEventListener('click', () => openMoreSheet(leftover));
      nav.appendChild(more);
    }
    return nav;
  }
  function applySkinIconsTo(nav) {
    const navMap = SKINS[getSkin()] && SKINS[getSkin()].nav;
    if (!navMap) return;
    nav.querySelectorAll('.bottombar-tab').forEach((t) => {
      const k = t.getAttribute('data-page');
      const ic = t.querySelector('.bottombar-tab-icon');
      if (ic && navMap[k]) ic.textContent = navMap[k];
    });
  }
  // Rebuild the bar live (used by settings.html when the nav config changes)
  window.dashRebuildNav = function () {
    const old = document.getElementById('bottombar');
    if (!old) return;
    closeMoreSheet();
    const nav = makeBottombar();
    old.replaceWith(nav);
    applySkinIconsTo(nav);
  };

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
    if (p.endsWith('friends.html')) return 'friends';
    if (p.endsWith('settings.html')) return 'settings';
    return 'main';
  }

  // Block direct access (by URL) to a page the user has hidden via onboarding
  // or kids mode. Runs only on the real top-level page (never the embedded
  // finance widget), and sends them home so a kid can't reach finance.html etc.
  function guardPageAccess() {
    try {
      if (isEmbedded()) return false;
      const p = (window.location.pathname || '').toLowerCase();
      let key = null;
      if (p.endsWith('finance.html')) key = 'finance';
      else if (p.endsWith('projects.html')) key = 'projects';
      else if (p.endsWith('trends.html') || p.endsWith('summary.html')) key = 'trends';
      else if (p.endsWith('transport.html')) key = 'transport';
      else if (p.endsWith('friends.html')) key = 'friends';
      else if (p.endsWith('school.html')) key = 'school';
      else if (p.endsWith('habits.html')) key = 'habits';
      else if (p.endsWith('gym.html')) key = 'fitness';
      else if (p.endsWith('health.html')) key = 'health';
      if (key && !pageVisible(key)) { window.location.replace('index.html'); return true; }
    } catch (e) {}
    return false;
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
    // Hide the top-bar finance shortcut if finance is turned off (kids mode).
    if (!pageVisible('finance')) {
      const fb = document.getElementById('topbarFinance');
      if (fb) fb.remove();
    }
    // Bottom tabs on all non-finance, non-iframe pages
    if (!document.getElementById('bottombar')) {
      if (!document.getElementById('nav-extra-style')) {
        const ns = document.createElement('style'); ns.id = 'nav-extra-style'; ns.textContent = navExtraCss;
        document.head.appendChild(ns);
      }
      document.body.appendChild(makeBottombar());
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
    // Only trust the in-memory health store when actually ON the health page;
    // elsewhere (home pill) localStorage is the durable source of truth.
    if (currentPageKey() === 'health' && window._dbH && window._dbH['po_water_v1']) {
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
    // New ml model (logs store millilitres); flagged with _mlV2.
    if (state._mlV2) return { done: done, total: Math.max(1, Math.round(totalMl)), ml: true };
    // Legacy count model.
    let unitVol;
    if (state.unit === 'glass') unitVol = state.glassMl || 250;
    else if (state.unit === 'oz') unitVol = 30;
    else if (state.unit === 'ml') unitVol = 1;
    else unitVol = state.bottleMl || 500;
    const total = Math.max(1, Math.ceil(totalMl / unitVol));
    return { done, total, ml: false };
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
    if (countEl) {
      if (w.ml) countEl.textContent = (w.done / 1000).toFixed(1) + '/' + (w.total / 1000).toFixed(1) + 'L';
      else countEl.textContent = w.total ? w.done + '/' + w.total : '0/0';
    }
    setPillStatus(waterEl, classifyStatus(w.done, w.total));
  }

  function defaultWaterState() {
    return {
      unit: 'bottle', bottleMl: 500, glassMl: 250, weightUnit: 'kg',
      sizes: { cup: 250, bottle: 500, big: 1000 }, _mlV2: true,
      profile: { weightKg: 75, age: 25, sex: 'm', activityHrsPerWeek: 5 },
      caffeineMgPerDay: 200, substances: [], logs: {}
    };
  }
  async function pushWaterMergedToSupabase(localWater) {
    if (!window.supabase || !TOPBAR_SUPABASE_URL || !TOPBAR_SUPABASE_KEY) return;
    if (TOPBAR_SUPABASE_URL.indexOf('PASTE-') === 0) return;
    try {
      if (!_waterSb) _waterSb = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      const supa = _waterSb; // reuse one client to avoid extra auth instances
      let _wUid = null;
      try { const { data: { session } } = await supa.auth.getSession(); _wUid = session && session.user && session.user.id; } catch (e) {}
      if (!_wUid) _wUid = localStorage.getItem('_dashUid');
      const _wKey = _wUid ? _wUid + ':health' : 'health';
      const { data } = await supa
        .from('app_state').select('data').eq('key', _wKey).maybeSingle();
      const current = (data && data.data) || {};
      // Always stamp _pushAt so health.html's poll detects the change
      const _pa = Date.now();
      const merged = Object.assign({}, current, { po_water_v1: localWater, _pushAt: _pa });
      await supa.from('app_state').upsert(
        { key: _wKey, data: merged, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      _lastWaterRemoteAt = _pa; // don't let our own push re-trigger a pull
    } catch (e) {}
  }
  // Pull the latest water from the cloud so the home pill reflects logs made
  // on other devices (phone → PC), live, no refresh. Uses the cloud row's
  // push marker (_pushAt) for change detection — NOT wall-clock time — so
  // clock differences between devices can't defeat it.
  let _waterSb = null;
  let _lastWaterRemoteAt = -1;
  let _waterLocalAt = 0;
  // Let the health page mark a just-logged local change so the pull below doesn't
  // clobber it before it's pushed.
  window.dashWaterTouched = function () { _waterLocalAt = Date.now(); };

  // Pull settings (theme, skin/"characters", accent, styles) from the cloud so a
  // change made on one device shows on all pages of the others — not just Settings.
  let _settingsSb = null;
  let _lastSettingsStr = null;
  async function pullSettingsFromCloud() {
    try {
      if (!window.supabase) return;
      if (currentPageKey() === 'settings') return; // settings page manages its own save/load
      const uid = localStorage.getItem('_dashUid');
      if (!uid) return;
      if (!_settingsSb) _settingsSb = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      try { await _settingsSb.auth.getSession(); } catch (e) {}
      const { data, error } = await _settingsSb.from('app_state').select('data').eq('key', uid + ':settings').maybeSingle();
      if (error) { _settingsSb = null; return; }
      const cloud = data && data.data;
      if (!cloud || typeof cloud !== 'object') return;
      const cloudStr = JSON.stringify(cloud);
      if (cloudStr === (localStorage.getItem('dashboard:settings:v1') || '')) { _lastSettingsStr = cloudStr; return; }
      if (cloudStr === _lastSettingsStr) return; // already applied this cloud version
      _lastSettingsStr = cloudStr;
      localStorage.setItem('dashboard:settings:v1', cloudStr);
      if (typeof window.applyDashSettings === 'function') window.applyDashSettings(cloud);
      // Page visibility may have changed (kids mode toggled elsewhere) — rebuild
      // the nav live, and boot the current page out if it just got hidden.
      try { if (typeof window.dashRebuildNav === 'function') window.dashRebuildNav(); } catch (e) {}
      try {
        const fb = document.getElementById('topbarFinance');
        if (fb && !pageVisible('finance')) fb.remove();
      } catch (e) {}
      try { guardPageAccess(); } catch (e) {}
    } catch (e) {}
  }
  async function pullWaterFromCloud() {
    try {
      if (!window.supabase) return;
      const onHealth = currentPageKey() === 'health';
      const pill = document.getElementById('topbarWater');
      if (!pill && !onHealth) return; // only run where water is shown (home pill or health page)
      if (Date.now() - _waterLocalAt < 4000) return; // let our own just-logged water push land first
      if (!_waterSb) _waterSb = window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY);
      // Ensure a fresh, valid session before querying. With multiple auth clients
      // a cached client's token can go stale and make the query silently return
      // nothing (the app fails while a fresh console read works). getSession()
      // reloads/refreshes the token; on error we drop the client so it rebuilds.
      let uid = null;
      try { const { data: { session } } = await _waterSb.auth.getSession(); uid = session && session.user && session.user.id; } catch (e) {}
      if (!uid) uid = localStorage.getItem('_dashUid');
      if (!uid) return;
      const { data, error } = await _waterSb.from('app_state').select('data').eq('key', uid + ':health').maybeSingle();
      if (error) { _waterSb = null; return; }
      if (!data || !data.data) return;
      const remoteAt = data.data._pushAt || 0;
      if (remoteAt === _lastWaterRemoteAt) return; // nothing changed in the cloud since last check
      _lastWaterRemoteAt = remoteAt;
      const cloudWater = data.data['po_water_v1'];
      if (!cloudWater) return;
      localStorage.setItem('po_water_v1', JSON.stringify(cloudWater));
      if (onHealth && window._dbH) {
        // Drive the health page's water tracker with this proven mechanism.
        window._dbH['po_water_v1'] = cloudWater;
        try { if (typeof window.wRenderAll === 'function') window.wRenderAll(); } catch (e) {}
      } else {
        render();
      }
    } catch (e) {}
  }

  // Force a fresh pull + re-render (used when returning to the tab): reset the
  // change marker so the next pull always re-applies, even if a background poll
  // already advanced the marker without the DOM visibly updating.
  function forceWaterSync() { try { _lastWaterRemoteAt = -1; render(); pullWaterFromCloud(); pullSettingsFromCloud(); } catch (e) {} }

  // Self-contained live-sync wiring so no unrelated boot error can disable it.
  let _waterLiveOn = false;
  function setupWaterLiveSync() {
    if (_waterLiveOn) return;
    _waterLiveOn = true;
    try {
      window.addEventListener('focus', forceWaterSync);
      window.addEventListener('pageshow', forceWaterSync);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) forceWaterSync(); });
      setInterval(pullWaterFromCloud, 4000); // poll every 4s so the pill updates on its own
      setInterval(pullSettingsFromCloud, 12000); // pull theme/skin changes from other devices
      pullSettingsFromCloud();
    } catch (e) {}
  }

  function addWater() {
    let state = null;
    // On health.html ONLY, use the shared sync store so the change goes through
    // health sync. Everywhere else (home pill) persist to localStorage so it
    // survives reload — a stray window._dbH must not send water to memory.
    if (currentPageKey() === 'health' && window._dbH && typeof window._dbHSchedulePush === 'function') {
      state = window._dbH['po_water_v1'] ? JSON.parse(JSON.stringify(window._dbH['po_water_v1'])) : defaultWaterState();
      state.logs = state.logs || {};
      const k = calendarDateKey();
      const _winc = state._mlV2 ? ((state.sizes && state.sizes.bottle) || 500) : 1;
      state.logs[k] = (state.logs[k] || 0) + _winc;
      if (state._mlV2) { state.hist = state.hist || {}; (state.hist[k] = state.hist[k] || []).push(_winc); }
      window._dbH['po_water_v1'] = state;
      window._dbHSchedulePush();
    } else {
      try { state = JSON.parse(localStorage.getItem('po_water_v1')); } catch (e) {}
      if (!state || typeof state !== 'object') state = defaultWaterState();
      state.logs = state.logs || {};
      const k = calendarDateKey();
      const _winc = state._mlV2 ? ((state.sizes && state.sizes.bottle) || 500) : 1;
      state.logs[k] = (state.logs[k] || 0) + _winc;
      if (state._mlV2) { state.hist = state.hist || {}; (state.hist[k] = state.hist[k] || []).push(_winc); }
      state._ts = Date.now();
      _waterLocalAt = Date.now();
      try { localStorage.setItem('po_water_v1', JSON.stringify(state)); } catch (e) {}
      pushWaterMergedToSupabase(state);
    }
    render();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 220); }
    spawnWaterBurst();
    if (_buddyOnWater) _buddyOnWater();
    if (window.dashAddXpCapped) window.dashAddXpCapped(5, 'Drank water 💧', 'water', 8);
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
    // Respect the Settings on/off toggle for the floating buddy (default on)
    let _buddyOn = readSettings().buddy !== 'off';
    window.dashApplyBuddy = function (on) { _buddyOn = on !== false; buddy.hidden = !_buddyOn; };
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
    // Bonus buddy lines unlocked as your level climbs (leveling "gives" something)
    const LEVEL_LINES = [[5, "Level 5 already? You're on a roll. 🚀"], [10, "Double digits — look at you go! ⭐"], [20, "Level 20… that's serious dedication. 💎"], [35, "Honestly? You inspire ME now. 🌟"]];
    function curLevel() { try { return levelInfo(xpLoad().total).level; } catch (e) { return 1; } }
    function personaLines() {
      const lv = curLevel();
      return persona.lines.concat(LEVEL_LINES.filter((l) => lv >= l[0]).map((l) => l[1]));
    }
    function generateReply(text) {
      const intent = classify(text);
      if (intent === 'whoareyou') return { text: persona.intro, mood: 'cool' };
      const pool = REPLY[intent] || REPLY.fallback;
      let reply;
      // Persona flavor: sometimes answer with the character's own (level-unlocked) lines
      if ((intent === 'motivate' || intent === 'greet' || intent === 'win') && Math.random() < 0.45) {
        const pl = personaLines(); reply = pl[Math.floor(Math.random() * pl.length)];
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

    // ── Weekly recap ──
    function recapDateStr(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function weeklyRecap() {
      const days = []; const now = new Date();
      for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(recapDateStr(d)); }
      const lines = [];
      if (typeof window.storeGet === 'function') {
        try {
          let total = 0, done = 0;
          days.forEach((ds) => { const g = window.storeGet('goals:' + ds) || []; total += g.length; done += g.filter((x) => x.done).length; });
          if (total) lines.push('✅ Goals: ' + done + '/' + total + ' done');
          const streak = (window.storeGet('goal_streak_v1') || {}).count || 0;
          if (streak) lines.push('🔥 Streak: ' + streak + ' day' + (streak > 1 ? 's' : ''));
          const mood = (window.storeGet('dashboard:mood:v1') || {}).entries || [];
          const wk = mood.filter((e) => days.indexOf(e.date) !== -1 && e.score);
          if (wk.length) lines.push('🙂 Mood: avg ' + (wk.reduce((s, e) => s + e.score, 0) / wk.length).toFixed(1) + '/5 (' + wk.length + ' logs)');
        } catch (e) {}
      }
      try {
        const w = JSON.parse(localStorage.getItem('po_coach_weights')) || [];
        const r = w.filter((e) => days.indexOf(e.dateKey) !== -1);
        if (r.length >= 2) { const diff = r[r.length - 1].weight - r[0].weight; lines.push('⚖️ Weight: ' + (diff >= 0 ? '+' : '') + diff.toFixed(1)); }
        else if (r.length === 1) lines.push('⚖️ Weight: ' + r[0].weight);
      } catch (e) {}
      try {
        const ws = JSON.parse(localStorage.getItem('po_water_v1')) || {}; const logs = ws.logs || {};
        let cups = 0; days.forEach((ds) => { cups += logs[ds] || 0; });
        if (cups) lines.push('💧 Water: ' + cups + ' logged');
      } catch (e) {}
      try {
        const xp = JSON.parse(localStorage.getItem('dashboard:xp:v1')) || {}; const log = xp.log || [];
        const weekAgo = Date.now() - 7 * 864e5;
        const gained = log.filter((e) => e.t >= weekAgo).reduce((s, e) => s + (e.a || 0), 0);
        if (gained) lines.push('⭐ XP: +' + gained + ' earned');
      } catch (e) {}
      return lines;
    }
    function doRecap() {
      const lines = weeklyRecap();
      const head = '📊 Here\'s your week:';
      const tail = lines.length
        ? ['Proud of you — let\'s make next week even better. 💪', 'Solid week. Keep the momentum rolling! 🚀', 'Look at all that. You showed up. ⭐'][Math.floor(Math.random() * 3)]
        : 'Not much logged this week yet — let\'s change that! Open the app daily and I\'ll track it all. 🚀';
      const body = lines.length ? (head + '\n' + lines.join('\n') + '\n\n' + tail) : tail;
      botReply(body, 'party', lines.length >= 3);
    }

    // Quick-reply chips ('__recap__' is special)
    const CHIPS = [['📊 My week', '__recap__'], ['💪 Motivate me', 'motivate me'], ['😴 I\'m tired', "i'm tired"], ['🎯 My goals', 'my goals'], ['😂 Tell a joke', 'tell me a joke']];
    CHIPS.forEach(([label, payload]) => {
      const c = document.createElement('button');
      c.className = 'bc-chip'; c.type = 'button'; c.textContent = label;
      c.addEventListener('click', () => { if (payload === '__recap__') { pushMsg('user', '📊 How was my week?'); doRecap(); } else sendUser(payload); });
      bcChips.appendChild(c);
    });

    // ── Open / close chat ──
    let opened = false;
    function openChat() {
      panel.classList.add('open');
      buddy.hidden = true;
      renderHistory();
      if (getMsgs().length === 0) {
        botReply(persona.intro, 'happy'); // first-ever open
      } else if (!opened) {
        const ctx = contextLine();
        botReply(ctx.length ? ctx[0] : pickGreet(), 'happy'); // welcome back
      }
      // Auto-offer a recap on Sundays, once per week
      try {
        const wk = recapDateStr(new Date()).slice(0, 7) + '-w' + Math.ceil(new Date().getDate() / 7);
        if (new Date().getDay() === 0 && localStorage.getItem('buddy_recap_week') !== wk) {
          localStorage.setItem('buddy_recap_week', wk);
          setTimeout(doRecap, 1400);
        }
      } catch (e) {}
      opened = true;
      setTimeout(() => bcInput.focus({ preventScroll: true }), 200);
    }
    function pickGreet() { return ["Welcome back! 😄 What's up?", "Hey, missed you! How's it going?", "There you are! Ready to win?"][Math.floor(Math.random() * 3)]; }
    function closeChat() { panel.classList.remove('open'); buddy.hidden = !_buddyOn; }
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

    loadPersona(); renderMeters(); updateStatus(); loadPos(); buddy.hidden = !_buddyOn;
  }

  // =============================================================
  // XP & LEVELS — earn XP across the app; a top-bar chip shows your
  // level + progress and opens a full breakdown. Each gain pops an
  // iOS-style banner. XP is monotonic, so cross-device sync just
  // takes the max total. window.dashAddXp(amount, reason, opts).
  // =============================================================
  const XP_KEY = 'dashboard:xp:v1';
  // Reference table (also shown in the modal). Daily-capped ones use a claim key.
  const XP_RATES = [
    { reason:'Daily check-in',     amount:20, daily:'login',  icon:'📅' },
    { reason:'Logged your weight', amount:25, daily:'weight', icon:'⚖️' },
    { reason:'Logged your mood',   amount:10, daily:'mood',   icon:'🙂' },
    { reason:'Completed a habit',  amount:15, icon:'🔥' },
    { reason:'Completed a goal',   amount:10, icon:'✅' },
    { reason:'Cleared all goals',  amount:50, daily:'allgoals', icon:'🏆' },
    { reason:'Logged a meal',      amount:8,  icon:'🍽️' },
    { reason:'Logged a workout',   amount:12, icon:'💪' },
    { reason:'Drank water (+1)',   amount:5,  icon:'💧' },
  ];

  const FREEZE_COST = 150; // spendable XP per streak freeze
  // Achievement badges — each tests against the xp state (counts/level/streak/etc.)
  const ACHIEVEMENTS = [
    { id:'first_xp',   icon:'✨', name:'First Steps',    desc:'Earn your first XP',            test:(s) => s.total > 0 },
    { id:'lv5',        icon:'🌱', name:'Getting Going',   desc:'Reach Level 5',                 test:(s) => levelInfo(s.total).level >= 5 },
    { id:'lv10',       icon:'⭐', name:'Rising Star',     desc:'Reach Level 10',                test:(s) => levelInfo(s.total).level >= 10 },
    { id:'lv25',       icon:'🌟', name:'Seasoned',        desc:'Reach Level 25',                test:(s) => levelInfo(s.total).level >= 25 },
    { id:'goals10',    icon:'✅', name:'Go-Getter',       desc:'Complete 10 goals',             test:(s) => (s.counts.goal || 0) >= 10 },
    { id:'goals100',   icon:'🏅', name:'Centurion',       desc:'Complete 100 goals',            test:(s) => (s.counts.goal || 0) >= 100 },
    { id:'allgoals',   icon:'🧹', name:'Clean Sweep',     desc:'Clear all goals in a day',      test:(s) => (s.counts.allgoals || 0) >= 1 },
    { id:'habit25',    icon:'🔥', name:'Habitual',        desc:'Complete 25 habits',            test:(s) => (s.counts.habit || 0) >= 25 },
    { id:'weight7',    icon:'⚖️', name:'On the Scale',    desc:'Log your weight 7 times',       test:(s) => (s.counts.weight || 0) >= 7 },
    { id:'water50',    icon:'💧', name:'Well Hydrated',   desc:'Log water 50 times',            test:(s) => (s.counts.water || 0) >= 50 },
    { id:'mood7',      icon:'🙂', name:'Self-Aware',      desc:'Log your mood 7 times',         test:(s) => (s.counts.mood || 0) >= 7 },
    { id:'meal30',     icon:'🍽️', name:'Meal Prepper',    desc:'Log 30 meals',                  test:(s) => (s.counts.meal || 0) >= 30 },
    { id:'perfectday', icon:'👑', name:'Perfect Day',     desc:'Earn XP in 5 categories in one day', test:(s) => Object.keys(s.dayCats || {}).some((d) => (s.dayCats[d] || []).length >= 5) },
    { id:'streak7',    icon:'📅', name:'Consistent',      desc:'Reach a 7-day goal streak',     test:(s) => (s.maxStreak || 0) >= 7 },
    { id:'streak30',   icon:'💎', name:'Unbreakable',     desc:'Reach a 30-day goal streak',    test:(s) => (s.maxStreak || 0) >= 30 },
  ];

  function xpToday() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function xpYesterday() {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function xpLoad() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(XP_KEY)); } catch (e) {}
    if (!s || typeof s.total !== 'number') s = { total: 0 };
    s.claims = s.claims || {}; s.log = s.log || []; s.counts = s.counts || {}; s.dayCats = s.dayCats || {};
    s.badges = s.badges || {}; s.spent = s.spent || 0; s.freezesBought = s.freezesBought || 0;
    s.freezesUsed = s.freezesUsed || 0; s.maxStreak = s.maxStreak || 0; s.dayCaps = s.dayCaps || {};
    return s;
  }
  // Infer a category from the reason text (so page hooks don't need to pass one)
  function catOf(reason) {
    const r = (reason || '').toLowerCase();
    if (r.indexOf('all goal') !== -1) return 'allgoals';
    if (r.indexOf('goal') !== -1) return 'goal';
    if (r.indexOf('habit') !== -1) return 'habit';
    if (r.indexOf('weight') !== -1) return 'weight';
    if (r.indexOf('mood') !== -1) return 'mood';
    if (r.indexOf('meal') !== -1) return 'meal';
    if (r.indexOf('workout') !== -1) return 'workout';
    if (r.indexOf('water') !== -1) return 'water';
    if (r.indexOf('check-in') !== -1) return 'login';
    return 'other';
  }
  function checkAchievements(s, silent) {
    let changed = false;
    ACHIEVEMENTS.forEach((a) => {
      if (!s.badges[a.id]) { try { if (a.test(s)) { s.badges[a.id] = Date.now(); changed = true; if (!silent) { _xpQueue.push({ ach: a }); postActivity('badge', 'unlocked the "' + a.name + '" badge ' + a.icon); } } } catch (e) {} }
    });
    if (changed) { xpSave(s); if (!silent) runXpToast(); }
    return changed;
  }
  function freezesOwned(s) { s = s || xpLoad(); return Math.max(0, (s.freezesBought || 0) - (s.freezesUsed || 0)); }
  function spendable(s) { s = s || xpLoad(); return Math.max(0, s.total - (s.spent || 0)); }
  // Public helpers for streak freeze (used by index.html)
  window.dashGetFreezes = () => freezesOwned();
  window.dashUseFreeze = () => {
    const s = xpLoad();
    if (freezesOwned(s) <= 0) return false;
    s.freezesUsed = (s.freezesUsed || 0) + 1; xpSave(s);
    clearTimeout(_xpCloudTimer); _xpCloudTimer = setTimeout(xpCloudPush, 1200);
    return true;
  };
  window.dashNoteStreak = (count) => {
    const s = xpLoad();
    s.curStreak = count || 0;
    if (s.curStreak > (s.maxStreak || 0)) s.maxStreak = s.curStreak;
    xpSave(s); checkAchievements(s); scheduleProfileSync();
  };

  // ── Friends: keep your public profile card fresh + post activity ──
  let _profTimer = null;
  function scheduleProfileSync() { clearTimeout(_profTimer); _profTimer = setTimeout(syncFriendProfile, 1500); }
  function weekXp(s) {
    const now = new Date(), day = (now.getDay() + 6) % 7, mon = new Date(now);
    mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
    return (s.log || []).filter((e) => e.t >= mon.getTime()).reduce((a, e) => a + (e.a || 0), 0);
  }
  async function syncFriendProfile() {
    let p = null; try { p = JSON.parse(localStorage.getItem('friend_profile')); } catch (e) {}
    if (!p || !p.username) return; // no profile published yet
    const supa = xpSupa(); if (!supa) return;
    const uid = await xpUid(supa); if (!uid) return;
    const s = xpLoad();
    try {
      await supa.from('profiles').update({
        level: levelInfo(s.total).level, xp: s.total, xp_week: weekXp(s),
        streak: s.curStreak || 0, skin: getSkin(), updated_at: new Date().toISOString(),
      }).eq('id', uid);
    } catch (e) {}
  }
  function postActivity(kind, text) {
    let p = null; try { p = JSON.parse(localStorage.getItem('friend_profile')); } catch (e) {}
    if (!p || !p.username) return;
    const supa = xpSupa(); if (!supa) return;
    xpUid(supa).then((uid) => { if (uid) supa.from('activity').insert({ user_id: uid, kind, text }).then(function () {}, function () {}); });
  }
  function xpSave(s) { try { localStorage.setItem(XP_KEY, JSON.stringify(s)); } catch (e) {} }
  function pruneClaims(s) {
    const today = xpToday();
    Object.keys(s.claims || {}).forEach((k) => { if (k.split('::')[1] !== today) delete s.claims[k]; });
  }
  // Level curve: 100 XP for L1→2, growing ~18% each level (rounded to 5).
  function levelInfo(total) {
    let level = 1, need = 100, used = 0;
    while (total >= used + need) { used += need; level++; need = Math.round(need * 1.18 / 5) * 5; }
    const into = total - used;
    return { level, into, span: need, pct: Math.max(0, Math.min(1, into / need)) };
  }

  let _xpToast, _xpFill, _xpBadge, _xpGain, _xpReason, _xpSub, _xpQueue = [], _xpBusy = false, _xpToastTimer = null, _xpCloudTimer = null;
  function setupXp() {
    if (isEmbedded()) return;
    // Styles (own block so it also works on pages without the topbar chrome)
    if (!document.getElementById('xp-style')) {
      const xs = document.createElement('style'); xs.id = 'xp-style'; xs.textContent = xpCss;
      document.head.appendChild(xs);
    }
    // Banner element
    if (!document.getElementById('xpToast')) {
      const t = document.createElement('div'); t.className = 'xp-toast'; t.id = 'xpToast';
      t.innerHTML =
        '<div class="xp-toast-badge"><span class="xp-tb-star">⭐</span><span class="xp-tb-lv" id="xpToastLv">Lv1</span></div>' +
        '<div class="xp-toast-mid"><div class="xp-toast-reason" id="xpToastReason"></div>' +
          '<div class="xp-toast-bar"><span class="xp-toast-fill" id="xpToastFill"></span></div>' +
          '<div class="xp-toast-sub" id="xpToastSub"></div></div>' +
        '<div class="xp-toast-gain" id="xpToastGain">+0<span>XP</span></div>';
      document.body.appendChild(t);
      _xpToast = t; _xpFill = t.querySelector('#xpToastFill'); _xpBadge = t.querySelector('#xpToastLv');
      _xpGain = t.querySelector('#xpToastGain'); _xpReason = t.querySelector('#xpToastReason'); _xpSub = t.querySelector('#xpToastSub');
    }
    // Level chip → opens modal
    const chip = document.getElementById('topbarLevel');
    if (chip && !chip._wired) { chip._wired = true; chip.addEventListener('click', openXpModal); }
    updateChip();
    // Cloud pull, reconcile badges silently, then daily check-in
    xpCloudPull().then(() => { checkAchievements(xpLoad(), true); updateChip(); grantDailyLogin(); scheduleProfileSync(); });
  }

  function updateChip() {
    const info = levelInfo(xpLoad().total);
    const num = document.getElementById('topbarLevelNum');
    const fill = document.getElementById('topbarLevelFill');
    if (num) num.textContent = 'Lv' + info.level;
    if (fill) fill.style.width = (info.pct * 100).toFixed(1) + '%';
  }

  function addXp(amount, reason, opts) {
    opts = opts || {};
    amount = Math.round(amount || 0);
    if (amount <= 0) return;
    const s = xpLoad();
    if (opts.daily) {
      const ck = opts.daily + '::' + xpToday();
      if (s.claims[ck]) return; // already earned today (toggling off/on won't re-award)
      s.claims[ck] = 1;
    }
    if (opts.capKey) {
      const ct = xpToday();
      const kk = opts.capKey + '#' + ct;
      if ((s.dayCaps[kk] || 0) >= (opts.cap || 1)) return; // hit today's cap
      s.dayCaps[kk] = (s.dayCaps[kk] || 0) + 1;
      Object.keys(s.dayCaps).forEach((k) => { if (k.split('#')[1] !== ct) delete s.dayCaps[k]; });
    }
    const before = levelInfo(s.total);
    s.total += amount;
    const after = levelInfo(s.total);
    s.log.unshift({ r: reason, a: amount, t: Date.now() }); s.log = s.log.slice(0, 20);
    // Lifetime category counters + per-day categories (for "Perfect Day")
    const cat = catOf(reason);
    s.counts[cat] = (s.counts[cat] || 0) + 1;
    const today = xpToday(), yest = xpYesterday();
    s.dayCats[today] = s.dayCats[today] || [];
    if (s.dayCats[today].indexOf(cat) === -1) s.dayCats[today].push(cat);
    Object.keys(s.dayCats).forEach((d) => { if (d !== today && d !== yest) delete s.dayCats[d]; });
    pruneClaims(s); xpSave(s);
    updateChip();
    const levelUp = before.level !== after.level ? after.level : 0;
    _xpQueue.push({ amount, reason, info: after, levelUp });
    if (levelUp) postActivity('level', 'reached Level ' + levelUp + ' ⭐');
    checkAchievements(s); // queues any newly-earned badge toasts (after the XP toast)
    runXpToast();
    clearTimeout(_xpCloudTimer); _xpCloudTimer = setTimeout(xpCloudPush, 1200);
    scheduleProfileSync();
  }
  // Public API used across pages
  window.dashAddXp = (amount, reason) => addXp(amount, reason);
  window.dashAddXpDaily = (amount, reason, key) => addXp(amount, reason, { daily: key });
  window.dashAddXpCapped = (amount, reason, key, cap) => addXp(amount, reason, { capKey: key, cap: cap });

  function runXpToast() {
    if (_xpBusy || !_xpQueue.length || !_xpToast) return;
    _xpBusy = true;
    const t = _xpQueue.shift();
    if (t.ach) {
      // Achievement-unlock banner (reuses the toast frame)
      _xpToast.classList.add('achievement'); _xpToast.classList.remove('levelup');
      _xpBadge.textContent = t.ach.icon;
      _xpGain.innerHTML = '🏆';
      _xpReason.textContent = 'Achievement: ' + t.ach.name;
      _xpSub.textContent = t.ach.desc;
      _xpFill.style.transition = 'none'; _xpFill.style.width = '100%';
      _xpToast.classList.add('show'); xpConfetti();
      clearTimeout(_xpToastTimer);
      _xpToastTimer = setTimeout(() => {
        _xpToast.classList.remove('show');
        setTimeout(() => { _xpToast.classList.remove('achievement'); _xpBusy = false; runXpToast(); }, 380);
      }, 3400);
      return;
    }
    _xpToast.classList.remove('achievement');
    _xpBadge.textContent = 'Lv' + t.info.level;
    _xpGain.innerHTML = '+' + t.amount + '<span>XP</span>';
    _xpReason.textContent = t.levelUp ? ('LEVEL UP!  ➜  Lv' + t.levelUp) : t.reason;
    _xpSub.textContent = t.info.into + ' / ' + t.info.span + ' XP';
    _xpToast.classList.toggle('levelup', !!t.levelUp);
    // animate the bar
    const startPct = t.levelUp ? 0 : Math.max(0, (t.info.into - t.amount) / t.info.span);
    _xpFill.style.transition = 'none'; _xpFill.style.width = (startPct * 100) + '%';
    void _xpFill.offsetWidth;
    _xpFill.style.transition = 'width 0.75s cubic-bezier(.22,1,.36,1)';
    _xpFill.style.width = (t.info.pct * 100) + '%';
    _xpToast.classList.add('show');
    if (t.levelUp) xpConfetti();
    clearTimeout(_xpToastTimer);
    _xpToastTimer = setTimeout(() => {
      _xpToast.classList.remove('show');
      setTimeout(() => { _xpBusy = false; runXpToast(); }, 380);
    }, t.levelUp ? 3400 : 2500);
  }
  function xpConfetti() {
    const r = _xpToast.getBoundingClientRect();
    const ems = ['🎉', '⭐', '✨', '🎊'];
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('span'); s.className = 'buddy-particle'; s.textContent = ems[i % ems.length];
      s.style.left = (r.left + r.width * Math.random()) + 'px'; s.style.top = (r.bottom - 6) + 'px';
      s.style.setProperty('--bx', ((Math.random() * 2 - 1) * 120).toFixed(0) + 'px');
      s.style.setProperty('--by', ((Math.random() * 70) + 20).toFixed(0) + 'px');
      document.body.appendChild(s); setTimeout(() => s.remove(), 760);
    }
  }

  function grantDailyLogin() {
    const s = xpLoad();
    if (s.claims['login::' + xpToday()]) return;
    setTimeout(() => addXp(20, 'Daily check-in 📅', { daily: 'login' }), 900);
  }

  // ── Cloud sync (best-effort; XP only goes up, so merge by max) ──
  function xpSupa() {
    if (!window.supabase || TOPBAR_SUPABASE_URL.indexOf('PASTE-') === 0) return null;
    try { return window.supabase.createClient(TOPBAR_SUPABASE_URL, TOPBAR_SUPABASE_KEY); } catch (e) { return null; }
  }
  async function xpUid(supa) {
    let uid = localStorage.getItem('_dashUid');
    if (uid) return uid;
    try { const { data } = await supa.auth.getSession(); if (data && data.session) { uid = data.session.user.id; localStorage.setItem('_dashUid', uid); } } catch (e) {}
    return uid;
  }
  async function xpCloudPull() {
    const supa = xpSupa(); if (!supa) return;
    try {
      const uid = await xpUid(supa); if (!uid) return;
      const { data } = await supa.from('app_state').select('data').eq('key', uid + ':xp').maybeSingle();
      const d = data && data.data;
      if (d && typeof d.total === 'number') {
        const local = xpLoad();
        // Every field is monotonic → merge by max / union, so devices converge
        local.total = Math.max(local.total, d.total);
        local.spent = Math.max(local.spent || 0, d.spent || 0);
        local.freezesBought = Math.max(local.freezesBought || 0, d.freezesBought || 0);
        local.freezesUsed = Math.max(local.freezesUsed || 0, d.freezesUsed || 0);
        local.maxStreak = Math.max(local.maxStreak || 0, d.maxStreak || 0);
        if (d.counts) Object.keys(d.counts).forEach((k) => { local.counts[k] = Math.max(local.counts[k] || 0, d.counts[k] || 0); });
        if (d.badges) Object.keys(d.badges).forEach((k) => { if (!local.badges[k]) local.badges[k] = d.badges[k]; });
        if (Array.isArray(d.log) && d.log.length >= (local.log || []).length) local.log = d.log;
        xpSave(local); updateChip();
      }
    } catch (e) {}
  }
  async function xpCloudPush() {
    const supa = xpSupa(); if (!supa) return;
    try {
      const uid = await xpUid(supa); if (!uid) return;
      const s = xpLoad();
      await supa.from('app_state').upsert({ key: uid + ':xp', data: {
        total: s.total, spent: s.spent, freezesBought: s.freezesBought, freezesUsed: s.freezesUsed,
        maxStreak: s.maxStreak, counts: s.counts, badges: s.badges, log: s.log,
      }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    } catch (e) {}
  }

  // ── Level / XP modal ──
  function xpModalInner() {
    const s = xpLoad(); const info = levelInfo(s.total);
    const unlocked = ACHIEVEMENTS.filter((a) => s.badges[a.id]).length;
    const rates = XP_RATES.map((r) => '<div class="xp-rate"><span class="xp-rate-ic">' + r.icon + '</span>' +
      '<span class="xp-rate-name">' + r.reason + (r.daily ? ' <em>· daily</em>' : '') + '</span>' +
      '<span class="xp-rate-amt">+' + r.amount + '</span></div>').join('');
    const logHtml = (s.log && s.log.length)
      ? s.log.slice(0, 6).map((e) => '<div class="xp-logrow"><span>' + e.r + '</span><span class="xp-logamt">+' + e.a + '</span></div>').join('')
      : '<div class="xp-log-empty">No XP yet — go log something! 🚀</div>';
    const badges = ACHIEVEMENTS.map((a) => {
      const got = !!s.badges[a.id];
      return '<div class="xp-badge' + (got ? ' got' : '') + '" title="' + a.name + ' — ' + a.desc + '">' +
        '<span class="xp-badge-ic">' + (got ? a.icon : '🔒') + '</span>' +
        '<span class="xp-badge-name">' + a.name + '</span></div>';
    }).join('');
    const fz = freezesOwned(s), bal = spendable(s);
    const freezeBox =
      '<div class="xp-freeze">' +
        '<div class="xp-freeze-top"><span class="xp-freeze-ic">❄️</span>' +
          '<div class="xp-freeze-info"><div class="xp-freeze-title">Streak Freeze <strong>×' + fz + '</strong></div>' +
          '<div class="xp-freeze-desc">Auto-protects your goal streak on a missed day.</div></div></div>' +
        '<div class="xp-freeze-buy"><span class="xp-freeze-bal">' + bal + ' XP to spend</span>' +
          '<button class="xp-freeze-btn" id="xpBuyFreeze"' + (bal < FREEZE_COST ? ' disabled' : '') + '>Buy · ' + FREEZE_COST + ' XP</button></div>' +
      '</div>';
    return '<div class="xp-modal">' +
        '<button class="xp-modal-close" id="xpModalClose" aria-label="Close">×</button>' +
        '<div class="xp-modal-lv">⭐ Level ' + info.level + '</div>' +
        '<div class="xp-modal-bar"><span class="xp-modal-fill" style="width:' + (info.pct * 100).toFixed(1) + '%"></span></div>' +
        '<div class="xp-modal-meta"><span>' + info.into + ' / ' + info.span + ' XP</span><span>' + s.total + ' total</span></div>' +
        '<div class="xp-modal-sub">' + (info.span - info.into) + ' XP to Level ' + (info.level + 1) + '</div>' +
        '<div class="xp-modal-h">Streak freeze</div>' + freezeBox +
        '<div class="xp-modal-h">Achievements <span class="xp-ach-count">' + unlocked + ' / ' + ACHIEVEMENTS.length + '</span></div>' +
        '<div class="xp-badges">' + badges + '</div>' +
        '<div class="xp-modal-h">Recent activity</div><div class="xp-loglist">' + logHtml + '</div>' +
        '<div class="xp-modal-h">How to earn XP</div><div class="xp-ratelist">' + rates + '</div>' +
      '</div>';
  }
  function wireXpModal(m) {
    const close = () => m.classList.remove('show');
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('#xpModalClose').addEventListener('click', close);
    const buy = m.querySelector('#xpBuyFreeze');
    if (buy) buy.addEventListener('click', () => {
      const s = xpLoad();
      if (spendable(s) < FREEZE_COST) return;
      s.spent = (s.spent || 0) + FREEZE_COST; s.freezesBought = (s.freezesBought || 0) + 1;
      xpSave(s); updateChip();
      clearTimeout(_xpCloudTimer); _xpCloudTimer = setTimeout(xpCloudPush, 1200);
      m.innerHTML = xpModalInner(); wireXpModal(m); // re-render
    });
  }
  function openXpModal() {
    let m = document.getElementById('xpModal');
    if (m) { m.innerHTML = xpModalInner(); wireXpModal(m); m.classList.add('show'); return; }
    m = document.createElement('div'); m.className = 'xp-modal-bg show'; m.id = 'xpModal';
    m.innerHTML = xpModalInner();
    document.body.appendChild(m);
    wireXpModal(m);
  }

  // =============================================================
  // COLLAPSIBLE + REORDERABLE PAGE SECTIONS
  // A "section" = a header (.section-title) plus every block after it
  // up to the next header. Tap a header to collapse it; ↑/↓ reorders.
  // Saved per-device in dashboard:sections:v1.
  // =============================================================
  const SEC_KEY = 'dashboard:sections:v1';
  const SEC_SKIP = '.topbar,.bottombar,.skin-banner,#buddy,.bc-panel,.xp-toast,#xpModal,.nav-more-sheet,.nav-more-backdrop,.skin-toast,.skin-splash,.install-card,.modal-bg,.po-modal-bg,.rm-modal-bg,.schedule-modal-bg,.w-modal-bg,.gt-modal-bg,.m-bg,.wt-overlay,.bg-wash,script,style,link,noscript,[id*="odal"],[id*="Overlay"]';
  const secCss = `
.section-title.sec-h{cursor:pointer;-webkit-tap-highlight-color:transparent;}
.sec-h .sec-right{margin-left:auto;display:inline-flex;align-items:center;gap:1px;flex-shrink:0;}
.sec-move{background:none;border:none;cursor:pointer;color:inherit;opacity:0.32;font-size:12px;line-height:1;padding:2px 3px;font-family:inherit;-webkit-tap-highlight-color:transparent;transition:opacity .15s;}
.sec-move:hover{opacity:0.85;}
.sec-chev{display:inline-block;font-size:10px;opacity:0.55;transition:transform .2s;padding-left:6px;}
.section-title.sec-collapsed .sec-chev{transform:rotate(-90deg);}
`;
  function secLoadAll(){ try{ return JSON.parse(localStorage.getItem(SEC_KEY)) || {}; }catch(e){ return {}; } }
  function secSaveAll(a){ try{ localStorage.setItem(SEC_KEY, JSON.stringify(a)); }catch(e){} }
  function secSlug(t){ return ((t.textContent||'').replace(/[↑↓▾▸]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)) || 'sec'; }
  function secToggleHide(el, hide){
    if(el.nodeType !== 1) return;
    if(hide){ if(!el.dataset.secHid){ el.dataset.secHid='1'; el.dataset.secDisp=el.style.display||''; el.style.display='none'; } }
    else { if(el.dataset.secHid){ el.style.display=el.dataset.secDisp||''; delete el.dataset.secHid; delete el.dataset.secDisp; } }
  }
  function secSetCollapsed(run, collapsed){
    run.title.classList.toggle('sec-collapsed', collapsed);
    run.blocks.forEach((b)=>{ if(b!==run.titleBlock) secToggleHide(b, collapsed); });
    if(run.titleBlock !== run.title){ let n=run.title.nextSibling; while(n){ secToggleHide(n, collapsed); n=n.nextSibling; } }
  }
  function secApplyOrder(runs, container, order){
    if(!order || order.length<2) return;
    const pos={}; order.forEach((k,i)=>{ pos[k]=i; });
    const domSorted = runs.slice().sort((a,b)=> (a.blocks[0].compareDocumentPosition(b.blocks[0]) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1);
    const anchor = domSorted[0].blocks[0].previousSibling;
    const sorted = runs.slice().sort((a,b)=> (pos[a.key]==null?99:pos[a.key]) - (pos[b.key]==null?99:pos[b.key]));
    const frag = document.createDocumentFragment();
    sorted.forEach((r)=> r.blocks.forEach((b)=> frag.appendChild(b)));
    if(anchor && anchor.parentNode===container && anchor.after) anchor.after(frag);
    else container.insertBefore(frag, container.firstChild);
  }
  function setupSections(){
    try{
      if(isEmbedded() || isSettingsPage() || isFinancePage()) return;
      const titles = Array.from(document.querySelectorAll('.section-title'));
      if(!titles.length) return;
      if(!document.getElementById('sec-style')){ const st=document.createElement('style'); st.id='sec-style'; st.textContent=secCss; document.head.appendChild(st); }
      const pageKey = currentPageKey();
      const all = secLoadAll();
      const cfg = all[pageKey] || {}; cfg.order = Array.isArray(cfg.order)?cfg.order:[]; cfg.collapsed = cfg.collapsed || {};
      // container = single wrapper holding all titles, else <body>
      let container = document.body;
      Array.from(document.body.children).forEach((k)=>{ try{ if(k.querySelectorAll && k.querySelectorAll('.section-title').length === titles.length && !k.matches(SEC_SKIP)) container = k; }catch(e){} });
      // build runs from container children
      const runs = []; let cur = null; const seen = {};
      Array.from(container.children).forEach((el)=>{
        if(el.nodeType!==1) return;
        let skip=false; try{ skip = el.matches(SEC_SKIP); }catch(e){}
        if(skip) return;
        let titleEl=null; try{ titleEl = el.matches('.section-title') ? el : el.querySelector('.section-title'); }catch(e){}
        if(titleEl){
          let k=secSlug(titleEl); if(seen[k]!=null){ seen[k]++; k=k+'-'+seen[k]; } else seen[k]=1;
          cur = { key:k, title:titleEl, titleBlock:el, blocks:[el] }; runs.push(cur);
        } else if(cur){ cur.blocks.push(el); }
      });
      if(!runs.length) return;
      // wire each section
      runs.forEach((run)=>{
        const t = run.title;
        if(t._secWired) return; t._secWired = true;
        t.classList.add('sec-h');
        t.style.display = 'flex'; t.style.alignItems = 'center';
        const right = document.createElement('span'); right.className='sec-right';
        if(runs.length>1){
          const up=document.createElement('button'); up.className='sec-move'; up.type='button'; up.textContent='↑'; up.title='Move up';
          const dn=document.createElement('button'); dn.className='sec-move'; dn.type='button'; dn.textContent='↓'; dn.title='Move down';
          up.addEventListener('click',(e)=>{ e.stopPropagation(); secMove(run, runs, container, pageKey, -1); });
          dn.addEventListener('click',(e)=>{ e.stopPropagation(); secMove(run, runs, container, pageKey, 1); });
          right.appendChild(up); right.appendChild(dn);
        }
        const chev=document.createElement('span'); chev.className='sec-chev'; chev.textContent='▾'; right.appendChild(chev);
        t.appendChild(right);
        t.addEventListener('click',(e)=>{ if(e.target.closest('.sec-move')) return; secToggle(run, pageKey); });
      });
      // apply saved order + collapsed
      if(runs.length>1 && cfg.order.length) secApplyOrder(runs, container, cfg.order);
      runs.forEach((run)=>{ if(cfg.collapsed[run.key]) secSetCollapsed(run, true); });
    }catch(e){ /* never break the page */ }
  }
  function secToggle(run, pageKey){
    const collapsed = !run.title.classList.contains('sec-collapsed');
    secSetCollapsed(run, collapsed);
    const all=secLoadAll(); const cfg=all[pageKey]||{}; cfg.collapsed=cfg.collapsed||{};
    if(collapsed) cfg.collapsed[run.key]=1; else delete cfg.collapsed[run.key];
    all[pageKey]=cfg; secSaveAll(all);
  }
  function secMove(run, runs, container, pageKey, dir){
    try{
      const order = runs.map((r)=>r.key);
      const i=order.indexOf(run.key), j=i+dir;
      if(j<0 || j>=order.length) return;
      const tmp=order[i]; order[i]=order[j]; order[j]=tmp;
      secApplyOrder(runs, container, order);
      const all=secLoadAll(); const cfg=all[pageKey]||{}; cfg.order=order; all[pageKey]=cfg; secSaveAll(all);
      runs.sort((a,b)=> order.indexOf(a.key)-order.indexOf(b.key));
    }catch(e){}
  }

  function boot() {
    injectStyleAndHTML();
    injectUiStyle();
    injectLoadSweep();
    showWelcomeToast();
    setupBuddy();
    setupXp();
    setupSections();
    applyHomeGreeting();
    const btn = document.getElementById('topbarWaterAdd');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); addWater(); });
    render();
    setupWaterLiveSync();   // robust, self-contained live water sync (can't be blocked by other boot code)
    pullWaterFromCloud();
    lockGestures();
    startModalLock();
    window.addEventListener('storage', render);
    window.addEventListener('health-synced', render);
    setInterval(render, 30 * 1000);
    // Presence heartbeat — keeps your profile's updated_at fresh so friends see
    // you as "online". Cheap: one profile update every ~2 min while visible.
    setInterval(() => { if (!document.hidden) scheduleProfileSync(); }, 120 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleProfileSync(); });
  }

  // Enforce page visibility before we render anything (may redirect home).
  if (!guardPageAccess()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})();
