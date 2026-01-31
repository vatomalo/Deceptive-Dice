console.log("ParallaxBG LOADED");

// ==========================================================
// PARALLAX SYSTEM WITH DECORATION LAYERS
// - Fixed timestep friendly: update(dtSeconds, moodMul)
// - this.x is world scroll in PIXELS
// - Per-layer opacity + per-layer scale
// ==========================================================
class ParallaxBG {
  constructor(stageName = "default_stage") {
    this.x = 0;                 // world scroll in pixels
    this.layers = [];
    this.decors = [];

    this.stageName = stageName;
    this.ready = false;

    // Base camera drift speed (px/sec). Mood scales this.
    this.baseScrollSpeed = 32;

    // Optional: stage-wide multiplier (can come from json)
    this.stageScrollMul = 1.0;

    this._loadConfig();
  }

  // ======================================================
  // LOAD CONFIG FROM JSON
  // ======================================================
  async _loadConfig() {
    try {
      const res = await fetch("Artwork/BG/parallax.json");
      const data = await res.json();

      const stage = data[this.stageName];
      if (!stage) {
        console.error("Stage not found in parallax.json:", this.stageName);
        return;
      }

      if (typeof stage.scrollMul === "number") {
        this.stageScrollMul = stage.scrollMul;
      }

      // --------------------------------------------
      // LOAD BACKGROUND LAYERS
      // --------------------------------------------
      this.layers = await Promise.all(stage.layers.map(layer => this._loadLayer(layer)));

      // --------------------------------------------
      // LOAD DECORATION LAYERS
      // --------------------------------------------
      if (stage.decor) {
        this.decors = await Promise.all(stage.decor.map(deco => this._loadDeco(deco)));
      }

      console.log("%cParallax stage loaded: " + this.stageName, "color: cyan");
      this.ready = true;

    } catch (err) {
      console.error("Failed to load parallax config:", err);
    }
  }

  // ======================================================
  // HELPERS TO LOAD LAYERS
  // ======================================================
  _loadLayer(layer) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        resolve({
          img,

          // Parallax factor (your existing meaning)
          speed: layer.static ? 0 : (typeof layer.speed === "number" ? layer.speed : 0),

          static: !!layer.static,

          // NEW: opacity + scale
          opacity: (typeof layer.opacity === "number") ? layer.opacity : 1.0,
          scale: (typeof layer.scale === "number") ? layer.scale : 1.0,

          // Optional per-layer drift multiplier (extra spice)
          driftMul: (typeof layer.driftMul === "number") ? layer.driftMul : 1.0
        });
      };
      img.src = layer.src;
    });
  }

  _loadDeco(deco) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        resolve({
          img,
          speed: (typeof deco.speed === "number") ? deco.speed : 0,
          yOffset: deco.yOffset || 0,

          // NEW: opacity + scale
          opacity: (typeof deco.opacity === "number") ? deco.opacity : 1.0,
          scale: (typeof deco.scale === "number") ? deco.scale : 1.0
        });
      };
      img.src = deco.src;
    });
  }

  // ======================================================
  // UPDATE SCROLLING (fixed timestep safe)
  // ======================================================
  update(dt, moodMul = 1.0) {
    if (!this.ready) return;

    // Compat: if someone passes ms (like 16.6) instead of seconds
    if (dt > 1.0) dt = dt / 1000;

    const pxPerSec = this.baseScrollSpeed * this.stageScrollMul * moodMul;

    this.x += pxPerSec * dt;

    // Avoid float runaway
    if (this.x > 1e9) this.x = this.x % 100000;
  }

  // ======================================================
  // DRAW HELPERS
  // ======================================================
  _clampOpacity(a) {
    if (typeof a !== "number") return 1.0;
    return Math.max(0, Math.min(1, a));
  }

  _clampScale(s) {
    if (typeof s !== "number") return 1.0;
    return Math.max(0.01, s);
  }

  // ======================================================
  // DRAW SYSTEM
  // ======================================================
  draw(ctx) {
    if (!this.ready) return;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    // --------------------------------------------
    // Draw full background layers
    // --------------------------------------------
    for (let layer of this.layers) {
      const alpha = this._clampOpacity(layer.opacity);
      const scale = this._clampScale(layer.scale);

      // Optional: if you want mood to affect a specific layer more/less later,
      // layer.driftMul is available (used only in scroll calc below)
      const driftMul = (typeof layer.driftMul === "number") ? layer.driftMul : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Scaled “virtual screen size” for this layer.
      // IMPORTANT: wrapping must use scaled width, not canvas width.
      const sw = w * scale;
      const sh = h * scale;

      // Center scaled layer (keeps it looking like a "zoom" rather than stretching from top-left)
      const dx = (w - sw) * 0.5;
      const dy = (h - sh) * 0.5;

      if (layer.static) {
        // Static layers: just draw once
        ctx.drawImage(layer.img, dx, dy, sw, sh);
        ctx.restore();
        continue;
      }

      // World scroll in pixels -> parallaxed scroll in pixels
      // Use scaled width for modulo so seams stay correct while zoomed
      const scroll = (this.x * layer.speed * driftMul);
      let scrollX = -(scroll % sw);

      // Draw two copies to wrap
      ctx.drawImage(layer.img, dx + scrollX, dy, sw, sh);
      ctx.drawImage(layer.img, dx + scrollX + sw, dy, sw, sh);

      ctx.restore();
    }

    // --------------------------------------------
    // Draw decoration layers — tiled sprites
    // --------------------------------------------
    for (let deco of this.decors) {
      const alpha = this._clampOpacity(deco.opacity);
      const scale = this._clampScale(deco.scale);

      const imgW = deco.img.width || 1;
      const imgH = deco.img.height || 1;

      const tileW = imgW * scale;
      const tileH = imgH * scale;

      // IMPORTANT: wrap using scaled tile width
      const scroll = (this.x * deco.speed);
      let scrollX = -(scroll % tileW);

      ctx.save();
      ctx.globalAlpha = alpha;

      for (let x = scrollX; x < w + tileW; x += tileW) {
        ctx.drawImage(
          deco.img,
          x,
          h - tileH - (deco.yOffset || 0),
          tileW,
          tileH
        );
      }

      ctx.restore();
    }
  }
}

window.ParallaxBG = ParallaxBG;
