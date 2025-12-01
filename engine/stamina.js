// =======================================================
// STAMINA SYSTEM MODULE
// =======================================================
console.log("stamina.js loaded");

// -------------------------------------------------------
// BASE CLASS: Generic Stamina Pool
// -------------------------------------------------------
class StaminaPool {
    constructor(max = 100, regenPerTick = 0.25, attackCost = 35, onHitGain = 30) {
        this.max          = max;
        this.current      = max;
        this.regenRate    = regenPerTick;  // per 16 ms tick
        this.lowThreshold = 20;            // UI flicker zone

        this.attackCost = attackCost;      // cost of ATTACK
        this.passCost   = Math.floor(attackCost * 0.4); // if you ever want pass to cost
        this.onHitGain  = onHitGain;       // stamina gained when this side is HIT
    }

    // Can this pool afford an attack?
    canAttack() {
        return this.current >= this.attackCost;
    }

    // Generic spend
    spend(cost) {
        if (this.current < cost) return false;
        this.current -= cost;
        if (this.current < 0) this.current = 0;
        return true;
    }

    // Spend for ATTACK specifically
    spendForAttack() {
        return this.spend(this.attackCost);
    }

    // Gain stamina (hit / pass / special effects)
    gain(amount) {
        this.current += amount;
        if (this.current > this.max) this.current = this.max;
    }

    // Called when this side gets hit
    onHit() {
        this.gain(this.onHitGain);
    }

    // Passive regen each frame
    regen(dt = 16) {
        const ticks = dt / 16;
        this.gain(this.regenRate * ticks);
    }

    reset() {
        this.current = this.max;
    }
}

// -------------------------------------------------------
// PLAYER + ENEMY STAMINA INSTANCES
// -------------------------------------------------------
window.PlayerStamina = new StaminaPool(
    100,   // max
    0.01500,  // regen per 16ms tick (≈ 6.2 stamina / second)
    15,    // attack cost
    28     // gain when HIT
);

window.EnemyStamina  = new StaminaPool(
    100,
    0.01200,  // slower enemy regen
    15,
    0
);

// Temporary backwards compatibility for UI code
PlayerStamina.use = function () {
    return PlayerStamina.spendForAttack();
};

// -------------------------------------------------------
// UPDATE each frame (called from renderloop)
// -------------------------------------------------------
window.updateStamina = function(dt) {
    PlayerStamina.regen(dt);
    EnemyStamina.regen(dt);
};
