// =======================================================
// screen.js — Fixed Internal Resolution + Pixel-Safe Scaling
// + Screen Zoom Hook (NO CSS transform) + Screen Shake
//
// Internal: 1280x720
// Display: CSS size changes only (no transform) to avoid pixel drift
//
// API:
//   ScreenFX.setZoom(1.06)        // persistent zoom
//   ScreenFX.resetZoom()
//   ScreenFX.punch(1.10, 160)     // quick zoom in/out
//   ScreenFX.shake(10, 6)         // frames, amplitude px
//
// Optional:
//   ScreenFX.pixelPerfect = true  // forces integer scale when possible
// =======================================================

console.log("screen.js loaded");

const GAME_WIDTH  = 1280;
const GAME_HEIGHT = 720;

let _fitScale = 1;
let _zoom = 1.0;

let _shakeX = 0;
let _shakeY = 0;

let _punchRAF = null;

function _getCanvas() {
  return document.getElementById("game-canvas");
}

function _computeFitScale(ww, wh) {
  const raw = Math.min(ww / GAME_WIDTH, wh / GAME_HEIGHT);

  // Pixel-perfect preference:
  // - If window is large enough for scale >= 1, use an integer scale (1,2,3…)
  // - If window is smaller than internal (raw < 1), allow fractional so it still fits.
  if (window.ScreenFX && window.ScreenFX.pixelPerfect) {
    if (raw >= 1) return Math.max(1, Math.floor(raw));
    return raw; // must be fractional to fit
  }

  return raw;
}

function _applyLayout() {
  const canvas = _getCanvas();
  if (!canvas) return;

  const ww = window.innerWidth;
  const wh = window.innerHeight;

  // final scale includes zoom
  const s = _fitScale * _zoom;

  // Compute display size (round to integer CSS pixels!)
  const displayW = Math.floor(GAME_WIDTH  * s);
  const displayH = Math.floor(GAME_HEIGHT * s);

  const left = Math.floor((ww - displayW) / 2) + _shakeX;
  const top  = Math.floor((wh - displayH) / 2) + _shakeY;

  canvas.style.position = "fixed";
  canvas.style.left = left + "px";
  canvas.style.top  = top  + "px";

  canvas.style.width  = displayW + "px";
  canvas.style.height = displayH + "px";

  // IMPORTANT: no transform (prevents drift)
  canvas.style.transform = "none";
  canvas.style.transformOrigin = "center center";

  // Pixel-art friendly
  canvas.style.imageRendering = "pixelated";
  canvas.style.imageRendering = "crisp-edges";
}

function resizeGameCanvas() {
  const canvas = _getCanvas();
  if (!canvas) return;

  // Fixed internal buffer
  canvas.width  = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;

  const ww = window.innerWidth;
  const wh = window.innerHeight;

  _fitScale = _computeFitScale(ww, wh);

  _applyLayout();
}

// ----------------------------
// Screen FX API
// ----------------------------
window.ScreenFX = window.ScreenFX || {};
window.ScreenFX.pixelPerfect = true; // default ON (toggle if you want)

window.ScreenFX.setZoom = function (z = 1.0) {
  _zoom = Math.max(0.5, Math.min(1.5, z));
  _applyLayout();
};

window.ScreenFX.resetZoom = function () {
  _zoom = 1.0;
  _applyLayout();
};

window.ScreenFX.punch = function (peakZoom = 1.08, durationMs = 160) {
  if (_punchRAF) cancelAnimationFrame(_punchRAF);

  const start = performance.now();
  const peak = Math.max(1.0, Math.min(1.25, peakZoom));

  // Ease back to 1.0
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  _zoom = peak;
  _applyLayout();

  const tick = (now) => {
    const t = Math.min(1, (now - start) / Math.max(1, durationMs));
    const k = easeOut(t);

    _zoom = peak + (1.0 - peak) * k;
    _applyLayout();

    if (t < 1) _punchRAF = requestAnimationFrame(tick);
    else {
      _zoom = 1.0;
      _applyLayout();
      _punchRAF = null;
    }
  };

  _punchRAF = requestAnimationFrame(tick);
};

window.ScreenFX.shake = function (frames = 10, ampPx = 6) {
  frames = Math.max(1, Math.floor(frames));
  ampPx = Math.max(0, Math.floor(ampPx));

  let f = 0;
  const timer = setInterval(() => {
    _shakeX = Math.floor((Math.random() * 2 - 1) * ampPx);
    _shakeY = Math.floor((Math.random() * 2 - 1) * ampPx);
    _applyLayout();

    f++;
    if (f >= frames) {
      clearInterval(timer);
      _shakeX = 0;
      _shakeY = 0;
      _applyLayout();
    }
  }, 16);
};

// Expose manual call
window.resizeGameCanvas = resizeGameCanvas;

window.addEventListener("load", resizeGameCanvas);
window.addEventListener("resize", resizeGameCanvas);
