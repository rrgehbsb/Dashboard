/* Dashboard v3 — square photo editor for profile pictures: drag to move, pinch or the
   slider to zoom, rotate in quarter turns. The circle shows what friends will see.
   PHOTO.edit(file, done): opens the editor in the sheet; done(dataUrl) with a 192 px
   JPEG, or done(null) if you cancel. */
(function () {
'use strict';
const D = window.DASH, $ = D.$, ic = D.ic;
const OUT = 192, MAX_SRC = 1600, MAX_ZOOM = 4;
let E = null; // { src (canvas), w, h, rot, zoom, x, y, done }

// Big phone photos are scaled down first so moving them stays smooth.
function open(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SRC / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That photo couldn’t be opened. Try a JPG or PNG.')); };
    img.src = url;
  });
}
const stageSize = () => { const s = $('#ph-stage'); return s ? s.clientWidth : 300; };
function dims() { const odd = E.rot % 2 === 1; return { rw: odd ? E.h : E.w, rh: odd ? E.w : E.h }; }
// keep the photo covering the whole square
function clamp(S) {
  E.zoom = Math.min(MAX_ZOOM, Math.max(1, E.zoom));
  const { rw, rh } = dims(), k = S / Math.min(rw, rh) * E.zoom;
  const mx = Math.max(0, (rw * k - S) / 2), my = Math.max(0, (rh * k - S) / 2);
  E.x = Math.min(mx, Math.max(-mx, E.x)); E.y = Math.min(my, Math.max(-my, E.y));
  return k;
}
function paint(ctx, S, scale) {
  const k = clamp(S) * scale;
  ctx.save();
  ctx.translate(S * scale / 2 + E.x * scale, S * scale / 2 + E.y * scale);
  ctx.rotate(E.rot * Math.PI / 2);
  ctx.drawImage(E.src, -E.w * k / 2, -E.h * k / 2, E.w * k, E.h * k);
  ctx.restore();
}
function draw() {
  const cv = $('#ph-cv'); if (!cv || !E) return;
  const S = stageSize(), dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  paint(ctx, S, dpr);
  const z = $('#ph-zoom'); if (z && +z.value !== E.zoom) z.value = E.zoom;
}
function wire() {
  const cv = $('#ph-cv'); if (!cv || cv._wired) return; cv._wired = true;
  const pts = new Map(); let last = null;
  const spread = () => { const p = Array.from(pts.values()); return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = { d: spread(), z: E.zoom }; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { E.x += e.clientX - p.x; E.y += e.clientY - p.y; }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2 && last && last.d) E.zoom = last.z * spread() / last.d;
    draw();
  });
  const up = e => { pts.delete(e.pointerId); last = { d: spread(), z: E.zoom }; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); E.zoom *= e.deltaY < 0 ? 1.08 : 1 / 1.08; draw(); }, { passive: false });
  const z = $('#ph-zoom'); if (z) z.addEventListener('input', () => { E.zoom = +z.value; draw(); });
}
D.SHEETS.photo = () => {
  if (!E) return { title: 'Photo', body: '' };
  requestAnimationFrame(() => { wire(); draw(); });
  return {
    title: 'Move and zoom',
    body: '<div class="ph-stage" id="ph-stage"><canvas id="ph-cv" aria-label="Drag to move the photo"></canvas><div class="ph-ring" aria-hidden="true"></div></div>' +
      '<div class="ph-tools"><button class="icon-btn" id="ph-rot" data-act="ph-rot" aria-label="Rotate">' + ic('repeat') + '</button>' +
      '<label class="sr" for="ph-zoom">Zoom</label><input type="range" id="ph-zoom" min="1" max="' + MAX_ZOOM + '" step="0.01" value="' + E.zoom + '">' +
      '<button class="btn-text" id="ph-reset" data-act="ph-reset">Reset</button></div>' +
      '<p class="sheet-note">Drag to move. Pinch or use the slider to zoom. The circle is what friends see.</p>' +
      '<div class="sheet-actions"><button class="btn ghost" id="ph-cancel" data-act="ph-cancel">Cancel</button><button class="btn school" id="ph-done" data-act="ph-done">Use photo</button></div>'
  };
};
Object.assign(D.ACT, {
  'ph-rot': () => { E.rot = (E.rot + 1) % 4; draw(); },
  'ph-reset': () => { E.rot = 0; E.zoom = 1; E.x = 0; E.y = 0; draw(); },
  'ph-cancel': () => { const d = E && E.done; E = null; if (d) d(null); },
  'ph-done': () => {
    const S = stageSize(), c = document.createElement('canvas'); c.width = c.height = OUT;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, OUT, OUT);
    paint(ctx, S, OUT / S);
    const url = c.toDataURL('image/jpeg', 0.85), d = E.done; E = null;
    if (d) d(url);
  }
});
window.PHOTO = {
  edit(file, done) {
    open(file).then(src => { E = { src, w: src.width, h: src.height, rot: 0, zoom: 1, x: 0, y: 0, done }; D.openSheet('photo'); })
      .catch(err => { D.toast(err.message); done(null); });
  }
};
})();
