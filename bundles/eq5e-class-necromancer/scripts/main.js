const MODULE_ID = "eq5e-class-necromancer";


const MOD = MODULE_ID;
const BASE = "systems/eq5e/bundles/eq5e-class-necromancer";
import { registerNecroUndeadWidget } from './undead-widget.js';
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

async function ensureWorldPack({ key, label, type="Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return foundry.documents.collections.CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type,
    package: "world"
  });
}

async function upsertByKey(pack, docs, keyFn) {
  const existing = await pack.getDocuments();
  const byKey = new Map();
  for (const d of existing) {
    const k = keyFn(d);
    if (k) byKey.set(k, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (docs ?? [])) {
    const k = keyFn(it);
    if (!k) continue;
    const doc = byKey.get(k);
    const h = _stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(it) : it));

    if (!doc) {
      it.flags = it.flags ?? {}; it.flags.eq5e = it.flags.eq5e ?? {};
      it.flags.eq5e.derivedHash = h;
      toCreate.push(it);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      if (old !== h) {
        const upd = foundry.utils.duplicate(it);
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

export async function generateNecromancerPacks() {
  const spells = await _fetchJSON(_modulePath(MOD, "data/spells.json"));
  const spellPack = await ensureWorldPack({ key: "world.eq5e-necro-spells", label: "EQ5e Necromancer Spells", type: "Item" });
  await upsertByKey(spellPack, spells, d => d?.flags?.eq5e?.spell?.spellId);
  ui.notifications?.info("EQ5E: Necromancer spells pack generated/updated.");
}

export async function mergeNecromancerAAsIntoSharedPack() {
  const aas = await _fetchJSON(_modulePath(MOD, "data/aas.json"));
  const pack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item" });
  const res = await upsertByKey(pack, aas, d => d?.flags?.eq5e?.aa?.aaId);
  ui.notifications?.info(`EQ5E: Necromancer AAs merged: created ${res.created}, updated ${res.updated}.`);
}

Hooks.once("init", () => {
  registerNecroUndeadWidget();
  game.settings.register("eq5e", "necromancerOnStartup", {
    name: "Generate Necromancer packs on startup",
    hint: "Creates/updates Necromancer spell pack.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("eq5e", "necromancerAAsOnStartup", {
    name: "Merge Necromancer AAs into shared AA pack on startup",
    hint: "Upserts Necromancer AA items into world.eq5e-aa.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "necromancerOnStartup")) await generateNecromancerPacks();
    if (game.settings.get("eq5e", "necromancerAAsOnStartup")) await mergeNecromancerAAsIntoSharedPack();
  } catch (e) {
    console.error("[EQ5E] Necromancer startup failed", e);
  }
});
