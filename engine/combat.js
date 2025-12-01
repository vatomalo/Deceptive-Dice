// =======================================================
// combat.js — Dice revealed ONLY on ATTACK + Stamina
// + Banter hooks + Katana & Blood FX for deaths
// =======================================================

console.log("combat.js loaded");

// Small impact freeze
const hitStop = (ms) => new Promise(res => setTimeout(res, ms));
const wait = (ms) => new Promise(res => setTimeout(res, ms));

// Outcome of last roll: "player", "enemy", "draw" or null
window.lastDiceOutcome = null;

// Prevent overlapping combat sequences
window._combatBusy = false;

// Global dice visibility gate (used in renderloop.js)
if (typeof window.hideDice === "undefined") {
    window.hideDice = false;
}

// Ensure materia inventory exists
if (!window.MateriaInventory) {
    window.MateriaInventory = [];
}

// =======================================================
// KNIGHT RESPAWN SEQUENCE
// =======================================================
async function knightRespawnSequence() {

    DiceSmoke.stop();
    xbar.disable();

    knight.alpha = 1;
    knight.setState("run");
    knight.flip = true;

    // Start off-screen on the right
    knight.x = canvas.width + 80;

    for (let i = 0; i < 8; i++) {
        if (fxManager && fxManager.spawnDust) fxManager.spawnDust(knight);
    }

    // Run back to home position
    await knight.moveTo(420, 15);

    knight.setState("idle");

    if (window.EnemyStamina && EnemyStamina.reset) {
        EnemyStamina.reset();
    } else if (window.EnemyStamina) {
        EnemyStamina.current = EnemyStamina.max;
    }

    DiceSmoke.start();

    // Optional banter on new knight entry
    if (window.Banter && Banter.say && window.CurrentEnemy) {
        Banter.say("knight", "intro", CurrentEnemy.name);
    }
}


// =======================================================
// SAMURAI RESPAWN SEQUENCE
// =======================================================
async function samuraiRespawnSequence() {

    const originalFlip = samurai.flip;

    DiceSmoke.stop();
    xbar.disable();

    // Small flash
    flashScreen = 1;
    await wait(120);
    flashScreen = 0;

    // Angel spark on death position (guarded)
    if (fxManager && fxManager.spawnAngelSpark) {
        fxManager.spawnAngelSpark(samurai.x, samurai.y - 60);
    }

    // Blink back home
    await samurai.blinkTo(SAMURAI_HOME_X, SAMURAI_HOME_Y);

    samurai.flip = originalFlip;
    samurai.setState("idle");

    if (window.PlayerStamina && PlayerStamina.reset) {
        PlayerStamina.reset();
    } else if (window.PlayerStamina) {
        PlayerStamina.current = PlayerStamina.max;
    }

    DiceSmoke.start();
}

window.addEventListener("KNIGHT_RESPAWN_EVENT", async () => {
    await knightRespawnSequence();
});

window.addEventListener("SAMURAI_RESPAWN_EVENT", async () => {
    await samuraiRespawnSequence();
});


// =======================================================
// SAMURAI DEATH
// =======================================================
window.samuraiDeath = async function () {

    console.log("Player death triggered");

    xbar.disable();
    DiceSmoke.stop();
    knight.setState("idle");

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "death");
    }

    // Katana spin upwards from body
    spawnKatanaFX(samurai.x + 6, samurai.y - 90);

    // Small brace pose
    samurai.setState("block");
    await wait(260);

    // Blood burst
    spawnBloodFX(samurai.x, samurai.y - 50, 20);

    // Fade out samurai
    let fade = 1;
    await new Promise(resolve => {
        const loop = () => {
            fade -= 0.05;
            samurai.alpha = Math.max(0, fade);
            if (fade > 0) {
                requestAnimationFrame(loop);
            } else {
                resolve();
            }
        };
        loop();
    });

    await knight.moveTo(420, 18);

    // Trigger respawn sequence
    dispatchEvent(new Event("SAMURAI_RESPAWN_EVENT"));

    // Full reset
    window.playerResetStats();

    if (window.PlayerStamina && PlayerStamina.reset) {
        PlayerStamina.reset();
    } else if (window.PlayerStamina) {
        PlayerStamina.current = PlayerStamina.max;
    }

    // Restore samurai visuals + HP
    samurai.alpha = 1;
    samurai.setState("idle");

    if (window.hpSamurai) {
        hpSamurai.setHP(hpSamurai.maxHP);
    }

    await samurai.blinkTo(SAMURAI_HOME_X, SAMURAI_HOME_Y);

    console.log("Player respawned");
};


// =======================================================
// KNIGHT DEATH
// =======================================================
window.knightDeath = async function () {

    console.log("Knight death triggered");

    xbar.disable();
    DiceSmoke.stop();
    samurai.setState("idle");

    if (window.Banter && Banter.say && window.CurrentEnemy) {
        Banter.say("knight", "death", CurrentEnemy.name);
    }

    // Blood on knight
    spawnBloodFX(knight.x, knight.y - 60, 24);

    knight.setState("death");
    await wait(300);

    // Fade out knight
    let fade = 1;
    await new Promise(resolve => {
        const loop = () => {
            fade -= 0.05;
            knight.alpha = Math.max(0, fade);
            if (fade > 0) {
                requestAnimationFrame(loop);
            } else {
                resolve();
            }
        };
        loop();
    });

    // Respawn event (run-in sequence)
    dispatchEvent(new Event("KNIGHT_RESPAWN_EVENT"));

    // Enemy progression
    TotalKills++;
    enemyGainXP(6);

    // Simple materia drop system
    try {
        if (Math.random() < 0.25) {  // 25% drop rate
            const pool = ["crit", "regen", "speed", "barrier", "counter", "thorns", "poison"];
            const pick = pool[Math.floor(Math.random() * pool.length)];

            if (!window.MateriaInventory) window.MateriaInventory = [];
            window.MateriaInventory.push(pick);

            console.log("Materia obtained:", pick);

            if (window.Banter && Banter.say) {
                Banter.say("samurai", "found");
            }
        }
    } catch (e) {
        console.warn("Materia drop failed:", e);
    }

    // Spawn new enemy and reset stamina
    spawnEnemy(TotalKills);

    if (window.EnemyStamina && EnemyStamina.reset) {
        EnemyStamina.reset();
    } else if (window.EnemyStamina) {
        EnemyStamina.current = EnemyStamina.max;
    }

    // Restore knight visuals + HP
    knight.alpha = 1;
    knight.setState("idle");

    CurrentEnemy.hp = CurrentEnemy.maxHP;
    hpKnight.maxHP = CurrentEnemy.maxHP;
    hpKnight.setHP(CurrentEnemy.hp);

    console.log("Respawned:", CurrentEnemy);
};


// =======================================================
// CORE ROUND SEQUENCES (no dice reveal here)
// =======================================================
async function handlePlayerWinRound() {

    DiceSmoke.stop();
    xbar.disable();
    if (dice && dice.player) dice.player.clear();
    if (dice && dice.enemy) dice.enemy.clear();

    if (window.PlayerStamina && PlayerStamina.regen) {
        PlayerStamina.regen();
    }

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "hit");
        Banter.say("knight", "hurt", CurrentEnemy?.name);
    }

    let base = Math.max(1, playerFace - enemyFace) * 10;
    let dmg = computePlayerDamage(base);

    if (tryCrit()) {
        dmg *= 2;
        damageFX.push(new DamageNumber(knight.x, knight.y - 140, "CRIT!", true));
    }

    if (tryMultihit("player")) {
        dmg = Math.floor(dmg * 1.8);
        damageFX.push(new DamageNumber(knight.x, knight.y - 150, "x2!", true));
    }

    if (applyPoison()) CurrentEnemy.isPoisoned = true;

    // APPROACH
    samurai.setState("run");
    await samurai.moveTo(knight.x - 70, 18);

    await wait(60);

    // ATTACK
    samurai.setState("attack");

    if (fxManager && fxManager.spawn) {
        fxManager.spawn(
            FX_SLASH,
            knight.x - 40,
            knight.y - 100,
            1.25,
            false,
            65
        );
    }

    flashScreen = 1;
    await hitStop(140);
    flashScreen = 0;

    CurrentEnemy.hp -= dmg;
    hpKnight.setHP(CurrentEnemy.hp);

    damageFX.push(new DamageNumber(knight.x, knight.y - 110, dmg));

    knight.setState("hurt");
    await wait(150);
    knight.setState("idle");

    if (CurrentEnemy.hp <= 0) {
        giveXP(12 + enemyFace * 2);
        enemyGainXP(6);
        await knightDeath();
    }

    samurai.setState("run");
    await samurai.moveTo(120, 18);
    samurai.setState("idle");

    xbar.showRoll();
}

async function handleEnemyWinRound() {

    DiceSmoke.stop();
    xbar.disable();
    if (dice && dice.player) dice.player.clear();
    if (dice && dice.enemy) dice.enemy.clear();

    if (window.EnemyStamina && EnemyStamina.regen) {
        EnemyStamina.regen();
    }

    if (window.Banter && Banter.say) {
        Banter.say("knight", "hit", CurrentEnemy?.name);
        Banter.say("samurai", "hurt");
    }

    let base = Math.max(1, enemyFace - playerFace) * 10;

    // EVADE
    if (tryEvade("player")) {
        damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, "EVADE!", true));
        await samurai.blinkTo(samurai.x - 40, samurai.y);
        samurai.setState("idle");

        xbar.showRoll();
        return;
    }

    let dmg = computeEnemyDamage(base);

    if (CurrentEnemy.materia.thorns) {
        let t = Math.floor(dmg * 0.2);
        hpSamurai.setHP(hpSamurai.hp - t);
        damageFX.push(new DamageNumber(samurai.x, samurai.y - 130, `${t} THORNS`, true));
    }

    if (CurrentEnemy.materia.counter) {
        let c = Math.floor(CurrentEnemy.STR * 1.6);
        CurrentEnemy.hp -= c;
        hpKnight.setHP(CurrentEnemy.hp);
        damageFX.push(new DamageNumber(knight.x, knight.y - 160, "COUNTER!", true));
    }

    knight.setState("run");
    await knight.moveTo(samurai.x + 70, 18);

    await wait(60);

    knight.setState("attack");

    if (fxManager && fxManager.spawn) {
        fxManager.spawn(
            FX_SLASH,
            samurai.x - 40,
            samurai.y - 100,
            1.25,
            true,
            65
        );
    }

    flashScreen = 1;
    await hitStop(140);
    flashScreen = 0;

    hpSamurai.setHP(hpSamurai.hp - dmg);
    damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, dmg));

    // getting hit gives stamina back
    if (window.PlayerStamina && PlayerStamina.onHit) {
        PlayerStamina.onHit();
    }

    samurai.setState("block");
    await wait(140);
    samurai.setState("idle");

    if (hpSamurai.hp <= 0) {
        await samuraiDeath();
        xbar.showRoll();
        return;
    }

    knight.setState("run");
    await knight.moveTo(420, 18);
    knight.setState("idle");

    xbar.showRoll();
}

async function handleDrawRound() {

    DiceSmoke.stop();
    xbar.disable();
    if (dice && dice.player) dice.player.clear();
    if (dice && dice.enemy) dice.enemy.clear();

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "roll");
        Banter.say("knight", "roll", CurrentEnemy?.name);
    }

    samurai.setState("run");
    knight.setState("run");

    samurai.flip = true;
    knight.flip = false;

    const samuraiBack = samurai.x - 120;
    const knightBack = knight.x + 120;

    for (let i = 0; i < 6; i++) {
        if (fxManager && fxManager.spawnDust) {
            fxManager.spawnDust(samurai);
            fxManager.spawnDust(knight);
        }
    }

    await Promise.all([
        samurai.moveTo(samuraiBack, 15),
        knight.moveTo(knightBack, 15)
    ]);

    samurai.flip = false;
    knight.flip = true;

    await Promise.all([
        samurai.moveTo(120, 15),
        knight.moveTo(420, 15)
    ]);

    samurai.setState("idle");
    knight.setState("idle");

    xbar.showRoll();
}

async function handlePassRound() {

    DiceSmoke.stop();
    xbar.disable();
    if (dice && dice.player) dice.player.clear();
    if (dice && dice.enemy) dice.enemy.clear();

    if (window.PlayerStamina && PlayerStamina.regen) {
        PlayerStamina.regen();
    }

    if (window.Banter && Banter.say) {
        if (Math.random() < 0.02) {
            Banter.say("samurai", "tina_rare");
        } else {
            Banter.say("samurai", "pass");
        }
        Banter.say("knight", "pass", CurrentEnemy?.name);
    }

    const originalFlip = samurai.flip;

    flashScreen = 1;
    await wait(80);
    flashScreen = 0;

    shadowClones.push(spawnShadowClone(samurai));
    await wait(120);

    const r = Math.floor(Math.random() * 4);

    if (r === 0) {
        samurai.flip = true;
        await samurai.blinkTo(knight.x + 90, 375);
        await wait(180);
    }
    else if (r === 1) {
        samurai.flip = false;
        await samurai.blinkTo(260, 375);
        await wait(200);
    }
    else if (r === 2) {
        samurai.flip = false;
        await samurai.blinkTo(20, 375);
        await wait(160);
    }
    else {
        samurai.flip = true;
        await samurai.blinkTo(knight.x + 60, 375);
        shadowClones.push(spawnShadowClone(samurai));
        await wait(140);
        samurai.flip = false;
        await samurai.blinkTo(240, 375);
        await wait(160);
    }

    shadowClones.push(spawnShadowClone(samurai));

    await wait(100);
    await samurai.blinkTo(SAMURAI_HOME_X, 375);
    await wait(120);

    samurai.flip = originalFlip;
    samurai.setState("idle");
    shadowClones.length = 0;

    if (window.PlayerStamina && PlayerStamina.regen) {
        PlayerStamina.regen();
    }

    window.lastDiceOutcome = null;

    xbar.showRoll();
}


// =======================================================
// DICE REVEAL — ONLY CALLED WHEN ATTACK IS PRESSED
// =======================================================
async function revealDice(outcome) {

    // Dice visible during reveal
    window.hideDice = false;

    if (!window.dice || !dice.player || !dice.enemy) {
        return;
    }

    // Let smoke sit a bit
    await wait(220);

    if (DiceSmoke && DiceSmoke.burst) {
        DiceSmoke.burst(dice.enemy);
    }

    if (dice.player) dice.player.bounceVel = -8;
    if (dice.enemy) dice.enemy.bounceVel = -8;

    await wait(180);

    if (outcome === "player") {
        if (dice.enemy) {
            dice.enemy.currentFrame = null;
        }
    } else if (outcome === "enemy") {
        if (dice.player) {
            dice.player.currentFrame = null;
        }
    }

    await wait(140);
}


// =======================================================
// PLAYER ATTACK — uses lastDiceOutcome + revealDice
// =======================================================
window.addEventListener("PLAYER_ATTACK", async () => {

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "attack");
    }

    // === spend stamina for attack ===
    if (window.PlayerStamina && PlayerStamina.spendForAttack) {
        if (!PlayerStamina.spendForAttack()) {
            // Not enough stamina → enemy gets the turn instead
            window.dispatchEvent(new Event("ENEMY_ATTACK"));
            return;
        }
    }

    if (!window.lastDiceOutcome || window._combatBusy) {
        return;
    }

    window._combatBusy = true;
    const outcome = window.lastDiceOutcome;

    try {
        await revealDice(outcome);
        window.lastDiceOutcome = null;

        if (outcome === "player") {
            await handlePlayerWinRound();
        } else if (outcome === "enemy") {
            await handleEnemyWinRound();
        } else {
            await handleDrawRound();
        }
    } finally {
        window._combatBusy = false;
    }
});


// =======================================================
// FALLBACK ROUTES
// =======================================================
window.addEventListener("ENEMY_ATTACK", async () => {
    if (window.Banter && Banter.say) {
        Banter.say("knight", "attack", CurrentEnemy?.name);
    }

    if (window._combatBusy) return;
    window._combatBusy = true;
    try {
        await handleEnemyWinRound();
    } finally {
        window._combatBusy = false;
    }
});

window.addEventListener("DRAW_EVENT", async () => {
    if (window.Banter && Banter.say) {
        Banter.say("samurai", "roll");
        Banter.say("knight", "roll", CurrentEnemy?.name);
    }
    if (window._combatBusy) return;
    window._combatBusy = true;
    try {
        await handleDrawRound();
    } finally {
        window._combatBusy = false;
    }
});


// =======================================================
// PASS EVENT — Player chooses to skip the round
// =======================================================
window.addEventListener("PASS_EVENT", async () => {
    if (window._combatBusy) return;
    window._combatBusy = true;
    try {
        await handlePassRound();
    } finally {
        window._combatBusy = false;
    }
});


// =======================================================
// DICE RESOLUTION → STORE OUTCOME + STAMINA EXHAUSTION
// =======================================================
window._diceResolving = false;

window.addEventListener("DICE_FINISHED", async () => {
    if (window._diceResolving) return;
    window._diceResolving = true;

    try {
        if (typeof playerFace === "undefined" || typeof enemyFace === "undefined") {
            window._diceResolving = false;
            return;
        }

        // Exhaustion: if player has 0 stamina, skip menu and let enemy attack
        if (window.PlayerStamina && PlayerStamina.current <= 0) {
            window.lastDiceOutcome = null;
            window.hideDice = false;  // enemy can still use dice state if needed
            window.dispatchEvent(new Event("ENEMY_ATTACK"));
            return;
        }

        if (playerFace > enemyFace) {
            window.lastDiceOutcome = "player";
        } else if (enemyFace > playerFace) {
            window.lastDiceOutcome = "enemy";
        } else {
            window.lastDiceOutcome = "draw";
        }

        // ⬇️ KEY CHANGE:
        // Do NOT hide dice here anymore.
        // We keep them visible under smoke until ATTACK/PASS.
        // window.hideDice = true;

        if (typeof xbar !== "undefined" && xbar.showCombat) {
            xbar.showCombat();
        }

    } finally {
        window._diceResolving = false;
    }
});
