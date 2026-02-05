const MOD = "eq5e-class-wizard";

function _modulePath(moduleId, rel) {
  // If running as a separate module, use its path.
  try {
    const mod = game.modules?.get(moduleId);
    if (mod?.active && mod?.path) return `${mod.path}/${rel}`;
  } catch (e) {}
  // Bundled into the system: fall back to system bundle folder.
  return `systems/eq5e/bundles/${moduleId}/${rel}`;
}


// Shared loader helper (some packs call _fetchJSON directly)
async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

async function ensureWorldPack({ key, label, type="Item" } = {}) {
  const existing = game.packs?.get?.(key);
  if (existing) return existing;
  // key like "world.foo" -> name "foo"
  const parts = String(key ?? "").split(".");
  const name = parts.length > 1 ? parts.slice(1).join(".") : parts[0];
  const metadata = {
    name,
    label: label ?? name,
    type,
    package: "world",
    system: game.system?.id
  };
  return await CompendiumCollection.createCompendium(metadata);
}


async function upsertSpells(pack, spells=[]) {
  // spells: array of Item-like data (type should be "spell")
  if (!pack) return;
  const docs = Array.isArray(spells) ? spells : [];
  if (!docs.length) return;
  await pack.getIndex?.({ fields: ["name"] });
  // Create docs in the pack (Foundry will handle IDs)
  return await pack.importDocuments?.(docs) ?? await Item.createDocuments(docs, { pack: pack.collection });
}

async function upsertAAs(pack, aas=[]) {
  if (!pack) return;
  const docs = Array.isArray(aas) ? aas : [];
  if (!docs.length) return;
  await pack.getIndex?.({ fields: ["name"] });
  return await pack.importDocuments?.(docs) ?? await Item.createDocuments(docs, { pack: pack.collection });
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "wizardOnStartup", {
    name: "Wizard: Import Spells & AAs on Startup",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (!game.settings.get("eq5e", "wizardOnStartup")) return;

  const spells = await _fetchJSON(_modulePath(MOD, "data/spells.json"));
  const aas = await _fetchJSON(_modulePath(MOD, "data/aas.json"));

  const spellPack = await ensureWorldPack({ key:"world.eq5e-class-wizard-spells", label:"EQ5e Wizard Spells" });
  const aaPack = await ensureWorldPack({ key:"world.eq5e-aa", label:"EQ5e Alternate Abilities" });

  await upsertSpells(spellPack, spells);
  await upsertAAs(aaPack, aas);

  ui.notifications.info("EQ5e: Wizard spells and AAs imported.");
});
