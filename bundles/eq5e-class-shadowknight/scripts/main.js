import { registerShadowknightWidget } from './shadowknight-widget.js';
import { registerShadowknightNecroticWidget } from './necrotic-widget.js';
const MOD = "eq5e-class-shadowknight";

async function ensureWorldPack({ key, label, type = "Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({ type, label, name: key.split(".")[1], package: "world" });
}

async function upsertAAs(pack, items) {
  const existing = await pack.getDocuments();
  const byId = new Map();
  for (const d of existing) {
    const id = d?.flags?.eq5e?.aa?.aaId;
    if (id) byId.set(id, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (items ?? [])) {
    const id = it?.flags?.eq5e?.aa?.aaId;
    if (!id) continue;
    const doc = byId.get(id);
    const hash = _stableHash(it);
    const data = foundry.utils.duplicate(it);
    data.flags = data.flags ?? {};
    data.flags.eq5e = data.flags.eq5e ?? {};
    data.flags.eq5e.derivedHash = hash;

    if (!doc) toCreate.push(data);
    else {
      const curHash = doc?.flags?.eq5e?.derivedHash ?? null;
      if (curHash !== hash) {
        data._id = doc.id;
        toUpdate.push(data);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });

  return { created: toCreate.length, updated: toUpdate.length };
}

async function generateShadowknightAAs() {
  const aaPack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities", type: "Item" });
  const aas = await _fetchJSON(_modulePath(MOD, "data/aas.json"));
  const res = await upsertAAs(aaPack, aas);
  ui.notifications?.info(`EQ5E: Shadowknight AAs merged. +${res.created} / ~${res.updated}`);
}

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


// (deduped) removed duplicate ensureWorldPack

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
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateShadowknightSummonPack() {
  const summons = await _fetchJSON(_modulePath(MOD, "data/summons.json"));
  const pack = await ensureWorldPack({ key: "world.eq5e-sk-summons", label: "EQ5e Shadowknight Summons", type: "Item" });
  await upsertByKey(pack, summons, d => d?.flags?.eq5e?.spell?.spellId);
  ui.notifications?.info("EQ5E: Shadowknight summon pack generated/updated.");
}

Hooks.once("init", () => {
  registerShadowknightNecroticWidget();
  registerShadowknightWidget();
  game.settings.register("eq5e", "shadowknightAAsOnStartup", { name: "Merge Shadowknight AAs on startup", hint: "Merges Shadowknight AA definitions into the shared AA pack.", scope: "world", config: true, type: Boolean, default: true });

  game.settings.register("eq5e", "shadowknightOnStartup", {
    name: "Generate Shadowknight packs on startup",
    hint: "Creates/updates Shadowknight summon pack.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "shadowknightOnStartup")) await generateShadowknightSummonPack();
    if (game.settings.get("eq5e", "shadowknightAAsOnStartup")) await generateShadowknightAAs();
  } catch (e) {
    console.error("[EQ5E] Shadowknight startup failed", e);
  }
});