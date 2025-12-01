console.log("ParallaxBG LOADED");

// ==========================================================
// PARALLAX SYSTEM WITH DECORATION LAYERS
// ==========================================================
class ParallaxBG {
    constructor(stageName = "default_stage") {
        this.x = 0;
        this.layers = [];
        this.decors = [];

        this.stageName = stageName;
        this.ready = false;

        this._loadConfig();
    }

    // ======================================================
    // LOAD CONFIG FROM JSON
    // ======================================================
    async _loadConfig() {
        try {
            const res = await fetch("Artwork/BG/parallax.json");
            const data = await res.json();

            const stage = data[this.stageName];
            if (!stage) {
                console.error("Stage not found in parallax.json:", this.stageName);
                return;
            }

            // --------------------------------------------
            // LOAD BACKGROUND LAYERS (Sky, Clouds, etc)
            // --------------------------------------------
            this.layers = await Promise.all(
                stage.layers.map(layer => this._loadLayer(layer))
            );

            // --------------------------------------------
            // LOAD DECORATION LAYERS (plants, rocks, grass)
            // --------------------------------------------
            if (stage.decor) {
                this.decors = await Promise.all(
                    stage.decor.map(deco => this._loadDeco(deco))
                );
            }

            console.log("%cParallax stage loaded: " + this.stageName, "color: cyan");
            this.ready = true;

        } catch (err) {
            console.error("Failed to load parallax config:", err);
        }
    }

    // ======================================================
    // HELPERS TO LOAD LAYERS
    // ======================================================
    _loadLayer(layer) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    img,
                    speed: layer.static ? 0 : layer.speed,
                    static: layer.static
                });
            };
            img.src = layer.src;
        });
    }

    _loadDeco(deco) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                resolve({
                    img,
                    speed: deco.speed,
                    yOffset: deco.yOffset || 0
                });
            };
            img.src = deco.src;
        });
    }


    // ======================================================
    // UPDATE SCROLLING
    // ======================================================
    update(delta) {
        if (!this.ready) return;
        this.x += delta;
    }


    // ======================================================
    // DRAW SYSTEM
    // ======================================================
    draw(ctx) {
        if (!this.ready) return;

        const w = ctx.canvas.width;
        const h = ctx.canvas.height;

        // --------------------------------------------
        // Draw full background layers
        // --------------------------------------------
        for (let layer of this.layers) {
            if (layer.static) {
                ctx.drawImage(layer.img, 0, 0, w, h);
            } else {
                let scrollX = -(this.x * layer.speed) % w;
                ctx.drawImage(layer.img, scrollX, 0, w, h);
                ctx.drawImage(layer.img, scrollX + w, 0, w, h);
            }
        }

        // --------------------------------------------
        // Draw decoration layers — small, pixel art
        // --------------------------------------------
        for (let deco of this.decors) {
            let scrollX = -(this.x * deco.speed) % deco.img.width;

            // tile infinitely
            for (let x = scrollX; x < w; x += deco.img.width) {
                ctx.drawImage(
                    deco.img,
                    x,
                    h - deco.img.height - deco.yOffset
                );
            }
        }
    }
}

// Make ParallaxBG available globally
window.ParallaxBG = ParallaxBG;
