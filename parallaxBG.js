console.log("ParallaxBG LOADED");

// ==========================================================
// PARALLAX SYSTEM WITH DECORATION LAYERS
// - Fixed timestep friendly: update(dtSeconds, moodMul)
// - this.x is world scroll in PIXELS
// - Per-layer opacity + per-layer scale
// - Stage transition support: await bg.loadStage("new_stage")
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

    // prevent stale async loads from applying after a newer stage swap
    this._loadToken = 0;

    // Start initial load
    this.loadStage(stageName);
  }

  // ======================================================
  // PUBLIC: STAGE SWAP (awaitable)
  // ======================================================
  async loadStage(stageName) {
    // bump token; only latest load may apply
    const token = ++this._loadToken;

    this.ready = false;
    this.stageName = stageName;
    this.x = 0;
    this.layers = [];
    this.decors = [];
    this.stageScrollMul = 1.0;

    try {
      const stage = await this._fetchStageConfig(stageName);

      // If another stage load started after this one, abort applying.
      if (token !== this._loadToken) return;

      if (!stage) {
        console.error("Parallax stage missing:", stageName);
        return;
      }

      if (typeof stage.scrollMul === "number") {
        this.stageScrollMul = stage.scrollMul;
      }

      // --------------------------------------------
      // LOAD BACKGROUND LAYERS
      // --------------------------------------------
      if (Array.isArray(stage.layers)) {
        this.layers = await Promise.all(stage.layers.map(layer => this._loadLayer(layer)));
      } else {
        this.layers = [];
      }

      // --------------------------------------------
      // LOAD DECORATION LAYERS (optional)
      // --------------------------------------------
      if (Array.isArray(stage.decor)) {
        this.decors = await Promise.all(stage.decor.map(deco => this._loadDeco(deco)));
      } else {
        this.decors = [];
      }

      console.log("%cParallax stage loaded: " + stageName, "color: cyan");
      this.ready = true;

    } catch (err) {
      console.error("Failed to load parallax config:", err);
      this.ready = false;
    }
  }

  // ======================================================
  // LOAD CONFIG FROM JSON (supports 2 layouts)
  // 1) Preferred per-stage file:
  //    Artwork/BG/<stageName>/parallax.json  => { "<stageName>": { ... } }
  //
  // 2) Fallback shared file:
  //    parallax.json => { "<stageName>": { ... } }
  // ======================================================
  async _fetchStageConfig(stageName) {
    // A) Try per-stage folder first
    const stageUrl = `Artwork/BG/${stageName}/parallax.json`;

    try {
      const res = await fetch(stageUrl);
      if (res.ok) {
        const data = await res.json();
        const stage = data[stageName];
        if (stage) return stage;

        // Some people store it as { stage: {...} } without keyed name
        // If so, accept it.
        if (data.layers || data.decor || typeof data.scrollMul === "number") {
          return data;
        }

        console.warn("Stage not found in:", stageUrl, "for key:", stageName);
      }
    } catch (e) {
      // ignore and fallback
    }

    // B) Fallback shared parallax.json (root)
    // (Handy when you keep all stages in one file)
    try {
      const res2 = await fetch(`parallax.json`);
      if (!res2.ok) return null;

      const data2 = await res2.json();
      const stage2 = data2[stageName];
      if (!stage2) {
        console.warn("Stage not found in root parallax.json:", stageName);
        return null;
      }
      return stage2;
    } catch (e2) {
      return null;
    }
  }

  // ======================================================
  // OPTIONAL: apply already-loaded json data (atomic commit)
  // Useful if your transition loads JSON elsewhere and then calls:
  // bg.applyStageData(stageName, parallaxJSON)
  // ======================================================
  applyStageData(stageName, data) {
    const stage = data && data[stageName] ? data[stageName] : null;
    if (!stage) {
      console.warn("applyStageData: missing stage:", stageName);
      return;
    }

    this.ready = false;
    this.stageName = stageName;
    this.x = 0;
    this.layers = [];
    this.decors = [];
    this.stageScrollMul = (typeof stage.scrollMul === "number") ? stage.scrollMul : 1.0;

    // Note: image loading is async; we set ready true only when images complete.
    const token = ++this._loadToken;

    const layersPromise = Array.isArray(stage.layers)
      ? Promise.all(stage.layers.map(l => this._loadLayer(l)))
      : Promise.resolve([]);

    const decorsPromise = Array.isArray(stage.decor)
      ? Promise.all(stage.decor.map(d => this._loadDeco(d)))
      : Promise.resolve([]);

    Promise.all([layersPromise, decorsPromise]).then(([layers, decors]) => {
      if (token !== this._loadToken) return;
      this.layers = layers;
      this.decors = decors;
      this.ready = true;
    }).catch(err => {
      console.error("applyStageData failed:", err);
      this.ready = false;
    });
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
      img.onerror = () => {
        console.warn("Parallax layer failed to load:", layer && layer.src);
        // Still resolve so stage can complete
        resolve({
          img: null,
          speed: layer?.static ? 0 : (typeof layer?.speed === "number" ? layer.speed : 0),
          static: !!layer?.static,
          opacity: (typeof layer?.opacity === "number") ? layer.opacity : 1.0,
          scale: (typeof layer?.scale === "number") ? layer.scale : 1.0,
          driftMul: (typeof layer?.driftMul === "number") ? layer.driftMul : 1.0
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
      img.onerror = () => {
        console.warn("Parallax deco failed to load:", deco && deco.src);
        resolve({
          img: null,
          speed: (typeof deco?.speed === "number") ? deco.speed : 0,
          yOffset: deco?.yOffset || 0,
          opacity: (typeof deco?.opacity === "number") ? deco.opacity : 1.0,
          scale: (typeof deco?.scale === "number") ? deco.scale : 1.0
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
      if (!layer || !layer.img) continue;

      const alpha = this._clampOpacity(layer.opacity);
      const scale = this._clampScale(layer.scale);

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
        ctx.drawImage(layer.img, dx, dy, sw, sh);
        ctx.restore();
        continue;
      }

      // World scroll in pixels -> parallaxed scroll in pixels
      // Use scaled width for modulo so seams stay correct while zoomed
      const camX = (window.Camera?.x || 0);
      const scroll = ((this.x + camX) * layer.speed * driftMul);
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
      if (!deco || !deco.img) continue;

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
