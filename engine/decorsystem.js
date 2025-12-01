console.log("ForegroundDecor LOADED");

// Decor system with separate BACK and FRONT buffers
class Decor {
    constructor(stage = "default_stage") {
        this.stage = stage;

        this.items      = [];   // all items
        this.backItems  = [];   // behind characters
        this.frontItems = [];   // in front of characters

        this.readyBack  = false;
        this.readyFront = false;

        this.backBuffer  = null;
        this.frontBuffer = null;

        this._load();
    }

    async _load() {
        try {
            const res  = await fetch("Artwork/BG/decor.json");
            const data = await res.json();

            const stageItems = data[this.stage];
            if (!stageItems || !Array.isArray(stageItems)) {
                console.warn("Decor: No items for stage", this.stage);
                return;
            }

            // Load all images
            this.items = await Promise.all(
                stageItems.map(item => this._loadItem(item))
            );

            // Split into back / front sets
            this.backItems  = this.items.filter(i => i.z !== "front");
            this.frontItems = this.items.filter(i => i.z === "front");

            this._buildBuffers();

        } catch (err) {
            console.error("Decor load error:", err);
        }
    }

    _loadItem(item) {
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () =>
                resolve({
                    img: img,
                    x: item.x,
                    y: item.y,
                    scale: item.scale || 1,
                    z: item.z || "back"   // default to back layer
                });
            img.src = item.src;
        });
    }

    _buildBuffers() {
        const canvas = document.getElementById("game-canvas");
        if (!canvas) {
            console.error("Decor: game-canvas not found");
            return;
        }

        // BACK BUFFER (behind characters)
        this.backBuffer = document.createElement("canvas");
        this.backBuffer.width  = canvas.width;
        this.backBuffer.height = canvas.height;

        let bctx = this.backBuffer.getContext("2d");
        bctx.imageSmoothingEnabled = false;

        for (let item of this.backItems) {
            const w = item.img.width * item.scale;
            const h = item.img.height * item.scale;
            const drawY = item.y - h;
            bctx.drawImage(item.img, item.x, drawY, w, h);
        }
        this.readyBack = true;

        // FRONT BUFFER (in front of characters, under UI)
        this.frontBuffer = document.createElement("canvas");
        this.frontBuffer.width  = canvas.width;
        this.frontBuffer.height = canvas.height;

        let fctx = this.frontBuffer.getContext("2d");
        fctx.imageSmoothingEnabled = false;

        for (let item of this.frontItems) {
            const w = item.img.width * item.scale;
            const h = item.img.height * item.scale;
            const drawY = item.y - h;
            fctx.drawImage(item.img, item.x, drawY, w, h);
        }
        this.readyFront = true;

        console.log("Decor buffers built (back + front)");
    }

    // Old behaviour: draw everything as one (for compatibility)
    draw(ctx) {
        this.drawBack(ctx);
        this.drawFront(ctx);
    }

    // Draw behind characters
    drawBack(ctx) {
        if (this.readyBack && this.backBuffer) {
            ctx.drawImage(this.backBuffer, 0, 0);
        }
    }

    // Draw in front of characters (under UI)
    drawFront(ctx) {
        if (this.readyFront && this.frontBuffer) {
            ctx.drawImage(this.frontBuffer, 0, 0);
        }
    }
}

window.Decor = Decor;
