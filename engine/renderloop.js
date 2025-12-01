// =======================================================
// renderloop.js — FINAL CLEAN VERSION
// Dice obey hideDice, Banter drawn, Materia menu overlay
// =======================================================
console.log("renderloop.js loaded");

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

        const W = canvas.width  - 160;
        const H = canvas.height - 120;
        const X = 80;
        const Y = 60;

        ctx.save();

        // Panel
        ctx.globalAlpha = 0.92;
        ctx.fillStyle   = "rgba(0,0,0,0.85)";
        ctx.fillRect(X, Y, W, H);

        ctx.globalAlpha = 1;
        ctx.strokeStyle = "white";
        ctx.lineWidth   = 3;
        ctx.strokeRect(X, Y, W, H);

        ctx.fillStyle = "white";
        ctx.font      = "22px pixel";
        ctx.textAlign = "left";
        ctx.fillText("MATERIA", X + 24, Y + 40);

        ctx.font = "16px pixel";

        const inv  = window.MateriaInventory || [];
        const slot = window.Materia || {};
        let y      = Y + 90;

        for (let i = 0; i < inv.length; i++) {
            const key   = inv[i];
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
        const dt  = 16 * (window.timeScale || 1);

        //-------- stamina regen ----------------
        if (window.updateStamina) {
            updateStamina(dt);
        }
        // (legacy extra regen kept for now)
        if (window.PlayerStamina) {
            PlayerStamina.current = Math.min(PlayerStamina.max, PlayerStamina.current + PlayerStamina.regenRate);
        }
        if (window.EnemyStamina) {
            EnemyStamina.current  = Math.min(EnemyStamina.max, EnemyStamina.current + EnemyStamina.regenRate);
        }

        // ---------------- flash fade ----------------
        if (flashScreen > 0) {
            flashScreen -= 0.08;
            if (flashScreen < 0) flashScreen = 0;
        }

        // ---------------- background ----------------
        bg.update(dt);
        bg.draw(ctx);

        // Decor BEHIND characters
        if (window.decor && decor.drawBack) {
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
            decor.drawFront(ctx);
        }

        // ---------------- DICE ----------------
        // DICE — placement
        dice.player.x = samurai.x;
        dice.player.y = samurai.y - 165;

        dice.enemy.x  = knight.x;
        dice.enemy.y  = knight.y - 175;

        dice.player.update(dt, now);
        dice.enemy.update(dt, now);

        if (!window.hideDice) {
            dice.player.draw();
            dice.enemy.draw();
        }

        // ===================================================
        // COMBAT FX
        // ===================================================
        fxManager.update(dt);
        fxManager.draw(ctx);

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
            samurai.state === "run"    ||
            knight.state  === "attack" ||
            knight.state  === "run";

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

        // ===================================================
        // FULLSCREEN ICON
        // ===================================================
        if (fsReady) {
            const size = 42;

            // tweak these if you want to move it later
            const marginRight  = 10;
            const marginBottom = 0; // negative = even closer to the bottom edge

            const fx = canvas.width  - size - marginRight;
            const fy = canvas.height - size - marginBottom;

            ctx.drawImage(fullscreenImg, fx, fy, size, size);
        }


        // ===================================================
        // FLASH OVERLAY
        // ===================================================
        if (flashScreen > 0) {
            ctx.save();
            ctx.globalAlpha = flashScreen * 0.45;
            ctx.fillStyle   = window.flashColor || "#FFFFFF";
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
