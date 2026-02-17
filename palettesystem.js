// =======================================================
// palettesystem.js — Day/Night Cycle (CV2 / NG1-2 mood)
// Smooth transitions + WORLD tint helpers
//
// IMPORTANT RULE:
// - PaletteSystem NEVER enables sakura or snow by itself.
// - It may only set petals/flakes targets if decor.json explicitly allows.
//   (window.DecorWeather = { sakura: bool, snow: bool })
//
// NOTES:
// - This file does NOT randomize weather. It only suggests targets by phase.
// - If you use WeatherDirector, you should disable Palette weather targets
//   OR set PaletteSystem.enabledWeather = false.
// =======================================================

console.log("PaletteSystem loaded");

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpColor(a, b, t) {
    return [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
        lerp(a[3], b[3], t)
    ];
}

// Smoothstep easing so transitions feel organic
function easeSmooth(t) {
    return t * t * (3 - 2 * t);
}

// -------------------------------------------------------
// Palette profiles — tuned for CONTRAST and mood
// (overlay = [r,g,b,alpha], darkness = extra black veil)
// -------------------------------------------------------
const PALETTE_PROFILES = {
    dawn:  { overlay: [130, 110, 170, 0.22], darkness: 0.06 },
    day:   { overlay: [200, 220, 255, 0.10], darkness: 0.03 },
    dusk:  { overlay: [160,  70,  90, 0.32], darkness: 0.14 },
    night: { overlay: [ 25,  30,  75, 0.55], darkness: 0.24 }
};

// Order of phases
const PALETTE_SEQUENCE = ["dawn", "day", "dusk", "night"];

// Base durations (ms)
const BASE_DURATIONS = {
    dawn:  14000,
    day:   28000,
    dusk:  14000,
    night: 30000
};

// =======================================================
// PaletteSystem — singleton
// =======================================================
class PaletteSystemClass {
    constructor() {
        this.currentPhase  = "day";
        this.phaseTime     = 0;
        this.phaseDuration = BASE_DURATIONS.day;

        // Transition state: fromPhase → toPhase
        this.inTransition  = false;
        this.transitionT   = 0;
        this.fromPhase     = "day";
        this.toPhase       = "day";

        this.currentOverlay  = [0, 0, 0, 0];
        this.currentDarkness = 0;

        this.enabled = true;
        this.timeScale = 1.0;

        // If you have WeatherDirector running, you probably want this false.
        // If true, PaletteSystem will suggest targets every phase change/start.
        this.enabledWeather = true;

        this._applyProfile(PALETTE_PROFILES.day);
        this._applyWeatherForPhase("day");
    }

    // Start from a given phase
    start(phase = "day") {
        if (!PALETTE_PROFILES[phase]) phase = "day";

        this.currentPhase  = phase;
        this.phaseTime     = 0;
        this.phaseDuration = BASE_DURATIONS[phase];

        this.inTransition  = false;
        this.transitionT   = 0;
        this.fromPhase     = phase;
        this.toPhase       = phase;

        this._applyProfile(PALETTE_PROFILES[phase]);
        this._applyWeatherForPhase(phase);
    }

    // Helper: get next in sequence
    _getNextPhase(phase) {
        const idx = PALETTE_SEQUENCE.indexOf(phase);
        if (idx === -1) return "day";
        return PALETTE_SEQUENCE[(idx + 1) % PALETTE_SEQUENCE.length];
    }

    // Immediately set palette without transition
    _applyProfile(profile) {
        this.currentOverlay  = profile.overlay.slice();
        this.currentDarkness = profile.darkness;
    }

    // -------------------------------------------------------
    // WEATHER HOOK (GATED BY DECOR!)
    //
    // - Rain can be time-of-day driven.
    // - Sakura petals ONLY if window.DecorWeather.sakura === true
    // - Snow flakes ONLY if window.DecorWeather.snow === true
    //
    // This system does NOT "enable" effects; it only suggests targets.
    // WeatherFX must still clamp targets if decor disallows.
    // -------------------------------------------------------
    _applyWeatherForPhase(phase) {
        if (!this.enabledWeather) return;
        if (!window.Weather) return;

        const allow = window.DecorWeather || { sakura: false, snow: false };

        let petals = 0;
        let drops  = 0;
        let flakes = 0;

        // Time-of-day mood targets
        switch (phase) {
            case "dawn":
                // Strong petals + light rain (IF sakura allowed)
                petals = 40;
                drops  = 20;
                flakes = 0;
                break;

            case "day":
                // Light petals + almost no rain (IF sakura allowed)
                petals = 18;
                drops  = 4;
                flakes = 0;
                break;

            case "dusk":
                // Mixed mood: some petals, mid rain (IF sakura allowed)
                petals = 24;
                drops  = 70;
                flakes = 0;
                break;

            case "night":
                // Heavy rain, rare petals (IF sakura allowed)
                petals = 5;
                drops  = 140;
                flakes = 0;
                break;
        }

        // HARD GATES: never produce sakura/snow unless decor explicitly allows it
        if (!allow.sakura) petals = 0;
        if (!allow.snow)   flakes = 0;

        // Apply to WeatherFX targets (must match your WeatherFX property names)
        Weather.targetPetals = petals;
        Weather.targetDrops  = drops;

        // Only write flakes if your WeatherFX uses it
        if ("targetFlakes" in Weather) {
            Weather.targetFlakes = flakes;
        }

        // Compatibility mirrors
        if ("maxPetals" in Weather) Weather.maxPetals = petals;
        if ("maxDrops"  in Weather) Weather.maxDrops  = drops;

        // Optional: mirror flakes for compatibility if present
        if ("maxFlakes" in Weather && "targetFlakes" in Weather) {
            Weather.maxFlakes = flakes;
        }
    }

    // Begin a smooth transition from the current phase to target
    _beginTransition(toPhase) {
        if (!PALETTE_PROFILES[toPhase]) return;

        this.inTransition = true;
        this.transitionT  = 0;

        this.fromPhase = this.currentPhase;
        this.toPhase   = toPhase;

        this.phaseTime     = 0;
        this.phaseDuration = BASE_DURATIONS[toPhase];

        this._applyWeatherForPhase(toPhase);
        this._dispatchPhaseEvent(toPhase);
    }

    // Public: force change phase
    setPhase(phase, smooth = true) {
        if (!PALETTE_PROFILES[phase]) return;

        if (!smooth) {
            this.currentPhase  = phase;
            this.inTransition  = false;
            this.transitionT   = 1;
            this.fromPhase     = phase;
            this.toPhase       = phase;
            this.phaseTime     = 0;
            this.phaseDuration = BASE_DURATIONS[phase];

            this._applyProfile(PALETTE_PROFILES[phase]);
            this._applyWeatherForPhase(phase);
            this._dispatchPhaseEvent(phase);
            return;
        }

        this._beginTransition(phase);
    }

    // Dispatch events you can hook in announcer / BGM
    _dispatchPhaseEvent(phase) {
        const evtName = {
            dawn:  "DAWN_EVENT",
            day:   "DAY_EVENT",
            dusk:  "DUSK_EVENT",
            night: "NIGHTFALL_EVENT"
        }[phase];

        if (evtName) {
            window.dispatchEvent(new CustomEvent(evtName, {
                detail: { phase }
            }));
        }
    }

    // Main tick — call each frame with dt in ms
    update(dt) {
        if (!this.enabled) return;

        dt *= this.timeScale;
        this.phaseTime += dt;

        // Auto cycle
        if (!this.inTransition && this.phaseTime >= this.phaseDuration) {
            const next = this._getNextPhase(this.currentPhase);
            this._beginTransition(next);
        }

        // Transition blending
        if (this.inTransition) {
            const TRANSITION_TIME = 4000;

            this.transitionT += dt / TRANSITION_TIME;
            if (this.transitionT >= 1) {
                this.transitionT  = 1;
                this.inTransition = false;

                // Fully arrived
                this.currentPhase = this.toPhase;
                this.fromPhase    = this.toPhase;
            }
        }

        const fromProfile = PALETTE_PROFILES[this.fromPhase];
        const toProfile   = PALETTE_PROFILES[this.toPhase];

        const t = this.inTransition ? easeSmooth(this.transitionT) : 1.0;

        this.currentOverlay  = lerpColor(fromProfile.overlay, toProfile.overlay, t);
        this.currentDarkness = lerp(fromProfile.darkness, toProfile.darkness, t);
    }

    // -------------------------------------------------------
    // Apply tint on the whole scene (world layer only)
    // (Call after world is drawn, before UI)
    // -------------------------------------------------------
    applyWorldTint(ctx, canvas) {
        if (!this.enabled) return;
        if (!ctx || !canvas) return;

        const [r, g, b, a] = this.currentOverlay;

        ctx.save();

        // Darkness veil first
        if (this.currentDarkness > 0) {
            ctx.globalAlpha = this.currentDarkness;
            ctx.fillStyle = "black";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Then colored overlay
        if (a > 0) {
            ctx.globalAlpha = a;
            ctx.fillStyle = `rgba(${r|0}, ${g|0}, ${b|0}, 1)`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.restore();
    }

    // Optional: vignette on night only
    applyVignette(ctx, canvas) {
        if (!this.enabled) return;
        if (!ctx || !canvas) return;
        if (this.currentPhase !== "night") return;

        const strength = 0.35;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const maxR = Math.sqrt(cx * cx + cy * cy);

        const gradient = ctx.createRadialGradient(
            cx, cy, maxR * 0.3,
            cx, cy, maxR
        );

        gradient.addColorStop(0.0, "rgba(0,0,0,0)");
        gradient.addColorStop(1.0, `rgba(0,0,0,${strength})`);

        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // Convenience getters
    getOverlay() {
        return this.currentOverlay.slice();
    }

    getDarkness() {
        return this.currentDarkness;
    }
}

// Attach to window
window.PaletteSystem = new PaletteSystemClass();
