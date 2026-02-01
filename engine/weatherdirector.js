// =======================================================
// weatherdirector.js — Random Sakura / Rain / Snow / Grass
// Drives Weather.target* for WeatherFX.js
// RULE: Sakura + Snow ONLY if Decor items allow them.
//       (window.DecorWeather = { sakura: bool, snow: bool })
// =======================================================
console.log("Weather Director Loaded");

// Global timer state
window.WeatherDirector = {
    active: false,
    timeout: null
};

// Ensure default permissions exist (safe fallback)
window.DecorWeather = window.DecorWeather || { sakura: false, snow: false };

// -------------------------------------------------------
// Weighted random helper (decor-gated)
// -------------------------------------------------------
function pickWeatherMode() {
    const allow = window.DecorWeather || { sakura: false, snow: false };

    // Always-allowed baseline modes
    const modes = [
        { mode: 0, weight: 3 },  // clear
        { mode: 3, weight: 3 },  // light rain
        { mode: 4, weight: 2 },  // heavy rain
        { mode: 8, weight: 2 }   // grass breeze
    ];

    // Sakura modes only if decor allows sakura
    if (allow.sakura) {
        modes.push(
            { mode: 1, weight: 3 },  // light sakura
            { mode: 2, weight: 2 },  // heavy sakura
            { mode: 9, weight: 2 }   // grass + petals (spring)
        );
        // Mixed sakura + rain only if sakura allowed
        modes.push({ mode: 5, weight: 1 }); // sakura + rain (rare)
    }

    // Snow modes only if decor allows snow
    if (allow.snow) {
        modes.push(
            { mode: 6, weight: 2 },  // light snow
            { mode: 7, weight: 1 }   // heavy snow (rare)
        );
    }

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
// HARD CLAMP: even if a sakura/snow mode is passed in,
// it will be neutralized unless DecorWeather allows it.
// -------------------------------------------------------
function applyWeatherMode(mode) {
    if (!window.Weather) return;

    const allow = window.DecorWeather || { sakura: false, snow: false };

    // Modes that produce petals (sakura)
    const sakuraModes = new Set([1, 2, 5, 9]);
    // Modes that produce flakes (snow)
    const snowModes   = new Set([6, 7]);

    // If not allowed, force those modes to clear
    if (!allow.sakura && sakuraModes.has(mode)) mode = 0;
    if (!allow.snow   && snowModes.has(mode))   mode = 0;

    switch (mode) {
        case 0: // clear
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;

            // even on "clear", keep a tiny bit of grass for life
            Weather.targetGrass  = 6;
            break;

        case 1: // light sakura (allowed only)
            Weather.targetPetals = 14;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 8;
            break;

        case 2: // heavy sakura (allowed only)
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

        case 5: // sakura + rain (allowed only if sakura allowed)
            Weather.targetPetals = 24;
            Weather.targetDrops  = 90;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 10;
            break;

        case 6: // light snow (allowed only if snow allowed)
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 40;
            Weather.targetGrass  = 4;   // grass under snow, still alive
            break;

        case 7: // heavy snow (allowed only if snow allowed)
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

        case 9: // spring wind: grass + petals (allowed only if sakura allowed)
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
