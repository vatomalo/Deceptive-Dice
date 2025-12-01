// =======================================================
// WeatherFX.js — Sakura, Rain, Snow, Grass Foliage
// with smooth director targets
// =======================================================
console.log("WeatherFX.js loaded");

// Global weather state
window.Weather = {
    // feature toggles (auto-driven from targets)
    sakuraEnabled: true,
    rainEnabled:   true,
    snowEnabled:   false,
    grassEnabled:  false,

    // particle buffers
    petals: [],
    drops:  [],
    flakes: [],
    grass:  [],

    // target counts (preferred way: PaletteSystem / Director set these)
    targetPetals: 0,
    targetDrops:  0,
    targetFlakes: 0,
    targetGrass:  0,

    // legacy compat fields (updated internally)
    maxPetals: 0,
    maxDrops:  0,

    // smoothed float targets
    currentPetalTarget: 0,
    currentDropTarget:  0,
    currentFlakeTarget: 0,
    currentGrassTarget: 0,

    fadeSpeed: 0.02  // 0.02 = soft fade, 0.08 = snappy
};

// Short canvas helper (for spawning)
function getCanvas() {
    if (typeof canvas !== "undefined" && canvas) return canvas;
    return document.getElementById("game-canvas");
}


// =======================================================
// SAKURA PETAL PARTICLE — softer, more varied
// =======================================================
class WeatherSakuraPetal {
    constructor() {
        const c = getCanvas();
        const w = c ? c.width : 640;
        const h = c ? c.height : 360;

        this.x = Math.random() * w;
        this.y = -20 - Math.random() * 40;

        this.size    = 5 + Math.random() * 5;
        this.speedY  = 0.25 + Math.random() * 0.55;
        this.speedX  = -0.3  + Math.random() * 0.6;

        this.waveAmp = 4 + Math.random() * 4;
        this.waveFreq= 0.001 + Math.random() * 0.0015;
        this.t       = Math.random() * 1000;

        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.015;

        this.life    = 3500 + Math.random() * 2800;
        this.maxLife = this.life;

        // subtle color variation
        const shade = 200 + Math.floor(Math.random() * 40);
        this.color  = `rgb(255,${shade},${shade + 10})`;

        this.screenH = h;
    }

    update(dt) {
        this.life -= dt;
        this.t    += dt;

        this.x += this.speedX + Math.sin(this.t * this.waveFreq) * (this.waveAmp * 0.02);
        this.y += this.speedY;
        this.rotation += this.rotSpeed;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const t = this.life / this.maxLife;

        ctx.save();
        ctx.globalAlpha = t * 0.9;

        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.color;

        // two overlapped ellipses → petal shape
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size, this.size * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(-this.size * 0.25, -this.size * 0.15, this.size * 0.7, this.size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    get dead() {
        return this.life <= 0 || this.y > this.screenH + 40;
    }
}


// =======================================================
// PIXEL RAIN DROPLET — unchanged core, slightly tuned
// =======================================================
class WeatherRainDrop {
    constructor() {
        const c = getCanvas();
        const w = c ? c.width : 640;

        this.x = Math.random() * w;
        this.y = -10;

        this.len   = 4 + Math.random() * 4;
        this.speed = 3 + Math.random() * 4;

        this.color = Math.random() < 0.5
            ? "rgba(230,230,240,0.85)"
            : "rgba(255,255,255,0.9)";
    }

    update(dt) {
        this.y += this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.len);
        ctx.stroke();
        ctx.restore();
    }

    get dead() {
        const c = getCanvas();
        const h = c ? c.height : 360;
        return this.y > h + 10;
    }
}


// =======================================================
// SNOW FLAKE PARTICLE
// =======================================================
class WeatherSnowFlake {
    constructor() {
        const c = getCanvas();
        const w = c ? c.width : 640;
        const h = c ? c.height : 360;

        this.x = Math.random() * w;
        this.y = -10 - Math.random() * 30;

        this.radius  = 1.5 + Math.random() * 2.0;
        this.speedY  = 0.25 + Math.random() * 0.45;
        this.waveAmp = 6 + Math.random() * 6;
        this.waveFreq= 0.0008 + Math.random() * 0.0012;
        this.t       = Math.random() * 1000;

        this.life    = 5000 + Math.random() * 4000;
        this.maxLife = this.life;
        this.screenH = h;
    }

    update(dt) {
        this.life -= dt;
        this.t    += dt;

        this.y += this.speedY;
        this.x += Math.sin(this.t * this.waveFreq) * (this.waveAmp * 0.02);
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const t = this.life / this.maxLife;

        ctx.save();
        ctx.globalAlpha = 0.3 + 0.7 * t;
        ctx.fillStyle   = "rgb(245,245,255)";

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    get dead() {
        return this.life <= 0 || this.y > this.screenH + 20;
    }
}


// =======================================================
// GRASS FOLIAGE PARTICLE (near ground swaying)
// =======================================================
class WeatherGrassFoliage {
    constructor() {
        const c = getCanvas();
        const w = c ? c.width : 640;
        const h = c ? c.height : 360;

        this.xBase = Math.random() * w;
        this.y     = h - 38 + Math.random() * 10;    // near ground
        this.height= 6 + Math.random() * 6;
        this.width = 1 + Math.random() * 1.5;

        this.t        = Math.random() * 1000;
        this.waveFreq = 0.001 + Math.random() * 0.0015;
        this.waveAmp  = 2 + Math.random() * 3;

        this.color = Math.random() < 0.5
            ? "rgba(90, 150, 90, 0.85)"
            : "rgba(110, 175, 100, 0.9)";

        this.life    = 6000 + Math.random() * 6000;
        this.maxLife = this.life;
    }

    update(dt) {
        this.life -= dt;
        this.t    += dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const tNorm = this.life / this.maxLife;
        const offset = Math.sin(this.t * this.waveFreq) * this.waveAmp;

        ctx.save();
        ctx.globalAlpha = 0.4 + 0.6 * tNorm;
        ctx.strokeStyle = this.color;
        ctx.lineWidth   = this.width;

        ctx.beginPath();
        ctx.moveTo(this.xBase, this.y);
        ctx.lineTo(this.xBase + offset, this.y - this.height);
        ctx.stroke();

        ctx.restore();
    }

    get dead() {
        return this.life <= 0;
    }
}


// =======================================================
// UPDATE + DRAW
// =======================================================
window.updateWeatherFX = function(dt) {
    const c = getCanvas();
    if (!c) return;

    const f = Weather.fadeSpeed;

    // smooth targets
    Weather.currentPetalTarget += (Weather.targetPetals - Weather.currentPetalTarget) * f;
    Weather.currentDropTarget  += (Weather.targetDrops  - Weather.currentDropTarget)  * f;
    Weather.currentFlakeTarget += (Weather.targetFlakes - Weather.currentFlakeTarget) * f;
    Weather.currentGrassTarget += (Weather.targetGrass  - Weather.currentGrassTarget) * f;

    const maxPetals = Weather.currentPetalTarget | 0;
    const maxDrops  = Weather.currentDropTarget  | 0;
    const maxFlakes = Weather.currentFlakeTarget | 0;
    const maxGrass  = Weather.currentGrassTarget| 0;

    // keep legacy fields in sync for old code
    Weather.maxPetals = maxPetals;
    Weather.maxDrops  = maxDrops;

    // toggles
    Weather.sakuraEnabled = maxPetals > 0;
    Weather.rainEnabled   = maxDrops  > 0;
    Weather.snowEnabled   = maxFlakes > 0;
    Weather.grassEnabled  = maxGrass  > 0;

    // Maintain Sakura stream
    if (Weather.sakuraEnabled) {
        while (Weather.petals.length < maxPetals) {
            Weather.petals.push(new WeatherSakuraPetal());
        }
    }
    while (Weather.petals.length > maxPetals) {
        Weather.petals.pop();
    }

    // Maintain Rain sheet
    if (Weather.rainEnabled) {
        while (Weather.drops.length < maxDrops) {
            Weather.drops.push(new WeatherRainDrop());
        }
    }
    while (Weather.drops.length > maxDrops) {
        Weather.drops.pop();
    }

    // Maintain Snow
    if (Weather.snowEnabled) {
        while (Weather.flakes.length < maxFlakes) {
            Weather.flakes.push(new WeatherSnowFlake());
        }
    }
    while (Weather.flakes.length > maxFlakes) {
        Weather.flakes.pop();
    }

    // Maintain Grass foliage
    if (Weather.grassEnabled) {
        while (Weather.grass.length < maxGrass) {
            Weather.grass.push(new WeatherGrassFoliage());
        }
    }
    while (Weather.grass.length > maxGrass) {
        Weather.grass.pop();
    }

    // Update & cull all
    Weather.petals = Weather.petals.filter(p => { p.update(dt); return !p.dead; });
    Weather.drops  = Weather.drops.filter(d => { d.update(dt); return !d.dead; });
    Weather.flakes = Weather.flakes.filter(fx => { fx.update(dt); return !fx.dead; });
    Weather.grass  = Weather.grass.filter(g => { g.update(dt); return !g.dead; });
};

window.drawWeatherFX = function(ctx) {
    // Draw order: grass under characters, but you’re already drawing this last
    // So safest is: petals + snow + rain, grass last to sit on ground
    for (let p of Weather.petals) p.draw(ctx);
    for (let f of Weather.flakes) f.draw(ctx);
    for (let d of Weather.drops)  d.draw(ctx);
    for (let g of Weather.grass)  g.draw(ctx);
};


// =======================================================
// Weather Director — random moods wired to new targets
// =======================================================
console.log("Weather Director Loaded");

window.WeatherDirector = {
    active: false,
    timeout: null
};

// Weighted random helper
function pickWeatherMode() {
    // 0: clear
    // 1: light sakura
    // 2: heavy sakura
    // 3: light rain
    // 4: heavy rain
    // 5: sakura + rain
    // 6: light snow
    // 7: heavy snow
    // 8: grass breeze
    // 9: grass + petals (spring)
    const modes = [
        { mode: 0, weight: 3 },  // clear
        { mode: 1, weight: 3 },  // light sakura
        { mode: 2, weight: 2 },  // heavy sakura
        { mode: 3, weight: 3 },  // light rain
        { mode: 4, weight: 2 },  // heavy rain
        { mode: 5, weight: 1 },  // sakura + rain (rare)
        { mode: 6, weight: 2 },  // light snow
        { mode: 7, weight: 1 },  // heavy snow (rare)
        { mode: 8, weight: 2 },  // grass breeze
        { mode: 9, weight: 2 }   // grass + petals
    ];

    const totalWeight = modes.reduce((s, m) => s + m.weight, 0);
    let r = Math.random() * totalWeight;

    for (let m of modes) {
        if (r < m.weight) return m.mode;
        r -= m.weight;
    }
    return 0;
}

function applyWeatherMode(mode) {
    switch (mode) {
        case 0: // clear
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 0;
            break;

        case 1: // light sakura
            Weather.targetPetals = 14;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 6;
            break;

        case 2: // heavy sakura
            Weather.targetPetals = 36;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 10;
            break;

        case 3: // light rain
            Weather.targetPetals = 0;
            Weather.targetDrops  = 70;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 4;
            break;

        case 4: // heavy rain
            Weather.targetPetals = 0;
            Weather.targetDrops  = 130;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 0;
            break;

        case 5: // sakura + rain (dramatic)
            Weather.targetPetals = 24;
            Weather.targetDrops  = 90;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 8;
            break;

        case 6: // light snow
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 40;
            Weather.targetGrass  = 0;
            break;

        case 7: // heavy snow
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 90;
            Weather.targetGrass  = 0;
            break;

        case 8: // grass breeze
            Weather.targetPetals = 0;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 16;
            break;

        case 9: // spring wind: grass + petals
            Weather.targetPetals = 20;
            Weather.targetDrops  = 0;
            Weather.targetFlakes = 0;
            Weather.targetGrass  = 16;
            break;
    }
}

function pickDuration() {
    // 5–15 seconds, biased toward middle in practice
    return 5000 + Math.random() * 10000;
}

function runWeatherDirector() {
    if (!WeatherDirector.active) return;

    const mode = pickWeatherMode();
    applyWeatherMode(mode);

    const next = pickDuration();
    WeatherDirector.timeout = setTimeout(runWeatherDirector, next);
}

// Public API
window.startWeatherDirector = function () {
    WeatherDirector.active = true;
    runWeatherDirector();
};

window.stopWeatherDirector = function () {
    WeatherDirector.active = false;
    if (WeatherDirector.timeout)
        clearTimeout(WeatherDirector.timeout);
};