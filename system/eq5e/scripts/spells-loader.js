// EQ5e Example Spell Loader
// Generates/updates a world compendium with example spells that apply conditions (mez/root/snare/silence).
// Deterministic: upsert by flags.eq5e.spell.spellId

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type: "Item",
    package: "world"
  });
}

async function upsertItems(pack, items) {
  const existing = await pack.getDocuments();
  const bySpellId = new Map();
  for (const d of existing) {
    const sid = d?.flags?.eq5e?.spell?.spellId;
    if (sid) bySpellId.set(sid, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (items ?? [])) {
    const sid = it?.flags?.eq5e?.spell?.spellId;
    if (!sid) continue;
    const doc = bySpellId.get(sid);
    if (!doc) {
      // stamp derivedHash for future comparisons
      const h = _stableHash(it);
      it.flags = it.flags ?? {};
      it.flags.eq5e = it.flags.eq5e ?? {};
      it.flags.eq5e.derivedHash = h;
      toCreate.push(it);
    } else {
      const h = _stableHash(it);
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

export async function generateExampleSpellsCompendium({
  key = "world.eq5e-spells-examples",
  label = "EQ5e Spells (Examples)"
} = {}) {
  const path = "system/eq5e/data/spells-examples.json";
  const items = await _fetchJSON(path);
  const pack = await ensureWorldPack({ key, label });
  const res = await upsertItems(pack, items);
  ui.notifications?.info(`EQ5E: Example spells upserted: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, pack: pack.collection, ...res };
}
