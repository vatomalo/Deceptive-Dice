// =======================================================
// DICE SYSTEM — CLEAN, COMBAT-SAFE, FINAL VERSION
// =======================================================
console.log("dice.js loaded");

class DiceSystem {

    constructor(ctx, sheetSrc = "Artwork/FX/dice.png") {

        this.ctx = ctx;

        // sprite sheet
        this.sheet = new Image();
        this.sheet.src = sheetSrc;

        this.loaded = false;

        // sheet layout (3×2 grid)
        this.tilesX = 3;
        this.tilesY = 2;

        this.frameW = 0;
        this.frameH = 0;

        // automatic pip-centering offsets
        this.autoOffsetX = [];

        // scale factor
        this.baseScale = 0.55;

        this.sheet.onload = () => {
            this.loaded = true;
            this.frameW = Math.floor(this.sheet.width / this.tilesX);
            this.frameH = Math.floor(this.sheet.height / this.tilesY);
            this.computeAutoOffsets();
        };

        // frame mapping
        this.map = [0, 1, 2, 3, 4, 5];

        // placement
        this.x = 0;
        this.y = 0;

        // dice state
        this.state = "idle";
        this.currentFrame = null;
        this.targetFace = null;
        this.result = null;

        // stop physics
        this.stopTime   = 0;
        this.frameTimer = 0;

        this.scale    = 1;
        this.scaleVel = 0;

        this.bounceY  = 0;
        this.bounceVel = 0;

        // NEW: event debounce
        this._finishedFired = false;
    }



    // =====================================================
    // AUTO CENTER OFFSETS
    // =====================================================
    computeAutoOffsets() {

        const tmp = document.createElement("canvas");
        const ctx = tmp.getContext("2d");

        tmp.width  = this.frameW;
        tmp.height = this.frameH;

        this.autoOffsetX = [];

        for (let f = 0; f < 6; f++) {

            const col = f % this.tilesX;
            const row = Math.floor(f / this.tilesX);

            ctx.clearRect(0, 0, this.frameW, this.frameH);

            ctx.drawImage(
                this.sheet,
                col * this.frameW, row * this.frameH,
                this.frameW, this.frameH,
                0, 0,
                this.frameW, this.frameH
            );

            const img = ctx.getImageData(0, 0, this.frameW, this.frameH).data;

            let minX = this.frameW;
            let maxX = 0;

            for (let i = 0; i < img.length; i += 4) {
                const alpha = img[i + 3];
                if (alpha <= 35) continue;

                const idx = i / 4;
                const x = idx % this.frameW;

                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
            }

            const visibleW = Math.max(1, maxX - minX);
            const pipCenter = minX + visibleW / 2;

            this.autoOffsetX[f] = (this.frameW / 2) - pipCenter;
        }
    }



    // =====================================================
    // START A NEW ROLL
    // =====================================================
    roll(face) {

        face = Number(face);

        if (face < 1 || face > 6) {
            console.warn("Invalid dice face:", face);
            return;
        }

        this.targetFace = face;
        this.state = "rolling";
        this.result = null;
        this.currentFrame = 0;

        // stop time
        this.stopTime = performance.now() + 900 + Math.random() * 600;

        // reset physics
        this.scale = 1;
        this.scaleVel = 0;

        this.bounceY  = 0;
        this.bounceVel = -6;

        // reset event debounce
        this._finishedFired = false;
    }


    // =====================================================
    // CLEAR DICE (between rounds)
    // =====================================================
    clear() {
        this.state = "idle";
        this.currentFrame = null;
        this.targetFace = null;
        this.result = null;

        this.scale = 1;
        this.scaleVel = 0;

        this.bounceY = 0;
        this.bounceVel = 0;

        // ensure no leftover event
        this._finishedFired = true;
    }



    // =====================================================
    // UPDATE — physics + rolling animation + finish logic
    // =====================================================
    update(delta, now) {

        if (!this.loaded) return;
        if (this.state === "idle") return;
        if (this.state === "result") return;   // << KEY FIX

        if (this.state === "rolling") {

            // --- bounce motion ---
            this.bounceVel += 0.45;
            this.bounceY += this.bounceVel;

            if (this.bounceY > 18) {
                this.bounceY = 18;
                this.bounceVel *= -0.55;
            }

            // --- wobble scale ---
            this.scaleVel += (Math.random() * 0.10 - 0.05);
            this.scaleVel *= 0.85;
            this.scale += this.scaleVel;

            this.scale = Math.min(Math.max(this.scale, 0.85), 1.15);


            // --- STOP CONDITION ---
            if (now >= this.stopTime) {

                this.state = "result";
                this.scale = 1;
                this.bounceY = 18;

                this.result = this.targetFace;
                this.currentFrame = this.map[this.targetFace - 1];

                // FIRE ONCE ONLY
                if (!this._finishedFired) {
                    this._finishedFired = true;
                    window.dispatchEvent(new Event("DICE_FINISHED"));
                }

                return;
            }


            // --- FACE FLICKER ---
            this.frameTimer += delta;
            if (this.frameTimer >= 50) {
                this.frameTimer = 0;
                this.currentFrame = Math.floor(Math.random() * 6);
            }
        }
    }



    // =====================================================
    // DRAW — precise top-center rendering
    // =====================================================
    draw() {

        if (!this.loaded) return;
        if (this.state === "idle") return;
        if (this.currentFrame == null) return;

        const f = this.currentFrame;

        const col = f % this.tilesX;
        const row = Math.floor(f / this.tilesX);

        const sx = col * this.frameW;
        const sy = row * this.frameH;

        const offsetX = this.autoOffsetX[f];

        const s = this.scale * this.baseScale;

        const drawW = this.frameW * s;
        const drawH = this.frameH * s;

        const px = this.x - drawW / 2 + offsetX * s;
        const py = this.y - drawH / 2 + this.bounceY;

        this.ctx.save();
        this.ctx.drawImage(
            this.sheet,
            sx, sy,
            this.frameW, this.frameH,
            px, py,
            drawW, drawH
        );
        this.ctx.restore();
    }
}

window.DiceSystem = DiceSystem;
