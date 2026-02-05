/**
 * EQ5E: Import/Refresh Core Catalogs into Compendiums
 * Upserts JSON catalogs into system packs.
 */
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return await res.json();
}

async function upsertToPack(packId, docs) {
  const pack = game.packs.get(packId);
  if (!pack) {
    ui.notifications?.error?.(`[EQ5E] Pack not found: ${packId}`);
    return;
  }
  await pack.getIndex({ fields: ["name", "type"] });
  const existing = new Map(pack.index.map(e => [`${e.name}::${e.type}`, e._id]));

  const toCreate = [];
  const toUpdate = [];
  for (const d of docs) {
    const key = `${d.name}::${d.type}`;
    const id = existing.get(key);
    if (id) toUpdate.push({ ...d, _id: id });
    else toCreate.push(d);
  }

  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  ui.notifications?.info?.(`[EQ5E] ${pack.metadata.label}: updated ${toUpdate.length}, created ${toCreate.length}`);
}

export async function importEq5eCoreCatalogs() {
  const itemsBase = "systems/eq5e/data/items";
  const actorsBase = "systems/eq5e/data/actors";

  const weapons = await fetchJson(`${itemsBase}/weapons-core.json`);
  const armor = await fetchJson(`${itemsBase}/armor-core.json`);
  const shields = await fetchJson(`${itemsBase}/shields-core.json`);
  const jewelry = await fetchJson(`${itemsBase}/jewelry-core.json`);
  const consumables = await fetchJson(`${itemsBase}/consumables-core.json`);
  const supplies = await fetchJson(`${itemsBase}/adventuring-supplies-core.json`);

  const mounts = await fetchJson(`${actorsBase}/mounts-core.json`);
  const vehicles = await fetchJson(`${actorsBase}/vehicles-core.json`);

  await upsertToPack("eq5e.weapons-core", weapons);
  await upsertToPack("eq5e.armor-core", armor);
  await upsertToPack("eq5e.shields-core", shields);
  await upsertToPack("eq5e.jewelry-core", jewelry);
  await upsertToPack("eq5e.consumables-core", consumables.concat(supplies));

  await upsertToPack("eq5e.mounts-core", mounts);
  await upsertToPack("eq5e.vehicles-core", vehicles);
}

if (game.user?.isGM) {
  await importEq5eCoreCatalogs();
}
