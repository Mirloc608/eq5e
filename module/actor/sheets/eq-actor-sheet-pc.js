// module/actor/sheets/eq-actor-sheet-pc.js
// ------------------------------------------------------------
// EQ5e PC Actor Sheet
// Handles:
//  • Skill rolls
//  • Class feature rolls
//  • Race feature rolls
//  • Class tab switching
//  • Race selection UI
//  • Inventory / Spellbook / Disciplines / Buffs
// ------------------------------------------------------------

import { EQActorSheetBase } from "./eq-actor-sheet-base.js";
import { EQRolls } from "../../rolls/eq-rolls.js";
import { EQCombat } from "../../scripts/combat.js";
import { EQClassRegistry } from "../../classes/eq-class-feature-helper.js";
import { EQRaceRegistry } from "../../races/eq-race-registry.js";

export class EQActorSheetPC extends EQActorSheetBase {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["eq5e", "sheet", "actor", "pc"],
      width: 800,
      height: 700,
      tabs: [
        { navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "summary" }
      ]
    });
  }

  get template() {
    return "systems/eq5e/templates/actors/actor-sheet-pc.html";
  }

  // ------------------------------------------------------------
  // Data
  // ------------------------------------------------------------
  getData(options) {
    const data = super.getData(options);
    const sys = data.actor.system;

    // Class
    const clsId = sys.class?.id;
    const cls = EQClassRegistry.get(clsId);
    data.eqClass = cls ?? null;

    const activeClassTab =
      sys.class?.activeTab ??
      (cls?.tabs?.length ? cls.tabs[0].id : null);

    data.activeClassTab = activeClassTab;

    // Race
    const raceMap = EQRaceRegistry.all();
    data.eqRaceOptions = raceMap;

    const raceId = sys.race?.id;
    const race = raceMap[raceId] ?? null;
    data.eqRace = race;

    return data;
  }

  // ------------------------------------------------------------
  // Listeners
  // ------------------------------------------------------------
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Skills
    html.find(".eq-roll-skill").click(this._onRollSkill.bind(this));

    // Class features
    html.find(".eq-roll-class-feature").click(this._onRollClassFeature.bind(this));

    // Race features
    html.find(".eq-roll-race-feature").click(this._onRollRaceFeature.bind(this));

    // Class tabs
    html.find(".eq-class-tab").click(this._onClassTabClick.bind(this));

    // Race selection
    html.find(".eq-race-select").change(this._onRaceChange.bind(this));

    // Inventory
    html.find(".eq-roll-weapon-attack").click(ev => this._rollWeapon(ev));
    html.find(".eq-show-ac").click(ev => this._showArmor(ev));
    html.find(".eq-use-consumable").click(ev => this._useConsumable(ev));

    // Spellbook
    html.find(".eq-roll-spell").click(ev => this._rollSpell(ev));

    // Disciplines
    html.find(".eq-roll-discipline").click(ev => this._rollDiscipline(ev));

    // Buffs
    html.find(".eq-remove-buff").click(ev => this._removeBuff(ev));
  }

  // ------------------------------------------------------------
  // Rolls
  // ------------------------------------------------------------
  async _onRollSkill(event) {
    const skillId = event.currentTarget.dataset.skill;
    if (skillId) await EQRolls.rollSkill(this.actor, skillId);
  }

  async _onRollClassFeature(event) {
    const featureId = event.currentTarget.dataset.featureId;
    const clsId = this.actor.system.class?.id;
    const cls = EQClassRegistry.get(clsId);
    if (cls?.rollFeature) await cls.rollFeature(this.actor, featureId);
  }

  async _onRollRaceFeature(event) {
    const featureId = event.currentTarget.dataset.featureId;
    const raceId = this.actor.system.race?.id;
    const race = EQRaceRegistry.get(raceId);
    if (race?.rollFeature) await race.rollFeature(this.actor, featureId);
  }

  async _rollWeapon(event) {
    const id = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(id);
    const target = Array.from(game.user.targets)[0]?.actor ?? null;
    if (target) await EQCombat.weaponAttack(this.actor, item, target);
    else await EQRolls.rollWeaponAttack(this.actor, item);
  }

  async _rollSpell(event) {
    const id = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(id);
    await EQRolls.rollSpell(this.actor, item);
  }

  async _rollDiscipline(event) {
    const id = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(id);
    await EQRolls.rollDiscipline(this.actor, item);
  }

  async _showArmor(event) {
    const id = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(id);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div>Armor Class: <b>${item.system.ac}</b></div>`
    });
  }

  async _useConsumable(event) {
    const id = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(id);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `<div>${item.name} used.</div>`
    });
  }

  async _removeBuff(event) {
    const id = event.currentTarget.dataset.buffId;
    const buffs = foundry.utils.duplicate(this.actor.system.buffs);
    delete buffs[id];
    await this.actor.update({ "system.buffs": buffs });
  }

  // ------------------------------------------------------------
  // Tabs & Race Selection
  // ------------------------------------------------------------
  async _onClassTabClick(event) {
    const tab = event.currentTarget.dataset.tab;
    await this.actor.update({ "system.class.activeTab": tab });
    this.render(false);
  }

  async _onRaceChange(event) {
    const raceId = event.currentTarget.value || null;
    const race = EQRaceRegistry.get(raceId);
    await this.actor.update({
      "system.race.id": raceId,
      "system.race.label": race?.label ?? "",
      "system.race.bonuses": race?.bonuses ?? {}
    });
    this.render(false);
  }
}
