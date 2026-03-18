export class EQItemSheetArmor extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "item", "armor"],
      width: 560,
      height: 480
    });
  }

  get template() {
    return "systems/eq5e/templates/items/item-sheet-armor.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-show-ac").click(this._onShowAC.bind(this));
  }

  async _onShowAC(event) {
    event.preventDefault();
    const ac = this.item.system.ac ?? 0;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
      content: `<div>Armor Class: <b>${ac}</b></div>`
    });
  }
}
