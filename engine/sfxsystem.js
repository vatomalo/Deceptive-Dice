// =======================================================
// sfxsystem.js — Randomized SFX with per-category cooldown
// Ensures the SAME category can't spam (e.g. hit/hit/hit)
// =======================================================
console.log("SFX System Loaded");

// -------------------------------------------------------
// Base folder (relative to index.html)
// Files like: ./SFX/hit1.wav, ./SFX/hit2.wav, etc.
// -------------------------------------------------------
const SFX_PATH = "./SFX";

// -------------------------------------------------------
// Categories + max variations
// -------------------------------------------------------
const SFX_CATEGORIES = {
    swing: 9,
    melee: 9,
    dodge: 9,
    hit: 9,
    block: 9,
    death: 9,
    step: 9,
    ui: 9
};

// -------------------------------------------------------
// Sound pool + state
// -------------------------------------------------------
const SFXPool = {};  // category → Audio[]
const SFXState = {
    lastPlayTime: {}, // category → timestamp (ms)
    lastIndex: {}     // category → last used index
};

// Minimum delay between two sounds of the same category (ms)
const SFX_CATEGORY_COOLDOWN_MS = 320;

// -------------------------------------------------------
// Preload all SFX
// -------------------------------------------------------
function preloadAllSFX() {
    for (const category in SFX_CATEGORIES) {
        const max = SFX_CATEGORIES[category];
        SFXPool[category] = [];

        for (let i = 1; i <= max; i++) {
            const path = `${SFX_PATH}/${category}${i}.wav`;
            const audio = new Audio(path);
            audio.preload = "auto";
            SFXPool[category].push(audio);
        }
        console.log(`[SFX] Preloaded category: ${category} (${max} variations)`);
    }

    console.log("[SFX] All assets preloaded");
}

// -------------------------------------------------------
// Helper: pick random index, avoid same sample twice in a row
// -------------------------------------------------------
function pickRandomIndex(category) {
    const sounds = SFXPool[category];
    if (!sounds || sounds.length === 0) return -1;

    const len = sounds.length;
    if (len === 1) return 0;

    const last = SFXState.lastIndex[category];
    let idx = Math.floor(Math.random() * len);

    if (typeof last === "number" && len > 1 && idx === last) {
        idx = (idx + 1) % len;
    }

    SFXState.lastIndex[category] = idx;
    return idx;
}

// -------------------------------------------------------
// Public API: SFX.play("hit", 0.8)
// -------------------------------------------------------
const SFX = {
    play(category, volume = 1.0) {
        const sounds = SFXPool[category];
        if (!sounds) {
            console.warn(`[SFX] Category not found: ${category}`);
            return;
        }

        const now = (window.performance && performance.now)
            ? performance.now()
            : Date.now();

        const last = SFXState.lastPlayTime[category] || 0;

        // HARD GUARD: don't let same category fire too often
        if (now - last < SFX_CATEGORY_COOLDOWN_MS) {
            // Uncomment if you want to see skips in console:
            // console.log(`[SFX] Skipped ${category} (cooldown)`);
            return;
        }

        const idx = pickRandomIndex(category);
        if (idx < 0) return;

        const audio = sounds[idx];
        if (!audio) return;

        SFXState.lastPlayTime[category] = now;

        audio.currentTime = 0;
        audio.volume = volume;

        // Debug: log which file we tried to play
        // (will spam a bit, but useful while debugging)
        // console.log(`[SFX] Playing ${category}${idx + 1}`);

        audio.play().catch(err => {
            console.warn("[SFX] play() error:", err);
        });
    }
};

// -------------------------------------------------------
// Initialize immediately (no waiting for window.load)
// -------------------------------------------------------
preloadAllSFX();
window.SFX = SFX;

// Optional: quick manual test helper
window.testSFX = function () {
    if (window.SFX) {
        SFX.play("hit", 0.8);
    }
};
