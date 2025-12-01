// =======================================================
// statsystem.js — Core Stat Engine (Player + Enemy Levels)
// + UI stat boxes + materia tabs
// =======================================================

console.log("statsystem.js loaded");

// -------------------------------------------------------
// PLAYER STATS
// -------------------------------------------------------
window.PlayerStats = {
    STR: 1,    // attack multiplier
    AGI: 1,    // evade + multi-hit
    DEF: 1     // defense multiplier
};

// -------------------------------------------------------
// PLAYER LEVEL SYSTEM
// -------------------------------------------------------
window.PlayerLevel = {
    level: 1,
    xp: 0,
    nextXP: 30,
    lastAction: "attack"   // "attack", "pass", "defend"
};

// Gain XP
window.giveXP = function(amount) {

    PlayerLevel.xp += amount;

    while (PlayerLevel.xp >= PlayerLevel.nextXP) {

        PlayerLevel.xp -= PlayerLevel.nextXP;

        // XP required goes up each level
        PlayerLevel.nextXP = Math.floor(PlayerLevel.nextXP * 1.20 + 10);

        playerLevelUp();
    }
};

// Level up logic
function playerLevelUp() {

    PlayerLevel.level++;

    // Stat chosen based on last combat action
    switch (PlayerLevel.lastAction) {
        case "attack": PlayerStats.STR++; break;
        case "pass":   PlayerStats.AGI++; break;
        default:       PlayerStats.DEF++; break;
    }

    // Send a clean event to gameloop/UI
    window.dispatchEvent(new CustomEvent("PLAYER_LEVEL_UP", {
        detail: {
            level: PlayerLevel.level,
            STR: PlayerStats.STR,
            AGI: PlayerStats.AGI,
            DEF: PlayerStats.DEF
        }
    }));
}

window.playerLevelUp = playerLevelUp;

function playerResetStats() {

    // -------------------------
    // CORE STAT RESET
    // -------------------------
    PlayerStats.STR = 1;
    PlayerStats.AGI = 1;
    PlayerStats.DEF = 1;

    PlayerLevel.level  = 1;
    PlayerLevel.xp     = 0;
    PlayerLevel.nextXP = 30;
    PlayerLevel.lastAction = "attack";

    // -------------------------
    // HP RESET (only if bar exists)
    // -------------------------
    if (window.hpSamurai) {
        // Optional: scale maxHP by stats or level
        hpSamurai.maxHP = 5;       // or something dynamic later
        hpSamurai.setHP(hpSamurai.maxHP);
    }

    // -------------------------
    // STAMINA RESET
    // -------------------------
    if (window.PlayerStamina) {
        PlayerStamina.current = PlayerStamina.max;
    }

    // -------------------------
    // MATERIA RESET
    // -------------------------
    if (window.Materia && Materia.resetMateria) {
        Materia.resetMateria();
    } else if (window.Materia) {
        // Safe fallback: wipe materia manually
        for (const k in Materia) delete Materia[k];
    }

    // -------------------------
    // UI CLEANUP (optional)
    // -------------------------
    window.lastDiceOutcome = null;
    window.hideDice = false;

    console.log("Player stats fully reset");
}
window.playerResetStats = playerResetStats;


// -------------------------------------------------------
// ENEMY LEVEL (scales separately from player)
// -------------------------------------------------------
window.EnemyLevel = {
    level: 1,
    xp: 0,
    nextXP: 25
};

// Enemy XP gain
window.enemyGainXP = function(amount) {

    EnemyLevel.xp += amount;

    while (EnemyLevel.xp >= EnemyLevel.nextXP) {

        EnemyLevel.xp -= EnemyLevel.nextXP;
        EnemyLevel.nextXP = Math.floor(EnemyLevel.nextXP * 1.30);

        EnemyLevel.level++;

        // Stat scaling curve (semi-random)
        const r = Math.random();
        if      (r < 0.4) CurrentEnemy.STR++;
        else if (r < 0.7) CurrentEnemy.DEF++;
        else              CurrentEnemy.AGI++;

        window.dispatchEvent(new CustomEvent("ENEMY_LEVEL_UP", {
            detail: {
                level: EnemyLevel.level,
                name: CurrentEnemy.name
            }
        }));
    }
};


// -------------------------------------------------------
// DAMAGE CALCULATIONS (base, without materia)
// materiasystem overwrites bonuses, but stats stay here
// -------------------------------------------------------
window.computePlayerDamageBase = function(base) {
    return Math.floor(base * PlayerStats.STR / CurrentEnemy.DEF);
};

window.computeEnemyDamageBase = function(base) {
    return Math.floor(base * CurrentEnemy.STR / PlayerStats.DEF);
};


// -------------------------------------------------------
// LEVEL-UP VFX BUFFERS
// -------------------------------------------------------
window.LevelUpFX     = [];
window.EnemyLevelFX  = [];

window.addEventListener("PLAYER_LEVEL_UP", e => {
    LevelUpFX.push({
        text: `LEVEL UP!`,
        timer: 0,
        duration: 1000,
        alpha: 1
    });
});

window.addEventListener("ENEMY_LEVEL_UP", e => {
    EnemyLevelFX.push({
        text: `${e.detail.name} LEVEL UP!`,
        timer: 0,
        duration: 900,
        alpha: 1
    });
});

window.drawLevelUpFX = function(ctx) {
    LevelUpFX = LevelUpFX.filter(fx => {
        fx.timer += 16;
        fx.alpha = 1 - fx.timer / fx.duration;

        ctx.save();
        ctx.globalAlpha = fx.alpha;
        ctx.fillStyle = "white";
        ctx.font = "32px pixel";
        ctx.fillText(fx.text, 40, 200);
        ctx.restore();

        return fx.timer < fx.duration;
    });
};

window.drawEnemyLevelFX = function(ctx, canvas) {
    EnemyLevelFX = EnemyLevelFX.filter(fx => {
        fx.timer += 16;
        fx.alpha = 1 - fx.timer / fx.duration;

        ctx.save();
        ctx.globalAlpha = fx.alpha;
        ctx.fillStyle = "red";
        ctx.font = "28px pixel";
        ctx.fillText(fx.text, canvas.width - 260, 200);
        ctx.restore();

        return fx.timer < fx.duration;
    });
};


// =======================================================
// UI HELPERS — STATS + MATERIA DOTS
// =======================================================

// Small helper to get the canvas from global if caller
// doesn't pass it explicitly.
function getCanvas() {
    if (typeof canvas !== "undefined" && canvas) return canvas;
    const c = document.getElementById("game-canvas");
    return c || { width: 640, height: 480 }; // fallback
}

// Materia color classification
// Very simple: group effects into loose categories.
// You can tweak this mapping later to taste.
function getMateriaColor(type) {
    // type: "player" or "enemy"
    let slot;

    if (type === "player") {
        slot = window.Materia || {};
    } else {
        if (!window.CurrentEnemy || !CurrentEnemy.materia) return "rgba(120,120,120,0.6)";
        slot = CurrentEnemy.materia;
    }

    // Offensive / damage-oriented
    if (slot.crit || slot.counter || slot.speed) {
        return "rgb(230, 70, 70)";   // red
    }

    // Defensive / mitigation
    if (slot.thorns || slot.barrier) {
        return "rgb(70, 140, 230)";  // blue
    }

    // Status / utility
    if (slot.poison || slot.regen) {
        return "rgb(60, 190, 110)";  // green
    }

    // No materia equipped / nothing relevant
    return "rgba(120,120,120,0.6)";  // dull grey
}

// Draw a small "Materia" tab with a color dot
function drawMateriaTab(ctx, side, x, y) {
    // side: "player" | "enemy"
    const W = 78;
    const H = 20;

    ctx.save();

    ctx.globalAlpha = 0.70;
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, W, H);

    ctx.globalAlpha = 0.90;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

    // Text tag
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font      = "12px pixel";
    ctx.textBaseline = "middle";
    ctx.textAlign    = "left";
    ctx.fillText("MTR", x + 6, y + H * 0.5);

    // Color dot
    const color = getMateriaColor(side);
    const cx    = x + W - 14;
    const cy    = y + H * 0.5;
    const r     = 5;

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}


// -------------------------------------------------------
// STATS BOXES (Player + Enemy mirrored, with materia tabs)
// -------------------------------------------------------

// This replaces any previous window.drawStats usage.
// Call from renderloop: drawStats(ctx);
window.drawStats = function(ctx) {
    const c  = getCanvas();
    const cw = c.width;
    const ch = c.height;

    ctx.save();
    ctx.font = "14px pixel";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // ---------------- PLAYER BOX (bottom-left) ----------
    const boxW = 60;
    const boxH = 64;

    const px = 16;
    const py = ch - boxH - 220;   // margin from bottom

    ctx.globalAlpha = 0.70;
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.fillRect(px, py, boxW, boxH);

    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth   = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, boxW - 1, boxH - 1);

    ctx.fillStyle = "white";

    const lineH = 18;
    let ty = py + 8;

    //ctx.fillText(`Lv ${PlayerLevel.level}`, px + 8, ty);
    //ty += lineH;

    ctx.fillText(`STR ${PlayerStats.STR}`, px + 8, ty);
    ty += lineH;

    ctx.fillText(`AGI ${PlayerStats.AGI}`, px + 8, ty);
    ty += lineH;

    ctx.fillText(`DEF ${PlayerStats.DEF}`, px + 8, ty);

    // Materia tab for player (slightly below, diagonal feel)
    drawMateriaTab(ctx, "player", px , py + boxH + 4);

    // ---------------- ENEMY BOX (bottom-right, smaller) --
    const eBoxW = 60;
    const eBoxH = 62;

    const ex = cw - eBoxW - 16;
    const ey = ch - eBoxH - 60;  // a bit higher → diagonal

    ctx.globalAlpha = 0.65;
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.fillRect(ex, ey, eBoxW, eBoxH);

    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth   = 1;
    ctx.strokeRect(ex + 0.5, ey + 0.5, eBoxW - 1, eBoxH - 1);

    ctx.fillStyle = "rgba(255,240,240,0.95)";
    ctx.textAlign = "left";

    const enemy = window.CurrentEnemy || { STR: 1, AGI: 1, DEF: 1, name: "Enemy" };

    ty = ey + 6;
    //ctx.fillText(`Lv ${EnemyLevel.level}`, ex + 8, ty);
    //ty += lineH;

    ctx.fillText(`STR ${enemy.STR}`, ex + 8, ty);
    ty += lineH;

    ctx.fillText(`AGI ${enemy.AGI}`, ex + 8, ty);
    ty += lineH;

    ctx.fillText(`DEF ${enemy.DEF}`, ex + 8, ty);

    // Materia tab for enemy (mirrored on its side)
    drawMateriaTab(ctx, "enemy", ex - 4, ey + eBoxH + 4);

    ctx.restore();
};

// =======================================================
// MATERIA TAB HIT-TEST (for mouse clicks)
// =======================================================
window.isClickOnMateriaTab = function(mx, my, canvas) {
    const c  = canvas || getCanvas();
    const cw = c.width;
    const ch = c.height;

    // --- Player box + MTR tab (bottom-left) ---
    const boxW = 60;
    const boxH = 64;

    const px = 16;
    const py = ch - boxH - 220;

    const playerTabX = px;
    const playerTabY = py + boxH + 4;
    const tabW       = 78;   // from drawMateriaTab
    const tabH       = 20;

    const inPlayerTab =
        mx >= playerTabX &&
        mx <= playerTabX + tabW &&
        my >= playerTabY &&
        my <= playerTabY + tabH;

    // --- Enemy box + MTR tab (bottom-right) ---
    const eBoxW = 60;
    const eBoxH = 62;

    const ex = cw - eBoxW - 16;
    const ey = ch - eBoxH - 60;

    const enemyTabX = ex - 4;
    const enemyTabY = ey + eBoxH + 4;

    const inEnemyTab =
        mx >= enemyTabX &&
        mx <= enemyTabX + tabW &&
        my >= enemyTabY &&
        my <= enemyTabY + tabH;

    return inPlayerTab || inEnemyTab;
};
