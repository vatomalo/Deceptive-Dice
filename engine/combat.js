// =======================================================
// combat.js — Dice revealed ONLY on ATTACK + Stamina
// + Banter hooks + Katana & Blood FX for deaths
// + Spirit Hearts (continues) + Entity-channel SFX
// + Global Audio Profiles for voices & swing/dodge
// =======================================================

console.log("combat.js loaded");

// Small impact freeze
const hitStop = (ms) => new Promise(res => setTimeout(res, ms));
const wait = (ms) => new Promise(res => setTimeout(res, ms));

// -------------------------------------------------------
// GLOBAL AUDIO PROFILES (override these anywhere)
// Later you can load them from JSON per character.
// -------------------------------------------------------
window.AudioProfiles = window.AudioProfiles || {};

if (!AudioProfiles.samuraiVoice) {
    AudioProfiles.samuraiVoice = {
        pitch: 1.05,     // base pitch for samurai voice (ha! tsu! etc)
        reverb: true,
        distortion: 0.0
    };
}

if (!AudioProfiles.knightVoice) {
    AudioProfiles.knightVoice = {
        pitch: 0.95,     // knight slightly heavier / lower
        reverb: false,
        distortion: 0.0
    };
}

if (!AudioProfiles.samuraiSFX) {
    AudioProfiles.samuraiSFX = {
        swingPitch: 0.90, // lower = heavier slash
        dodgePitch: 1.05  // slightly sharper ninja vanish
    };
}

if (!AudioProfiles.knightSFX) {
    AudioProfiles.knightSFX = {
        swingPitch: 0.95  // a bit lower than default
    };
}

// -------------------------------------------------------
// SFX helpers (route to entity channels + apply profiles)
// NOTE: We pass an extra "options" argument. If your
// SFX.playSamurai/playKnight/playUI ignore it, no problem.
// Later, when you implement pitch/reverb there, it "just works".
// -------------------------------------------------------
function sfxSamurai(category, volume = 1.0, kind = "sfx") {
    if (!window.SFX || typeof SFX.playSamurai !== "function") return;

    let options = null;

    if (kind === "voice") {
        const v = AudioProfiles.samuraiVoice || {};
        options = {
            pitch: v.pitch,
            reverb: v.reverb,
            distortion: v.distortion
        };
    } else {
        const s = AudioProfiles.samuraiSFX || {};
        if (category === "swing" && typeof s.swingPitch === "number") {
            options = { pitch: s.swingPitch };
        } else if (category === "dodge" && typeof s.dodgePitch === "number") {
            options = { pitch: s.dodgePitch };
        }
    }

    console.log("[SFX SAMURAI]", category, "vol", volume, "opts", options);

    if (options) {
        SFX.playSamurai(category, volume, options);
    } else {
        SFX.playSamurai(category, volume);
    }
}

function sfxKnight(category, volume = 1.0, kind = "sfx") {
    if (!window.SFX || typeof SFX.playKnight !== "function") return;

    let options = null;

    if (kind === "voice") {
        const v = AudioProfiles.knightVoice || {};
        options = {
            pitch: v.pitch,
            reverb: v.reverb,
            distortion: v.distortion
        };
    } else {
        const s = AudioProfiles.knightSFX || {};
        if (category === "swing" && typeof s.swingPitch === "number") {
            options = { pitch: s.swingPitch };
        }
    }

    console.log("[SFX KNIGHT]", category, "vol", volume, "opts", options);

    if (options) {
        SFX.playKnight(category, volume, options);
    } else {
        SFX.playKnight(category, volume);
    }
}

function sfxUI(category, volume = 1.0) {
    if (!window.SFX || typeof SFX.playUI !== "function") return;
    console.log("[SFX UI]", category, "vol", volume);
    SFX.playUI(category, volume);  // UI is usually neutral pitch
}

// Convenience: voice helpers (anime JRPG shouts)
// They call categories like "voice_attack", "voice_hurt", etc.
function samuraiVoice(id = "attack", volume = 1.0) {
    sfxSamurai(`voice_${id}`, volume, "voice");
}

function knightVoice(id = "attack", volume = 1.0) {
    sfxKnight(`voice_${id}`, volume, "voice");
}

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

// Spirit Hearts (continues)
if (typeof window.PlayerHearts === "undefined") {
    window.PlayerHearts = 1;   // starting continues
}
if (typeof window.MaxHearts === "undefined") {
    window.MaxHearts = 3;
}

// Convenience: safe access to materia UI helper
function hasMateriaNote() {
    return !!(window.Banter && typeof Banter.materiaNote === "function");
}


// =======================================================
// KNIGHT RESPAWN SEQUENCE
// =======================================================
async function knightRespawnSequence() {

    DiceSmoke.stop();
    xbar.disable();

    // Knight entrance: step SFX on knight channel
    sfxKnight("step", 0.8);

    knight.alpha = 1;
    knight.setState("run");
    knight.flip = true;

    // Start off-screen on the right
    knight.x = canvas.width + 80;

    for (let i = 0; i < 8; i++) {
        if (window.fxManager && fxManager.spawnDust) fxManager.spawnDust(knight);
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

    // Ninja return: dodge SFX on samurai channel (with dodgePitch)
    sfxSamurai("dodge", 0.9);

    // Small flash
    flashScreen = 1;
    await wait(120);
    flashScreen = 0;

    // Angel spark on death position (guarded)
    if (window.fxManager && fxManager.spawnAngelSpark) {
        fxManager.spawnAngelSpark(samurai.x, samurai.y - 60);
    }

    // Blink back home (ninja vanish style)
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
// SAMURAI DEATH (with Spirit Hearts)
// =======================================================
window.samuraiDeath = async function () {

    console.log("Player death triggered");

    xbar.disable();
    DiceSmoke.stop();
    knight.setState("idle");

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "death");
    }

    // Optional death voice
    samuraiVoice("death", 0.9);

    // Katana spin upwards from body (visual)
    if (typeof spawnKatanaFX === "function") {
        spawnKatanaFX(samurai.x + 6, samurai.y - 90);
    }

    // Brace
    samurai.setState("block");
    await wait(260);

    // Blood burst (visual)
    if (typeof spawnBloodFX === "function") {
        spawnBloodFX(samurai.x, samurai.y - 50, 20);
    }

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

    // Samurai death SFX (heavier slash / body drop)
    sfxSamurai("death", 0.9);

    await knight.moveTo(420, 18);

    // ---- CONTINUE LOGIC (Spirit Hearts) ----
    const hasExtraLife = (typeof window.PlayerHearts === "number" && PlayerHearts > 0);
    if (hasExtraLife) {
        PlayerHearts = Math.max(0, PlayerHearts - 1);
        console.log("Continue used. Remaining hearts:", PlayerHearts);
    } else {
        console.log("No hearts left: full run reset.");
    }

    // Trigger respawn sequence (position / stamina visuals)
    dispatchEvent(new Event("SAMURAI_RESPAWN_EVENT"));

    // Hard reset only if no hearts left
    if (!hasExtraLife && typeof window.playerResetStats === "function") {
        window.playerResetStats();
    }

    // Restore samurai visuals + HP
    samurai.alpha = 1;
    samurai.setState("idle");

    if (window.hpSamurai) {
        hpSamurai.setHP(hpSamurai.maxHP);
    }

    if (window.PlayerStamina) {
        if (PlayerStamina.reset) {
            PlayerStamina.reset();
        } else {
            PlayerStamina.current = PlayerStamina.max;
        }
    }

    await samurai.blinkTo(SAMURAI_HOME_X, SAMURAI_HOME_Y);

    console.log("Player respawned (hearts:", PlayerHearts, ")");
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

    // Optional death voice
    knightVoice("death", 0.9);

    // Blood on knight
    if (typeof spawnBloodFX === "function") {
        spawnBloodFX(knight.x, knight.y - 60, 24);
    }

    knight.setState("death");

    // Knight death SFX
    sfxKnight("death", 0.9);

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
    if (typeof TotalKills === "number") {
        TotalKills++;
    } else {
        window.TotalKills = 1;
    }

    if (typeof enemyGainXP === "function") {
        enemyGainXP(6);
    }

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
            // could add a UI sound: sfxUI("ui", 0.9);
        }
    } catch (e) {
        console.warn("Materia drop failed:", e);
    }

    // Spawn new enemy and reset stamina
    if (typeof spawnEnemy === "function") {
        spawnEnemy(TotalKills);
    }

    if (window.EnemyStamina && EnemyStamina.reset) {
        EnemyStamina.reset();
    } else if (window.EnemyStamina) {
        EnemyStamina.current = EnemyStamina.max;
    }

    // Restore knight visuals + HP
    knight.alpha = 1;
    knight.setState("idle");

    if (window.CurrentEnemy && window.hpKnight) {
        CurrentEnemy.hp = CurrentEnemy.maxHP;
        hpKnight.maxHP = CurrentEnemy.maxHP;
        hpKnight.setHP(CurrentEnemy.hp);
    }

    console.log("Respawned:", window.CurrentEnemy);
};


// =======================================================
// CORE ROUND SEQUENCES (no dice reveal here)
// =======================================================
async function handlePlayerWinRound() {

    DiceSmoke.stop();
    xbar.disable();
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.PlayerStamina && PlayerStamina.regen) {
        PlayerStamina.regen();
    }

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "swing");
        Banter.say("knight", "hurt", window.CurrentEnemy?.name);
    }

    // Optional attack voice (anime "Ha!")
    samuraiVoice("attack", 0.9);

    let base = Math.max(1, playerFace - enemyFace) * 10;

    let dmg = (window.computePlayerDamage)
        ? window.computePlayerDamage(base)
        : Math.max(1, Math.floor(base));

    // --- CRIT (visual / banter) ---
    const didCrit = typeof tryCrit === "function" ? tryCrit() : false;
    if (didCrit) {
        dmg *= 2;
        if (window.damageFX) {
            damageFX.push(new DamageNumber(knight.x, knight.y - 140, "CRIT!", true));
        }

        if (hasMateriaNote()) {
            Banter.materiaNote("enemy", "crit", 1);
        }
    }

    if (typeof tryMultihit === "function" && tryMultihit("player")) {
        dmg = Math.floor(dmg * 1.8);
        if (window.damageFX) {
            damageFX.push(new DamageNumber(knight.x, knight.y - 150, "x2!", true));
        }
    }

    if (typeof applyPoison === "function" && applyPoison()) {
        if (window.CurrentEnemy) {
            CurrentEnemy.isPoisoned = true;
        }

        if (hasMateriaNote()) {
            Banter.materiaNote("enemy", "poison", 1);
        }
    }

    // APPROACH
    samurai.setState("run");
    await samurai.moveTo(knight.x - 70, 18);

    await wait(60);

    // ATTACK (swing SFX uses samuraiSFX.swingPitch)
    samurai.setState("attack");
    sfxSamurai("swing", 0.9);

    if (window.fxManager && fxManager.spawn) {
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

    if (window.CurrentEnemy && window.hpKnight) {
        CurrentEnemy.hp -= dmg;
        hpKnight.setHP(CurrentEnemy.hp);
    }

    if (window.damageFX) {
        damageFX.push(new DamageNumber(knight.x, knight.y - 110, dmg));
    }

    knight.setState("hurt");
    await wait(150);
    knight.setState("idle");

    if (window.CurrentEnemy && CurrentEnemy.hp <= 0) {
        if (typeof giveXP === "function") {
            giveXP(12 + enemyFace * 2);
        }
        if (typeof enemyGainXP === "function") {
            enemyGainXP(6);
        }
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
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.EnemyStamina && EnemyStamina.regen) {
        EnemyStamina.regen();
    }

    if (window.Banter && Banter.say) {
        Banter.say("knight", "hit", window.CurrentEnemy?.name);
        Banter.say("samurai", "hurt");
    }

    // Enemy attack voice
    knightVoice("attack", 0.9);

    let base = Math.max(1, enemyFace - playerFace) * 10;

    // EVADE
    if (typeof tryEvade === "function" && tryEvade("player")) {
        if (window.damageFX) {
            damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, "EVADE!", true));
        }

        sfxSamurai("dodge", 0.9);

        await samurai.blinkTo(samurai.x - 40, samurai.y);
        samurai.setState("idle");

        xbar.showRoll();
        return;
    }

    let dmg = (window.computeEnemyDamage)
        ? window.computeEnemyDamage(base)
        : Math.max(1, Math.floor(base));

    const enemyMateria = (window.CurrentEnemy && CurrentEnemy.materia) ? CurrentEnemy.materia : {};

    if (enemyMateria.thorns && window.hpSamurai) {
        let t = Math.floor(dmg * 0.2);
        hpSamurai.setHP(hpSamurai.hp - t);
        if (window.damageFX) {
            damageFX.push(new DamageNumber(samurai.x, samurai.y - 130, `${t} THORNS`, true));
        }

        if (hasMateriaNote()) {
            Banter.materiaNote("player", "thorns", 1);
        }
    }

    if (enemyMateria.counter && window.CurrentEnemy && window.hpKnight) {
        let c = Math.floor((CurrentEnemy.STR || 1) * 1.6);
        CurrentEnemy.hp -= c;
        hpKnight.setHP(CurrentEnemy.hp);
        if (window.damageFX) {
            damageFX.push(new DamageNumber(knight.x, knight.y - 160, "COUNTER!", true));
        }

        if (hasMateriaNote()) {
            Banter.materiaNote("enemy", "counter", 1);
        }
    }

    knight.setState("run");
    await knight.moveTo(samurai.x + 70, 18);

    await wait(60);

    knight.setState("attack");

    // Knight swing uses knightSFX.swingPitch
    sfxKnight("swing", 0.9);

    if (window.fxManager && fxManager.spawn) {
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

    if (window.hpSamurai) {
        hpSamurai.setHP(hpSamurai.hp - dmg);
    }

    if (window.damageFX) {
        damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, dmg));
    }

    if (window.PlayerStamina && PlayerStamina.onHit) {
        PlayerStamina.onHit();
    }

    samurai.setState("block");
    await wait(140);
    samurai.setState("idle");

    if (window.hpSamurai && hpSamurai.hp <= 0) {
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
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "roll");
        Banter.say("knight", "roll", window.CurrentEnemy?.name);
    }

    samurai.setState("run");
    knight.setState("run");

    // Draw: subtle UI cue
    sfxUI("ui", 0.8);

    samurai.flip = true;
    knight.flip = false;

    const samuraiBack = samurai.x - 120;
    const knightBack = knight.x + 120;

    for (let i = 0; i < 6; i++) {
        if (window.fxManager && fxManager.spawnDust) {
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
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.PlayerStamina && PlayerStamina.regen) {
        PlayerStamina.regen();
    }

    if (window.Banter && Banter.say) {
        if (Math.random() < 0.02) {
            Banter.say("samurai", "tina_rare");
        } else {
            Banter.say("samurai", "pass");
        }
        Banter.say("knight", "pass", window.CurrentEnemy?.name);
    }

    // PASS: dodge sound (uses samuraiSFX.dodgePitch)
    sfxSamurai("dodge", 0.8);

    const originalFlip = samurai.flip;

    flashScreen = 1;
    await wait(80);
    flashScreen = 0;

    if (window.shadowClones) {
        shadowClones.push(spawnShadowClone(samurai));
    }

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
        if (window.shadowClones) {
            shadowClones.push(spawnShadowClone(samurai));
            sfxSamurai("dodge", 0.8);
        }
        await wait(140);
        samurai.flip = false;
        await samurai.blinkTo(240, 375);
        await wait(160);
    }

    if (window.shadowClones) {
        shadowClones.push(spawnShadowClone(samurai));
    }

    await wait(100);
    await samurai.blinkTo(SAMURAI_HOME_X, 375);
    await wait(120);

    samurai.flip = originalFlip;
    samurai.setState("idle");
    if (window.shadowClones) shadowClones.length = 0;

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

    window.hideDice = false;

    if (!window.dice || !dice.player || !dice.enemy) {
        return;
    }

    // UI dice reveal sound
    sfxUI("ui", 0.8);

    await wait(220);

    if (window.DiceSmoke && DiceSmoke.burst) {
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

    if (window.PlayerStamina && PlayerStamina.spendForAttack) {
        if (!PlayerStamina.spendForAttack()) {
            sfxUI("ui", 0.7);
            window.dispatchEvent(new Event("ENEMY_ATTACK"));
            return;
        }
    }

    if (window._combatBusy) return;

    if (!window.lastDiceOutcome) {
        if (typeof window.playerFace === "number" &&
            typeof window.enemyFace === "number") {

            if (playerFace > enemyFace) {
                window.lastDiceOutcome = "player";
            } else if (enemyFace > playerFace) {
                window.lastDiceOutcome = "enemy";
            } else {
                window.lastDiceOutcome = "draw";
            }

        } else {
            console.warn("PLAYER_ATTACK: no dice outcome and no faces → abort");
            return;
        }
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
        Banter.say("knight", "attack", window.CurrentEnemy?.name);
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
        Banter.say("knight", "roll", window.CurrentEnemy?.name);
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

        if (window.PlayerStamina && PlayerStamina.current <= 0) {
            window.lastDiceOutcome = null;
            window.hideDice = false;
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

        if (typeof xbar !== "undefined" && xbar.showCombat) {
            xbar.showCombat();
        }

    } finally {
        window._diceResolving = false;
    }
});
