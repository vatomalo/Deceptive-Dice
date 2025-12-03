// =======================================================
// UI: NAMEPLATES + STATS + SMALL HUD ELEMENTS (GLOBAL)
// =======================================================
console.log("ui-nameplates.js loaded");

// -------------------------------------------------------
// ICONS: Katana (stance) + Heart (continues)
// -------------------------------------------------------
let katanaIcon      = null;
let katanaIconReady = false;

let heartIcon       = null;
let heartIconReady  = false;

(function initIcons() {
    katanaIcon = new Image();
    katanaIcon.onload = () => { katanaIconReady = true; };
    // same family as death FX katana
    katanaIcon.src = "./Artwork/FX/Katana.png";

    heartIcon = new Image();
    heartIcon.onload = () => { heartIconReady = true; };
    heartIcon.src = "./Artwork/UI/Heart.png"; // provide this; otherwise fallback squares are used
})();

// Helper: figure out stance key + color
function getStanceColor() {

    // Prefer the stance system if it exists
    let key = "fang";

    if (window.Stance && typeof Stance.current === "string") {
        key = Stance.current;
    } else if (typeof window.PlayerStance === "string") {
        key = window.PlayerStance;
    }

    // normalize possible keys
    if (key === "gale") key = "wind";

    switch (key) {
        case "balance":
        case "bal":
            return "rgba(210,210,210,0.95)"; // neutral/grey
        case "fang":
            return "rgba(220,60,60,0.95)";   // STR (red)
        case "wind":
            return "rgba(240,210,60,0.95)";  // AGI (yellow)
        case "aegis":
            return "rgba(70,140,255,0.95)";  // DEF (blue)
        default:
            return "rgba(220,60,60,0.95)";
    }
}

// -------------------------------------------------------
// Character NamePlate (Samurai + Enemy)
// -------------------------------------------------------
window.drawNamePlate = function(ctx, x, y, title, levelText) {

    const width  = 220;
    const height = 28;

    ctx.save();

    // background box
    ctx.globalAlpha = 0.40;
    ctx.fillStyle   = "black";
    ctx.fillRect(x, y, width, height);

    // border
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineWidth   = 2;
    ctx.strokeRect(x, y, width, height);

    ctx.globalAlpha = 1;

    // name/title
    ctx.font         = "18px pixel";
    ctx.textBaseline = "middle";
    ctx.textAlign    = "left";
    ctx.fillStyle    = "white";
    ctx.fillText(title, x + 5, y + height / 2);

    // level
    ctx.font      = "14px pixel";
    ctx.fillStyle = "#DDD";
    ctx.textAlign = "right";
    ctx.fillText(levelText, x + width - 8, y + height / 2);

    // ---------------------------------------------------
    // PLAYER-ONLY: stance katana under the name
    // Colored strip is drawn ON TOP of the katana
    // so it reads visually as the blade.
    // ---------------------------------------------------
    if (typeof canvas !== "undefined" && x < canvas.width * 0.5) {

        const stanceColor = getStanceColor();

        // katana placement inside plate
        const swordW = 80;
        const swordH = 6;
        const swordX = x + 8;
        const swordY = y + height - swordH - 3;

        // 1) draw katana sprite first
        if (katanaIconReady) {
            ctx.drawImage(
                katanaIcon,
                swordX,
                swordY - 1,      // tiny offset so it hugs the bottom
                swordW,
                swordH + 2
            );
        } else {
            // fallback: simple outline sword
            ctx.strokeStyle = "black";
            ctx.lineWidth   = 1;
            ctx.strokeRect(swordX, swordY, swordW, swordH);
        }

        // 2) draw the colored "blade" strip ON TOP of the katana
        // tuned so it sits exactly in the middle of the sprite
        const bladeH = 3;
        const bladeY = swordY + (swordH - bladeH) / 2;

        ctx.fillStyle   = stanceColor;
        ctx.globalAlpha = 0.95;
        ctx.fillRect(swordX + 2, bladeY, swordW - 4, bladeH);
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
};


// -------------------------------------------------------
// Thin neon stamina bar (shared UI element)
// + HEARTS drawn for the player bar only
// -------------------------------------------------------
window.drawStaminaBar = function(ctx, x, y, width, stamina) {

    const pct      = stamina.current / stamina.max;
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
    ctx.fillStyle   = "rgb(255,255,80)";
    ctx.fillRect(x, y, barWidth, 4);
    ctx.globalAlpha = 1;

    // ---------------------------------------------------
    // Player-only hearts: show next to the stamina bar
    // ---------------------------------------------------
    const isPlayerStamina =
        (typeof window.PlayerStamina !== "undefined" &&
         stamina === window.PlayerStamina);

    if (isPlayerStamina) {
        const hearts    = Math.max(0, Math.min(window.PlayerHearts || 0,
                                               window.MaxHearts || 3));
        const heartSize = 9;
        const heartGap  = 3;

        // start just to the right of the bar
        const startX = x + width + 8;
        const midY   = y + 2; // bar center (since bar height is 4)

        for (let i = 0; i < hearts; i++) {
            const hx = startX + i * (heartSize + heartGap);
            const hy = midY - heartSize / 2;

            if (heartIconReady) {
                ctx.drawImage(heartIcon, hx, hy, heartSize, heartSize);
            } else {
                ctx.fillStyle = "rgba(220,50,70,0.95)";
                ctx.fillRect(hx, hy, heartSize, heartSize);
                ctx.strokeStyle = "black";
                ctx.lineWidth   = 1;
                ctx.strokeRect(hx, hy, heartSize, heartSize);
            }
        }
    }

    ctx.restore();
};
