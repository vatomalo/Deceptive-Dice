// =======================================================
// HealthBar — Modular HP bar widget
// Supports dynamic max HP, text, color, and redraw.
// =======================================================

console.log("healthbar.js loaded");

class HealthBar {

    constructor(ctx, x, y, maxHP, color) {

        // Canvas + position
        this.ctx = ctx;
        this.x = x;
        this.y = y;

        // HP values
        this.maxHP = maxHP;
        this.hp = maxHP;

        // Style settings
        this.width = 260;    // full bar width
        this.height = 22;    // visible thickness
        this.color = color;  // bar fill color
    }

    // ---------------------------------------------------
    // Set HP safely within bounds
    // ---------------------------------------------------
    setHP(newHP) {
        this.hp = Math.max(0, Math.min(newHP, this.maxHP));
    }

    // ---------------------------------------------------
    // Draw HP bar (+ text overlay)
    // ---------------------------------------------------
    draw() {

        const ctx = this.ctx;

        // Hard clamp: avoid NaN / undefined
        if (!Number.isFinite(this.maxHP) || this.maxHP <= 0) {
            this.maxHP = 1;
        }
        if (!Number.isFinite(this.hp)) {
            this.hp = this.maxHP;
        }

        const ratio = Math.max(0, Math.min(this.hp / this.maxHP, 1));
        // background box
        ctx.fillStyle = "black";
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // fill percent
        const pct = this.hp / this.maxHP;
        const fill = this.width * pct;

        // main fill
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, fill, this.height);

        // border
        ctx.strokeStyle = "#FFF";
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // text overlay
        ctx.font = "16px pixel";
        ctx.fillStyle = "#FFF";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(
            `${this.hp} / ${this.maxHP}`,
            this.x + this.width / 2,
            this.y + this.height / 2
        );
    }
}

window.HealthBar = HealthBar;
