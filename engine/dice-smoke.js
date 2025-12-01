// =======================================================
// Dice Smoke FX System
// =======================================================
console.log("DiceSmoke system loaded");

// =======================================================
// a SMOKE PARTICLE that hides dice details
// =======================================================
class SmokeParticle {
    constructor(x, y) {
        if (!isFinite(x)) x = 0;
        if (!isFinite(y)) y = 0;

        this.x = x + (Math.random() * 14 - 7);
        this.y = y + (Math.random() * 8 - 4);

        // gentle swirl upward
        this.vx = (Math.random() * 0.3 - 0.15);
        this.vy = (Math.random() * -0.35 - 0.1);

        // mid life, not too long
        this.life = 260 + Math.random() * 160;

        // a bit smaller so it layers nicely
        this.size = 16 + Math.random() * 10;

        // softer opacity (layering will do the work)
        this.alpha = 0.32 + Math.random() * 0.22;
    }

    update(dt) {
        this.life -= dt;
        if (this.life <= 0) return false;

        this.x += this.vx;
        this.y += this.vy;

        // fade out at a reasonable speed
        this.alpha -= 0.0010 * dt;
        if (this.alpha < 0) this.alpha = 0;

        return this.alpha > 0;
    }

    draw(ctx) {
        if (!isFinite(this.x) || !isFinite(this.y) || !isFinite(this.size)) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        const r = Math.max(1, this.size);

        const g = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, r
        );

        // darker, smokier grey — less “cheap white glow”
        g.addColorStop(0, "rgba(120,120,130,0.8)");
        g.addColorStop(0.6, "rgba(120,120,130,0.35)");
        g.addColorStop(1, "rgba(120,120,130,0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}


// =======================================================
// MAIN CONTROLLER
// =======================================================

window.DiceSmoke = {

    particles: [],
    emitting: false,

    start() {
        this.emitting = true;
    },

    stop() {
        this.emitting = false;
    },

    // enemy dice explosion when dice stops rolling / reveal
    burst(dice) {
        if (!dice || !dice.loaded) return;

        const bx = dice.x;
        const by = dice.y + dice.bounceY;

        if (!isFinite(bx) || !isFinite(by)) return;

        for (let i = 0; i < 24; i++) {
            this.particles.push(new SmokeParticle(bx, by));
        }
    },

    // continuous smoke while emitting is true
    drip(dice, dt) {
        if (!this.emitting || !dice || !dice.loaded) return;

        const dx = dice.x;
        const dy = dice.y + dice.bounceY;

        if (!isFinite(dx) || !isFinite(dy)) return;

        // 2–3 small, soft puffs per frame
        const count = 2 + (Math.random() < 0.35 ? 1 : 0);
        for (let i = 0; i < count; i++) {
            this.particles.push(new SmokeParticle(dx, dy));
        }
    },


    update(dt) {
        this.particles = this.particles.filter(p => p.update(dt));
    },

    draw(ctx) {
        for (const p of this.particles) {
            p.draw(ctx);
        }
    }
};
