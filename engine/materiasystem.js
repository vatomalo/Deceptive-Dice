// =======================================================
// banter.js — Dynamic Manga Panel Banter System (JSON)
//  + auto text-resize so long lines fit in panels
//  + Materia notifier (icons + stacks + arrows → target)
// =======================================================
console.log("banter.js loaded");

(function() {

    class BanterMessage {
        // Slightly longer default duration
        constructor(text, side, duration = 2800) {
            this.text = text;
            this.side = side;
            this.duration = duration;
            this.timer = 0;
        }

        get alive() {
            return this.timer < this.duration;
        }

        get alpha() {
            const t = this.timer / this.duration;
            if (t < 0.7) return 1;
            return Math.max(0, 1 - (t - 0.7) / 0.3);
        }
    }

    const Banter = {
        messages: [],
        lines: null,
        ready: false,

        load() {
            fetch("Data/banter.json")
                .then(res => res.json())
                .then(json => {
                    this.lines = json;
                    this.ready = true;
                    console.log("Banter JSON loaded");
                })
                .catch(err => console.error("Banter JSON load failed:", err));
        },

        hasMessages() {
            return this.messages.some(m => m.alive);
        },

        push(text, side = "left", duration) {
            if (!text) return;

            // One message per side at a time
            this.messages = this.messages.filter(m => m.side !== side);

            const msg = new BanterMessage(text, side, duration);
            this.messages.push(msg);
        },

        // Get a list of lines: actor = samurai | knight
        findLines(actor, category, enemyName = null) {
            if (!this.ready || !this.lines) return null;

            const root = this.lines[actor];
            if (!root) return null;

            // Samurai only has categories
            if (actor === "samurai") {
                return root[category] || null;
            }

            // Knights:

            // 1) Match enemy by name if exists
            if (enemyName && root[enemyName] && root[enemyName][category]) {
                return root[enemyName][category];
            }

            // 2) fallback to generic
            if (root.generic && root.generic[category]) {
                return root.generic[category];
            }

            return null;
        },

        say(actor, category, enemyName = null) {
            const list = this.findLines(actor, category, enemyName);
            if (!list || !list.length) return;

            const pick = list[Math.floor(Math.random() * list.length)];

            const side =
                actor === "samurai" ? "left" :
                actor === "knight"  ? "right" :
                "center";

            this.push(pick, side);
        },

        update(dt) {
            this.messages = this.messages.filter(m => {
                m.timer += dt;
                return m.alive;
            });
        },

        draw(ctx, canvas) {
            if (!this.messages.length) return;

            ctx.save();
            ctx.textBaseline = "middle";

            const baseFontSize = 18;
            const minFontSize  = 10;

            const panelH   = 48;
            const marginY  = 72;
            const padX     = 12;
            const padY     = 10;

            // Max width so left/right panels don't crash into each other
            const maxPanelW = 220;

            for (const msg of this.messages) {
                if (!msg.alive) continue;

                const alpha = msg.alpha;
                ctx.globalAlpha = alpha;

                // --- AUTO FONT RESIZE PER MESSAGE -----------------
                let fontSize = baseFontSize;
                let panelW   = maxPanelW;

                // Shrink font until text fits inside fixed panel width
                while (true) {
                    ctx.font = `${fontSize}px pixel`;
                    const textWidth = ctx.measureText(msg.text).width;
                    const needed = textWidth + padX * 2;

                    if (needed <= panelW || fontSize <= minFontSize) {
                        break;
                    }
                    fontSize -= 1;
                }

                // Measure once more with final font
                ctx.font = `${fontSize}px pixel`;
                const textWidth = ctx.measureText(msg.text).width;
                panelW = Math.max(180, Math.min(maxPanelW, textWidth + padX * 2));

                let x;
                if (msg.side === "left")       x = 24;
                else if (msg.side === "right") x = canvas.width - panelW - 24;
                else                           x = (canvas.width - panelW) / 2;

                const y = marginY;

                // panel fill
                ctx.fillStyle = "rgba(255,255,255,0.95)";
                ctx.fillRect(x, y, panelW, panelH);

                // border
                ctx.lineWidth = 3;
                ctx.strokeStyle = "black";
                ctx.strokeRect(x, y, panelW, panelH);

                // text
                ctx.fillStyle = "black";
                ctx.textAlign = "center";
                ctx.fillText(msg.text, x + panelW / 2, y + panelH / 2 + 1);
            }

            ctx.restore();
        }
    };

    // =======================================================
    // MATERIA NOTIFIER — icons + stacks + arrows → target
    // target: "player" or "enemy"
    // type  : "poison" | "regen" | "barrier" | "thorns" | "counter" | "speed" | "crit" | ...
    // stacks: integer >= 1
    // =======================================================

    const MATERIA_ICONS = {
        poison:  "☠",   // toxic
        regen:   "✚",   // healing
        barrier: "⛨",   // shield
        thorns:  "♨",   // reflective damage
        counter: "⇄",   // counterattack
        speed:   "➤",   // haste
        crit:    "✦"    // critical hit
    };

    const MATERIA_LABELS = {
        poison:  "Poisoned",
        regen:   "Regen",
        barrier: "Barrier",
        thorns:  "Thorns",
        counter: "Counter",
        speed:   "Haste",
        crit:    "Critical"
    };

    Banter.materiaNote = function(target, type, stacks = 1) {
        if (!type) return;

        const key   = String(type).toLowerCase();
        const icon  = MATERIA_ICONS[key]  || "◇";
        const label = MATERIA_LABELS[key] || (type || "Materia");

        let core = `${icon} ${label}`;
        if (stacks > 1) {
            core += ` ×${stacks}`;
        }

        let side = "center";
        let arrowText = core;

        if (target === "player") {
            side = "left";
            arrowText = "← " + core;
        } else if (target === "enemy") {
            side = "right";
            arrowText = core + " →";
        }

        this.push(arrowText, side, 2000);
    };

    // expose
    window.Banter = Banter;

})();
