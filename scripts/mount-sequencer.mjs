/**
 * EQ5e Mount Token FX (Sequencer required)
 * Foundry VTT v13+
 *
 * What it does:
 * - Watches Actor items for an equipped mount (flags.eq5e.category === "mount" && flags.eq5e.equipped === true)
 * - When the actor's active token exists, attaches a persistent Sequencer effect to that token
 * - When mount is removed/unequipped, ends the persistent effect
 *
 * Requirements:
 * - Sequencer module active
 *
 * Configuration (mount item flags):
 * flags.eq5e.mount.fx: {
 *   file?: string,          // webm path; default chosen by era
 *   scale?: number,         // default 0.9
 *   below?: boolean,        // default true (render under token)
 *   opacity?: number,       // default 1.0
 *   tint?: string,          // optional hex like "#ffffff"
 *   offsetY?: number        // default 0
 *   offsetX?: number        // default 0
 * }
 *
 * Optional actor flag to disable:
 * flags.eq5e.disableMountFx === true
 */

const MODULE_ID = "eq5e";
const HOOK_ID = "eq5e-mount-sequencer";
const EFFECT_PREFIX = "eq5e-mountfx:";

Hooks.once("init", () => {
  game.eq5e = game.eq5e ?? {};
  game.eq5e.mountFx = {
    refreshActorMountFx,
    applyMountFxToToken,
    removeMountFxFromToken,
    getEquippedMountItem,
    isSequencerActive,
  };
});

Hooks.once("ready", () => {
  // Only install hooks if Sequencer is present; otherwise noop.
  if (!isSequencerActive()) {
    console.warn("[EQ5E] Mount FX: Sequencer not active; mount token FX disabled.");
    return;
  }

  console.log("[EQ5E] Mount FX: Sequencer integration active.");

  // Refresh for currently rendered tokens
  canvas?.tokens?.placeables?.forEach(t => {
    const a = t?.actor;
    if (a) refreshActorMountFx(a, { token: t, reason: "ready" });
  });

  // When tokens are created/updated, refresh
  Hooks.on("createToken", (doc) => _queueDocTokenRefresh(doc, "createToken"));
  Hooks.on("updateToken", (doc) => _queueDocTokenRefresh(doc, "updateToken"));
  Hooks.on("refreshToken", (token) => {
    // refreshToken hook gives Token object in v13
    const a = token?.actor;
    if (a) refreshActorMountFx(a, { token, reason: "refreshToken" });
  });

  // When items change on actors, refresh the FX on active tokens
  Hooks.on("updateActor", (actor, changed) => {
    if (!_actorChangeAffectsMount(actor, changed)) return;
    refreshActorMountFx(actor, { reason: "updateActor" });
  });

  Hooks.on("createItem", (item) => {
    const a = item?.parent;
    if (!a) return;
    if (_isMountItem(item)) refreshActorMountFx(a, { reason: "createItem" });
  });

  Hooks.on("updateItem", (item, changed) => {
    const a = item?.parent;
    if (!a) return;
    if (_isMountItem(item) || _maybeChangedEquipFlag(changed)) refreshActorMountFx(a, { reason: "updateItem" });
  });

  Hooks.on("deleteItem", (item) => {
    const a = item?.parent;
    if (!a) return;
    if (_isMountItem(item)) refreshActorMountFx(a, { reason: "deleteItem" });
  });
});

/* -------------------------------------------- */

function isSequencerActive() {
  return !!game.modules?.get("sequencer")?.active && typeof Sequence === "function";
}

function getEquippedMountItem(actor) {
  if (!actor?.items) return null;
  return actor.items.find(i =>
    (i?.flags?.eq5e?.category === "mount") &&
    (i?.flags?.eq5e?.equipped === true)
  ) ?? null;
}

function _actorDisableFx(actor) {
  return actor?.flags?.eq5e?.disableMountFx === true;
}

function _getActiveTokensForActor(actor) {
  // Prioritize linked tokens on canvas
  const toks = actor?.getActiveTokens?.(true, true) ?? [];
  return toks.filter(t => !!t?.id);
}

function _effectNameFor(token) {
  return `${EFFECT_PREFIX}${token.id}`;
}

function _defaultFxForMount(mountItem) {
  const era = String(mountItem?.flags?.eq5e?.mount?.era ?? "").toLowerCase();
  // You will drop your WebMs in systems/eq5e/assets/fx/mounts/
  if (era.includes("classic")) return "systems/eq5e/assets/fx/mounts/classic_horse.webm";
  if (era.includes("kunark")) return "systems/eq5e/assets/fx/mounts/kunark_rhino.webm";
  if (era.includes("velious")) return "systems/eq5e/assets/fx/mounts/velious_wolf.webm";
  if (era.includes("luclin")) return "systems/eq5e/assets/fx/mounts/luclin_cat.webm";
  if (era.includes("pop") || era.includes("planes")) return "systems/eq5e/assets/fx/mounts/pop_divine_steed.webm";
  return "systems/eq5e/assets/fx/mounts/classic_horse.webm";
}

/**
 * Refresh mount FX on all active tokens for an actor (or a specific token)
 */
async function refreshActorMountFx(actor, { token=null, reason="" } = {}) {
  try {
    if (!isSequencerActive()) return;
    if (!actor) return;

    const tokens = token ? [token] : _getActiveTokensForActor(actor);
    if (!tokens.length) return;

    if (_actorDisableFx(actor)) {
      for (const t of tokens) await removeMountFxFromToken(t);
      return;
    }

    const mount = getEquippedMountItem(actor);
    for (const t of tokens) {
      if (!t?.object && t?.document) {
        // Try to resolve Token instance from document
        const canvasToken = canvas?.tokens?.get(t.document.id);
        if (canvasToken) t = canvasToken;
      }
      if (!t) continue;

      if (!mount) await removeMountFxFromToken(t);
      else await applyMountFxToToken(t, mount);
    }
  } catch (e) {
    console.error("[EQ5E] Mount FX refresh failed", reason, e);
  }
}

async function removeMountFxFromToken(token) {
  if (!token) return;
  if (!isSequencerActive()) return;
  const name = _effectNameFor(token);
  try {
    // endEffects accepts a filter object
    await Sequencer.EffectManager.endEffects({ name, object: token });
  } catch (e) {
    // Don't spam
    console.debug("[EQ5E] Mount FX: endEffects failed", e);
  }
}

async function applyMountFxToToken(token, mountItem) {
  if (!token || !mountItem) return;
  if (!isSequencerActive()) return;

  // Ensure we don't duplicate
  await removeMountFxFromToken(token);

  const fx = mountItem?.flags?.eq5e?.mount?.fx ?? {};
  const file = String(fx.file ?? _defaultFxForMount(mountItem));
  const scale = Number.isFinite(fx.scale) ? Number(fx.scale) : 0.9;
  const below = (fx.below !== undefined) ? !!fx.below : true;
  const opacity = Number.isFinite(fx.opacity) ? Number(fx.opacity) : 1.0;
  const offsetX = Number.isFinite(fx.offsetX) ? Number(fx.offsetX) : 0;
  const offsetY = Number.isFinite(fx.offsetY) ? Number(fx.offsetY) : 14;

  const name = _effectNameFor(token);

  const seq = new Sequence()
    .effect()
      .name(name)
      .file(file)
      .attachTo(token, { followRotation: false, offset: { x: offsetX, y: offsetY } })
      .scale(scale)
      .opacity(opacity)
      .persist()
      .belowTokens(below);

  if (typeof fx.tint === "string" && fx.tint.trim()) {
    // Sequencer supports tint on SpriteEffect in recent versions; harmless if ignored.
    seq.effect().tint(fx.tint.trim());
  }

  await seq.play();
}

/* -------------------------------------------- */

function _isMountItem(itemOrData) {
  const f = itemOrData?.flags?.eq5e;
  return f?.category === "mount";
}

function _maybeChangedEquipFlag(changed) {
  // detect flags.eq5e.equipped or flags.eq5e.slot changes
  const f = changed?.flags?.eq5e;
  if (!f) return false;
  return ("equipped" in f) || ("slot" in f) || ("category" in f) || ("mount" in f);
}

function _actorChangeAffectsMount(actor, changed) {
  // If system or flags changed that could affect equipped mount
  if (changed?.flags?.eq5e?.disableMountFx !== undefined) return true;
  // Items change won't appear here; handled by updateItem hooks. But some systems bubble embedded changes.
  return false;
}

let _refreshTimer = null;
function _queueDocTokenRefresh(tokenDoc, reason) {
  try {
    if (!tokenDoc) return;
    // Debounce burst updates
    if (_refreshTimer) clearTimeout(_refreshTimer);
    _refreshTimer = setTimeout(() => {
      const token = canvas?.tokens?.get(tokenDoc.id) ?? canvas?.tokens?.placeables?.find(t => t?.id === tokenDoc.id) ?? null;
      const actor = token?.actor ?? game.actors?.get(tokenDoc.actorId) ?? null;
      if (actor) refreshActorMountFx(actor, { token, reason });
    }, 50);
  } catch (e) {
    console.debug("[EQ5E] Mount FX queue refresh failed", reason, e);
  }
}
