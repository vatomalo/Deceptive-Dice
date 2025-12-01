// =======================================================
// sfxsystem.js — Modular Randomized SFX Engine
// swing1–9, melee1–9, dodge1–9, etc.
// =======================================================
console.log("SFX System Loaded");

// -------------------------------------------------------
// Base folder (relative to index.html)
// Example path structure:
//   /SFX/swing/swing1.wav
//   /SFX/swing/swing2.wav
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
    ui: 9 // (optional future UI sounds)
};

// -------------------------------------------------------
// Sound pool (preload optional)
// -------------------------------------------------------
const SFXPool = {};  // category → array of Audio()

// Preload all SFX on load (optional but recommended)
// -------------------------------------------------------
function preloadAllSFX() {
    for (const category in SFX_CATEGORIES) {
        const max = SFX_CATEGORIES[category];
        SFXPool[category] = [];

        for (let i = 1; i <= max; i++) {
            const audio = new Audio(`${SFX_PATH}/${category}/${category}${i}.wav`);
            audio.preload = "auto";
            SFXPool[category].push(audio);
        }
    }

    console.log("SFX assets preloaded");
}

// -------------------------------------------------------
// Play a random sound from category
// Example: SFX.play("swing");
// -------------------------------------------------------
const SFX = {
    play(category, volume = 1.0) {
        if (!SFXPool[category]) {
            console.warn(`SFX category not found: ${category}`);
            return;
        }

        const sounds = SFXPool[category];
        const pick = sounds[Math.floor(Math.random() * sounds.length)];

        if (!pick) return;

        const audio = pick.cloneNode(); // avoid blocking reuse
        audio.volume = volume;
        audio.play().catch(err => { /* ignore autoplay errors */ });
    }
};

// -------------------------------------------------------
// Initialize on page load
// -------------------------------------------------------
window.addEventListener("load", () => {
    preloadAllSFX();
});

window.SFX = SFX;
