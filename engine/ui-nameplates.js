// =======================================================
// UI: NAMEPLATES + STATS + SMALL HUD ELEMENTS (GLOBAL)
// =======================================================
console.log("ui-nameplates.js loaded");

// -------------------------------------------------------
// Character NamePlate (Samurai + Enemy)
// -------------------------------------------------------
window.drawNamePlate = function(ctx, x, y, title, levelText) {

    const width = 220;
    const height = 28;

    ctx.save();

    // background box
    ctx.globalAlpha = 0.40;
    ctx.fillStyle = "black";
    ctx.fillRect(x, y, width, height);

    // border
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.globalAlpha = 1;

    // name/title
    ctx.font = "18px pixel";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = "white";
    ctx.fillText(title, x + 5, y + height / 2);

    // level
    ctx.font = "14px pixel";
    ctx.fillStyle = "#DDD";
    ctx.textAlign = "right";
    ctx.fillText(levelText, x + width - 8, y + height / 2);

    ctx.restore();
};

// -------------------------------------------------------
// Thin neon stamina bar (shared UI element)
// -------------------------------------------------------
window.drawStaminaBar = function(ctx, x, y, width, stamina) {

    const pct = stamina.current / stamina.max;
    const barWidth = Math.max(0, width * pct);

    // flicker when low
    let flicker = 1;
    if (stamina.current <= stamina.lowThreshold) {
        flicker = 0.7 + Math.sin(performance.now() * 0.01) * 0.3;
    }

    ctx.save();

    // background
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x, y, width, 4);

    // neon yellow foreground
    ctx.globalAlpha = flicker;
    ctx.fillStyle = "rgb(255,255,80)";
    ctx.fillRect(x, y, barWidth, 4);

    ctx.restore();
};
