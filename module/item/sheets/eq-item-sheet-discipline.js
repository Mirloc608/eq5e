import { EQRolls } from "../../rolls/eq-rolls.js";

export class EQItemSheetDiscipline extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "item", "discipline"],
      width: 560,
      height: 480
    });
  }

  get template() {
    return "systems/eq5e/templates/items/item-sheet-discipline.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-roll-discipline").click(this._onRollDiscipline.bind(this));
  }

  async _onRollDiscipline(event) {
    event.preventDefault();
    const actor = this.item.actor;
    if (!actor) return ui.notifications.warn("No actor owns this discipline.");

    await EQRolls.rollDiscipline(actor, this.item);
  }
}
