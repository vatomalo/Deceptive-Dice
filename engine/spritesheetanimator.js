class SpriteSheetAnimator {
    constructor(src, frameCount = null, frameTime = 100, options = {}) {
        this.frameTime = frameTime;
        this.timer = 0;
        this.currentFrame = 0;

        this.options = options || {};
        this.depthCanvas = null; // for depth-map → alpha conversion

        if (Array.isArray(src)) {
            this.type = "list";
            this.srcList = src;
            this.frames = [];
            this.frameCount = src.length;

            this.loadedPromise = Promise.all(
                src.map(path => new Promise(resolve => {
                    const img = new Image();
                    img.onload  = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = path;
                }))
            ).then(images => {
                this.frames = images;

                // Core dimensions
                this.frameWidth  = images[0].width;
                this.frameHeight = images[0].height;

                // Aliases so other systems stop breaking
                this.frameW = this.frameWidth;
                this.frameH = this.frameHeight;

                return true;
            });

        } else {
            this.type = "sheet";
            this.src = src;
            this.img = new Image();
            this.frameCount = frameCount;

            this.loadedPromise = new Promise(resolve => {
                this.img.onload = () => {
                    this.frameWidth  = this.img.width / this.frameCount;
                    this.frameHeight = this.img.height;

                    // Aliases (for centering systems, dice, etc.)
                    this.frameW = this.frameWidth;
                    this.frameH = this.frameHeight;

                    // If this is a depth-map sheet, build an alpha-masked version once
                    if (this.options.depthMap) {
                        this._buildDepthMapSheet();
                    }

                    resolve(true);
                };
                this.img.onerror = () => resolve(false);
                this.img.src = src;
            });
        }

        if (!window.ASSET_PROMISES) window.ASSET_PROMISES = [];
        window.ASSET_PROMISES.push(this.loadedPromise);
    }

    // --------------------------------------------------
    // FUTURE-PROOF DIMENSION ALIASES
    // --------------------------------------------------
    getWidth() {
        return this.frameWidth;
    }

    getHeight() {
        return this.frameHeight;
    }

    getScaledW(scale = 1) {
        return this.frameWidth * scale;
    }

    getScaledH(scale = 1) {
        return this.frameHeight * scale;
    }

    // Backward compatibility getters
    get frameWAlias() { return this.frameWidth; }
    get frameHAlias() { return this.frameHeight; }


    // Turn white-on-black depth map into: white color + brightness as alpha
    _buildDepthMapSheet() {
        const c = document.createElement("canvas");
        c.width  = this.img.width;
        c.height = this.img.height;
        const cctx = c.getContext("2d");

        cctx.drawImage(this.img, 0, 0);
        const imgData = cctx.getImageData(0, 0, c.width, c.height);
        const d = imgData.data;

        // For each pixel: brightness => alpha, RGB = 255,255,255
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];

            const v = (r + g + b) / 3; // 0..255

            // black (v≈0) → alpha 0, white (v≈255) → alpha 255
            d[i]     = 255;
            d[i + 1] = 255;
            d[i + 2] = 255;
            d[i + 3] = v;
        }

        cctx.putImageData(imgData, 0, 0);
        this.depthCanvas = c;
    }

    clone() {
        if (this.type === "list")
            return new SpriteSheetAnimator(this.srcList, null, this.frameTime, this.options);
        else
            return new SpriteSheetAnimator(this.src, this.frameCount, this.frameTime, this.options);
    }

    update(delta) {
        this.timer += delta;
        if (this.timer >= this.frameTime) {
            this.timer = 0;
            this.currentFrame = (this.currentFrame + 1) % this.frameCount;
        }
    }

    /**
     * draw(ctx, x, y, scale = 1, tintColor = null)
     * - tintColor: e.g. "#ffffff" or "rgba(0,200,255,1)"
     */
    draw(ctx, x, y, scale = 1, tintColor = null) {
        if (this.type === "list") {
            const img = this.frames[this.currentFrame];
            if (!img) return;

            const w = img.width * scale;
            const h = img.height * scale;

            if (!tintColor) {
                ctx.drawImage(img, x, y, w, h);
            } else {
                ctx.save();
                ctx.drawImage(img, x, y, w, h);
                ctx.globalCompositeOperation = "source-in";
                ctx.fillStyle = tintColor;
                ctx.fillRect(x, y, w, h);
                ctx.restore();
            }

        } else {
            if (!this.frameWidth) return;

            const sx = this.currentFrame * this.frameWidth;
            const sy = 0;
            const sw = this.frameWidth;
            const sh = this.frameHeight;
            const dw = sw * scale;
            const dh = sh * scale;

            const img = (this.options.depthMap && this.depthCanvas)
                ? this.depthCanvas
                : this.img;

            if (!tintColor) {
                ctx.drawImage(img, sx, sy, sw, sh, x, y, dw, dh);
            } else {
                ctx.save();
                ctx.drawImage(img, sx, sy, sw, sh, x, y, dw, dh);
                ctx.globalCompositeOperation = "source-in";
                ctx.fillStyle = tintColor;
                ctx.fillRect(x, y, dw, dh);
                ctx.restore();
            }
        }
    }
}

window.SpriteSheetAnimator = SpriteSheetAnimator;
