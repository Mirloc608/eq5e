const MODULE_ID = "eq5e-pet-shaman-spirit";


const BASE = "systems/eq5e/bundles/eq5e-pet-shaman-spirit";
async function ensureWorldPack({ pack, label, type="Item" }) {
  const exists = game.packs?.get(pack);
  if (exists) return exists;
  const meta = {
    name: pack.split(".")[1],
    label,
    type,
    system: "eq5e",
    package: "world",
    path: `packs/${pack.split(".")[1]}.db`,
  };
  return await CompendiumCollection.createCompendium(meta);
}

async function fetchJSON(rel) {
  const url = `${BASE}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

function stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h>>>0).toString(16);
}

async function upsertJSONToPack({ rel, pack, label, key, type }) {
  const docs = await fetchJSON(rel);
  const p = await ensureWorldPack({ pack, label, type });
  await p.getIndex();
  const existingDocs = await p.getDocuments();
  const byKey = new Map();
  for (const d of existingDocs) {
    try { byKey.set(String(key(d)), d); } catch {}
  }
  const toCreate = [];
  const toUpdate = [];
  for (const raw of docs) {
    const d = foundry.utils.duplicate(raw);
    d.flags = d.flags ?? {};
    d.flags.eq5e = d.flags.eq5e ?? {};
    d.flags.eq5e.derivedHash = stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(d) : d));
    const k = String(key(d));
    const ex = byKey.get(k);
    if (!ex) toCreate.push(d);
    else if (ex.flags?.eq5e?.derivedHash !== d.flags.eq5e.derivedHash) {
      d._id = ex.id;
      toUpdate.push(d);
    }
  }
  const cls = p.documentClass;
  if (toCreate.length) await cls.createDocuments(toCreate, { pack: p.collection });
  if (toUpdate.length) await cls.updateDocuments(toUpdate, { pack: p.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

const IMPORTS = [
  { rel: "data/spirit-pets.json", pack: "world.eq5e-shaman-spirit-pets", label: "EQ5e Shaman Spirit Pets", type: "Actor",
    key: d => d?.name },
  { rel: "data/spirit-abilities.json", pack: "world.eq5e-shaman-spirit-abilities", label: "EQ5e Shaman Spirit Abilities", type: "Item",
    key: d => d?.flags?.eq5e?.spell?.spellId },
];

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    for (const imp of IMPORTS) await upsertJSONToPack(imp);
    console.log(`[EQ5E] ${MODULE_ID} loaded packs.`);
  } catch (e) { console.error(`[EQ5E] ${MODULE_ID} pack load failed`, e); }
});
