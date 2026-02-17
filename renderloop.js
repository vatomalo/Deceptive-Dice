// =======================================================
// renderloop.js — FINAL CLEAN VERSION
// Dice obey hideDice, Banter drawn, Materia menu overlay
// 60 TICKS + uncapped render
// - Simulation updates at exactly 60Hz
// - Rendering uses requestAnimationFrame
// - Prevents spiral-of-death with capped accumulator
// =======================================================
console.log("renderloop.js loaded");

// -------------------------
// GLOBAL TICK CLOCK
// -------------------------
window.Ticks = window.Ticks || {
    hz: 60,
    dt: 1 / 60,          // seconds per tick
    dtMs: 1000 / 60,     // ms per tick
    now: 0,              // seconds since loop start (sim time)
    frame: 0,            // render frames
    tick: 0,             // sim ticks
    bgSpeedMul: 1.0,     // mood-controlled multiplier
    paused: false,
};

// Change mood speed anytime:
window.Ticks = window.Ticks || { bgSpeedMul: 1.0, bgSpeedTarget: 1.0 };

window.setTickMood = function (mood) {
    if (mood === "tense") Ticks.bgSpeedTarget = 1.8;
    else if (mood === "calm") Ticks.bgSpeedTarget = 0.8;
    else if (mood === "night") Ticks.bgSpeedTarget = 0.55;
    else Ticks.bgSpeedTarget = 1.0;
};

// -------------------------
// FIXED TIMESTEP LOOP
// -------------------------
let _rafId = 0;
let _last = performance.now();
let _acc = 0;

// Prevent huge catch-up after tab-switch / lag
const MAX_ACCUM_MS = 250;         // cap accumulated lag
const MAX_STEPS_PER_FRAME = 5;    // cap sim steps per render

// Hook points (your game update/draw)
function simTick(dt) {
    // dt is seconds (1/60)

    // Update world with deterministic tick time
    if (window.AttractMode && AttractMode.update) AttractMode.update(dt);

    if (window.bg && typeof bg.update === "function") {
        // dt + mood multiplier
        bg.update(dt, Ticks.bgSpeedMul);
    }

    if (window.Gambits && typeof Gambits.tick === "function") {
        Gambits.tick();
    }


    if (window.decor && typeof decor.update === "function") decor.update(dt);
    if (window.fxManager && typeof fxManager.update === "function") fxManager.update(dt);

    if (window.samurai && typeof samurai.update === "function") samurai.update(dt);
    if (window.knight && typeof knight.update === "function") knight.update(dt);

    if (window.dice) {
        if (dice.player && typeof dice.player.update === "function") dice.player.update(dt);
        if (dice.enemy && typeof dice.enemy.update === "function") dice.enemy.update(dt);
    }

    if (window.damageFX && Array.isArray(damageFX)) {
        for (let i = damageFX.length - 1; i >= 0; i--) {
            const d = damageFX[i];
            if (d && typeof d.update === "function") d.update(dt);
            if (d && d.dead) damageFX.splice(i, 1);
        }
    }

    // Weather director etc
    if (window.Weather && typeof Weather.update === "function") Weather.update(dt);

    Ticks.tick++;
    Ticks.now += dt;
}

function render(alpha) {
    // alpha is interpolation factor [0..1] if you ever want it.
    // If you don't interpolate sprites, ignore it.

    if (!window.ctx || !window.canvas) return;
    const ctx = window.ctx;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw order
    if (window.bg && typeof bg.draw === "function") bg.draw(ctx);
    if (window.decor && typeof decor.draw === "function") decor.draw(ctx);

    if (window.fxManager && typeof fxManager.draw === "function") fxManager.draw(ctx);

    if (window.samurai && typeof samurai.draw === "function") samurai.draw(ctx);
    if (window.knight && typeof knight.draw === "function") knight.draw(ctx);

    if (window.dice) {
        if (dice.player && typeof dice.player.draw === "function") dice.player.draw(ctx);
        if (dice.enemy && typeof dice.enemy.draw === "function") dice.enemy.draw(ctx);
    }

    if (window.damageFX && Array.isArray(damageFX)) {
        for (const d of damageFX) if (d && typeof d.draw === "function") d.draw(ctx);
    }

    // UI last
    if (window.drawNamePlates) drawNamePlates(ctx); // if you have it
    if (window.xbar && typeof xbar.draw === "function") xbar.draw(ctx);

    if (window.materiaMenuOpen && typeof drawMateriaMenu === "function") {
        drawMateriaMenu(ctx, canvas);
    }

    Ticks.frame++;
}

function loop(nowMs) {
    _rafId = requestAnimationFrame(loop);

    if (Ticks.paused) {
        _last = nowMs;
        return;
    }

    let deltaMs = nowMs - _last;
    _last = nowMs;

    // Clamp crazy long frames
    if (deltaMs > MAX_ACCUM_MS) deltaMs = MAX_ACCUM_MS;

    _acc += deltaMs;

    // Fixed sim steps
    let steps = 0;
    while (_acc >= Ticks.dtMs && steps < MAX_STEPS_PER_FRAME) {
        simTick(Ticks.dt);
        _acc -= Ticks.dtMs;
        steps++;
    }

    // If we’re still behind, drop remainder to avoid death spiral
    if (steps === MAX_STEPS_PER_FRAME) _acc = 0;

    const alpha = _acc / Ticks.dtMs;
    render(alpha);
}

// -------------------------
// START / STOP
// -------------------------
window.startRenderLoop = function () {
    cancelAnimationFrame(_rafId);
    _last = performance.now();
    _acc = 0;
    Ticks.now = 0;
    Ticks.frame = 0;
    Ticks.tick = 0;
    Ticks.paused = false;
    _rafId = requestAnimationFrame(loop);
    console.log("[RENDERLOOP] started @ 60 ticks");
};

window.stopRenderLoop = function () {
    cancelAnimationFrame(_rafId);
    Ticks.paused = true;
    console.log("[RENDERLOOP] stopped");
};

(function () {

    window.flashScreen = 0;

    // Simple, robust head height helper
    function headY(c) {
        return c.y - (80 * c.scale);
    }

    // =======================================================
    // MATERIA MENU DRAW
    // =======================================================
    function drawMateriaMenu(ctx, canvas) {
        if (!window.materiaMenuOpen) return;

        const W = canvas.width - 160;
        const H = canvas.height - 120;
        const X = 80;
        const Y = 60;

        ctx.save();

        // Panel
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(X, Y, W, H);

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.strokeRect(X, Y, W, H);

        ctx.fillStyle = "white";
        ctx.font = "22px pixel";
        ctx.textAlign = "left";
        ctx.fillText("MATERIA", X + 24, Y + 40);

        ctx.font = "16px pixel";

        const inv = window.MateriaInventory || [];
        const slot = window.Materia || {};
        let y = Y + 90;

        for (let i = 0; i < inv.length; i++) {
            const key = inv[i];
            const owned = !!slot[key];

            const marker = owned ? "●" : "○";
            ctx.fillText(`${i + 1}. ${marker} ${key.toUpperCase()}`, X + 30, y);
            y += 26;
        }

        ctx.restore();
    }

    // =======================================================
    // MAIN RENDER LOOP
    // =======================================================
    function renderLoop() {

        const now = performance.now();
        const dt = 16 * (window.timeScale || 1);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;

        //-------- stamina regen ----------------
        if (window.updateStamina) {
            updateStamina(dt);
        }
        // (legacy extra regen kept for now)
        if (window.PlayerStamina) {
            PlayerStamina.current = Math.min(PlayerStamina.max, PlayerStamina.current + PlayerStamina.regenRate);
        }
        if (window.EnemyStamina) {
            EnemyStamina.current = Math.min(EnemyStamina.max, EnemyStamina.current + EnemyStamina.regenRate);
        }

        // ---------------- flash fade ----------------
        if (flashScreen > 0) {
            flashScreen -= 0.08;
            if (flashScreen < 0) flashScreen = 0;
        }

        // ---------------- background ----------------
        //Ticks.bgSpeedMul += (Ticks.bgSpeedTarget - Ticks.bgSpeedMul) * 0.08;
        bg.update(dt, Ticks.bgSpeedMul);
        bg.draw(ctx);

        // Decor BEHIND characters
        if (window.decor && decor.drawBack) {
            decor.x = canvas.width * 2;
            decor.y = canvas.height / 2;
            decor.drawBack(ctx);
        } else if (window.decor) {
            // fallback for older decor versions
            decor.draw(ctx);
        }

        // ---------------- characters ----------------
        samurai.update(dt);
        knight.update(dt);

        samurai.draw(ctx);
        knight.draw(ctx);

        if (window.drawShadowClones) {
            drawShadowClones(ctx);
        }

        // Decor IN FRONT of characters, under UI
        if (window.decor && decor.drawFront) {
            decor.x = canvas.width * 2;
            decor.y = canvas.height / 2;
            decor.drawFront(ctx);
        }

        // ---------------- DICE ----------------
        // DICE — placement
        dice.player.x = samurai.x;
        dice.player.y = samurai.y - 165;

        dice.enemy.x = knight.x;
        dice.enemy.y = knight.y - 175;

        dice.player.update(dt, now);
        dice.enemy.update(dt, now);

        if (!window.hideDice) {
            dice.player.draw();
            dice.enemy.draw();
        }
        if (window.QTE) QTE.update();

        // ===================================================
        // COMBAT FX
        // ===================================================
        fxManager.update(dt);
        fxManager.draw(ctx);

        if (window.StageTransitionFX) StageTransitionFX.update(dt);
        if (window.Camera) Camera.update(dt);

        // ===================================================
        // WEATHER FX
        // ===================================================
        updateWeatherFX(dt);
        drawWeatherFX(ctx);

        // ===================================================
        // SMOKE FX (DiceSmoke)
        // ===================================================
        const attacking =
            samurai.state === "attack" ||
            samurai.state === "run" ||
            knight.state === "attack" ||
            knight.state === "run";

        if (DiceSmoke.emitting && !attacking && !window.hideDice) {
            DiceSmoke.drip(dice.enemy, dt);
        }

        DiceSmoke.update(dt);

        if (DiceSmoke.emitting && !attacking && !window.hideDice) {
            DiceSmoke.draw(ctx);
        }

        // ===================================================
        // DAMAGE NUMBERS
        // ===================================================
        window.damageFX = window.damageFX.filter(d => {
            const alive = d.update(now);
            d.draw(ctx);
            return alive;
        });

        // -----------------------------------------
        // WORLD DRAWN — apply day/night palette
        // -----------------------------------------
        if (window.PaletteSystem) {
            PaletteSystem.update(dt);
            PaletteSystem.applyWorldTint(ctx, canvas);
            PaletteSystem.applyVignette(ctx, canvas);
        }

        if (window.StageTransitionFX) StageTransitionFX.draw(ctx, canvas);

        // ===================================================
        // HP BARS
        // ===================================================
        hpSamurai.draw();
        hpKnight.draw();

        // ===================================================
        // UI PANELS (stats + nameplates + stamina)
        // ===================================================
        if (window.drawStats) {
            window.drawStats(ctx);
        }

        window.PLAYER_TITLE = window.PLAYER_TITLE || "Ronin";

        if (window.drawNamePlate) {
            drawNamePlate(ctx, 25, 45, PLAYER_TITLE, `LV. ${PlayerLevel.level}`);
            drawNamePlate(ctx, canvas.width - 270, 45, CurrentEnemy.name, `LV. ${CurrentEnemy.level}`);
        }

        if (window.drawStaminaBar) {
            drawStaminaBar(ctx, 20, 46, 90, PlayerStamina);
            drawStaminaBar(ctx, canvas.width - 280, 46, 56, EnemyStamina);
        }

        // ===================================================
        // BANTER PANELS
        // ===================================================
        if (window.Banter && Banter.update && Banter.draw) {
            Banter.update(dt);
            Banter.draw(ctx, canvas);
        }
        if (window.QTE) QTE.draw(ctx, canvas);

        // ===================================================
        // FULLSCREEN ICON
        // ===================================================
        if (fsReady) {
            const size = 42;

            // tweak these if you want to move it later
            const marginRight = 10;
            const marginBottom = 0; // negative = even closer to the bottom edge

            const fx = canvas.width - size - marginRight;
            const fy = canvas.height - size - marginBottom;

            ctx.drawImage(fullscreenImg, fx, fy, size, size);
        }


        // ===================================================
        // FLASH OVERLAY
        // ===================================================
        if (flashScreen > 0) {
            ctx.save();
            ctx.globalAlpha = flashScreen * 0.45;
            ctx.fillStyle = window.flashColor || "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        // ===================================================
        // MATERIA MENU OVERLAY
        // ===================================================
        drawMateriaMenu(ctx, canvas);

        // ===================================================
        // XBAR LAST
        // ===================================================
        if (window.xbar) xbar.draw();

        requestAnimationFrame(renderLoop);
    }

    // =======================================================
    // PUBLIC START
    // =======================================================
    window.startRenderLoop = function () {
        requestAnimationFrame(renderLoop);
    };

})();
