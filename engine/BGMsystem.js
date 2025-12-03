// =======================================================
// BGMsystem.js — Single-element BGM (no double playback)
// Crossfade API kept as dormant stub
// =======================================================
console.log("MusicSystem loaded");

// ----------------------------------------------------
// GLOBAL MOOD STATE
// ----------------------------------------------------
let currentMood = "calm";

window.setMood = function (newMood) {
    currentMood = newMood;
    console.log("Mood set to:", currentMood);
    if (currentMood== "calm")
    {window.ParallaxBG.layer.speed = 1}
};

// ----------------------------------------------------
// Grab the single global audio element
// ----------------------------------------------------
const bgmEl = document.getElementById("audioPlayer");
if (!bgmEl) {
    console.warn("BGMsystem: #audioPlayer not found in DOM!");
}

// Make sure it loops by default
if (bgmEl) {
    bgmEl.loop = true;
    bgmEl.volume = 1.0;
}

// ----------------------------------------------------
// MUSIC SYSTEM
// ----------------------------------------------------
const MusicSystem = {

    baseNames: [
        "BG",
        "BG1",
        "BG2",
        "BG3",
        "BG4",
        "BG5",
        "BG6",
        "BG7"
    ],

    currentName: null,
    fadeTime: 1500,

    clamp(v) {
        return Math.min(1, Math.max(0, v));
    },

    // ./BGM/<mood>/<name>.mp3
    buildTrackPath(name) {
        return `./BGM/${currentMood}/${name}.mp3`;
    },

    // ------------------------------------------------
    // STOP — guarantees no music is playing
    // ------------------------------------------------
    stop() {
        if (!bgmEl) return;
        bgmEl.pause();
        // optional: reset src so it releases
        // bgmEl.src = "";
        this.currentName = null;
    },

    // =================================================
    // SIMPLE: PLAY RANDOM + LOOP (NO CROSSFADES)
    // =================================================
    async playRandom() {
        if (!bgmEl) return;

        // Hard stop anything currently playing
        this.stop();

        const name = this.baseNames[Math.floor(Math.random() * this.baseNames.length)];
        const src  = this.buildTrackPath(name);

        console.log("BGM →", src);

        bgmEl.src    = src;
        bgmEl.loop   = true;
        bgmEl.volume = 1.0;

        this.currentName = name;

        try {
            await bgmEl.play();
        } catch (err) {
            console.warn("BGM autoplay blocked:", err);
        }
    },

    // =================================================
    // DORMANT: CROSSFADING STUB (kept for later)
    // Right now this just logs instead of actually
    // running a 2-source crossfade, to avoid bugs.
    // =================================================
    async crossfadeTo(name) {
        console.log(
            "MusicSystem.crossfadeTo called with",
            name,
            "→ crossfade is currently dormant (single-audio mode)"
        );

        // If you *really* want to swap tracks smoothly for now,
        // we can do a crude fade-out + fade-in on the same element:
        if (!bgmEl) return;

        const newSrc = this.buildTrackPath(name);
        const fadeDur = this.fadeTime;
        const startVolume = bgmEl.volume;

        // Fade out
        const startOut = performance.now();
        const fadeOutStep = (now) => {
            const t = this.clamp((now - startOut) / fadeDur);
            bgmEl.volume = startVolume * (1 - t);
            if (t < 1) {
                requestAnimationFrame(fadeOutStep);
            } else {
                // swap source and fade back in
                bgmEl.pause();
                bgmEl.src = newSrc;
                bgmEl.volume = 0;
                bgmEl.play().then(() => {
                    const startIn = performance.now();
                    const fadeInStep = (now2) => {
                        const t2 = this.clamp((now2 - startIn) / fadeDur);
                        bgmEl.volume = t2;
                        if (t2 < 1) {
                            requestAnimationFrame(fadeInStep);
                        }
                    };
                    requestAnimationFrame(fadeInStep);
                }).catch(err => {
                    console.warn("BGM crossfade play failed:", err);
                });
            }
        };
        requestAnimationFrame(fadeOutStep);
    }
};

window.MusicSystem = MusicSystem;
