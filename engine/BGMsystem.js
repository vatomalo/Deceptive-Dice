// =======================================================
// BGMsystem.js — Single-element BGM (no double playback)
// Crossfade API kept as dormant stub
// =======================================================
console.log("MusicSystem loaded");

// ----------------------------------------------------
// GLOBAL MOOD STATE
// ----------------------------------------------------
let currentMood = "calm";
let lastMood = null;

window.setMood = function (newMood) {
  currentMood = newMood;
  console.log("Mood set to:", currentMood);

  // ✅ Parallax speed follows mood (no touching layers directly)
  if (typeof window.setTickMood === "function") {
    setTickMood(currentMood);
  }

  // Optional: change music when mood changes
  if (window.MusicSystem && MusicSystem.playRandom) {
    MusicSystem.playRandom(true); // force swap to new mood folder
  }
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
    async playRandom(force = false) {
        if (!bgmEl) return;

        if (!force && this.lastMood === currentMood && this.currentName && !bgmEl.paused) return;
        this.lastMood = currentMood;

        // If we already have something playing and we're not forcing, don't restart
        if (!force && this.currentName && !bgmEl.paused && bgmEl.currentTime > 0.2) {
            return;
        }

        // Debounce: prevent spam calls during transitions
        const now = performance.now();
        if (!force) {
            this._lastPlayReq = this._lastPlayReq || 0;
            if (now - this._lastPlayReq < 800) return; // 0.8s guard
            this._lastPlayReq = now;
        }

        // If we’re already on a track in the same mood, don’t hard-stop; just keep it
        // (Optional: if you want mood-specific, track it)
        // if (this._currentMood === currentMood && !force) return;
        // this._currentMood = currentMood;

        // Instead of hard stop, do a safe source swap:
        const name = this.baseNames[Math.floor(Math.random() * this.baseNames.length)];
        const src = this.buildTrackPath(name);

        // If it's the same src, do nothing
        if (!force && bgmEl.src && bgmEl.src.endsWith(src)) return;

        console.log("BGM →", src);

        // DON'T pause() first; just replace source
        bgmEl.src = src;
        bgmEl.loop = true;
        bgmEl.volume = 1.0;
        this.currentName = name;

        try {
            await bgmEl.play();
        } catch (err) {
            console.warn("BGM play failed:", err);
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

(() => {
    const bgmEl = document.getElementById("audioPlayer");
    if (!bgmEl) return;

    const log = (ev) => {
        console.log(`[BGM EVENT] ${ev.type}`, {
            paused: bgmEl.paused,
            ended: bgmEl.ended,
            currentTime: bgmEl.currentTime,
            src: bgmEl.currentSrc || bgmEl.src,
            vol: bgmEl.volume,
            muted: bgmEl.muted,
            readyState: bgmEl.readyState,
            networkState: bgmEl.networkState
        });
    };

    ["pause", "ended", "error", "stalled", "abort", "emptied", "suspend", "waiting"].forEach(e =>
        bgmEl.addEventListener(e, log)
    );

    // THE MONEY SHOT: trace any call to pause() on THIS element
    const _pause = bgmEl.pause.bind(bgmEl);
    bgmEl.pause = function () {
        console.trace("[TRACE] bgmEl.pause() called from:");
        return _pause();
    };

    console.log("[BGM TRACE] installed");
})();

window.MusicSystem = MusicSystem;
