import { EQRolls } from "../../rolls/eq-rolls.js";

export class EQItemSheetSpell extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "item", "spell"],
      width: 560,
      height: 480
    });
  }

  get template() {
    return "systems/eq5e/templates/items/item-sheet-spell.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-roll-spell").click(this._onRollSpell.bind(this));
  }

  async _onRollSpell(event) {
    event.preventDefault();
    const actor = this.item.actor;
    if (!actor) return ui.notifications.warn("No actor owns this spell.");

    await EQRolls.rollSpell(actor, this.item);
  }
}
