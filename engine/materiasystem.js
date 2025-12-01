// =======================================================
// materiasystem.js — Full Materia Engine (v1.1)
// Handles: equip flags, stat modifiers, on-hit effects,
// periodic effects, and random enemy materia generation.
// =======================================================

console.log("materiasystem.js loaded");

// -------------------------------------------------------
// Player Materia Slots
// Future-proof: add new keys here and in any UI
// -------------------------------------------------------
window.Materia = {
    counter: false,   // 25% chance to counter enemy hit
    thorns:  false,   // returns 20% of taken damage
    poison:  false,   // applies poison to enemy on hit
    regen:   false,   // regen tick each "turn" / pass / event
    speed:   false,   // +20% AGI for player
    barrier: false,   // +20% DEF for player
    crit:    false    // 15% crit chance
};


// -------------------------------------------------------
// Random Enemy Materia (for spawnEnemy)
// Currently: enemy can roll counter / thorns / poison
// -------------------------------------------------------
window.assignRandomEnemyMateria = function enemyRollMateria(enemy, chance) {

    if (!enemy || !enemy.materia) return enemy;
    if (Math.random() > chance)   return enemy;

    const r = Math.random();

    if (r < 0.33) {
        enemy.materia.counter = true;
    } else if (r < 0.66) {
        enemy.materia.thorns  = true;
    } else {
        enemy.materia.poison  = true;
    }

    return enemy;
};


// Small helper so we don't explode if CurrentEnemy is null
function safeEnemy() {
    return window.CurrentEnemy || {
        STR: 1, AGI: 1, DEF: 1,
        materia: { counter:false, thorns:false, poison:false }
    };
}


// -------------------------------------------------------
// Stat Modifiers (player only for now)
// These wrap PlayerStats / CurrentEnemy so callers don't
// have to know about materia details.
// -------------------------------------------------------
window.getAGI = function(type) {

    if (type === "player") {
        if (!window.PlayerStats) return 1;

        const base = PlayerStats.AGI || 1;
        // Speed materia: flat +20% AGI
        return Materia.speed ? base * 1.20 : base;
    }

    // Enemy AGI (no enemy speed materia yet, but we can add later)
    const enemy = safeEnemy();
    return enemy.AGI || 1;
};


window.getDEF = function(type) {

    if (type === "player") {
        if (!window.PlayerStats) return 1;

        const base = PlayerStats.DEF || 1;
        // Barrier materia: flat +20% DEF
        return Materia.barrier ? base * 1.20 : base;
    }

    // Enemy DEF (no enemy barrier materia yet, but we can add later)
    const enemy = safeEnemy();
    return enemy.DEF || 1;
};


// -------------------------------------------------------
// Combat Procs (random triggers)
// NOTE: keep probabilities small, this is per attack.
// -------------------------------------------------------

// Crit: 15% chance if you have crit materia.
// Without param, defaults to player for backwards compatibility.
window.tryCrit = function(type = "player") {
    if (type === "player") {
        return Materia.crit && Math.random() < 0.15;
    }

    // (Future) enemy crit could live here
    const enemy = safeEnemy();
    return enemy.materia && enemy.materia.crit && Math.random() < 0.10;
};


// Evade: chance based on AGI
window.tryEvade = function(type) {
    const agi = window.getAGI(type);
    // 1 AGI ≈ 1% evade
    return Math.random() < (agi * 0.01);
};


// Multihit: also AGI-based, a bit rarer than evade
window.tryMultihit = function(type) {
    const agi = window.getAGI(type);
    // 1 AGI ≈ 1.5% chance of 1.8x damage
    return Math.random() < (agi * 0.015);
};


// Counter: only player for now (enemy has its own logic)
window.tryCounterAttack = function() {
    return Materia.counter && Math.random() < 0.25;
};


// -------------------------------------------------------
// Damage Modifiers
// -------------------------------------------------------

// Player thorns: given damage taken, returns damage back to enemy
window.applyThorns = function(dmg) {
    if (!Materia.thorns) return 0;
    if (!isFinite(dmg) || dmg <= 0) return 0;
    return Math.floor(dmg * 0.20);
};


// Enemy thorns: symmetric version for enemy.materia.thorns
window.applyEnemyThorns = function(dmg, enemy) {
    enemy = enemy || safeEnemy();
    if (!enemy.materia || !enemy.materia.thorns) return 0;
    if (!isFinite(dmg) || dmg <= 0) return 0;
    return Math.floor(dmg * 0.20);
};


// -------------------------------------------------------
// Poison Application & Tick
// -------------------------------------------------------

// Does the player apply poison on hit?
window.applyPoison = function() {
    return !!Materia.poison;
};


// Player poison tick to enemy
window.processPoison = function() {
    if (!window.PlayerStats) return 5;
    // Poison scales slightly with STR
    return 5 + Math.floor((PlayerStats.STR || 1) * 0.2);
};


// Enemy poison tick to player
window.enemyPoisonTick = function(enemy) {
    enemy = enemy || safeEnemy();
    const baseSTR = enemy.STR || 1;
    return 4 + Math.floor(baseSTR * 0.2);
};


// -------------------------------------------------------
// Regen (player only, from materia.regen)
// -------------------------------------------------------
window.processRegen = function() {
    if (!Materia.regen) return 0;
    if (!window.PlayerLevel) return 5;
    // Regen grows slowly with level
    return 5 + Math.floor((PlayerLevel.level || 1) * 0.2);
};


// -------------------------------------------------------
// Damage Engines (cleaner)
// NOTE: NO crit logic inside these – that is handled
// by tryCrit() in combat.js. This avoids double crit.
// -------------------------------------------------------
window.computePlayerDamage = function(base) {
    if (!window.PlayerStats) return Math.max(1, Math.floor(base));

    const enemy = safeEnemy();

    const atk = PlayerStats.STR || 1;
    const def = enemy.DEF || 1;

    let dmg = base * atk / Math.max(1, def);
    return Math.floor(Math.max(1, dmg));
};


window.computeEnemyDamage = function(base) {
    const enemy = safeEnemy();
    if (!window.PlayerStats) return Math.max(1, Math.floor(base));

    const atk = enemy.STR || 1;
    const def = window.getDEF("player"); // includes Barrier materia

    let dmg = base * atk / Math.max(1, def);
    return Math.floor(Math.max(1, dmg));
};
