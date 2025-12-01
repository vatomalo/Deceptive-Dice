console.log("MusicSystem loaded");

// ----------------------------------------------------
// GLOBAL MOOD STATE
// "calm", "tense", "story", etc.
// ----------------------------------------------------
let currentMood = "calm";

// Expose mood setter
window.setMood = function (newMood) {
    currentMood = newMood;
    console.log(`Mood set to: ${currentMood}`);
};


// ----------------------------------------------------
// MUSIC SYSTEM
// ----------------------------------------------------
const MusicSystem = {

    // Just the base names, we’ll inject mood when we build the path
    // Files are expected like: ./BGM/calm/BG3.mp3, ./BGM/tense/BG3.mp3, ...
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

    current: null,     // currently audible track
    next: null,        // track we’re fading *into*
    fadeTime: 1500,    // crossfade duration in ms
    preFadeMs: 5000,   // how long before end we start next track
    nextTimer: null,   // timeout id for scheduling next track

    clamp(v) {
        return Math.min(1, Math.max(0, v));
    },

    // Build a full path for the current mood + name
    buildTrackPath(name) {
        // Example: "./BGM/calm/BG3.mp3"
        return `./BGM/${currentMood}/${name}.mp3`;
    },

    // ------------------------------------------------
    // MAIN ENTRY: play any random track for currentMood
    // Call this again after changing mood to force a swap:
    //   setMood("tense");
    //   MusicSystem.playRandom();
    // ------------------------------------------------
    async playRandom() {

        // Clear any pending "auto-next" from the previous track
        if (this.nextTimer) {
            clearTimeout(this.nextTimer);
            this.nextTimer = null;
        }

        // pick a base name and build the path *for the current mood*
        const name = this.baseNames[Math.floor(Math.random() * this.baseNames.length)];
        const pick = this.buildTrackPath(name);

        console.log("Playing BGM:", pick);

        this.next = new Audio(pick);
        this.next.volume = 0;
        this.next.loop = false;

        let played = false;
        try {
            await this.next.play();
            played = true;
        } catch (err) {
            console.warn("Autoplay blocked, retrying after 200ms...", err);
            setTimeout(() => this.playRandom(), 200); // arrow keeps `this`
            return;
        }

        if (!played) return;

        // Crossfade into this.next
        this.crossfade();
    },

    // ------------------------------------------------
    // SCHEDULE NEXT TRACK (overlaps before end)
    // ------------------------------------------------
    scheduleNext(track) {
        if (!track) return;

        // Cancel any old timer
        if (this.nextTimer) {
            clearTimeout(this.nextTimer);
            this.nextTimer = null;
        }

        const startTimer = () => {
            const durSec = track.duration;
            const durMs = durSec * 1000;

            // If duration is unknown or too short, fall back to onended
            if (!isFinite(durMs) || durMs <= this.preFadeMs + 500) {
                track.onended = () => {
                    // Start a new random track *when this one really ends*
                    this.playRandom();
                };
                return;
            }

            const wait = Math.max(200, durMs - this.preFadeMs);

            this.nextTimer = setTimeout(() => {
                // When this fires, we are still inside this track,
                // so we start the next one early and crossfade.
                this.playRandom();
            }, wait);

            // Fail-safe: if something weird happens, still move on at end.
            track.onended = () => {
                if (this.nextTimer) {
                    clearTimeout(this.nextTimer);
                    this.nextTimer = null;
                }
                this.playRandom();
            };
        };

        // Duration may not be ready yet
        if (!isFinite(track.duration) || track.duration === 0) {
            track.addEventListener("loadedmetadata", startTimer, { once: true });
        } else {
            startTimer();
        }
    },

    // ------------------------------------------------
    // CROSSFADE: old → new
    // ------------------------------------------------
    crossfade() {

        // First track: just fade in
        if (!this.current) {
            this.current = this.next;
            const t0 = performance.now();

            const fadeIn = (now) => {
                const p = this.clamp((now - t0) / this.fadeTime);
                this.current.volume = p;
                if (p < 1) {
                    requestAnimationFrame(fadeIn);
                }
            };
            requestAnimationFrame(fadeIn);

            // Schedule its successor *before* it ends
            this.scheduleNext(this.current);
            return;
        }

        // Subsequent tracks: crossfade old → new
        const oldTrack = this.current;
        const newTrack = this.next;
        const t0 = performance.now();

        const fade = (now) => {
            const p = this.clamp((now - t0) / this.fadeTime);
            oldTrack.volume = this.clamp(1 - p);
            newTrack.volume = this.clamp(p);

            if (p < 1) {
                requestAnimationFrame(fade);
            } else {
                oldTrack.pause();
            }
        };

        this.current = newTrack;
        requestAnimationFrame(fade);

        // Schedule next track for the *new* current
        this.scheduleNext(this.current);
    }
};

// Make it GLOBAL
window.MusicSystem = MusicSystem;
// =======================================================
