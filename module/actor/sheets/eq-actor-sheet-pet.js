// module/actor/sheets/eq-actor-sheet-pet.js

import { EQActorSheetBase } from "./eq-actor-sheet-base.js";
import { EQRolls } from "../../rolls/eq-rolls.js";

export class EQActorSheetPet extends EQActorSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "actor", "pet"],
      width: 680,
      height: 620
    });
  }

  get template() {
    return "systems/eq5e/templates/actors/actor-sheet-pet.html";
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find(".eq-roll-skill").click(this._onRollSkill.bind(this));
  }

  async _onRollSkill(event) {
    event.preventDefault();
    const skillId = event.currentTarget.dataset.skill;
    if (!skillId) return;
    await EQRolls.rollSkill(this.actor, skillId);
  }
}
