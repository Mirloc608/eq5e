// module/item/eq-item.js
// EQ5e Item Document Class
// ------------------------------------------------

export class EQ5eItem extends Item {
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

      case "recipe":
        this._prepareRecipe(sys);
        break;

      default:
        break;
    }
  }

  // ------------------------------------------------
  // Weapon
  // ------------------------------------------------
  _prepareWeapon(sys) {
    sys.damage = sys.damage || "1d4";
    sys.atk = Number(sys.atk ?? 0);
    sys.delay = Number(sys.delay ?? 30);
    sys.weight = Number(sys.weight ?? 1);
    sys.slot = sys.slot || "primary";
  }

  // ------------------------------------------------
  // Armor
  // ------------------------------------------------
  _prepareArmor(sys) {
    sys.ac = Number(sys.ac ?? 0);
    sys.weight = Number(sys.weight ?? 1);
    sys.slot = sys.slot || "chest";
    sys.resists = sys.resists || {};
  }

  // ------------------------------------------------
  // Spell
  // ------------------------------------------------
  _prepareSpell(sys) {
    sys.power = Number(sys.power ?? 0);
    sys.duration = Number(sys.duration ?? 0);
    sys.resistType = sys.resistType || null;
    sys.resistDC = Number(sys.resistDC ?? 0);
    sys.effectType = sys.effectType || "damage";
    sys.bonuses = sys.bonuses || {};
    sys.tickInterval = Number(sys.tickInterval ?? 6);
    sys.manaCost = Number(sys.manaCost ?? 0);
  }

  // ------------------------------------------------
  // Discipline
  // ------------------------------------------------
  _prepareDiscipline(sys) {
    sys.power = Number(sys.power ?? 0);
    sys.duration = Number(sys.duration ?? 0);
    sys.enduranceCost = Number(sys.enduranceCost ?? 0);
    sys.cooldown = Number(sys.cooldown ?? 0);
    sys.effectType = sys.effectType || "damage";
    sys.utilityType = sys.utilityType || null;
    sys.resistType = sys.resistType || null;
    sys.resistDC = Number(sys.resistDC ?? 0);
    sys.bonuses = sys.bonuses || {};
    sys.tickInterval = Number(sys.tickInterval ?? 6);
  }

  // ------------------------------------------------
  // Recipe
  // ------------------------------------------------
  _prepareRecipe(sys) {
    sys.skill = sys.skill || null;
    sys.difficulty = Number(sys.difficulty ?? 0);
    sys.ingredients = sys.ingredients || [];
    sys.results = sys.results || [];
  }
}
