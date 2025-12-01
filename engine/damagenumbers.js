// damage_numbers.js
console.log("DamageNumber system loaded");

class DamageNumber {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;

        // Bigger damage = bigger scale (clamped)
        // 50 → ~1.3, 100+ → 1.8
        this.scale = 1 + Math.min(value / 80, 0.8);

        this.alpha = 1;
        this.velY = -1.2;      // float up speed
        this.life = 800;       // total life in ms
        this.startTime = performance.now();

        // small random horizontal drift
        this.driftX = (Math.random() - 0.5) * 0.7;
    }

    update(now) {
        const age = now - this.startTime;
        if (age >= this.life) {
            this.alpha = 0;
            return false;      // dead
        }

        const t = age / this.life;

        this.y += this.velY;
        this.x += this.driftX;

        // fade out
        this.alpha = 1 - t;

        return true;
    }

    draw(ctx) {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        const size = 24 * this.scale;

        ctx.font = `${size}px Impact`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.strokeStyle = "black";
        ctx.lineWidth   = 3;
        ctx.fillStyle   = "rgb(255,80,80)";

        ctx.strokeText(this.value, this.x, this.y);
        ctx.fillText(this.value, this.x, this.y);

        ctx.restore();
    }
}

window.DamageNumber = DamageNumber;
