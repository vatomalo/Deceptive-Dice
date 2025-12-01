// =======================================================
// weatherdirector.js — Random Sakura / Rain / Snow / Grass
// Drives Weather.target* for WeatherFX.js
// =======================================================
console.log("Weather Director Loaded");

// Global timer state
window.WeatherDirector = {
    active: false,
    timeout: null
};

// -------------------------------------------------------
// Weighted random helper
// -------------------------------------------------------
function pickWeatherMode() {
    // 0: clear
    // 1: light sakura
    // 2: heavy sakura
    // 3: light rain
    // 4: heavy rain
    // 5: sakura + rain
    // 6: light snow
    // 7: heavy snow
    // 8: grass breeze
    // 9: grass + petals (spring)
    const modes = [
        { mode: 0, weight: 3 },  // clear
        { mode: 1, weight: 3 },  // light sakura
        { mode: 2, weight: 2 },  // heavy sakura
        { mode: 3, weight: 3 },  // light rain
        { mode: 4, weight: 2 },  // heavy rain
        { mode: 5, weight: 1 },  // sakura + rain (rare)
        { mode: 6, weight: 2 },  // light snow
        { mode: 7, weight: 1 },  // heavy snow (rare)
        { mode: 8, weight: 2 },  // grass breeze
        { mode: 9, weight: 2 }   // grass + petals
    ];

    const totalWeight = modes.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * totalWeight;

    for (let m of modes) {
        if (r < m.weight) return m.mode;
        r -= m.weight;
    }
    return 0;
}

// -------------------------------------------------------
// Apply mode → WeatherFX targets
// This talks directly to Weather.targetPetals / Drops / Flakes / Grass
// -------------------------------------------------------
function applyWeatherMode(mode) {
    if (!window.Weather) return;

    switch (mode) {
        case 0: // clear
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;

            // even on "clear", keep a tiny bit of grass for life
            Weather.targetGrass  = 6;
            break;

        case 1: // light sakura
            Weather.targetPetals = 14;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 8;
            break;

        case 2: // heavy sakura
            Weather.targetPetals = 36;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 12;
            break;

        case 3: // light rain
            Weather.targetPetals = 0;
            Weather.targetDrops  = 70;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 6;
            break;

        case 4: // heavy rain
            Weather.targetPetals = 0;
            Weather.targetDrops  = 130;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 2;   // almost drowned but not dead
            break;

        case 5: // sakura + rain (dramatic)
            Weather.targetPetals = 24;
            Weather.targetDrops  = 90;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 10;
            break;

        case 6: // light snow
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 40;
            Weather.targetGrass  = 4;   // grass under snow, still alive
            break;

        case 7: // heavy snow
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 90;
            Weather.targetGrass  = 0;   // fully buried
            break;

        case 8: // grass breeze
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 18;
            break;

        case 9: // spring wind: grass + petals
            Weather.targetPetals = 20;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 18;
            break;
    }
}

// -------------------------------------------------------
// Duration helper
// -------------------------------------------------------
function pickDuration() {
    // 5–15 seconds, biased toward middle in practice
    return 5000 + Math.random() * 10000;
}

// -------------------------------------------------------
// Main loop
// -------------------------------------------------------
function runWeatherDirector() {
    if (!WeatherDirector.active) return;

    const mode = pickWeatherMode();
    applyWeatherMode(mode);

    const next = pickDuration();
    WeatherDirector.timeout = setTimeout(runWeatherDirector, next);
}

// -------------------------------------------------------
// Public API
// -------------------------------------------------------
window.startWeatherDirector = function () {
    WeatherDirector.active = true;
    runWeatherDirector();
};

window.stopWeatherDirector = function () {
    WeatherDirector.active = false;
    if (WeatherDirector.timeout) {
        clearTimeout(WeatherDirector.timeout);
        WeatherDirector.timeout = null;
    }
};
