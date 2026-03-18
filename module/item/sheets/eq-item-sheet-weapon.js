import { EQRolls } from "../../rolls/eq-rolls.js";
import { EQCombat } from "../../scripts/combat.js";

export class EQItemSheetWeapon extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "item", "weapon"],
      width: 560,
      height: 480
    });
  }

  get template() {
    return "systems/eq5e/templates/items/item-sheet-weapon.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-roll-weapon-attack").click(this._onRollWeaponAttack.bind(this));
  }

  async _onRollWeaponAttack(event) {
    event.preventDefault();
    const actor = this.item.actor;
    if (!actor) return ui.notifications.warn("No actor owns this weapon.");

    const targets = Array.from(game.user.targets);
    const target = targets[0]?.actor ?? null;

    if (target) {
      await EQCombat.weaponAttack(actor, this.item, target);
    } else {
      await EQRolls.rollWeaponAttack(actor, this.item);
    }
  }
}
