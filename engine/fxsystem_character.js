// =======================================================
// fxsystem_character.js — Blink + Shadow Clone FX
// =======================================================

console.log("fxsystem_character.js loaded");


// -------------------------------------------------------
// Blink teleport (fade-out → warp → fade-in)
// -------------------------------------------------------
Character.prototype.blinkTo = function (tx, ty) {
    return new Promise(resolve => {

        let frame = 0;
        const steps = 12;
        const startAlpha = this.alpha;

        const tick = () => {

            // Fade-out frames
            if (frame < 4) {
                this.alpha = Math.max(0, startAlpha - frame * 0.25);
            }

            // Warp frame
            else if (frame === 4) {
                this.x = tx;
                this.y = ty;
                this.alpha = 0;
            }

            // Fade-in frames
            else {
                this.alpha = Math.min(1, (frame - 4) * 0.2);
            }

            frame++;

            if (frame <= steps) {
                requestAnimationFrame(tick);
            } else {
                this.alpha = 1;
                this.setState("idle");
                resolve();
            }
        };

        tick();
    });
};


// -------------------------------------------------------
// Shadow clones — used for PASS movement
// -------------------------------------------------------
window.shadowClones = [];

// Create a clone snapshot
window.spawnShadowClone = function (character) {
    return {
        x: character.x,
        y: character.y,
        flip: character.flip,
        anim: character.anim,
        scale: character.scale,
        alpha: 0.7,
        life: 160
    };
};


// Update fade + lifetime
window.updateShadowClones = function (delta) {
    for (let i = shadowClones.length - 1; i >= 0; i--) {
        const c = shadowClones[i];
        c.life -= delta;
        c.alpha -= 0.08;

        if (c.life <= 0 || c.alpha <= 0)
            shadowClones.splice(i, 1);
    }
};


// Draw clones behind the character
window.drawShadowClones = function (ctx) {

    for (const c of shadowClones) {

        ctx.save();
        ctx.globalAlpha = c.alpha;

        const w = c.anim.frameWidth * c.scale;
        const h = c.anim.frameHeight * c.scale;

        const px = c.x;
        const py = c.y - h;

        ctx.translate(px, py);

        if (c.flip) ctx.scale(-1, 1);

        c.anim.draw(ctx, -w / 2, 0, c.scale);

        ctx.restore();
    }
};
