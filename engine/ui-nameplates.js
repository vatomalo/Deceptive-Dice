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
    // same sprite used by KatanaSpinFX
    katanaIcon.src = "./Artwork/FX/Katana.png";

    heartIcon = new Image();
    heartIcon.onload = () => { heartIconReady = true; };
    heartIcon.src = "./Artwork/UI/Heart.png";
})();

// -------------------------------------------------------
// STANCE COLOR + LABEL
// -------------------------------------------------------
function getStanceColor() {
    let key = "balance";

    if (window.Stance && typeof Stance.current === "string") {
        key = Stance.current;
    } else if (typeof window.PlayerStance === "string") {
        key = window.PlayerStance;
    }

    key = String(key || "").toLowerCase();
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

function getStanceLabel() {
    if (window.Stance && typeof Stance.getLabel === "function") {
        const lbl = Stance.getLabel();
        if (lbl) return String(lbl).toUpperCase();
    }
    return "BAL";
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
    // Blade = neutral grey bar     (stance indicator)
    // Hilt  = cropped katana hilt  (colored)
    // ---------------------------------------------------
    if (typeof canvas !== "undefined" && x < canvas.width * 0.5) {

        const stanceColor = getStanceColor();
        const stanceLabel = getStanceLabel();

        // Blade placement
        const bladeW = 140;
        const bladeH = 4;
        const bladeX = x + 26;                 // room for hilt
        const bladeY = y + height - bladeH - 4;

        // 1) Blade: neutral grey bar
        ctx.fillStyle = "rgba(230,230,230,0.96)";
        ctx.fillRect(bladeX, bladeY, bladeW, bladeH);

        // 2) Hilt: cropped right-sword hilt from Katana.png,
        //    rotated 90° clockwise so blade lies horizontally.
        const hiltDrawW = 6;   // on-screen size
        const hiltDrawH = 38;
        const hiltCx    = bladeX - hiltDrawW * 0.45; // center of hilt
        const hiltCy    = bladeY + bladeH / 2;

        if (katanaIconReady && katanaIcon.width > 0 && katanaIcon.height > 0) {

            // Exact crop for hilt (guard + handle) in 64x64 Katana.png
            const HILT_SRC_X = 33;
            const HILT_SRC_Y = 34;
            const HILT_SRC_W = 4;
            const HILT_SRC_H = 15;

            ctx.save();
            // move to hilt center
            ctx.translate(hiltCx, hiltCy);
            // rotate 90° clockwise
            ctx.rotate(Math.PI / 2);

            // draw cropped hilt centered at (0,0)
            ctx.drawImage(
                katanaIcon,
                HILT_SRC_X, HILT_SRC_Y,
                HILT_SRC_W, HILT_SRC_H,
                -hiltDrawW / 2, -hiltDrawH / 2,
                hiltDrawW, hiltDrawH
            );

            // tint with stance color, keep translucency
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = stanceColor;
            ctx.globalAlpha = 0.85;
            ctx.fillRect(-hiltDrawW / 2, -hiltDrawH / 2, hiltDrawW, hiltDrawH);

            ctx.restore();
        } else {
            // fallback: simple colored block if icon not loaded
            ctx.fillStyle = stanceColor;
            ctx.fillRect(
                bladeX - hiltDrawW * 0.7,
                bladeY - (hiltDrawH - bladeH) / 2,
                hiltDrawW,
                hiltDrawH
            );
        }

        // 3) Stance label centered under the blade
        ctx.font         = "10px pixelUI";
        ctx.fillStyle    = "rgba(240,240,240,0.97)";
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";

        const textX = bladeX + bladeW / 2;
        const textY = bladeY + bladeH + 2;

        ctx.fillText(stanceLabel, textX, textY);
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
