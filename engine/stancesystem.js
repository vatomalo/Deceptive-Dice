// =======================================================
// stancesystem.js — Stances: Balance / Fang / Wind / Aegis
// Hooks: Stamina + Stats + UI Katana
// =======================================================
console.log("stancesystem.js loaded");

(function () {

    // -----------------------------------------------
    //  STANCE DEFINITIONS
    // -----------------------------------------------
    const STANCES = {
        balance: {
            key: "balance",
            label: "BAL",
            color: "#cccccc",
            stats:   { STR: 1.0, AGI: 1.0, DEF: 1.0 },
            stamina: { attackCostMul: 1.0, regenMul: 1.0, onHitMul: 1.0 }
        },
        fang: {
            key: "fang",
            label: "FANG",
            color: "#ff4a4a",   // red → STR
            stats:   { STR: 1.4, AGI: 1.0, DEF: 0.9 },
            stamina: { attackCostMul: 1.35, regenMul: 0.85, onHitMul: 1.0 }
        },
        wind: {
            key: "wind",
            label: "WIND",
            color: "#ffd93b",   // yellow → AGI
            stats:   { STR: 0.9, AGI: 1.4, DEF: 1.0 },
            stamina: { attackCostMul: 0.80, regenMul: 1.25, onHitMul: 0.8 }
        },
        aegis: {
            key: "aegis",
            label: "AEGIS",
            color: "#4aa3ff",   // blue → DEF
            stats:   { STR: 0.9, AGI: 0.9, DEF: 1.4 },
            stamina: { attackCostMul: 1.0, regenMul: 1.0, onHitMul: 1.25 }
        }
    };

    const ORDER = ["balance", "fang", "wind", "aegis"];

    // -----------------------------------------------
    //  GLOBAL STANCE OBJECT
    // -----------------------------------------------
    window.Stance = {
        current: "balance",
        index: 0,

        next() {
            this.index = (this.index + 1) % ORDER.length;
            this.current = ORDER[this.index];
        },

        prev() {
            this.index = (this.index - 1 + ORDER.length) % ORDER.length;
            this.current = ORDER[this.index];
        },

        getData() {
            return STANCES[this.current] || STANCES.balance;
        },

        getStatMultiplier(stat) {
            const d = this.getData();
            return (d.stats && d.stats[stat]) || 1.0;
        },

        getStaminaMultipliers() {
            const d = this.getData();
            return d.stamina || STANCES.balance.stamina;
        },

        getColor() {
            return this.getData().color || "#ffffff";
        },

        getLabel() {
            return this.getData().label || "BAL";
        }
    };

    // ===============================================
    //  STAMINA HOOKS (PLAYER ONLY)
    // ===============================================
    function hookStamina() {
        if (!window.PlayerStamina) return;

        const ps = window.PlayerStamina;

        // cache base values so stance is always relative
        const base = {
            attackCost: ps.attackCost || 15,
            regenRate:  ps.regenRate  || 0.25,
            onHitGain:  ps.onHitGain  || 30
        };

        // Spend for ATTACK (stance-scaled)
        ps.spendForAttack = function () {
            const mul = window.Stance
                ? Stance.getStaminaMultipliers()
                : STANCES.balance.stamina;

            const cost = Math.ceil(base.attackCost * mul.attackCostMul);
            if (this.current < cost) return false;
            this.current -= cost;
            if (this.current < 0) this.current = 0;
            return true;
        };

        // Passive regen per frame (stance-scaled)
        ps.regen = function (dt = 16) {
            const mul = window.Stance
                ? Stance.getStaminaMultipliers()
                : STANCES.balance.stamina;

            const ticks  = dt / 16;
            const amount = base.regenRate * mul.regenMul * ticks;
            this.gain(amount);
        };

        // On-hit stamina refund (stance-scaled)
        ps.onHit = function () {
            const mul = window.Stance
                ? Stance.getStaminaMultipliers()
                : STANCES.balance.stamina;

            const gain = base.onHitGain * mul.onHitMul;
            this.gain(gain);
        };

        // keep reset/use behavior consistent
        ps.reset = function () {
            this.current = this.max;
        };

        ps.use = function () {
            return this.spendForAttack();
        };
    }

    // ===============================================
    //  STAT + DAMAGE HOOKS (PLAYER ONLY)
    // ===============================================
    function hookStatsAndDamage() {
        const baseGetAGI  = window.getAGI || null;
        const baseGetDEF  = window.getDEF || null;
        const basePDamage = window.computePlayerDamage || null;

        // getAGI("player") → AGI * stance.AGI
        if (baseGetAGI) {
            window.getAGI = function (type) {
                let v = baseGetAGI(type);
                if (type === "player" && window.Stance) {
                    v *= Stance.getStatMultiplier("AGI");
                }
                return v;
            };
        }

        // getDEF("player") → DEF * stance.DEF
        if (baseGetDEF) {
            window.getDEF = function (type) {
                let v = baseGetDEF(type);
                if (type === "player" && window.Stance) {
                    v *= Stance.getStatMultiplier("DEF");
                }
                return v;
            };
        }

        // computePlayerDamage(base) → dmg * stance.STR
        if (basePDamage) {
            window.computePlayerDamage = function (base) {
                let dmg = basePDamage(base);
                if (window.Stance) {
                    dmg *= Stance.getStatMultiplier("STR");
                }
                return Math.max(1, Math.floor(dmg));
            };
        }
    }

    // ===============================================
    //  UI: KATANA UNDER PLAYER NAMEPLATE
    // ===============================================

    // TODO: point this to the same sprite you use in your death FX
    const stanceKatanaImg = new Image();
    stanceKatanaImg.src = "./Artwork/FX/Katana.png";

    const NAMEPLATE_W = 220;
    const NAMEPLATE_H = 28;

    function drawKatana(ctx, cx, y, color, label) {
        ctx.save();

        if (stanceKatanaImg.complete && stanceKatanaImg.width > 0) {
            const w = stanceKatanaImg.width;
            const h = stanceKatanaImg.height;
            const scale = 0.6;

            const dw = w * scale;
            const dh = h * scale;
            const dx = cx - dw / 2;
            const dy = y - dh / 2;

            // draw katana sprite
            ctx.drawImage(stanceKatanaImg, dx, dy, dw, dh);

            // subtle color overlay
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = color;
            ctx.fillRect(dx, dy, dw, dh);
            ctx.globalAlpha = 1.0;

        } else {
            // fallback: simple vector line if image not ready
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            const len = 140;

            ctx.beginPath();
            ctx.moveTo(cx - len / 2, y);
            ctx.lineTo(cx + len / 2, y);
            ctx.stroke();
        }

        // label (FANG/WIND/AEGIS/BAL)
        ctx.font = "10px pixel";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillText(label, cx, y + 6);

        ctx.restore();
    }

    function hookNamePlates() {
        if (!window.drawNamePlate) return;

        const baseDrawNamePlate = window.drawNamePlate;

        window.drawNamePlate = function (ctx, x, y, title, levelText) {
            // draw original UI
            baseDrawNamePlate(ctx, x, y, title, levelText);

            if (!window.Stance || !window.canvas) return;

            const centerX = x + NAMEPLATE_W / 2;
            const swordY  = y + NAMEPLATE_H + 8;

            // left side only → player nameplate
            const isPlayerSide = centerX < (canvas.width / 2);
            if (!isPlayerSide) return;

            const color = Stance.getColor();
            const label = Stance.getLabel();

            drawKatana(ctx, centerX, swordY, color, label);
        };
    }

    // ===============================================
    //  INPUT: Q/E stance cycling (L1/R1 can call prev/next)
    // ===============================================
    function hookInput() {
        document.addEventListener("keydown", (e) => {
            if (!window.Stance || e.repeat) return;

            const key = e.key.toLowerCase();

            if (key === "q") {
                Stance.prev();
            } else if (key === "e") {
                Stance.next();
            }
        });
    }

    // ===============================================
    //  INIT AFTER DOM CONTENT LOADED
    // ===============================================
    window.addEventListener("DOMContentLoaded", () => {
        try {
            hookStamina();
            hookStatsAndDamage();
            hookNamePlates();
            hookInput();
        } catch (err) {
            console.error("Stance system init failed:", err);
        }
    });

})();
