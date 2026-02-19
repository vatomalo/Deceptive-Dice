// =======================================================
// main.js — FINAL FULLY SYNCED WITH renderloop.js
// + Materia menu toggle + clean event-based combat hook
// + MTR tab click opens Materia menu
// + Sword Stance cycle (Q/E)
// =======================================================
console.log("main.js loaded");

window.selectedMateriaSlot = window.selectedMateriaSlot || 0;

// ===================================================
// GLOBAL DICE HELPERS + STATE
// ===================================================
window.rollDie = () => Math.floor(Math.random() * 6) + 1;
window.playerFace = null;
window.enemyFace = null;

// Are dice currently rolling?
let diceRolling = false;

// Materia inventory (safe guard)
if (!window.MateriaInventory) {
    window.MateriaInventory = [];
}

// Materia menu open flag
window.materiaMenuOpen = false;

window.Camera = {
  x: 0,
  y: 0,
  targetX: 0,
  speed: 900,        // px/sec
  reset() { this.x = this.y = this.targetX = 0; },
  update(dt) {
    if (dt > 1) dt /= 1000;
    const dx = this.targetX - this.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
    this.x += step;
  }
};

// =======================================================
// GAME ACTION ROUTER — triggers combat.js events
// =======================================================
window.game = {

    // -----------------------------------------------
    // ROLL: start a new round of dice
    // -----------------------------------------------

    // -----------------------------------------------
    // ROLL: start a new round of dice
    // -----------------------------------------------
    doRoll() {

        // avoid double rolls during animation
        if (diceRolling) return;

        diceRolling = true;

        // Lock buttons during roll
        xbar.disable();

        // Dice visible + smoke active while rolling
        window.hideDice = false;
        DiceSmoke.start();

        // Clear previous FX + dice visuals
        if (dice && dice.player) dice.player.clear();
        if (dice && dice.enemy) dice.enemy.clear();

        // Roll logical faces
        playerFace = rollDie();
        enemyFace = rollDie();

        // Start dice animations (visual only)
        dice.player.roll(playerFace);
        dice.enemy.roll(enemyFace);

        // 🔑 When the ENEMY die finishes animating, fire DICE_FINISHED
        dice.enemy.onFinish = () => {
            window.dispatchEvent(new Event("DICE_FINISHED"));
        };
    },



    // -----------------------------------------------
    // ATTACK: delegate to combat.js event system
    // -----------------------------------------------
    doAttack() {

        // No dice result? Ignore.
        if (playerFace == null || enemyFace == null) {
            console.warn("ATTACK pressed without dice faces");
            return;
        }

        if (diceRolling) return;

        // lastAction used for level-up stat bias
        PlayerLevel.lastAction = "attack";

        window.dispatchEvent(new Event("PLAYER_ATTACK"));
    },

    // -----------------------------------------------
    // PASS: style move, stamina handled in combat.js
    // -----------------------------------------------
    doPass() {

        if (diceRolling) return;

        PlayerLevel.lastAction = "pass";
        window.dispatchEvent(new Event("PASS_EVENT"));
    }
};

window.addEventListener("load", async () => {
    if (!loadGame()) {
        await systemMessage("Your fate begins now...");
        await systemMessage("Press X to continue.");
    }
});


// =======================================================
// FULL INITIALIZATION
// =======================================================
document.addEventListener("DOMContentLoaded", () => {

    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    const startBtn = document.getElementById("start-btn");
    const titleScreen = document.getElementById("title-screen");
    const gameui = document.getElementById("game-ui");

    window.canvas = canvas;
    window.ctx = ctx;

    canvas.style.display = "block";
    gameui.style.display = "block";
    AttractMode.start();

    // Banter JSON
    if (window.Banter && Banter.load) {
        Banter.load(); // Let the banter begin!
    }

    // ---------------------------------------------------
    // Fullscreen Icon
    // ---------------------------------------------------
    window.fullscreenImg = new Image();
    fullscreenImg.src = "./Artwork/FX/Fullscreen.png";

    window.fsReady = false;
    fullscreenImg.onload = () => fsReady = true;

    // ---------------------------------------------------
    // Sword Stance handling (Q/E)
    //  neutral → fang → wind → stone
    // ---------------------------------------------------
    const stanceOrder = ["neutral", "fang", "wind", "stone"];
    let stanceIndex = 0;

    function cycleStance(dir) {
        if (typeof window.setStance !== "function") return;

        stanceIndex = (stanceIndex + dir + stanceOrder.length) % stanceOrder.length;
        const next = stanceOrder[stanceIndex];
        setStance(next);

        // Optional: small center banter ping so player feels it
        if (window.Banter && Banter.push) {
            const label =
                next === "neutral" ? "STANCE: SHEATHED" :
                    next === "fang" ? "STANCE: FANG (STR↑ DEF↓)" :
                        next === "wind" ? "STANCE: WIND (AGI↑ STR↓)" :
                            next === "stone" ? "STANCE: STONE (DEF↑ AGI↓)" :
                                `STANCE: ${next.toUpperCase()}`;

            Banter.push(label, "center", 1400);
        }
    }
    // Make stance cycling available to gamepad / other systems
    window.cycleStance = cycleStance;


    // ---------------------------------------------------
    // Materia menu keybind (M) + Stance keys (Q/E)
    // ---------------------------------------------------
    document.addEventListener("keydown", e => {

        // Materia menu toggle
        if (e.key === "m" || e.key === "M") {
            window.materiaMenuOpen = !window.materiaMenuOpen;
            return;
        }

        // Stance cycle: Q = previous, E = next
        if (e.key === "q" || e.key === "Q") {
            e.preventDefault();
            cycleStance(-1);
            return;
        }

        if (e.key === "e" || e.key === "E") {
            e.preventDefault();
            cycleStance(+1);
            return;
        }
    });
    canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // -----------------------------------------
        // Touch stance change:
        // Tap in the top-left HUD area (nameplate/sword)
        // -----------------------------------------
        const stanceRegionYMax = 110;    // same band as nameplate & katana
        const stanceRegionXMax = canvas.width * 0.45;

        if (my <= stanceRegionYMax && mx <= stanceRegionXMax) {
            if (window.cycleStance) {
                cycleStance(+1);
                return; // don't click XBar if we used stance tap
            }
        }

        // -----------------------------------------
        // XBar click handling
        // -----------------------------------------
        if (window.xbar && xbar.handleClick) {
            xbar.handleClick(mx, my);
        }
    });

    // ---------------------------------------------------
    // Canvas click handler (fullscreen / materia / xbar)
    // ---------------------------------------------------
    canvas.addEventListener("click", e => {

        const r = canvas.getBoundingClientRect();
        const mx = (e.clientX - r.left) * (canvas.width / r.width);
        const my = (e.clientY - r.top) * (canvas.height / r.height);

        // If materia menu open → handle clicks there first
        if (window.materiaMenuOpen) {
            if (handleMateriaClick(mx, my, canvas)) {
                return; // don't propagate
            }
        }

        // If materia menu closed and player clicks on MTR tab → open menu
        if (!window.materiaMenuOpen &&
            typeof window.isClickOnMateriaTab === "function" &&
            isClickOnMateriaTab(mx, my, canvas)) {

            window.materiaMenuOpen = true;
            return;
        }

        // Handle fullscreen
        if (fsReady) {
            const size = 42;
            const bx = canvas.width - size - 10;
            const by = canvas.height - size - 10;

            if (mx >= bx && mx <= bx + size &&
                my >= by && my <= by + size) {

                if (!document.fullscreenElement)
                    canvas.requestFullscreen();
                else
                    document.exitFullscreen();
                return;
            }
        }

        // Handle XBar buttons
        if (window.xbar)
            xbar.handleClick(mx, my);
    });



    // ===================================================
    // START BUTTON — Master initializer
    // ===================================================
    startBtn.onclick = () => {
        AttractMode.stop();
        titleScreen.style.display = "none";
        canvas.style.display = "block";
        gameui.style.display = "block";

        Announcer.play("fight");
        MusicSystem.playRandom();
        startGame();
    };


    // ----------------------------------------------------
    // MUSIC-MOOD HOOKS
    // ----------------------------------------------------
    window.addEventListener("ENEMY_LEVEL_UP", () => {
        if (EnemyLevel.level >= 5) {
            setMood("tense");
            MusicSystem.playRandom();
        }
    });

    window.addEventListener("NIGHTFALL_EVENT", () => {
        setMood("tense");
        MusicSystem.playRandom();
    });

    window.addEventListener("DAWN_EVENT", () => {
        setMood("calm");
        MusicSystem.playRandom();
    });

});


// ===================================================
// MATERIA MENU CLICK HANDLER
// ===================================================
function handleMateriaClick(mx, my, canvas) {
  if (!window.materiaMenuOpen) return false;

  const menuX = 80;
  const menuY = 60;
  const menuW = canvas.width - 160;
  const menuH = canvas.height - 120;

  // Click outside → close
  if (mx < menuX || mx > menuX + menuW || my < menuY || my > menuY + menuH) {
    window.materiaMenuOpen = false;
    return true;
  }

  // Safety
  if (!window.MateriaInventory || !window.MateriaSlots) return true;

  // -----------------------------------------
  // Slot selector row (top of menu)
  // -----------------------------------------
  // Example: 2 slots displayed as "M1" "M2"
  const slotY = menuY + 70;
  const slotX = menuX + 40;
  const slotW = 70;
  const slotH = 30;
  const gap = 14;

  for (let i = 0; i < window.MateriaSlots.maxSlots; i++) {
    const bx = slotX + i * (slotW + gap);
    const by = slotY;

    if (mx >= bx && mx <= bx + slotW && my >= by && my <= by + slotH) {
      window.selectedMateriaSlot = i;
      console.log("[MATERIA] selected slot:", i);
      return true;
    }
  }

  // -----------------------------------------
  // Inventory list click => equip into slot
  // -----------------------------------------
  const startY = menuY + 130;
  const lineH = 28;

  const idx = Math.floor((my - startY) / lineH);
  if (idx < 0 || idx >= MateriaInventory.length) return true;

  const picked = MateriaInventory[idx];

  // Equip rules:
  // - Clicking a materia equips it into the selected slot
  // - If it's already equipped in another slot, swap or move
  // - Clicking the same materia already in selected slot => unequip
  const eq = window.MateriaSlots.equipped;

  if (eq[window.selectedMateriaSlot] === picked) {
    eq[window.selectedMateriaSlot] = null; // unequip
    console.log("[MATERIA] unequipped", picked, "from slot", window.selectedMateriaSlot);
  } else {
    // If picked is equipped elsewhere, move it
    const other = eq.indexOf(picked);
    if (other !== -1) {
      eq[other] = null;
    }
    eq[window.selectedMateriaSlot] = picked;
    console.log("[MATERIA] equipped", picked, "to slot", window.selectedMateriaSlot);
  }

  window.rebuildMateriaFlags();
  return true;
}


let stageSelect = "default_stage";

// ===================================================
// CORE GAME INIT
// ===================================================
async function startGame() {

    // ---------------- BG + FX ----------------
    window.bg = new ParallaxBG(stageSelect);
    window.decor = new Decor(stageSelect);
    window.fxManager = new FXManager();


    // ===================================================
    // CHARACTERS
    // ===================================================
    const samurai = new Character(120, 375, 2.5);
    samurai.addAnimation("idle", new SpriteSheetAnimator("Artwork/Samurai/IDLE.png", 10, 55));
    samurai.addAnimation("run", new SpriteSheetAnimator("Artwork/Samurai/RUN.png", 16, 28));
    samurai.addAnimation("attack", new SpriteSheetAnimator("Artwork/Samurai/ATTACK1.png", 7, 38));
    samurai.addAnimation("block", new SpriteSheetAnimator("Artwork/Samurai/HURT.png", 4, 70));
    // no dedicated death sheet yet; using FX + fade
    samurai.setState("idle");

    const knight = new Character(420, 375, 2.5);
    knight.flip = true;
    knight.addAnimation("idle", new SpriteSheetAnimator("Artwork/Knight/IDLE.png", 7, 55));
    knight.addAnimation("run", new SpriteSheetAnimator("Artwork/Knight/RUN.png", 8, 28));
    knight.addAnimation("attack", new SpriteSheetAnimator("Artwork/Knight/ATTACK1.png", 6, 42));
    knight.addAnimation("block", new SpriteSheetAnimator("Artwork/Knight/DEFEND.png", 6, 70));
    knight.addAnimation("hurt", new SpriteSheetAnimator("Artwork/Knight/HURT.png", 4, 70));
    knight.addAnimation("death", new SpriteSheetAnimator("Artwork/Knight/DEATH.png", 12, 70));
    knight.setState("idle");

    window.samurai = samurai;
    window.knight = knight;

    window.playerResetStats(); // existing line

    // NEW: AttractMode knows about the actors
    if (window.AttractMode && AttractMode.init) {
        AttractMode.init(samurai, knight);
    }

    window.SAMURAI_HOME_X = 120;
    window.SAMURAI_HOME_Y = 375;

    window.KNIGHT_HOME_X = 420;
    window.KNIGHT_HOME_Y = 375;

    // Palette + weather
    PaletteSystem.start("day");     // or "dusk"/"night"
    PaletteSystem.timeScale = 0.5;  // slower cycle
    startWeatherDirector();


    // ===================================================
    // WAIT FOR ALL ASSETS
    // ===================================================
    await Promise.all(window.ASSET_PROMISES);


    // ===================================================
    // ENEMY SYSTEM INIT
    // ===================================================
    spawnEnemy(TotalKills);
    resetEnemyHP();

    // ==============================================
    // HP BARS INIT (SAMURAI + KNIGHT)
    // ==============================================

    // Player / Samurai HP bar (left)
    window.hpSamurai = new HealthBar(
        ctx,
        20,
        20,
        PlayerStats.maxHP || 5,
        "#40C7FF"
    );
    hpSamurai.setHP(hpSamurai.maxHP);

    // Enemy / Knight HP bar (right)
    window.hpKnight = new HealthBar(
        ctx,
        canvas.width - 280,
        20,
        CurrentEnemy.maxHP,
        "#ff5555"
    );
    hpKnight.setHP(CurrentEnemy.hp);

    console.log("HP init", {
        samurai: { hp: hpSamurai.hp, max: hpSamurai.maxHP },
        knight: { hp: hpKnight.hp, max: hpKnight.maxHP }
    });

    // ===================================================
    // DICE SYSTEM (PLAYER + ENEMY)
    // ===================================================
    window.dice = {
        player: new DiceSystem(ctx),
        enemy: new DiceSystem(ctx)
    };

    // ===================================================
    // DAMAGE NUMBERS BUFFER
    // ===================================================
    window.damageFX = [];

    // Shadow clone buffer (for PASS event)
    window.shadowClones = window.shadowClones || [];

    // ===================================================
    // X-BAR (ROLL / ATTACK / PASS)
    // ===================================================
    window.xbar = new XBarControls(ctx, window.game, samurai);
    xbar.showRoll();

    // when dice finish...
    window.addEventListener("DICE_FINISHED", () => {
        // dice animation is done → allow ATTACK / PASS
        diceRolling = false;
        // further behaviour is now in combat.js (DICE_FINISHED listener)
    });

    // ===================================================
    // START THE RENDER LOOP
    // ===================================================
    startRenderLoop();
}
