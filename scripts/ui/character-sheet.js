/**
 * EQ5e Actor Sheet (Foundry VTT v13+)
 * ApplicationV2 / ActorSheetV2 implementation
 */

const { ActorSheetV2 } = foundry.applications.sheets;
const { HandlebarsApplicationMixin } = foundry.applications.api;

/* ----------------------------------- Helpers -------------------------------- */
function _normalizeClassName(name) { return String(name ?? "").trim().toLowerCase(); }
function _getPrimaryClassItem(actor) { return actor?.items?.find(i => i.type === "class") ?? null; }
function _getPrimaryClassName(actor) {
  const cls = _getPrimaryClassItem(actor);
  return cls?.name ?? actor?.system?.details?.class ?? actor?.system?.class ?? "";
}

// Crest: prefer class item icon, fall back to mapping
function _crestForActor(actor) {
  const cls = _getPrimaryClassItem(actor);
  const img = cls?.getFlag?.("eq5e", "icon") || cls?.img;
  if (img && img !== "icons/svg/mystery-man.svg") return img;

  const c = _normalizeClassName(_getPrimaryClassName(actor));
  if (/(warrior|paladin|shadow|knight)/.test(c)) return "systems/eq5e/assets/ui/crest_knight.png";
  if (/(druid|ranger|shaman|beast|warden)/.test(c)) return "systems/eq5e/assets/ui/crest_dragon.png";
  if (/(cleric|priest|templar|healer)/.test(c)) return "systems/eq5e/assets/ui/crest_ankh.png";
  if (/(wizard|magician|mage|enchanter|necromancer|sorcerer)/.test(c)) return "systems/eq5e/assets/ui/crest_moon.png";
  if (/(rogue|bard|monk|assassin|skald)/.test(c)) return "systems/eq5e/assets/ui/crest_blades.png";
  return "systems/eq5e/assets/ui/crest_knight.png";
}

/* ---------------------------------- Sheet --------------------------------- */
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
    const actor = this.actor;

    ctx.actor = actor;
    ctx.system = actor?.system ?? {};
    ctx.flags = actor?.flags ?? {};
    ctx.items = actor?.items?.map(i => i.toObject()) ?? [];

    // UI setup
    ctx.eq5e = ctx.eq5e ?? {};
    ctx.eq5e.ui = {
      crest: _crestForActor(actor),
      parchment: "systems/eq5e/assets/ui/parchment.png"
    };

    // Sheet display data: class name from Item or system
    const classItem = _getPrimaryClassItem(actor);
    ctx.eq5e.sheet = ctx.eq5e.sheet ?? {};
    ctx.eq5e.sheet.className = classItem?.name ?? _getPrimaryClassName(actor) ?? "";

    // Vital stats: AC, Init, Speed, HP
    ctx.eq5e.sheet.vitals = ctx.eq5e.sheet.vitals ?? {
      ac: { value: foundry.utils.getProperty(actor, "system.attributes.ac.value") ?? 10 },
      init: { value: foundry.utils.getProperty(actor, "system.attributes.init.value") ?? 0 },
      speed: { value: foundry.utils.getProperty(actor, "system.attributes.movement.walk") ?? foundry.utils.getProperty(actor, "system.attributes.speed.value") ?? 30 },
      hp: {
        value: foundry.utils.getProperty(actor, "system.attributes.hp.value") ?? 0,
        max: foundry.utils.getProperty(actor, "system.attributes.hp.max") ?? 0
      }
    };

    // Abilities: map system abilities to display format
    const abilities = foundry.utils.getProperty(actor, "system.abilities") ?? {};
    ctx.eq5e.sheet.abilities = Object.entries(abilities).map(([k, v]) => ({
      key: k,
      label: (v?.label ?? k).toString().toUpperCase(),
      value: v?.value ?? 10,
      mod: v?.mod ?? 0,
      save: v?.save ?? 0
    }));

    // Skills: map system skills to display format
    const skills = foundry.utils.getProperty(actor, "system.skills") ?? {};
    ctx.eq5e.sheet.skills = Object.entries(skills).map(([k, v]) => ({
      key: k,
      label: v?.label ?? k,
      total: v?.total ?? v?.mod ?? 0,
      proficient: !!v?.proficient
    }));

    return ctx;
  }
}

Hooks.once("init", () => {
  try {
    // Register the sheet using the namespaced API to avoid deprecated globals.
    foundry.documents.collections.Actors.registerSheet("eq5e", EQ5eActorSheet, {
      types: ["character", "npc", "pet"],
      makeDefault: true,
      label: "EQ5e Actor Sheet"
    });
    console.log("[EQ5E] Registered EQ5e ActorSheetV2 for character/npc/pet");
  } catch (e) {
    console.error("[EQ5E] Failed to register EQ5e Actor Sheet", e);
  }
});

console.log("[EQ5E] Character sheet script loaded");