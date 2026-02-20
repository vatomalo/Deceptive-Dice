console.log("ParallaxBG LOADED");

// ==========================================================
// PARALLAX SYSTEM WITH DECORATION LAYERS
// - Fixed timestep friendly: update(dtSeconds, moodMul)
// - this.x is world scroll in PIXELS
// - Per-layer opacity + per-layer scale
// - Stage transition support: await bg.loadStage("new_stage")
// - BIOME SUPPORT (optional):
//    - Reads window.Biomes.current if present
//    - Stage JSON can include:
//        biomeVariants: { [biomeId]: { scrollMul, layers, decor, randomLayers, randomDecor } }
//    - Optional random selection:
//        randomLayers / randomDecor:
//          { min, max, seedSalt, pick: [{src, speed, opacity, scale, driftMul?, static?, w}, ...] }
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

    // track current biome used for this stage build
    this.biomeId = this._getBiomeId();

    // Listen for biome changes (if user has a biome system)
    if (!window.__ParallaxBiomeListenerInstalled) {
      window.__ParallaxBiomeListenerInstalled = true;
      // no-op marker (avoids multiple installs across reloads)
    }

    window.addEventListener("BIOME_CHANGED", (e) => {
      const nextBiome = e?.detail?.id;
      if (!nextBiome) return;
      // Only re-apply if this instance exists and stage is loaded
      // Keep scroll position; just swap assets for biome variant if any.
      if (this && typeof this.applyBiome === "function") {
        this.applyBiome(nextBiome);
      }
    });

    // Start initial load
    this.loadStage(stageName);
  }

  // ======================================================
  // BIOME HELPERS (optional global)
  // ======================================================
  _getBiomeId() {
    const b = window.Biomes;
    if (b && typeof b.current === "string" && b.current.trim()) return b.current.trim();
    return null;
  }

  // Small deterministic hash (for seeded randomness)
  _hashString(str) {
    str = String(str || "");
    let h = 2166136261 >>> 0; // FNV-1a basis
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Mulberry32 seeded RNG
  _mulberry32(seedU32) {
    let a = (seedU32 >>> 0);
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  _pickWeighted(rng, items) {
    if (!Array.isArray(items) || items.length === 0) return null;
    let total = 0;
    for (const it of items) total += (typeof it.w === "number" && it.w > 0) ? it.w : 1;

    let r = rng() * total;
    for (const it of items) {
      r -= (typeof it.w === "number" && it.w > 0) ? it.w : 1;
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  }

  _randInt(rng, min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(rng() * (max - min + 1));
  }

  // Merge base stage with biome variant if present
  _resolveStageForBiome(stage, biomeId) {
    if (!stage || !biomeId) return stage;

    const variants = stage.biomeVariants;
    if (!variants || typeof variants !== "object") return stage;

    const v = variants[biomeId];
    if (!v || typeof v !== "object") return stage;

    // Shallow merge + replace arrays when provided
    const merged = { ...stage, ...v };
    if (Array.isArray(v.layers)) merged.layers = v.layers;
    if (Array.isArray(v.decor)) merged.decor = v.decor;

    // Keep biomeVariants table around (harmless)
    merged.biomeVariants = variants;
    return merged;
  }

  // Expand random selection blocks (randomLayers / randomDecor) into arrays to load
  _expandRandomBlock(kind, stageResolved, biomeId) {
    // kind: "randomLayers" or "randomDecor"
    const block = stageResolved && stageResolved[kind];
    if (!block || typeof block !== "object") return null;

    const pickList = Array.isArray(block.pick) ? block.pick : [];
    if (pickList.length === 0) return null;

    const min = (typeof block.min === "number") ? block.min : 0;
    const max = (typeof block.max === "number") ? block.max : min;
    const count = Math.max(0, this._randInt(this._mulberry32(1), min, max)); // placeholder; we reseed below

    // seed = RunSeed ^ TotalKills ^ stageNameHash ^ biomeHash ^ salt
    const runSeed = (typeof window.RunSeed === "number") ? (window.RunSeed >>> 0) : 0;
    const kills = (typeof window.TotalKills === "number") ? (window.TotalKills >>> 0) : 0;
    const stageHash = this._hashString(this.stageName);
    const biomeHash = this._hashString(biomeId || "");
    const saltHash = this._hashString(block.seedSalt || kind);

    const seed = (runSeed ^ kills ^ stageHash ^ biomeHash ^ saltHash) >>> 0;
    const rng = this._mulberry32(seed);

    const n = Math.max(0, this._randInt(rng, min, max));
    const picks = [];
    const used = new Set();

    for (let i = 0; i < n; i++) {
      // avoid infinite loops if too many uniques requested
      let chosen = null;
      let tries = 0;
      while (tries++ < 12) {
        const cand = this._pickWeighted(rng, pickList);
        if (!cand) break;

        // If marked unique or default unique behavior, avoid duplicates
        const unique = (cand.unique === true);
        const key = cand.id || cand.src || JSON.stringify(cand);

        if (unique && used.has(key)) continue;
        if (unique) used.add(key);

        chosen = cand;
        break;
      }
      if (chosen) picks.push(chosen);
    }

    // Return list of layer/deco descriptors that match existing loaders
    return picks;
  }

  // ======================================================
  // PUBLIC: STAGE SWAP (awaitable)
  // ======================================================
  async loadStage(stageName) {
    // bump token; only latest load may apply
    const token = ++this._loadToken;

    this.ready = false;
    this.stageName = stageName;
    this.biomeId = this._getBiomeId();

    // reset scroll on stage load (existing behavior)
    this.x = 0;
    this.layers = [];
    this.decors = [];
    this.stageScrollMul = 1.0;

    try {
      const stageBase = await this._fetchStageConfig(stageName);

      // If another stage load started after this one, abort applying.
      if (token !== this._loadToken) return;

      if (!stageBase) {
        console.error("Parallax stage missing:", stageName);
        return;
      }

      // Apply biome variants if available
      const stage = this._resolveStageForBiome(stageBase, this.biomeId);

      if (typeof stage.scrollMul === "number") {
        this.stageScrollMul = stage.scrollMul;
      }

      // --------------------------------------------
      // LOAD BACKGROUND LAYERS
      // --------------------------------------------
      let layersToLoad = Array.isArray(stage.layers) ? stage.layers.slice() : [];

      // randomLayers can add extra layers (or replace if you want by putting it in biomeVariants)
      const randLayers = this._expandRandomBlock("randomLayers", stage, this.biomeId);
      if (Array.isArray(randLayers) && randLayers.length) {
        layersToLoad = layersToLoad.concat(randLayers);
      }

      this.layers = await Promise.all(layersToLoad.map(layer => this._loadLayer(layer)));

      // --------------------------------------------
      // LOAD DECORATION LAYERS (optional)
      // --------------------------------------------
      let decorToLoad = Array.isArray(stage.decor) ? stage.decor.slice() : [];

      const randDecor = this._expandRandomBlock("randomDecor", stage, this.biomeId);
      if (Array.isArray(randDecor) && randDecor.length) {
        decorToLoad = decorToLoad.concat(randDecor);
      }

      this.decors = await Promise.all(decorToLoad.map(deco => this._loadDeco(deco)));

      console.log(
        "%cParallax stage loaded: " + stageName + (this.biomeId ? ` (biome: ${this.biomeId})` : ""),
        "color: cyan"
      );
      this.ready = true;

    } catch (err) {
      console.error("Failed to load parallax config:", err);
      this.ready = false;
    }
  }

  // ======================================================
  // PUBLIC: Apply biome without resetting scroll (nice feel)
  // ======================================================
  async applyBiome(biomeId) {
    // If biome unchanged, skip
    if ((biomeId || null) === (this.biomeId || null)) return;

    // bump token
    const token = ++this._loadToken;

    const keepX = this.x;

    this.ready = false;
    this.biomeId = biomeId || null;

    try {
      const stageBase = await this._fetchStageConfig(this.stageName);
      if (token !== this._loadToken) return;

      if (!stageBase) {
        console.warn("applyBiome: missing stage config for", this.stageName);
        this.ready = true;
        return;
      }

      const stage = this._resolveStageForBiome(stageBase, this.biomeId);

      // Keep scrollMul behavior
      this.stageScrollMul = (typeof stage.scrollMul === "number") ? stage.scrollMul : 1.0;

      let layersToLoad = Array.isArray(stage.layers) ? stage.layers.slice() : [];
      const randLayers = this._expandRandomBlock("randomLayers", stage, this.biomeId);
      if (Array.isArray(randLayers) && randLayers.length) layersToLoad = layersToLoad.concat(randLayers);

      let decorToLoad = Array.isArray(stage.decor) ? stage.decor.slice() : [];
      const randDecor = this._expandRandomBlock("randomDecor", stage, this.biomeId);
      if (Array.isArray(randDecor) && randDecor.length) decorToLoad = decorToLoad.concat(randDecor);

      const [layers, decors] = await Promise.all([
        Promise.all(layersToLoad.map(l => this._loadLayer(l))),
        Promise.all(decorToLoad.map(d => this._loadDeco(d)))
      ]);

      if (token !== this._loadToken) return;

      this.layers = layers;
      this.decors = decors;
      this.x = keepX;
      this.ready = true;

      console.log(
        "%cParallax biome applied: " + (this.biomeId || "none") + " @ " + this.stageName,
        "color: #7fffd4"
      );
    } catch (err) {
      console.error("applyBiome failed:", err);
      this.x = keepX;
      this.ready = true; // fail open
    }
  }

  // ======================================================
  // LOAD CONFIG FROM JSON
  // NEW: biomes/<stageName>_parallax.json + biomes/<stageName>_decor.json
  // FALLBACKS: old folder and root file
  // ======================================================
  async _fetchStageConfig(stageName) {
    // -------------------------------
    // 1) NEW BIOMES layout (split files)
    // -------------------------------
    const pUrl = `Artwork/BG/biomes/${stageName}_parallax.json`;
    const dUrl = `Artwork/BG/biomes/${stageName}_decor.json`;

    try {
      const pres = await fetch(pUrl);
      if (pres.ok) {
        const pdata = await pres.json();

        // allow either keyed or direct stage object
        let stage = (pdata && pdata[stageName]) ? pdata[stageName] : pdata;
        if (!stage || typeof stage !== "object") stage = {};

        // merge decor if present (optional)
        try {
          const dres = await fetch(dUrl);
          if (dres.ok) {
            const ddata = await dres.json();
            const decorObj = (ddata && ddata[stageName]) ? ddata[stageName] : ddata;

            // allow either array or object with {decor:[...]}
            if (Array.isArray(decorObj)) stage.decor = decorObj;
            else if (decorObj && Array.isArray(decorObj.decor)) stage.decor = decorObj.decor;

            // allow biomeVariants to live in decor file too
            if (decorObj && decorObj.biomeVariants && !stage.biomeVariants) {
              stage.biomeVariants = decorObj.biomeVariants;
            }
          }
        } catch (_) {
          // decor is optional; fail silently
        }

        // If it at least resembles a stage config, accept it
        if (stage.layers || stage.decor || typeof stage.scrollMul === "number" || stage.biomeVariants) {
          return stage;
        }

        // Still return stage (maybe only layers are present, etc.)
        return stage;
      }
    } catch (e) {
      // ignore and fallback
    }

    // -------------------------------
    // 2) OLD layout: per-stage folder
    // -------------------------------
    const oldStageUrl = `Artwork/BG/${stageName}/parallax.json`;
    try {
      const res = await fetch(oldStageUrl);
      if (res.ok) {
        const data = await res.json();
        const stage = data[stageName];
        if (stage) return stage;

        // accept unkeyed
        if (data.layers || data.decor || typeof data.scrollMul === "number" || data.biomeVariants) {
          return data;
        }

        console.warn("Stage not found in:", oldStageUrl, "for key:", stageName);
      }
    } catch (e) {
      // ignore and fallback
    }

    // -------------------------------
    // 3) OLD layout: root parallax.json
    // -------------------------------
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
  // (Biome variants are respected if window.Biomes.current exists)
  // ======================================================
  applyStageData(stageName, data) {
    const base = data && data[stageName] ? data[stageName] : null;
    if (!base) {
      console.warn("applyStageData: missing stage:", stageName);
      return;
    }

    this.ready = false;
    this.stageName = stageName;

    // keep biome in sync
    this.biomeId = this._getBiomeId();

    // Apply biome variants
    const stage = this._resolveStageForBiome(base, this.biomeId);

    this.x = 0;
    this.layers = [];
    this.decors = [];
    this.stageScrollMul = (typeof stage.scrollMul === "number") ? stage.scrollMul : 1.0;

    // Note: image loading is async; we set ready true only when images complete.
    const token = ++this._loadToken;

    let layersToLoad = Array.isArray(stage.layers) ? stage.layers.slice() : [];
    const randLayers = this._expandRandomBlock("randomLayers", stage, this.biomeId);
    if (Array.isArray(randLayers) && randLayers.length) layersToLoad = layersToLoad.concat(randLayers);

    let decorToLoad = Array.isArray(stage.decor) ? stage.decor.slice() : [];
    const randDecor = this._expandRandomBlock("randomDecor", stage, this.biomeId);
    if (Array.isArray(randDecor) && randDecor.length) decorToLoad = decorToLoad.concat(randDecor);

    const layersPromise = Promise.all(layersToLoad.map(l => this._loadLayer(l)));
    const decorsPromise = Promise.all(decorToLoad.map(d => this._loadDeco(d)));

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

          // opacity + scale
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

          // opacity + scale
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
