const MODULE_ID = "eq5e-class-druid";


const MOD = MODULE_ID;
const BASE = "systems/eq5e/bundles/eq5e-class-druid";
import { registerDruidWidget } from "./druid-widget.js";

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
async function ensureWorldPack({ key, label, type="Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  return foundry.documents.collections.CompendiumCollection.createCompendium({ type, label, name: key.split(".")[1], package: "world" });
}
async function upsertByKey(pack, docs, getKey) {
  const idx = await pack.getIndex({ fields: ["name","flags.eq5e.spell.spellId","flags.eq5e.aa.aaId","flags.eq5e.derivedHash"] });
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
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateDruidPacks() {
  const spells = await _fetchJSON(_modulePath(MOD, "data/spells.json"));
  const spellPack = await ensureWorldPack({ key: "world.eq5e-druid-spells", label: "EQ5e Druid Spells" });
  await upsertByKey(spellPack, spells, d => d?.flags?.eq5e?.spell?.spellId);
  ui.notifications?.info("EQ5E: Druid spells pack generated/updated.");
}

export async function mergeDruidAAsIntoSharedPack() {
  const aas = await _fetchJSON(_modulePath(MOD, "data/aas.json"));
  const aaPack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities" });
  await upsertByKey(aaPack, aas, d => d?.flags?.eq5e?.aa?.aaId);
  ui.notifications?.info("EQ5E: Druid AAs merged into shared AA pack.");
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "druidOnStartup", { name: "Druid: Generate Packs on Startup", scope: "world", config: true, type: Boolean, default: true });
  game.settings.register("eq5e", "druidAAsOnStartup", { name: "Druid: Merge AAs on Startup", scope: "world", config: true, type: Boolean, default: true });
  registerDruidWidget();
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "druidOnStartup")) await generateDruidPacks();
    if (game.settings.get("eq5e", "druidAAsOnStartup")) await mergeDruidAAsIntoSharedPack();
  } catch (e) { console.error("[EQ5E] Druid startup failed", e); }
});
