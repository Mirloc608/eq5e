const MODULE_ID = "eq5e-pet-shadowknight-necrotic";

const BASE = "systems/eq5e/bundles/eq5e-pet-shadowknight-necrotic";
const MOD = "eq5e-pet-shadowknight-necrotic";

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}


function _modulePath(moduleId, rel) {
  // If running as a separate module, use its path.
  try {
    const mod = game.modules?.get(moduleId);
    if (mod?.active && mod?.path) return `${mod.path}/${rel}`;
  } catch (e) {}
  // Bundled into the system: fall back to system bundle folder.
  return `systems/eq5e/bundles/${moduleId}/${rel}`;
}

function _stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label, type }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type,
    package: "world"
  });
}

async function upsertByName(pack, docs) {
  const existing = await pack.getDocuments();
  const byName = new Map(existing.map(d => [d.name, d]));
  const toCreate = [];
  const toUpdate = [];

  for (const d of (docs ?? [])) {
    const name = d?.name;
    if (!name) continue;
    const doc = byName.get(name);
    const h = _stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(d) : d));

    if (!doc) {
      d.flags = d.flags ?? {}; d.flags.eq5e = d.flags.eq5e ?? {};
      d.flags.eq5e.derivedHash = h;
      toCreate.push(d);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      if (old !== h) {
        const upd = foundry.utils.duplicate(d);
        upd._id = doc.id;
        upd.flags = upd.flags ?? {}; upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = h;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateShadowknightNecroticPacks() {
  const pets = await _fetchJSON(_modulePath(MOD, "data/sk-necrotic-pets.json"));
  const abilities = await _fetchJSON(_modulePath(MOD, "data/sk-necrotic-pet-abilities.json"));

  const petPack = await ensureWorldPack({ key: "world.eq5e-sk-necrotic-pets", label: "EQ5e Shadowknight Necrotic Pets", type: "Actor" });
  const abilPack = await ensureWorldPack({ key: "world.eq5e-sk-necrotic-pet-abilities", label: "EQ5e Shadowknight Necrotic Pet Abilities", type: "Item" });

  await upsertByName(petPack, pets);
  await upsertByName(abilPack, abilities);

  ui.notifications?.info("EQ5E: Shadowknight necrotic pet packs generated/updated.");
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "skNecroticOnStartup", {
    name: "Generate Shadowknight necrotic pet packs on startup",
    hint: "Creates/updates world.eq5e-sk-necrotic-pets and world.eq5e-sk-necrotic-pet-abilities.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "skNecroticOnStartup")) await generateShadowknightNecroticPacks();
  } catch (e) {
    console.error("[EQ5E] SK necrotic startup failed", e);
  }
});
