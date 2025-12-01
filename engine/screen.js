// screen.js
const GAME_WIDTH  = 1280;
const GAME_HEIGHT = 720;

function resizeGameCanvas() {
    const canvas = document.getElementById("game-canvas");
    if (!canvas) return;

    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // keep aspect ratio
    const scale = Math.min(ww / GAME_WIDTH, wh / GAME_HEIGHT);

    const displayWidth  = GAME_WIDTH  * scale;
    const displayHeight = GAME_HEIGHT * scale;

    canvas.style.width  = displayWidth  + "px";
    canvas.style.height = displayHeight + "px";

    canvas.style.left = ((ww - displayWidth) / 2) + "px";
    canvas.style.top  = ((wh - displayHeight) / 2) + "px";
}

window.addEventListener("load", resizeGameCanvas);
window.addEventListener("resize", resizeGameCanvas);
