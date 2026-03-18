// module/scripts/class-features.js
// EQ5e Class Feature Engine
// -------------------------
// Responsibilities:
// - Aggregate passive bonuses from class features
// - Support level-scaling (e.g., +1 ATK per 5 levels)
// - Provide a unified interface for derived.js, combat.js, spells.js, etc.
// - Clean ES module imports, no globals

export class EQ5eClassFeatures {
  /**
   * Main entry point.
   * Returns a normalized buff structure:
   *
   * {
   *   stats: { str: +2, sta: +5 },
   *   combat: { atk: +10, haste: 0.10 },
   *   resists: { fire: +10 },
   *   regen: { hp: +1 }
   * }
   */
  static getBonuses(actor) {
    const features = this._getClassFeatures(actor);
    const result = this._emptyBonusState();

    for (const feature of features) {
      const data = feature.system;

      // 1) Static bonuses
      if (data.bonuses) {
        this._merge(result, data.bonuses);
      }

      // 2) Level-scaling bonuses
      if (data.scaling) {
        const scaled = this._applyScaling(actor, data.scaling);
        this._merge(result, scaled);
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Pull all class feature items from the actor.
   * These are Items of type "classFeature".
   */
  static _getClassFeatures(actor) {
    return actor.items.filter(i => i.type === "classFeature");
  }

  static _emptyBonusState() {
    return {
      stats: {},
      combat: {},
      resists: {},
      regen: {}
    };
  }

  /**
   * Merge source bonuses into target bonuses.
   * Adds numeric values; creates keys if missing.
   */
  static _merge(target, source) {
    if (!source) return;

    for (const [groupKey, groupVal] of Object.entries(source)) {
      if (!groupVal) continue;
      if (!target[groupKey]) target[groupKey] = {};

      const tgtGroup = target[groupKey];
      for (const [k, v] of Object.entries(groupVal)) {
        if (typeof v !== "number") continue;
        tgtGroup[k] = (tgtGroup[k] ?? 0) + v;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Level Scaling
  // ---------------------------------------------------------------------------
  /**
   * Scaling definition example:
   *
   * scaling: {
   *   atk: { per: 5, amount: 1 },     // +1 ATK per 5 levels
   *   haste: { per: 10, amount: 0.05 } // +5% haste per 10 levels
   * }
   *
   * Returns:
   * {
   *   combat: { atk: +X, haste: +Y }
   * }
   */
  static _applyScaling(actor, scaling) {
    const result = this._emptyBonusState();
    const level = actor.system.level ?? 1;

    for (const [key, rule] of Object.entries(scaling)) {
      const per = rule.per ?? 1;
      const amount = rule.amount ?? 0;

      const stacks = Math.floor(level / per);
      const total = stacks * amount;

      // Determine which group this scaling belongs to
      if (["str", "sta", "dex", "agi", "int", "wis", "cha"].includes(key)) {
        result.stats[key] = total;
      } else if (["fire", "cold", "magic", "poison", "disease"].includes(key)) {
        result.resists[key] = total;
      } else if (["atk", "ac", "haste", "critChance", "critDamage"].includes(key)) {
        result.combat[key] = total;
      } else if (["hp", "mana", "endurance"].includes(key)) {
        result.regen[key] = total;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Get a single combat bonus from class features.
   */
  static getCombatBonus(actor, key) {
    const bonuses = this.getBonuses(actor);
    return bonuses.combat[key] ?? 0;
  }

  /**
   * Get a single stat bonus from class features.
   */
  static getStatBonus(actor, key) {
    const bonuses = this.getBonuses(actor);
    return bonuses.stats[key] ?? 0;
  }
}
