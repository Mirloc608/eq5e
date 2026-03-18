// module/rolls/eq-rolls.js
// --------------------------------

export class EQRolls {
  static async rollWeaponAttack(actor, item) {
    const formula = item.system.attackFormula || "1d20 + @atk";
    const data = { atk: Number(actor.system.combat?.atk ?? 0) };
    return this._roll(actor, item, formula, data, "Weapon Attack");
  }

  static async rollSpell(actor, item) {
    const formula = item.system.damageFormula || "1d6 + @power";
    const data = { power: Number(item.system.power ?? 0) };
    return this._roll(actor, item, formula, data, "Spell");
  }

  static async rollDiscipline(actor, item) {
    const formula = item.system.damageFormula || "1d8 + @power";
    const data = { power: Number(item.system.power ?? 0) };
    return this._roll(actor, item, formula, data, "Discipline");
  }

  static async rollSkill(actor, skillId, formula = "1d20 + @mod") {
    const skill = actor.system.skills?.[skillId] ?? {};
    const data = { mod: Number(skill.mod ?? 0) };
    return this._roll(actor, null, formula, data, `Skill: ${skill.label ?? skillId}`);
  }

  static async _roll(actor, item, formula, data, label) {
    const roll = await new Roll(formula, data).evaluate({ async: true });
    roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${label}${item ? ": " + item.name : ""}`
    });
    return roll;
  }
}
