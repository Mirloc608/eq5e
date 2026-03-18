// module/scripts/item.js
// EQ5e Item Preparation Engine
// ----------------------------
// Responsibilities:
// - Normalize item data for all item types
// - Prepare weapon stats, armor stats, spell metadata, discipline metadata
// - Enforce equipment slot rules
// - Provide clean data for derived.js, combat.js, casting.js, disciplines.js
// - Keep logic modular and future-proof

export class EQ5eItem extends Item {
  /**
   * Foundry lifecycle hook.
   * Called automatically when item data is prepared.
   */
  prepareData() {
    super.prepareData();
    const sys = this.system;

    switch (this.type) {
      case "weapon":
        this._prepareWeapon(sys);
        break;

      case "armor":
        this._prepareArmor(sys);
        break;

      case "spell":
        this._prepareSpell(sys);
        break;

      case "discipline":
        this._prepareDiscipline(sys);
        break;

      case "consumable":
        this._prepareConsumable(sys);
        break;

      case "classFeature":
        this._prepareClassFeature(sys);
        break;

      default:
        // Generic items need no special prep
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Weapon Preparation
  // ---------------------------------------------------------------------------

  _prepareWeapon(sys) {
    // Normalize damage formula
    sys.damage = sys.damage || "1d4";

    // Normalize attack bonus
    sys.atk = Number(sys.atk ?? 0);

    // Weight, delay, and other stats are optional but supported
    sys.delay = Number(sys.delay ?? 30);
    sys.weight = Number(sys.weight ?? 1);

    // Equipment slot
    sys.slot = sys.slot || "primary";
  }

  // ---------------------------------------------------------------------------
  // Armor Preparation
  // ---------------------------------------------------------------------------

  _prepareArmor(sys) {
    sys.ac = Number(sys.ac ?? 0);
    sys.weight = Number(sys.weight ?? 1);
    sys.slot = sys.slot || "chest";

    // Resist bonuses
    sys.resists = sys.resists || {};
  }

  // ---------------------------------------------------------------------------
  // Spell Preparation
  // ---------------------------------------------------------------------------

  _prepareSpell(sys) {
    // Required fields
    sys.power = Number(sys.power ?? 0);
    sys.duration = Number(sys.duration ?? 0);

    // Resist type (fire, cold, magic, poison, disease)
    sys.resistType = sys.resistType || null;
    sys.resistDC = Number(sys.resistDC ?? 0);

    // Spell effect type: damage, heal, buff, debuff, dot, hot
    sys.effectType = sys.effectType || "damage";

    // Buff/debuff bonuses
    sys.bonuses = sys.bonuses || {};

    // Tick interval for DoTs/HoTs
    sys.tickInterval = Number(sys.tickInterval ?? 6);

    // Mana cost
    sys.manaCost = Number(sys.manaCost ?? 0);
  }

  // ---------------------------------------------------------------------------
  // Discipline Preparation
  // ---------------------------------------------------------------------------

  _prepareDiscipline(sys) {
    // Required fields
    sys.power = Number(sys.power ?? 0);
    sys.duration = Number(sys.duration ?? 0);

    // Endurance cost
    sys.enduranceCost = Number(sys.enduranceCost ?? 0);

    // Cooldown in seconds
    sys.cooldown = Number(sys.cooldown ?? 0);

    // Discipline effect type: damage, buff, debuff, dot, hot, utility
    sys.effectType = sys.effectType || "damage";

    // Utility subtype: taunt, evade, feign, etc.
    sys.utilityType = sys.utilityType || null;

    // Resist type (for special attacks)
    sys.resistType = sys.resistType || null;
    sys.resistDC = Number(sys.resistDC ?? 0);

    // Buff/debuff bonuses
    sys.bonuses = sys.bonuses || {};

    // Tick interval for DoTs/HoTs
    sys.tickInterval = Number(sys.tickInterval ?? 6);
  }

  // ---------------------------------------------------------------------------
  // Consumables
  // ---------------------------------------------------------------------------

  _prepareConsumable(sys) {
    sys.power = Number(sys.power ?? 0);
    sys.duration = Number(sys.duration ?? 0);
    sys.bonuses = sys.bonuses || {};
  }

  // ---------------------------------------------------------------------------
  // Class Features
  // ---------------------------------------------------------------------------

  _prepareClassFeature(sys) {
    // Static bonuses
    sys.bonuses = sys.bonuses || {};

    // Level scaling rules
    sys.scaling = sys.scaling || null;
  }
}
