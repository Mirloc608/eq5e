/**
 * EQ5e New Character Wizard (Foundry VTT v13+, ApplicationV2)
 *
 * Goals
 * - Walk a player through making a new PC (Classic → PoP)
 * - GM-toggleable race/class restrictions by era
 * - Best-effort auto-add starting spells + starter items (clone from available compendiums)
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SYSTEM_ID = "eq5e";

// --- Era definitions (Classic → PoP) ---
const ERAS = [
  { id: "classic", label: "Classic" },
  { id: "kunark", label: "Kunark" },
  { id: "velious", label: "Velious" },
  { id: "luclin", label: "Luclin" },
  { id: "pop", label: "Planes of Power" }
];

// Race/class availability by era (conservative defaults).
// GM can disable restrictions entirely, or disable specific era caps.
const ERA_RULES = {
  classic: {
    races: ["Human", "Barbarian", "Erudite", "High Elf", "Dark Elf", "Wood Elf", "Half Elf", "Dwarf", "Halfling", "Gnome", "Ogre", "Troll", "Iksar" /* optional toggle via Kunark; kept here for flexibility */],
    classes: ["Warrior", "Cleric", "Paladin", "Ranger", "Shadowknight", "Druid", "Monk", "Bard", "Rogue", "Shaman", "Necromancer", "Wizard", "Magician", "Enchanter"]
  },
  kunark: {
    races: ["Human", "Barbarian", "Erudite", "High Elf", "Dark Elf", "Wood Elf", "Half Elf", "Dwarf", "Halfling", "Gnome", "Ogre", "Troll", "Iksar"],
    classes: ["Warrior", "Cleric", "Paladin", "Ranger", "Shadowknight", "Druid", "Monk", "Bard", "Rogue", "Shaman", "Necromancer", "Wizard", "Magician", "Enchanter"]
  },
  velious: {
    races: ["Human", "Barbarian", "Erudite", "High Elf", "Dark Elf", "Wood Elf", "Half Elf", "Dwarf", "Halfling", "Gnome", "Ogre", "Troll", "Iksar"],
    classes: ["Warrior", "Cleric", "Paladin", "Ranger", "Shadowknight", "Druid", "Monk", "Bard", "Rogue", "Shaman", "Necromancer", "Wizard", "Magician", "Enchanter"]
  },
  luclin: {
    races: ["Human", "Barbarian", "Erudite", "High Elf", "Dark Elf", "Wood Elf", "Half Elf", "Dwarf", "Halfling", "Gnome", "Ogre", "Troll", "Iksar", "Vah Shir"],
    classes: ["Warrior", "Cleric", "Paladin", "Ranger", "Shadowknight", "Druid", "Monk", "Bard", "Rogue", "Shaman", "Necromancer", "Wizard", "Magician", "Enchanter", "Beastlord"]
  },
  pop: {
    races: ["Human", "Barbarian", "Erudite", "High Elf", "Dark Elf", "Wood Elf", "Half Elf", "Dwarf", "Halfling", "Gnome", "Ogre", "Troll", "Iksar", "Vah Shir"],
    classes: ["Warrior", "Cleric", "Paladin", "Ranger", "Shadowknight", "Druid", "Monk", "Bard", "Rogue", "Shaman", "Necromancer", "Wizard", "Magician", "Enchanter", "Beastlord", "Berserker"]
  }
};

// Best-effort starter spell IDs by class.
// We try to find matching spells in any loaded spell pack by flags.eq5e.spell.spellId OR by name.
const STARTING_SPELLS = {
  Cleric: ["courage", "healing", "minor_healing"],
  Druid: ["minor_healing", "skin_like_wood", "burst_of_flame"],
  Shaman: ["inner_fire", "minor_healing", "sicken"],
  Wizard: ["frost_bolt", "shock_of_flame", "minor_shielding"],
  Magician: ["summon_dagger", "flame_bolt", "minor_shielding"],
  Enchanter: ["color_shift", "mesmerize", "minor_shielding"],
  Necromancer: ["lifetap", "clinging_darkness", "fear"],
  Bard: ["selos", "anthem", "chant"],
  Paladin: [],
  Ranger: [],
  Shadowknight: [],
  Warrior: [],
  Rogue: [],
  Monk: [],
  Beastlord: [],
  Berserker: []
};

// Best-effort starter item names by class (clone from compendiums if found).
const STARTING_ITEMS_BY_CLASS = {
  Warrior: ["Rusty Long Sword", "Patchwork Armor"],
  Cleric: ["Rusty Mace", "Small Shield", "Patchwork Armor"],
  Paladin: ["Rusty Long Sword", "Small Shield", "Patchwork Armor"],
  Ranger: ["Rusty Short Sword", "Small Shield", "Patchwork Armor"],
  Shadowknight: ["Rusty Long Sword", "Patchwork Armor"],
  Druid: ["Wooden Staff", "Patchwork Armor"],
  Monk: ["Cloth Shirt", "Cloth Pants"],
  Bard: ["Rusty Short Sword", "Lute (Example Strings)"],
  Rogue: ["Rusty Dagger", "Rusty Dagger"],
  Shaman: ["Wooden Staff", "Patchwork Armor"],
  Necromancer: ["Bone Wand", "Cloth Robe"],
  Wizard: ["Spellbook", "Cloth Robe"],
  Magician: ["Spellbook", "Cloth Robe"],
  Enchanter: ["Spellbook", "Cloth Robe"],
  Beastlord: ["Rusty Club", "Patchwork Armor"],
  Berserker: ["Rusty Axe", "Patchwork Armor"]
};

// Help text for each wizard step (rendered as a Dialog popup the first time
// the player reaches that step). Keep messages short and actionable.
const WIZARD_HELP = {
  1: {
    title: "Step 1 — Basics",
    body: `Choose an <strong>Era</strong> to limit races/classes, pick a <strong>Race</strong> and <strong>Class</strong>, and enter a <strong>Name</strong>. GMs can toggle era restrictions in settings.`
  },
  2: {
    title: "Step 2 — Options",
    body: `Toggle <strong>Auto Spells</strong> and <strong>Auto Items</strong>. These will attempt to clone starter spells/items from available compendiums for the selected class.`
  },
  3: {
    title: "Step 3 — Create",
    body: `Review your choices and click <strong>Create</strong> to make the character. The wizard will open the character sheet when finished.`
  }
};

// --- Helpers ---

function _titleCase(s) {
  return String(s ?? "")
    .trim()
    .split(/\s+/)
    .map(w => w ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : "")
    .join(" ");
}

function _safeGet(obj, path, fallback = null) {
  return foundry.utils.getProperty(obj, path) ?? fallback;
}

async function _findItemInPacks({ name, type = null, spellId = null }) {
  const packs = Array.from(game.packs ?? []).filter(p => p?.documentName === "Item");
  const needleName = String(name ?? "").toLowerCase();
  const needleSpell = spellId ? String(spellId).toLowerCase() : null;

  for (const pack of packs) {
    try {
      const idx = pack.indexed ? pack.index : await pack.getIndex();
      // Fast path: by name
      let row = idx.find(r => String(r.name ?? "").toLowerCase() === needleName);
      if (!row && needleSpell) {
        // Slower path: fetch candidates by name-ish then check flags
        // If the pack index includes flags, great; if not, we fetch by name match only.
        const candidates = idx.filter(r => String(r.name ?? "").toLowerCase().includes(needleName.slice(0, Math.min(needleName.length, 6))));
        for (const c of candidates.slice(0, 30)) {
          const doc = await pack.getDocument(c._id);
          const sid = _safeGet(doc, "flags.eq5e.spell.spellId", "").toLowerCase();
          if (sid && sid === needleSpell) return doc;
        }
      }
      if (!row) continue;
      const doc = await pack.getDocument(row._id);
      if (type && doc.type !== type) continue;
      if (needleSpell) {
        const sid = _safeGet(doc, "flags.eq5e.spell.spellId", "").toLowerCase();
        if (sid && sid !== needleSpell) continue;
      }
      return doc;
    } catch (_) {
      // ignore pack failures
    }
  }
  return null;
}

async function _cloneItemsToActor(actor, docs) {
  if (!actor || !docs?.length) return 0;
  const data = docs
    .filter(Boolean)
    .map(d => {
      const obj = d.toObject();
      delete obj._id;
      return obj;
    });
  if (!data.length) return 0;
  const created = await actor.createEmbeddedDocuments("Item", data);
  return created?.length ?? 0;
}

async function _applyRaceClassBasics(actor, { race, cls }) {
  // Keep this conservative: only fields that are known to exist in your earlier sheet context.
  const update = {
    name: actor.name || "New Adventurer",
    system: foundry.utils.mergeObject(actor.system ?? {}, {
      details: {
        race,
        class: cls,
        level: 1
      }
    }, { inplace: false })
  };
  await actor.update(update);
}

// --- Wizard App ---

class EQ5eNewCharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "eq5e-new-character-wizard",
    tag: "section",
    classes: ["eq5e", "eq5e-new-character-wizard"],
    window: {
      title: "New Character (EQ5e)",
      resizable: true
    },
    position: { width: 720, height: 640 }
  });

  static PARTS = {
    app: { template: "systems/eq5e/templates/app/new-character-wizard.hbs" }
  };

  constructor(options = {}) {
    super(options);
    this._step = 1;
    this._data = {
      era: "classic",
      name: "",
      race: "Human",
      cls: "Warrior",
      applyRestrictions: true,
      autoSpells: true,
      autoItems: true
    };
    this._helpShown = new Set();
  }

  async _prepareContext(options) {
    const ctx = await super._prepareContext(options);

    const gm = game.user?.isGM === true;
    const applyRestrictions = gm
      ? (game.settings.get(SYSTEM_ID, "chargenRestrictionsEnabled") ?? true)
      : true;

    const eraCap = gm
      ? (game.settings.get(SYSTEM_ID, "chargenEraCap") ?? "pop")
      : "pop";

    const allowedEras = ERAS.filter(e => {
      const order = ["classic", "kunark", "velious", "luclin", "pop"];
      return order.indexOf(e.id) <= order.indexOf(eraCap);
    });

    // If user somehow has an era beyond cap, clamp.
    if (!allowedEras.some(e => e.id === this._data.era)) this._data.era = allowedEras[allowedEras.length - 1]?.id ?? "classic";

    const rules = ERA_RULES[this._data.era] ?? ERA_RULES.classic;
    const races = applyRestrictions ? rules.races : Array.from(new Set(Object.values(ERA_RULES).flatMap(r => r.races))).sort();
    const classes = applyRestrictions ? rules.classes : Array.from(new Set(Object.values(ERA_RULES).flatMap(r => r.classes))).sort();

    // Clamp current selection.
    if (!races.includes(this._data.race)) this._data.race = races[0] ?? "Human";
    if (!classes.includes(this._data.cls)) this._data.cls = classes[0] ?? "Warrior";

    ctx.eq5e = ctx.eq5e ?? {};
    ctx.eq5e.chargen = {
      step: this._step,
      eras: allowedEras,
      races,
      classes,
      gm,
      settings: {
        restrictionsEnabled: applyRestrictions,
        eraCap
      },
      state: foundry.utils.duplicate(this._data)
    };

    return ctx;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    // Use event delegation for actions and input changes to avoid missing
    // events when the template is re-rendered frequently.
    if (!root._eq5eDelegated) {
      root.addEventListener("click", (ev) => {
        const btn = ev.target.closest && ev.target.closest("[data-action]");
        if (btn) {
          ev.preventDefault();
          this._onAction({ currentTarget: btn, preventDefault: () => {} });
        }
      });

      root.addEventListener("change", (ev) => {
        const el = ev.target;
        if (!el) return;
        if (el.matches && el.matches("input, select")) {
          this._onChange({ currentTarget: el });
        }
      });
      root._eq5eDelegated = true;
    }

    // Show contextual help for the current step once per session/render lifecycle.
    this._maybeShowHelp();
  }

  _maybeShowHelp() {
    const step = Number(this._step || 1);
    if (this._helpShown.has(step)) return;
    const msg = WIZARD_HELP[step];
    if (!msg) return;
    this._helpShown.add(step);
    // Use a V2 Application-based dialog to avoid deprecated V1 Application warnings.
    const inst = this;
    const buttons = {
      ok: { label: "Got it", callback: () => {} },
      next: { label: "Next Step", callback: () => { inst._step = Math.min(3, Number(inst._step) + 1); inst.render({ parts: ["app"] }); } }
    };

    class EQ5eHelpDialog extends HandlebarsApplicationMixin(ApplicationV2) {
      static PARTS = { body: { template: "systems/eq5e/templates/app/help-dialog.hbs" } };
      static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
        id: "eq5e-help-dialog",
        tag: "section",
        classes: ["eq5e", "eq5e-help-dialog"],
        window: { title: msg.title, resizable: false },
        position: { width: 520 }
      });

      constructor(opts = {}) {
        super(opts);
        this._content = opts.content || "";
        this._buttons = opts.buttons || {};
      }

      async _prepareContext(options) {
        const ctx = await super._prepareContext(options);
        ctx.eq5e = ctx.eq5e ?? {};
        ctx.eq5e.help = { content: this._content, buttons: Object.fromEntries(Object.entries(this._buttons).map(([k,b]) => [k, { label: b.label }])) };
        return ctx;
      }

      _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;
        if (!root) return;
        root.querySelectorAll('.eq5e-help-btn').forEach(el => {
          el.addEventListener('click', (ev) => {
            const key = el.dataset.key;
            const cb = this._buttons?.[key]?.callback;
            try { if (typeof cb === 'function') cb(); } catch (e) { console.error(e); }
            this.close();
          });
        });
      }
    }

    const dlg = new EQ5eHelpDialog({ content: `<div class=\"eq5e-wiz-help\">${msg.body}</div>`, buttons });
    dlg.render(true);
  }

  async _onChange(event) {
    const el = event.currentTarget;
    const name = el?.name;
    if (!name) return;

    const val = (el.type === "checkbox") ? !!el.checked : el.value;
    if (name === "name") this._data.name = String(val ?? "");
    if (name === "era") this._data.era = String(val ?? "classic");
    if (name === "race") this._data.race = _titleCase(val);
    if (name === "cls") this._data.cls = _titleCase(val);
    if (name === "autoSpells") this._data.autoSpells = !!val;
    if (name === "autoItems") this._data.autoItems = !!val;

    // Settings are GM-only and stored to world settings.
    if (name === "settings.restrictionsEnabled" && game.user?.isGM) {
      await game.settings.set(SYSTEM_ID, "chargenRestrictionsEnabled", !!val);
    }
    if (name === "settings.eraCap" && game.user?.isGM) {
      await game.settings.set(SYSTEM_ID, "chargenEraCap", String(val));
    }

    this.render({ parts: ["app"] });
  }

  async _onAction(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const action = btn?.dataset?.action;
    if (!action) return;

    if (action === "next") {
      this._step = Math.min(3, this._step + 1);
      return this.render({ parts: ["app"] });
    }
    if (action === "back") {
      this._step = Math.max(1, this._step - 1);
      return this.render({ parts: ["app"] });
    }
    if (action === "cancel") {
      return this.close();
    }
    if (action === "create") {
      return this._createCharacter();
    }
  }

  async _createCharacter() {
    try {
      const name = String(this._data.name ?? "").trim() || "New Adventurer";
      const race = _titleCase(this._data.race);
      const cls = _titleCase(this._data.cls);

      let actor;
      try {
        actor = await Actor.create({ name, type: "character", img: "systems/eq5e/assets/ui/default-portrait.webp" }, { renderSheet: false });
      } catch (e) {
        // Some storage backends (or permission setups) may not allow writing to
        // the system's assets path (error like: Directory canvas/tokens does not exist).
        // Fall back to a built-in generic avatar so character creation can continue.
        console.warn("[EQ5E] Actor.create failed with default image, retrying with built-in icon:", e);
        try {
          actor = await Actor.create({ name, type: "character", img: "icons/svg/mystery-man.svg" }, { renderSheet: false });
        } catch (e2) {
          console.error("[EQ5E] Actor.create failed (fallback also failed)", e2);
          throw e2;
        }
      }

      await _applyRaceClassBasics(actor, { race, cls });

      // Best-effort: add a `class` and `race` Item to the actor so sheets
      // that prefer an embedded Class/ Race document can show properly.
      try {
        const classDoc = await _findItemInPacks({ name: cls, type: "class" });
        const raceDoc = await _findItemInPacks({ name: race, type: "race" });
        const addDocs = [];
        if (classDoc) addDocs.push(classDoc);
        if (raceDoc) addDocs.push(raceDoc);
        if (addDocs.length) {
          const added = await _cloneItemsToActor(actor, addDocs);
          if (added) ui.notifications?.info(`EQ5E: Added ${added} core item(s) (class/race).`);
        }
      } catch (e) {
        // non-fatal
        console.warn("[EQ5E] Failed to add class/race items to actor", e);
      }

      // Best-effort: add starter spells
      if (this._data.autoSpells) {
        const want = STARTING_SPELLS[cls] ?? [];
        const docs = [];
        for (const sid of want) {
          // try by spellId first
          let doc = await _findItemInPacks({ spellId: sid });
          if (!doc) doc = await _findItemInPacks({ name: sid });
          if (doc) docs.push(doc);
        }
        const added = await _cloneItemsToActor(actor, docs);
        if (added) ui.notifications?.info(`EQ5E: Added ${added} starting spell(s).`);
      }

      // Best-effort: add starter items
      if (this._data.autoItems) {
        const want = STARTING_ITEMS_BY_CLASS[cls] ?? [];
        const docs = [];
        for (const nm of want) {
          const doc = await _findItemInPacks({ name: nm });
          if (doc) docs.push(doc);
        }
        const added = await _cloneItemsToActor(actor, docs);
        if (added) ui.notifications?.info(`EQ5E: Added ${added} starter item(s).`);
      }

      // Open sheet + close wizard
      await actor.sheet.render(true);
      await this.close();
      ui.notifications?.info("EQ5E: Character created.");
    } catch (e) {
      console.error("[EQ5E] Character creation failed", e);
      ui.notifications?.error("EQ5E: Character creation failed (see console)." );
    }
  }
}

// --- Directory button wiring ---

function _injectButton(html) {
  try {
    const root = html?.[0] ?? html;
    if (!root?.querySelector) return;
    if (root.querySelector(".eq5e-newchar-btn")) return;

    const headerActions = root.querySelector(".directory-header .header-actions")
      || root.querySelector(".directory-header")
      || root;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "eq5e-newchar-btn";
    btn.innerHTML = `<i class="fa-solid fa-feather-pointed"></i> New EQ Character`;
    btn.style.marginLeft = "6px";
    btn.addEventListener("click", () => {
      const app = new EQ5eNewCharacterWizard();
      app.render(true);
    });

    // Prefer to place the button next to the directory Create button (if present).
    const createBtn = headerActions.querySelector("button.create")
      || headerActions.querySelector("button[title*='Create']")
      || headerActions.querySelector("button[data-action='create']");
    try {
      if (createBtn && createBtn.parentElement) createBtn.parentElement.insertBefore(btn, createBtn.nextSibling);
      else headerActions.appendChild(btn);
    } catch (e) {
      headerActions.appendChild(btn);
    }
  } catch (e) {
    console.warn("[EQ5E] Failed to inject New Character button", e);
  }
}

Hooks.once("init", () => {
  // GM toggle: enable restrictions & era cap
  game.settings.register(SYSTEM_ID, "chargenRestrictionsEnabled", {
    name: "Character Creation: Enforce era race/class restrictions",
    hint: "If enabled, players can only pick races/classes available for the selected era (Classic → PoP).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(SYSTEM_ID, "chargenEraCap", {
    name: "Character Creation: Max era",
    hint: "Limits which eras appear in the character wizard.",
    scope: "world",
    config: true,
    type: String,
    choices: {
      classic: "Classic",
      kunark: "Kunark",
      velious: "Velious",
      luclin: "Luclin",
      pop: "Planes of Power"
    },
    default: "pop"
  });
});

Hooks.on("renderActorDirectory", (app, html) => {
  // Only show if the EQ5e system is active (obviously) and to all users.
  _injectButton(html);
});

console.log("[EQ5E] New Character Wizard loaded");
