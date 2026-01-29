// =======================================================
// qtesystem.js — Universal QTE prompts (Keyboard + Gamepad + Touch)
// Prompts show the *actual glyph* that should be pressed.
// =======================================================
console.log("qtesystem.js loaded");

(function () {

  const QTE = {
    active: false,
    success: false,
    fail: false,

    // config
    durationMs: 520,
    startedAt: 0,
    action: null, // "z"|"x"|"c" OR "square"|"cross"|"triangle"|"circle"
    mode: "keyboard", // "keyboard" | "gamepad" | "touch"
    allowTriangle: true, // if gamepad mode, include triangle

    // touch hit areas
    touchButtons: [],

    // last-frame edge detection for gamepad
    _prevPadPressed: { 0:false, 1:false, 2:false, 3:false },

    // ---------- PUBLIC API ----------
    // options:
    //  - forceMode: "keyboard"|"gamepad"|"touch" (optional)
    //  - durationMs: number
    //  - allowTriangle: bool
    // Returns Promise<boolean>
    prompt(options = {}) {
      if (this.active) return Promise.resolve(false);

      this.durationMs = options.durationMs ?? this.durationMs;
      this.allowTriangle = (options.allowTriangle ?? true);

      this.mode = options.forceMode || this.detectMode();
      this.action = this.pickAction(this.mode);
      this.success = false;
      this.fail = false;
      this.active = true;
      this.startedAt = performance.now();

      // build touch buttons each time (responsive to canvas size)
      this.buildTouchButtons();

      // (optional) also push manga cue
      if (window.Banter) Banter.push("!!", "center", 450);

      return new Promise(resolve => {
        const tick = () => {
          if (!this.active) return resolve(false);

          const now = performance.now();
          const t = now - this.startedAt;

          // time out
          if (t >= this.durationMs) {
            this.active = false;
            return resolve(false);
          }

          // success
          if (this.success) {
            this.active = false;
            return resolve(true);
          }

          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      });
    },

    // call from renderloop each frame
    update() {
      if (!this.active) return;

      // gamepad polling (edge-detect)
      if (this.mode === "gamepad") {
        this.pollGamepad();
      }
    },

    // call from renderloop draw step
    draw(ctx, canvas) {
      if (!this.active) return;

      const now = performance.now();
      const t = (now - this.startedAt) / this.durationMs;
      const alpha = Math.max(0, Math.min(1, 1 - Math.max(0, (t - 0.75) / 0.25)));

      // backdrop
      const boxW = Math.floor(canvas.width * 0.38);
      const boxH = 90;
      const x = (canvas.width - boxW) / 2;
      const y = Math.floor(canvas.height * 0.22);

      ctx.save();
      ctx.globalAlpha = 0.92 * alpha;
      ctx.fillStyle = "rgba(0,0,0,0.80)";
      ctx.fillRect(x, y, boxW, boxH);

      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, boxW, boxH);

      // label
      ctx.fillStyle = "white";
      ctx.font = "18px pixel";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("QTE!", x + boxW / 2, y + 20);

      // glyph
      ctx.font = "34px pixel";
      ctx.fillText(this.glyphForAction(this.action, this.mode), x + boxW / 2, y + 58);

      ctx.restore();

      // Touch controls (only if touch mode)
      if (this.mode === "touch") {
        this.drawTouchButtons(ctx);
      }
    },

    // ---------- MODE + ACTION ----------
    detectMode() {
      // If a gamepad is connected, prefer gamepad glyphs.
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      const pad = pads && pads[0] ? pads[0] : null;
      if (pad) return "gamepad";

      // If we have touch capability, show touch buttons
      const touchCapable = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
      if (touchCapable) return "touch";

      return "keyboard";
    },

    pickAction(mode) {
      if (mode === "keyboard") {
        // Your keys only
        const keys = ["z", "x", "c"];
        return keys[Math.floor(Math.random() * keys.length)];
      }

      if (mode === "touch") {
        // Touch uses same set as keyboard by default
        const keys = ["z", "x", "c"];
        return keys[Math.floor(Math.random() * keys.length)];
      }

      // gamepad (PS-style glyph set)
      const buttons = this.allowTriangle
        ? ["square", "cross", "triangle", "circle"]
        : ["square", "cross", "circle"];

      return buttons[Math.floor(Math.random() * buttons.length)];
    },

    glyphForAction(action, mode) {
      if (mode === "keyboard" || mode === "touch") {
        return action.toUpperCase();
      }

      // PS-style glyphs (ASCII-friendly)
      switch (action) {
        case "square": return "□";
        case "cross": return "✕";
        case "triangle": return "△";
        case "circle": return "○";
        default: return "?";
      }
    },

    // ---------- INPUT HANDLERS ----------
    onKeyDown(e) {
      if (!QTE.active) return;

      const k = e.key?.toLowerCase();
      if (QTE.mode !== "keyboard") return;

      if (k === QTE.action) {
        QTE.success = true;
      }
    },

    pollGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      const pad = pads && pads[0] ? pads[0] : null;
      if (!pad) return;

      // standard mapping:
      // 0 = Cross, 1 = Circle, 2 = Square, 3 = Triangle
      const map = {
        cross: 0,
        circle: 1,
        square: 2,
        triangle: 3
      };

      const idx = map[this.action];
      if (typeof idx !== "number") return;

      const pressed = !!(pad.buttons[idx] && pad.buttons[idx].pressed);
      const prev = this._prevPadPressed[idx] || false;

      // edge detect: only count "just pressed"
      if (pressed && !prev) {
        this.success = true;
      }

      this._prevPadPressed[idx] = pressed;
    },

    // ---------- TOUCH ----------
    buildTouchButtons() {
      const canvas = window.canvas || document.getElementById("game-canvas");
      if (!canvas) return;

      // 3 big buttons along the bottom (Z / X / C)
      const W = canvas.width;
      const H = canvas.height;

      const bw = 110;
      const bh = 60;
      const gap = 14;
      const totalW = bw * 3 + gap * 2;

      const startX = (W - totalW) / 2;
      const y = H - bh - 42;

      this.touchButtons = [
        { key: "z", x: startX + (bw + gap) * 0, y, w: bw, h: bh, label: "Z" },
        { key: "x", x: startX + (bw + gap) * 1, y, w: bw, h: bh, label: "X" },
        { key: "c", x: startX + (bw + gap) * 2, y, w: bw, h: bh, label: "C" }
      ];
    },

    drawTouchButtons(ctx) {
      ctx.save();
      ctx.globalAlpha = 0.90;

      for (const b of this.touchButtons) {
        // background
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.fillRect(b.x, b.y, b.w, b.h);

        // border: highlight the requested key
        ctx.lineWidth = 3;
        ctx.strokeStyle = (this.action === b.key) ? "white" : "rgba(255,255,255,0.35)";
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // label
        ctx.fillStyle = "white";
        ctx.font = "28px pixel";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 2);
      }

      ctx.restore();
    },

    onPointerDown(e) {
      if (!QTE.active) return;
      if (QTE.mode !== "touch") return;

      const canvas = window.canvas || document.getElementById("game-canvas");
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top)  * (canvas.height / rect.height);

      for (const b of QTE.touchButtons) {
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
          if (b.key === QTE.action) {
            QTE.success = true;
          }
          break;
        }
      }
    }
  };

  // Keyboard listener
  document.addEventListener("keydown", QTE.onKeyDown);

  // Touch/pointer listener
  const canvas = document.getElementById("game-canvas");
  if (canvas) {
    canvas.addEventListener("pointerdown", QTE.onPointerDown);
  } else {
    // if canvas mounts later, you can rebind in main.js after creating it
  }

  window.QTE = QTE;
})();
