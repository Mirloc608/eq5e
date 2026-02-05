/**
 * EQ5E ActiveEffect Normalizer (v4.1 - load verification + flattened-update aware)
 *
 * Fixes Foundry v13 strict validation for Item embedded ActiveEffects:
 * - ActiveEffect `_id` must be a 16-character alphanumeric string
 *
 * Handles BOTH shapes Foundry uses in updates:
 *  1) change.effects = { ae_key: { _id: "ae_key", ... }, ... }  (object-map)
 *  2) flattened diff keys like:
 *       change["effects.ae_key._id"] = "ae_key"
 *       change["effects.ae_key"] = { _id: "ae_key", ... }
 *
 * Normalizes via preCreateItem / preUpdateItem (runs before validation).
 * Exposes `game.eq5e.normalizeItemData(data)` for loaders.
 */

const EQ5E_AE_PATCH_FLAG = "eq5e.aeNormalizerPatchedV4_1";

function isValid16Id(id) {
  return (typeof id === "string") && /^[A-Za-z0-9]{16}$/.test(id);
}

// FNV-1a 32-bit -> hex
function stableHashHex(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function stableId16(obj) {
  return stableHashHex(obj).padStart(16, "0").slice(0, 16);
}

function normalizeEffectObj(e) {
  const eff = foundry.utils.duplicate(e ?? {});
  if (!isValid16Id(eff._id)) {
    const basis = foundry.utils.duplicate(eff);
    delete basis._id;
    eff._id = stableId16(basis);
  }
  if (!eff.name && eff.label) eff.name = eff.label;
  return eff;
}

function normalizeEffectsContainer(effects) {
  if (!effects) return effects;

  if (Array.isArray(effects)) {
    return effects.filter(Boolean).map(normalizeEffectObj);
  }
  if (typeof effects === "object") {
    const out = {};
    for (const [k, v] of Object.entries(effects)) out[k] = normalizeEffectObj(v);
    return out;
  }
  return effects;
}

function normalizeItemData(d) {
  const data = foundry.utils.duplicate(d ?? {});
  if ("effects" in data) data.effects = normalizeEffectsContainer(data.effects);
  return data;
}

function normalizePreUpdateChange(change) {
  if (!change || typeof change !== "object") return;

  // Container present
  if ("effects" in change) {
    change.effects = normalizeEffectsContainer(change.effects);
  }

  // Flattened updates
  for (const [k, v] of Object.entries(change)) {
    if (!k.startsWith("effects.")) continue;

    // effects.<key>
    const mObj = /^effects\.([^.]+)$/.exec(k);
    if (mObj && v && typeof v === "object") {
      change[k] = normalizeEffectObj(v);
      continue;
    }

    // effects.<key>._id
    const mId = /^effects\.([^.]+)\._id$/.exec(k);
    if (mId) {
      if (!isValid16Id(v)) {
        change[k] = stableId16({ key: mId[1], old: v });
      }
      continue;
    }
  }
}

Hooks.once("init", () => {
  try {
    if (foundry.utils.getProperty(game, EQ5E_AE_PATCH_FLAG)) return;

    game.eq5e = game.eq5e ?? {};
    game.eq5e.normalizeItemData = normalizeItemData;

    Hooks.on("preCreateItem", (doc, data) => {
      try {
        if (data && typeof data === "object" && ("effects" in data)) {
          data.effects = normalizeEffectsContainer(data.effects);
        }
      } catch (e) { console.error("[EQ5E] preCreateItem normalize failed", e); }
    });

    Hooks.on("preUpdateItem", (doc, change) => {
      try { normalizePreUpdateChange(change); }
      catch (e) { console.error("[EQ5E] preUpdateItem normalize failed", e); }
    });

    foundry.utils.setProperty(game, EQ5E_AE_PATCH_FLAG, true);
    console.warn("[EQ5E] ActiveEffect normalizer installed (v4.1, verified load).");
  } catch (e) {
    console.error("[EQ5E] AE normalizer failed to install (v4.1)", e);
  }
});
