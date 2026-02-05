/**
 * EQ5e Actor Sheet (Foundry VTT v13+) - ApplicationV2 / ActorSheetV2
 * Drop-in: Mount + Pet paper dolls are separate tabs.
 *
 * EQ5E_SHEET_DROPIN_V2_MOUNT_PET_PAPERDOLLS_001
 *
 * Notes:
 * - DEFAULT_OPTIONS.tag MUST be "form"
 * - HBS template MUST render a single root element
 * - HBS template MUST NOT include a <form> element (ActorSheetV2 provides it)
 * - We do not use private fields (#) to avoid transpilation/runtime issues.
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

function eq5eGet(obj, path, fallback=null) {
  try { return foundry.utils.getProperty(obj, path) ?? fallback; } catch (e) { return fallback; }
}
function eq5eSet(obj, path, value) {
  try { return foundry.utils.setProperty(obj, path, value); } catch (e) { /* noop */ }
}

function _normalizeClassName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function _getPrimaryClassName(actor) {
  const cls = actor?.items?.find(i => i.type === "class") ?? null;
  return cls?.name ?? actor?.system?.details?.class ?? actor?.system?.class ?? "";
}

function _crestForActor(actor) {
  const c = _normalizeClassName(_getPrimaryClassName(actor));
  if (/(warrior|paladin|shadow|knight)/.test(c)) return "systems/eq5e/assets/ui/crest_knight.png";
  if (/(druid|ranger|shaman|beast|warden)/.test(c)) return "systems/eq5e/assets/ui/crest_dragon.png";
  if (/(cleric|priest|templar|healer)/.test(c)) return "systems/eq5e/assets/ui/crest_ankh.png";
  if (/(wizard|magician|mage|enchanter|necromancer|sorcerer)/.test(c)) return "systems/eq5e/assets/ui/crest_moon.png";
  if (/(rogue|bard|monk|assassin|skald)/.test(c)) return "systems/eq5e/assets/ui/crest_blades.png";
  return "systems/eq5e/assets/ui/crest_knight.png";
}

function _signed(n) {
  const x = Number(n ?? 0);
  return x >= 0 ? `+${x}` : `${x}`;
}

/** Resolve a dropped document from a drag event. */
async function _resolveDropDocument(ev) {
  const data = TextEditor.getDragEventData(ev);
  if (!data) return null;

  // Common: {type:"Item", uuid:"Actor.xxx.Item.yyy"} or {type:"Item", id:"yyy", pack:"world.foo"}
  if (data.uuid) return fromUuid(data.uuid);
  if (data.type === "Item" && data.id && data.pack) {
    const pack = game.packs?.get(data.pack);
    if (!pack) return null;
    return pack.getDocument(data.id);
  }
  // Allow dragging Actor to set mount/pet by flag (optional)
  if (data.type === "Actor" && data.uuid) return fromUuid(data.uuid);

  return null;
}

function _defaultSlots(target) {
  // target: "self" | "mount" | "pet"
  if (target === "mount") {
    return [
      { key: "mount", label: "Mount", allowed: "mount" },
      { key: "saddle", label: "Saddle", allowed: "mountGear" },
      { key: "barding", label: "Barding", allowed: "mountGear" },
      { key: "tack", label: "Tack", allowed: "mountGear" },
      { key: "bags", label: "Saddlebags", allowed: "mountGear" }
    ];
  }
  if (target === "pet") {
    return [
      { key: "pet", label: "Pet", allowed: "pet" },
      { key: "collar", label: "Collar", allowed: "petGear" },
      { key: "harness", label: "Harness", allowed: "petGear" },
      { key: "armor", label: "Pet Armor", allowed: "petGear" },
      { key: "focus", label: "Focus", allowed: "petGear" }
    ];
  }

  // Character "self" paper doll (minimal; expand later)
  return [
    { key: "head", label: "Head", allowed: "armor" },
    { key: "chest", label: "Chest", allowed: "armor" },
    { key: "hands", label: "Hands", allowed: "armor" },
    { key: "legs", label: "Legs", allowed: "armor" },
    { key: "feet", label: "Feet", allowed: "armor" },
    { key: "neck", label: "Neck", allowed: "jewelry" },
    { key: "ring1", label: "Ring 1", allowed: "jewelry" },
    { key: "ring2", label: "Ring 2", allowed: "jewelry" },
    { key: "primary", label: "Primary", allowed: "weapon" },
    { key: "secondary", label: "Secondary", allowed: "weapon/shield" }
  ];
}

function _semanticTypeOf(item) {
  // Prefer semanticType if present, else use Foundry Item type
  const sem = eq5eGet(item, "flags.eq5e.semanticType", null);
  return sem ?? item?.type ?? null;
}

function _equipTargetOf(item) {
  return String(eq5eGet(item, "flags.eq5e.equip.target", "self") ?? "self");
}

function _equipSlotOf(item) {
  return String(eq5eGet(item, "flags.eq5e.equip.slot", "") ?? "");
}

async function _rollToChat({ label, formula, data, speaker, flavor=null }) {
  const roll = new Roll(formula, data);
  await roll.evaluate(); // async by default in v13
  const chatData = {
    speaker,
    flavor: flavor ?? `<strong>${label}</strong>`,
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    roll
  };
  return ChatMessage.create(chatData);
}

export class EQ5eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "eq5e-actor-sheet",
    classes: ["eq5e", "sheet", "actor"],
    tag: "form",
    form: { submitOnChange: true, closeOnSubmit: false },
    position: { width: 900, height: 740 },
    window: { title: "EQ5e Actor Sheet" }
  });

  static TABS = {
    sheet: {
      tabs: [
        { id: "character", group: "sheet", label: "Character" },
        { id: "inventory", group: "sheet", label: "Inventory" },
        { id: "paperdoll", group: "sheet", label: "Gear" },
        { id: "mount", group: "sheet", label: "Mount" },
        { id: "pet", group: "sheet", label: "Pet" },
        { id: "spells", group: "sheet", label: "Spells" },
        { id: "aas", group: "sheet", label: "AAs" },
        { id: "bio", group: "sheet", label: "Bio" }
      ],
      initial: "character"
    }
  };

  static PARTS = {
    form: { template: "systems/eq5e/templates/actor/character-sheet.hbs" }
  };

  /** Build sheet view model from whatever your template.json/system currently has. */
  _buildSheetModel() {
    const actor = this.actor;
    const system = actor?.system ?? {};

    // Abilities (best-effort)
    const abil = system.abilities ?? system.ability ?? {};
    const abilityKeys = Object.keys(abil).length ? Object.keys(abil) : ["str","dex","con","int","wis","cha"];
    const abilities = abilityKeys.map(k => {
      const a = abil[k] ?? {};
      const score = Number(a.value ?? a.score ?? 10);
      const mod = Number(a.mod ?? Math.floor((score - 10)/2));
      const save = Number(a.save ?? mod);
      return { key: k, label: String(k).toUpperCase(), value: score, mod, save };
    });

    // Skills (best-effort; expects system.skills.<key>.total or .mod)
    const sk = system.skills ?? {};
    const skillKeys = Object.keys(sk);
    const skills = skillKeys.map(k => {
      const s = sk[k] ?? {};
      const total = Number(s.total ?? s.mod ?? 0);
      const prof = !!(s.proficient ?? s.proficiency ?? false);
      return { key: k, label: s.label ?? k, total, proficient: prof };
    });

    // Vitals (best-effort)
    const vitals = {
      ac: { value: Number(eq5eGet(system, "attributes.ac.value", eq5eGet(system, "ac", 10))) },
      init: { value: Number(eq5eGet(system, "attributes.init.value", eq5eGet(system, "initiative", 0))) },
      speed: { value: Number(eq5eGet(system, "attributes.movement.walk", eq5eGet(system, "attributes.speed.value", 30))) },
      hp: {
        value: Number(eq5eGet(system, "attributes.hp.value", eq5eGet(system, "hp.value", 0))),
        max: Number(eq5eGet(system, "attributes.hp.max", eq5eGet(system, "hp.max", 0)))
      }
    };

    // Items: group
    const items = actor?.items?.map(i => i.toObject()) ?? [];
    const byType = (t) => items.filter(i => i.type === t);
    const features = byType("feature");
    const feats = byType("feat");
    const spells = byType("spell");
    const aas = byType("aa");

    // Inventory = everything except class/race/spell/feature/feat/aa
    const inventory = items.filter(i => !["class","race","spell","feature","feat","aa"].includes(i.type));

    // Paperdolls: resolve equipped items by target+slot
    const allEquip = items.map(i => {
      const target = _equipTargetOf(i);
      const slot = _equipSlotOf(i);
      const equipped = !!eq5eGet(i, "flags.eq5e.equip.equipped", false);
      const sem = _semanticTypeOf(i);
      return { ...i, eq5eEquipTarget: target, eq5eSlot: slot, eq5eEquipped: equipped, eq5eSemantic: sem };
    });

    const dollFor = (target) => {
      const slots = _defaultSlots(target).map(s => ({ ...s }));
      for (const s of slots) {
        const it = allEquip.find(i => i.eq5eEquipped && i.eq5eEquipTarget === target && i.eq5eSlot === s.key) ?? null;
        s.item = it ? { _id: it._id, name: it.name, type: it.type, semantic: it.eq5eSemantic } : null;
      }
      return { slots };
    };

    const className = _getPrimaryClassName(actor);

    return {
      className,
      vitals,
      abilities,
      skills,
      items: { features, feats, spells, aas, inventory, all: items },
      paperdoll: {
        self: dollFor("self"),
        mount: dollFor("mount"),
        pet: dollFor("pet")
      }
    };
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    ctx.actor = ctx.actor ?? this.actor;
    ctx.system = ctx.system ?? this.actor?.system ?? {};
    ctx.flags = ctx.flags ?? this.actor?.flags ?? {};
    ctx.items = ctx.items ?? (this.actor?.items?.map(i => i.toObject()) ?? []);
    ctx.actorType = this.actor?.type;

    ctx.eq5e = ctx.eq5e ?? {};
    ctx.eq5e.ui = {
      crest: _crestForActor(this.actor),
      parchment: "systems/eq5e/assets/ui/parchment.png"
    };

    const model = this._buildSheetModel();
    ctx.eq5e.sheet = model;
    ctx.eq5e.items = model.items;
    ctx.eq5e.paperdoll = model.paperdoll;

    return ctx;
  }

  /** V2: attach listeners to the rendered part */
  _attachPartListeners(partId, html) {
    super._attachPartListeners(partId, html);

    // Click actions
    html.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", (ev) => this._onAction(ev));
    });

    // Drop targets for equipment slots
    html.querySelectorAll("[data-eq5e-drop-slot='1']").forEach(el => {
      el.addEventListener("dragover", (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = "copy"; });
      el.addEventListener("drop", (ev) => this._onDropToSlot(ev));
    });

    // Optional: clear-token drag
    html.querySelectorAll("[data-eq5e-clear-token='1']").forEach(el => {
      el.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/plain", JSON.stringify({ eq5e: "clear-slot" }));
      });
    });
  }

  async _onAction(event) {
    const btn = event.currentTarget;
    const action = btn?.dataset?.action;
    if (!action) return;

    try {
      switch (action) {
        case "editImage": return this._onEditImage(event, btn);
        case "rollAbility": return this._onRollAbility(event, btn);
        case "rollSave": return this._onRollSave(event, btn);
        case "rollSkill": return this._onRollSkill(event, btn);
        case "unequipSlot": return this._onUnequipSlot(event, btn);
        case "toggleEquip": return this._onToggleEquip(event, btn);
        case "focusTab": return this._focusTab(btn.dataset.tab);
        default:
          console.warn("[EQ5E] Unknown action:", action);
      }
    } catch (e) {
      console.error("[EQ5E] Action failed", action, e);
      ui.notifications?.error("Action failed (see console).");
    }
  }

  _focusTab(tabId) {
    // Tabs are handled by ActorSheetV2; triggering click on the tab anchor is the most reliable.
    const el = this.element?.querySelector?.(`nav[data-group="sheet"] a.item[data-tab="${tabId}"]`);
    el?.click?.();
  }

  async _onEditImage(event, target) {
    event.preventDefault();
    // Use FilePicker.browse to avoid position issues in some V2 contexts
    const current = this.actor?.img ?? "";
    const fp = new FilePicker({
      type: "image",
      current,
      callback: async (path) => {
        // Only update img; never touch name to avoid "name may not be undefined"
        await this.actor.update({ img: path });
      }
    });
    return fp.render(true);
  }

  async _onRollAbility(event, target) {
    event.preventDefault();
    const ability = target.dataset.ability;
    if (!ability) return;

    const model = this._buildSheetModel();
    const a = model.abilities.find(x => x.key === ability);
    if (!a) return ui.notifications?.warn(`Unknown ability ${ability}`);

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `${this.actor.name} — ${ability.toUpperCase()} Check (${_signed(a.mod)})`;
    return _rollToChat({
      label,
      formula: "1d20 + @mod",
      data: { mod: a.mod },
      speaker
    });
  }

  async _onRollSave(event, target) {
    event.preventDefault();
    const ability = target.dataset.ability;
    if (!ability) return;

    const model = this._buildSheetModel();
    const a = model.abilities.find(x => x.key === ability);
    if (!a) return ui.notifications?.warn(`Unknown save ${ability}`);

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `${this.actor.name} — ${ability.toUpperCase()} Save (${_signed(a.save)})`;
    return _rollToChat({
      label,
      formula: "1d20 + @mod",
      data: { mod: a.save },
      speaker
    });
  }

  async _onRollSkill(event, target) {
    event.preventDefault();
    const skill = target.dataset.skill;
    if (!skill) return;

    const model = this._buildSheetModel();
    const s = model.skills.find(x => x.key === skill);
    if (!s) return ui.notifications?.warn(`Unknown skill ${skill}`);

    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const label = `${this.actor.name} — ${s.label} (${_signed(s.total)})`;
    return _rollToChat({
      label,
      formula: "1d20 + @mod",
      data: { mod: s.total },
      speaker
    });
  }

  async _onToggleEquip(event, target) {
    event.preventDefault();
    const itemId = target.dataset.itemId;
    const item = this.actor.items?.get(itemId);
    if (!item) return;

    const cur = !!eq5eGet(item, "flags.eq5e.equip.equipped", false);
    await item.setFlag("eq5e", "equip.equipped", !cur);
    // re-render to update paperdolls
    return this.render({ force: true });
  }

  async _onUnequipSlot(event, target) {
    event.preventDefault();
    const slot = target.dataset.slot;
    const doll = target.dataset.doll ?? "self"; // "self"|"mount"|"pet"
    if (!slot) return;

    // Find an item equipped in that slot+target and clear it
    const hit = this.actor.items?.find(i =>
      !!eq5eGet(i, "flags.eq5e.equip.equipped", false) &&
      _equipTargetOf(i) === doll &&
      _equipSlotOf(i) === slot
    );

    if (hit) {
      await hit.setFlag("eq5e", "equip.equipped", false);
      await hit.setFlag("eq5e", "equip.slot", "");
    }
    return this.render({ force: true });
  }

  async _onDropToSlot(event) {
    event.preventDefault();

    const slotEl = event.currentTarget;
    const slot = slotEl.dataset.slot;
    const doll = slotEl.dataset.doll ?? "self"; // which paperdoll tab

    // Clear-token support
    try {
      const raw = event.dataTransfer?.getData("text/plain") ?? "";
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.eq5e === "clear-slot") {
          const fakeBtn = { dataset: { slot, doll } };
          return this._onUnequipSlot(event, fakeBtn);
        }
      }
    } catch (e) { /* ignore */ }

    const doc = await _resolveDropDocument(event);
    if (!doc) return;

    // If user drops an Actor onto mount/pet "pet/mount" slot, store UUIDs for later automation (optional)
    if (doc.documentName === "Actor" && (doll === "mount" || doll === "pet")) {
      const flagPath = (doll === "mount") ? "mount.actorUuid" : "pet.actorUuid";
      await this.actor.setFlag("eq5e", flagPath, doc.uuid);
      ui.notifications?.info(`EQ5E: Linked ${doll} to ${doc.name}.`);
      return this.render({ force: true });
    }

    // Must be an Item (either embedded or compendium/world)
    if (doc.documentName !== "Item") return;

    // If the item is from a compendium, import it to the actor first.
    let item = doc;
    const isEmbedded = !!(doc.parent && doc.parent.uuid === this.actor.uuid);
    if (!isEmbedded) {
      // Create embedded copy
      const data = doc.toObject();
      delete data._id;
      const created = await this.actor.createEmbeddedDocuments("Item", [data]);
      item = created?.[0] ?? null;
      if (!item) return;
    } else {
      item = this.actor.items.get(doc.id);
    }

    const sem = _semanticTypeOf(item);
    const allowed = String(slotEl.dataset.allowed ?? "");

    // Basic compatibility rule:
    // - If allowed is "mount" or "pet" only accept semanticType mount/pet
    // - If allowed is "mountGear" accept semanticType mountGear OR type equipment
    // - If allowed is "petGear" accept semanticType petGear OR type equipment
    const ok =
      (allowed === "mount" && sem === "mount") ||
      (allowed === "pet" && sem === "pet") ||
      (allowed === "mountGear" && (sem === "mountGear" || item.type === "equipment")) ||
      (allowed === "petGear" && (sem === "petGear" || item.type === "equipment")) ||
      (allowed === "weapon/shield" && ["weapon","shield"].includes(item.type)) ||
      (allowed === "weapon" && item.type === "weapon") ||
      (allowed === "armor" && ["armor","shield"].includes(item.type)) ||
      (allowed === "jewelry" && item.type === "jewelry");

    if (!ok) {
      ui.notifications?.warn(`That item doesn't fit the ${slot} slot.`);
      return;
    }

    // Swap behavior: if occupied, unequip existing first
    const existing = this.actor.items?.find(i =>
      !!eq5eGet(i, "flags.eq5e.equip.equipped", false) &&
      _equipTargetOf(i) === doll &&
      _equipSlotOf(i) === slot
    );
    if (existing && existing.id !== item.id) {
      await existing.setFlag("eq5e", "equip.equipped", false);
      await existing.setFlag("eq5e", "equip.slot", "");
    }

    // Equip dropped
    await item.setFlag("eq5e", "equip.target", doll);
    await item.setFlag("eq5e", "equip.slot", slot);
    await item.setFlag("eq5e", "equip.equipped", true);

    return this.render({ force: true });
  }
}

Hooks.once("init", () => {
  try {
    foundry.documents.collections.Actors.registerSheet("eq5e", EQ5eActorSheet, {
      types: ["character", "npc", "pet"],
      makeDefault: true,
      label: "EQ5e Actor Sheet (V2)"
    });
    console.log("[EQ5E] Registered EQ5e Actor Sheet (V2) — EQ5E_SHEET_DROPIN_V2_MOUNT_PET_PAPERDOLLS_001");
  } catch (e) {
    console.error("[EQ5E] Failed to register EQ5e Actor Sheet", e);
  }
});
