const MODULE_ID = "eq5e-pet-ranger-companion";

const BASE = "systems/eq5e/bundles/eq5e-pet-ranger-companion";
const MOD = "eq5e-pet-ranger-companion";

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
  for (let i=0;i<s.length;i++){h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);}
  return (h>>>0).toString(16);
}
async function ensureWorldPack({ key, label, type }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  return CompendiumCollection.createCompendium({ type, label, name: key.split(".")[1], package: "world" });
}
async function upsertByKey(pack, docs, getKey) {
  const idx = await pack.getIndex({ fields: ["name","flags.eq5e.spell.spellId","flags.eq5e.derivedHash"] });
  const byKey = new Map();
  for (const e of idx) byKey.set(String(getKey(e)), e._id);
  const toCreate=[], toUpdate=[];
  for (const d of docs) {
    const h = _stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(d) : d));
    d.flags = d.flags ?? {}; d.flags.eq5e = d.flags.eq5e ?? {};
    d.flags.eq5e.derivedHash = h;
    const k = String(getKey(d));
    const id = byKey.get(k);
    if (!id) toCreate.push(d);
    else {
      const cur = idx.find(x => x._id === id);
      if ((cur?.flags?.eq5e?.derivedHash ?? null) !== h) {
        const upd = foundry.utils.duplicate(d);
        upd._id = id;
        upd.flags = upd.flags ?? {}; upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = h;
        toUpdate.push(upd);
      }
    }
  }
  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateRangerCompanionPacks() {
  const pets = await _fetchJSON(_modulePath(MOD, "data/ranger-companions.json"));
  const abilities = await _fetchJSON(_modulePath(MOD, "data/ranger-companion-abilities.json"));

  const petPack = await ensureWorldPack({ key:"world.eq5e-ranger-companions", label:"EQ5e Ranger Companions", type:"Actor" });
  const abPack  = await ensureWorldPack({ key:"world.eq5e-ranger-companion-abilities", label:"EQ5e Ranger Companion Abilities", type:"Item" });

  await upsertByKey(petPack, pets, d => d.name);
  await upsertByKey(abPack, abilities, d => d?.flags?.eq5e?.spell?.spellId);

  ui.notifications?.info("EQ5E: Ranger companion packs generated/updated.");
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "rangerCompanionsOnStartup", {
    name: "Ranger Companions: Generate Packs on Startup",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "rangerCompanionsOnStartup")) await generateRangerCompanionPacks();
  } catch (e) { console.error("[EQ5E] Ranger companion startup failed", e); }
});
