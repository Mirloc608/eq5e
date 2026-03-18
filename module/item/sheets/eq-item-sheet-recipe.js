export class EQItemSheetRecipe extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "item", "recipe"],
      width: 560,
      height: 480
    });
  }

  get template() {
    return "systems/eq5e/templates/items/item-sheet-recipe.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-show-recipe").click(this._onShowRecipe.bind(this));
  }

  async _onShowRecipe(event) {
    event.preventDefault();
    const sys = this.item.system;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
      content: `
        <div><b>Recipe:</b> ${this.item.name}</div>
        <div><b>Skill:</b> ${sys.skill ?? "None"}</div>
        <div><b>Difficulty:</b> ${sys.difficulty ?? 0}</div>
      `
    });
  }
}
