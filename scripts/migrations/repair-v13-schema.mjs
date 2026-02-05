/* -------------------------------------------- */
/* EQ5E V13 Schema Repair + Sheet Expectations    */
/* One-time migration + validation               */
/* -------------------------------------------- */

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o && k in o ? o[k] : undefined), obj);
}

function set(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

function ensureDefaults(systemData, defaults) {
  const updates = {};
  for (const [path, def] of Object.entries(defaults)) {
    const v = get(systemData, path);
    if (v === undefined || v === null) {
      set(updates, path, def);
    }
  }
  return updates;
}

// These are the minimal fields most sheets expect
const ACTOR_DEFAULTS = {
  "details.race": "",
  "details.class": "",
  "details.level": 1,
  "attributes.hp.value": 0,
  "attributes.hp.max": 0,
  "attributes.mana.value": 0,
  "attributes.mana.max": 0,
  "attributes.endurance.value": 0,
  "attributes.endurance.max": 0,
  "resources": {},
  "flags": {}
};

const ITEM_DEFAULTS_BY_TYPE = {
  aa: {
    "rank": 1,
    "maxRank": 1,
    "cost": 0,
    "prereq": "",
    "description": ""
  }
};

// If your ActorSheet V2 reads additional paths, add them here.
// This logs missing keys without crashing.
const ACTORSHEET_V2_EXPECTS = [
  "system.details.race",
  "system.details.class",
  "system.details.level",
  "system.attributes.hp.value",
  "system.attributes.hp.max",
  "system.attributes.mana.value",
  "system.attributes.mana.max",
  "system.attributes.endurance.value",
  "system.attributes.endurance.max"
];

function validateSheetExpectations(actor) {
  const missing = [];
  for (const p of ACTORSHEET_V2_EXPECTS) {
    if (get(actor, p) === undefined) missing.push(p);
  }
  return missing;
}

/** Fix world actors/items (not compendiums) */
export async function runWorldSchemaRepair({ dryRun = false } = {}) {
  const actorFixes = [];
  const itemFixes = [];

  // ACTORS
  for (const a of game.actors.contents) {
    if (!["character", "npc", "pet"].includes(a.type)) continue;

    const sys = a.system ?? {};
    const patch = ensureDefaults(sys, ACTOR_DEFAULTS);

    const missingForSheet = validateSheetExpectations(a);
    if (missingForSheet.length) {
      console.warn(`[EQ5E][SheetV2] Actor "${a.name}" missing:`, missingForSheet);
    }

    if (Object.keys(patch).length) {
      actorFixes.push({ id: a.id, name: a.name, type: a.type, patch });
      if (!dryRun) await a.update({ system: foundry.utils.mergeObject(a.system ?? {}, patch, { inplace: false }) });
    }
  }

  // ITEMS
  for (const it of game.items.contents) {
    const defaults = ITEM_DEFAULTS_BY_TYPE[it.type];
    if (!defaults) continue;

    const sys = it.system ?? {};
    const patch = ensureDefaults(sys, defaults);

    if (Object.keys(patch).length) {
      itemFixes.push({ id: it.id, name: it.name, type: it.type, patch });
      if (!dryRun) await it.update({ system: foundry.utils.mergeObject(it.system ?? {}, patch, { inplace: false }) });
    }
  }

  console.log(`[EQ5E] World schema repair complete. Actors patched: ${actorFixes.length}. Items patched: ${itemFixes.length}.`);
  return { actorFixes, itemFixes };
}

/** Optional: Fix compendium packs too (safe but slower) */
export async function runCompendiumSchemaRepair({ dryRun = false, packFilter = (pack) => true } = {}) {
  const results = [];
  for (const pack of game.packs) {
    if (!packFilter(pack)) continue;
    if (!["Actor", "Item"].includes(pack.documentName)) continue;

    const docs = await pack.getDocuments();
    let patched = 0;

    for (const d of docs) {
      if (d.documentName === "Actor" && ["character", "npc", "pet"].includes(d.type)) {
        const patch = ensureDefaults(d.system ?? {}, ACTOR_DEFAULTS);
        if (Object.keys(patch).length) {
          patched++;
          if (!dryRun) await d.update({ system: foundry.utils.mergeObject(d.system ?? {}, patch, { inplace: false }) });
        }
      }

      if (d.documentName === "Item") {
        const defaults = ITEM_DEFAULTS_BY_TYPE[d.type];
        if (!defaults) continue;
        const patch = ensureDefaults(d.system ?? {}, defaults);
        if (Object.keys(patch).length) {
          patched++;
          if (!dryRun) await d.update({ system: foundry.utils.mergeObject(d.system ?? {}, patch, { inplace: false }) });
        }
      }
    }

    results.push({ pack: pack.collection, patched });
    if (patched) console.log(`[EQ5E] Patched ${patched} docs in pack ${pack.collection}`);
  }

  return results;
}

/** Optional: Find (and optionally delete) orphan tokens */
export async function repairOrphanTokens({ deleteOrphans = false } = {}) {
  const broken = [];
  for (const scene of game.scenes) {
    for (const td of scene.tokens) {
      const actor = game.actors.get(td.actorId);
      if (!actor) broken.push({ scene: scene.name, tokenId: td.id, tokenName: td.name, actorId: td.actorId });
    }
  }

  if (!broken.length) {
    console.log("[EQ5E] No orphan tokens found.");
    return { broken: [], deleted: 0 };
  }

  console.warn("[EQ5E] Orphan tokens:", broken);

  let deleted = 0;
  if (deleteOrphans) {
    for (const scene of game.scenes) {
      const ids = scene.tokens.filter(td => !game.actors.get(td.actorId)).map(td => td.id);
      if (!ids.length) continue;
      await scene.deleteEmbeddedDocuments("Token", ids);
      deleted += ids.length;
      console.warn(`[EQ5E] Deleted ${ids.length} orphan tokens from scene "${scene.name}"`);
    }
  }

  return { broken, deleted };
}