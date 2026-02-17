// =======================================================
// gambitsystem.js — FF12-like Gambits (v1)
// - IF condition THEN cast equipped materia
// - Start small: 2 gambit lines, 2 materia slots
// =======================================================
console.log("gambitsystem.js loaded");

window.Gambits = window.Gambits || {
  enabled: true,

  // Max gambit lines allowed (start small)
  maxLines: 2,

  // Priority order: top to bottom
  // Each line: { enabled, cond, arg, actionSlot, cooldownMs, _nextOk }
  lines: [
    { enabled: true,  cond: "player_hp_below", arg: 0.35, actionSlot: 0, cooldownMs: 2200, _nextOk: 0 },
    { enabled: true,  cond: "enemy_not_poisoned", arg: null, actionSlot: 1, cooldownMs: 1800, _nextOk: 0 },
  ],

  // How often we are allowed to fire ANY gambit (global throttle)
  globalCooldownMs: 250,
  _nextGlobalOk: 0,
};

// -------------------------------------------------------
// Helpers: safe percent reads
// -------------------------------------------------------
function getPlayerHP01() {
  if (!window.hpSamurai) return 1;
  return Math.max(0, Math.min(1, hpSamurai.hp / hpSamurai.maxHP));
}

function getEnemyHP01() {
  if (!window.hpKnight || !window.CurrentEnemy) return 1;
  return Math.max(0, Math.min(1, CurrentEnemy.hp / CurrentEnemy.maxHP));
}

// -------------------------------------------------------
// Condition evaluation
// -------------------------------------------------------
function evalCond(cond, arg) {
  switch (cond) {
    case "player_hp_below":  return getPlayerHP01() <= (arg ?? 0.5);
    case "enemy_hp_below":   return getEnemyHP01() <= (arg ?? 0.5);

    case "enemy_not_poisoned":
      return !(window.CurrentEnemy && CurrentEnemy.isPoisoned);

    case "player_missing_hp":
      // true if you can heal at all
      return window.hpSamurai ? hpSamurai.hp < hpSamurai.maxHP : false;

    case "always":
      return true;

    default:
      return false;
  }
}

// -------------------------------------------------------
// Action execution: maps "slot -> equipped materia key"
// You already have MateriaSlots/equip logic (or we add it).
// -------------------------------------------------------
function getEquippedMateriaKey(slotIndex) {
  const eq = window.MateriaSlots?.equipped;
  if (!eq || !eq.length) return null;
  return eq[slotIndex] || null;
}

// This is where gambit triggers an ability.
// Keep it tiny: v1 supports regen + poison + barrier (expand later).
async function executeMateria(key) {
  if (!key) return false;

  // Don’t run during busy combat animation if you want strictness
  // (optional: allow out-of-turn buffs)
  if (window._combatBusy) return false;

  switch (key) {
    case "regen":
      // Heal small amount instantly (v1). Later: timed regen.
      if (!window.hpSamurai) return false;
      if (hpSamurai.hp >= hpSamurai.maxHP) return false;

      const amt = Math.max(1, Math.floor(hpSamurai.maxHP * 0.22));
      hpSamurai.setHP(Math.min(hpSamurai.maxHP, hpSamurai.hp + amt));

      if (window.SFX && SFX.playUI) SFX.playUI("heal", 0.9);
      if (window.Banter && Banter.push) Banter.push(`REGEN +${amt}`, "center", 900);
      return true;

    case "poison":
      if (!window.CurrentEnemy) return false;
      if (CurrentEnemy.isPoisoned) return false;
      CurrentEnemy.isPoisoned = true;

      if (window.SFX && SFX.playUI) SFX.playUI("ui", 0.7);
      if (window.Banter && Banter.push) Banter.push("POISON!", "center", 900);
      return true;

    case "barrier":
      // v1: temporary DEF buff for player
      window.PlayerTemp = window.PlayerTemp || {};
      if (PlayerTemp.barrierUntil && performance.now() < PlayerTemp.barrierUntil) return false;

      PlayerTemp.barrierUntil = performance.now() + 6500; // 6.5s
      PlayerTemp.barrierMul = 0.70; // take 70% damage while active

      if (window.Banter && Banter.push) Banter.push("BARRIER!", "center", 900);
      if (window.SFX && SFX.playUI) SFX.playUI("ui", 0.8);
      return true;

    default:
      return false;
  }
}

// -------------------------------------------------------
// Public tick: call this once per frame (or 60fps tick)
// -------------------------------------------------------
window.Gambits.tick = async function gambitTick() {
  if (!window.Gambits.enabled) return;
  if (!window.hpSamurai || !window.CurrentEnemy) return;

  const now = performance.now();
  if (now < window.Gambits._nextGlobalOk) return;

  const lines = window.Gambits.lines || [];
  const limit = Math.min(window.Gambits.maxLines || 0, lines.length);

  for (let i = 0; i < limit; i++) {
    const g = lines[i];
    if (!g || !g.enabled) continue;
    if (now < (g._nextOk || 0)) continue;

    if (!evalCond(g.cond, g.arg)) continue;

    const key = getEquippedMateriaKey(g.actionSlot);
    if (!key) continue;

    const ok = await executeMateria(key);
    if (ok) {
      g._nextOk = now + (g.cooldownMs || 1200);
      window.Gambits._nextGlobalOk = now + window.Gambits.globalCooldownMs;
      return; // only fire one gambit per tick (FF12 vibe)
    }
  }
};
