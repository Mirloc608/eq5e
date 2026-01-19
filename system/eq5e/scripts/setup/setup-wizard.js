const SYS = "eq5e";

function stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label, type = "Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  return CompendiumCollection.createCompendium({
    type,
    label,
    name: key.split(".")[1],
    package: "world"
  });
}

async function upsertByKey(pack, docs, getKey) {
  const idx = await pack.getIndex({ fields: ["name", "flags.eq5e.derivedHash", "flags.eq5e.spell.spellId", "flags.eq5e.aa.aaId"] });
  const byKey = new Map();
  for (const e of idx) byKey.set(String(getKey(e)), e._id);

  const toCreate = [];
  const toUpdate = [];

  for (const d0 of docs) {
    const d = foundry.utils.duplicate(d0);
    d.flags = d.flags ?? {};
    d.flags.eq5e = d.flags.eq5e ?? {};
    const h = stableHash(d);
    d.flags.eq5e.derivedHash = h;

    const key = String(getKey(d));
    const existingId = byKey.get(key);
    if (!existingId) {
      toCreate.push(d);
    } else {
      const cur = idx.find(x => x._id === existingId);
      if ((cur?.flags?.eq5e?.derivedHash ?? null) !== h) {
        d._id = existingId;
        toUpdate.push(d);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

// Known EQ5e class modules + their data files -> world packs.
// This keeps spellIds/aaIds stable and makes worlds reproducible.
async function addItemsToActor(actor, docs, keyFn) {
  const existing = new Set((actor.items?.contents ?? []).map(i => String(keyFn(i) ?? "")));
  const toCreate = [];
  for (const d0 of docs) {
    const d = foundry.utils.duplicate(d0);
    const k = String(keyFn(d) ?? "");
    if (!k || existing.has(k)) continue;
    toCreate.push(d);
    existing.add(k);
  }
  if (!toCreate.length) return { created: 0 };
  await actor.createEmbeddedDocuments("Item", toCreate);
  return { created: toCreate.length };
}

function actorClassId(actor) {
  return String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
}

const CLASS_IMPORTS = [
  { module: "eq5e-class-bard", name: "Bard", classId: "bard", files: [
    { rel: "data/bard-songs.json", pack: "world.eq5e-bard-songs", label: "EQ5e Bard Songs", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/bard-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-enchanter", name: "Enchanter", classId: "enchanter", files: [
    { rel: "data/enchanter-spells.json", pack: "world.eq5e-enchanter-spells", label: "EQ5e Enchanter Spells", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/enchanter-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-berserker", name: "Berserker", classId: "berserker", files: [
    { rel: "data/berserker-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-beastlord", name: "Beastlord", classId: "beastlord", files: [
    { rel: "data/beastlord-spells.json", pack: "world.eq5e-beastlord-spells", label: "EQ5e Beastlord Spells", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/beastlord-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-necromancer", name: "Necromancer", classId: "necromancer", files: [
    { rel: "data/necro-spells.json", pack: "world.eq5e-necromancer-spells", label: "EQ5e Necromancer Spells", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/necro-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-shadowknight", name: "Shadowknight", classId: "shadowknight", files: [
    { rel: "data/shadowknight-spells.json", pack: "world.eq5e-shadowknight-spells", label: "EQ5e Shadowknight Spells", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/shadowknight-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]},
  { module: "eq5e-class-ranger", name: "Ranger", classId: "ranger", files: [
    { rel: "data/ranger-spells.json", pack: "world.eq5e-ranger-spells", label: "EQ5e Ranger Spells", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/ranger-disciplines.json", pack: "world.eq5e-ranger-disciplines", label: "EQ5e Ranger Disciplines", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/ranger-features.json", pack: "world.eq5e-ranger-features", label: "EQ5e Ranger Class Features", type: "Item", key: d => d?.flags?.eq5e?.spell?.spellId },
    { rel: "data/ranger-aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item", key: d => d?.flags?.eq5e?.aa?.aaId }
  ]}
];

export class EQ5eSetupWizard extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq5e-setup-wizard",
      title: "EQ5e System Setup",
      template: "systems/eq5e/templates/setup-wizard.hbs",
      width: 560,
      height: "auto",
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  getData() {
    const classOptions = [
      { id: "", label: "(unset)" },
      ...CLASS_IMPORTS.map(c => ({ id: c.classId, label: c.name }))
    ];

    const actors = (game.actors?.contents ?? [])
      .filter(a => a?.type === "character")
      .map(a => ({ id: a.id, name: a.name, classId: actorClassId(a) }))
      .sort((a,b) => a.name.localeCompare(b.name));

    const classes = CLASS_IMPORTS
      .map(c => ({
        module: c.module,
        name: c.name,
        installed: game.modules?.get(c.module)?.active === true
      }));
    return {
      options: {
        importConditions: true,
        importAAs: true,
        importClasses: true,
        applyToActors: false,
        applyIncludeAAs: false
      },
      classes,
      actors,
      classOptions
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find("button[data-action='run']").on("click", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(html[0].querySelector("form"));
      const importConditions = fd.get("importConditions") === "on";
      const importAAs = fd.get("importAAs") === "on";
      const importClasses = fd.get("importClasses") === "on";

      const chosen = new Set(fd.getAll("classes")?.map(String) ?? []);

      await this._run({ importConditions, importAAs, importClasses, chosen }, html);
    });

    
html.on("change", "select[data-action='set-class']", async (ev) => {
  const actorId = ev.currentTarget?.dataset?.actorId;
  const classId = String(ev.currentTarget?.value ?? "");
  const actor = game.actors?.get(actorId);
  if (!actor) return;
  try {
    const cur = actor.getFlag("eq5e", "class") ?? {};
    await actor.setFlag("eq5e", "class", foundry.utils.mergeObject(cur, { id: classId }));
    await actor.setFlag("eq5e", "classId", classId); // legacy mirror
    ui.notifications?.info(`EQ5E: ${actor.name} classId set to '${classId || "unset"}'`);
  } catch (e) {
    console.error(e);
    ui.notifications?.error(`Failed to set classId for ${actor?.name ?? "actor"}`);
  }
});

html.find("button[data-action='close']").on("click", (ev) => {
      ev.preventDefault();
      this.close();
    });
  }

  async _log(html, msg) {
    const box = html.find(".eq5e-setup-log");
    const line = $(`<div class="line"></div>`).text(msg);
    box.append(line);
    box.scrollTop(box[0].scrollHeight);
  }

  async _run(opts, html) {
    if (!game.user.isGM) return ui.notifications?.warn("Only the GM can run the EQ5e setup wizard.");

    await this._log(html, "Starting EQ5e setup...");

    // 1) Conditions: copy from system pack to a world pack so worlds can customize without modifying the system.
    if (opts.importConditions) {
      try {
        await this._log(html, "Importing core Conditions...");
        const srcKey = `${SYS}.conditions`;
        const srcPack = game.packs?.get(srcKey);
        if (!srcPack) throw new Error(`Source pack not found: ${srcKey}`);

        const dstPack = await ensureWorldPack({ key: "world.eq5e-conditions", label: "EQ5e Conditions (World)", type: "Item" });
        const docs = await srcPack.getDocuments();
        const plain = docs.map(d => d.toObject());
        const res = await upsertByKey(dstPack, plain, d => d?.flags?.eq5e?.condition?.id ?? d?.name);
        await this._log(html, `Conditions imported. Created: ${res.created}, Updated: ${res.updated}`);
      } catch (e) {
        console.error(e);
        await this._log(html, `Conditions import failed: ${e.message ?? e}`);
      }
    }

    // 2) AAs: ensure shared AA pack exists; the class import step will merge into it.
    if (opts.importAAs) {
      try {
        await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item" });
        await this._log(html, "Shared AA pack ensured: world.eq5e-aa");
      } catch (e) {
        console.error(e);
        await this._log(html, `AA pack ensure failed: ${e.message ?? e}`);
      }
    }

    // 3) Classes: import any installed class module data into world packs
    if (opts.importClasses) {
      await this._log(html, "Importing class content from installed modules...");
      for (const c of CLASS_IMPORTS) {
        const mod = game.modules?.get(c.module);
        if (!mod?.active) continue;
        if (opts.chosen.size && !opts.chosen.has(c.module)) continue;

        await this._log(html, `- ${c.name} (${c.module})`);
        for (const f of c.files) {
          // Skip AA imports if user unchecked AAs
          const isAA = f.pack === "world.eq5e-aa";
          if (isAA && !opts.importAAs) continue;

          try {
            const pack = await ensureWorldPack({ key: f.pack, label: f.label, type: f.type });
            const url = `${mod.path}/${f.rel}`;
            const docs = await fetchJSON(url);
            const res = await upsertByKey(pack, docs, f.key);
            await this._log(html, `  • ${f.label}: +${res.created} / ~${res.updated}`);
          } catch (e) {
            console.error(e);
            await this._log(html, `  • ${f.label}: FAILED (${e.message ?? e})`);
          }
        }
      }
      await this._log(html, "Class import complete.");
    }


// 4) Apply to selected actors: add items directly to characters (optional)
if (opts.applyToActors && Array.isArray(opts.actorIds) && opts.actorIds.length) {
  await this._log(html, "Applying content to selected actors...");
  const actors = opts.actorIds.map(id => game.actors?.get(id)).filter(Boolean);

  for (const a of actors) {
    const cid = actorClassId(a);
    if (!cid) {
      await this._log(html, `- ${a.name}: skipped (no classId flag)`);
      continue;
    }

    const entry = CLASS_IMPORTS.find(c => c.classId === cid && (game.modules?.get(c.module)?.active));
    if (!entry) {
      await this._log(html, `- ${a.name}: no matching active class module for classId='${cid}'`);
      continue;
    }
    if (opts.chosen.size && !opts.chosen.has(entry.module)) {
      await this._log(html, `- ${a.name}: class module not selected in wizard (${entry.module})`);
      continue;
    }

    await this._log(html, `- ${a.name}: importing ${entry.name} items...`);

    for (const f of entry.files) {
      const isAA = f.pack === "world.eq5e-aa";
      if (isAA) continue; // AAs are normally purchased; not embedded by default

      let docs = null;
      const pack = game.packs?.get(f.pack);
      if (pack) {
        const pdocs = await pack.getDocuments();
        docs = pdocs.map(d => d.toObject());
      } else {
        const mod = game.modules?.get(entry.module);
        const url = `${mod.path}/${f.rel}`;
        docs = await fetchJSON(url);
      }

      const keyFn = (d) => {
        const sp = d?.flags?.eq5e?.spell;
        if (sp?.spellId) return sp.spellId;
        return d?.name;
      };

      const res = await addItemsToActor(a, docs, keyFn);
      await this._log(html, `  • ${f.label}: added ${res.created}`);
    }
  }
  await this._log(html, "Actor application complete.");
  ui.notifications?.info("EQ5E: Applied class content to selected actors.");
}

    await this._log(html, "EQ5e setup finished.");
    ui.notifications?.info("EQ5E: Setup wizard finished. See log for details.");
  }
}

export function registerEQ5eSetupWizard() {
  game.settings.registerMenu("eq5e", "setupWizard", {
    name: "EQ5e Setup Wizard",
    label: "Open Setup Wizard",
    hint: "Import/refresh EQ5e core conditions, class packs, and AAs into world compendiums.",
    icon: "fas fa-wand-magic-sparkles",
    type: EQ5eSetupWizard,
    restricted: true
  });
}
