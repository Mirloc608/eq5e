// module/scripts/equipment.js
// EQ5e Equipment Engine
// ---------------------
// Responsibilities:
// - Aggregate all bonuses from equipped items
// - Enforce slot rules (primary, secondary, head, chest, etc.)
// - Normalize stat/combat/resist/regen bonuses
// - Provide a unified interface for derived.js and buffs.js
// - Future-proof for item procs, auras, and conditional effects

export class EQ5eEquipment {
  /**
   * Main entry point.
   * Returns a normalized bonus structure:
   *
   * {
   *   stats: { str: +5, sta: +10 },
   *   combat: { atk: +15, ac: +30 },
   *   resists: { fire: +20 },
   *   regen: { hp: +1 }
   * }
   */
  static getBonuses(actor) {
    const items = this._getEquippedItems(actor);
    const result = this._emptyBonusState();

    for (const item of items) {
      const data = item.system;

      // 1) Static bonuses
      if (data.bonuses) {
        this._merge(result, data.bonuses);
      }

      // 2) Resist bonuses
      if (data.resists) {
        this._mergeGroup(result.resists, data.resists);
      }

      // 3) Combat bonuses
      if (data.combat) {
        this._mergeGroup(result.combat, data.combat);
      }

      // 4) Regen bonuses
      if (data.regen) {
        this._mergeGroup(result.regen, data.regen);
      }

      // 5) Future: item procs, auras, conditional effects
      // (Left intentionally open for expansion)
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Equipped Items
  // ---------------------------------------------------------------------------

  /**
   * Returns all items that are marked as equipped.
   */
  static _getEquippedItems(actor) {
    return actor.items.filter(i => i.system?.equipped === true);
  }

  // ---------------------------------------------------------------------------
  // Bonus Aggregation
  // ---------------------------------------------------------------------------

  static _emptyBonusState() {
    return {
      stats: {},
      combat: {},
      resists: {},
      regen: {}
    };
  }

  /**
   * Merge a full bonus structure into the result.
   */
  static _merge(target, source) {
    if (!source) return;

    for (const [groupKey, groupVal] of Object.entries(source)) {
      if (!groupVal) continue;
      if (!target[groupKey]) target[groupKey] = {};

      this._mergeGroup(target[groupKey], groupVal);
    }
  }

  /**
   * Merge a single bonus group (stats, combat, resists, regen).
   */
  static _mergeGroup(targetGroup, sourceGroup) {
    for (const [k, v] of Object.entries(sourceGroup)) {
      if (typeof v !== "number") continue;
      targetGroup[k] = (targetGroup[k] ?? 0) + v;
    }
  }

  // ---------------------------------------------------------------------------
  // Slot Rules (Optional Expansion)
  // ---------------------------------------------------------------------------
  /**
   * You can enforce slot rules here if desired.
   * Example:
   * - Only one primary weapon
   * - Only one chest piece
   * - Rings/earrings allow two slots
   *
   * For now, this is a placeholder for future expansion.
   */
  static validateSlots(actor) {
    // Example:
    // const equipped = this._getEquippedItems(actor);
    // enforce slot logic here
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Get a single stat bonus from equipment.
   */
  static getStatBonus(actor, key) {
    const bonuses = this.getBonuses(actor);
    return bonuses.stats[key] ?? 0;
  }

  /**
   * Get a single combat bonus from equipment.
   */
  static getCombatBonus(actor, key) {
    const bonuses = this.getBonuses(actor);
    return bonuses.combat[key] ?? 0;
  }

  /**
   * Get a single resist bonus from equipment.
   */
  static getResistBonus(actor, key) {
    const bonuses = this.getBonuses(actor);
    return bonuses.resists[key] ?? 0;
  }
}
