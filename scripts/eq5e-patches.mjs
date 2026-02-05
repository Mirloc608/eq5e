/**
 * EQ5e Core Patches (v13)
 * - Permanent fix: remap invalid Item type "equipment" during creation/import
 * - Initialize AA + Runes frameworks (kept out of monolithic eq5e.mjs)
 */

function validItemTypes() {
  const dt = game.system?.documentTypes;
  if (dt && typeof dt === "object") return Object.keys(dt);
  const v13 = game.system?.documentTypes?.Item;
  if (Array.isArray(v13)) return v13;
  return [];
}

function getValidItemTypes() {
  try {
    const TYPES = globalThis.CONFIG?.Item?.documentClass?.TYPES;
    if (Array.isArray(TYPES)) {
      const vals = TYPES.filter(t => typeof t === "string" && t.trim() && !/^\d+$/.test(t.trim()));
      if (vals.length) return vals;
    }
    if (TYPES && typeof TYPES === "object") {
      // Some systems expose TYPES as a map; keys are the type strings
      const keys = Object.keys(TYPES).filter(k => typeof k === "string" && k.trim() && !/^[0-9]+$/.test(k));
      if (keys.length) return keys;
      // Or a map where values are the type strings
      const vals = Object.values(TYPES).filter(v => typeof v === "string" && v.trim() && !/^\d+$/.test(v.trim()));
      if (vals.length) return vals;
    }
  } catch (e) {}

  // Reasonable fallbacks
  return ["feat", "feature", "spell", "equipment", "loot"];
}

const EQ5E_DEBUG_ACTOR_TYPE_REMAP = false;
function _debugTypeRemap(before, after, name) {
  if (!EQ5E_DEBUG_ACTOR_TYPE_REMAP) return;
  try { console.warn(`[EQ5E] Item type remap: "${before}" -> "${after}"`, name || ""); } catch (e) {}
}


function pickSafeItemType(preferred) {
  const types = getValidItemTypes();
  if (preferred && types.includes(preferred)) return preferred;
  // Prefer common 5e-like defaults
  for (const t of ["feat","feature","spell","loot","equipment"]) {
    if (types.includes(t)) return t;
  }
  return types[0] || "feat";
}

function _sanitizeItemData(d) {
  if (!d) return d;

  // Coerce to plain object (and clone) so we can safely override fields
  let o = d;
  try {
    if (o.toObject && typeof o.toObject === "function") o = o.toObject();
  } catch (e) {}

  try {
    const dup = globalThis.foundry?.utils?.duplicate;
    if (typeof dup === "function") o = dup(o);
    else if (typeof structuredClone === "function") o = structuredClone(o);
    else o = JSON.parse(JSON.stringify(o));
  } catch (e) {
    // fallback: shallow clone
    try { o = Array.isArray(o) ? o.slice() : { ...o }; } catch (e2) {}
  }

  // Normalize type aggressively
  try { normalizeItemType(o); } catch (e) {
    // last resort: hard-set a safe type
    try {
      const safe = pickSafeItemType("feature");
      o.type = safe;
      if (o.data && typeof o.data === "object") o.data.type = safe;
    } catch (e2) {}
  }

  try { sanitizeEffectIds(o); } catch (e) {}
  try { remapEquipmentType(o); } catch (e) {}

  return o;
}

function _hardFixNumericType(obj) {
  try {
    const safe = pickSafeItemType("feature");
    const t = (obj && (obj.type ?? obj.data?.type));
    if (typeof t === "string" && /^\d+$/.test(t)) {
      obj.type = safe;
      if (obj.data && typeof obj.data === "object") obj.data.type = safe;
    }
  } catch (e) {}
  return obj;
}


function remapEquipmentType(d) {
  if (!d) return d;
  // Normalize type first (handles "Actor", unknowns, etc.)
  try { normalizeItemType(d); } catch (e) {}
  const obj = (d.data && typeof d.data === "object") ? d.data : d;
  if (obj.type === "equipment") obj.type = pickSafeItemType("equipment");
  return d;
}

function _isValidId16(id) {
  return typeof id === "string" && /^[A-Za-z0-9]{16}$/.test(id);
}

function sanitizeEffectIds(d) {
  if (!d) return d;
  // Foundry may accept effects as Array or as an Object keyed by ids
  const eff = d.effects;
  if (!eff) return d;

  // Array form
  if (Array.isArray(eff)) {
    for (const e of eff) {
      if (e && e._id && !_isValidId16(e._id)) delete e._id;
    }
    return d;
  }

  // Object map form
  if (typeof eff === "object") {
    for (const k of Object.keys(eff)) {
      const e = eff[k];
      if (e && e._id && !_isValidId16(e._id)) delete e._id;
    }
  }
  return d;
}

function normalizeItemType(d) {
  if (!d) return d;

  // If a Document slipped through, coerce to plain object
  try {
    if (d.toObject && typeof d.toObject === "function") d = d.toObject();
  } catch (e) {}

  const types = getValidItemTypes();

  // Candidate type can be on outer object or nested `data`
  let t = undefined;
  if (typeof d.type === "string" || typeof d.type === "number") t = d.type;
  else if (d.data && (typeof d.data.type === "string" || typeof d.data.type === "number")) t = d.data.type;

  // Normalize to string if present
  if (typeof t === "number") t = String(t);

  let finalType = null;

  if (typeof t !== "string" || t.trim() === "") {
    finalType = pickSafeItemType("feat");
  } else if (t === "equipment") {
    finalType = pickSafeItemType("equipment");
  } else if (t === "Actor" || t === "actor" || /^\d+$/.test(t)) {
    // "0" observed from some exports/importers; treat as invalid
    finalType = pickSafeItemType("feature");
    _debugTypeRemap(String(t), finalType, d.name || d.data?.name);
  } else if (!types.includes(t)) {
    finalType = pickSafeItemType("feature");
    _debugTypeRemap(String(t), finalType, d.name || d.data?.name);
  } else {
    finalType = t;
  }

  // Apply to both shapes to ensure Foundry sees it
  d.type = finalType;
  if (d.data && typeof d.data === "object") d.data.type = finalType;

  return d;
}


function wrapItemCreate() {
  const wrap = (obj, key) => {
    const orig = obj[key];
    if (typeof orig !== "function" || orig._eq5eWrapped) return;
    obj[key] = async function(data, options = {}) {
      try {
        if (Array.isArray(data)) data = data.map(d => _hardFixNumericType(_sanitizeItemData(d)));
        else data = _hardFixNumericType(_sanitizeItemData(data));
      } catch (e) {}
      return orig.call(this, data, options);
    };
    obj[key]._eq5eWrapped = true;
  };

  wrap(Item, "create");
  wrap(Item, "createDocuments");

  if (typeof Item.fromCompendium === "function" && !Item.fromCompendium._eq5eWrapped) {
    const orig = Item.fromCompendium;
    Item.fromCompendium = function(data, options) {
      try { data = _hardFixNumericType(_sanitizeItemData(data)); } catch (e) {}
      return orig.call(this, data, options);
    };
    Item.fromCompendium._eq5eWrapped = true;
  }
}

Hooks.once("init", () => {
  try { wrapItemCreate(); } catch (e) { console.warn("[EQ5e] equipment type remap failed", e); }

  // Initialize AA + Runes frameworks
  import("../modules/aa/aa-core-init.js")
    .then(m => m.registerAAFrameworkCore?.())
    .catch(e => console.warn("[EQ5e] AA framework init failed", e));

  import("../modules/runes/runes-core-init.js")
    .then(m => m.registerRunesFrameworkCore?.())
    .catch(e => console.warn("[EQ5e] Runes framework init failed", e));
});


// ---- Global Item create sanitization ----
try {
  const _origCreate = Item.create;
  const _origCreateDocuments = Item.createDocuments;
  if (_origCreate) {
    Item.create = function (data, options) {
      if (Array.isArray(data)) data = data.map(d => _hardFixNumericType(_sanitizeItemData(d)));
      else if (data && typeof data === "object") _sanitizeItemData(data);
      return _origCreate.call(this, data, options);
    };
  }
  if (_origCreateDocuments) {
    Item.createDocuments = function (data, options) {
          if (Array.isArray(data)) data = data.map(d => _hardFixNumericType(_sanitizeItemData(d)));
          else if (data && typeof data === "object") data = _hardFixNumericType(_sanitizeItemData(data));
          return _origCreateDocuments.call(this, data, options);
    };
  }
} catch (e) {
  console.warn("[EQ5E] Item create sanitization wrapper failed", e);
}



// ---- Backend-level sanitization for Item creates (catches pack upserts that bypass Item.create*) ----
try {
  const CDB = globalThis.ClientDatabaseBackend;
  if (CDB?.prototype?._createDocuments && !CDB.prototype._eq5eSanitized) {
    const _orig = CDB.prototype._createDocuments;
    CDB.prototype._createDocuments = async function (documentClass, context, ...rest) {
      try {
        const isItem = (documentClass === Item) || (documentClass?.documentName === "Item") || (context?.documentName === "Item");
        if (isItem && Array.isArray(context?.data)) {
          context.data = context.data.map(d => _sanitizeItemData(d));
        }
      } catch (e) {}
      return _orig.call(this, documentClass, context, ...rest);
    };
    CDB.prototype._eq5eSanitized = true;
  }
} catch (e) {
  console.warn("[EQ5E] Backend Item sanitization wrapper failed", e);
}
