/**
 * EQ5e Actor Sheet (Foundry VTT v13+)
 * ApplicationV2 / ActorSheetV2 implementation
 */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

export class EQ5eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "eq5e-actor-sheet",
    classes: ["eq5e", "sheet", "actor"],
    window: {
      title: "EQ5e Actor Sheet"
    },
    position: {
      width: 760,
      height: 640
    }
  });

  /** Which handlebars template to render */
  static PARTS = {
    body: {
      template: "systems/eq5e/templates/actor/character-sheet.hbs"
    }
  };

  /** Data for the template */
  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);
    ctx.system = ctx.system ?? this.actor?.system ?? {};
    ctx.flags = ctx.flags ?? this.actor?.flags ?? {};
    ctx.items = this.actor?.items?.map(i => i.toObject()) ?? [];
    ctx.actorType = this.actor?.type;
    return ctx;
  }
}

Hooks.once("init", () => {
  try {
    // Register the sheet (V13 still uses registerSheet; the class is now V2)
    Actors.registerSheet("eq5e", EQ5eActorSheet, {
      types: ["character", "npc", "pet"],
      makeDefault: true,
      label: "EQ5e Actor Sheet"
    });
    console.log("[EQ5E] Registered EQ5e ActorSheetV2 for character/npc/pet");
  } catch (e) {
    console.error("[EQ5E] Failed to register EQ5e Actor Sheet", e);
  }
});