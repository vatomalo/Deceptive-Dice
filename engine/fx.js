// =======================================================
// FX SYSTEM — Samurai Edition + Dice Smoke + Grass Foliage
// =======================================================
console.log("FX system loaded (Samurai + Grass Edition)");

/* =======================================================
   SPRITE → ALPHA (for slash / angel)
   =======================================================*/
function convertToAlpha(img) {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");

    ctx.drawImage(img, 0, 0);
    const dt = ctx.getImageData(0, 0, c.width, c.height);
    const d  = dt.data;

    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let alpha = (r + g + b) / 3 / 255;
        alpha = Math.pow(alpha, 0.75);

        d[i] = d[i + 1] = d[i + 2] = 255;
        d[i + 3] = alpha * 255;
    }

    ctx.putImageData(dt, 0, 0);
    return c;
}


/* =======================================================
   STATIC FX WRAPPER
   =======================================================*/
class FXStatic {
    constructor(img, x, y, scale = 1, flip = false, duration = 120) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.flip = flip;
        this.timer = duration;
        this.done = false;
    }

    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) this.done = true;
    }

    draw(ctx) {
        if (!this.img._loaded) return;
        const src = this.img._alphaCanvas;

        const w = src.width * this.scale;
        const h = src.height * this.scale;

        ctx.save();

        if (this.flip) {
            ctx.translate(this.x + w, this.y);
            ctx.scale(-1, 1);
            ctx.drawImage(src, 0, 0, w, h);
        } else {
            ctx.drawImage(src, this.x, this.y, w, h);
        }

        ctx.restore();
    }
}


/* =======================================================
   SINGLE-FRAME SLASH
   =======================================================*/
(function () {
    const slash = new Image();
    slash.src = "Artwork/FX/pack/slash_03.png";
    slash._loaded = false;

    slash.onload = () => {
        slash._alphaCanvas = convertToAlpha(slash);
        slash._loaded = true;
    };

    window.FX_SLASH = slash;
})();

// LOCAL FX CLASSES (Katana spin + blood) – pushed into fxManager
// =======================================================

// Katana image (prop) – stored in Artwork/FX/katana.png
const KATANA_IMG = new Image();
KATANA_IMG.src   = "Artwork/FX/katana.png";

class KatanaSpinFX {
    constructor(x, y) {
        this.x   = x;
        this.y   = y;
        this.vy  = -5;
        this.rot = 0;
        this.vrot = 0.35;
        this.life = 900;   // ms
    }

    update(dt) {
        this.life -= dt;
        this.vy   += 0.25;
        this.y    += this.vy * (dt / 16);
        this.rot  += this.vrot;
    }

    draw(ctx) {
        if (!KATANA_IMG.complete) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);

        const w = KATANA_IMG.width;
        const h = KATANA_IMG.height;
        ctx.drawImage(KATANA_IMG, -w / 2, -h / 2);

        ctx.restore();
    }

    get dead() {
        return this.life <= 0;
    }
}

class BloodParticleFX {
    constructor(x, y) {
        this.x = x;
        this.y = y;

        this.vx = (Math.random() * 2 - 1) * 2.2;
        this.vy = -3 + Math.random() * 2;

        this.life = 600 + Math.random() * 400;
        this.max  = this.life;
    }

    update(dt) {
        this.life -= dt;
        this.vy   += 0.16;
        this.x    += this.vx;
        this.y    += this.vy;
    }

    draw(ctx) {
        const t = this.life / this.max;
        if (t <= 0) return;

        ctx.save();
        ctx.globalAlpha = t;
        ctx.fillStyle   = "rgb(180,0,0)";
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.restore();
    }

    get dead() {
        return this.life <= 0;
    }
}

// Small helpers
function spawnKatanaFX(x, y) {
    if (!window.fxManager || !fxManager.list) return;
    fxManager.list.push(new KatanaSpinFX(x, y));
}

function spawnBloodFX(x, y, count = 18) {
    if (!window.fxManager || !fxManager.list) return;
    for (let i = 0; i < count; i++) {
        fxManager.list.push(new BloodParticleFX(x, y));
    }
}

/* =======================================================
   RADIAL PARTICLE (smoke, dust, pass)
   =======================================================*/
class RadialParticle {
    constructor(x, y, size, life, tint, drift = 0.2) {
        this.x = x + (Math.random() * 4 - 2);
        this.y = y + (Math.random() * 4 - 2);

        this.size = size;
        this.life = life;
        this.max  = life;

        this.vx = (Math.random() * drift - drift / 2);
        this.vy = -0.07 + Math.random() * 0.14;

        this.rot      = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.02;

        this.tint = tint;
    }

    update(dt) {
        this.life -= dt;
        this.x    += this.vx;
        this.y    += this.vy;
        this.rot  += this.rotSpeed;
    }

    draw(ctx) {
        if (this.life <= 0) return;

        const t     = this.life / this.max;
        const alpha = t * 0.85;  // heavier opacity

        ctx.save();
        ctx.globalAlpha = alpha;

        const r = this.size * (0.7 + 0.3 * t);

        const g = ctx.createRadialGradient(
            this.x, this.y, 0,
            this.x, this.y, r
        );

        g.addColorStop(0, this.tint.replace("ALPHA", "1"));
        g.addColorStop(1, this.tint.replace("ALPHA", "0"));

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    get dead() { return this.life <= 0; }
}


/* =======================================================
   DICE SMOKE — Dense, covers dice
   =======================================================*/
window.DiceSmoke = {
    particles: [],
    emitting:  false,
    timer:     0,
    lastX:     0,
    lastY:     0,

    start() {
        this.emitting = true;
        this.particles.length = 0;
        this.timer = 0;
    },

    stop() {
        this.emitting = false;
        this.particles.length = 0;
    },

    // dice.x / dice.y are already centered in dice.js
    getDiceCenter(d) {
        return {
            x: d.x || 0,
            y: d.y || 0
        };
    },

    drip(d, dt) {
        if (!this.emitting) return;
        if (!d || d.state !== "rolling") return;

        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = 60;  // spawn every ~60ms while rolling

        const { x, y } = this.getDiceCenter(d);
        this.lastX = x;
        this.lastY = y;

        // slightly bigger + more particles for heavy coverage
        for (let i = 0; i < 5; i++) {
            this.particles.push(
                new RadialParticle(
                    x,
                    y,
                    52 + Math.random() * 10,
                    520 + Math.random() * 80,
                    "rgba(180,180,180,ALPHA)"
                )
            );
        }
    },

    burst(d) {
        if (!this.emitting) return;
        if (!d) return;

        const { x, y } = this.getDiceCenter(d);
        this.lastX = x;
        this.lastY = y;

        for (let i = 0; i < 14; i++) {
            this.particles.push(
                new RadialParticle(
                    x,
                    y,
                    58 + Math.random() * 10,
                    560 + Math.random() * 80,
                    "rgba(180,180,180,ALPHA)"
                )
            );
        }
    },

    maintainDensity() {
        if (!this.emitting) return;
        while (this.particles.length < 42) {
            this.particles.push(
                new RadialParticle(
                    this.lastX,
                    this.lastY,
                    40 + Math.random() * 8,
                    500 + Math.random() * 80,
                    "rgba(180,180,180,ALPHA)"
                )
            );
        }
    },

    update(dt) {
        this.particles = this.particles.filter(p => {
            p.update(dt);
            return !p.dead;
        });
        this.maintainDensity();
    },

    draw(ctx) {
        if (!this.particles.length) return;
        ctx.save();
        for (let p of this.particles) {
            p.draw(ctx);
        }
        ctx.restore();
    }
};


/* =======================================================
   DUST FX (running)
   =======================================================*/
class DustParticle extends RadialParticle {
    constructor(actor) {
        super(
            actor.x,
            actor.y + 14,
            14 + Math.random() * 8,
            180,
            "rgba(140,100,60,ALPHA)",
            0.18
        );
    }
}


/* =======================================================
   ANGEL SPARK
   =======================================================*/
class AngelSpark {
    constructor(x, y) {
        this.cx  = x;
        this.cy  = y;
        this.life = 300;
        this.max  = 300;

        this.s = [];
        for (let i = 0; i < 14; i++) {
            this.s.push({
                angle:  Math.random() * Math.PI * 2,
                radius: 15 + Math.random() * 10,
                speed:  0.05 + Math.random() * 0.05,
                size:   3 + Math.random() * 2,
                flick:  0.8 + Math.random() * 0.2
            });
        }
    }

    update(dt) {
        this.life -= dt;
        for (let sp of this.s) {
            sp.angle += sp.speed * (dt / 16);
        }
    }

    draw(ctx) {
        if (this.life <= 0) return;
        const t = this.life / this.max;

        ctx.save();
        for (let sp of this.s) {
            const x = this.cx + Math.cos(sp.angle) * sp.radius;
            const y = this.cy - 40 + Math.sin(sp.angle) * sp.radius;

            ctx.globalAlpha = t * sp.flick;
            ctx.fillStyle   = "rgba(255,240,160,1)";
            ctx.beginPath();
            ctx.arc(x, y, sp.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    get dead() { return this.life <= 0; }
}


/* =======================================================
   SAKURA LEAF PARTICLE (optional stream in FXManager)
   =======================================================*/
class SakuraLeaf {
    constructor(canvasW, canvasH) {
        this.x = Math.random() * canvasW;
        this.y = -20;

        const colors = [
            "rgba(255,180,210,ALPHA)",
            "rgba(255,160,190,ALPHA)",
            "rgba(255,200,220,ALPHA)"
        ];
        this.tint = colors[Math.floor(Math.random() * colors.length)];

        this.size = 6 + Math.random() * 4;

        this.vx = -0.4 + Math.random() * 0.8;
        this.vy =  0.6 + Math.random() * 0.4;

        this.rot      = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.05;

        this.alpha   = 1;
        this.canvasH = canvasH;
    }

    update(dt) {
        this.x   += this.vx;
        this.y   += this.vy;
        this.rot += this.rotSpeed;

        if (this.y > this.canvasH - 50) {
            this.alpha -= 0.02;
        }
    }

    draw(ctx) {
        if (this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;

        ctx.translate(this.x, this.y);
        ctx.rotate(this.rot);

        ctx.fillStyle = this.tint.replace("ALPHA", "0.75");

        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    get dead() {
        return this.alpha <= 0;
    }
}


/* =======================================================
   RAIN PARTICLE (optional stream in FXManager)
   =======================================================*/
class RainDrop {
    constructor(canvasW, canvasH) {
        this.x = Math.random() * canvasW;
        this.y = Math.random() * -canvasH;

        this.len   = 6 + Math.random() * 10;
        this.speed = 4 + Math.random() * 3;

        this.gray    = Math.random() > 0.5;
        this.canvasH = canvasH;
    }

    update(dt) {
        this.y += this.speed * (dt / 16);
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = this.gray
            ? "rgba(200,200,200,0.8)"
            : "rgba(255,255,255,0.9)";
        ctx.lineWidth = 1;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x, this.y + this.len);
        ctx.stroke();
    }

    get dead() {
        return this.y > this.canvasH + 20;
    }
}


/* =======================================================
   ALWAYS-ON GRASS FOLIAGE (ground-level sway)
   =======================================================*/
class GrassBlade {
    constructor(w, h) {
        this.baseX   = Math.random() * w;
        this.baseY   = h - 38 + Math.random() * 10;   // near ground
        this.height  = 6 + Math.random() * 6;
        this.width   = 1 + Math.random() * 1.5;

        this.t        = Math.random() * 1000;
        this.waveFreq = 0.001 + Math.random() * 0.0015;
        this.waveAmp  = 2 + Math.random() * 3;

        this.color = Math.random() < 0.5
            ? "rgba(90, 150, 90, ALPHA)"
            : "rgba(110, 175, 100, ALPHA)";
    }

    update(dt) {
        this.t += dt;
    }

    draw(ctx) {
        const offset = Math.sin(this.t * this.waveFreq) * this.waveAmp;

        // Base alpha
        let alpha = 0.55;

        // If WeatherFX snow is active, dim grass a bit (snow cover feel)
        if (window.Weather && Weather.snowEnabled) {
            alpha *= 0.4;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.color.replace("ALPHA", "1");
        ctx.lineWidth   = this.width;

        ctx.beginPath();
        ctx.moveTo(this.baseX, this.baseY);
        ctx.lineTo(this.baseX + offset, this.baseY - this.height);
        ctx.stroke();

        ctx.restore();
    }
}


/* =======================================================
   GENERIC FX WRAPPER (sprite alpha) — for slash etc.
   =======================================================*/
class FX {
    constructor(img, x, y, scale = 1, flip = false, speed = 60) {
        this.img   = img;
        this.x     = x;
        this.y     = y;
        this.scale = scale;
        this.flip  = flip;

        this.frame = 0;
        this.timer = 0;
        this.speed = speed;

        this.done = false;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.speed) {
            this.done = true;
        }
    }

    draw(ctx) {
        if (!this.img._loaded) return;
        const src = this.img._alphaCanvas;

        const w = src.width * this.scale;
        const h = src.height * this.scale;

        ctx.save();
        if (this.flip) {
            ctx.translate(this.x + w, this.y);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(src, this.x, this.y, w, h);
        ctx.restore();
    }
}


/* =======================================================
   FX MANAGER — ALL EFFECTS + Grass + optional Sakura/Rain
   =======================================================*/
class FXManager {

    constructor() {
        this.list   = [];   // radial + sprite FX
        this.sakura = [];
        this.rain   = [];
        this.grass  = [];

        this.canvasW = 0;
        this.canvasH = 0;

        this.sakuraTarget = 0;
        this.rainTarget   = 0;

        // Cache canvas size if available
        const c = window.canvas || document.getElementById("game-canvas");
        if (c) {
            this.canvasW = c.width;
            this.canvasH = c.height;
        }

        // Always-on grass foliage
        if (this.canvasW && this.canvasH) {
            const DENSITY = 22;  // tweak for more/less grass
            for (let i = 0; i < DENSITY; i++) {
                this.grass.push(new GrassBlade(this.canvasW, this.canvasH));
            }
        }
    }


    // ---------- Sprite / radial FX ----------
    spawn(imgs, x, y, scale = 1, flip = false, speed = 60) {
        this.list.push(new FX(imgs, x, y, scale, flip, speed));
    }

    spawnDust(actor) {
        this.list.push(new DustParticle(actor));
    }

    spawnPassSmoke(x, y) {
        for (let i = 0; i < 8; i++) {
            this.list.push(
                new RadialParticle(
                    x + (Math.random() * 30 - 15),
                    y - 60 + (Math.random() * 20 - 10),
                    80 + Math.random() * 30,
                    420 + Math.random() * 120,
                    "rgba(200,200,200,ALPHA)",
                    0.25
                )
            );
        }
    }

    spawnAngelSpark(x, y) {
        this.list.push(new AngelSpark(x, y));
    }


    // ---------- Optional Sakura / Rain streams ----------
    enableSakura(canvasW, canvasH, density = 20) {
        this.canvasW = canvasW;
        this.canvasH = canvasH;
        this.sakuraTarget = density;

        this.sakura.length = 0;
        for (let i = 0; i < density; i++) {
            this.sakura.push(new SakuraLeaf(canvasW, canvasH));
        }
    }

    enableRain(canvasW, canvasH, density = 100) {
        this.canvasW = canvasW;
        this.canvasH = canvasH;
        this.rainTarget = density;

        this.rain.length = 0;
        for (let i = 0; i < density; i++) {
            this.rain.push(new RainDrop(canvasW, canvasH));
        }
    }


    update(dt) {

        // sprite + radial FX
        this.list = this.list.filter(f => {
            if (f.dead === true) return false;
            if (f.done === true) return false;
            if (f.life !== undefined && f.life <= 0) return false;
            f.update(dt);
            return true;
        });

        // grass — always on, just sway
        for (let g of this.grass) {
            g.update(dt);
        }

        // maintain Sakura / Rain streams if used
        if (this.canvasW && this.canvasH) {

            while (this.sakura.length < this.sakuraTarget) {
                this.sakura.push(new SakuraLeaf(this.canvasW, this.canvasH));
            }
            this.sakura = this.sakura.filter(s => {
                s.update(dt);
                return !s.dead;
            });

            while (this.rain.length < this.rainTarget) {
                this.rain.push(new RainDrop(this.canvasW, this.canvasH));
            }
            this.rain = this.rain.filter(r => {
                r.update(dt);
                return !r.dead;
            });
        }
    }


    draw(ctx) {
        // Grass first so it sits closest to the ground layer
        for (let g of this.grass) {
            g.draw(ctx);
        }

        // normal FX (smoke, slash, dust, angel, etc.)
        for (let f of this.list) {
            f.draw(ctx);
        }

        // sakura leaves above foreground
        for (let s of this.sakura) {
            s.draw(ctx);
        }

        // rain OVER everything for drama
        for (let r of this.rain) {
            r.draw(ctx);
        }
    }
}


// global
window.FXManager = FXManager;
