// EQ5e Berserker module: merges Berserker AAs into shared world.eq5e-aa pack.
// Drop-in FIX: sanitize embedded effects + handle type changes safely (Foundry v13).
// Upsert key: flags.eq5e.aa.aaId

const MOD_ID = "eq5e-class-berserker";
console.warn("[EQ5E] Berserker main.js loaded (DROPIN FIXED: effects+typechange)");

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function modulePath(moduleId, rel) {
  try {
    const mod = game.modules?.get(moduleId);
    if (mod?.active && mod?.path) return `${mod.path}/${rel}`;
  } catch (e) {}
  return `systems/eq5e/bundles/${moduleId}/${rel}`;
}

function stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user?.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type: "Item",
    package: "world"
  });
}

// --- Data normalization ------------------------------------------------------

function sanitizeItemForFoundryV13(raw) {
  const it = foundry.utils.duplicate(raw ?? {});
  if (!it || typeof it !== "object") return it;

  // Ensure Item.type is a valid string for EQ5e items; default to "aa"
  if (typeof it.type !== "string" || !it.type.trim() || /^\d+$/.test(it.type)) it.type = "aa";

  // Some sources accidentally use effects as an object-map of templates.
  // Foundry expects Item.effects: Array<ActiveEffectSource>
  const fx = it.effects;
  if (fx && !Array.isArray(fx) && typeof fx === "object") {
    it.flags = it.flags ?? {};
    it.flags.eq5e = it.flags.eq5e ?? {};
    it.flags.eq5e.effectTemplates = { ...(it.flags.eq5e.effectTemplates ?? {}), ...fx };
    delete it.effects;
  }

  // Valid embedded AE ids must be 16-char alphanumeric
  if (Array.isArray(it.effects)) {
    for (const e of it.effects) {
      if (!e) continue;
      if (!e._id || !/^[A-Za-z0-9]{16}$/.test(String(e._id))) {
        e._id = foundry.utils.randomID(16);
      }
    }
  }

  return it;
}

// --- Upsert helper -----------------------------------------------------------
// If an existing document has a different Item.type, Foundry v13 forbids changing it
// via update unless you force-replace system or set recursive:false (still risky).
// For packs, safest behavior: delete+recreate the entry.
async function upsertByKey(pack, items, getKey, { defaultType="aa" } = {}) {
  const existing = await pack.getDocuments();
  const byKey = new Map();
  for (const d of existing) {
    const k = getKey(d);
    if (k) byKey.set(k, d);
  }

  const toCreate = [];
  const toUpdate = [];
  const toRecreate = []; // {doc, data}

  for (const raw of (items ?? [])) {
    const data0 = sanitizeItemForFoundryV13(raw);
    if (!data0.type) data0.type = defaultType;

    const k = getKey(data0);
    if (!k) continue;

    // Hash AFTER sanitize so effect-id fixes don't cause perpetual churn
    const h = stableHash(data0);

    data0.flags = data0.flags ?? {};
    data0.flags.eq5e = data0.flags.eq5e ?? {};
    data0.flags.eq5e.derivedHash = h;

    const doc = byKey.get(k);
    if (!doc) {
      toCreate.push(data0);
      continue;
    }

    const oldHash = doc?.flags?.eq5e?.derivedHash ?? null;
    if (oldHash === h) continue;

    // Type change => recreate
    if (String(doc.type) !== String(data0.type)) {
      toRecreate.push({ doc, data: data0 });
      continue;
    }

    // Normal update
    const upd = foundry.utils.duplicate(data0);
    upd._id = doc.id;
    upd.type = doc.type; // pin type
    toUpdate.push(upd);
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });

  if (toRecreate.length) {
    const ids = toRecreate.map(r => r.doc.id);
    await pack.documentClass.deleteDocuments(ids, { pack: pack.collection });
    const recreated = toRecreate.map(r => r.data);
    await pack.documentClass.createDocuments(recreated, { pack: pack.collection });
  }

  return { created: toCreate.length + toRecreate.length, updated: toUpdate.length, recreated: toRecreate.length };
}

// --- Berserker AA merge ------------------------------------------------------

export async function mergeBerserkerAAsIntoSharedPack() {
  const pack = await ensureWorldPack({ key: "world.eq5e-aa", label: "EQ5e Alternate Abilities" });
  const aas = await fetchJSON(modulePath(MOD_ID, "data/aas.json"));

  const res = await upsertByKey(
    pack,
    aas,
    (x) => x?.flags?.eq5e?.aa?.aaId,
    { defaultType: "aa" }
  );

  ui.notifications?.info(`EQ5E: Berserker AAs merged. created ${res.created}, updated ${res.updated}${res.recreated ? `, recreated ${res.recreated}` : ""}.`);
  return { ok: true, pack: pack.collection, ...res };
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "berserkerAAsOnStartup", {
    name: "Berserker: Merge AAs on Startup",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user?.isGM) return;
  if (!game.settings.get("eq5e", "berserkerAAsOnStartup")) return;
  try {
    await mergeBerserkerAAsIntoSharedPack();
  } catch (e) {
    console.error("[EQ5E] Berserker startup failed", e);
  }
});
