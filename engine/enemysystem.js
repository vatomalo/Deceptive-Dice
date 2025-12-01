// =======================================================
// enemysystem.js — Enemy Factory + Wave Scaling (JSON)
// =======================================================

console.log("enemysystem.js loaded");

// Master reference to currently active enemy instance
window.CurrentEnemy = null;

// Total kills across the run (wave difficulty scaling)
window.TotalKills = 0;

// Loaded enemy templates from JSON
window.EnemyTypes = [];          // populated from enemies.json
let enemyDataReady = false;
let enemyDataFailed = false;

// Fallback enemies if JSON fails / not ready
const FALLBACK_ENEMIES = [
    {
        id: "novice_knight",
        name: "Novice Knight",
        minKills: 0,
        maxKills: 4,
        baseHP: 5,
        baseSTR: 1,
        baseAGI: 1,
        baseDEF: 1,
        materiaChance: 0.03
    },
    {
        id: "knight",
        name: "Knight",
        minKills: 5,
        maxKills: 9,
        baseHP: 12,
        baseSTR: 2,
        baseAGI: 1,
        baseDEF: 2,
        materiaChance: 0.08
    },
    {
        id: "elite_knight",
        name: "Elite Knight",
        minKills: 10,
        maxKills: 19,
        baseHP: 25,
        baseSTR: 3,
        baseAGI: 2,
        baseDEF: 3,
        materiaChance: 0.15
    },
    {
        id: "champion_knight",
        name: "Champion Knight",
        minKills: 20,
        maxKills: null,
        baseHP: 40,
        baseSTR: 4,
        baseAGI: 3,
        baseDEF: 4,
        materiaChance: 0.22
    }
];

// -------------------------------------------------------
// JSON Loader — fires immediately
// -------------------------------------------------------
(function loadEnemyJSON() {
    fetch("Data/enemies.json")
        .then(res => res.json())
        .then(data => {
            if (data && Array.isArray(data.enemies)) {
                window.EnemyTypes = data.enemies;
                enemyDataReady = true;
                console.log("Enemy JSON loaded:", EnemyTypes.length, "enemies");
            } else {
                throw new Error("Invalid enemy JSON structure");
            }
        })
        .catch(err => {
            enemyDataFailed = true;
            console.error("Enemy JSON load failed, using fallback:", err);
            window.EnemyTypes = FALLBACK_ENEMIES;
        });
})();


// -------------------------------------------------------
// Title generator — Souls-like based on EnemyLevel
// (unchanged, based on level, not JSON)
// -------------------------------------------------------
window.getEnemyTitle = function () {

    const lv = EnemyLevel.level;

    if (lv <= 3)   return "Rustborn Wanderer";
    if (lv <= 6)   return "Ironbound Shade";
    if (lv <= 9)   return "Hollowed Warden";
    if (lv <= 13)  return "Grave-Forged Sentinel";
    if (lv <= 18)  return "Ashen Revenant";
    if (lv <= 25)  return "Blackstar Accuser";
    if (lv <= 35)  return "Bloodlit Arbiter";
    if (lv <= 50)  return "Abyss-Tethered Knight";

    return "Pale Judge of the Void";
};


// -------------------------------------------------------
// Enemy template pick by kills (minKills / maxKills)
// -------------------------------------------------------
function pickEnemyTemplate(kills) {

    const list = (EnemyTypes && EnemyTypes.length)
        ? EnemyTypes
        : FALLBACK_ENEMIES;

    // Filter all that are valid for this kill count
    let candidates = list.filter(e => {
        const min = (typeof e.minKills === "number") ? e.minKills : 0;
        const max = (typeof e.maxKills === "number") ? e.maxKills : Infinity;
        return kills >= min && kills <= max;
    });

    // If nothing matches (e.g. kills beyond config), pick
    // the hardest enemy whose minKills <= kills.
    if (candidates.length === 0) {
        let best = null;
        for (let e of list) {
            const min = (typeof e.minKills === "number") ? e.minKills : 0;
            if (kills >= min) {
                if (!best || min > best.minKills) {
                    best = e;
                }
            }
        }
        if (best) candidates = [best];
    }

    if (!candidates.length) {
        console.warn("No enemy candidates found, using first fallback.");
        return FALLBACK_ENEMIES[0];
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    return pick;
}


// -------------------------------------------------------
// Enemy factory — creates a full RPG enemy object
// -------------------------------------------------------
window.spawnEnemy = function (kills) {

    const proto = pickEnemyTemplate(kills);

    CurrentEnemy = {
        id: proto.id || null,
        name: proto.name || "Unknown Knight",

        // Base stats
        maxHP: proto.baseHP || 10,
        hp:    proto.baseHP || 10,

        STR: proto.baseSTR || 1,
        AGI: proto.baseAGI || 1,
        DEF: proto.baseDEF || 1,

        // Independent leveling
        level: 1,
        xp: 0,
        nextXP: 10 + (proto.baseHP || 10),

        // Status flags
        isPoisoned: false,

        // Passive enhancements (enemy materia)
        materia: {
            counter: false,
            thorns:  false,
            poison:  false
        },

        // Meta
        minKills: proto.minKills || 0,
        maxKills: (typeof proto.maxKills === "number") ? proto.maxKills : null,
        materiaChance: proto.materiaChance || 0
    };

    // Hook into shared materia system if present
    if (typeof assignRandomEnemyMateria === "function") {
        assignRandomEnemyMateria(CurrentEnemy, CurrentEnemy.materiaChance);
    } else {
        // Local fallback if materiasystem.js hasn’t loaded
        if (Math.random() < CurrentEnemy.materiaChance) {
            const r = Math.random();
            if      (r < 0.33) CurrentEnemy.materia.counter = true;
            else if (r < 0.66) CurrentEnemy.materia.thorns  = true;
            else               CurrentEnemy.materia.poison  = true;
        }
    }

    console.log("Spawned enemy:", CurrentEnemy);

    window.dispatchEvent(new CustomEvent("ENEMY_SPAWNED", {
        detail: { enemy: CurrentEnemy }
        //banter?
        /*    const name = e.detail.enemy.name;
    if (Banter.data.knight[name]) {
        Banter.say("knight", "intro");
    }*/
    }));
};


// -------------------------------------------------------
// Reset enemy HP whenever a new knight spawns
// -------------------------------------------------------
window.resetEnemyHP = function () {

    if (!CurrentEnemy) return;

    CurrentEnemy.hp = CurrentEnemy.maxHP;

    window.dispatchEvent(new CustomEvent("ENEMY_HP_RESET", {
        detail: { hp: CurrentEnemy.hp, max: CurrentEnemy.maxHP }
    }));
};
