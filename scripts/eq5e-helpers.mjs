/* -------------------------------------------- */
/* EQ5E Helpers / Globals (Foundry v13, ESModule)*/
/* -------------------------------------------- */

globalThis.EQ5E ??= {};
EQ5E.cache ??= {};

// Races cache
EQ5E.cache.races ??= [];
EQ5E.cache.racesById ??= new Map();

// Optional caches
EQ5E.cache.classes ??= [];
EQ5E.cache.classesById ??= new Map();

/** Safe lookup: id (preferred) or key (fallback) */
EQ5E.getRaceById = function getRaceById(idOrKey) {
  const id = String(idOrKey ?? "").toLowerCase();
  if (!id) return null;

  if (EQ5E.cache.racesById?.has(id)) return EQ5E.cache.racesById.get(id);

  // Fallback by key
  for (const race of (EQ5E.cache.racesById?.values?.() ?? [])) {
    if (race?.key === id) return race;
  }

  // Fallback to legacy storage if you use it
  return (game.eq5e?.races ?? {})[id] ?? null;
};

/** Reset caches (safe no-op if unused) */
EQ5E.resetParse = function resetParse() {
  try {
    EQ5E.cache.racesById?.clear?.();
    EQ5E.cache.races = [];
    EQ5E.cache.classesById?.clear?.();
    EQ5E.cache.classes = [];
  } catch (err) {
    console.warn("[EQ5E] resetParse non-fatal error", err);
  }
};

// Back-compat shims so old code calling bare functions doesn’t crash
globalThis.getRaceById ??= EQ5E.getRaceById;
globalThis.resetParse ??= EQ5E.resetParse;

/* -------------------------------------------- */
/* Optional: Load races from JSON on ready       */
/* (Only keep this if you're using JSON files)   */
/* -------------------------------------------- */

function _systemPath(systemId, relative) {
  // If you already have _systemPath elsewhere, remove this function
  // and rely on your existing one.
  return `systems/${systemId}/${relative}`.replace(/\/+/g, "/");
}

async function _loadJson(relativePath) {
  try {
    const url = _systemPath("eq5e", relativePath);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

Hooks.once("ready", async () => {
  // If you already load races elsewhere, you can delete this block.
  const races = await _loadJson("data/races-classic.json");
  if (!Array.isArray(races)) return;

  // Expecting array of { id/key/name/... }
  EQ5E.cache.races = races.map(r => {
    const key = String(r.id ?? r.key ?? r.name ?? "").toLowerCase().replace(/\s+/g, "-");
    return {
      ...r,
      id: key,
      key,
      label: r.label ?? r.name ?? key
    };
  });

  EQ5E.cache.racesById.clear();
  for (const r of EQ5E.cache.races) EQ5E.cache.racesById.set(r.id, r);

  // Also expose legacy map if your older code uses game.eq5e.races
  game.eq5e ??= {};
  game.eq5e.races ??= {};
  for (const r of EQ5E.cache.races) game.eq5e.races[r.id] = r;

  console.log(`[EQ5E] Loaded races (json): ${EQ5E.cache.races.length}`);
});