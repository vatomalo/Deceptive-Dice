// =======================================================
// sfxsystem.js — Randomized SFX with per-category cooldown
// Explicit file list so we never play missing sources.
// Also exposes playSamurai / playKnight / playUI wrappers.
// =======================================================
console.log("SFX System Loaded");

// Base folder (relative to index.html)
const SFX_PATH = "./SFX";

// -------------------------------------------------------
// Explicit file list per category
// *** Only list files you actually have ***
// Add more later as you create them.
// -------------------------------------------------------
const SFX_FILES = {
    swing: ["swing1.mp3"],
    dodge: ["dodge1.mp3"],
    hit:   ["hit1.mp3"],    // remove/adjust if you don't have these yet
    block: ["block1.mp3"],  // "
    death: [],              // no files yet → empty list is fine
    step:  ["step1.mp3"],
    ui:    ["ui1.mp3"],
    grunt: ["/male/battle_grunt1.mp3"],
    voice_attack: ["/male/battle_grunt1.mp3"]

    // You can add: melee: ["melee1.wav"], etc.
};

// -------------------------------------------------------
// Sound pool + state
// -------------------------------------------------------
const SFXPool = {};  // category → Audio[]
const SFXState = {
    lastPlayTime: {}, // category → timestamp (ms)
    lastIndex: {}     // category → last used index
};

// Min delay between same-category plays (ms)
const SFX_CATEGORY_COOLDOWN_MS = 320;

// -------------------------------------------------------
// Preload all SFX defined in SFX_FILES
// -------------------------------------------------------
function preloadAllSFX() {
    for (const category in SFX_FILES) {
        const files = SFX_FILES[category];
        SFXPool[category] = [];

        files.forEach(fileName => {
            const path = `${SFX_PATH}/${fileName}`;
            const audio = new Audio(path);
            audio.preload = "auto";

            // Log if this particular file fails
            audio.addEventListener("error", () => {
                console.warn(`[SFX] Failed to load: ${path}`);
            });

            SFXPool[category].push(audio);
        });

        console.log(
            `[SFX] Category '${category}' loaded (${SFXPool[category].length} files)`
        );
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
// Core play
// SFX.play("hit", 0.8)
// -------------------------------------------------------
const SFX = {
    play(category, volume = 1.0) {
        const sounds = SFXPool[category];
        if (!sounds || sounds.length === 0) {
            console.warn(`[SFX] Category empty or not found: ${category}`);
            return;
        }

        const now = (window.performance && performance.now)
            ? performance.now()
            : Date.now();

        const last = SFXState.lastPlayTime[category] || 0;

        // Cooldown per category
        if (now - last < SFX_CATEGORY_COOLDOWN_MS) {
            return;
        }

        const idx = pickRandomIndex(category);
        if (idx < 0) return;

        const audio = sounds[idx];
        if (!audio) return;

        SFXState.lastPlayTime[category] = now;

        audio.currentTime = 0;
        audio.volume = volume;

        audio.play().catch(err => {
            console.warn("[SFX] play() error:", err);
        });
    }
};

// -------------------------------------------------------
// Channel wrappers used by combat.js
// Extra args (options) are currently ignored but kept
// so we can later add pitch/reverb (WebAudio) without
// touching combat.js again.
// -------------------------------------------------------
SFX.playSamurai = function (category, volume = 1.0, options = {}) {
    SFX.play(category, volume);
};

SFX.playKnight = function (category, volume = 1.0, options = {}) {
    SFX.play(category, volume);
};

SFX.playUI = function (category, volume = 1.0, options = {}) {
    SFX.play(category, volume);
};

// -------------------------------------------------------
// Initialize immediately
// -------------------------------------------------------
preloadAllSFX();
window.SFX = SFX;

// Optional: quick manual test helper in console
window.testSFX = function (category = "hit") {
    if (window.SFX) {
        SFX.play(category, 0.8);
    }
};
