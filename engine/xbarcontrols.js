// =======================================================
// XBAR CONTROL SYSTEM — FINAL COMBAT-SAFE VERSION
// =======================================================
console.log("xbarcontrols.js loaded");

// Dimensions
const BTN_W = 120;
const BTN_H = 32;

// Y position
const XBAR_Y = 320;

// Layout
const BTN_ROLL_X   = 40;
const BTN_ATTACK_X = 40;
const BTN_PASS_X   = 180;


// ----------------------------------------------------
// BUTTON CLASS
// ----------------------------------------------------
class XBarButton {
    constructor(x, y, label, callback) {
        this.x = x;
        this.y = y;
        this.label = label;
        this.cb = callback;

        this.enabled = true;
        this.visible = true;
    }

    hit(mx, my) {
        if (!this.visible || !this.enabled) return false;

        return (
            mx >= this.x &&
            mx <= this.x + BTN_W &&
            my >= this.y &&
            my <= this.y + BTN_H
        );
    }

    draw(ctx) {
        if (!this.visible) return;

        ctx.save();
        ctx.globalAlpha = this.enabled ? 1 : 0.45;

        // Background
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(this.x, this.y, BTN_W, BTN_H);

        // Border
        ctx.lineWidth = 3;
        ctx.strokeStyle = "white";
        ctx.strokeRect(this.x, this.y, BTN_W, BTN_H);

        // Label
        ctx.font = "22px pixel";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
            this.label,
            this.x + BTN_W / 2,
            this.y + BTN_H / 2 + 1
        );

        ctx.restore();
    }
}


// ----------------------------------------------------
// XBAR MANAGER
// ----------------------------------------------------
class XBarControls {
    constructor(ctx, game, samurai) {
        this.ctx = ctx;
        this.game = game;

        // Buttons
        this.rollBtn   = new XBarButton(BTN_ROLL_X,   XBAR_Y, "ROLL",   () => this.tryPress("roll"));
        this.attackBtn = new XBarButton(BTN_ATTACK_X, XBAR_Y, "ATTACK", () => this.tryPress("attack"));
        this.passBtn   = new XBarButton(BTN_PASS_X,   XBAR_Y, "PASS",   () => this.tryPress("pass"));

        // UI modes
        this.mode = "roll";     // "roll" or "combat"
        this.lock = false;      // prevents double tapping
    }

    // ------------------------------------------------
    // PROTECT AGAINST DOUBLE INPUT
    // ------------------------------------------------
    tryPress(type) {
        if (this.lock) return;

        this.lock = true;
        setTimeout(() => (this.lock = false), 160); // small human debounce

        if (type === "roll"   && this.rollBtn.enabled)   this.game.doRoll();
        if (type === "attack" && this.attackBtn.enabled) this.game.doAttack();
        if (type === "pass"   && this.passBtn.enabled)   this.game.doPass();
    }


    // ------------------------------------------------
    // SHOW ROLL BUTTON, HIDE COMBAT BUTTONS
    // ------------------------------------------------
    showRoll() {
        this.mode = "roll";

        this.rollBtn.visible   = true;
        this.rollBtn.enabled   = true;

        this.attackBtn.visible = false;
        this.attackBtn.enabled = false;

        this.passBtn.visible   = false;
        this.passBtn.enabled   = false;
    }


    // ------------------------------------------------
    // SHOW ATTACK + PASS BUTTONS
    // ------------------------------------------------
    showCombat() {
        this.mode = "combat";

        this.rollBtn.visible   = false;
        this.rollBtn.enabled   = false;

        this.attackBtn.visible = true;
        this.attackBtn.enabled = true;

        this.passBtn.visible   = true;
        this.passBtn.enabled   = true;
    }


    // ------------------------------------------------
    // DISABLE ALL BUTTONS DURING ANIMATION/COMBAT
    // ------------------------------------------------
    disable() {
        this.rollBtn.enabled   = false;
        this.attackBtn.enabled = false;
        this.passBtn.enabled   = false;
    }


    // ------------------------------------------------
    // CLICK HANDLER
    // ------------------------------------------------
    handleClick(mx, my) {

        if (this.mode === "roll") {
            if (this.rollBtn.hit(mx, my)) this.rollBtn.cb();
            return;
        }

        if (this.mode === "combat") {
            if (this.attackBtn.hit(mx, my)) this.attackBtn.cb();
            else if (this.passBtn.hit(mx, my)) this.passBtn.cb();
        }
    }


    // ------------------------------------------------
    // DRAW UI
    // ------------------------------------------------
    draw() {
        if (this.mode === "roll") {
            this.rollBtn.draw(this.ctx);
        } else {
            this.attackBtn.draw(this.ctx);
            this.passBtn.draw(this.ctx);
        }
    }
}


// global
window.XBarControls = XBarControls;
// =======================================================