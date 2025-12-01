// =======================================================
// charactersystem.js — Core Character Controller
// =======================================================

console.log("charactersystem.js loaded");

// Sleep helper for async animation sequencing
window.sleep = (ms) => new Promise(res => setTimeout(res, ms));


// =======================================================
// CLASS: Character
// Handles animation state, movement, alpha fade, flip, draw.
// =======================================================
class Character {

    constructor(x, y, scale = 2.5) {

        // Feet anchor position
        this.x = x;
        this.y = y;

        this.scale = scale;
        this.flip = false;
        this.headOffset = 130;  // head offset for overhead effects

        // Animation state
        this.state = "idle";
        this.anim = null;
        this.animations = {};

        // Effects
        this.alpha = 1;
        this.isMoving = false;
        this.locked = false;
    }


    // ---------------------------------------------------
    // Register animation
    // ---------------------------------------------------
    addAnimation(name, animator) {
        this.animations[name] = animator;
    }


    // ---------------------------------------------------
    // Switch state safely — falls back to idle if missing
    // ---------------------------------------------------
    setState(name) {

        if (this.locked && name === "idle") return; // keep forced states

        let anim = this.animations[name];

        if (!anim) {
            console.warn(`Character missing "${name}" → using idle`);
            anim = this.animations["idle"];
        }

        if (!anim) {
            console.error("Character has no idle animation.");
            return;
        }

        this.state = name;
        this.anim = anim;

        // Reset frame pointer
        anim.currentFrame = 0;
        anim.timer = 0;
    }

    lockState() { this.locked = true; }
    unlockState() { this.locked = false; }


    // ---------------------------------------------------
    // Update —
    // non-looping animations automatically revert to idle
    // ---------------------------------------------------
    update(delta) {

        if (!this.anim) return;

        this.anim.update(delta);

        if (
            this.anim.nonLooping &&
            this.anim.currentFrame >= this.anim.frameCount - 1
        ) {
            this.setState("idle");
        }
    }


// ---------------------------------------------------
// Tween movement (lerp) — X only, Y locked to ground
// Existing calls use moveTo(tx, speedUnits)
// ---------------------------------------------------
async moveTo(tx, speedUnits = 16) {

    // Prevent overlapping moves
    if (this.isMoving) return;
    this.isMoving = true;

    return new Promise(resolve => {

        const sx = this.x;
        const sy = this.y;

        // Turn "speedUnits" into milliseconds.
        // Values like 15 / 18 become ~240–300 ms, nice SNES-ish pacing.
        const duration = (speedUnits < 64 ? speedUnits * 16 : speedUnits);

        const start = performance.now();

        const step = (t) => {
            const p = Math.min((t - start) / duration, 1);

            // Horizontal lerp only
            this.x = sx + (tx - sx) * p;
            this.y = sy; // lock to original Y (no vertical drift)

            if (p < 1) {
                requestAnimationFrame(step);
            } else {
                this.isMoving = false;
                resolve();
            }
        };

        requestAnimationFrame(step);
    });
}


    // ---------------------------------------------------
    // Draw — feet-anchored draw with scale + flip + alpha
    // ---------------------------------------------------
    draw(ctx) {

        if (!this.anim || !this.anim.frameWidth) return;

        const w = this.anim.frameWidth * this.scale;
        const h = this.anim.frameHeight * this.scale;

        // Convert feet anchor → top-left anchor
        const px = this.x;
        const py = this.y - h;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        ctx.translate(px, py);

        if (this.flip) ctx.scale(-1, 1);

        this.anim.draw(ctx, -w / 2, 0, this.scale);

        ctx.restore();
    }
}

window.Character = Character;
