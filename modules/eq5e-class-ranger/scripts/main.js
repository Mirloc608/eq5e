import { registerRangerCompanionWidget } from "./companion-widget.js";

const MOD = "eq5e-class-ranger";

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
  for (let i=0;i<s.length;i++){h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);}
  return (h>>>0).toString(16);
}
async function ensureWorldPack({ key, label, type="Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  return CompendiumCollection.createCompendium({ type, label, name: key.split(".")[1], package: "world" });
}
async function upsertByKey(pack, docs, getKey) {
  const idx = await pack.getIndex({ fields: ["name","flags.eq5e.spell.spellId","flags.eq5e.aa.aaId","flags.eq5e.derivedHash"] });
  const byKey = new Map();
  for (const e of idx) byKey.set(String(getKey(e)), e._id);
  const toCreate=[], toUpdate=[];
  for (const d of docs) {
    const h = _stableHash(d);
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
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateRangerPacks() {
  const spells = await _fetchJSON(_modulePath("data/ranger-spells.json"));
  const discs = await _fetchJSON(_modulePath("data/ranger-disciplines.json"));
  const feats = await _fetchJSON(_modulePath("data/ranger-features.json"));

  const spellPack = await ensureWorldPack({ key: "world.eq5e-ranger-spells", label: "EQ5e Ranger Spells" });
  const discPack  = await ensureWorldPack({ key: "world.eq5e-ranger-disciplines", label: "EQ5e Ranger Disciplines" });
  const featPack  = await ensureWorldPack({ key: "world.eq5e-ranger-features", label: "EQ5e Ranger Class Features" });

  await upsertByKey(spellPack, spells, d => d?.flags?.eq5e?.spell?.spellId);
  await upsertByKey(discPack, discs, d => d?.flags?.eq5e?.spell?.spellId);
  await upsertByKey(featPack, feats.map(f => {
    f.flags = f.flags ?? {}; f.flags.eq5e = f.flags.eq5e ?? {};
    f.flags.eq5e.spell = f.flags.eq5e.spell ?? {};
    f.flags.eq5e.spell.spellId = f.flags.eq5e.spell.spellId ?? f.flags.eq5e.sourceId ?? f.name;
    return f;
  }), d => d?.flags?.eq5e?.spell?.spellId);

  ui.notifications?.info("EQ5E: Ranger packs generated/updated.");
}

export async function mergeRangerAAsIntoSharedPack() {
  const aas = await _fetchJSON(_modulePath("data/ranger-aas.json"));
  const aaPack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities" });
  await upsertByKey(aaPack, aas, d => d?.flags?.eq5e?.aa?.aaId);
  ui.notifications?.info("EQ5E: Ranger AAs merged into shared AA pack.");
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "rangerOnStartup", { name: "Ranger: Generate Packs on Startup", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register("eq5e", "rangerAAsOnStartup", { name: "Ranger: Merge AAs on Startup", scope: "world", config: true, type: Boolean, default: true });

  registerRangerCompanionWidget();
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "rangerOnStartup")) await generateRangerPacks();
    if (game.settings.get("eq5e", "rangerAAsOnStartup")) await mergeRangerAAsIntoSharedPack();
  } catch (e) { console.error("[EQ5E] Ranger startup failed", e); }
});
