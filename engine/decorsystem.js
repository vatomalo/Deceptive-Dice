console.log("ForegroundDecor LOADED");

// =======================================================
// SNES-STYLE PALETTES (4–6 color ramps)
// Map pixels by luminance -> ramp index
// =======================================================
const SNES_PALETTES = {
    forest: [
        [18, 32, 18],
        [34, 64, 34],
        [60, 110, 60],
        [110, 170, 90],
        [190, 230, 150]
    ],
    pink: [
        [45, 10, 20],
        [95, 35, 55],
        [155, 80, 105],
        [225, 140, 175],
        [255, 205, 225]
    ],
    desert: [
        [35, 25, 10],
        [85, 60, 25],
        [145, 110, 55],
        [210, 175, 95],
        [255, 235, 185]
    ],
    sky: [
        [10, 20, 50],
        [40, 70, 130],
        [90, 140, 210],
        [160, 200, 250],
        [225, 245, 255]
    ],
    dusk: [
        [20, 10, 35],
        [55, 25, 75],
        [105, 45, 110],
        [170, 80, 135],
        [230, 150, 170]
    ],
    snow: [
        [20, 30, 55],
        [60, 80, 120],
        [120, 150, 190],
        [190, 215, 235],
        [245, 250, 255]
    ],
    wood: [
        [30, 18, 10],
        [70, 40, 20],
        [120, 75, 40],
        [180, 125, 75],
        [235, 200, 160]
    ],
    stone: [
        [20, 20, 25],
        [55, 55, 70],
        [105, 110, 130],
        [175, 180, 200],
        [240, 245, 255]
    ],
    blood: [
        [35, 0, 0],
        [90, 10, 10],
        [160, 25, 25],
        [220, 60, 60],
        [255, 150, 150]
    ],
    gold: [
        [25, 18, 0],
        [80, 55, 10],
        [150, 110, 25],
        [220, 185, 70],
        [255, 245, 175]
    ],
    teal: [
        [0, 25, 25],
        [10, 70, 70],
        [35, 130, 130],
        [90, 200, 190],
        [200, 255, 245]
    ]
};

// Friendly aliases so JSON can say "sakura" etc.
const PALETTE_ALIASES = {
    sakura: "pink",
    green: "forest",
    blue: "sky",
    purple: "dusk",
    gray: "stone",
    grey: "stone",
    brown: "wood",
    ice: "snow",
    red: "blood",
    yellow: "gold",
    sand: "desert"
};

// Cache: same image + palette should not reprocess every time
const _paletteCache = new Map();

function _cacheKey(img, paletteName) {
    const src = img && img.src ? img.src : String(img);
    return `${src}::${paletteName}`;
}

// Blend helper for optional strength
function _mix(a, b, t) {
    return a + (b - a) * t;
}

/**
 * SNES-style palette swap:
 * - indexes pixels by luminance
 * - assigns a ramp color (keeps shading)
 * - optional strength: 1.0 = full swap, 0.0 = original
 */
function applySnesPaletteToImage(img, paletteName, strength = 1.0) {
    const aliased = PALETTE_ALIASES[paletteName] || paletteName;
    const ramp = SNES_PALETTES[aliased];
    if (!ramp) return img;

    strength = Math.max(0, Math.min(1, strength));

    // If strength is 0, return original
    if (strength <= 0) return img;

    // Cache only full-strength swaps (common case)
    if (strength === 1.0) {
        const key = _cacheKey(img, aliased);
        if (_paletteCache.has(key)) return _paletteCache.get(key);

        const out = _makePaletteSwappedImage(img, ramp, 1.0);
        _paletteCache.set(key, out);
        return out;
    }

    // Non-1.0 strength: no caching (or you can cache with strength in key)
    return _makePaletteSwappedImage(img, ramp, strength);
}

function _makePaletteSwappedImage(img, ramp, strength) {
    const w = img.width, h = img.height;

    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;

    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;

    const n = ramp.length;

    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a === 0) continue;

        const r = d[i + 0];
        const g = d[i + 1];
        const b = d[i + 2];

        // Fast luminance (0..1)
        let lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

        // Slight bias to preserve highlights (SNES-ish feel)
        lum = Math.pow(Math.max(0, Math.min(1, lum)), 0.90);

        const idx = Math.min(n - 1, Math.max(0, Math.round(lum * (n - 1))));
        const [pr, pg, pb] = ramp[idx];

        // Blend between original and palette color
        d[i + 0] = _mix(r, pr, strength) | 0;
        d[i + 1] = _mix(g, pg, strength) | 0;
        d[i + 2] = _mix(b, pb, strength) | 0;
    }

    ctx.putImageData(id, 0, 0);

    const out = new Image();
    out.src = c.toDataURL();
    return out;
}

// =======================================================
// SEEDED RNG + WEIGHTED PICK (for random decor)
// =======================================================
function _hashString(str) {
    str = String(str || "");
    let h = 2166136261 >>> 0; // FNV-1a
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function _mulberry32(seedU32) {
    let a = (seedU32 >>> 0);
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function _randInt(rng, min, max) {
    min = Math.floor(min);
    max = Math.floor(max);
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(rng() * (max - min + 1));
}

function _pickWeighted(rng, items) {
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

// =======================================================
// RANDOM SPAWN COLLISION (simple spacing)
// =======================================================
function _defaultCollisionRadiusFor(out) {
    // You can override with out.collisionR in decor.json.
    // These defaults are tuned for your pixel-art scale ranges.
    const s = (typeof out.scale === "number") ? out.scale : 1;

    // If it's a "tree-ish" sprite, give it more breathing room
    const src = String(out.src || "").toLowerCase();
    if (src.includes("tree") || src.includes("sakura")) return Math.max(60, Math.min(140, s * 28));

    // Rocks/lantern/house fall back:
    if (src.includes("house")) return Math.max(70, Math.min(160, s * 30));
    if (src.includes("lantern")) return Math.max(40, Math.min(110, s * 24));
    if (src.includes("rock")) return Math.max(28, Math.min(90, s * 18));

    return Math.max(24, Math.min(100, s * 22));
}

function _circlesOverlap(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const rr = a.r + b.r;
    return (dx * dx + dy * dy) < (rr * rr);
}

// =======================================================
// Decor system with separate BACK and FRONT buffers
// + DecorWeather flags (sakura/snow ONLY if decor.json says so)
// + Per-item SNES palette swapping (palette: "pink"/"desert"/etc.)
// + Stage transition support: await decor.loadStage("new_stage")
// + BIOME + RANDOM DECOR SUPPORT (SAFE / BACKWARD COMPAT)
// + RANDOM COLLISION/SPACING (NEW)
// =======================================================
class Decor {
    constructor(stage = "default_stage") {
        this.stage = stage;

        this.items = [];
        this.backItems = [];
        this.frontItems = [];

        this.readyBack = false;
        this.readyFront = false;

        this.backBuffer = null;
        this.frontBuffer = null;

        // Default OFF. Decor.json explicitly enables.
        window.DecorWeather = window.DecorWeather || { sakura: false, snow: false };

        // Prevent stale async loads from applying after a newer stage swap
        this._loadToken = 0;

        // React to biome changes (optional; no crash if Biomes missing)
        window.addEventListener("BIOME_CHANGED", () => {
            // Reload same stage so biome variant can apply
            this.loadStage(this.stage);
        });

        this.loadStage(stage);
    }

    // ===================================================
    // INTERNAL: Resolve items for stage + biome from decor.json
    // Supported decor.json shapes:
    // 1) Legacy:
    //    { "<stage>": [ ...items... ] }
    //
    // 2) Stage-object:
    //    { "<stage>": { items:[...], random:{...}, biomeVariants:{ "<biome>":[...] } } }
    //
    // 3) Global biome variants:
    //    { biomeVariants: { "<biome>": { "<stage>":[...] } } }
    //
    // 4) Global random per stage:
    //    { random: { "<stage>": {min,max,pick:[...]} } }
    // ===================================================
    _resolveStageItemsFromJson(data, stage, biomeId) {
        let base = data ? data[stage] : null;

        // Stage-object format
        let stageObj = null;
        let stageItems = null;

        if (base && !Array.isArray(base) && typeof base === "object") {
            stageObj = base;
            stageItems = Array.isArray(stageObj.items) ? stageObj.items.slice() : [];
        } else if (Array.isArray(base)) {
            stageItems = base.slice();
        } else {
            stageItems = null;
        }

        if (!stageItems) return null;

        // Apply biome override:
        // Priority:
        // A) stageObj.biomeVariants[biome] (array)
        // B) data.biomeVariants[biome][stage] (array)
        if (biomeId) {
            const localVar = stageObj && stageObj.biomeVariants && stageObj.biomeVariants[biomeId];
            if (Array.isArray(localVar)) {
                stageItems = localVar.slice();
            } else {
                const globalVar = data?.biomeVariants?.[biomeId]?.[stage];
                if (Array.isArray(globalVar)) {
                    stageItems = globalVar.slice();
                }
            }
        }

        // Apply random:
        // Priority:
        // A) stageObj.random
        // B) data.random[stage]
        // C) data.random (if it looks like a random block)
        const randomBlock =
            (stageObj && stageObj.random) ||
            (data?.random && data.random[stage]) ||
            ((data?.random && typeof data.random === "object" && Array.isArray(data.random.pick)) ? data.random : null);

        if (randomBlock && typeof randomBlock === "object") {
            const pick = Array.isArray(randomBlock.pick) ? randomBlock.pick : [];
            const min = (typeof randomBlock.min === "number") ? randomBlock.min : 0;
            const max = (typeof randomBlock.max === "number") ? randomBlock.max : min;

            if (pick.length > 0 && max > 0) {
                const runSeed = (typeof window.RunSeed === "number") ? (window.RunSeed >>> 0) : 0;
                const kills = (typeof window.TotalKills === "number") ? (window.TotalKills >>> 0) : 0;

                const seed =
                    (runSeed ^
                        (kills * 2654435761) ^
                        _hashString(stage) ^
                        _hashString(biomeId || "") ^
                        _hashString(randomBlock.seedSalt || "decor_random")) >>> 0;

                const rng = _mulberry32(seed);

                const count = Math.max(0, _randInt(rng, min, max));
                const used = new Set();

                // NEW: collision placement memory (for random items only)
                const placed = []; // {x,y,r}

                // Optional bounds (lets you avoid UI areas or edges)
                // Example in json:
                // bounds: { xMin: 40, xMax: 760, yMin: 320, yMax: 375 }
                const bounds = randomBlock.bounds || null;
                const xMin = (bounds && typeof bounds.xMin === "number") ? bounds.xMin : 40;
                const xMax = (bounds && typeof bounds.xMax === "number") ? bounds.xMax : 760;
                const yMin = (bounds && typeof bounds.yMin === "number") ? bounds.yMin : 320;
                const yMax = (bounds && typeof bounds.yMax === "number") ? bounds.yMax : 375;

                const maxTries = (typeof randomBlock.maxTries === "number") ? Math.max(1, randomBlock.maxTries | 0) : 16;
                const collisionPolicy = (typeof randomBlock.collisionPolicy === "string")
                    ? randomBlock.collisionPolicy
                    : "skip"; // "skip" | "accept_last"

                for (let i = 0; i < count; i++) {
                    const chosen = _pickWeighted(rng, pick);
                    if (!chosen) break;

                    const unique = chosen.unique === true;
                    const key = chosen.id || chosen.src || JSON.stringify(chosen);

                    if (unique) {
                        if (used.has(key)) continue;
                        used.add(key);
                    }

                    const out = { ...chosen };

                    if (typeof out.scale !== "number") out.scale = 1;

                    // collision radius
                    const r = (typeof out.collisionR === "number" && out.collisionR > 0)
                        ? out.collisionR
                        : _defaultCollisionRadiusFor(out);

                    let ok = false;
                    let lastX = null, lastY = null;

                    for (let tries = 0; tries < maxTries; tries++) {
                        // If random pick doesn't define x/y, scatter it safely
                        const px = (typeof out.x === "number")
                            ? out.x
                            : _randInt(rng, xMin, xMax);

                        const py = (typeof out.y === "number")
                            ? out.y
                            : _randInt(rng, yMin, yMax);

                        lastX = px; lastY = py;

                        // Check overlap vs already placed random items
                        const probe = { x: px, y: py, r };

                        ok = true;
                        for (const p of placed) {
                            if (_circlesOverlap(probe, p)) { ok = false; break; }
                        }

                        if (ok) {
                            out.x = px;
                            out.y = py;
                            break;
                        }

                        // if x/y were explicitly defined in JSON and collision fails,
                        // no point retrying (it won't change)
                        if (typeof chosen.x === "number" && typeof chosen.y === "number") break;
                    }

                    if (!ok) {
                        if (collisionPolicy === "accept_last" && lastX != null && lastY != null) {
                            out.x = (typeof out.x === "number") ? out.x : lastX;
                            out.y = (typeof out.y === "number") ? out.y : lastY;
                            // Accept even if overlapping
                        } else {
                            // Default: skip this spawn if we can't place it cleanly
                            continue;
                        }
                    }

                    // remember placement for spacing
                    placed.push({ x: out.x, y: out.y, r });

                    stageItems.push(out);
                }
            }
        }

        return stageItems;
    }

    // ===================================================
    // NEW: Load decor JSON from /biomes first (split layout)
    // Fallback to old /Artwork/BG/<stage>/decor.json
    // ===================================================
    async _fetchDecorConfig(stage) {
        // 1) New structure
        const newUrl = `Artwork/BG/biomes/${stage}_decor.json`;
        try {
            const res = await fetch(newUrl);
            if (res.ok) return await res.json();
        } catch (e) {
            // ignore -> fallback
        }

        // 2) Old structure fallback
        try {
            const oldRes = await fetch(`Artwork/BG/${stage}/decor.json`);
            if (oldRes.ok) return await oldRes.json();
        } catch (e2) {
            // ignore
        }

        return null;
    }

    // ===================================================
    // PUBLIC: STAGE SWAP (awaitable)
    // ===================================================
    async loadStage(stage) {
        const token = ++this._loadToken;

        this.stage = stage;

        // reset flags so you don't draw old buffers
        this.readyBack = false;
        this.readyFront = false;

        this.items = [];
        this.backItems = [];
        this.frontItems = [];

        this.backBuffer = null;
        this.frontBuffer = null;

        // reset permissions (will be recomputed on load)
        window.DecorWeather = { sakura: false, snow: false };

        try {
            const data = await this._fetchDecorConfig(this.stage);

            // If another stage load started after this one, abort
            if (token !== this._loadToken) return;

            if (!data) {
                console.warn("Decor: missing decor config for stage", this.stage);
                return;
            }

            const biomeId = window.Biomes?.current || null;

            const stageItems = this._resolveStageItemsFromJson(data, this.stage, biomeId);
            if (!stageItems || !Array.isArray(stageItems)) {
                console.warn("Decor: No items for stage", this.stage);
                return;
            }

            // Load all images + metadata
            this.items = await Promise.all(
                stageItems.map(item => this._loadItem(item))
            );

            // If another stage load started after this one, abort
            if (token !== this._loadToken) return;

            // Compute weather permissions from decor items
            this._updateDecorWeatherFlags();

            // Split into back / front sets
            this.backItems = this.items.filter(i => i.z !== "front");
            this.frontItems = this.items.filter(i => i.z === "front");

            this._buildBuffers();

        } catch (err) {
            console.error("Decor load error:", err);
        }
    }

    // ===================================================
    // OPTIONAL: APPLY FROM ALREADY-LOADED JSON (atomic commit)
    // If you load JSON elsewhere (transition manager), call:
    // decor.applyStageData("snow", decorJSON)
    // ===================================================
    applyStageData(stage, data) {
        const token = ++this._loadToken;

        this.stage = stage;

        this.readyBack = false;
        this.readyFront = false;

        this.items = [];
        this.backItems = [];
        this.frontItems = [];

        this.backBuffer = null;
        this.frontBuffer = null;

        window.DecorWeather = { sakura: false, snow: false };

        const biomeId = window.Biomes?.current || null;
        const stageItems = this._resolveStageItemsFromJson(data, stage, biomeId);

        if (!stageItems || !Array.isArray(stageItems)) {
            console.warn("Decor.applyStageData: No items for stage", stage);
            return;
        }

        Promise.all(stageItems.map(item => this._loadItem(item)))
            .then(items => {
                if (token !== this._loadToken) return;

                this.items = items;

                this._updateDecorWeatherFlags();

                this.backItems = this.items.filter(i => i.z !== "front");
                this.frontItems = this.items.filter(i => i.z === "front");

                this._buildBuffers();
            })
            .catch(err => console.error("Decor.applyStageData error:", err));
    }

    _loadItem(item) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () =>
                resolve({
                    img: img,
                    x: item.x || 0,
                    y: item.y || 0,
                    scale: item.scale || 1,
                    z: item.z || "back",

                    // Optional: weather flags from JSON
                    weather: item.weather || null,

                    // Optional: SNES palette name (e.g. "pink", "desert", "forest", "stone", "sakura")
                    palette: item.palette || null,

                    // Optional: how hard the palette swap is (0..1)
                    paletteStrength: (typeof item.paletteStrength === "number")
                        ? item.paletteStrength
                        : 1.0
                });
            img.onerror = () => {
                console.warn("Decor image failed to load:", item && item.src);
                // Resolve anyway so we don't stall stage load
                resolve({
                    img: null,
                    x: item?.x || 0,
                    y: item?.y || 0,
                    scale: item?.scale || 1,
                    z: item?.z || "back",
                    weather: item?.weather || null,
                    palette: item?.palette || null,
                    paletteStrength: (typeof item?.paletteStrength === "number")
                        ? item.paletteStrength
                        : 1.0
                });
            };
            img.src = item.src;
        });
    }

    _updateDecorWeatherFlags() {
        const flags = { sakura: false, snow: false };

        for (const it of this.items) {
            if (!it || !it.weather) continue;
            if (it.weather.sakura === true) flags.sakura = true;
            if (it.weather.snow === true) flags.snow = true;
        }

        window.DecorWeather = flags;
        console.log("DecorWeather:", window.DecorWeather);
    }

    _buildBuffers() {
        const canvas = document.getElementById("game-canvas");
        if (!canvas) {
            console.error("Decor: game-canvas not found");
            return;
        }

        // BACK BUFFER
        this.backBuffer = document.createElement("canvas");
        this.backBuffer.width = canvas.width;
        this.backBuffer.height = canvas.height;

        const bctx = this.backBuffer.getContext("2d");
        bctx.imageSmoothingEnabled = false;

        for (let item of this.backItems) {
            if (!item || !item.img) continue;

            const w = item.img.width * item.scale;
            const h = item.img.height * item.scale;
            const drawY = item.y - h;

            const srcImg = (item.palette)
                ? applySnesPaletteToImage(item.img, item.palette, item.paletteStrength)
                : item.img;

            bctx.drawImage(srcImg, item.x, drawY, w, h);
        }
        this.readyBack = true;

        // FRONT BUFFER
        this.frontBuffer = document.createElement("canvas");
        this.frontBuffer.width = canvas.width;
        this.frontBuffer.height = canvas.height;

        const fctx = this.frontBuffer.getContext("2d");
        fctx.imageSmoothingEnabled = false;

        for (let item of this.frontItems) {
            if (!item || !item.img) continue;

            const w = item.img.width * item.scale;
            const h = item.img.height * item.scale;
            const drawY = item.y - h;

            const srcImg = (item.palette)
                ? applySnesPaletteToImage(item.img, item.palette, item.paletteStrength)
                : item.img;

            fctx.drawImage(srcImg, item.x, drawY, w, h);
        }
        this.readyFront = true;

        console.log("Decor buffers built (back + front)");
    }

    // Old behaviour: draw everything as one (for compatibility)
    draw(ctx) {
        this.drawBack(ctx);
        this.drawFront(ctx);
    }

    // Draw behind characters
    drawBack(ctx) {
        if (this.readyBack && this.backBuffer) {
            ctx.drawImage(this.backBuffer, 0, 0);
        }
    }

    // Draw in front of characters (under UI)
    drawFront(ctx) {
        if (this.readyFront && this.frontBuffer) {
            ctx.drawImage(this.frontBuffer, 0, 0);
        }
    }
}

window.Decor = Decor;
