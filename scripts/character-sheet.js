/**
 * EQ5E Actor Sheet (Foundry VTT v13+)
 * ActorSheetV2 + HandlebarsApplicationMixin
 * Drop-in: Slot schema + allowed-slot enforcement (EQ5E_SHEET_SLOT_RULES_V1)
 */
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const DROPIN_TAG = "EQ5E_SHEET_SLOT_RULES_V1";

/* ---------------------------------- Slots --------------------------------- */
// Canonical paper-doll slot schema.
// Keys become actor.flags.eq5e.equipment.<key> = <itemId>
const EQ_SLOTS = [
  // Left column (top->mid)
  { key: "head", label: "Head", allowed: ["armor", "equipment"] },
  { key: "face", label: "Face", allowed: ["armor", "equipment", "jewelry"] },
  { key: "neck", label: "Neck", allowed: ["jewelry"] },
  { key: "shoulders", label: "Shoulders", allowed: ["armor", "equipment"] },
  { key: "arms", label: "Arms", allowed: ["armor", "equipment"] },
  { key: "wrists", label: "Wrists", allowed: ["armor", "equipment", "jewelry"] },
  { key: "hands", label: "Hands", allowed: ["armor", "equipment"] },
  { key: "ear1", label: "Ear 1", allowed: ["jewelry"] },
  { key: "ear2", label: "Ear 2", allowed: ["jewelry"] },

  // Right column (top->bottom)
  { key: "chest", label: "Chest", allowed: ["armor", "equipment"] },
  { key: "back", label: "Back", allowed: ["armor", "equipment"] },
  { key: "waist", label: "Waist", allowed: ["armor", "equipment"] },
  { key: "legs", label: "Legs", allowed: ["armor", "equipment"] },
  { key: "feet", label: "Feet", allowed: ["armor", "equipment"] },
  { key: "ring1", label: "Ring 1", allowed: ["jewelry"] },
  { key: "ring2", label: "Ring 2", allowed: ["jewelry"] },
  { key: "primary", label: "Primary", allowed: ["weapon"] },
  { key: "secondary", label: "Secondary", allowed: ["weapon", "shield"] },
  { key: "range", label: "Ranged", allowed: ["weapon"] },
  { key: "ammo", label: "Ammo", allowed: ["ammo"] },
];

// Human-friendly labels for UI
const TYPE_LABEL = {
  weapon: "Weapon",
  armor: "Armor",
  shield: "Shield",
  jewelry: "Jewelry",
  ammo: "Ammo",
  equipment: "Equipment",
  consumable: "Consumable",
  aa: "AA",
  spell: "Spell",
  feat: "Feat",
  feature: "Feature",
  class: "Class",
  race: "Race"
};

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
  if (/(bard)/.test(c)) return "systems/eq5e/assets/ui/bard.png";
  if (/(beastlord)/.test(c)) return "systems/eq5e/assets/ui/beastlord.png";
  if (/(berserker)/.test(c)) return "systems/eq5e/assets/ui/berserker.png";
  if (/(cleric)/.test(c)) return "systems/eq5e/assets/ui/cleric.png";
  if (/(druid)/.test(c)) return "systems/eq5e/assets/ui/druid.png";
  if (/(enchanter)/.test(c)) return "systems/eq5e/assets/ui/enchanter.png";
  if (/(magician)/.test(c)) return "systems/eq5e/assets/ui/magician.png";
  if (/(monk)/.test(c)) return "systems/eq5e/assets/ui/monk.png";
  if (/(necromancer)/.test(c)) return "systems/eq5e/assets/ui/necromancer.png";
  if (/(paladin)/.test(c)) return "systems/eq5e/assets/ui/paaladin.png";
  if (/(ranger)/.test(c)) return "systems/eq5e/assets/ui/ranger.png";
  if (/(rogue)/.test(c)) return "systems/eq5e/assets/ui/rogue.png";
  if (/(shadowknight)/.test(c)) return "systems/eq5e/assets/ui/shadowknight.png"; 
  if (/(shaman)/.test(c)) return "systems/eq5e/assets/ui/shaman.png"; 
  if (/(warrior)/.test(c)) return "systems/eq5e/assets/ui/warrior.png";
  if (/(wizard)/.test(c)) return "systems/eq5e/assets/ui/wizard.png";
  return "systems/eq5e/assets/ui/crest_knight.png";
}

/* ----------------------------- Tab Management ------------------------------ */
// Simple, sheet-owned tab logic (no Foundry Tabs controller dependency)
function _asElement(rootish) {
  // V2 may pass HTMLElement, DocumentFragment, or jQuery-ish wrappers in some cases.
  if (!rootish) return null;
  if (rootish instanceof HTMLElement) return rootish;
  if (rootish?.[0] instanceof HTMLElement) return rootish[0];
  if (rootish instanceof DocumentFragment) return rootish.firstElementChild;
  // last resort: if it has "element"
  if (rootish?.element instanceof HTMLElement) return rootish.element;
  return null;
}

function _setActiveTab(root, group, tabId) {
  const el = _asElement(root);
  if (!el) return;

  const nav = el.querySelector(`nav.eq5e-tabs[data-group="${group}"]`);
  const items = nav ? Array.from(nav.querySelectorAll(`a.item[data-group="${group}"]`)) : [];
  const panels = Array.from(el.querySelectorAll(`.tab[data-group="${group}"]`));

  for (const a of items) {
    const on = a.dataset.tab === tabId;
    a.classList.toggle("active", on);
  }
  for (const p of panels) {
    const on = p.dataset.tab === tabId;
    p.classList.toggle("active", on);
    // Force visibility regardless of theme CSS
    p.style.display = on ? "" : "none";
  }
}

/* ------------------------------ Roll Helpers ------------------------------ */
async function eqRoll(formula, data = {}, label = "Roll") {
  try {
    const r = new Roll(formula, data);
    await r.evaluate(); // async in v13
    return r.toMessage({ flavor: label });
  } catch (e) {
    console.error("[EQ5E] Roll failed", e);
    ui.notifications?.error("Roll failed (see console).");
  }
}

/* ------------------------------ Equip Helpers ------------------------------ */
function _slotDef(key) { return EQ_SLOTS.find(s => s.key === key) ?? null; }

function _allowedString(slotKey) {
  const s = _slotDef(slotKey);
  if (!s) return "";
  return (s.allowed ?? []).map(t => TYPE_LABEL[t] ?? t).join(", ");
}

function _itemEqType(item) {
  // Prefer explicit eq5e category
  const t = item?.type;
  // normalize some likely variants
  if (t === "equipment") return "equipment";
  return t;
}

function _canEquipInSlot(item, slotKey) {
  const s = _slotDef(slotKey);
  if (!s) return false;

  const itType = _itemEqType(item);
  if (s.allowed?.includes(itType)) return true;

  // Allow "equipment" items that declare a specific slot
  const declared = item?.flags?.eq5e?.slot || item?.system?.slot || null;
  if (declared && String(declared).toLowerCase() === String(slotKey).toLowerCase()) return true;

  return false;
}

async function _ensureOwnedItem(actor, itemDoc) {
  if (!actor || !itemDoc) return null;
  // already owned
  if (itemDoc.parent?.documentName === "Actor" && itemDoc.parent.id === actor.id) return itemDoc;

  // copy onto actor
  const obj = itemDoc.toObject();
  delete obj._id;
  const created = await actor.createEmbeddedDocuments("Item", [obj]);
  return created?.[0] ?? null;
}

async function _unequipSlot(actor, slotKey) {
  const equip = foundry.utils.getProperty(actor, "flags.eq5e.equipment") ?? {};
  const currentId = equip?.[slotKey] ?? null;
  if (!currentId) {
    await actor.setFlag("eq5e", `equipment.${slotKey}`, null);
    return;
  }
  const it = actor.items?.get(currentId) ?? null;
  if (it) {
    await it.setFlag("eq5e", "equipped", false);
    await it.unsetFlag?.("eq5e", "slot").catch(() => {});
  }
  await actor.setFlag("eq5e", `equipment.${slotKey}`, null);
}

async function _equipToSlot(actor, item, slotKey) {
  if (!actor || !item) return;

  // enforce allowed
  if (!_canEquipInSlot(item, slotKey)) {
    ui.notifications?.warn(`That doesn't fit in ${slotKey.toUpperCase()} (Allowed: ${_allowedString(slotKey) || "—"}).`);
    return;
  }

  // swap/unequip anything already in that slot
  const equip = foundry.utils.getProperty(actor, "flags.eq5e.equipment") ?? {};
  const prevId = equip?.[slotKey] ?? null;
  if (prevId && prevId !== item.id) {
    const prev = actor.items?.get(prevId);
    if (prev) {
      await prev.setFlag("eq5e", "equipped", false);
      await prev.unsetFlag?.("eq5e", "slot").catch(() => {});
    }
  }

  // If item is equipped in another slot, clear it there (move)
  for (const s of EQ_SLOTS) {
    const sid = equip?.[s.key];
    if (sid && sid === item.id && s.key !== slotKey) {
      await actor.setFlag("eq5e", `equipment.${s.key}`, null);
    }
  }

  await item.setFlag("eq5e", "equipped", true);
  await item.setFlag("eq5e", "slot", slotKey);
  await actor.setFlag("eq5e", `equipment.${slotKey}`, item.id);
}

/* ---------------------------------- Sheet --------------------------------- */
export class EQ5eActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "eq5e-actor-sheet",
    classes: ["eq5e", "sheet", "actor"],
    tag: "form",
    form: { submitOnChange: true, closeOnSubmit: false },
    position: { width: 940, height: 760 },
    window: { title: "EQ5e Actor Sheet" }
  });

  static PARTS = {
    form: { template: "systems/eq5e/templates/actor/character-sheet.hbs" }
  };

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    const actor = this.actor;
    ctx.actor = actor;
    ctx.system = actor?.system ?? {};
    ctx.flags = actor?.flags ?? {};
    ctx.items = actor?.items?.map(i => i.toObject()) ?? [];

    ctx.eq5e = ctx.eq5e ?? {};
    ctx.eq5e.ui = {
      crest: _crestForActor(actor),
      parchment: "systems/eq5e/assets/ui/parchment.png",
      dropin: DROPIN_TAG
    };

    // Basic sheet data expected by your template
    const classItem = _getPrimaryClassItem(actor);
    ctx.eq5e.sheet = ctx.eq5e.sheet ?? {};
    ctx.eq5e.sheet.className = classItem?.name ?? _getPrimaryClassName(actor) ?? "";
    ctx.eq5e.sheet.vitals = ctx.eq5e.sheet.vitals ?? {
      ac: { value: foundry.utils.getProperty(actor, "system.attributes.ac.value") ?? 10 },
      init: { value: foundry.utils.getProperty(actor, "system.attributes.init.value") ?? 0 },
      speed: { value: foundry.utils.getProperty(actor, "system.attributes.movement.walk") ?? foundry.utils.getProperty(actor,"system.attributes.speed.value") ?? 30 },
      hp: {
        value: foundry.utils.getProperty(actor, "system.attributes.hp.value") ?? 0,
        max: foundry.utils.getProperty(actor, "system.attributes.hp.max") ?? 0
      }
    };

    // Abilities/skills: use whatever template.json populated, but keep safe defaults
    const abilities = foundry.utils.getProperty(actor, "system.abilities") ?? {};
    ctx.eq5e.sheet.abilities = Object.entries(abilities).map(([k, v]) => ({
      key: k,
      label: (v?.label ?? k).toString().toUpperCase(),
      value: v?.value ?? 10,
      mod: v?.mod ?? 0,
      save: v?.save ?? 0
    }));

    const skills = foundry.utils.getProperty(actor, "system.skills") ?? {};
    ctx.eq5e.sheet.skills = Object.entries(skills).map(([k, v]) => ({
      key: k,
      label: v?.label ?? k,
      total: v?.total ?? v?.mod ?? 0,
      proficient: !!v?.proficient
    }));

    // Item buckets
    const items = actor?.items ?? new Collection();
    const byType = (t) => items.filter(i => i.type === t).map(i => i.toObject());
    ctx.eq5e.items = {
      features: byType("feature"),
      feats: byType("feat"),
      spells: byType("spell"),
      aas: byType("aa"),
      inventory: items.filter(i => ["weapon","armor","shield","jewelry","ammo","equipment","consumable"].includes(i.type))
        .map(i => {
          const o = i.toObject();
          o.eq5eEquipped = !!i.flags?.eq5e?.equipped;
          o.eq5eSlot = i.flags?.eq5e?.slot ?? null;
          return o;
        })
    };

    // Paper doll state
    const equip = foundry.utils.getProperty(actor, "flags.eq5e.equipment") ?? {};
    ctx.eq5e.paperdoll = {
      slots: EQ_SLOTS.map(s => {
        const id = equip?.[s.key] ?? null;
        const doc = id ? actor.items?.get(id) : null;
        return {
          key: s.key,
          label: s.label,
          allowed: (s.allowed ?? []).map(t => TYPE_LABEL[t] ?? t).join(", "),
          item: doc ? { _id: doc.id, name: doc.name, type: doc.type } : null
        };
      })
    };

    return ctx;
  }

  /* V2: this is where we wire DOM listeners for each rendered part */
  _attachPartListeners(partId, html) {
    super._attachPartListeners(partId, html);
    const root = _asElement(html);
    if (!root) return;

    // Tabs: bind clicks
    const navItems = root.querySelectorAll("nav.eq5e-tabs a.item");
    navItems.forEach(a => {
      a.addEventListener("click", (ev) => {
        ev.preventDefault();
        const tab = a.dataset.tab;
        const group = a.dataset.group || "sheet";
        _setActiveTab(root, group, tab);

        // persist per-actor
        this.actor?.setFlag?.("eq5e", "ui.activeTab", tab).catch(()=>{});
      });
    });

    // Initial tab
    const saved = this.actor?.getFlag?.("eq5e", "ui.activeTab");
    _setActiveTab(root, "sheet", saved || "character");

    // data-action buttons
    root.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("[data-action]");
      if (!btn) return;
      const act = btn.dataset.action;
      if (!act) return;
      ev.preventDefault();
      ev.stopPropagation();
      this._handleAction(act, btn).catch(err => console.error("[EQ5E] action failed", err));
    });

    // Drop targets: paper doll slots
    root.querySelectorAll("[data-eq5e-drop-slot='1']").forEach(el => {
      el.addEventListener("dragover", (ev) => { ev.preventDefault(); });
      el.addEventListener("drop", (ev) => this._onDropToSlot(ev).catch(err => console.error("[EQ5E] drop failed", err)));
    });
  }

  async _handleAction(action, target) {
    const actor = this.actor;
    switch (action) {
      case "editImage": {
        // Avoid FilePicker positioning crash by rendering centered
        const field = target.dataset.field || "img";
        const current = foundry.utils.getProperty(this.document, field);
        const fp = new foundry.applications.apps.FilePicker({
          type: "image",
          current,
          callback: (path) => this.document.update({ [field]: path })
        });
        fp.render(true, { focus: true });
        return;
      }

      case "rollAbility": {
        const ab = target.dataset.ability;
        const a = foundry.utils.getProperty(actor, `system.abilities.${ab}`) ?? {};
        const mod = Number(a.mod ?? 0);
        return eqRoll("1d20 + @mod", { mod }, `${ab.toUpperCase()} Check`);
      }

      case "rollSave": {
        const ab = target.dataset.ability;
        const a = foundry.utils.getProperty(actor, `system.abilities.${ab}`) ?? {};
        const save = Number(a.save ?? a.mod ?? 0);
        return eqRoll("1d20 + @save", { save }, `${ab.toUpperCase()} Save`);
      }

      case "rollSkill": {
        const sk = target.dataset.skill;
        const s = foundry.utils.getProperty(actor, `system.skills.${sk}`) ?? {};
        const total = Number(s.total ?? s.mod ?? 0);
        return eqRoll("1d20 + @total", { total }, `${sk} Skill`);
      }

      case "toggleEquip": {
        const itemId = target.dataset.itemId;
        const it = actor.items?.get(itemId);
        if (!it) return;
        const cur = !!it.flags?.eq5e?.equipped;
        if (cur) {
          // If it's in an equipment slot, clear that too
          const slot = it.flags?.eq5e?.slot ?? null;
          if (slot) await _unequipSlot(actor, slot);
          else await it.setFlag("eq5e","equipped", false);
        } else {
          // If it has a suggested slot, try to use it; otherwise do nothing but set equipped.
          const want = it.flags?.eq5e?.slot ?? null;
          if (want && _slotDef(want)) await _equipToSlot(actor, it, want);
          else await it.setFlag("eq5e","equipped", true);
        }
        return;
      }

      case "unequipSlot": {
        const slot = target.dataset.slot;
        if (!slot) return;
        return _unequipSlot(actor, slot);
      }

      case "focusTab": {
        const tab = target.dataset.tab;
        if (!tab) return;
        // find root
        const root = _asElement(this.element);
        if (!root) return;
        _setActiveTab(root, "sheet", tab);
        return this.actor?.setFlag?.("eq5e", "ui.activeTab", tab).catch(()=>{});
      }
    }
  }

  async _onDropToSlot(ev) {
    ev.preventDefault();
    const actor = this.actor;
    const slotEl = ev.currentTarget;
    const slotKey = slotEl?.dataset?.slot;
    if (!slotKey) return;

    let raw = ev.dataTransfer?.getData("text/plain") ?? "";
    if (!raw) raw = ev.dataTransfer?.getData("text") ?? "";

    let data = null;
    try { data = JSON.parse(raw); } catch (e) { data = null; }

    // Clear token
    if (data?.eq5e === "clear-slot") {
      return _unequipSlot(actor, slotKey);
    }

    // Foundry drag/drop payload usually includes uuid
    const uuid = data?.uuid || data?.data?.uuid || null;
    if (!uuid) {
      ui.notifications?.warn("Drop an item from your inventory onto a slot.");
      return;
    }

    const doc = await fromUuid(uuid).catch(() => null);
    if (!doc || doc.documentName !== "Item") {
      ui.notifications?.warn("Only Items can be equipped.");
      return;
    }

    // Only allow inventory-ish items
    const t = doc.type;
    if (!["weapon","armor","shield","jewelry","ammo","equipment","consumable"].includes(t)) {
      ui.notifications?.warn("That item type can't be equipped on the paper doll.");
      return;
    }

    // Ensure owned (if from compendium or elsewhere)
    const owned = await _ensureOwnedItem(actor, doc);
    if (!owned) return;

    return _equipToSlot(actor, owned, slotKey);
  }
}

Hooks.once("init", () => {
  try {
    foundry.documents.collections.Actors.registerSheet("eq5e", EQ5eActorSheet, {
      types: ["character", "npc", "pet"],
      makeDefault: true,
      label: `EQ5e Actor Sheet (V2) [${DROPIN_TAG}]`
    });
    console.log(`[EQ5E] Registered EQ5e Actor Sheet (V2) ${DROPIN_TAG}`);
  } catch (e) {
    console.error("[EQ5E] Failed to register EQ5e Actor Sheet", e);
  }
});
