// =======================================================
// attract.js — Battousai-style Attract Mode
// Samurai blinks between knights in a cinematic loop
// =======================================================
console.log("attract.js loaded");

(function () {

    // Simple helper (reuse global if you want)
    const sleep = window.sleep || (ms => new Promise(res => setTimeout(res, ms)));

    const AttractMode = {
        active: false,
        running: false,
        samurai: null,
        knight: null,

        init(samurai, knight) {
            this.samurai = samurai;
            this.knight = knight;
        },

        start() {
            if (!this.samurai || !this.knight) {
                console.warn("AttractMode: samurai/knight not ready yet.");
                return;
            }
            if (this.running) return;

            this.active = true;
            this.running = true;
            this.loop(); // fire and forget
        },

        stop() {
            this.active = false;
        },

        async loop() {
            const s = this.samurai;
            const k = this.knight;

            if (!s || !k) {
                this.running = false;
                return;
            }

            const HOME_X = window.SAMURAI_HOME_X || 120;
            const HOME_Y = window.SAMURAI_HOME_Y || 375;

            while (this.active) {
                try {
                    // Reset pose
                    s.flip = false;
                    s.setState("idle");
                    await sleep(400);

                    // ------------------------------------------
                    // 1) Classic run-in + strike at current knight
                    // ------------------------------------------
                    s.flip = false;
                    s.setState("run");
                    await s.blinkTo(k.x - 70, HOME_Y);
                    await sleep(60);

                    s.setState("attack");
                    if (window.fxManager && window.FX_SLASH) {
                        fxManager.spawn(
                            FX_SLASH,
                            k.x - 40,
                            k.y - 100,
                            1.2,
                            false,
                            70
                        );
                    }
                    if (window.SFX && SFX.play) {
                        SFX.play("swing", 0.8);
                    }
                    await sleep(220);

                    // ------------------------------------------
                    // 2) Battousai “multi-kill” blinks
                    //    reuse the vibe of your PASS event
                    // ------------------------------------------
                    // Random pattern selection
                    const r = Math.floor(Math.random() * 4);

                    if (r === 0) {
                        // Left, mid, right
                        s.flip = false;
                        await s.blinkTo(260, HOME_Y);
                        await sleep(160);
                        await s.blinkTo(540, HOME_Y);
                        await sleep(160);
                        await s.blinkTo(360, HOME_Y);
                        await sleep(200);
                    } else if (r === 1) {
                        // Behind knight then back to front
                        s.flip = true;
                        await s.blinkTo(k.x + 90, HOME_Y);
                        await sleep(180);
                        s.flip = false;
                        await s.blinkTo(k.x - 60, HOME_Y);
                        await sleep(180);
                    } else if (r === 2) {
                        // Extreme left → center
                        s.flip = false;
                        await s.blinkTo(20, HOME_Y);
                        await sleep(160);
                        await s.blinkTo(260, HOME_Y);
                        await sleep(160);
                    } else {
                        // High-speed zig-zag
                        s.flip = false;
                        await s.blinkTo(220, HOME_Y);
                        await sleep(120);
                        s.flip = true;
                        await s.blinkTo(520, HOME_Y);
                        await sleep(120);
                    }

                    // Optional shadow clone ghosting (like PASS)
                    if (window.shadowClones && typeof spawnShadowClone === "function") {
                        shadowClones.push(spawnShadowClone(s));
                    }

                    // ------------------------------------------
                    // 3) Return home pose
                    // ------------------------------------------
                    await sleep(120);
                    await s.blinkTo(HOME_X, HOME_Y);
                    await sleep(180);

                    s.setState("idle");
                    s.flip = false;

                    if (window.shadowClones) {
                        shadowClones.length = 0;
                    }

                    // Small pause before the next loop
                    await sleep(650);

                } catch (e) {
                    console.warn("AttractMode loop error:", e);
                    break;
                }
            }

            this.running = false;
        }
    };

    window.AttractMode = AttractMode;

})();
