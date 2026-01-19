// EQ5e Berserker module: generates class compendiums and merges Berserker AAs into the shared world.eq5e-aa pack.
const MOD = "eq5e-class-berserker";

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

async function ensureWorldPack({ key, label, type="Item" }) {
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

async function upsertByKey(pack, items, keyFn) {
  const existing = await pack.getDocuments();
  const byKey = new Map();
  for (const d of existing) {
    const k = keyFn(d);
    if (k) byKey.set(k, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (items ?? [])) {
    const k = keyFn(it);
    if (!k) continue;
    const doc = byKey.get(k);
    const h = _stableHash(it);

    if (!doc) {
      it.flags = it.flags ?? {};
      it.flags.eq5e = it.flags.eq5e ?? {};
      it.flags.eq5e.derivedHash = h;
      toCreate.push(it);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      if (old !== h) {
        const upd = foundry.utils.duplicate(it);
        upd._id = doc.id;
        upd.flags = upd.flags ?? {};
        upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = h;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateBerserkerPacks() {
  const features = await _fetchJSON(_modulePath("data/berserker-features.json"));
  const discs = await _fetchJSON(_modulePath("data/berserker-disciplines.json"));

  const featPack = await ensureWorldPack({ key: "world.eq5e-berserker-features", label: "EQ5e Berserker Class Features" });
  const discPack = await ensureWorldPack({ key: "world.eq5e-berserker-disciplines", label: "EQ5e Berserker Disciplines" });

  await upsertByKey(featPack, features.map(f => {
    // reuse spellId slot for deterministic upsert (like other loaders)
    f.flags = f.flags ?? {}; f.flags.eq5e = f.flags.eq5e ?? {};
    f.flags.eq5e.spell = f.flags.eq5e.spell ?? {};
    f.flags.eq5e.spell.spellId = f.flags.eq5e.spell.spellId ?? f.flags.eq5e.sourceId ?? f.name;
    return f;
  }), (d) => d?.flags?.eq5e?.spell?.spellId ?? d?.flags?.eq5e?.sourceId);

  await upsertByKey(discPack, discs, (d) => d?.flags?.eq5e?.spell?.spellId);

  ui.notifications?.info("EQ5E: Berserker packs generated/updated.");
}

export async function mergeBerserkerAAsIntoSharedPack() {
  const aas = await _fetchJSON(_modulePath("data/berserker-aas.json"));
  const pack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities" });
  const res = await upsertByKey(pack, aas, (d) => d?.flags?.eq5e?.aa?.aaId);
  ui.notifications?.info(`EQ5E: Berserker AAs merged: created ${res.created}, updated ${res.updated}.`);
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "berserkerOnStartup", {
    name: "Generate Berserker packs on startup",
    hint: "Creates/updates Berserker features & disciplines packs.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("eq5e", "berserkerAAsOnStartup", {
    name: "Merge Berserker AAs into shared AA pack on startup",
    hint: "Upserts Berserker AA items into world.eq5e-aa (used by the AA Browser).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "berserkerOnStartup")) await generateBerserkerPacks();
    if (game.settings.get("eq5e", "berserkerAAsOnStartup")) await mergeBerserkerAAsIntoSharedPack();
  } catch (e) {
    console.error("[EQ5E] Berserker startup failed", e);
  }
});
