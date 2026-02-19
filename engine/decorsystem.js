console.log("ForegroundDecor LOADED");

// =======================================================
// SNES-STYLE PALETTES (4–6 color ramps)
// Map pixels by luminance -> ramp index
// =======================================================
const SNES_PALETTES = {
    // Greens / foliage
    forest: [
        [18, 32, 18],
        [34, 64, 34],
        [60, 110, 60],
        [110, 170, 90],
        [190, 230, 150]
    ],

    // Sakura / pink ramp
    pink: [
        [45, 10, 20],
        [95, 35, 55],
        [155, 80, 105],
        [225, 140, 175],
        [255, 205, 225]
    ],

    // Desert / sand / dry cliffs
    desert: [
        [35, 25, 10],
        [85, 60, 25],
        [145, 110, 55],
        [210, 175, 95],
        [255, 235, 185]
    ],

    // Sky / clean blue ramp
    sky: [
        [10, 20, 50],
        [40, 70, 130],
        [90, 140, 210],
        [160, 200, 250],
        [225, 245, 255]
    ],

    // Purple dusk vibe
    dusk: [
        [20, 10, 35],
        [55, 25, 75],
        [105, 45, 110],
        [170, 80, 135],
        [230, 150, 170]
    ],

    // Snow / ice wash
    snow: [
        [20, 30, 55],
        [60, 80, 120],
        [120, 150, 190],
        [190, 215, 235],
        [245, 250, 255]
    ],

    // Wood / bark
    wood: [
        [30, 18, 10],
        [70, 40, 20],
        [120, 75, 40],
        [180, 125, 75],
        [235, 200, 160]
    ],

    // Stone / metal gray
    stone: [
        [20, 20, 25],
        [55, 55, 70],
        [105, 110, 130],
        [175, 180, 200],
        [240, 245, 255]
    ],

    // Accent ramps
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
// Decor system with separate BACK and FRONT buffers
// + DecorWeather flags (sakura/snow ONLY if decor.json says so)
// + Per-item SNES palette swapping (palette: "pink"/"desert"/etc.)
// + Stage transition support: await decor.loadStage("new_stage")
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

        this.loadStage(stage);
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
            const res = await fetch(`Artwork/BG/${this.stage}/decor.json`);
            const data = await res.json();

            // If another stage load started after this one, abort
            if (token !== this._loadToken) return;

            const stageItems = data[this.stage];
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

        const stageItems = data && data[stage];
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
