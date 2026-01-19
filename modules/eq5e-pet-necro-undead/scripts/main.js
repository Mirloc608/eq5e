const MOD = "eq5e-pet-necro-undead";

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _modulePath(rel) {
  const mod = game.modules?.get(MOD);
  if (!mod) throw new Error(`Module not found: ${MOD}`);
  return `${mod.path}/${rel}`;
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
    const h = _stableHash(d);

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

export async function generateNecroUndeadPacks() {
  const pets = await _fetchJSON(_modulePath("data/necro-undead-pets.json"));
  const abilities = await _fetchJSON(_modulePath("data/necro-undead-abilities.json"));

  const petPack = await ensureWorldPack({ key: "world.eq5e-necro-undead-pets", label: "EQ5e Necromancer Undead Pets", type: "Actor" });
  const abilPack = await ensureWorldPack({ key: "world.eq5e-necro-undead-abilities", label: "EQ5e Necromancer Undead Pet Abilities", type: "Item" });

  await upsertByName(petPack, pets);
  await upsertByName(abilPack, abilities);

  ui.notifications?.info("EQ5E: Necromancer undead pet packs generated/updated.");
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "necroUndeadOnStartup", {
    name: "Generate Necromancer undead pet packs on startup",
    hint: "Creates/updates world.eq5e-necro-undead-pets and world.eq5e-necro-undead-abilities.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "necroUndeadOnStartup")) await generateNecroUndeadPacks();
  } catch (e) {
    console.error("[EQ5E] Necro undead startup failed", e);
  }
});
