// module/actor/sheets/eq-actor-sheet-base.js

export class EQActorSheetBase extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "actor"],
      width: 720,
      height: 640,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary" }]
    });
  }

  get template() {
    return "systems/eq5e/templates/actors/actor-sheet-base.html";
  }

  getData(options) {
    const data = super.getData(options);
    data.system = data.actor.system;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
  }
}
