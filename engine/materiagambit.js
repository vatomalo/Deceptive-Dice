// =======================================================
// materiaGambits.js — SMALL v1 (Max 3 gambits)
// Includes "MAX gambit" (high threshold, rare trigger)
// =======================================================
console.log("materiaGambits.js loaded");

window.MateriaGambits = window.MateriaGambits || {};

(function () {
  const G = window.MateriaGambits;

  // hard cap for v1
  G.MAX_RULES = 3;

  // simple on/off
  G.enabled = true;

  // cooldown so it can’t spam
  G._cooldownUntil = 0;

  // Optional: separate cooldown for the MAX gambit
  G._maxCooldownUntil = 0;

  // ---------------------------------------------------
  // Helpers
  // ---------------------------------------------------
  const nowMs = () => performance.now();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  G.buildContext = function () {
    // safe guards (don’t crash if something isn’t ready)
    const pHP = window.hpSamurai?.hp ?? 0;
    const pMax = window.hpSamurai?.maxHP ?? 1;

    const eHP = window.CurrentEnemy?.hp ?? 0;
    const eMax = window.CurrentEnemy?.maxHP ?? 1;

    return {
      player: {
        hp: pHP,
        maxHP: pMax,
        hpPct: pHP / Math.max(1, pMax),
        stamina: window.PlayerStamina?.current ?? 0,
        staminaMax: window.PlayerStamina?.max ?? 1,
        staminaPct: (window.PlayerStamina?.current ?? 0) / Math.max(1, window.PlayerStamina?.max ?? 1),
        materia: window.Materia || {},
        hearts: window.PlayerHearts ?? 0,
        maxHearts: window.MaxHearts ?? 0,
      },
      enemy: {
        hp: eHP,
        maxHP: eMax,
        hpPct: eHP / Math.max(1, eMax),
        poisoned: !!window.CurrentEnemy?.isPoisoned
      },
      dice: {
        player: (typeof window.playerFace === "number") ? window.playerFace : null,
        enemy: (typeof window.enemyFace === "number") ? window.enemyFace : null,
        gap: (typeof window.playerFace === "number" && typeof window.enemyFace === "number")
          ? (window.playerFace - window.enemyFace)
          : 0
      }
    };
  };

  // ---------------------------------------------------
  // MAX GAMBIT (rare, cinematic)
  // Conditions: you’re ahead on dice + stamina healthy + enemy low
  // Action: triggers a special flow hook (you implement later)
  // ---------------------------------------------------
  G.tryMax = function (ctx) {
    if (!G.enabled) return false;

    const n = nowMs();
    if (n < G._maxCooldownUntil) return false;

    // gate: need a meaningful dice gap
    if (ctx.dice.player == null || ctx.dice.enemy == null) return false;
    if (ctx.dice.gap < 2) return false;

    // gate: enemy must be low enough to feel like a finisher
    if (ctx.enemy.hpPct > 0.35) return false;

    // gate: you must have stamina (no free win when exhausted)
    if (ctx.player.staminaPct < 0.40) return false;

    // must have “max materia” equipped to even be eligible
    // (you can rename this later)
    if (!ctx.player.materia.max) return false;

    // chance: not guaranteed (keeps it exciting)
    // gap 2 => ~18%, gap 3 => ~28%, gap 4+ => ~38%
    const chance = clamp(0.18 + (ctx.dice.gap - 2) * 0.10, 0.18, 0.38);
    if (Math.random() > chance) return false;

    // cooldown (rare moment)
    G._maxCooldownUntil = n + 8000;

    console.log("[GAMBIT MAX] TRIGGERED", { chance, gap: ctx.dice.gap });

    // Visual feedback (optional)
    if (window.Banter && Banter.push) Banter.push("MAX GAMBIT!", "center", 900);
    if (window.SFX && SFX.playUI) SFX.playUI("ui", 0.9);

    // Hook: let combat.js consume this
    window.dispatchEvent(new CustomEvent("MAX_GAMBIT_TRIGGER", { detail: ctx }));
    return true;
  };

  // ---------------------------------------------------
  // Normal gambits (max 3)
  // priority: lower runs first
  // do() returns true when it actually acted
  // ---------------------------------------------------
  G.rules = [
    // 1) Safety: if stamina is empty, auto-pass (prevents dead inputs)
    {
      key: "stamina_safety",
      priority: 10,
      enabled: true,
      when: (ctx) => ctx.player.stamina <= 0,
      do: () => {
        console.log("[GAMBIT] stamina_safety -> PASS");
        window.dispatchEvent(new Event("PASS_EVENT"));
        return true;
      }
    },

    // 2) Regen assist: if regen materia on and you’re hurt, tag a regen tick
    // (you already have regen logic elsewhere; this is just a hook)
    {
      key: "regen_assist",
      priority: 20,
      enabled: true,
      when: (ctx) => !!ctx.player.materia.regen && ctx.player.hpPct < 0.45,
      do: () => {
        console.log("[GAMBIT] regen_assist -> REGEN_TICK");
        window.dispatchEvent(new Event("REGEN_TICK"));
        if (window.Banter && Banter.push) Banter.push("REGEN", "center", 600);
        return true;
      }
    },

    // 3) Crit focus: if crit materia on and you’re ahead on dice, arm a crit flag
    // This does NOT consume a turn; it just biases the next hit.
    {
      key: "crit_focus",
      priority: 30,
      enabled: true,
      when: (ctx) => !!ctx.player.materia.crit && ctx.dice.gap >= 1,
      do: () => {
        console.log("[GAMBIT] crit_focus -> forceCrit ON");
        window.forceCrit = true;
        if (window.Banter && Banter.push) Banter.push("FOCUS", "center", 600);
        return false; // doesn’t take action, just sets a flag
      }
    }
  ].slice(0, G.MAX_RULES);

  G.evaluate = function () {
    if (!G.enabled) return { acted: false, maxed: false };

    const n = nowMs();
    if (n < G._cooldownUntil) return { acted: false, maxed: false };

    const ctx = G.buildContext();

    // First: MAX gambit check (rare)
    const maxed = G.tryMax(ctx);
    if (maxed) {
      // small cooldown so it doesn’t immediately evaluate again
      G._cooldownUntil = n + 300;
      return { acted: true, maxed: true };
    }

    // Then: normal rules
    const ordered = [...G.rules].sort((a, b) => a.priority - b.priority);

    for (const r of ordered) {
      if (!r.enabled) continue;

      let ok = false;
      try { ok = r.when(ctx); } catch (e) { console.warn("gambit when() failed", r.key, e); }

      if (!ok) continue;

      let acted = false;
      try { acted = !!r.do(ctx); } catch (e) { console.warn("gambit do() failed", r.key, e); }

      if (acted) {
        G._cooldownUntil = n + 250; // small spam guard
        return { acted: true, maxed: false };
      }
    }

    // no action taken
    return { acted: false, maxed: false };
  };

})();
