// =============================
// GAME BASE RESOLUTION
// =============================
const GAME_WIDTH  = 1280;
const GAME_HEIGHT = 720;

// Will be updated on resize
window.gameScale = 1;

// Optional: if you need canvas rect often
window.gameCanvasRect = null;

function resizeGameCanvas() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // Scale to fit window while keeping aspect ratio
    const scale = Math.min(ww / GAME_WIDTH, wh / GAME_HEIGHT);

    const displayWidth  = GAME_WIDTH  * scale;
    const displayHeight = GAME_HEIGHT * scale;

    canvas.style.width  = displayWidth  + "px";
    canvas.style.height = displayHeight + "px";

    canvas.style.left = ((ww - displayWidth) / 2) + "px";
    canvas.style.top  = ((wh - displayHeight) / 2) + "px";

    window.gameScale = scale;
    window.gameCanvasRect = canvas.getBoundingClientRect();
}

// Call once on load and whenever window resizes
window.addEventListener("load", resizeGameCanvas);
window.addEventListener("resize", resizeGameCanvas);

function getGameCoords(evt) {
    const canvas = document.getElementById("game-canvas");
    const rect = canvas.getBoundingClientRect();

    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;

    const x = (clientX - rect.left) * (canvas.width  / rect.width);
    const y = (clientY - rect.top)  * (canvas.height / rect.height);

    return { x, y };
}

