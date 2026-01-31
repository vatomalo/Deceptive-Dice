// =======================================================
// combat.js — Dice revealed ONLY on ATTACK + Stamina (REWORKED)
// + Banter hooks + Katana & Blood FX for deaths
// + Spirit Hearts (continues) + Entity-channel SFX
// + Global Audio Profiles for voices & swing/dodge
//
// FIXES INCLUDED (IMPORTANT):
// - PASS QTE: triggers on gap >= 1 (not only >= 3)
// - PASS QTE uses SNAPSHOT faces (pf/ef) so animation time can't break it
// - PASS QTE calls window.QTE.prompt (never bare QTE.prompt)
// - PASS QTE is wrapped in try/catch and has logs
// - ShadowClone calls are guarded so they can't throw and skip QTE
//
// - Heart system: HeartShards (3 shards => +1 heart)
//   so progress is visible even when PlayerHearts == MaxHearts
// - Rare MaxHearts increase on kill (very low chance)
// =======================================================

console.log("combat.js loaded");

window._passCaughtAttack = false;

// =======================================================
// PASS RULES
// =======================================================
function enemyCatchesPass() {
    if (typeof enemyFace !== "number") return true;
    return enemyFace < 2; // catches on 1–2 only (~33%)
}

// ---- QTE spawn control ----
window._qteCooldownUntil = window._qteCooldownUntil || 0;

// snapshot-driven chance
function shouldSpawnPassQTE(pf, ef) {
    if (typeof pf !== "number" || typeof ef !== "number") return false;

    const gap = pf - ef;
    if (gap < 1) return false;

    const now = performance.now();
    if (now < window._qteCooldownUntil) return false;

    // gap 1 => 16%
    // gap 2 => 26%
    // gap 3 => 36%
    // gap 4 => 46%
    // gap 5 => 50% (cap)
    const chance = Math.min(0.50, 0.16 + (gap - 1) * 0.10);

    if (Math.random() > chance) return false;

    window._qteCooldownUntil = now + 1800; // 1.8s
    return true;
}

// =======================================================
// HEART SYSTEM (Shards so progress is visible)
// =======================================================
if (typeof window.PlayerHearts === "undefined") window.PlayerHearts = 5;
if (typeof window.MaxHearts === "undefined") window.MaxHearts = 5;

window.HeartShards = window.HeartShards || 0;
window.ShardsPerHeart = window.ShardsPerHeart || 3;

function gainHeartShard(amount = 1) {
    window.HeartShards += amount;

    while (window.HeartShards >= window.ShardsPerHeart) {
        window.HeartShards -= window.ShardsPerHeart;

        const before = window.PlayerHearts;
        window.PlayerHearts = Math.min(window.MaxHearts, window.PlayerHearts + 1);

        if (window.PlayerHearts > before) {
            console.log("[HEART] +1 heart (via shards). Hearts:", window.PlayerHearts, "Max:", window.MaxHearts);
            if (window.Banter && Banter.say) Banter.say("samurai", "found");
            if (window.SFX && SFX.playUI) SFX.playUI("heal", 0.9);
        } else {
            // You were capped; shards still bank for after you lose hearts
            console.log("[HEART] shard converted but hearts already max. (banking progress)");
        }
    }
}

// =======================================================
// DAMAGE + STATS HOOKS
// =======================================================
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

if (typeof window.computePlayerDamage !== "function") {
    window.computePlayerDamage = function (base) {
        if (typeof window.computePlayerDamageBase === "function") return computePlayerDamageBase(base);
        return Math.max(1, Math.floor(base));
    };
}
if (typeof window.computeEnemyDamage !== "function") {
    window.computeEnemyDamage = function (base) {
        if (typeof window.computeEnemyDamageBase === "function") return computeEnemyDamageBase(base);
        return Math.max(1, Math.floor(base));
    };
}

// AGI-based evade + multihit
window.tryEvade = function (who = "player") {
    const agi = (who === "enemy")
        ? (window.CurrentEnemy?.AGI ?? 1)
        : (window.PlayerStats?.AGI ?? 1);

    const chance = clamp(0.06 + agi * 0.015, 0.06, 0.40);
    return Math.random() < chance;
};

window.tryMultihit = function (who = "player") {
    const agi = (who === "enemy")
        ? (window.CurrentEnemy?.AGI ?? 1)
        : (window.PlayerStats?.AGI ?? 1);

    const chance = clamp(0.04 + agi * 0.01, 0.04, 0.25);
    return Math.random() < chance;
};

// =======================================================
// STAMINA REWORK
// =======================================================
(function ensureStamina() {
    const DEFAULT_MAX = 6;
    const DEFAULT_ATTACK_COST = 1;
    const DEFAULT_PASS_REGEN = 1;

    if (!window.PlayerStamina) {
        window.PlayerStamina = {
            max: DEFAULT_MAX,
            current: DEFAULT_MAX,
            attackCost: DEFAULT_ATTACK_COST,
            passRegen: DEFAULT_PASS_REGEN,

            canAttack() { return this.current >= this.attackCost; },
            spendForAttack() {
                if (!this.canAttack()) return false;
                this.current -= this.attackCost;
                return true;
            },
            regenOnPass() { this.current = Math.min(this.max, this.current + this.passRegen); },
            onHit() { /* default: no stamina drain */ },
            reset() { this.current = this.max; }
        };
        return;
    }

    const S = window.PlayerStamina;
    if (typeof S.max !== "number") S.max = DEFAULT_MAX;
    if (typeof S.current !== "number") S.current = S.max;
    if (typeof S.attackCost !== "number") S.attackCost = DEFAULT_ATTACK_COST;
    if (typeof S.passRegen !== "number") S.passRegen = DEFAULT_PASS_REGEN;

    if (typeof S.canAttack !== "function") S.canAttack = function () { return this.current >= this.attackCost; };
    if (typeof S.spendForAttack !== "function") {
        S.spendForAttack = function () {
            if (!this.canAttack()) return false;
            this.current -= this.attackCost;
            return true;
        };
    }
    if (typeof S.regenOnPass !== "function") {
        S.regenOnPass = function () { this.current = Math.min(this.max, this.current + this.passRegen); };
    }
    if (typeof S.onHit !== "function") S.onHit = function () { };
    if (typeof S.reset !== "function") S.reset = function () { this.current = this.max; };
})();

(function ensureEnemyStamina() {
    if (!window.EnemyStamina) return;
    const E = window.EnemyStamina;
    if (typeof E.max !== "number") E.max = 6;
    if (typeof E.current !== "number") E.current = E.max;
    if (typeof E.reset !== "function") E.reset = function () { this.current = this.max; };
    if (typeof E.regen !== "function") E.regen = function () { this.current = Math.min(this.max, this.current + 1); };
})();

// =======================================================
// Built-in QTE fallback
// =======================================================
if (!window.QTE) {
    window.QTE = {
        prompt: function ({ durationMs = 420 } = {}) {
            return new Promise((resolve) => {
                let done = false;

                const overlay = document.createElement("div");
                overlay.id = "qte-overlay";
                overlay.style.position = "fixed";
                overlay.style.left = "0";
                overlay.style.top = "0";
                overlay.style.width = "100vw";
                overlay.style.height = "100vh";
                overlay.style.display = "flex";
                overlay.style.alignItems = "center";
                overlay.style.justifyContent = "center";
                overlay.style.background = "rgba(0,0,0,0.35)";
                overlay.style.zIndex = "99999";
                overlay.style.fontFamily = "monospace";
                overlay.style.userSelect = "none";

                const box = document.createElement("div");
                box.style.padding = "18px 26px";
                box.style.border = "3px solid rgba(255,255,255,0.85)";
                box.style.borderRadius = "12px";
                box.style.background = "rgba(0,0,0,0.55)";
                box.style.color = "white";
                box.style.fontSize = "28px";
                box.style.letterSpacing = "2px";
                box.textContent = "PARRY!  (SPACE)";

                overlay.appendChild(box);
                document.body.appendChild(overlay);

                const cleanup = (ok) => {
                    if (done) return;
                    done = true;
                    window.removeEventListener("keydown", onKey);
                    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    resolve(!!ok);
                };

                const onKey = (e) => { if (e.code === "Space") cleanup(true); };

                window.addEventListener("keydown", onKey);
                setTimeout(() => cleanup(false), durationMs);
            });
        }
    };
}

const hitStop = (ms) => new Promise(res => setTimeout(res, ms));
const wait = (ms) => new Promise(res => setTimeout(res, ms));

// =======================================================
// GLOBAL AUDIO PROFILES
// =======================================================
window.AudioProfiles = window.AudioProfiles || {};

if (!AudioProfiles.samuraiVoice) AudioProfiles.samuraiVoice = { pitch: 1.05, reverb: true, distortion: 0.0 };
if (!AudioProfiles.knightVoice) AudioProfiles.knightVoice = { pitch: 0.95, reverb: false, distortion: 0.0 };
if (!AudioProfiles.samuraiSFX) AudioProfiles.samuraiSFX = { swingPitch: 0.90, dodgePitch: 1.05 };
if (!AudioProfiles.knightSFX) AudioProfiles.knightSFX = { swingPitch: 0.95 };

function sfxSamurai(category, volume = 1.0, kind = "sfx") {
    if (!window.SFX || typeof SFX.playSamurai !== "function") return;
    let options = null;

    if (kind === "voice") {
        const v = AudioProfiles.samuraiVoice || {};
        options = { pitch: v.pitch, reverb: v.reverb, distortion: v.distortion };
    } else {
        const s = AudioProfiles.samuraiSFX || {};
        if (category === "swing" && typeof s.swingPitch === "number") options = { pitch: s.swingPitch };
        else if (category === "dodge" && typeof s.dodgePitch === "number") options = { pitch: s.dodgePitch };
    }

    if (options) SFX.playSamurai(category, volume, options);
    else SFX.playSamurai(category, volume);
}

function sfxKnight(category, volume = 1.0, kind = "sfx") {
    if (!window.SFX || typeof SFX.playKnight !== "function") return;
    let options = null;

    if (kind === "voice") {
        const v = AudioProfiles.knightVoice || {};
        options = { pitch: v.pitch, reverb: v.reverb, distortion: v.distortion };
    } else {
        const s = AudioProfiles.knightSFX || {};
        if (category === "swing" && typeof s.swingPitch === "number") options = { pitch: s.swingPitch };
    }

    if (options) SFX.playKnight(category, volume, options);
    else SFX.playKnight(category, volume);
}

function sfxUI(category, volume = 1.0) {
    if (!window.SFX || typeof SFX.playUI !== "function") return;
    SFX.playUI(category, volume);
}

function samuraiVoice(id = "attack", volume = 1.0) { sfxSamurai(`voice_${id}`, volume, "voice"); }
function knightVoice(id = "attack", volume = 1.0) { sfxKnight(`voice_${id}`, volume, "voice"); }

// =======================================================
// GLOBAL COMBAT STATE
// =======================================================
window.lastDiceOutcome = null;
window._combatBusy = false;

if (typeof window.hideDice === "undefined") window.hideDice = false;
if (!window.MateriaInventory) window.MateriaInventory = [];

function hasMateriaNote() {
    return !!(window.Banter && typeof Banter.materiaNote === "function");
}

// =======================================================
// RESPAWNS
// =======================================================
async function knightRespawnSequence() {
    DiceSmoke.stop();
    xbar.disable();

    sfxKnight("step", 0.8);

    knight.alpha = 1;
    knight.setState("run");
    knight.flip = true;
    knight.x = canvas.width + 80;

    for (let i = 0; i < 8; i++) {
        if (window.fxManager && fxManager.spawnDust) fxManager.spawnDust(knight);
    }

    await knight.moveTo(420, 15);
    knight.setState("idle");

    if (window.EnemyStamina && EnemyStamina.reset) EnemyStamina.reset();
    else if (window.EnemyStamina) EnemyStamina.current = EnemyStamina.max;

    DiceSmoke.start();

    if (window.Banter && Banter.say && window.CurrentEnemy) {
        Banter.say("knight", "intro", CurrentEnemy.name);
    }
}

async function samuraiRespawnSequence() {
    const originalFlip = samurai.flip;

    DiceSmoke.stop();
    xbar.disable();

    sfxSamurai("dodge", 0.9);

    flashScreen = 1;
    await wait(120);
    flashScreen = 0;

    if (window.fxManager && fxManager.spawnAngelSpark) {
        fxManager.spawnAngelSpark(samurai.x, samurai.y - 60);
    }

    if (samurai.blinkTo) await samurai.blinkTo(SAMURAI_HOME_X, SAMURAI_HOME_Y);
    else await samurai.moveTo(SAMURAI_HOME_X, 18);

    samurai.flip = originalFlip;
    samurai.setState("idle");

    if (window.PlayerStamina && PlayerStamina.reset) PlayerStamina.reset();
    else if (window.PlayerStamina) PlayerStamina.current = PlayerStamina.max;

    DiceSmoke.start();
}

window.addEventListener("KNIGHT_RESPAWN_EVENT", async () => { await knightRespawnSequence(); });
window.addEventListener("SAMURAI_RESPAWN_EVENT", async () => { await samuraiRespawnSequence(); });

// =======================================================
// DEATHS
// =======================================================
window.samuraiDeath = async function () {
    xbar.disable();
    DiceSmoke.stop();
    knight.setState("idle");

    if (window.Banter && Banter.say) Banter.say("samurai", "death");
    samuraiVoice("death", 0.9);

    if (typeof spawnKatanaFX === "function") spawnKatanaFX(samurai.x + 6, samurai.y - 90);

    samurai.setState("block");
    await wait(260);

    if (typeof spawnBloodFX === "function") spawnBloodFX(samurai.x, samurai.y - 50, 20);

    let fade = 1;
    await new Promise(resolve => {
        const loop = () => {
            fade -= 0.05;
            samurai.alpha = Math.max(0, fade);
            if (fade > 0) requestAnimationFrame(loop);
            else resolve();
        };
        loop();
    });

    sfxSamurai("death", 0.9);
    await knight.moveTo(420, 18);

    const hasExtraLife = (typeof window.PlayerHearts === "number" && PlayerHearts > 0);
    if (hasExtraLife) PlayerHearts = Math.max(0, PlayerHearts - 1);

    dispatchEvent(new Event("SAMURAI_RESPAWN_EVENT"));

    if (!hasExtraLife && typeof window.playerResetStats === "function") window.playerResetStats();

    samurai.alpha = 1;
    samurai.setState("idle");

    if (window.hpSamurai) hpSamurai.setHP(hpSamurai.maxHP);
    if (window.PlayerStamina) PlayerStamina.reset ? PlayerStamina.reset() : (PlayerStamina.current = PlayerStamina.max);

    if (samurai.blinkTo) await samurai.blinkTo(SAMURAI_HOME_X, SAMURAI_HOME_Y);
    else await samurai.moveTo(SAMURAI_HOME_X, 18);
};

window.knightDeath = async function () {
    xbar.disable();
    DiceSmoke.stop();
    samurai.setState("idle");

    if (window.Banter && Banter.say && window.CurrentEnemy) {
        Banter.say("knight", "death", CurrentEnemy.name);
    }

    knightVoice("death", 0.9);
    if (typeof spawnBloodFX === "function") spawnBloodFX(knight.x, knight.y - 60, 24);

    knight.setState("death");
    sfxKnight("death", 0.9);
    await wait(300);

    let fade = 1;
    await new Promise(resolve => {
        const loop = () => {
            fade -= 0.05;
            knight.alpha = Math.max(0, fade);
            if (fade > 0) requestAnimationFrame(loop);
            else resolve();
        };
        loop();
    });

    dispatchEvent(new Event("KNIGHT_RESPAWN_EVENT"));

    if (typeof TotalKills === "number") TotalKills++;
    else window.TotalKills = 1;

    if (typeof enemyGainXP === "function") enemyGainXP(6);

    // -----------------------------
    // HEART / SHARD DROPS (visible)
    // -----------------------------
    try {
        // 35% chance: +1 shard
        if (Math.random() < 0.35) {
            gainHeartShard(1);
            console.log("[HEART] +1 shard (now:", window.HeartShards, "/", window.ShardsPerHeart, ")");
        }

        // Very rare: increase MaxHearts (1.5% per kill)
        if (Math.random() < 0.015) {
            window.MaxHearts = Math.min(12, window.MaxHearts + 1);
            console.log("[HEART] MaxHearts increased to", window.MaxHearts);
            if (window.SFX && SFX.playUI) SFX.playUI("heal", 1.0);
        }
    } catch (e) {
        console.warn("Heart shard roll failed:", e);
    }

    // -----------------------------
    // Materia drop
    // -----------------------------
    try {
        if (Math.random() < 0.25) {
            const pool = ["crit", "regen", "speed", "barrier", "counter", "thorns", "poison"];
            const pick = pool[Math.floor(Math.random() * pool.length)];

            if (!window.MateriaInventory) window.MateriaInventory = [];
            window.MateriaInventory.push(pick);

            console.log("Materia obtained:", pick);
            if (window.Banter && Banter.say) Banter.say("samurai", "found");
        }
    } catch (e) {
        console.warn("Materia drop failed:", e);
    }

    // Small chance to grow AGI/DEF
    try {
        if (!window.PlayerStats) window.PlayerStats = {};
        if (Math.random() < 0.08) {
            const stat = (Math.random() < 0.5) ? "AGI" : "DEF";
            const before = (typeof window.PlayerStats[stat] === "number") ? window.PlayerStats[stat] : 1;
            window.PlayerStats[stat] = before + 1;
        }
    } catch (e) {
        console.warn("Stat level roll failed:", e);
    }

    if (typeof spawnEnemy === "function") spawnEnemy(TotalKills);

    if (window.EnemyStamina && EnemyStamina.reset) EnemyStamina.reset();
    else if (window.EnemyStamina) EnemyStamina.current = EnemyStamina.max;

    knight.alpha = 1;
    knight.setState("idle");

    if (window.CurrentEnemy && window.hpKnight) {
        CurrentEnemy.hp = CurrentEnemy.maxHP;
        hpKnight.maxHP = CurrentEnemy.maxHP;
        hpKnight.setHP(CurrentEnemy.hp);
    }
};

// =======================================================
// CORE ROUND SEQUENCES
// =======================================================
async function handlePlayerWinRound() {
    DiceSmoke.stop();
    xbar.disable();
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.Banter && Banter.say) {
        Banter.say("samurai", "swing");
        Banter.say("knight", "hurt", window.CurrentEnemy?.name);
    }

    samuraiVoice("attack", 0.9);

    const base = Math.max(1, playerFace - enemyFace) * 10;
    const enemyEvaded = (typeof tryEvade === "function") ? tryEvade("enemy") : false;

    samurai.setState("run");
    await samurai.moveTo(knight.x - 70, 18);
    await wait(60);

    samurai.setState("attack");
    sfxSamurai("swing", 0.9);

    if (window.fxManager && fxManager.spawn) {
        fxManager.spawn(FX_SLASH, knight.x - 40, knight.y - 100, 1.25, false, 65);
    }

    flashScreen = 1;
    await hitStop(140);
    flashScreen = 0;

    if (enemyEvaded) {
        if (window.damageFX) damageFX.push(new DamageNumber(knight.x, knight.y - 110, "GUARD!", true));
        sfxKnight("block", 0.85);

        const ox = knight.x;
        knight.setState("guard");
        await wait(140);
        knight.x = ox + 10;
        await wait(80);
        knight.x = ox;
        knight.setState("idle");

        samurai.setState("run");
        await samurai.moveTo(120, 18);
        samurai.setState("idle");

        xbar.showRoll();
        return;
    }

    let dmg = window.computePlayerDamage ? window.computePlayerDamage(base) : Math.max(1, Math.floor(base));

    const didCrit = (typeof tryCrit === "function") ? tryCrit() : false;
    if (didCrit) {
        dmg *= 2;
        if (window.damageFX) damageFX.push(new DamageNumber(knight.x, knight.y - 140, "CRIT!", true));
        if (hasMateriaNote()) Banter.materiaNote("enemy", "crit", 1);
    }

    if (typeof tryMultihit === "function" && tryMultihit("player")) {
        dmg = Math.floor(dmg * 1.8);
        if (window.damageFX) damageFX.push(new DamageNumber(knight.x, knight.y - 150, "x2!", true));
    }

    if (typeof applyPoison === "function" && applyPoison()) {
        if (window.CurrentEnemy) CurrentEnemy.isPoisoned = true;
        if (hasMateriaNote()) Banter.materiaNote("enemy", "poison", 1);
    }

    if (window.CurrentEnemy && window.hpKnight) {
        CurrentEnemy.hp -= dmg;
        hpKnight.setHP(CurrentEnemy.hp);
    }

    if (window.damageFX) damageFX.push(new DamageNumber(knight.x, knight.y - 110, dmg));

    knight.setState("hurt");
    await wait(150);
    knight.setState("idle");

    if (window.CurrentEnemy && CurrentEnemy.hp <= 0) {
        if (typeof giveXP === "function") giveXP(12 + enemyFace * 2);
        if (typeof enemyGainXP === "function") enemyGainXP(6);
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

    if (window.Banter && Banter.say) {
        Banter.say("knight", "hit", window.CurrentEnemy?.name);
        Banter.say("samurai", "hurt");
    }

    knightVoice("attack", 0.9);

    const base = Math.max(1, enemyFace - playerFace) * 10;
    const playerEvaded = (typeof tryEvade === "function") ? tryEvade("player") : false;

    knight.setState("run");
    await knight.moveTo(samurai.x + 70, 18);
    await wait(60);

    knight.setState("attack");
    sfxKnight("swing", 0.9);

    if (window.fxManager && fxManager.spawn) {
        fxManager.spawn(FX_SLASH, samurai.x - 40, samurai.y - 100, 1.25, true, 65);
    }

    flashScreen = 1;
    await hitStop(140);
    flashScreen = 0;

    if (playerEvaded) {
        if (window.damageFX) damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, "EVADE!", true));
        sfxSamurai("dodge", 0.9);

        const ox = samurai.x;
        samurai.setState("pass");
        await wait(70);
        samurai.x = ox - 34;
        await wait(90);
        samurai.x = ox;
        samurai.setState("idle");

        knight.setState("run");
        await knight.moveTo(420, 18);
        knight.setState("idle");

        xbar.showRoll();
        return;
    }

    let dmg = window.computeEnemyDamage ? window.computeEnemyDamage(base) : Math.max(1, Math.floor(base));
    if (window._passCaughtAttack) dmg = Math.max(1, Math.floor(dmg * 0.70));

    const enemyMateria = (window.CurrentEnemy && CurrentEnemy.materia) ? CurrentEnemy.materia : {};

    if (enemyMateria.thorns && window.hpSamurai) {
        const t = Math.floor(dmg * 0.2);
        hpSamurai.setHP(hpSamurai.hp - t);
        if (window.damageFX) damageFX.push(new DamageNumber(samurai.x, samurai.y - 130, `${t} THORNS`, true));
        if (hasMateriaNote()) Banter.materiaNote("player", "thorns", 1);
    }

    if (enemyMateria.counter && window.CurrentEnemy && window.hpKnight) {
        const c = Math.floor((CurrentEnemy.STR || 1) * 1.6);
        CurrentEnemy.hp -= c;
        hpKnight.setHP(CurrentEnemy.hp);
        if (window.damageFX) damageFX.push(new DamageNumber(knight.x, knight.y - 160, "COUNTER!", true));
        if (hasMateriaNote()) Banter.materiaNote("enemy", "counter", 1);
    }

    if (window.hpSamurai) hpSamurai.setHP(hpSamurai.hp - dmg);
    if (window.damageFX) damageFX.push(new DamageNumber(samurai.x, samurai.y - 110, dmg));

    if (window.PlayerStamina && PlayerStamina.onHit) PlayerStamina.onHit();

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

// =======================================================
// PASS ROUND (stamina regen happens here, always)
// =======================================================
async function handlePassRound() {
    DiceSmoke.stop();
    xbar.disable();
    if (window.dice && dice.player) dice.player.clear();
    if (window.dice && dice.enemy) dice.enemy.clear();

    if (window.PlayerLevel) PlayerLevel.lastAction = "pass";

    if (window.PlayerStamina && PlayerStamina.regenOnPass) PlayerStamina.regenOnPass();
    else if (window.PlayerStamina && PlayerStamina.regen) PlayerStamina.regen();

    if (window.Banter && Banter.say) {
        if (Math.random() < 0.02) Banter.say("samurai", "tina_rare");
        else Banter.say("samurai", "pass");
        Banter.say("knight", "pass", window.CurrentEnemy?.name);
    }

    sfxSamurai("dodge", 0.8);

    const originalFlip = samurai.flip;

    flashScreen = 1;
    await wait(80);
    flashScreen = 0;

    // Guard shadow clone calls so they can't throw and skip QTE
    if (window.shadowClones && typeof window.spawnShadowClone === "function") {
        shadowClones.push(spawnShadowClone(samurai));
    }
    await wait(120);

    const r = Math.floor(Math.random() * 4);

    if (r === 0) {
        samurai.flip = true;
        if (samurai.blinkTo) await samurai.blinkTo(knight.x + 90, 375);
        else await samurai.moveTo(knight.x + 90, 18);
        await wait(180);
    } else if (r === 1) {
        samurai.flip = false;
        if (samurai.blinkTo) await samurai.blinkTo(260, 375);
        else await samurai.moveTo(260, 18);
        await wait(200);
    } else if (r === 2) {
        samurai.flip = false;
        if (samurai.blinkTo) await samurai.blinkTo(20, 375);
        else await samurai.moveTo(20, 18);
        await wait(160);
    } else {
        samurai.flip = true;
        if (samurai.blinkTo) await samurai.blinkTo(knight.x + 60, 375);
        else await samurai.moveTo(knight.x + 60, 18);

        if (window.shadowClones && typeof window.spawnShadowClone === "function") {
            shadowClones.push(spawnShadowClone(samurai));
            sfxSamurai("dodge", 0.8);
        }

        await wait(140);

        samurai.flip = false;
        if (samurai.blinkTo) await samurai.blinkTo(240, 375);
        else await samurai.moveTo(240, 18);
        await wait(160);
    }

    if (window.shadowClones && typeof window.spawnShadowClone === "function") {
        shadowClones.push(spawnShadowClone(samurai));
    }

    await wait(100);
    if (samurai.blinkTo) await samurai.blinkTo(SAMURAI_HOME_X, 375);
    else await samurai.moveTo(SAMURAI_HOME_X, 18);
    await wait(120);

    samurai.flip = originalFlip;
    samurai.setState("idle");
    if (window.shadowClones) shadowClones.length = 0;

    window.lastDiceOutcome = null;

    // Snapshot faces once (prevents animation timing issues)
    const pf = (typeof playerFace === "number") ? playerFace : null;
    const ef = (typeof enemyFace === "number") ? enemyFace : null;

    console.log("[PASS] faces snapshot:", pf, ef);

    // ---- QTE (HARDENED) ----
    let qteSuccess = false;
    try {
        const should = !!window.QTE && shouldSpawnPassQTE(pf, ef);
        console.log("[QTE] shouldSpawn:", should, "| pf:", pf, "ef:", ef, "gap:", (pf != null && ef != null) ? (pf - ef) : "n/a");

        if (should) {
            // IMPORTANT: call window.QTE.prompt (not bare QTE.prompt)
            qteSuccess = await window.QTE.prompt({ durationMs: 420 });
            console.log("[QTE] result:", qteSuccess);
        }
    } catch (e) {
        console.warn("[QTE] failed:", e);
    }

    if (qteSuccess) {
        if (window.PlayerLevel) PlayerLevel.lastAction = "pass";

        await handlePlayerWinRound();

        if (Math.random() < 0.05) await handlePlayerWinRound();

        if (window.CurrentEnemy && CurrentEnemy.hp <= 0) {
            window.lastDiceOutcome = null;
            xbar.showRoll();
            return;
        }
    }

    const caught = enemyCatchesPass();
    console.log("[PASS] enemy catches:", caught);

    if (caught) {
        window._passCaughtAttack = true;
        await handleEnemyWinRound();
        window._passCaughtAttack = false;
    }

    window.lastDiceOutcome = null;
    xbar.showRoll();
}

// =======================================================
// DICE REVEAL — ONLY CALLED WHEN ATTACK IS PRESSED
// =======================================================
async function revealDice(outcome) {
    window.hideDice = false;
    if (!window.dice || !dice.player || !dice.enemy) return;

    sfxUI("ui", 0.8);
    await wait(220);

    if (window.DiceSmoke && DiceSmoke.burst) DiceSmoke.burst(dice.enemy);

    if (dice.player) dice.player.bounceVel = -8;
    if (dice.enemy) dice.enemy.bounceVel = -8;

    await wait(180);

    if (outcome === "player") {
        if (dice.enemy) dice.enemy.currentFrame = null;
    } else if (outcome === "enemy") {
        if (dice.player) dice.player.currentFrame = null;
    }

    await wait(140);
}

// =======================================================
// PLAYER ATTACK (stamina spend happens HERE only)
// =======================================================
window.addEventListener("PLAYER_ATTACK", async () => {
    if (window.PlayerLevel) PlayerLevel.lastAction = "attack";
    if (window.Banter && Banter.say) Banter.say("samurai", "attack");

    if (window.PlayerStamina && typeof PlayerStamina.spendForAttack === "function") {
        const ok = PlayerStamina.spendForAttack();
        if (!ok) {
            sfxUI("ui", 0.7);
            window.dispatchEvent(new Event("PASS_EVENT"));
            return;
        }
    }

    if (window._combatBusy) return;

    if (!window.lastDiceOutcome) {
        if (typeof window.playerFace === "number" && typeof window.enemyFace === "number") {
            if (playerFace > enemyFace) window.lastDiceOutcome = "player";
            else if (enemyFace > playerFace) window.lastDiceOutcome = "enemy";
            else window.lastDiceOutcome = "draw";
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

        if (outcome === "player") await handlePlayerWinRound();
        else if (outcome === "enemy") await handleEnemyWinRound();
        else await handleDrawRound();
    } finally {
        window._combatBusy = false;
    }
});

// =======================================================
// FALLBACK ROUTES
// =======================================================
window.addEventListener("ENEMY_ATTACK", async () => {
    if (window.Banter && Banter.say) Banter.say("knight", "attack", window.CurrentEnemy?.name);
    if (window._combatBusy) return;
    window._combatBusy = true;
    try { await handleEnemyWinRound(); }
    finally { window._combatBusy = false; }
});

window.addEventListener("DRAW_EVENT", async () => {
    if (window.Banter && Banter.say) {
        Banter.say("samurai", "roll");
        Banter.say("knight", "roll", window.CurrentEnemy?.name);
    }
    if (window._combatBusy) return;
    window._combatBusy = true;
    try { await handleDrawRound(); }
    finally { window._combatBusy = false; }
});

window.addEventListener("PASS_EVENT", async () => {
    if (window._combatBusy) return;
    window._combatBusy = true;
    try { await handlePassRound(); }
    finally { window._combatBusy = false; }
});

// =======================================================
// DICE RESOLUTION → STORE OUTCOME
// =======================================================
window._diceResolving = false;

window.addEventListener("DICE_FINISHED", async () => {
    // Gambits: evaluate once at decision moment
    if (window.MateriaGambits && typeof MateriaGambits.evaluate === "function") {
        const r = MateriaGambits.evaluate();
        if (r.acted) {
            // If gambit triggered an action, do NOT show buttons this instant
            // (PASS_EVENT / REGEN_TICK / MAX_GAMBIT_TRIGGER will drive flow)
            return;
        }
    }

    if (window._diceResolving) return;
    window._diceResolving = true;

    try {
        if (typeof playerFace === "undefined" || typeof enemyFace === "undefined") return;

        if (playerFace > enemyFace) window.lastDiceOutcome = "player";
        else if (enemyFace > playerFace) window.lastDiceOutcome = "enemy";
        else window.lastDiceOutcome = "draw";

        if (typeof xbar !== "undefined" && xbar.showCombat) {
            if (window.PlayerStamina && typeof xbar.showPassOnly === "function" && !PlayerStamina.canAttack()) {
                xbar.showPassOnly();
            } else {
                xbar.showCombat();
            }
        }
    } finally {
        window._diceResolving = false;
    }
});

window.addEventListener("MAX_GAMBIT_TRIGGER", async (ev) => {
  // super small v1: a free extra hit if you were already winning
  // (later you can make this a special QTE finisher)
  try {
    if (window._combatBusy) return;
    window._combatBusy = true;

    // If player is winning on dice, do one immediate player win sequence
    if (typeof playerFace === "number" && typeof enemyFace === "number" && playerFace > enemyFace) {
      await handlePlayerWinRound();
    } else {
      // fallback: just give a strong buff flag or do nothing
      window.forceCrit = true;
    }
  } finally {
    window._combatBusy = false;
  }
});
