
/* =====================
 * Beta Freeze Mode
 * ===================== */
Hooks.once("init", async () => {
  __eq5eRegisterSetting("eq5e", "betaFreeze", {
    name: "EQ5e Beta Freeze Mode",
    hint: "Locks experimental features and warns on version mismatches during beta.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
});

import "./eq5e-helpers.mjs";
import "./ui/npc-resists.js";
import "./ui/gm-hud.js";
import "./ui/playtest-tools.js";
import "./ui/setup-wizard.js";

import "../bundles/eq5e-class-bard/scripts/main.js";
import "../bundles/eq5e-class-beastlord/scripts/main.js";
import "../bundles/eq5e-class-berserker/scripts/main.js";
import "../bundles/eq5e-class-cleric/scripts/main.js";
import "../bundles/eq5e-class-druid/scripts/main.js";
import "../bundles/eq5e-class-enchanter/scripts/main.js";
import "../bundles/eq5e-class-magician/scripts/main.js";
import "../bundles/eq5e-class-monk/scripts/main.js";
import "../bundles/eq5e-class-necromancer/scripts/main.js";
import "../bundles/eq5e-class-paladin/scripts/main.js";
import "../bundles/eq5e-class-ranger/scripts/main.js";
import "../bundles/eq5e-class-rogue/scripts/main.js";
import "../bundles/eq5e-class-shadowknight/scripts/main.js";
import "../bundles/eq5e-class-shaman/scripts/main.js";
import "../bundles/eq5e-class-warrior/scripts/main.js";
import "../bundles/eq5e-class-wizard/scripts/main.js";
import "../bundles/eq5e-items-core/scripts/main.js";

import "./migrations/pet-equipment-slots.js";
import { runWorldSchemaRepair, repairOrphanTokens } from "./migrations/repair-v13-schema.mjs";

Hooks.once("ready", async () => {
  const KEY = "schemaRepair.v13.1";

  const already = game.settings.get("eq5e", KEY);
  if (already) return;

  console.log("[EQ5E] Running one-time v13 schema repair…");

  const { runWorldSchemaRepair, repairOrphanTokens } =
    await import("./migrations/repair-v13-schema.mjs");

  await runWorldSchemaRepair({ dryRun: false });
  await repairOrphanTokens({ deleteOrphans: false });

  await game.settings.set("eq5e", KEY, true);
  ui.notifications.info("EQ5E: One-time schema repair complete.");
});

// ---- EQ5e deferred settings registration (Foundry loads system scripts before init) ----
const __eq5ePendingSettings = [];
function __eq5eRegisterSetting(namespace, key, data) {
  if (globalThis.game?.settings?.register) {
    return globalThis.game.settings.register(namespace, key, data);
  }
  __eq5ePendingSettings.push([namespace, key, data]);
}
Hooks.once("init", () => {
  game.settings.register("eq5e", "schemaRepair.v13.1", {
    name: "EQ5E v13 Schema Repair Completed",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
});
// -----------------------------------------------------------------------------

// Build metadata (kept in code to avoid manifest unknown keys)
Hooks.once("ready", () => {

// ===== Currency (cp-based) =====
function isStackableItem(item) {
  if (!item) return false;
  if (item.type === "consumable") return true;
  return Boolean(item.system?.eq5e?.stackable);
}

function stackKey(item) {
  return item?.flags?.eq5e?.itemId ?? `${item?.type ?? "item"}::${item?.name ?? "unknown"}`;
}

function getItemQty(item) {
  return Math.max(1, Math.floor(Number(item?.system?.eq5e?.quantity ?? 1) || 1));
}

function getQuality(item) {
  return item?.flags?.eq5e?.quality ?? "standard";
}
function getCondition(item) {
  return item?.flags?.eq5e?.condition ?? "mint";
}
function qualityMultiplier(quality) {
  return ({ worn: 0.85, standard: 1.0, fine: 1.15, exquisite: 1.30 }[String(quality||"standard").toLowerCase()] ?? 1.0);
}
function conditionMultiplier(cond) {
  return ({ used: 0.90, mint: 1.0 }[String(cond||"mint").toLowerCase()] ?? 1.0);
}
function effectiveItemValueCP(item) {
  const base = priceCPFromItem(item);
  return Math.max(0, Math.round(base * qualityMultiplier(getQuality(item)) * conditionMultiplier(getCondition(item))));
}

function getActorCP(actor) {
  return Number(actor?.getFlag?.("eq5e", "currency.cp") ?? actor?.system?.eq5e?.currency?.cp ?? 0) || 0;
}
async function setActorCP(actor, cp) {
  cp = Math.max(0, Math.floor(Number(cp) || 0));
  await actor.setFlag("eq5e", "currency.cp", cp);
  return cp;
}
  game.eq5e = game.eq5e || {};
  game.eq5e.build = { version: "1.0.0-beta", beta: true, rcCandidate: true };

  // Version mismatch warnings (system vs eq5e-* modules)
  try {
    const sysV = game.system?.version ?? "";
    const mism = [];
    for (const m of (game.modules?.values?.() ?? [])) {
      if (!m.active) continue;
      if (!String(m.id).startsWith("eq5e-")) continue;
      const mv = m.version ?? "";
      if (sysV && mv && sysV !== mv) mism.push(`${m.id} (${mv})`);
    }
    if (game.user?.isGM && mism.length) {
      ui.notifications?.warn?.(`EQ5e version mismatch: system ${sysV} vs modules: ${mism.join(", ")}`);
    }
  } catch (e) {}

  // Beta Freeze guardrail
  try {
    const freeze = game.settings.get("eq5e","betaFreeze");
    if (game.user?.isGM && !freeze) {
      ui.notifications?.warn?.("EQ5e Beta Freeze Mode is OFF. Recommended: enable it for 1.0.0-beta RC.");
    }
  } catch (e) {}
});

function _deterministicFloat01(seedStr) {
  const s = String(seedStr ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // convert uint32 -> [0,1)
  return (h >>> 0) / 4294967296;
}

function deterministicRollSimple(formula, seedStr) {
  // Supports basic formulas like "NdM+K" or "NdM-K" or "dM+K" (N defaults to 1).
  const f = String(formula ?? "").replace(/\s+/g, "");
  const m = f.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) {
    // fallback: if it's just a number, return it; otherwise 0
    const n = Number(f);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Math.max(1, Number(m[1] || 1));
  const sides = Math.max(1, Number(m[2] || 1));
  const mod = Number(m[3] || 0);

  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = 1 + Math.floor(_deterministicFloat01(`${seedStr}|${i}`) * sides);
    total += r;
  }
  total += mod;
  return total;
}

// EQ5E Core System Script (Foundry VTT v13)
// Full combat pipeline scaffold: conditions, cooldowns, haste, damage -> wards/resists/mitigation,
// threat/aggro, and casting/attacking helpers.
//
// Philosophy: mechanics live here; AI only calls these APIs.

const SYS_ID = "eq5e";

function dupe(obj) { return foundry.utils.duplicate(obj ?? {}); }
function get(obj, path, fallback=null) { return foundry.utils.getProperty(obj, path) ?? fallback; }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function sumParts(parts){ return (parts ?? []).reduce((s,p)=>s + (Number(p.amount)||0), 0); }

/* ------------------------------- CONDITIONS ------------------------------- */

const CONDITIONS = Object.freeze({
  silenced: { id: "silenced", label: "Silenced" },
  mezzed:   { id: "mezzed",   label: "Mezzed"   },
  rooted:   { id: "rooted",   label: "Rooted"   },
  snared:   { id: "snared",   label: "Snared"   },
  charmed:  { id: "charmed",  label: "Charmed"  },
  stunned:  { id: "stunned",  label: "Stunned"  }
});

async function pruneExpiredConditions(actor) {
  const conds = dupe(actor.flags?.eq5e?.conditions ?? {});
  const combat = game.combat;
  if (!combat?.id) return false;

  let changed = false;
  for (const [id, c] of Object.entries(conds)) {
    if (!c?.active || !c.until) continue;
    if (c.until.combatId !== combat.id) continue;
    if ((combat.round ?? 0) >= Number(c.until.round ?? 0)) {
      c.active = false;
      c.until = null;
      changed = true;
    }
  }
  if (changed) await actor.setFlag("eq5e", "conditions", conds);
  return changed;
}

function hasCondition(actor, id) { return !!actor?.flags?.eq5e?.conditions?.[id]?.active; }
function canAct(actor) { return !hasCondition(actor, "mezzed") && !hasCondition(actor, "feared"); }
function canMove(actor) { return !hasCondition(actor, "mezzed") && !hasCondition(actor, "rooted") && !hasCondition(actor, "feared"); }

function getAARankById(actor, aaId) {
  if (!actor || !aaId) return 0;
  const id = String(aaId);
  const items = actor.items?.contents ?? actor.items ?? [];
  for (const it of items) {
    const aa = it?.flags?.eq5e?.aa;
    if (!aa) continue;
    if (String(aa.aaId ?? "") !== id) continue;
    const r = Number(aa.rank ?? aa.currentRank ?? aa.purchasedRank ?? aa.value ?? 0);
    if (Number.isFinite(r) && r > 0) return r;
  }
  return 0;
}

function canCast(actor) { return !hasCondition(actor, "mezzed") && !hasCondition(actor, "feared") && !hasCondition(actor, "stunned") && !hasCondition(actor, "silenced"); }

function getAttackSpeedSlowPct(actor) {

function reduceAttacksBySlow({ baseAttacks = 1, slowPct = 0, seed = "" } = {}) {
  baseAttacks = Math.max(1, Math.floor(Number(baseAttacks) || 1));
  slowPct = clamp(Number(slowPct) || 0, 0, 90);
  if (slowPct <= 0) return baseAttacks;

  // Reduce attacks deterministically: expected attacks = baseAttacks * (1 - slowPct)
  const expected = baseAttacks * (1 - (slowPct / 100));
  const guaranteed = Math.max(0, Math.floor(expected));
  const frac = expected - guaranteed;

  // Deterministic coin flip for the fractional extra attack
  const roll = seededRandom(`atkSlow:${seed}:${game.combat?.id ?? ""}:${game.combat?.round ?? 0}:${game.combat?.turn ?? 0}`);
  return guaranteed + ((roll < frac) ? 1 : 0);
}

function applySlowToProcChance({ baseChance = 0, slowPct = 0, actor = null } = {}) {
  baseChance = clamp(Number(baseChance) || 0, 0, 1);
  slowPct = clamp(Number(slowPct) || 0, 0, 90);
  if (slowPct <= 0) return baseChance;
  // Reduce proc chance proportionally with slow: chance *= (1 - slowPct)
  const adjusted = clamp(baseChance * (1 - slowPct / 100), 0, 1);
  try {
    const reduced = Math.max(0, baseChance - adjusted);
    if (actor && reduced > 0) recordParseEvent({ kind: "slowProc", sourceActor: actor, amount: reduced });
  } catch(e) {}
  return adjusted;
}

function resolveProcChance({ baseChance = 0, actor = null } = {}) {
  try {
    const slowPct = getAttackSpeedSlowPct(actor);
    return applySlowToProcChance({ baseChance, slowPct, actor });
  } catch(e) {
    return clamp(Number(baseChance) || 0, 0, 1);
  }
}



  try {
    const cond = actor?.flags?.eq5e?.conditions ?? {};
    // canonical: snared meta may include slowAtkPct; also allow explicit slowed condition
    const s1 = Number(cond?.snared?.meta?.slowAtkPct ?? 0);
    const s2 = Number(cond?.slowed?.meta?.slowAtkPct ?? 0);
    return clamp(Math.max(s1, s2), 0, 90);
  } catch(e) { return 0; }
}

function getMoveMultiplier(actor) {
  const sn = actor?.flags?.eq5e?.conditions?.snared;
  if (!sn?.active) return 1.0;
  const slowPct = Number(sn.meta?.slowPct ?? 50);
  const mult = clamp(1 - clamp(slowPct, 0, 90)/100, 0.1, 1.0);
  return mult;
}





function computeShadowknightAAMods(actor) {
  const lifetapPot = getAARankById(actor, "aa.sk.lifetap-potency");
  const lifetapFury = getAARankById(actor, "aa.sk.lifetap-fury");
  const htDmg = getAARankById(actor, "aa.sk.improved-harmtouch");
  const htReuse = getAARankById(actor, "aa.sk.harmtouch-reuse");
  const terror = getAARankById(actor, "aa.sk.terror-mastery");
  const aura = getAARankById(actor, "aa.sk.unholy-aura");
  const decay = getAARankById(actor, "aa.sk.decay-mastery");
  const coil = getAARankById(actor, "aa.sk.mortalcoil-mastery");
  const dr = getAARankById(actor, "aa.sk.darkregen-reuse");
  const curse = getAARankById(actor, "aa.sk.disease-curse-mastery");
  const cmd = getAARankById(actor, "aa.sk.command-minion");

  return {
    lifetapPctBonus: 0.02 * Math.max(0, lifetapPot),
    lifetapFlatBonus: 1 * Math.max(0, lifetapFury),
    harmTouchPct: 0.05 * Math.max(0, htDmg),
    harmTouchCdAdj: -1 * Math.max(0, htReuse),
    terrorThreatPct: 0.10 * Math.max(0, terror),
    terrorFocusBonus: terror >= 5 ? 1 : 0,
    auraRank: Math.max(0, aura),
    decayAdj: 0.02 * Math.max(0, decay),
    coilWardBonus: 10 * Math.max(0, coil),
    coilDurBonus: coil >= 3 ? 1 : 0,
    darkRegenCdAdj: -1 * Math.max(0, dr),
    diseaseCurseAdj: 0.02 * Math.max(0, curse),
    cmdThreatPct: 0.10 * Math.max(0, cmd)
  };
}

function computeMonkAAMods(actor) {
  const hastMend = getAARankById(actor, "mnk.aa.hastened-mend");
  const impMend = getAARankById(actor, "mnk.aa.improved-mend");
  const hastFd = getAARankById(actor, "mnk.aa.hastened-fd");
  const wu = getAARankById(actor, "mnk.aa.master-wu");
  const impFd = getAARankById(actor, "mnk.aa.improved-fd");

  const mendCdAdj = (-1 * Math.max(0, hastMend)) + Number(actor?.flags?.eq5e?.monk?.mendCdAdj ?? 0);
  const mendHealPct = (0.05 * Math.max(0, impMend)) + Number(actor?.flags?.eq5e?.monk?.mendHealPct ?? 0);
  const fdCdAdj = (-1 * Math.max(0, hastFd)) + Number(actor?.flags?.eq5e?.monk?.fdCdAdj ?? 0);
  const wuChance = (0.03 * Math.max(0, wu)) + Number(actor?.flags?.eq5e?.monk?.extraStrikeChance ?? 0);

  // Improved Feign Death: reduce DC and grant advantage; failure becomes partial success.
  const fdDcAdj = (-1 * Math.max(0, impFd)) + Number(actor?.flags?.eq5e?.monk?.fdDcAdj ?? 0);
  const fdAdvantage = (impFd > 0) || !!actor?.flags?.eq5e?.monk?.fdAdvantage;
  const fdFailPartial = (impFd > 0) || !!actor?.flags?.eq5e?.monk?.fdFailPartial;

  return {
    mendCdAdj: Number.isFinite(mendCdAdj) ? mendCdAdj : 0,
    mendHealPct: Number.isFinite(mendHealPct) ? mendHealPct : 0,
    fdCdAdj: Number.isFinite(fdCdAdj) ? fdCdAdj : 0,
    wuChance: Number.isFinite(wuChance) ? wuChance : 0,
    fdDcAdj: Number.isFinite(fdDcAdj) ? fdDcAdj : 0,
    fdAdvantage,
    fdFailPartial
  };
}

/* ------------------------------ FEIGN DEATH ------------------------------ */
function isFeignDeathActive(actor) {
  return !!(actor?.flags?.eq5e?.conditions?.feignDeath || actor?.flags?.eq5e?.monk?.feignDeath);
}

function isFeignDeathUuid(uuid) {
  if (!uuid) return false;
  try {
    // Prefer fromUuidSync if available (v12+)
    if (typeof fromUuidSync === "function") {
      const doc = fromUuidSync(uuid);
      const actor = doc?.actor ?? (doc?.documentName === "Actor" ? doc : null);
      if (actor) return isFeignDeathActive(actor);
    }

async function requestFeignDeathAttempt({ actor, durationRounds = 1 } = {}) {
  if (!actor) return;
  if (game.user?.isGM) {
    await attemptFeignDeathActor(actor, { durationRounds });
    return;
  }
  try {
    game.socket?.emit("system.eq5e", {
      type: "eq5e.feignDeath",
      userId: game.user.id,
      actorUuid: actor.uuid,
      durationRounds: Number(durationRounds ?? 1)
    });
  } catch (e) {
    console.error("[EQ5E] feignDeath socket emit failed", e);
  }
}

async function attemptFeignDeathActor(actor, { durationRounds = 1 } = {}) {
  if (!actor) return;
  if (!canvas?.ready) return;

  // Find the NPC with the highest current threat on this actor (best proxy for "who you're trying to fool")
  const feignerUuid = actor.uuid;
  let bestNpc = null;
  let bestThreat = -Infinity;

  for (const tok of canvas.tokens.placeables ?? []) {
    const npc = tok?.actor;
    if (!npc) continue;
    const isNpc = (npc.type === "npc") || (npc.system?.type === "npc");
    if (!isNpc) continue;

    const state = getThreatState(npc);
    const t = Number(state?.entries?.[feignerUuid]?.threat ?? -1);
    if (t > bestThreat) {
      bestThreat = t;
      bestNpc = npc;
    }
  }

  const npcLevel = Number(bestNpc?.system?.details?.level ?? bestNpc?.system?.attributes?.prof ?? 0);

// DC scaling: prefer NPC Perception if present; otherwise use max(WIS, INT) mod.
let perceptionBonus = 0;
try {
  const p = bestNpc?.system?.skills?.perception;
  const raw = Number(p?.total ?? p?.mod ?? p?.value ?? 0);
  if (Number.isFinite(raw)) perceptionBonus = raw;
} catch (e) {}

if (!perceptionBonus) {
  try {
    const rdNpc = bestNpc?.getRollData ? bestNpc.getRollData() : {};
    const wis = Number(foundry.utils.getProperty(rdNpc, "abilities.wis.mod") ?? 0);
    const intel = Number(foundry.utils.getProperty(rdNpc, "abilities.int.mod") ?? 0);
    perceptionBonus = Math.max(wis, intel, 0);
  } catch (e) {}
}

// Cap perception contribution to keep DC reasonable.
perceptionBonus = Math.max(0, Math.min(10, Number(perceptionBonus ?? 0)));

const mods = computeMonkAAMods(actor);
const dcBase = 10 + Math.floor(Math.max(0, npcLevel) / 2) + perceptionBonus;
const dc = Math.max(5, Math.round(dcBase + Number(mods.fdDcAdj ?? 0)));

  // Skill check: d20 + DEX mod + proficiency (simple, consistent baseline; tweak later with FD AAs)
  const rd = actor.getRollData ? actor.getRollData() : {};
const f = mods?.fdAdvantage ? "2d20kh + @abilities.dex.mod + @attributes.prof" : "1d20 + @abilities.dex.mod + @attributes.prof";
const roll = await (new Roll(f, rd)).evaluate();
  const total = Number(roll.total ?? 0);
  const success = total >= dc;

  // Always display the roll (GM authoritative if multiplayer)
  try {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="eq5e-roll"><b>Feign Death</b>: ${total} vs DC ${dc} ${success ? "<span style='color:var(--color-level-success)'>SUCCESS</span>" : "<span style='color:var(--color-level-error)'>FAIL</span>"}<br/>${roll.render()}</div>`
    });
  } catch (e) {}

  if (success) {
    await dropThreatForFeignDeathActor(actor);
    // Keep feignDeath active for durationRounds (already set by the spell condition)
    return true;
  }

  // Failure: normally breaks feignDeath; Improved Feign Death turns failure into "partial success".
if (mods?.fdFailPartial) {
  // Keep feignDeath active, but only reduce threat (not a full wipe).
  await dropThreatForFeignDeathActor(actor, { multiplier: 0.25, hardClear: false });
  try {
    await actor.setFlag("eq5e", "monk", { ...(actor.getFlag("eq5e", "monk") ?? {}), feignDeathPartial: true });
  } catch (e) {}
  return false;
}

await dropThreatForFeignDeathActor(actor, { multiplier: 0.5, hardClear: false });
await setCondition({ actor, conditionId: "feignDeath", active: false, sourceUuid: bestNpc?.uuid ?? null });
return false;
}

  } catch (e) {}
  try {
    // Fallback: parse last Actor.<id>
    const m = String(uuid).match(/Actor\.([A-Za-z0-9]{16})/);
    if (m?.[1] && game.actors) {
      const actor = game.actors.get(m[1]);
      if (actor) return isFeignDeathActive(actor);
    }
  } catch (e) {}
  return false;
}

async function requestFeignDeathDropThreat({ actor, durationRounds = 1 } = {}) {
  if (!actor) return;
  if (game.user?.isGM) {
    await dropThreatForFeignDeathActor(actor);
    return;
  }
  try {
    game.socket?.emit("system.eq5e", {
      type: "eq5e.feignDeath",
      userId: game.user.id,
      actorUuid: actor.uuid,
      durationRounds: Number(durationRounds ?? 1)
    });
  } catch (e) {
    console.error("[EQ5E] feignDeath socket emit failed", e);
  }
}

async function dropThreatForFeignDeathActor(actor, { multiplier = 0, hardClear = true } = {}) {
  if (!actor) return;
  // Only meaningful on an active scene (token interactions).
  if (!canvas?.ready) return;

  const feignerUuid = actor.uuid;

  for (const tok of canvas.tokens.placeables ?? []) {
    const npc = tok?.actor;
    if (!npc) continue;

    const isNpc = (npc.type === "npc") || (npc.system?.type === "npc");
    if (!isNpc) continue;

    const state = getThreatState(npc);
    if (!state?.entries?.[feignerUuid]) continue;

    // Drop threat hard (EQ-ish). Keep entry but set to 0 so history remains.
    state.entries[feignerUuid].threat = hardClear ? 0 : Math.max(0, Math.floor(Number(state.entries[feignerUuid].threat ?? 0) * Number(multiplier ?? 0)));

    if (state.lastTargetUuid === feignerUuid) state.lastTargetUuid = null;

    await npc.setFlag("eq5e", "threat", state);
  }
}

Hooks.on("eq5e.postDamage", async (wf) => {
  try {
    if (!wf?.targetActor) return;
    if (!isFeignDeathActive(wf.targetActor)) return;
    if (Number(wf?.totals?.applied ?? 0) <= 0) return;

    // Any real damage breaks Feign Death.
    await setCondition({ actor: wf.targetActor, conditionId: "feignDeath", active: false, sourceUuid: wf.sourceActor?.uuid ?? null });
    ui.notifications?.info(`${wf.targetActor.name} breaks Feign Death!`);

// Shadowknight: Harm Touch cinematic callout (optional)
try {
  const sid = String(meta?.spellId ?? "");
  if (sid === "sk.ht.1" || sid === "sk.ht.2") {
    const dealt = Number(wf?.totals?.applied ?? 0);
    if (dealt > 0) {
      const html = `<div class="eq5e-ht-hint"><b>Harm Touch</b>: ${src.name} deals ${dealt}.</div>`;
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: src }), content: html });
    }
  }
} catch (e) {}

  } catch (e) {
    console.error("[EQ5E] feignDeath break-on-damage failed", e);
  }
});

async function setCondition({ actor, conditionId, active=true, sourceUuid=null, duration=null, meta=null }) {
  const conds = dupe(actor.flags?.eq5e?.conditions ?? {});
  const combat = game.combat;

  let until = null;
  if (duration && combat?.id) {
    if (Number.isFinite(duration.rounds)) {
      until = { combatId: combat.id, round: (combat.round ?? 0) + Math.max(0, Number(duration.rounds)) };
    } else if (Number.isFinite(duration.untilRound)) {
      until = { combatId: combat.id, round: Number(duration.untilRound) };
    }
  }

  conds[conditionId] = {
    active: !!active,
    sourceUuid,
    until,
    stacks: 0,
    meta: meta ?? (conds[conditionId]?.meta ?? null)
  };

  await actor.setFlag("eq5e", "conditions", conds);
  return conds[conditionId];
}

async function clearCondition({ actor, conditionId }) {
  const conds = dupe(actor.flags?.eq5e?.conditions ?? {});
  if (conds[conditionId]) {
    conds[conditionId].active = false;
    conds[conditionId].until = null;
  }
  await actor.setFlag("eq5e", "conditions", conds);
}


/* ------------------ ACTIVE EFFECT ↔ CONDITION SYNC ------------------
 * Goal: Any Active Effect can automatically set/clear EQ5e conditions.
 *
 * Supported authoring patterns (either one works):
 *  1) Effect flag: flags.eq5e.conditions = ["silenced","mezzed"] (array of ids)
 *     Optional meta per id: flags.eq5e.conditionMeta = { snared: { slowPct: 50 } }
 *  2) Effect change keys that directly write to flags:
 *     { key: "flags.eq5e.conditions.silenced.active", mode: 5, value: "true" }
 *
 * Sync rule: If ANY enabled effect implies a condition id, that condition is active.
 * Conditions set manually via API remain unless explicitly cleared; however, if a
 * condition is ONLY from effects, it will be cleared when no effects imply it.
 */

function _extractConditionIdsFromEffect(effect) {
  const out = new Set();

  // Pattern 1: effect flags
  const flagList = foundry.utils.getProperty(effect, "flags.eq5e.conditions");
  if (Array.isArray(flagList)) {
    for (const id of flagList) out.add(String(id));
  }

  // Pattern 2: changes that target flags.eq5e.conditions.<id>.active
  const changes = effect?.changes ?? [];
  for (const ch of changes) {
    const key = String(ch?.key ?? "");
    const m = key.match(/^flags\.eq5e\.conditions\.([a-zA-Z0-9_-]+)\.active$/);
    if (!m) continue;

    const raw = String(ch?.value ?? "").toLowerCase().trim();
    const truthy = (raw === "true" || raw === "1" || raw === "yes" || raw === "on");
    if (truthy) out.add(m[1]);
  }

  return Array.from(out);
}

function _extractConditionMetaFromEffect(effect, conditionId) {
  const meta = foundry.utils.getProperty(effect, "flags.eq5e.conditionMeta");
  if (meta && typeof meta === "object") {
    const m = meta[conditionId];
    if (m && typeof m === "object") return foundry.utils.duplicate(m);
  }
  return null;
}

/**
 * Recompute condition states implied by Active Effects and merge into flags.
 * - If condition is implied by effects => active true, source=effect, fromEffects=true
 * - If condition was fromEffects and no longer implied => active false (cleared)
 * - If condition was manually set (fromEffects !== true) => do not clear automatically
 */
async function syncConditionsFromEffects(actor) {
  if (!actor) return false;

  const conds = dupe(actor.flags?.eq5e?.conditions ?? {});

  const implied = {}; // id -> { effectUuids:[], meta }
  for (const ef of (actor.effects ?? [])) {
    if (ef.disabled) continue;
    const ids = _extractConditionIdsFromEffect(ef);
    for (const id of ids) {
      implied[id] ??= { effectUuids: [], meta: null, sourceUuid: ef.uuid };
      implied[id].effectUuids.push(ef.uuid);
      const m = _extractConditionMetaFromEffect(ef, id);
      if (m && !implied[id].meta) implied[id].meta = m;
    }
  }

  let changed = false;

  // Apply implied actives
  for (const [id, data] of Object.entries(implied)) {
    const cur = conds[id] ?? {};
    if (!cur.active || cur.fromEffects !== true) {
      // activate or take over as "from effects" (deterministic: effects win for that condition)
      conds[id] = {
        active: true,
        sourceUuid: data.sourceUuid ?? null,
        until: null,
        stacks: cur.stacks ?? 0,
        meta: data.meta ?? cur.meta ?? null,
        fromEffects: true,
        effectUuids: data.effectUuids
      };
      changed = true;
    } else {
      // already active from effects: update effectUuids/meta if changed
      const prevUuids = Array.isArray(cur.effectUuids) ? cur.effectUuids : [];
      const same = JSON.stringify(prevUuids) === JSON.stringify(data.effectUuids);
      const metaSame = JSON.stringify(cur.meta ?? null) === JSON.stringify((data.meta ?? cur.meta ?? null));
      if (!same || !metaSame) {
        cur.effectUuids = data.effectUuids;
        if (data.meta) cur.meta = data.meta;
        conds[id] = cur;
        changed = true;
      }
    }
  }

  // Clear effect-only conditions no longer implied
  for (const [id, cur] of Object.entries(conds)) {
    if (!cur?.active) continue;
    if (cur.fromEffects !== true) continue;
    if (implied[id]) continue;

    cur.active = false;
    cur.until = null;
    cur.effectUuids = [];
    // keep meta for inspection, but you can null it if you want
    conds[id] = cur;
    changed = true;
  }

  if (changed) await actor.setFlag("eq5e", "conditions", conds);
  return changed;
}


/* -------------------------- COOLDOWNS + HASTE ---------------------------- */

function getCombatKey() {
  const c = game.combat;
  if (!c) return null;
  return { combatId: c.id, round: c.round ?? 0, turn: c.turn ?? 0 };
}

function isOnCooldown(actor, key) {
  const cd = actor.flags?.eq5e?.cooldowns?.[key];
  if (!cd) return false;

  const c = getCombatKey();
  if (!c) {
    if (cd.readyAtTime != null) return Date.now() < cd.readyAtTime;
    return false;
  }
  const r = Number(cd.readyAtRound ?? -1);
  const t = Number(cd.readyAtTurn ?? -1);
  if (c.round < r) return true;
  if (c.round === r && c.turn < t) return true;
  return false;
}

async function setCooldown(actor, key, def) {
  const c = getCombatKey();
  const cooldowns = dupe(actor.flags?.eq5e?.cooldowns ?? {});
  const type = def?.type ?? "rounds";
  const value = Number(def?.value ?? 0);

  let rec = {};
  if (c && (type === "rounds" || type === "turns")) {
    if (type === "rounds") rec = { readyAtRound: (c.round ?? 0) + value, readyAtTurn: 0 };
    else rec = { readyAtRound: c.round ?? 0, readyAtTurn: (c.turn ?? 0) + value };
  } else if (type === "seconds") {
    rec = { readyAtTime: Date.now() + value * 1000 };
  }
  cooldowns[key] = rec;
  await actor.setFlag("eq5e", "cooldowns", cooldowns);
}

function getHastePct(actor) {
  const v = Number(actor.flags?.eq5e?.hastePct ?? 0);
  return Number.isFinite(v) ? v : 0;
}
function hasteToExtraAttacks(hastePct) {
  const h = Math.max(0, Math.floor(hastePct));
  if (h >= 100) return 4;
  if (h >= 75) return 3;
  if (h >= 50) return 2;
  if (h >= 25) return 1;
  return 0;
}

/* ----------------------------- MOVEMENT ---------------------------------- */

function getSpeedFt(actor) {
  const move = get(actor, "system.attributes.movement", null);
  let base = 30;
  if (move && typeof move === "object") {
    const walk = Number(move.walk ?? move.value ?? move.base ?? 0);
    if (Number.isFinite(walk) && walk > 0) base = walk;
  } else if (typeof move === "number") base = move;
  else if (typeof move === "string") {
    const n = Number(move.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) base = n;
  } else {
    const speed = get(actor, "system.attributes.speed", null);
    if (typeof speed === "number" && speed > 0) base = speed;
  }
  const mult = getMoveMultiplier(actor);
  return Math.max(0, Math.floor(base * mult));
}

function ftToPixels(ft) {
  const gridSizePx = canvas.grid.size;
  const gridDistFt = canvas.scene.grid.distance;
  return (ft / gridDistFt) * gridSizePx;
}

async function moveTowardTokenByFt({ moverToken, targetToken, stepFt }) {
  const distFt = canvas.grid.measureDistance(moverToken.center, targetToken.center);
  if (distFt <= 0 || stepFt <= 0) return { movedFt: 0, newDistFt: distFt };

  const step = Math.min(stepFt, distFt);
  const stepPx = ftToPixels(step);

  const dx = targetToken.center.x - moverToken.center.x;
  const dy = targetToken.center.y - moverToken.center.y;
  const distPx = Math.hypot(dx, dy);
  if (distPx < 1) return { movedFt: 0, newDistFt: distFt };

  const ux = dx / distPx;
  const uy = dy / distPx;

  const newCenterX = moverToken.center.x + ux * stepPx;
  const newCenterY = moverToken.center.y + uy * stepPx;

  const newX = newCenterX - moverToken.w / 2;
  const newY = newCenterY - moverToken.h / 2;

  await moverToken.document.update({ x: newX, y: newY });

  const newDistFt = canvas.grid.measureDistance(moverToken.center, targetToken.center);
  return { movedFt: step, newDistFt };
}

/* ------------------------------ THREAT ----------------------------------- */

function getOwnerAggroMods(ownerActor) {
  if (!ownerActor) return { petThreatPct: 0, petTauntBonus: 0, petStickinessPct: 0, petThreatDecayRedPct: 0, petThreatTransferPct: 0, petHpBonus: 0, petMitigationBonus: 0, petWardingBonus: 0 };

  const petThreatPct =
    Number(ownerActor.flags?.eq5e?.ranger?.petThreatPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderThreatPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionThreatPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadThreatPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionThreatPct ?? 0);

  const petTauntBonus =
    Number(ownerActor.flags?.eq5e?.ranger?.petTauntBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderTauntBonus ?? 0);

  const petStickinessPct =
    Number(ownerActor.flags?.eq5e?.ranger?.petStickinessPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderStickinessPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionStickinessPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadStickinessPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionStickinessPct ?? 0);

  const petThreatDecayRedPct =
    Number(ownerActor.flags?.eq5e?.ranger?.petThreatDecayRedPct ?? ownerActor.flags?.eq5e?.ranger?.petThreatDecayRedPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderThreatDecayRedPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionThreatDecayRedPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadThreatDecayRedPct ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionThreatDecayRedPct ?? 0);

  const petHpBonus =
    Number(ownerActor.flags?.eq5e?.ranger?.petHpBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderHpBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionHpBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadHpBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionHpBonus ?? 0);

  const petMitigationBonus =
    Number(ownerActor.flags?.eq5e?.ranger?.petMitigationBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderMitigationBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionMitigationBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadMitigationBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionMitigationBonus ?? 0);

  const petWardingBonus =
    Number(ownerActor.flags?.eq5e?.ranger?.petWardingBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.beastlord?.warderWardingBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.druid?.companionWardingBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.necromancer?.undeadWardingBonus ?? 0) +
    Number(ownerActor.flags?.eq5e?.shadowknight?.minionWardingBonus ?? 0);

  
const petThreatTransferPct =
  Number(ownerActor.flags?.eq5e?.ranger?.petThreatTransferPct ?? 0) +
  Number(ownerActor.flags?.eq5e?.beastlord?.warderThreatTransferPct ?? 0) +
  Number(ownerActor.flags?.eq5e?.druid?.companionThreatTransferPct ?? 0) +
  Number(ownerActor.flags?.eq5e?.necromancer?.undeadThreatTransferPct ?? 0) +
  Number(ownerActor.flags?.eq5e?.shadowknight?.minionThreatTransferPct ?? 0);

return { petThreatPct, petTauntBonus, petStickinessPct, petThreatDecayRedPct, petThreatTransferPct, petHpBonus, petMitigationBonus, petWardingBonus };
}

function findActiveGuardPetForOwner(ownerActor) {
  try {
    if (!ownerActor) return null;
    const ownerUuid = ownerActor.uuid;
    const pets = (game.actors?.contents ?? []).filter(a => {
      const ou = a?.flags?.eq5e?.summon?.ownerUuid ?? a?.flags?.eq5e?.pet?.ownerUuid ?? null;
      const active = !!a?.flags?.eq5e?.summon?.active;
      return active && ou && (ou === ownerUuid);
    });

    // Prefer tank role, then any
    pets.sort((a,b) => {
      const ar = a?.flags?.eq5e?.pet?.role === "tank" ? 0 : 1;
      const br = b?.flags?.eq5e?.pet?.role === "tank" ? 0 : 1;
      return ar - br;
    });

    const pet = pets[0] ?? null;
    if (!pet) return null;

    const mode = String(pet?.flags?.eq5e?.pet?.mode ?? pet?.flags?.eq5e?.ai?.mode ?? pet?.flags?.eq5e?.pet?.stance ?? "").toLowerCase();
    const ok = (mode === "guard" || mode === "protect" || mode === "tank" || mode === "assist-guard");
    return ok ? pet : null;
  } catch (e) { return null; }
}

function initPetManaForSpellcasting(petActor) {
  try {
    const allow = !!(petActor?.flags?.eq5e?.ai?.allowSpells ?? petActor.getFlag("eq5e","petAllowSpells"));
    if (!allow) return;
    const mana = foundry.utils.duplicate(petActor.system?.attributes?.mana ?? {});
    const max = Number(mana.max ?? mana.value ?? 0);
    if (max > 0) return;
    // Default mana pools by role/tier
    const tier = Number(petActor.flags?.eq5e?.pet?.tier ?? petActor.flags?.eq5e?.pet?.levelTier ?? 1);
    const base = 12 + (tier * 6);
    const mmax = base;
    petActor.update({ "system.attributes.mana.max": mmax, "system.attributes.mana.value": mmax }).catch(()=>{});
  } catch {}
}

function findOwnerForPet(petActor) {
  const ownerUuid = petActor?.flags?.eq5e?.summon?.ownerUuid ?? petActor?.flags?.eq5e?.pet?.ownerUuid ?? null;
  if (!ownerUuid) return null;
  return game.actors?.get(ownerUuid) ?? game.actors?.contents?.find(a => a?.uuid === ownerUuid) ?? null;
}

function getStickinessForTargetUuid(targetUuid) {
  try {
    const base = Number(THREAT.stickinessPct ?? 0);
    if (!targetUuid) return base;
    const a = game.actors?.contents?.find(x => x?.uuid === targetUuid) ?? null;
    const isPet = !!(a?.flags?.eq5e?.summon?.active || a?.flags?.eq5e?.pet?.role);
    if (!isPet) return base;
    const owner = findOwnerForPet(a);
    const mods = getOwnerAggroMods(owner);
    return base + Number(mods.petStickinessPct ?? 0);
  } catch (e) { return Number(THREAT.stickinessPct ?? 0); }
}

function getThreatDecayReductionForSourceUuid(sourceUuid) {
  try {
    if (!sourceUuid) return 0;
    const a = game.actors?.contents?.find(x => x?.uuid === sourceUuid) ?? null;
    const isPet = !!(a?.flags?.eq5e?.summon?.active || a?.flags?.eq5e?.pet?.role);
    if (!isPet) return 0;
    const owner = findOwnerForPet(a);
    const mods = getOwnerAggroMods(owner);
    return Number(mods.petThreatDecayRedPct ?? 0);
  } catch (e) { return 0; }
}


function getThreatMultiplierForSource(sourceActor) {
  let mult = 1.0;

  // Pet role baseline
  const role = sourceActor?.flags?.eq5e?.pet?.role;
  if (role === "tank") mult *= 1.5;

  // Tank class baseline (damage-based threat only)
  try {
    const cls = String(sourceActor?.flags?.eq5e?.class?.id ?? sourceActor?.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls === "warrior") mult *= Number(game.settings.get("eq5e","tankThreatMultWarrior") ?? 1.10);
    if (cls === "paladin") mult *= Number(game.settings.get("eq5e","tankThreatMultPaladin") ?? 1.05);
    if (cls === "shadowknight") mult *= Number(game.settings.get("eq5e","tankThreatMultShadowknight") ?? 1.08);

    // Opening bonus: helps tanks stabilize aggro vs early burst
    const combat = game.combat;
    if (["warrior","paladin","shadowknight"].includes(cls) && combat?.started) {
      const rounds = Number(game.settings.get("eq5e","threatOpeningBonusRounds") ?? 0);
      const bonusPct = Number(game.settings.get("eq5e","threatOpeningBonusPct") ?? 0);
      if ((combat.round ?? 0) <= rounds && bonusPct > 0) mult *= (1 + bonusPct);
    }
  } catch (e) {}

  // Owner-driven AA modifiers for pets
  const isPet = !!(sourceActor?.flags?.eq5e?.summon?.active || sourceActor?.flags?.eq5e?.pet?.role);
  if (isPet) {
    const owner = findOwnerForPet(sourceActor);
    const mods = getOwnerAggroMods(owner);
    if (mods.petThreatPct) mult *= (1 + mods.petThreatPct);
  }

  return mult;
}


function getTauntBonusForActor(taunterActor) {
  const isPet = !!(taunterActor?.flags?.eq5e?.summon?.active || taunterActor?.flags?.eq5e?.pet?.role);
  if (!isPet) return 0;
  const owner = findOwnerForPet(taunterActor);
  const mods = getOwnerAggroMods(owner);
  return Number(mods.petTauntBonus ?? 0);
}

const THREAT = Object.freeze({
  damageToThreat: 1.0,
  tauntSnapToTop: true,
  decayPerRoundPct: 0.02,
  stickinessPct: 0.10
});

function getThreatDamageToThreat() {
  try { return Number(game.settings.get("eq5e","threatDamageToThreat") ?? THREAT.damageToThreat) || THREAT.damageToThreat; }
  catch(e){ return THREAT.damageToThreat; }
}


function getThreatState(npcActor) {
  const state = npcActor.flags?.eq5e?.threat ?? {};
  return {
    entries: state.entries ?? {},
    forced: state.forced ?? null,
    lastTargetUuid: state.lastTargetUuid ?? null
  };
}
async function setThreatState(npcActor, newState) {
  await npcActor.setFlag("eq5e", "threat", newState);
}
async function dropThreat({ npcActor, sourceActor, dropPct = 0.0, now = Date.now() }) {
  if (!npcActor || !sourceActor) return;
  const pct = Math.max(0, Math.min(1, Number(dropPct ?? 0)));
  if (pct <= 0) return;

  const state = getThreatState(npcActor);
  const key = sourceActor.uuid;
  const prev = Number(state.entries?.[key]?.threat ?? 0);
  const next = Math.max(0, Math.round(prev * (1 - pct)));
  if (!state.entries?.[key]) state.entries[key] = { threat: 0, lastSeen: now };
  state.entries[key].threat = next;
  state.entries[key].lastSeen = now;

  // If this source was forced, clear forced target when threat is reduced meaningfully
  if (state.forced?.sourceActorUuid === sourceActor.uuid) state.forced = null;

  await setThreatState(npcActor, state);
}

async function transferThreat({ npcActor, fromActor, toActor, pct = 0.5, now = Date.now() }) {
  if (!npcActor || !fromActor || !toActor) return;
  const p = clamp(Number(pct) || 0, 0, 1);
  if (p <= 0) return;

  const st = getThreatState(npcActor);
  st.entries = st.entries ?? {};
  const fromKey = fromActor.uuid;
  const toKey = toActor.uuid;

  const fromPrev = Number(st.entries?.[fromKey]?.threat ?? 0);
  if (fromPrev <= 0) return;

  const moved = Math.max(0, Math.floor(fromPrev * p));
  const fromNext = Math.max(0, fromPrev - moved);

  const toPrev = Number(st.entries?.[toKey]?.threat ?? 0);
  const toNext = Math.max(0, toPrev + moved);

  st.entries[fromKey] = { ...(st.entries[fromKey] ?? {}), threat: fromNext, lastSeen: now };
  st.entries[toKey] = { ...(st.entries[toKey] ?? {}), threat: toNext, lastSeen: now };

  // If forced target was fromActor and we moved a bunch, clear forced so normal selection can re-evaluate
  if (st.forced?.sourceActorUuid === fromActor.uuid) st.forced = null;

  // refresh lastTargetUuid opportunistically
  st.lastTargetUuid = getTopThreatTargetUuid(npcActor);

  await setThreatState(npcActor, st);
}

async function addThreat({ npcActor, sourceActor, amount, now = Date.now() }) {

// Racial threat modifiers (classic): e.g. Halfling -10% threat generated
const raceThreatMult = Number(sourceActor.flags?.eq5e?.race?.threatMult ?? sourceActor.flags?.eq5e?.race?.traits?.threatMult ?? 1);
if (raceThreatMult && raceThreatMult !== 1) amount = Math.max(0, amount * raceThreatMult);
  if (!npcActor || !sourceActor || amount <= 0) return;
  const state = getThreatState(npcActor);
  const key = sourceActor.uuid;
  const prev = state.entries[key]?.threat ?? 0;
  state.entries[key] = { threat: prev + amount, lastSeen: now };

// Pet threat transfer AAs (owner -> active Guard pet): move a portion of GENERATED threat to pet
try {
  const mods = getOwnerAggroMods(sourceActor);
  const pct = clamp(Number(mods.petThreatTransferPct ?? 0), 0, 0.95);
  if (pct > 0) {
    const pet = findActiveGuardPetForOwner(sourceActor);
    if (pet && pet.uuid !== sourceActor.uuid) {
      const movedThreat = Math.max(0, Math.floor(Number(amount) * pct));
      if (movedThreat > 0) {
        const petKey = pet.uuid;
        const petPrev = Number(state.entries?.[petKey]?.threat ?? 0);
        // subtract from owner's entry (only from the newly generated portion)
        state.entries[key] = { ...(state.entries[key] ?? {}), threat: Math.max(0, Number(state.entries[key].threat) - movedThreat), lastSeen: now };
        state.entries[petKey] = { ...(state.entries[petKey] ?? {}), threat: petPrev + movedThreat, lastSeen: now };

// Threat transfer counters (per round, for GM HUD / tuning)
try {
  const cid = game.combat?.id ?? "no-combat";
  const rnd = Number(game.combat?.round ?? 0);
  game.eq5e.threatTransfersThisRound = game.eq5e.threatTransfersThisRound ?? {};
  const byCombat = game.eq5e.threatTransfersThisRound[cid] = game.eq5e.threatTransfersThisRound[cid] ?? {};
  const byRound = byCombat[rnd] = byCombat[rnd] ?? {};
  const ownerKey = sourceActor.uuid;
  byRound[ownerKey] = Number(byRound[ownerKey] ?? 0) + movedThreat;
} catch(e) {}

      }
    }
  }
} catch(e) {}


  await setThreatState(npcActor, state);
}


async function snapshotThreatRoundStart(combat) {
  try {
    if (!combat?.id) return;
    game.eq5e.threatRoundStart = game.eq5e.threatRoundStart ?? {};
    const cid = combat.id;
    const round = Number(combat.round ?? 0);
    game.eq5e.threatRoundStart[cid] = game.eq5e.threatRoundStart[cid] ?? {};
    const snap = {};
    for (const c of combat.combatants ?? []) {
      const a = c.actor;
      if (!a) continue;
      const isNpc = (a.type === "npc") || (a.system?.details?.type === "npc") || (a.flags?.eq5e?.isNpc === true);
      if (!isNpc) continue;
      const entries = getTopThreatEntries(a, 50);
      const map = {};
      for (const e of entries) map[e.uuid] = Number(e.threat ?? 0);
      snap[a.uuid] = map;
    }
    game.eq5e.threatRoundStart[cid][round] = snap;
  } catch(e) {
    console.warn("[EQ5E] snapshotThreatRoundStart failed", e);
  }
}

function getTopThreatEntries(npcActor, limit = 3) {
  try {
    const state = getThreatState(npcActor);
    const entries = Object.entries(state?.entries ?? {})
      .map(([uuid, v]) => ({ uuid, threat: Number(v?.threat ?? 0) }))
      .filter(e => e.threat > 0)
      .sort((a,b) => b.threat - a.threat);
    return entries.slice(0, Math.max(1, Number(limit) || 3));
  } catch(e) { return []; }
}

function getTopThreatTargetUuid(npcActor) {
  const state = getThreatState(npcActor);
  const entries = Object.entries(state.entries);
  if (!entries.length) return null;

  entries.sort((a, b) => (b[1]?.threat ?? 0) - (a[1]?.threat ?? 0));

// Skip feign-death targets (EQ-ish: mobs ignore players who successfully FD)
const filtered = entries.filter(e => !isFeignDeathUuid(e[0]));
const use = filtered.length ? filtered : entries;

const topUuid = use[0][0];
const topThreat = Number(use[0][1]?.threat ?? 0);

const lastUuid = state.lastTargetUuid ?? null;
if (lastUuid && state.entries[lastUuid] && !isFeignDeathUuid(lastUuid)) {
  const lastThreat = Number(state.entries[lastUuid]?.threat ?? 0);
  const stick = getStickinessForTargetUuid(lastUuid);
  // Keep last target if it's within stickiness% of the top threat
  if (topUuid !== lastUuid && topThreat <= lastThreat * (1 + stick)) return lastUuid;
}
return topUuid;
}
async function applyTaunt({ npcActor, taunterActor, durationRounds = 1, snapPct = 1.0 } = {}) {
  if (!npcActor || !taunterActor) return;
  const state = getThreatState(npcActor);
  const key = taunterActor.uuid;
  const current = state.entries[key]?.threat ?? 0;

  const topUuid = getTopThreatTargetUuid(npcActor);
  const topThreat = topUuid ? (state.entries[topUuid]?.threat ?? 0) : 0;

  const bonus = getTauntBonusForActor(taunterActor);
  const pct = clamp(Number(snapPct ?? 1.0), 1.0, 2.0);

  // EQ-ish taunt: raise to (topThreat * pct) + bonus, at least beating current.
  const newThreat = Math.max(current, Math.floor(topThreat * pct) + 1 + bonus);
  state.entries[key] = { threat: newThreat, lastSeen: Date.now() };

  // NOTE: durationRounds is reserved for future "forced focus" behavior. Currently threat-only.
  if (durationRounds) state._lastTauntAt = Date.now();

  setThreatState(npcActor, state);
}

async function tryGuardSnapTaunt({ wf }) {
  try {
    if (!wf?.sourceActor || !wf?.targetActor) return;
    if (!game.combat) return;
    if (!game.user.isGM) return;

    // Only when an NPC damages a non-NPC owner
    const attackerIsNpc = (wf.sourceActor.type === "npc") || (wf.sourceActor.system?.type === "npc");
    const targetIsNpc = (wf.targetActor.type === "npc") || (wf.targetActor.system?.type === "npc");
    if (!attackerIsNpc || targetIsNpc) return;

    // Only if damage actually landed
    if (Number(wf.totals?.applied ?? 0) <= 0) return;

    const owner = wf.targetActor;
    const pet = findActiveGuardPetForOwner(owner);
    if (!pet) return;

    // Optional toggle (default on)
    if (pet.flags?.eq5e?.pet?.guardSnapEnabled === false) return;

    // Gate: requires some threat-transfer capability (so it doesn't surprise everyone)
    const mods = getOwnerAggroMods(owner);
    const pct = Number(mods.petThreatTransferPct ?? 0);
    if (pct <= 0) return;

    // Cooldown (round-based, deterministic)
    const cdRounds = Number(pet.flags?.eq5e?.pet?.guardSnapCooldownRounds ?? 3);
    const nextOkRound = Number(pet.flags?.eq5e?.pet?.guardSnapNextRound ?? 0);
    const nowRound = Number(game.combat.round ?? 0);
    if (nowRound < nextOkRound) return;

    // Perform taunt against the attacking NPC
    await applyTaunt({ npcActor: wf.sourceActor, taunterActor: pet, durationRounds: 1 });

    // Set cooldown
    await pet.setFlag("eq5e", "pet.guardSnapNextRound", nowRound + cdRounds);
  } catch (e) {
    console.error("[EQ5E] tryGuardSnapTaunt failed", e);
  }
}

async function clearExpiredForcedTarget(npcActor) {
  const state = getThreatState(npcActor);
  if (!state.forced) return;
  const combat = game.combat;
  if (!combat || state.forced.untilRound == null) return;
  if (combat.round >= state.forced.untilRound) {
    state.forced = null;
    await setThreatState(npcActor, state);
  }
}

/* ------------------------- DAMAGE PIPELINE ------------------------------- */

function guessCategory(type) {
  const elemental = ["fire", "cold", "magic", "poison", "disease"];
  if (elemental.includes(String(type ?? "").toLowerCase())) return "spell";
  return "physical";
}

function getAC(actor) {
  const base = Number(get(actor, "system.attributes.ac.value", get(actor, "system.attributes.ac", 10)));
  const bonus = Number(actor?.flags?.eq5e?.combat?.acBonus ?? 0);
  return base + bonus;
}
function getHP(actor) {
  const value = Number(get(actor, "system.attributes.hp.value", get(actor, "system.attributes.hp", 0)));
  let max = Number(get(actor, "system.attributes.hp.max", value));
  const b = Number(actor?.flags?.eq5e?.combat?.hpMaxBonus ?? 0);
  if (b) max = Math.max(1, max + b);
  return { value, max };
}

function getClassMitigationBonusPct(actor) {
  try {
    const cls = String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls === "warrior") {
      return clamp(Number(game.settings.get("eq5e","mitigationClassBonusWarriorPct") ?? 0), 0, 0.25);
    }
    if (cls === "paladin") {
      return clamp(Number(game.settings.get("eq5e","mitigationClassBonusPaladinPct") ?? 0), 0, 0.25);
    }
    if (cls === "shadowknight") {
      return clamp(Number(game.settings.get("eq5e","mitigationClassBonusShadowknightPct") ?? 0), 0, 0.25);
    }
    return 0;
  } catch (e) { return 0; }
}




async function isTankThreatStableForHealer({ healerToken } = {}) {
  try {
    const combat = game.combat;
    if (!combat?.started) return true;
    const rounds = Number(game.settings.get("eq5e","healerThreatCautionRounds") ?? 0);
    if ((combat.round ?? 0) > rounds) return true;

    // Pick a relevant hostile NPC: healer's current target if hostile, else first hostile NPC combatant.
    let npcActor = null;
    const ht = healerToken ?? canvas.tokens?.controlled?.[0] ?? null;
    const tgt = ht?.target ?? null; // not reliable
    // Use user targets set
    const userTarget = [...game.user.targets][0] ?? null;
    if (userTarget?.actor && ht && userTarget.document?.disposition !== ht.document?.disposition) npcActor = userTarget.actor;

    if (!npcActor) {
      for (const c of (combat.combatants ?? [])) {
        const a = c.actor;
        if (!a) continue;
        const isNpc = (a.type === "npc") || (a.system?.type === "npc");
        if (!isNpc) continue;
        npcActor = a;
        break;
      }
    }
    if (!npcActor) return true;

    const topUuid = getTopThreatTargetUuid(npcActor);
    if (!topUuid) return true;

    // Resolve top actor from combatants if possible
    const topCombatant = (combat.combatants ?? []).find(c => c.actor?.uuid === topUuid);
    const topActor = topCombatant?.actor ?? null;
    if (!topActor) return true;

    // Stable if top threat holder is a tank class or a tank-role pet
    const cls = String(topActor?.flags?.eq5e?.class?.id ?? topActor?.flags?.eq5e?.classId ?? "").toLowerCase();
    const petRole = String(topActor?.flags?.eq5e?.pet?.role ?? "");
    if (petRole === "tank") return true;
    return ["warrior","paladin","shadowknight"].includes(cls);
  } catch (e) { return true; }
}

function getHealerThroughputMult(actor) {
  try {
    const cls = String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls === "cleric") return Number(game.settings.get("eq5e","healerPowerMultCleric") ?? 1.0);
    if (cls === "druid") return Number(game.settings.get("eq5e","healerPowerMultDruid") ?? 1.0);
    if (cls === "shaman") return Number(game.settings.get("eq5e","healerPowerMultShaman") ?? 1.0);
    return 1.0;
  } catch (e) { return 1.0; }
}


async function applyHealThreatToEngagedNPCs({ healerActor, healedActor, healingAmount = 0 } = {}) {
  try {
    if (!healerActor || !healedActor) return 0;
    // Healing hostile NPCs should not generate aggro.
    if ((healedActor.type === "npc") || (healedActor.system?.type === "npc")) return 0;
    const coeff = Number(game.settings.get("eq5e","threatHealToThreat") ?? 0);
    if (!coeff || coeff <= 0) return 0;
    const combat = game.combat;
    if (!combat?.started) return 0;

    const healedUuid = healedActor.uuid;
    const threatAdd = Math.max(0, Math.floor(Number(healingAmount) * coeff));
    if (threatAdd <= 0) return 0;

    let appliedTotal = 0;
    for (const c of (combat.combatants ?? [])) {
      const npc = c.actor;
      if (!npc) continue;
      const isNpc = (npc.type === "npc") || (npc.system?.type === "npc");
      if (!isNpc) continue;

      const state = getThreatState(npc);
      if (!state?.entries?.[healedUuid]) continue;

      // Hostile only (best-effort via token dispositions if available)
      try {
        const npcTok = c.token ? c.token.object : null;
        const healedTok = combat.combatants?.find(x => x.actor?.uuid === healedUuid)?.token?.object ?? null;
        if (npcTok && healedTok && npcTok.document?.disposition === healedTok.document?.disposition) continue;
      } catch(e) {}

      const key = healerActor.uuid;
      const cur = state.entries[key]?.threat ?? 0;
      state.entries[key] = { threat: cur + threatAdd, lastSeen: Date.now() };
      setThreatState(npc, state);
      appliedTotal += threatAdd;
    }
    return appliedTotal;
  } catch (e) { return 0; }
}

async function applyDamage({ packet, options = {} }) {
  const opts = foundry.utils.mergeObject({ applyDamage: true, showChat: true }, options, { inplace: false });

  const sourceActor = packet.sourceActorUuid ? await fromUuid(packet.sourceActorUuid) : null;
  const targetActor = packet.targetActorUuid ? await fromUuid(packet.targetActorUuid) : null;
  if (!targetActor) return { ok: false, reason: "missing-target" };

  const rawParts = (packet.parts ?? [])
    .map(p => ({
      amount: Math.max(0, Number(p.amount ?? 0)),
      type: String(p.type ?? "untyped").toLowerCase(),
      category: String(p.category ?? guessCategory(p.type)).toLowerCase()
    }))
    .filter(p => p.amount > 0);

  const healParts = rawParts.filter(p => p.category === "healing" || p.type === "healing");
  const healMult = getHealerThroughputMult(sourceActor);
  for (const hp of healParts) hp.amount = Math.max(0, Math.floor(Number(hp.amount ?? 0) * healMult));

  const parts = rawParts.filter(p => !(p.category === "healing" || p.type === "healing"));


  const wf = {
    packet,
    parts,
    healParts,
    sourceActor,
    targetActor,
    options: opts,
    totals: { incoming: sumParts(parts), resisted: 0, mitigated: 0, absorbed: 0, applied: 0, healing: sumParts(healParts) }
  };

  await Hooks.callAll("eq5e.preDamage", wf);

  // Resist phase (per-damage-part, deterministic; supports full + partial resists + penetration)
for (let i = 0; i < wf.parts.length; i++) {
  const p = wf.parts[i];
  const before = p.amount;
  const rr = applyResistsToDamagePart({ wf, dmgType: p.type, amount: before, partIndex: i });
  p.amount = rr.amount;
  if (before !== p.amount) wf.totals.resisted += (before - p.amount);
  // expose for UI/debug
  p.resist = { outcome: rr.outcome, chance: rr.resistChance };
}
await Hooks.callAll("eq5e.resistDamage", wf);

  // Mitigation phase (MVP flat+% by category)
  const mit = targetActor.system?.mitigation ?? {};
  for (const p of wf.parts) {
    const before = p.amount;
    if (p.category === "physical") {
      const flat = Number(mit.physicalFlat ?? 0);
      const pct = clamp(Number(mit.physicalPct ?? 0) + getClassMitigationBonusPct(targetActor), 0, 0.90);
      let amt = Math.max(0, before - flat);
      amt = Math.max(0, Math.floor(amt * (1 - pct)));
      wf.totals.mitigated += (before - amt);
      p.amount = amt;
    } else if (p.category === "spell") {
      const flat = Number(mit.spellFlat ?? 0);
      const pct = clamp(Number(mit.spellPct ?? 0) + getClassMitigationBonusPct(targetActor), 0, 0.90);
      let amt = Math.max(0, before - flat);
      amt = Math.max(0, Math.floor(amt * (1 - pct)));
      wf.totals.mitigated += (before - amt);
      p.amount = amt;
    }
  }
  await Hooks.callAll("eq5e.mitigateDamage", wf);

// Condition-driven damage taken adjustments (e.g., Mark of Decay increasing disease damage)
wf.totals.vulnerabilityAdded = 0;
try {
  const conds = targetActor.flags?.eq5e?.conditions ?? {};
  for (const p of wf.parts) {
    if (p.amount <= 0) continue;
    const dt = mapDamageTypeToResist(p.type);
    let mult = 1.0;
    for (const [cid, c] of Object.entries(conds)) {
      if (!c?.active) continue;
      const meta = c?.meta ?? null;
      if (!meta) continue;
      if (String(meta.damageFamily ?? "") === String(dt ?? "")) {
        const adj = Number(meta.damageTakenPctAdj ?? 0);
        if (Number.isFinite(adj) && adj !== 0) mult *= (1 + adj);
      }
    }
    if (mult !== 1.0) {
      const before = p.amount;
      const after = Math.max(0, Math.floor(before * mult));
      p.amount = after;
      wf.totals.vulnerabilityAdded += (after - before);
    }
  }
} catch (e) {}

await Hooks.callAll("eq5e.vulnerabilityDamage", wf);

  // Wards / absorption
  let wards = Array.isArray(targetActor.flags?.eq5e?.wards) ? dupe(targetActor.flags.eq5e.wards) : [];
  if (wards.length) {
    wards.sort((a,b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
    for (const p of wf.parts) {
      if (p.amount <= 0) continue;
      for (const w of wards) {
        if (p.amount <= 0) break;
        if (!w.remaining || w.remaining <= 0) continue;
        const types = w.types ?? ["all"];
        const canAbsorb = types.includes("all") || types.includes(p.type) || types.includes(p.category);
        if (!canAbsorb) continue;
        const soak = Math.min(p.amount, w.remaining);
        w.remaining -= soak;
        p.amount -= soak;
        wf.totals.absorbed += soak;
      }
    }
  }
  await Hooks.callAll("eq5e.absorbDamage", wf);

  wf.totals.applied = sumParts(wf.parts);

  // Apply to HP + wards, GM only
  if (opts.applyDamage && game.user.isGM) {
    const hpPath = "system.attributes.hp.value";
    const hp = getHP(targetActor).value;
    const newHP = Math.max(0, hp - wf.totals.applied);
    await targetActor.update({ [hpPath]: newHP });
    if (wards.length) await targetActor.setFlag("eq5e", "wards", wards.filter(w => (w.remaining ?? 0) > 0));
  }


// Apply healing (bypasses resists/mitigation/wards)
if (wf.totals.healing > 0 && opts.applyDamage && game.user.isGM) {
  const hpPath = "system.attributes.hp.value";
  const hp = getHP(targetActor).value;
  const max = getHP(targetActor).max ?? hp;
  const newHP = Math.min(max, hp + wf.totals.healing);
  await targetActor.update({ [hpPath]: newHP });
}


  
// Mez breaks on damage (deterministic check)
// Default: break chance per damaging hit. Set condition meta.breakChance to override.
if (wf.totals.applied > 0) {
  const mez = targetActor.flags?.eq5e?.conditions?.mezzed;
  if (mez?.active && mez.meta?.breakOnDamage !== false) {
    const base = Number(mez.meta?.breakChance ?? 0.35); // 35% per hit by default
    const chance = clamp(base, 0, 1);
    const seed = `${packet?.id ?? ""}|mez|${wf.targetActorUuid}|${wf.sourceActorUuid}|r${game.combat?.round ?? 0}t${game.combat?.turn ?? 0}|d${wf.totals.applied}`;
    const roll = _deterministicFloat01(seed);
    if (roll < chance) {
      await clearCondition({ actor: targetActor, conditionId: "mezzed" });
    }
  }
}

// Charm breaks on damage (deterministic check)
// Applies to charm-controlled targets (summonType=charm). Default chance scales slightly with damage.
if (wf.totals.applied > 0) {
  const summonType = String(targetActor.flags?.eq5e?.summon?.summonType ?? "").toLowerCase();
  const summonId = String(targetActor.flags?.eq5e?.summon?.summonId ?? "");
  if (summonType === "charm" && summonId) {
    const ownerUuid = targetActor.flags?.eq5e?.charm?.ownerUuid ?? targetActor.flags?.eq5e?.summon?.ownerUuid ?? null;
    const owner = ownerUuid ? await fromUuid(ownerUuid) : null;

    // Base: 20% + (damage/50)*10%, capped at 50%
    let chance = 0.20 + (Number(wf.totals.applied) / 50) * 0.10;
    chance = clamp(chance, 0.05, 0.50);

    // Charm Mastery AA reduces break chance a bit (stored as bonus rounds for now)
    const mastery = Number(owner?.flags?.eq5e?.enchanter?.charmBonusRounds ?? 0);
    chance = clamp(chance - mastery * 0.03, 0.05, 0.50);

    // Spell/condition can override via condition meta.breakChance if present
    const ch = targetActor.flags?.eq5e?.conditions?.charmed;
    if (ch?.meta?.breakChance !== undefined) {
      chance = clamp(Number(ch.meta.breakChance), 0, 1);
    }

    const seed = `${packet?.id ?? ""}|charm|${wf.targetActorUuid}|${wf.sourceActorUuid}|r${game.combat?.round ?? 0}t${game.combat?.turn ?? 0}|d${wf.totals.applied}`;
    const roll = _deterministicFloat01(seed);
    if (roll < chance) {
      await despawnSummonedPet({ actor: targetActor, reason: "charm-broken" });
    }
  }
}

  // Threat generation (NPC targets only, MVP)
  if (wf.totals.applied > 0 && wf.sourceActor && wf.targetActor) {
    const isNpc = (wf.targetActor.type === "npc") || (wf.targetActor.system?.type === "npc");
    if (isNpc) {
      const mult = getThreatMultiplierForSource(wf.sourceActor);
      await addThreat({ npcActor: wf.targetActor, sourceActor: wf.sourceActor, amount: wf.totals.applied * getThreatDamageToThreat() * mult });
    }
  }


// Parse logging (damage + healing)
try {
  if (wf.totals.applied > 0) {
    // threat estimate: only NPCs receive threat from damage
    const isNpc = (wf.targetActor?.type === "npc") || (wf.targetActor?.system?.type === "npc");
    const threat = isNpc && wf.sourceActor ? (wf.totals.applied * getThreatDamageToThreat() * getThreatMultiplierForSource(wf.sourceActor)) : 0;
    recordParseEvent({ kind: "damage", sourceActor: wf.sourceActor, targetActor: wf.targetActor, amount: wf.totals.applied, resisted: wf.totals.resisted, mitigated: wf.totals.mitigated, absorbed: wf.totals.absorbed, threat, parts: wf.parts });
  }
  if (wf.totals.healing > 0) {
    recordParseEvent({ kind: "healing", sourceActor: wf.sourceActor, targetActor: wf.targetActor, amount: wf.totals.healing, threat: Number(wf.totals.healThreat ?? 0) });
  }
} catch(e) {}

await Hooks.callAll("eq5e.postDamage", wf);

  if (opts.showChat) {
    const tgt = wf.targetActor?.name ?? "Target";
    const src = wf.sourceActor?.name ?? "Source";
    const html =
      `<div class="eq5e-dmg-card">
        <div><b>${src}</b> → <b>${tgt}</b></div>
        <div>Incoming: ${wf.totals.incoming}</div>
        <div>Resisted: ${wf.totals.resisted}</div>
        <div>Mitigated: ${wf.totals.mitigated}</div>
        <div>Absorbed: ${wf.totals.absorbed}</div>
        <div><b>Applied: ${wf.totals.applied}</b></div>
        <div>Healing: ${wf.totals.healing}</div>
        <div>HealThreat: ${wf.totals.healThreat ?? 0}</div>
        <div>Slow prevented: ${wf.totals?.slowPreventedAttacks ?? 0}</div>
      </div>`;
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: wf.sourceActor ?? wf.targetActor }), content: html });
  }

  return { ok: true, workflow: wf };
}

/* -------------------------- ATTACKS + SPELLS ----------------------------- */

function getAbilityMod(actor, ability) {
  const score = get(actor, `system.abilities.${ability}.value`, get(actor, `system.abilities.${ability}`, 10));
  return Math.floor((Number(score) - 10) / 2);
}
function getProficiencyBonus(actor) {
  const prof = get(actor, "system.attributes.prof", null);
  if (prof != null) return Number(prof);
  const lvl = Number(get(actor, "system.details.level", 1)) || 1;
  if (lvl >= 17) return 6;
  if (lvl >= 13) return 5;
  if (lvl >= 9) return 4;
  if (lvl >= 5) return 3;
  return 2;
}

function isAttackItem(item) { return !!item?.getFlag("eq5e", "attack")?.enabled; }
function isMeleeAttackItem(item) {
  const atk = item?.getFlag("eq5e", "attack");
  return !!(atk?.enabled && String(atk.type ?? "melee").toLowerCase() === "melee");
}
function getAttackCooldownKey(item) { return `item:${item.uuid}`; }
function getGroupCooldownKey(group) { return `group:${group}`; }

function getAttackItemsReady(actor) {
  const items = Array.from(actor.items ?? []).filter(isAttackItem);
  items.sort((a,b) => (b.getFlag("eq5e","attack")?.priority ?? 0) - (a.getFlag("eq5e","attack")?.priority ?? 0));
  return items.filter(i => {
    const cdDef = i.getFlag("eq5e", "cooldown");
    const key = getAttackCooldownKey(i);
    const group = cdDef?.sharedGroup ? getGroupCooldownKey(cdDef.sharedGroup) : null;
    const itemBlocked = isOnCooldown(actor, key);
    const groupBlocked = group ? isOnCooldown(actor, group) : false;
    return !itemBlocked && !groupBlocked;
  });
}
function getMeleeAttackItemsReady(actor) {
  return getAttackItemsReady(actor).filter(isMeleeAttackItem);
}
function getMeleeSwingsPerTurn(actor) {
  const base = Number(actor.flags?.eq5e?.ai?.multiattack?.attacksPerTurn ?? 1);
  const extra = hasteToExtraAttacks(getHastePct(actor));
  const cap = Number(actor.flags?.eq5e?.ai?.multiattack?.maxAttacksPerTurn ?? 6);
  return Math.max(1, Math.min(cap, base + extra));
}

async function performAttack({ attacker, attackerToken, target, targetToken, item, applyDamage: doApplyDamage=true, noWuProc=false }) {
  if (!attacker || !target || !item) return { ok: false, reason: "missing-input" };
  if (!canAct(attacker)) return { ok: false, reason: "cannot-act" };

  const atk = item.getFlag("eq5e", "attack");
  if (!atk?.enabled) return { ok: false, reason: "no-attack-flag" };

  const ability = atk.ability ?? "str";
  const mod = getAbilityMod(attacker, ability);
  const prof = atk.proficient ? getProficiencyBonus(attacker) : 0;
  const flat = Number(atk.attackBonus ?? 0);

  // Global bonuses (AEs, bard synergy, etc.)
  const beastlordSynergy = _beastlordSynergyBonus(attacker, defender);
  const globalAtkBonus = Number(attacker.flags?.eq5e?.combat?.attackBonus ?? 0) + Number(attacker.flags?.eq5e?.bard?.synergy?.attackBonus ?? 0) + Number(beastlordSynergy.attack ?? 0);
  const globalDmgBonus = Number(attacker.flags?.eq5e?.combat?.damageBonus ?? 0) + Number(attacker.flags?.eq5e?.bard?.synergy?.damageBonus ?? 0) + Number(beastlordSynergy.damage ?? 0);

// Ranger archery bonuses: apply to ranged attacks (atk.rangeFt > 5 or atk.category === "ranged")
const isRanged = (Number(atk.rangeFt ?? 0) > 5) || String(atk.category ?? "").toLowerCase() === "ranged";
const rangerArchHit = isRanged ? Number(attacker.flags?.eq5e?.ranger?.archeryHitBonus ?? 0) : 0;
const rangerArchDmgPct = isRanged ? Number(attacker.flags?.eq5e?.ranger?.archeryDamagePct ?? 0) : 0;


  
// Classic vision vs darkness: apply small penalty in dark scenes unless infravision/lowlight
let darknessPenalty = 0;
try {
  const d = Number(canvas?.scene?.darkness ?? 0);
  if (d >= 0.5) {
    const vision = String(attacker.flags?.eq5e?.race?.vision ?? "").toLowerCase();
    const hasInfra = !!(attacker.flags?.eq5e?.race?.infravision || attacker.flags?.eq5e?.race?.traits?.infravision);
    const hasLow = (vision === "lowlight");
    if (!(hasInfra || hasLow)) darknessPenalty = -2;
  }
} catch(e) {}
const attackTotalFormula = `1d20 + ${mod} + ${prof} + ${flat} + ${globalAtkBonus} + ${rangerArchHit} + ${darknessPenalty}`;
  const attackRoll = await (new Roll(attackTotalFormula)).evaluate();

  const ac = getAC(target);
  const d20 = attackRoll.dice?.[0]?.total ?? null;
  const isCrit = (Number(attackRoll?.d20 ?? 0) === 20) || (attackRoll?.terms?.[0]?.results?.[0]?.result === 20);
  const isHit = (attackRoll.total >= ac) || isCrit;

// Monk: Technique of Master Wu (chance for an extra unarmed strike on a melee hit)
try {
  if (!noWuProc && isHit && isMeleeAttackItem(item)) {
    const cid = String(attacker?.flags?.eq5e?.class?.id ?? attacker?.flags?.eq5e?.classId ?? "").toLowerCase();
    const isMonk = (cid === "monk") || (getAARankById(attacker, "mnk.aa.master-wu") > 0);
    if (isMonk) {
      const mods = computeMonkAAMods(attacker);
      const chance = Math.max(0, Math.min(0.5, Number(mods.wuChance ?? 0)));
      if (chance > 0) {
        const r = await (new Roll("1d100")).evaluate();
        if (Number(r.total ?? 100) <= chance * 100) {
          Hooks.callAll("eq5e.monk.masterWu", { attacker, target, item, chance });
          await performAttack({ attacker, attackerToken, target, targetToken, item, applyDamage: doApplyDamage, noWuProc: true });
        }
      }
    }
  }
} catch (e) {}


  const weaponName = item.name ?? "Attack";
  const flavor = `${attacker.name} uses <b>${weaponName}</b> vs ${target.name} (AC ${ac}) — `
    + (isHit ? (isCrit ? "<b>CRIT!</b>" : "<b>HIT</b>") : "<b>MISS</b>");

  await attackRoll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker, token: attackerToken }), flavor });

  // Cooldown on attempt
  const cdDef = item.getFlag("eq5e", "cooldown");
  if (cdDef?.value) {
    await setCooldown(attacker, getAttackCooldownKey(item), cdDef);
    if (cdDef.sharedGroup) await setCooldown(attacker, getGroupCooldownKey(cdDef.sharedGroup), cdDef);
  }

  if (!isHit) return { ok: true, isHit: false, isCrit, attackTotal: attackRoll.total, ac, damageTotal: 0 };

  const parts = [];
  const dmg = Array.isArray(atk.damage) ? atk.damage : [];

// Rogue: Backstab bonus dice from AAs (adds extra precision part)
try {
  const dmg0 = Array.isArray(atk.damage) ? atk.damage : [];
  const hasBackstab = dmg0.some(p => Array.isArray(p?.tags) && p.tags.includes("backstab")) || String(item?.name ?? "").toLowerCase().includes("backstab");
  const extraDice = Number(attacker.flags?.eq5e?.rogue?.backstabBonusDice ?? 0);
  if (hasBackstab && extraDice > 0) {
    const extra = { formula: `${extraDice}d6`, type: "physical", category: "precision", tags: ["backstab","aa"] };
    atk.damage = [...dmg0, extra];
  }
} catch {}

  for (const part of dmg) {
    const formula = String(part.formula ?? "1d4+@mod").replaceAll("@mod", String(mod));
    const r = await (new Roll(formula)).evaluate();
    const baseAmt = Number(r.total ?? 0);
    const amt = isRanged ? Math.max(0, Math.round(baseAmt * (1 + rangerArchDmgPct))) : baseAmt;

    await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker, token: attackerToken }), flavor: `${weaponName} damage (${part.type ?? "damage"})` });
    parts.push({ amount: amt, type: String(part.type ?? "physical").toLowerCase(), category: String(part.category ?? guessCategory(part.type)).toLowerCase() });
  }
  if (isCrit && atk.crit?.extraDamage) {
    const r = await (new Roll(String(atk.crit.extraDamage).replaceAll("@mod", String(mod)))).evaluate();
    const baseAmt = Number(r.total ?? 0);
    const amt = isRanged ? Math.max(0, Math.round(baseAmt * (1 + rangerArchDmgPct))) : baseAmt;
    await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: attacker, token: attackerToken }), flavor: `${weaponName} critical damage` });
    parts.push({ amount: amt, type: "physical", category: "physical" });
  }

  const packet = {
    sourceActorUuid: attacker.uuid,
    targetActorUuid: target.uuid,
    parts,
    healParts,
    tags: ["melee", attacker.flags?.eq5e?.pet ? "pet" : "pc"],
    isCrit,
    meta: { itemUuid: item.uuid }
  };

  const res = await applyDamage({ packet, options: { applyDamage: doApplyDamage, showChat: true } });
  // Discipline override: consume one-shot effects and apply knockdown as a 1-round Root condition via AE sync
try {
  if (disciplineOverride) {
    const kd = Number(disciplineOverride.knockdownRounds ?? 0);
    if (kd > 0 && target) {
      const ae = {
        label: "Knockdown",
        icon: "icons/skills/melee/strike-fist-red.webp",
        duration: { rounds: kd, startRound: game.combat?.round ?? 0, startTime: game.time?.worldTime ?? 0 },
        changes: [{ key: "flags.eq5e.conditions.root", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true" }],
        flags: { eq5e: { source: "discipline", reason: "knockdown" } }
      };
      await target.createEmbeddedDocuments("ActiveEffect", [ae]);
    }
    // End the discipline after applying an override (flying kick style)
    await clearActiveDiscipline(attacker);
  }
} catch (e) { console.error("[EQ5E] consume discipline override failed", e); }

return { ok: true, isHit: true, isCrit, attackTotal: attackRoll.total, ac, damageTotal: sumParts(parts), damageResult: res };
}

/* ------------------------------ DOTS / TICKS ------------------------------ */

function getDots(actor) {
  const st = actor?.flags?.eq5e?.dots ?? {};
  return Array.isArray(st.active) ? st.active : [];
}
async function setDots(actor, dots) {
  if (!actor) return;
  const st = foundry.utils.duplicate(actor.flags?.eq5e?.dots ?? {});
  st.active = Array.isArray(dots) ? dots : [];
  await actor.setFlag("eq5e", "dots", st);
}
async function addDot({ target, sourceActorUuid, dotId, label, type="poison", category="tick", formula="1d4", remainingRounds=3, startRound=null, meta={} }) {
  if (!target || !dotId) return;
  const combat = game.combat;
  const roundNow = Number(combat?.round ?? 0);
  const sr = (startRound != null) ? Number(startRound) : roundNow;
  const dots = getDots(target).filter(d => String(d?.dotId ?? "") !== String(dotId)); // replace same id
  dots.push({
    dotId: String(dotId),
    label: String(label ?? dotId),
    sourceActorUuid: sourceActorUuid ?? null,
    type: String(type).toLowerCase(),
    category: String(category).toLowerCase(),
    formula: String(formula),
    remainingRounds: Math.max(1, Number(remainingRounds ?? 1)),
    nextRound: sr + 1,
    meta: meta ?? {}
  });
  await setDots(target, dots);
}

async function processDotsForActor({ actor, combat }) {
  if (!actor || !combat) return;
  const round = Number(combat.round ?? 0);
  const dots = getDots(actor);
  if (!dots.length) return;

  const next = [];
  for (const d of dots) {
    const nextRound = Number(d?.nextRound ?? (round+1));
    const rem = Number(d?.remainingRounds ?? 0);
    if (rem <= 0) continue;

    if (round >= nextRound) {
      const formula = String(d?.formula ?? "1");
      const seed = `${combat.id}|dot|${d.dotId}|${actor.uuid}|r${round}`;
      const amount = Math.max(0, deterministicRollSimple(formula, seed));
      if (amount > 0) {
        const packet = {
          id: `dot|${d.dotId}|${actor.id}|r${round}`,
          sourceActorUuid: d?.sourceActorUuid ?? null,
          targetActorUuid: actor.uuid,
          parts: [{ amount, type: d?.type ?? "poison", category: d?.category ?? "tick" }],
          tags: ["dot", d.dotId],
          meta: { dot: d }
        };
        await applyDamage({ packet, options: { applyDamage: true, showChat: true } });

// Druid HoTs: represented via the DOT/tick engine using healing parts (deterministic)
try {
  const hot = sp?.meta?.hot ?? null;
  if (hot && target && isHealing) {
    const cls = String(caster?.flags?.eq5e?.class?.id ?? caster?.flags?.eq5e?.classId ?? "").toLowerCase();
    const bonus = (cls === "druid") ? Number(game.settings.get("eq5e","supportHotDurationBonusRoundsDruid") ?? 0) : 0;
    const rem = Math.max(1, Number(hot.remainingRounds ?? hot.rounds ?? 3) + Math.max(0, Math.floor(bonus)));
    await addDot({
      target,
      sourceActorUuid: caster.uuid,
      dotId: String(hot.dotId ?? sp.spellId ?? item.uuid),
      label: String(hot.label ?? `${item.name} (HoT)`),
      type: "healing",
      category: "healing",
      formula: String(hot.formula ?? "1d4"),
      remainingRounds: rem,
      startRound: game.combat?.round ?? null,
      meta: { spellId: String(sp?.spellId ?? ""), hot: true }
    });
  }

// Optional: group HoT — applies to friendly tokens within range
if (hot.group && casterToken?.scene?.id) {
  const maxDist = Number(hot.groupRangeFt ?? 30);
  const friends = canvas.tokens?.placeables?.filter(t => {
    if (!t?.actor) return false;
    if (t.id === casterToken.id) return false;
    if (t.document?.disposition !== casterToken.document?.disposition) return false;
    const d = canvas.grid.measureDistance(casterToken.center, t.center);
    return d <= maxDist;
  }) ?? [];
  for (const ft of friends) {
    await addDot({
      target: ft.actor,
      sourceActorUuid: caster.uuid,
      dotId: `${String(hot.dotId ?? sp.spellId ?? item.uuid)}.${ft.actor.uuid}`,
      label: String(hot.label ?? `${item.name} (HoT)`),
      type: "healing",
      category: "healing",
      formula: String(hot.formula ?? "1d4"),
      remainingRounds: rem,
      startRound: game.combat?.round ?? null,
      meta: { spellId: String(sp?.spellId ?? ""), hot: true, group: true }
    });
  }
}

} catch(e) { console.error("[EQ5E] HoT addDot failed", e); }


      }
      const rem2 = rem - 1;
      if (rem2 > 0) next.push({ ...d, remainingRounds: rem2, nextRound: round + 1 });
    } else {
      next.push(d);
    }
  }

  await setDots(actor, next);
}

/* --------------------------- DISCIPLINES / STANCES -------------------------- */

function getDisciplineState(actor) {
  return actor?.flags?.eq5e?.discipline ?? {};
}

async function setDisciplineState(actor, state) {
  if (!actor) return;
  await actor.setFlag("eq5e", "discipline", state ?? {});
}

function getActiveDiscipline(actor) {
  const st = getDisciplineState(actor);
  return st?.active ?? null;
}

function getDisciplineCooldowns(actor) {
  const st = getDisciplineState(actor);
  return st?.cooldowns ?? {};
}

function getDisciplineCooldownRemaining(actor, disciplineId) {
  const cd = getDisciplineCooldowns(actor);
  const readyRound = Number(cd?.[disciplineId] ?? 0);
  const round = Number(game.combat?.round ?? 0);
  return Math.max(0, readyRound - round);
}

function isDisciplineOnCooldown(actor, disciplineId) {
  return getDisciplineCooldownRemaining(actor, disciplineId) > 0;
}

async function clearActiveDiscipline(actor) {
  const st = foundry.utils.duplicate(getDisciplineState(actor));
  st.active = null;
  await setDisciplineState(actor, st);
}

function _applyDisciplineModsAtActivation(actor, disc) {
  // Safe, generic hook for AA-derived modifiers.
  // Example future structure: flags.eq5e.monk.disciplineMods = { globalDurationBonus, cooldownReduction, damageMultBonus }
  try {
    const mods = actor?.flags?.eq5e?.monk?.disciplineMods ?? {};
    const out = foundry.utils.duplicate(disc);

    if (Number.isFinite(mods.globalDurationBonus)) {
      out.durationRounds = Math.max(1, Number(out.durationRounds ?? 1) + Number(mods.globalDurationBonus));
    }
    if (Number.isFinite(mods.cooldownReduction)) {
      out.cooldownRounds = Math.max(0, Number(out.cooldownRounds ?? 0) - Number(mods.cooldownReduction));
    }
    if (Number.isFinite(mods.damageMultBonus) && out.effects?.damageMult) {
      out.effects.damageMult = Number(out.effects.damageMult) + Number(mods.damageMultBonus);
    }
    return out;
  } catch (e) {
    return disc;
  }
}

async function activateDiscipline({ actor, item, disciplineData = null, silent = false } = {}) {
  if (!actor) return { ok: false, reason: "no-actor" };
  const disc0 = disciplineData ?? item?.flags?.eq5e?.discipline ?? null;
  if (!disc0?.disciplineId) return { ok: false, reason: "no-discipline" };

  const disc = _applyDisciplineModsAtActivation(actor, disc0);

// Apply AA-based discipline adjustments (cooldown/duration) before activation
const baseCooldownRounds = Number(disc?.cooldownRounds ?? 0);
const baseDurationRounds = Number(disc?.durationRounds ?? 0);
const adj = computeDisciplineAdjusted({
  actor,
  disciplineId: disc?.disciplineId,
  baseCooldownRounds,
  baseDurationRounds
});
const cooldownRounds = adj.cooldownRounds;
const durationRounds = adj.durationRounds;


  const disciplineId = String(disc.disciplineId);
  if (isDisciplineOnCooldown(actor, disciplineId)) {
    const rem = getDisciplineCooldownRemaining(actor, disciplineId);
    if (!silent) ui.notifications?.warn(`Discipline is on cooldown (${rem} rounds).`);
    return { ok: false, reason: "cooldown", remaining: rem };
  }

  const combat = game.combat;
  const round = Number(combat?.round ?? 0);
  const dur = Math.max(1, Number(disc.durationRounds ?? 1));
  const endsAtRound = round + dur;

  const st = foundry.utils.duplicate(getDisciplineState(actor));
  st.active = {
    disciplineId,
    label: String(disc.label ?? item?.name ?? disciplineId),
    startedRound: round,
    endsAtRound,
    effects: disc.effects ?? {},
    sourceItemUuid: item?.uuid ?? null
  };

  // Set cooldown ready round
  st.cooldowns = st.cooldowns ?? {};
  const cd = Math.max(0, Number(disc.cooldownRounds ?? disc.cooldown ?? 0));
  if (cd > 0) st.cooldowns[disciplineId] = round + cd;

  await setDisciplineState(actor, st);

  if (!silent) {
    try {
      await ChatMessage.create({
        content: `<p><b>${actor.name}</b> activates <b>${st.active.label}</b> (${dur} rounds).</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    } catch (e) {}
  }

  return { ok: true, active: st.active };
}

async function expireDisciplinesForCombat({ combat } = {}) {
  if (!combat) return;
  const round = Number(combat.round ?? 0);
  const actors = (combat.combatants ?? []).map(c => canvas.tokens?.get(c.tokenId)?.actor).filter(a => a);
  for (const a of actors) {
    const active = getActiveDiscipline(a);
    if (!active) continue;
    const ends = Number(active.endsAtRound ?? 0);
    if (ends > 0 && round >= ends) {
      await clearActiveDiscipline(a);
      try {
        await ChatMessage.create({
          content: `<p><b>${a.name}</b>'s discipline fades.</p>`,
          speaker: ChatMessage.getSpeaker({ actor: a })
        });
      } catch (e) {}
    }
  }
}

function getDisciplineAttackMultiplier(attacker, item) {
  const active = getActiveDiscipline(attacker);
  if (!active) return 1;
  const eff = active.effects ?? {};
  let mult = Number(eff.damageMult ?? 1);
  const outMult = Number(eff.outgoingDamageMult ?? 1);
  if (Number.isFinite(outMult) && outMult > 0) mult = mult * outMult;
  if (!Number.isFinite(mult) || mult <= 0) return 1;

  // Optional filter: onlyUnarmed requires attack tags include "unarmed"
  if (eff.onlyUnarmed) {
    const tags = item?.flags?.eq5e?.attack?.tags ?? item?.flags?.eq5e?.attack?.damageTags ?? [];
    const hasUnarmed = Array.isArray(tags) && tags.includes("unarmed");
    if (!hasUnarmed) return 1;
  }
  return mult;
}
function getDisciplineEffects(actor) {
  const active = getActiveDiscipline(actor);
  return active?.effects ?? null;
}

function getDisciplineAttackPenalty(attacker) {
  const eff = getDisciplineEffects(attacker);
  const pen = Number(eff?.attackPenalty ?? 0);
  return Number.isFinite(pen) ? pen : 0;
}

function getDisciplineExtraAttacks(attacker, item) {
  const eff = getDisciplineEffects(attacker);
  const n = Number(eff?.extraAttacks ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (eff?.onlyUnarmed) {
    const tags = item?.flags?.eq5e?.attack?.tags ?? [];
    if (!(Array.isArray(tags) && tags.includes("unarmed"))) return 0;
  }
  return Math.floor(n);
}

function isWhirlwindCleave(attacker, item) {
  const eff = getDisciplineEffects(attacker);
  if (!eff?.cleaveAdjacent) return false;
  if (eff?.onlyUnarmed) {
    const tags = item?.flags?.eq5e?.attack?.tags ?? [];
    if (!(Array.isArray(tags) && tags.includes("unarmed"))) return false;
  }
  return true;
}

function getDisciplineAttackOverride(attacker) {
  const eff = getDisciplineEffects(attacker);
  return eff?.attackOverride ?? null;
}


function computeDisciplineAdjusted({ actor, disciplineId, baseCooldownRounds, baseDurationRounds } = {}) {
  let cooldown = Number(baseCooldownRounds ?? 0);
  let duration = Number(baseDurationRounds ?? 0);

  // Warrior: Defensive Discipline Extension (adds rounds to Defensive Discipline)
  if (String(disciplineId) === "war.disc.defensive") {
    const extRank = getAARankById(actor, "war.aa.defensive-extension");
    const flagExtra = Number(actor?.flags?.eq5e?.warrior?.defensiveExtraRounds ?? 0);
    const extra = Math.max(0, (Number.isFinite(flagExtra) ? flagExtra : 0)) + Math.max(0, extRank);
    duration = Math.max(1, Math.round(duration + extra));
  }

  // Warrior: Reduced Discipline Reuse (reduces cooldown for all disciplines)
  {
    const rrRank = getAARankById(actor, "war.aa.reduced-reuse");
    const flagAdj = Number(actor?.flags?.eq5e?.warrior?.discCdAdj ?? 0);
    const adj = (Number.isFinite(flagAdj) ? flagAdj : 0) + (-1 * Math.max(0, rrRank));
    cooldown = Math.max(1, Math.round(cooldown + adj));
  }

  return { cooldownRounds: cooldown, durationRounds: duration };
}

async function activateDisciplineSafe({ actor, item } = {}) {
  if (!actor || !item) return { ok: false, reason: "missing" };
  // GM can do it directly; players request GM over socket (same authorization model as pet management)
  if (game.user.isGM) return activateDiscipline({ actor, item });
  return requestGMActivateDiscipline({ actorUuid: actor.uuid, itemUuid: item.uuid });
}

async function clearActiveDisciplineSafe({ actor } = {}) {
  if (!actor) return { ok: false, reason: "missing" };
  if (game.user.isGM) { await clearActiveDiscipline(actor); return { ok: true }; }
  return requestGMClearDiscipline({ actorUuid: actor.uuid });
}


async function resurrectActor({ targetActor, hpPct = 0.5, sicknessRounds = 10, sourceActor = null } = {}) {
  if (!targetActor) return { ok: false, reason: "missing-target" };

  const hpPath = "system.attributes.hp.value";
  const hpMaxPath = "system.attributes.hp.max";
  const hpMax = Number(foundry.utils.getProperty(targetActor, hpMaxPath) ?? 0);
  const newHP = Math.max(1, Math.floor(hpMax * Math.max(0.05, Math.min(1, Number(hpPct)))));

  await targetActor.update({ [hpPath]: newHP });

// Clear control conditions on rez: Mez/Root/Snare/Silence
// We clear both the condition flags and any Active Effects that are currently implying them,
// so they don't immediately re-sync back to active.
try {
  const ccIds = ["silenced","mezzed","rooted","snared"];
  for (const id of ccIds) await clearCondition({ actor: targetActor, conditionId: id });

  const toDisable = [];
  for (const ef of targetActor.effects ?? []) {
    if (!ef || ef.disabled) continue;
    const f = ef.flags?.eq5e ?? {};
    const isHostile = (f.disposition === "hostile") || (f.hostile === true) || (f.isHostile === true);
    if (!isHostile) continue;
    const implied = _extractConditionIdsFromEffect(ef);
    let hits = false;
    for (const id of ccIds) if (implied.has(id)) { hits = true; break; }
    if (hits) toDisable.push({ _id: ef.id, disabled: true });
  }
  if (toDisable.length) await targetActor.updateEmbeddedDocuments("ActiveEffect", toDisable);
} catch (e) { console.warn("[EQ5E] clear CC on rez failed", e); }

  // Apply rez sickness as an AE (mirrors into condition flags cleanly)
  try {
    const ae = {
      label: "Resurrection Sickness",
      icon: "icons/magic/life/ankh-gold.webp",
      duration: { rounds: Number(sicknessRounds ?? 10), startRound: game.combat?.round ?? 0, startTime: game.time?.worldTime ?? 0 },
      changes: [
        { key: "flags.eq5e.rezSickness", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "true" },
        { key: "system.mitigation.physicalPct", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "-0.10" },
        { key: "flags.eq5e.rezSicknessMovePct", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: "0.80" }
      ],
      flags: { eq5e: { source: "resurrection", by: sourceActor?.uuid ?? null } }
    };
    await targetActor.createEmbeddedDocuments("ActiveEffect", [ae]);
  } catch (e) { console.warn("[EQ5E] rez sickness AE failed", e); }

  return { ok: true, newHP };
}


async function applyTauntSafe({ npcActor, taunterActor, durationRounds = 1, flatThreat = 0, snapPct = 1.0, reason = "taunt" } = {}) {
  if (!npcActor || !taunterActor) return { ok: false, reason: "missing-actor" };

  if (game.user.isGM) {
    await applyTaunt({ npcActor, taunterActor, durationRounds, snapPct });
    if (flatThreat) await addThreat({ npcActor, sourceActor: taunterActor, amount: flatThreat, reason });
    return { ok: true };
  }

  game.socket.emit("system.eq5e", {
    type: "eq5e.taunt",
    userId: game.user.id,
    taunterActorUuid: taunterActor.uuid,
    targets: [{ npcActorUuid: npcActor.uuid }],
    durationRounds, flatThreat, reason
  });
  return { ok: true, queued: true };
}

async function applyTauntBatchSafe({ targets = [], taunterActor, durationRounds = 1, flatThreat = 0, reason = "taunt" } = {}) {
  if (!taunterActor) return { ok: false, reason: "missing-taunter" };
  const clean = (targets ?? []).filter(t => t?.npcActor).map(t => ({ npcActorUuid: t.npcActor.uuid }));

  if (game.user.isGM) {
    for (const t of (targets ?? [])) {
      if (!t?.npcActor) continue;
      await applyTaunt({ npcActor: t.npcActor, taunterActor, durationRounds, snapPct });
      if (flatThreat) await addThreat({ npcActor: t.npcActor, sourceActor: taunterActor, amount: flatThreat, reason });
    }
    return { ok: true };
  }

  game.socket.emit("system.eq5e", {
    type: "eq5e.taunt",
    userId: game.user.id,
    taunterActorUuid: taunterActor.uuid,
    targets: clean,
    durationRounds, flatThreat, reason
  });
  return { ok: true, queued: true };
}

function _getHostileTokensWithinFt(originToken, radiusFt) {
  if (!canvas?.ready || !originToken) return [];
  const origin = originToken.center ?? { x: originToken.x, y: originToken.y };
  const out = [];
  for (const tok of canvas.tokens?.placeables ?? []) {
    if (!tok?.actor) continue;
    if (tok.id === originToken.id) continue;
    const disp = tok.document?.disposition;
    if (disp === 1) continue;
    const isNPC = (tok.actor?.type === "npc") || (tok.actor?.hasPlayerOwner === false);
    if (!isNPC && disp !== -1) continue;
    const dist = canvas.grid.measureDistance(origin, tok.center ?? { x: tok.x, y: tok.y });
    if (Number(dist) <= Number(radiusFt)) out.push(tok);
  }
  return out;
}

async function resurrectActorSafe({ targetActor, hpPct = 0.5, sicknessRounds = 10, sourceActor = null } = {}) {
  if (!targetActor) return { ok: false, reason: "missing-target" };

  if (game.user.isGM) {
    return await resurrectActor({ targetActor, hpPct, sicknessRounds, sourceActor });
  }

  // players request GM over socket; GM checks OWNER on sourceActor (if provided) OR on targetActor (if self-owned)
  game.socket.emit("system.eq5e", {
    type: "eq5e.resurrectActor",
    userId: game.user.id,
    targetActorUuid: targetActor.uuid,
    sourceActorUuid: sourceActor?.uuid ?? null,
    hpPct, sicknessRounds
  });

  return { ok: true, queued: true };
}


/* ---------------------------- PROCS / POISONS ----------------------------- */

function getOnHitProcs(actor) {
  const state = actor?.flags?.eq5e?.procs ?? {};
  return Array.isArray(state.onHit) ? state.onHit : [];
}

async function setOnHitProcs(actor, procs) {
  if (!actor) return;
  const state = foundry.utils.duplicate(actor.flags?.eq5e?.procs ?? {});
  state.onHit = Array.isArray(procs) ? procs : [];
  await actor.setFlag("eq5e", "procs", state);
}

async function armOnHitProc({ actor, procId, charges = 1, effect = {}, sourceItemUuid = null }) {
  if (!actor || !procId) return;
  const list = getOnHitProcs(actor);
  // Replace existing same procId
  const next = list.filter(p => String(p?.procId ?? "") !== String(procId));
  next.push({ procId: String(procId), charges: Math.max(1, Number(charges ?? 1)), effect: effect ?? {}, sourceItemUuid });
  await setOnHitProcs(actor, next);
}

async function consumeOnHitProc({ actor, procId, amount = 1 }) {
  const list = getOnHitProcs(actor);
  const next = [];
  for (const p of list) {
    if (String(p?.procId ?? "") !== String(procId)) { next.push(p); continue; }
    const ch = Math.max(0, Number(p?.charges ?? 0) - Math.max(1, Number(amount ?? 1)));
    if (ch > 0) next.push({ ...p, charges: ch });
  }
  await setOnHitProcs(actor, next);
}

async function handleOnHitProcs({ attacker, attackerToken, target, targetToken, hitContext = {} }) {
  if (!attacker || !target) return { applied: 0 };
  const procs = getOnHitProcs(attacker);
  if (!procs.length) return { applied: 0 };

  let applied = 0;
  for (const p of procs) {
    const procId = String(p?.procId ?? "");
    const charges = Number(p?.charges ?? 0);
    if (!procId || charges <= 0) continue;

    const eff = p?.effect ?? {};
    const dmgParts = Array.isArray(eff.damage) ? eff.damage : [];
    if (!dmgParts.length) {
      await consumeOnHitProc({ actor: attacker, procId, amount: 1 });
      continue;
    }

    const poisonMult = 1 + Number(attacker.flags?.eq5e?.rogue?.poisonDamagePct ?? 0);

    // Build immediate parts and/or schedule DoTs
    const immediate = [];
    for (const part of dmgParts) {
      const duration = Number(part.durationRounds ?? eff.durationRounds ?? 0) || 0;
      const dtype = String(part.type ?? "poison").toLowerCase();
      const category = String(part.category ?? "proc").toLowerCase();
      const formula0 = String(part.formula ?? "1").replaceAll("@mod", String(getAbilityMod(attacker, "dex")));
      const label = `${attacker.name} proc: ${procId}`;

      if (duration > 0 && (category === "tick" || category === "dot" || category === "proc" && dtype === "poison")) {
        // schedule DoT instead of immediate (deterministic ticks in updateCombat round)
        const dotId = `${procId}|${attacker.uuid}|${target.uuid}`;
        await addDot({
          target,
          sourceActorUuid: attacker.uuid,
          dotId,
          label,
          type: dtype,
          category: "tick",
          formula: formula0,
          remainingRounds: duration,
          meta: { procId, sourceItemUuid: p?.sourceItemUuid ?? null, hitContext, poisonMult }
        });
        applied++;
        continue;
      }

      // Immediate damage part (deterministic roll)
      const seed = `${hitContext?.itemUuid ?? ""}|proc|${procId}|${attacker.uuid}|${target.uuid}|r${game.combat?.round ?? 0}t${game.combat?.turn ?? 0}|${formula0}`;
      let amt = Math.max(0, deterministicRollSimple(formula0, seed));
      if (dtype === "poison") amt = Math.max(0, Math.round(amt * poisonMult));
      immediate.push({ amount: amt, type: dtype, category });
    }

    if (immediate.some(p => (p.amount ?? 0) > 0)) {
      const packet = {
        id: `proc|${procId}|${attacker.id}|${target.id}|r${game.combat?.round ?? 0}`,
        sourceActorUuid: attacker.uuid,
        targetActorUuid: target.uuid,
        parts: immediate.filter(p => (p.amount ?? 0) > 0),
        tags: ["proc", procId],
        isCrit: false,
        meta: { procId, sourceItemUuid: p?.sourceItemUuid ?? null, hitContext }
      };
      await applyDamage({ packet, options: { applyDamage: true, showChat: true } });
    }

    await consumeOnHitProc({ actor: attacker, procId, amount: 1 });
  }

  return { applied };
}


/* ------------------------------- SPELLS ---------------------------------- */

function getMana(actor) {
  const v = Number(get(actor, "system.resources.mana.value", get(actor, "system.attributes.mana.value", 0)));
  const m = Number(get(actor, "system.resources.mana.max", get(actor, "system.attributes.mana.max", v)));
  return { value: v, max: m };
}
async function spendMana(actor, amount) {
  const { value } = getMana(actor);
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  if (value < cost) return { ok: false, reason: "insufficient-mana", value, cost };

  const hasResPath = get(actor, "system.resources.mana.value", null) != null;
  const path = hasResPath ? "system.resources.mana.value" : "system.attributes.mana.value";
  await actor.update({ [path]: value - cost });
  return { ok: true, remaining: value - cost, cost };
}
function isSpellItem(item) { return !!item?.getFlag("eq5e", "spell")?.enabled; }
function getSpellItemsReady(actor) {
  const items = Array.from(actor.items ?? []).filter(isSpellItem);
  items.sort((a,b) => (b.getFlag("eq5e","spell")?.priority ?? 0) - (a.getFlag("eq5e","spell")?.priority ?? 0));
  return items.filter(i => {
    const sp = i.getFlag("eq5e","spell");
    const cdDef = i.getFlag("eq5e","cooldown");
    const key = `item:${i.uuid}`;
    const groupKey = cdDef?.sharedGroup ? `group:${cdDef.sharedGroup}` : null;
    if (isOnCooldown(actor, key)) return false;
    if (groupKey && isOnCooldown(actor, groupKey)) return false;
    const mana = getMana(actor).value;
    let cost = Number(sp?.manaCost ?? 0);
    try {
      const red = Number(actor.flags?.eq5e?.wizard?.manaReductionPct ?? 0) + Number(actor.flags?.eq5e?.combat?.manaReductionPct ?? 0);
      if (red > 0) cost = Math.max(0, Math.ceil(cost * (1 - Math.min(0.75, red))));
    } catch (e) {}
    return mana >= cost;
  });
}

async function castSpell({ caster, casterToken, target, targetToken, item, options = {} }) {
  const sp = item?.getFlag?.("eq5e","spell");
  if (!sp?.enabled) return { ok: false, reason: "not-a-spell" };
  if (!canCast(caster)) return { ok: false, reason: "cannot-cast" };

  const rangeFt = Number(sp.rangeFt ?? 0);
  if (rangeFt > 0 && casterToken && targetToken) {
    const distFt = canvas.grid.measureDistance(casterToken.center, targetToken.center);
    if (distFt > rangeFt) return { ok: false, reason: "out-of-range", distFt, rangeFt };
  }


// Lay on Hands scaling (Paladin): dynamic heal based on level and AA ranks.
// Implemented as a spell-flagged ability item (instant, no mana) so it uses the same pipeline.
if (String(sp.spellId ?? "") === "pal.abil.lay-on-hands") {
  try {
    const lvl = Number(foundry.utils.getProperty(caster, "system.details.level") ??
                       foundry.utils.getProperty(caster, "system.attributes.level") ??
                       foundry.utils.getProperty(caster, "system.level") ?? 1);
    const healRank = getAARankById(caster, "pal.aa.healing-light");

    const dice = Math.max(6, Math.min(12, 6 + Math.floor(Math.max(0, lvl - 1) / 4)));
    let bonus = 12 + (2 * Math.max(1, lvl));

    const flagHealPct = Number(caster.flags?.eq5e?.paladin?.healPct ?? 0);
    const aaHealPct = 0.05 * Math.max(0, healRank);
    const healPct = Math.max(0, flagHealPct + aaHealPct);
    bonus = Math.round(bonus * (1 + Math.min(1.0, healPct)));

    const formula = `${dice}d8+${bonus}`;
    sp.damage = [{ formula, type: "healing", category: "healing", tags: [] }];
    sp.manaCost = 0;
  } catch (e) { console.warn("[EQ5E] Lay on Hands scaling failed", e); }
}

  let manaCost = Number(sp.manaCost ?? 0);
  try {
    const red = Number(caster.flags?.eq5e?.wizard?.manaReductionPct ?? 0);
    if (red > 0) manaCost = Math.max(0, Math.ceil(manaCost * (1 - Math.min(0.75, red))));
  } catch (e) {}

  const spent = await spendMana(caster, manaCost);
  if (!spent.ok) return { ok: false, reason: spent.reason, cost: spent.cost };

  // Cooldown on cast
  const cdDef = item.getFlag("eq5e","cooldown");

// Shadowknight AA adjustments: cooldown reuse + harm touch scaling
try {
  const sid = String(sp?.spellId ?? "");
  const mods = computeShadowknightAAMods(caster);

  // Harm Touch / Unholy Touch cooldown + damage scaling
  if (sid === "sk.ht.1" || sid === "sk.ht.2") {
    const base = Number(cdDef?.value ?? 20);
    const v = Math.max(10, Math.round(base + mods.harmTouchCdAdj));
    if (cdDef) cdDef.value = v;
    await caster.setFlag("eq5e","shadowknight._harmTouchPct", Math.max(0, Number(mods.harmTouchPct ?? 0)));
  } else if (caster?.flags?.eq5e?.shadowknight?._harmTouchPct) {
    await caster.unsetFlag("eq5e","shadowknight._harmTouchPct");
  }

  // Dark Regeneration cooldown reuse
  if (sid === "sk.heal.self.1") {
    const base = Number(cdDef?.value ?? 4);
    const v = Math.max(1, Math.round(base + mods.darkRegenCdAdj));
    if (cdDef) cdDef.value = v;
  }
} catch (e) {}


// Lay on Hands cooldown adjust (Paladin): base item cooldown minus AA reuse ranks and any derived flag.
if (String(sp.spellId ?? "") === "pal.abil.lay-on-hands") {
  try {
    const base = Number(cdDef?.value ?? 20);
    const reuseRank = getAARankById(caster, "pal.aa.layhands-reuse");
    const adjFlag = Number(caster.flags?.eq5e?.paladin?.layHandsCdRounds ?? 0);
    const adj = (-2 * Math.max(0, reuseRank)) + adjFlag;
    const v = Math.max(5, Math.round(base + adj));
    if (cdDef) cdDef.value = v;
  } catch (e) {}
}

  
// Monk: Mend / Feign Death cooldown adjustments via AAs
if (sp?.spellId === "mnk.abil.mend") {
  try {
    const mods = computeMonkAAMods(caster);
    const base = Number(cdDef?.value ?? 0);
    const v = Math.max(1, Math.round(base + mods.mendCdAdj));
    if (cdDef) cdDef.value = v;
  } catch (e) {}
}
if (sp?.spellId === "mnk.abil.feign-death") {
  try {
    const mods = computeMonkAAMods(caster);
    const base = Number(cdDef?.value ?? 0);
    const v = Math.max(1, Math.round(base + mods.fdCdAdj));
    if (cdDef) cdDef.value = v;
  } catch (e) {}
}

if (cdDef?.value) {
    await setCooldown(caster, `item:${item.uuid}`, cdDef);
    if (cdDef.sharedGroup) await setCooldown(caster, `group:${cdDef.sharedGroup}`, cdDef);
  }

  
// Resurrection / Revive: handled via socket-safe GM application
// sp.meta.resurrect = { hpPct, sicknessRounds }
if (sp?.meta?.resurrect && target) {
  try {
    const hp = Number(foundry.utils.getProperty(target, "system.attributes.hp.value") ?? 0);
    if (hp <= 0) {
      const hpPct = Number(sp.meta.resurrect.hpPct ?? 0.5);
      const sicknessRounds = Number(sp.meta.resurrect.sicknessRounds ?? 10);
      await resurrectActorSafe({ targetActor: target, hpPct, sicknessRounds, sourceActor: caster });
      return { ok: true, resurrected: true };
    }
  } catch (e) { console.error("[EQ5E] resurrect cast failed", e); }
}

// Taunt abilities (kind: "taunt") — deterministic threat + focus, multiplayer-safe via socket to GM.
  if (String(sp?.kind ?? "") === "taunt") {
    const durationRounds = Number(sp?.meta?.durationRounds ?? 1);
    const baseThreat = Number(sp?.meta?.threatBonus ?? sp?.meta?.flatThreat ?? 0);

// Shadowknight Terror mastery: increase threat and optionally extend forced-focus duration at max rank
try {
  const sid = String(sp?.spellId ?? "");
  if (sid.startsWith("sk.terror")) {
    const mods = computeShadowknightAAMods(caster);
    if (mods.terrorThreatPct) {
      const bonus = Math.round(baseThreat * mods.terrorThreatPct);
      sp.meta.threatBonus = Number(baseThreat) + bonus;
    }
    if (mods.terrorFocusBonus) {
      sp.meta.durationRounds = Math.max(Number(sp?.meta?.durationRounds ?? 1), 1 + mods.terrorFocusBonus);
    }
  }
  // Minion command taunt scaling
  if (sid === "sk.pet.command.taunt.1") {
    const mods = computeShadowknightAAMods(caster);
    if (mods.cmdThreatPct) {
      const bonus = Math.round(baseThreat * mods.cmdThreatPct);
      sp.meta.threatBonus = Number(baseThreat) + bonus;
    }
  }
} catch (e) {}


    
const taunter = petCommandSource?.uuid ? petCommandSource : caster;

const tauntBonus = Number(caster?.flags?.eq5e?.warrior?.tauntBonus ?? 0);
    const threatPct  = Number(caster?.flags?.eq5e?.warrior?.threatPct ?? 0);
    const flatThreat = Math.max(0, Math.round((baseThreat + tauntBonus) * (1 + Math.max(0, threatPct))));

    if (String(sp?.spellId ?? "") === "war.abil.area-taunt") {
      const radiusFt = Number(sp?.rangeFt ?? sp?.meta?.range ?? 10);
      const casterTok = caster?.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null;
      const toks = _getHostileTokensWithinFt(casterTok, radiusFt);
      const targets = toks.map(t => ({ npcActor: t.actor }));

      if (targets.length) {
        await applyTauntBatchSafe({ targets, taunterActor: taunter, durationRounds, flatThreat, snapPct: Number(sp?.meta?.snapPct ?? 1.0), reason: `taunt:${item.name}` });
      }
      return { ok: true, taunt: true, area: true, count: targets.length };
    }

    if (target) {
      await applyTauntSafe({ npcActor: target, taunterActor: taunter, durationRounds, flatThreat, snapPct: Number(sp?.meta?.snapPct ?? 1.0), reason: `taunt:${item.name}` });
      return { ok: true, taunt: true };
    }
  }

// Taunt: explicit threat focus from spell meta
  if (sp?.meta?.taunt) {
    const dur = Number(sp.meta.taunt.durationRounds ?? 1);
    await applyTaunt({ npcActor: target, taunterActor: caster, durationRounds: dur });
    const flat = Number(sp.meta.taunt.flatThreat ?? 0);
    if (flat) await addThreat({ npcActor: target, actor: caster, amount: flat, reason: `taunt:${item.name}` });
  }


// Wild Shape (deterministic, Active Effect-based)
if (sp?.meta?.wildshape) {
  const ws = sp.meta.wildshape;
  // Dismiss current form
  if (ws.dismiss) {
    const effects = caster.effects?.filter(e => e?.getFlag("eq5e","wildshape") === true) ?? [];
    for (const ef of effects) await ef.delete();
    await caster.unsetFlag("eq5e", "druid.wildshape.form");
  } else {
    // remove existing wildshape AEs
    const effects = caster.effects?.filter(e => e?.getFlag("eq5e","wildshape") === true) ?? [];
    for (const ef of effects) await ef.delete();

    const duration = Number(ws.durationRounds ?? 5);
    const changes = Array.isArray(ws.changes) ? ws.changes : [];
    const ae = {
      label: `Wild Shape: ${ws.form ?? "Form"}`,
      icon: item.img,
      origin: item.uuid,
      disabled: false,
      duration: { rounds: duration, startRound: game.combat?.round ?? 0, startTime: game.time.worldTime },
      changes
    };
    const created = await caster.createEmbeddedDocuments("ActiveEffect", [ae]);
    if (created?.[0]) await created[0].setFlag("eq5e","wildshape", true);

    // Apply AA mastery as simple bonus by form (no mechanical randomness)
    const mastery = Number(caster.flags?.eq5e?.druid?.wildshapeMastery ?? 0);
    if (mastery && String(ws.form ?? "").toLowerCase() === "bear") {
      await caster.setFlag("eq5e","mitigation.physical", Number(caster.flags?.eq5e?.mitigation?.physical ?? 0) + mastery);
    }
  }
}

// Summons: if a spell declares meta.summon, spawn a pet from a compendium
// sp.meta.summon = { pack, name, tokenName?, ai?, summonId?, durationRounds?, abilitiesPack?, summonType? }
if (sp?.meta?.summon && casterToken) {
  const summon = {
    ...(sp.meta.summon ?? {}),
    summonId: _summonDecl?.summonId ?? sp.spellId ?? item.id,
    tokenName: _summonDecl?.tokenName ?? (_summonDecl?.name ?? null)
  };
  const res = await summonPetFromCompendium({ caster, casterToken, summon, ownerUuid: caster.uuid });
  return { ok: true, summoned: true, result: res };
}


  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }),
    content: `<b>${caster.name}</b> casts <b>${item.name}</b> on <b>${target.name}</b>.`
  });


// Deterministic caster modifiers (from AAs / class flags)
const healFlatBonus = Number(caster.flags?.eq5e?.druid?.healBonus ?? 0);
const spellDamagePct = Number(caster.flags?.eq5e?.druid?.spellDamagePct ?? 0) + Number(caster.flags?.eq5e?.combat?.spellDamagePct ?? 0);
const petSpellDamagePct = Number(caster.flags?.eq5e?.petDamagePctBonus ?? 0);

  const dmgParts = [];
  for (const d of (sp.damage ?? [])) {
    const r = await (new Roll(String(d.formula ?? "1d4"))).evaluate();
    await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: caster, token: casterToken }), flavor: `${item.name} damage (${d.type ?? "spell"})` + ((amt !== base) ? ` [mod ${amt>=base?'+':''}${amt-base}]` : '') });

const base = Number(r.total ?? 0);
const dtype = String(d.type ?? "magic").toLowerCase();
const isHealing = dtype === "healing" || String(sp.kind ?? "").toLowerCase() === "heal";

// Apply flat healing bonus and % spell damage bonus deterministically
let amt = base;
if (isHealing && healFlatBonus) amt = amt + healFlatBonus;

// Monk: Mend heal scaling via Improved Mend AA (percentage increase)
if (isHealing && sp?.spellId === "mnk.abil.mend") {
  try {
    const mods = computeMonkAAMods(caster);
    const pct = Math.max(0, Number(mods.mendHealPct ?? 0));
    if (pct > 0) amt = Math.round(amt * (1 + pct));
  } catch (e) {}
}

if (!isHealing) {
let pct = (spellDamagePct ? (1 + spellDamagePct) : 1) * (petSpellDamagePct ? (1 + petSpellDamagePct) : 1);

// Shadowknight Harm Touch scaling: apply transient pct boost for HT spells (deterministic)
try {
  const htPct = Number(caster?.flags?.eq5e?.shadowknight?._harmTouchPct ?? 0);
  if (htPct) pct = pct * (1 + Math.max(0, htPct));
} catch (e) {}


// Wizard global + elemental scaling
pct = pct * (wizSpellDamagePct ? (1 + wizSpellDamagePct) : 1);

const dtype = String(d.type ?? "magic").toLowerCase();
if (dtype === "fire") pct = pct * (wizFirePct ? (1 + wizFirePct) : 1);
if (dtype === "cold") pct = pct * (wizColdPct ? (1 + wizColdPct) : 1);

// Rain tick scaling
const isTick = String(d.category ?? "").toLowerCase() === "tick";
if (isTick && wizRainTickPct) pct = pct * (1 + wizRainTickPct);

amt = Math.round(amt * pct);
}
amt = Math.max(0, amt);

dmgParts.push({ amount: amt, type: d.type ?? "magic", category: d.category ?? "spell", _base: base, _mod: amt - base });
  }
  if (dmgParts.length) {
    const packet = {
            sourceActorUuid: caster.uuid,
      targetActorUuid: target.uuid,
      parts: dmgParts,
      tags: ["spell", sp.kind ?? "utility"],
meta: {
  itemUuid: item.uuid,
  partialResist: (() => {
    const base = Number(sp?.meta?.partialResist ?? 0);
    const bonus = Number(caster.flags?.eq5e?.wizard?.lurePartialResistBonus ?? 0);
    return Math.max(0, Math.min(0.95, base + bonus));
  })(),
  rain: !!sp?.meta?.rain,
  manaburn: !!sp?.meta?.manaburn,
  lifetapPct: Number(sp?.meta?.lifetapPct ?? 0),
  spellId: String(sp?.spellId ?? "")

}
    };
    await applyDamage({ packet, options: { applyDamage: true, showChat: true } });
  }


if (sp.conditions?.length) {
  // Enchanter AAs can modify control durations + break chances deterministically.

const mezDurationPct = Number(caster?.flags?.eq5e?.enchanter?.mezDurationPct ?? 0) + Number(caster?.flags?.eq5e?.bard?.mezDurationPct ?? 0);
const charmDurationPct = Number(caster?.flags?.eq5e?.enchanter?.charmDurationPct ?? 0);
const rootDurationPct = Number(caster?.flags?.eq5e?.druid?.rootDurationPct ?? 0);
const snareDurationPct = Number(caster?.flags?.eq5e?.druid?.snareDurationPct ?? 0);

  const mezBonus = Number(caster?.flags?.eq5e?.enchanter?.mezBonusRounds ?? 0);
  const mezBreakRed = Number(caster?.flags?.eq5e?.enchanter?.mezBreakChanceRed ?? 0);   // e.g. 0.05 = -5%
  const charmBreakRed = Number(caster?.flags?.eq5e?.enchanter?.charmBreakChanceRed ?? 0);

  for (const c of sp.conditions) {
    const dur = foundry.utils.duplicate(c.duration ?? null);

// Deterministic duration scaling by condition type (from AAs/class flags)
if (dur?.rounds !== undefined && dur?.rounds !== null) {
  const baseRounds = Number(dur.rounds);
  const cid = String(c.id ?? "").toLowerCase();
  let pct = 0;
  if (cid === "mezzed") pct = mezDurationPct;
  if (cid === "charmed") pct = charmDurationPct;
  if (cid === "rooted") pct = rootDurationPct;
  if (cid === "snared") pct = snareDurationPct;

  if (pct) dur.rounds = Math.max(0, Math.ceil(baseRounds * (1 + pct)));
// Monk: Feign Death should drop threat from NPCs immediately (GM-authoritative in multiplayer).
if (sp.conditions?.some(c => String(c?.id ?? "") === "feignDeath")) {
  const fdDur = sp.conditions.find(c => String(c?.id ?? "") === "feignDeath")?.duration?.rounds ?? 1;
  await requestFeignDeathAttempt({ actor: target, durationRounds: Number(fdDur ?? 1) });
}


}

    const meta = foundry.utils.duplicate(c.meta ?? null) ?? {};

// Shadowknight condition scaling from AAs (deterministic)
try {
  const sid = String(sp?.spellId ?? "");
  if (sid.startsWith("sk.")) {
    const mods = computeShadowknightAAMods(caster);
    const cid = String(c.id ?? "").toLowerCase();

    // Disease vulnerability (Mark of Decay) scales
    if (cid === "decaymark" && meta?.damageTakenPctAdj !== undefined) {
      meta.damageTakenPctAdj = Number(meta.damageTakenPctAdj) + Math.max(0, mods.decayAdj);
    }

    // Disease resist debuffs scale (if condition meta uses resistPctAdj)
    if ((cid === "diseasevuln" || cid.includes("disease")) && meta?.resistPctAdj !== undefined) {
      meta.resistPctAdj = Number(meta.resistPctAdj) - Math.max(0, mods.diseaseCurseAdj);
    }

    // Mortal Coil duration bonus at mastery 3
    if (cid === "mortalcoil" && dur?.rounds !== undefined && dur?.rounds !== null) {
      dur.rounds = Math.max(0, Number(dur.rounds) + Math.max(0, mods.coilDurBonus));
    }

    // Mortal Coil ward bonus: increase addWard amount on the spell meta
    if (cid === "mortalcoil" && sp?.meta?.addWard?.amount) {
      sp.meta.addWard.amount = Number(sp.meta.addWard.amount) + Math.max(0, mods.coilWardBonus);
    }
  }
} catch (e) {}


    if (c.id === "mezzed") {
      if (dur?.rounds !== undefined && dur?.rounds !== null) dur.rounds = Math.max(0, Number(dur.rounds) + mezBonus);
      if (meta?.breakChance !== undefined) meta.breakChance = clamp(Number(meta.breakChance) - mezBreakRed, 0, 1);
    }

    if (c.id === "charmed") {
      if (meta?.breakChance !== undefined) meta.breakChance = clamp(Number(meta.breakChance) - charmBreakRed, 0, 1);
    }

    await setCondition({
      actor: target,
      conditionId: c.id,
      active: true,
      sourceUuid: caster.uuid,
      duration: dur,
      meta
    });
  }
}

// Optional: add a ward (absorption shield) from spell meta
try {
  const addWard = sp?.meta?.addWard ?? null;
  if (addWard?.amount && target?.uuid) {
    const wards = Array.isArray(target.flags?.eq5e?.wards) ? foundry.utils.duplicate(target.flags.eq5e.wards) : [];
    wards.push({
      id: randomID(),
      name: String(spellName ?? "Ward"),
      remaining: Math.max(0, Math.floor(Number(addWard.amount))),
      types: Array.isArray(addWard.types) ? addWard.types : ["all"],
      priority: Number(addWard.priority ?? 0),
      sourceUuid: caster.uuid
    });
    if (game.user.isGM) await target.setFlag("eq5e", "wards", wards);
    else game.socket?.emit("system.eq5e", { type: "eq5e.setWards", userId: game.user.id, actorUuid: target.uuid, wards });
  }
} catch (e) {}

// Utility placeholder: Summon Corpse
try {
  if (sp?.meta?.summonCorpse) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: caster }),
      content: `<b>Summon Corpse</b>: Request sent. (Placeholder) GM can move your corpse token to you.`
    });
  }
} catch (e) {}



// Charm: deterministic charm control (GM-authoritative). sp.meta.charm = { durationRounds, summonId? }
if (sp?.meta?.charm && casterToken) {
  const dur = Number(sp.meta.charm.durationRounds ?? 3);
  const sid = sp.meta.charm.summonId ?? "enchanter.charm";
  await applyCharmToTarget({ caster, casterToken, targetActor: target, targetToken, durationRounds: dur, summonId: sid });
}


// Active Effect: deterministic AE application from spell metadata (for haste/slow/clarity/tash, etc.)
// sp.meta.activeEffect = { label, durationRounds, changes:[{key,mode,value}] }
if (sp?.meta?.activeEffect) {
  const ae = sp.meta.activeEffect;
  const dur = Number(ae.durationRounds ?? 0);
  const rounds = Number.isFinite(dur) ? dur : 0;
  const changes = Array.isArray(ae.changes) ? ae.changes : [];

  const effectData = {
    label: String(ae.label ?? item.name ?? "Effect"),
    icon: item.img,
    origin: item.uuid,
    disabled: false,
    duration: rounds ? { rounds } : {},
    changes: changes.map(c => ({
      key: String(c.key),
      mode: Number(c.mode ?? CONST.ACTIVE_EFFECT_MODES.ADD),
      value: String(c.value ?? ""),
      priority: Number(c.priority ?? 20)
    })),
    flags: {
      eq5e: {
        fromSpellId: sp.spellId ?? null
      }
    }
  };

  await target.createEmbeddedDocuments("ActiveEffect", [effectData]);
}



// Song twisting support: maintained songs tracked on the caster (twist slots + overwrite rules)
if (sp?.meta?.isSong) {
  const tgtUuid = target?.uuid ?? null;
  try {
    await registerMaintainedSong({ caster, spell: sp, targetUuid: tgtUuid });
  } catch (e) {
    console.warn("[EQ5E] registerMaintainedSong failed", e);
  }
}

  return { ok: true };
}


/* ------------------------------ SUMMONING --------------------------------- */

function _gridSnap(x, y) {
  const size = canvas.grid.size;
  const sx = Math.round(x / size) * size;
  const sy = Math.round(y / size) * size;
  return { x: sx, y: sy };
}

function _tokenBlocksSpace(token, x, y) {
  // MVP occupancy check: exact top-left grid cell
  const tx = token.document.x;
  const ty = token.document.y;
  return tx === x && ty === y;
}

function findNearestFreeTokenPosition({ originToken, maxRadiusSquares = 3, avoidTokenIds = [] }) {
  const size = canvas.grid.size;
  const ox = originToken.document.x;
  const oy = originToken.document.y;

  const tokens = canvas.tokens?.placeables ?? [];
  const avoid = new Set(avoidTokenIds ?? []);

  const isFree = (x, y) => {
    // Within scene bounds
    const sceneW = canvas.scene.width;
    const sceneH = canvas.scene.height;
    if (x < 0 || y < 0 || x >= sceneW || y >= sceneH) return false;

    for (const t of tokens) {
      if (!t?.document) continue;
      if (avoid.has(t.id)) continue;
      if (_tokenBlocksSpace(t, x, y)) return false;
    }
    return true;
  };

  // Search rings around origin in deterministic order (clockwise-ish)
  for (let r = 1; r <= maxRadiusSquares; r++) {
    // Top row (left->right)
    for (let dx = -r; dx <= r; dx++) {
      const x = ox + dx * size;
      const y = oy - r * size;
      if (isFree(x, y)) return { x, y };
    }
    // Right col (top->bottom)
    for (let dy = -r + 1; dy <= r; dy++) {
      const x = ox + r * size;
      const y = oy + dy * size;
      if (isFree(x, y)) return { x, y };
    }
    // Bottom row (right->left)
    for (let dx = r - 1; dx >= -r; dx--) {
      const x = ox + dx * size;
      const y = oy + r * size;
      if (isFree(x, y)) return { x, y };
    }
    // Left col (bottom->top)
    for (let dy = r - 1; dy >= -r + 1; dy--) {
      const x = ox - r * size;
      const y = oy + dy * size;
      if (isFree(x, y)) return { x, y };
    }
  }

  // Fallback: original + one square right
  return { x: ox + size, y: oy };
}

function findActiveSummonedPetActor({ ownerUuid, summonId }) {
  const actors = game.actors?.contents ?? [];
  return actors.find(a =>
    a?.flags?.eq5e?.summon?.active === true &&
    a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid &&
    a?.flags?.eq5e?.summon?.summonId === summonId
  ) ?? null;
}


async function updatePetConfig({ ownerUuid, petUuid=null, summonId=null, summonType=null, changes={} } = {}) {
  try {
    if (!ownerUuid) return { ok: false, reason: "missing-owner" };

    // GM can apply directly
    if (game.user.isGM) {
      let petActor = petUuid ? await fromUuid(petUuid) : null;
      if (!petActor || petActor.documentName !== "Actor") {
        petActor = findActiveSummonForOwner({ ownerUuid, summonId, summonType });
      }
      if (!petActor) return { ok: false, reason: "pet-not-found" };
      // Apply via socket handler logic by simulating allowed patch
      const allow = new Set(["ai.enabled","ai.mode","ai.stance","ai.followDistance","ai.autoTaunt","ai.rotationProfile","pet.nickname",
    "pet.guardSnapEnabled",
    "pet.guardSnapCooldownRounds","pet.guardSnapEnabled","pet.guardSnapCooldownRounds"]);
      const patch = {};
      for (const [k,v] of Object.entries(changes ?? {})) {
        if (!allow.has(k)) continue;
        if (k.startsWith("ai.")) patch[`flags.eq5e.ai.${k.slice(3)}`] = v;
        if (k.startsWith("pet.")) patch[`flags.eq5e.pet.${k.slice(4)}`] = v;
      }
      if (Object.keys(patch).length) await petActor.update(patch);
      return { ok: true };
    }

    // Non-GM: request GM to apply
    game.socket.emit("system.eq5e", {
      type: "eq5e.updatePetConfig",
      userId: game.user.id,
      ownerUuid,
      petUuid,
      summonId,
      summonType,
      changes
    });
    return { ok: true, requested: true };
  } catch (e) {
    console.error("[EQ5E] updatePetConfig error", e);
    return { ok: false, reason: "error" };
  }
}



async function charmTarget({ casterUuid, targetTokenUuid, durationRounds=3, summonId="enchanter.charm" } = {}) {
  try {
    if (!casterUuid || !targetTokenUuid) return { ok: false, reason: "missing-args" };
    const caster = await fromUuid(casterUuid);
    const tokenDoc = await fromUuid(targetTokenUuid);
    const targetToken = tokenDoc?.object ?? null;
    const targetActor = targetToken?.actor ?? null;
    if (!caster || !targetToken || !targetActor) return { ok: false, reason: "bad-uuids" };

    return applyCharmToTarget({ caster, casterToken: caster.getActiveTokens(true)?.[0] ?? null, targetActor, targetToken, durationRounds, summonId });
  } catch (e) {
    console.error("[EQ5E] charmTarget error", e);
    return { ok: false, reason: "error" };
  }
}

async function swapSummonVariant({ ownerUuid, summonId, summonType=null, pack, name, tokenName=null, abilitiesPack=null, ai=null } = {}) {
  try {
    if (!ownerUuid) return { ok: false, reason: "missing-owner" };
    if (!summonId) return { ok: false, reason: "missing-summonId" };
    if (!pack || !name) return { ok: false, reason: "missing-pack-or-name" };

    // GM can do it immediately; non-GM requests GM via socket
    if (game.user.isGM) {
      const owner = await fromUuid(ownerUuid);
      if (!owner) return { ok: false, reason: "owner-not-found" };
      const ownerTokens = owner.getActiveTokens(true);
      const casterToken = ownerTokens?.[0] ?? null;
      if (!casterToken) return { ok: false, reason: "no-owner-token" };

      await dismissSummonedPet({ ownerUuid, summonId, reason: "swap" });
      await summonPetFromCompendium({ ownerActor: owner, casterToken, pack, name, tokenName: tokenName ?? name, summonId, summonType, abilitiesPack, ai: ai ?? { enabled: true, mode: "assist" } });
      return { ok: true };
    }

    game.socket.emit("system.eq5e", {
      type: "eq5e.swapSummonVariant",
      userId: game.user.id,
      ownerUuid,
      summonId,
      summonType,
      pack,
      name,
      tokenName,
      abilitiesPack,
      ai
    });
    return { ok: true, requested: true };
  } catch (e) {
    console.error("[EQ5E] swapSummonVariant error", e);
    return { ok: false, reason: "error" };
  }
}


async function applyRangerCompanionBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    const cls = String(owner.flags?.eq5e?.class?.id ?? owner.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls !== "ranger") return;

    const hpBonus = Number(owner.flags?.eq5e?.ranger?.companionHpBonus ?? 0);
    const dmgPct = Number(owner.flags?.eq5e?.ranger?.companionDamagePct ?? 0);

    // HP scaling: increase max and value by flat bonus
    if (hpBonus) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpBonus;
      const val = Number(hp.value ?? 0) + hpBonus;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }

    // Damage scaling: store on pet flag so performAttack/spell damage can reference later if desired.
    if (dmgPct) await petActor.setFlag("eq5e", "petDamagePctBonus", dmgPct);
  } catch (e) { console.error("[EQ5E] applyRangerCompanionBonuses failed", e); }
}


async function renamePet({ ownerUuid, petUuid=null, summonId=null, summonType=null, newName } = {}) {
  try {
    if (!ownerUuid) return { ok: false, reason: "missing-owner" };
    const nm = String(newName ?? "").trim();
    if (!nm) return { ok: false, reason: "empty-name" };

    if (game.user.isGM) {
      let petActor = petUuid ? await fromUuid(petUuid) : null;
      if (!petActor || petActor.documentName !== "Actor") {
        petActor = findActiveSummonForOwner({ ownerUuid, summonId, summonType });
      }
      if (!petActor) return { ok: false, reason: "pet-not-found" };
      await petActor.update({ name: nm });
      return { ok: true };
    }

    game.socket.emit("system.eq5e", {
      type: "eq5e.renamePet",
      userId: game.user.id,
      ownerUuid,
      petUuid,
      summonId,
      summonType,
      newName: nm
    });
    return { ok: true, requested: true };
  } catch (e) {
    console.error("[EQ5E] renamePet error", e);
    return { ok: false, reason: "error" };
  }
}

async function dismissSummonedPet({ ownerUuid, summonId, reason="dismissed" }) {
  // If GM: execute directly. If not GM: request GM via socket (requires OWNER on the caster actor).
  if (!summonId || !ownerUuid) return { ok: false, reason: "missing-args" };

  if (!game.user.isGM) {
    // Non-GM: emit request. GM will validate OWNER permission on the caster actor.
    game.socket.emit("system.eq5e", {
      type: "eq5e.dismissSummon",
      userId: game.user.id,
      casterUuid: ownerUuid,
      summonId
    });
    ui.notifications?.info("Dismiss request sent to GM.");
    return { ok: true, requested: true };
  }

  const actor = findActiveSummonedPetActor({ ownerUuid, summonId });
  if (!actor) return { ok: false, reason: "no-active-summon" };
  return despawnSummonedPet({ actor, reason });
}

async function applyDruidCompanionBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    const cls = String(owner.flags?.eq5e?.class?.id ?? owner.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls !== "druid") return;

    const hpBonus = Number(owner.flags?.eq5e?.druid?.companionHpBonus ?? 0);
    const dmgPct = Number(owner.flags?.eq5e?.druid?.companionDamagePct ?? 0);

    if (hpBonus) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpBonus;
      const val = Number(hp.value ?? 0) + hpBonus;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }
    if (dmgPct) await petActor.setFlag("eq5e", "petDamagePctBonus", dmgPct);
  } catch (e) { console.error("[EQ5E] applyDruidCompanionBonuses failed", e); }
}

async function applyMagicianElementalBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    const cls = String(owner.flags?.eq5e?.class?.id ?? owner.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls !== "magician") return;

    const hpBonus = Number(owner.flags?.eq5e?.magician?.petHpBonus ?? 0);
    const dmgPct = Number(owner.flags?.eq5e?.magician?.petDamagePct ?? 0);
    const threatMult = Number(owner.flags?.eq5e?.magician?.petThreatMult ?? 0);

    if (hpBonus) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpBonus;
      const val = Number(hp.value ?? 0) + hpBonus;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }
    if (dmgPct) await petActor.setFlag("eq5e", "petDamagePctBonus", (Number(petActor.getFlag("eq5e","petDamagePctBonus") ?? 0) + dmgPct));
    if (threatMult) await petActor.setFlag("eq5e", "petThreatMultBonus", (Number(petActor.getFlag("eq5e","petThreatMultBonus") ?? 0) + threatMult));
  } catch (e) { console.error("[EQ5E] applyMagicianElementalBonuses failed", e); }
}

async function applyShamanSpiritBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    const cls = String(owner.flags?.eq5e?.class?.id ?? owner.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls !== "shaman") return;

    const hpBonus = Number(owner.flags?.eq5e?.shaman?.petHpBonus ?? 0);
    const dmgPct = Number(owner.flags?.eq5e?.shaman?.petDamagePct ?? 0);
    const threatMult = Number(owner.flags?.eq5e?.shaman?.petThreatMult ?? 0);

    if (hpBonus) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpBonus;
      const val = Number(hp.value ?? 0) + hpBonus;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }
    if (dmgPct) await petActor.setFlag("eq5e", "petDamagePctBonus", (Number(petActor.getFlag("eq5e","petDamagePctBonus") ?? 0) + dmgPct));
    if (threatMult) await petActor.setFlag("eq5e", "petThreatMultBonus", (Number(petActor.getFlag("eq5e","petThreatMultBonus") ?? 0) + threatMult));

    // Shaman AA: Spirit of the Ancients upgrades to tier 2 pet if available (only if pet supports it)
        const hasUpgrade = !!(owner.items?.some(i => i?.flags?.eq5e?.aa?.aaId === "aa.sha.spirit-ancients" && Number(i?.flags?.eq5e?.aa?.rank ?? 0) > 0));
    if (hasUpgrade) await petActor.setFlag("eq5e","petTierUnlocked", 2).catch(()=>{});

  } catch (e) { console.error("[EQ5E] applyShamanSpiritBonuses failed", e); }
}


function getOwnerPetEquipment(ownerActor) {
  try {
    const items = ownerActor?.items?.contents ?? [];
    return items
      .map(i => ({ item: i, data: i.getFlag("eq5e","petEquipment") }))
      .filter(x => x.data && x.data.enabled !== false);
  } catch { return []; }
}

async function applyOwnerPetEquipment({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    const eq = getOwnerPetEquipment(owner);
    if (!eq.length) return;

    // Enforce slots: only one equipment per slot (focus/weapon/armor/utility)
    const slots = {};
    for (const { item, data } of eq) {
      const slot = String(data?.slot ?? "focus");
      if (!slots[slot]) slots[slot] = { item, data };
    }
    const chosen = Object.values(slots);

    // Aggregate bonuses; attach a copy of the chosen equipment items to pet for visibility
    let hpFlat = 0;
    let acFlat = 0;
    let dmgPct = 0;
    let threatMult = 0;
    let allowSpells = null;
    let rotation = null;

    const toCreate = [];
    for (const { item, data } of chosen) {
      const b = data?.bonuses ?? {};
      hpFlat += Number(b.hpFlat ?? 0);
      acFlat += Number(b.acFlat ?? 0);
      dmgPct += Number(b.dmgPct ?? 0);
      threatMult += Number(b.threatMult ?? 0);
      if (typeof b.allowSpells === "boolean") allowSpells = b.allowSpells;
      if (typeof b.rotation === "string") rotation = b.rotation;

      const obj = item.toObject();
      obj.flags = obj.flags ?? {};
      obj.flags.eq5e = obj.flags.eq5e ?? {};
      obj.flags.eq5e.petEquipmentChild = true;
      toCreate.push(obj);
    }

    // Remove old equipment children, then attach current chosen set
    const existing = (petActor.items?.contents ?? []).filter(i => i.getFlag("eq5e","petEquipmentChild"));
    if (existing.length) {
      await petActor.deleteEmbeddedDocuments("Item", existing.map(i => i.id));
    }
    if (toCreate.length) {
      await petActor.createEmbeddedDocuments("Item", toCreate);
    }

    // Persist the slot map on the pet for GM visibility/HUD usage
    await petActor.setFlag("eq5e", "petEquipmentSlots", Object.fromEntries(
      chosen.map(({ item, data }) => [String(data?.slot ?? "focus"), { name: item.name, sourceId: item.uuid }])
    )).catch(()=>{});

    // Apply stats
    if (hpFlat) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpFlat;
      const val = Number(hp.value ?? 0) + hpFlat;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }
    if (acFlat) {
      const ac = Number(petActor.system?.attributes?.ac?.value ?? 0) + acFlat;
      await petActor.update({ "system.attributes.ac.value": ac });
    }
    if (dmgPct) await petActor.setFlag("eq5e", "petDamagePctBonus", (Number(petActor.getFlag("eq5e","petDamagePctBonus") ?? 0) + dmgPct));
    if (threatMult) await petActor.setFlag("eq5e", "petThreatMultBonus", (Number(petActor.getFlag("eq5e","petThreatMultBonus") ?? 0) + threatMult));

    // Enable pet spellcasting if equipment grants it
    if (allowSpells != null) {
      await petActor.setFlag("eq5e", "petAllowSpells", allowSpells);
      await petActor.setFlag("eq5e", "ai", foundry.utils.mergeObject(petActor.getFlag("eq5e","ai") ?? {}, { allowSpells })).catch(()=>{});
    }
    if (rotation) {
      await petActor.setFlag("eq5e", "petSpellRotation", rotation);
      await petActor.setFlag("eq5e", "ai", foundry.utils.mergeObject(petActor.getFlag("eq5e","ai") ?? {}, { rotationId: rotation })).catch(()=>{});
    }

  } catch (e) { console.error("[EQ5E] applyOwnerPetEquipment failed", e); }
}


async function applyWizardFamiliarBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;
    // Only apply to familiars
    const petType = String(petActor.system?.details?.type ?? petActor.flags?.eq5e?.pet?.type ?? "");
    if (petType.toLowerCase() !== "familiar") return;

    const hpBonus = Number(owner.flags?.eq5e?.wizard?.familiarHpBonus ?? 0);
    const wardBonus = Number(owner.flags?.eq5e?.wizard?.familiarWardingBonus ?? 0);
    if (hpBonus) {
      const hp = foundry.utils.duplicate(petActor.system?.attributes?.hp ?? {});
      const max = Number(hp.max ?? 0) + hpBonus;
      const val = Number(hp.value ?? 0) + hpBonus;
      await petActor.update({ "system.attributes.hp.max": max, "system.attributes.hp.value": val });
    }
    if (wardBonus) {
      const cur = Number(petActor.flags?.eq5e?.warding?.physical ?? 0);
      await petActor.setFlag("eq5e", "warding.physical", cur + wardBonus);
    }
  } catch (e) { console.error("[EQ5E] applyWizardFamiliarBonuses failed", e); }
}

async function applyOwnerPetDefensiveBonuses({ owner, petActor }) {
  try {
    if (!owner || !petActor) return;

    const mods = getOwnerAggroMods(owner);
    const hpBonus = Number(mods?.petHpBonus ?? 0);
    const mitBonus = Number(mods?.petMitigationBonus ?? 0);
    const wardBonus = Number(mods?.petWardingBonus ?? 0);

    // --- HP bonus ---
    if (hpBonus) {
      // Support either system.attributes.hp or system.hp
      const hasAttrHp = !!petActor.system?.attributes?.hp;
      const hasSysHp  = !!petActor.system?.hp;

      const basePath = hasAttrHp ? "system.attributes.hp" : (hasSysHp ? "system.hp" : null);
      const hpObj = basePath ? foundry.utils.duplicate(foundry.utils.getProperty(petActor, basePath)) : null;

      if (hpObj && (hpObj.max != null || hpObj.value != null)) {
        const curMax = Number(hpObj.max ?? 0);
        const curVal = Number(hpObj.value ?? curMax);

        // If hpBonus looks like a percent (e.g., 0.10 = +10%), apply as multiplier.
        // Otherwise treat as a flat bonus.
        const add = Math.abs(hpBonus) <= 1.5 ? Math.round(curMax * hpBonus) : Math.round(hpBonus);
        const newMax = Math.max(1, curMax + add);

        // Preserve current percentage filled.
        const pct = curMax > 0 ? (curVal / curMax) : 1;
        const newVal = Math.max(0, Math.min(newMax, Math.round(newMax * pct)));

        const update = {};
        update[`${basePath}.max`] = newMax;
        update[`${basePath}.value`] = newVal;
        await petActor.update(update, { render: false });
      }
    }

    // --- Mitigation bonus (stored as flags to be read in your damage pipeline) ---
    if (mitBonus) {
      const cur = Number(petActor.flags?.eq5e?.mitigation?.physical ?? 0);
      await petActor.setFlag("eq5e", "mitigation.physical", cur + mitBonus);
    }

    // --- Warding bonus (stored as flags to be read in your warding pipeline) ---
    if (wardBonus) {
      const cur = Number(petActor.flags?.eq5e?.warding?.physical ?? 0);
      await petActor.setFlag("eq5e", "warding.physical", cur + wardBonus);
    }
  } catch (e) {
    console.error("[EQ5E] applyOwnerPetDefensiveBonuses failed", e);
  }
}

function hasPurchasedAA(actor, aaId) {
  try {
    if (!actor || !aaId) return false;
    return actor.items?.some(i =>
      i?.flags?.eq5e?.aa?.aaId === aaId &&
      Number(i?.flags?.eq5e?.aa?.rank ?? 0) > 0
    ) ?? false;
  } catch (e) {
    return false;
  }
}

async function summonPetFromCompendium({ caster, casterToken, summon, ownerUuid=null }) {
  // summon = { pack: "world.eq5e-sk-necrotic-pets", name, tokenName, role, ai, summonId, durationRounds, abilitiesPack, abilitiesQuery }
  if (!game.user.isGM) {
    // Non-GM: request GM to summon (requires OWNER on caster actor)
    game.socket.emit("system.eq5e", {
      type: "eq5e.summonPet",
      userId: game.user.id,
      casterUuid: (ownerUuid ?? caster.uuid),
      summonData: summon
    });
    ui.notifications?.info("Summon request sent to GM.");
    return { ok: true, requested: true };
  }
  if (!casterToken) return { ok: false, reason: "missing-caster-token" };

  let summonId = String(summon?.summonId ?? summon?.name ?? "summon");

  // Shaman: Spirit of the Ancients auto-upgrades Lesser -> Greater on summon
  try {
    if ((summonId === "sha.spirit.lesser" || String(summon?.name ?? "").includes("Lesser")) && hasPurchasedAA(caster, "aa.sha.spirit-ancients")) {
      summonId = "sha.spirit.greater";
      summon = foundry.utils.duplicate(summon);
      summon.summonId = summonId;
      summon.name = "Spirit Companion (Greater)";
    }
  } catch (e) {}

  const durationRounds = summon?.durationRounds != null ? Number(summon.durationRounds) : null;

  // 1) Reuse existing summoned pet for this caster + summonId
  const existingActor = game.actors?.contents?.find(a =>
    a?.flags?.eq5e?.summon?.summonId === summonId &&
    a?.flags?.eq5e?.summon?.ownerUuid === (ownerUuid ?? caster.uuid) &&
    a?.flags?.eq5e?.summon?.active === true
  ) ?? null;

  let petActor = existingActor;

  // If "only one" rule: despawn other active summons with same summonId for this owner (shouldn't happen, but enforce)
  for (const a of (game.actors?.contents ?? [])) {
    if (a?.id === existingActor?.id) continue;
    if (a?.flags?.eq5e?.summon?.summonId !== summonId) continue;
    if (a?.flags?.eq5e?.summon?.ownerUuid !== (ownerUuid ?? caster.uuid)) continue;
    if (a?.flags?.eq5e?.summon?.active !== true) continue;
    await despawnSummonedPet({ actor: a, reason: "replaced" });
  }

  if (!petActor) {
    // 2) Create from compendium actor template
    const packKey = String(summon?.pack ?? "");
    const entryName = String(summon?.name ?? "");
    if (!packKey || !entryName) return { ok: false, reason: "missing-pack-or-name" };

    const pack = game.packs?.get(packKey);
    if (!pack) return { ok: false, reason: "pack-not-found", packKey };

    const docs = await pack.getDocuments();
    const actorDoc = docs.find(d => (d.name ?? "") === entryName);
    if (!actorDoc) return { ok: false, reason: "actor-not-found", entryName };

    petActor = await Actor.create(actorDoc.toObject(), { renderSheet: false });

    // Pet + AI flags
    const petFlags = petActor.flags?.eq5e ?? {};
    petFlags.pet = petFlags.pet ?? {};
    petFlags.pet.ownerUuid = ownerUuid ?? caster.uuid;
    petFlags.pet.role = summon?.role ?? petFlags.pet.role ?? "melee";
    petFlags.ai = foundry.utils.mergeObject(petFlags.ai ?? {}, summon?.ai ?? { enabled: true, mode: "assist" }, { inplace: false });

    await petActor.setFlag("eq5e", "pet", petFlags.pet);
    await petActor.setFlag("eq5e", "ai", petFlags.ai);
  }

  // 3) Stamp summon state + expiry
  const combat = game.combat;
  const expires = (combat?.id && durationRounds != null && Number.isFinite(durationRounds) && durationRounds > 0)
    ? { combatId: combat.id, round: (combat.round ?? 0) + Math.max(1, Math.floor(durationRounds)) }
    : null;

  await petActor.setFlag("eq5e", "summon", {
    active: true,
    ownerUuid: ownerUuid ?? caster.uuid,
    summonId,
    expires,
    abilitiesPack: summon?.abilitiesPack ?? null
  });

// 4) Ensure abilities are attached (from a world Item pack) once per actor
if (summon?.abilitiesPack) {
  const already = petActor.getFlag("eq5e", "summonAbilitiesAttached") === true;
  if (!already) {
    const pack = game.packs?.get(String(summon.abilitiesPack));
    if (pack) {
      const docs = await pack.getDocuments();
      // abilitiesQuery: optional substring match, else attach all
      const q = String(summon?.abilitiesQuery ?? "").toLowerCase().trim();
      const chosen = q ? docs.filter(d => String(d.name ?? "").toLowerCase().includes(q)) : docs;
      const items = chosen.map(d => d.toObject());
      if (items.length) await petActor.createEmbeddedDocuments("Item", items);
      await petActor.setFlag("eq5e", "summonAbilitiesAttached", true);
    }
  }
}

// Apply class-specific companion bonuses
await applyRangerCompanionBonuses({ owner: caster, petActor });
await applyDruidCompanionBonuses({ owner: caster, petActor });
await applyMagicianElementalBonuses({ owner: caster, petActor });
await applyShamanSpiritBonuses({ owner: caster, petActor });
await applyOwnerPetEquipment({ owner: caster, petActor });
initPetManaForSpellcasting(petActor);

  // 5) Place or move token near caster (find nearest free square)
  const pos = findNearestFreeTokenPosition({ originToken: casterToken, maxRadiusSquares: 3 });
  const x = pos.x;
  const y = pos.y;
const existingToken = canvas.tokens?.placeables?.find(t => t.actor?.id === petActor.id) ?? null;
  if (existingToken) {
    await existingToken.document.update({ x, y, name: summon?.tokenName ?? existingToken.document.name });
    return { ok: true, actor: petActor, tokenId: existingToken.id, reused: true };
  }

  const tokenData = await petActor.getTokenDocument({
    name: summon?.tokenName ?? petActor.name,
    x, y
  });
  const created = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
  const tokenId = created?.[0]?.id;
  return { ok: true, actor: petActor, tokenId, reused: false };
}

/* ------------------------------ WARDER BOND ------------------------------ */

function _isBeastlordActor(actor) {
  const cls = actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? null;
  if (String(cls).toLowerCase() === "beastlord") return true;
  return !!actor?.items?.find(i => i?.flags?.eq5e?.class?.id === "beastlord" || i?.name?.toLowerCase()?.includes("beastlord"));
}

function _getOwnerActorForPet(petActor) {
  const ownerUuid = petActor?.flags?.eq5e?.summon?.ownerUuid ?? petActor?.flags?.eq5e?.pet?.ownerUuid ?? null;
  if (!ownerUuid) return null;
  return fromUuidSync(ownerUuid);
}

function _computeWarderBond(owner) {
  const lvl = Number(foundry.utils.getProperty(owner, "system.details.level")
    ?? foundry.utils.getProperty(owner, "system.level")
    ?? 1);

  const baseHp = 10 + Math.floor(lvl * 2);
  const baseAtk = Math.floor(lvl / 10);
  const baseDmg = Math.floor(lvl / 15);
  const baseAC  = Math.floor(lvl / 12);

  const aaHpBonus = Number(owner?.flags?.eq5e?.pet?.hpBonus ?? 0);
  const aaAtkBonus = Number(owner?.flags?.eq5e?.pet?.attackBonus ?? 0);
  const aaDmgBonus = Number(owner?.flags?.eq5e?.pet?.damageBonus ?? 0);
  const aaAcBonus  = Number(owner?.flags?.eq5e?.pet?.acBonus ?? 0);

  return {
    hpBonus: baseHp + aaHpBonus,
    attackBonus: baseAtk + aaAtkBonus,
    damageBonus: baseDmg + aaDmgBonus,
    acBonus: baseAC + aaAcBonus
  };
}

async function applyWarderBondIfNeeded(petActor) {
  try {
    if (!petActor) return;
    const owner = _getOwnerActorForPet(petActor);
    if (!owner || !_isBeastlordActor(owner)) return;

    const family = String(petActor?.flags?.eq5e?.pet?.family ?? "").toLowerCase();
    const summonType = String(petActor?.flags?.eq5e?.summon?.summonType ?? "").toLowerCase();
    if (family && family !== "warder" && summonType !== "warder") return;
    if (!family && summonType !== "warder") return;

    const bond = _computeWarderBond(owner);

    await petActor.setFlag("eq5e", "pet", { ...(petActor.flags?.eq5e?.pet ?? {}), family: "warder", bond });

    await petActor.setFlag("eq5e", "combat", { ...(petActor.flags?.eq5e?.combat ?? {}), attackBonus: bond.attackBonus, damageBonus: bond.damageBonus });
    await petActor.setFlag("eq5e", "defense", { ...(petActor.flags?.eq5e?.defense ?? {}), acBonus: bond.acBonus });

    const baseMax = Number(petActor.getFlag("eq5e","baseHpMax") ?? petActor.system?.attributes?.hp?.max ?? 0);
    if (!petActor.getFlag("eq5e","baseHpMax")) await petActor.setFlag("eq5e","baseHpMax", baseMax);

    const newMax = Math.max(1, Math.floor(baseMax + bond.hpBonus));
    const cur = Number(petActor.system?.attributes?.hp?.value ?? newMax);
    await petActor.update({ "system.attributes.hp.max": newMax, "system.attributes.hp.value": Math.min(cur, newMax) });
  } catch (e) {
    console.error("[EQ5E] applyWarderBond failed", e);
  }
}



function findActiveSummonForOwner({ ownerUuid, summonId=null, summonType=null }) {
  const actors = game.actors?.contents ?? [];
  return actors.find(a => a?.flags?.eq5e?.summon?.active === true
    && a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid
    && (summonId ? a?.flags?.eq5e?.summon?.summonId === summonId : true)
    && (summonType ? String(a?.flags?.eq5e?.summon?.summonType ?? "").toLowerCase() === String(summonType).toLowerCase() : true)
  ) ?? null;
}


/* ------------------------------ UNDEAD BOND ------------------------------ */

function _computeUndeadBond(owner, { potencyMult = 1.0 } = {}) {
  const lvl = Number(foundry.utils.getProperty(owner, "system.details.level")
    ?? foundry.utils.getProperty(owner, "system.level")
    ?? 1);

  // Slightly slower scaling than warders (undead are strong but not 'full companion' unless AA'd)
  const baseHp = (8 + Math.floor(lvl * 1.6)) * potencyMult;
  const baseAtk = Math.floor(lvl / 12) * potencyMult;
  const baseDmg = Math.floor(lvl / 18) * potencyMult;
  const baseAC  = Math.floor(lvl / 14) * potencyMult;

  const aaHpBonus = Number(owner?.flags?.eq5e?.pet?.hpBonus ?? 0);
  const aaAtkBonus = Number(owner?.flags?.eq5e?.pet?.attackBonus ?? 0);
  const aaDmgBonus = Number(owner?.flags?.eq5e?.pet?.damageBonus ?? 0);
  const aaAcBonus  = Number(owner?.flags?.eq5e?.pet?.acBonus ?? 0);

  return {
    hpBonus: Math.floor(baseHp + aaHpBonus),
    attackBonus: Math.floor(baseAtk + aaAtkBonus),
    damageBonus: Math.floor(baseDmg + aaDmgBonus),
    acBonus: Math.floor(baseAC + aaAcBonus)
  };
}

async function applyUndeadBondIfNeeded(petActor) {
  try {
    if (!petActor) return;
    const owner = _getOwnerActorForPet(petActor);
    if (!owner) return;

    const summonType = String(petActor?.flags?.eq5e?.summon?.summonType ?? "").toLowerCase();
    const family = String(petActor?.flags?.eq5e?.pet?.family ?? "").toLowerCase();
    if (summonType !== "undead" && summonType !== "necrotic" && family !== "undead" && family !== "necrotic") return;

    // Shadowknight minions are intentionally weaker
    const ownerCls = String(owner?.flags?.eq5e?.class?.id ?? "").toLowerCase();
    const potencyMult = ownerCls === "shadowknight" ? 0.65 : 1.0;

    const bond = _computeUndeadBond(owner, { potencyMult });

    await petActor.setFlag("eq5e", "pet", { ...(petActor.flags?.eq5e?.pet ?? {}), bond });

    await petActor.setFlag("eq5e", "combat", { ...(petActor.flags?.eq5e?.combat ?? {}), attackBonus: bond.attackBonus, damageBonus: bond.damageBonus });
    await petActor.setFlag("eq5e", "defense", { ...(petActor.flags?.eq5e?.defense ?? {}), acBonus: bond.acBonus });

    const baseMax = Number(petActor.getFlag("eq5e","baseHpMax") ?? petActor.system?.attributes?.hp?.max ?? 0);
    if (!petActor.getFlag("eq5e","baseHpMax")) await petActor.setFlag("eq5e","baseHpMax", baseMax);

    const newMax = Math.max(1, Math.floor(baseMax + bond.hpBonus));
    const cur = Number(petActor.system?.attributes?.hp?.value ?? newMax);
    await petActor.update({ "system.attributes.hp.max": newMax, "system.attributes.hp.value": Math.min(cur, newMax) });
  } catch (e) {
    console.error("[EQ5E] applyUndeadBond failed", e);
  }
}

/* -------------------------- BEASTLORD SYNERGY ----------------------------- */

function _setLastTarget(attacker, defender) {
  try {
    if (!attacker || !defender) return;
    attacker.setFlag("eq5e", "combat", { ...(attacker.flags?.eq5e?.combat ?? {}), lastTargetUuid: defender.uuid });
  } catch (e) {}
}

function _beastlordSynergyBonus(attacker, defender) {
  const defUuid = defender?.uuid;
  if (!defUuid) return { attack: 0, damage: 0 };

  const owner = _isBeastlordActor(attacker) ? attacker : _getOwnerActorForPet(attacker);

  // Find active warder for owner among active summons
  let warder = null;
  if (owner) {
    const actors = game.actors?.contents ?? [];
    warder = actors.find(a => a?.flags?.eq5e?.summon?.active === true &&
      a?.flags?.eq5e?.summon?.ownerUuid === owner.uuid &&
      String(a?.flags?.eq5e?.pet?.family ?? a?.flags?.eq5e?.summon?.summonType ?? "") === "warder"
    ) ?? null;
  }
  if (!owner || !warder) return { attack: 0, damage: 0 };

  const ownerLast = owner?.flags?.eq5e?.combat?.lastTargetUuid ?? null;
  const warderLast = warder?.flags?.eq5e?.combat?.lastTargetUuid ?? null;
  if (ownerLast !== defUuid || warderLast !== defUuid) return { attack: 0, damage: 0 };

  return { attack: 0, damage: 1 };
}




async function despawnSummonedPet({ actor, reason="expired" }) {
  if (!game.user.isGM || !actor) return { ok: false, reason: "gm-only-or-missing" };

  const summonType = String(actor?.flags?.eq5e?.summon?.summonType ?? "").toLowerCase();
  if (summonType === "charm") {
    return releaseCharmedActor({ actor, reason });
  }

  // Delete tokens on scene(s) that reference this actor (current scene only for MVP)
  const tokens = canvas.tokens?.placeables?.filter(t => t.actor?.id === actor.id) ?? [];
  if (tokens.length) {
    const ids = tokens.map(t => t.id);
    await canvas.scene.deleteEmbeddedDocuments("Token", ids);
  }

  await actor.setFlag("eq5e", "summon", { ...(actor.flags?.eq5e?.summon ?? {}), active: false, reason });
  // Keep actor by default so history/debug remains; you can auto-delete later.
  return { ok: true };
}



/* ------------------------------ CHARM CONTROL ----------------------------- */

async function releaseCharmedActor({ actor, reason="released" } = {}) {
  try {
    if (!game.user.isGM || !actor) return { ok: false, reason: "gm-only-or-missing" };

    const prev = actor.flags?.eq5e?.charm?.prev ?? {};
    const sceneId = prev.sceneId ?? canvas.scene?.id;
    const tokenId = prev.tokenId ?? null;

    // Restore token disposition where possible
    if (sceneId && tokenId) {
      const scene = game.scenes?.get(sceneId);
      const td = scene?.tokens?.get(tokenId);
      if (td) {
        const restored = prev.disposition ?? td.disposition;
        await td.update({ disposition: restored });
      }
    } else {
      const tokens = canvas.tokens?.placeables?.filter(t => t.actor?.id === actor.id) ?? [];
      for (const t of tokens) {
        const restored = prev.disposition ?? t.document.disposition;
        await t.document.update({ disposition: restored });
      }
    }

    await actor.unsetFlag("eq5e", "charm");
    await actor.setFlag("eq5e", "summon", { ...(actor.flags?.eq5e?.summon ?? {}), active: false, reason, ownerUuid: null });

    try { await setCondition({ actor, conditionId: "charmed", active: false, sourceUuid: null }); } catch (e) {}

    return { ok: true };
  } catch (e) {
    console.error("[EQ5E] releaseCharmedActor failed", e);
    return { ok: false, reason: "error" };
  }
}

async function applyCharmToTarget({ caster, casterToken, targetActor, targetToken, durationRounds=3, summonId="enchanter.charm" } = {}) {
  if (!game.user.isGM) {
    game.socket.emit("system.eq5e", {
      type: "eq5e.applyCharm",
      userId: game.user.id,
      casterUuid: caster?.uuid,
      targetTokenUuid: targetToken?.document?.uuid,
      durationRounds,
      summonId
    });
    ui.notifications?.info("Charm request sent to GM.");
    return { ok: true, requested: true };
  }

  if (!caster || !targetActor || !targetToken) return { ok: false, reason: "missing-args" };

  const combat = game.combat;
  const now = combat?.round ?? 0;
  const charmBonus = Number(caster?.flags?.eq5e?.enchanter?.charmBonusRounds ?? 0);
  const totalDur = Math.max(0, Number(durationRounds || 0) + charmBonus);
  const expiresRound = combat ? (now + totalDur) : null;

  await targetActor.setFlag("eq5e", "charm", {
    ownerUuid: caster.uuid,
    summonId,
    appliedRound: now,
    expiresRound,
    prev: {
      disposition: targetToken.document.disposition,
      tokenId: targetToken.id,
      sceneId: canvas.scene?.id
    }
  });

  await targetActor.setFlag("eq5e", "summon", {
    ...(targetActor.flags?.eq5e?.summon ?? {}),
    active: true,
    ownerUuid: caster.uuid,
    summonId,
    summonType: "charm"
  });

  await targetToken.document.update({ disposition: 1 });

  await setCondition({
    actor: targetActor,
    conditionId: "charmed",
    active: true,
    sourceUuid: caster.uuid,
    duration: { rounds: totalDur },
    meta: expiresRound !== null ? { expiresRound, breakChance: 0.22 } : { breakChance: 0.22 }
  });

  return { ok: true, expiresRound };
}

/* ------------------------------ PET AI CONTROL ----------------------------- */

async function setPetAIState({ petUuid, mode, enabled=true }) {
  // If GM: apply directly. If not GM: request GM via socket (requires OWNER on pet or owner).
  if (!petUuid) return { ok: false, reason: "missing-petUuid" };

  const allowed = new Set(["assist", "guard", "passive", "autonomous"]);
  const newMode = allowed.has(String(mode)) ? String(mode) : "assist";
  const newEnabled = !!enabled;

  if (!game.user.isGM) {
    game.socket.emit("system.eq5e", {
      type: "eq5e.setPetAI",
      userId: game.user.id,
      petUuid,
      mode: newMode,
      enabled: newEnabled
    });
    ui.notifications?.info("Pet AI change request sent to GM.");
    return { ok: true, requested: true };
  }

  const pet = await fromUuid(petUuid);
  if (!pet || pet.documentName !== "Actor") return { ok: false, reason: "pet-not-found" };

  await pet.setFlag("eq5e", "ai", {
    ...(pet.flags?.eq5e?.ai ?? {}),
    enabled: newEnabled,
    mode: newMode
  });

  return { ok: true, applied: true, mode: newMode, enabled: newEnabled };
}

async function setPetStance({ petUuid, stance }) {
  // Convenience wrapper: stance -> (enabled/mode)
  const s = String(stance ?? "").toLowerCase().trim();
  if (s === "passive") return setPetAIState({ petUuid, mode: "passive", enabled: false });
  if (s === "guard") return setPetAIState({ petUuid, mode: "guard", enabled: true });
  if (s === "assist") return setPetAIState({ petUuid, mode: "assist", enabled: true });
  if (s === "autonomous") return setPetAIState({ petUuid, mode: "autonomous", enabled: true });
  return setPetAIState({ petUuid, mode: "assist", enabled: true });
}

/* ------------------------------ SONG TWISTING ------------------------------ */

function _getCombatRound() {
  return game.combat?.round ?? 0;
}

function _ensureSongState(actor) {
  const s = actor?.flags?.eq5e?.songs ?? {};
  if (!Array.isArray(s.active)) s.active = [];
  if (!Number.isFinite(s.maxActive)) s.maxActive = Number(game.settings?.get("eq5e","bardDefaultMaxActiveSongs") ?? 3); // default twist slots
  return s;
}

function _songGroupFromSpell(sp) {
  return sp?.meta?.songGroup
    ?? sp?.kind
    ?? "song";
}function _instrumentPotencyMultForSong(caster, sp) {
  // Optional instrument modifiers:
  // - caster.flags.eq5e.bard.instrument: "brass"|"strings"|"percussion"|null
  // - spell.meta.instrument: expected instrument category, or "any"
  // - spell.meta.instrumentMult: per-song multiplier when matched (default 1.2)
  const inst = String(caster?.flags?.eq5e?.bard?.instrument ?? "").toLowerCase().trim();
  const want = String(sp?.meta?.instrument ?? "any").toLowerCase().trim();
  const mult = Number(sp?.meta?.instrumentMult ?? 1.2);

  if (!inst) return 1.0;
  if (want === "any") return Number.isFinite(mult) ? mult : 1.0;
  if (want && inst === want) return Number.isFinite(mult) ? mult : 1.0;
  return 1.0;
}

function _scaleSongEffectsForInstrument(effects, potencyMult) {
  if (!effects?.length) return effects;
  if (!Number.isFinite(potencyMult) || potencyMult === 1) return effects;

  const scaled = foundry.utils.duplicate(effects);
  for (const ef of scaled) {
    if (!ef?.changes) continue;
    for (const ch of ef.changes) {
      if (!ch || ch.value === undefined) continue;
      // Only scale numeric change values (e.g., +1 attackBonus, +10 walk). Keep booleans/strings.
      const v = Number(ch.value);
      if (!Number.isFinite(v)) continue;
      // For movement, attackBonus, damageBonus: scale and round reasonably
      const nv = Math.round(v * potencyMult * 1000) / 1000;
      ch.value = String(nv);
    }
  }
  return scaled;
}

function _songCadenceRounds(caster) {
  // Cadence: minimum rounds between starting a new performance (default 1).
  return Math.max(0, Number(caster?.flags?.eq5e?.songs?.cadenceRounds ?? 1));
}

function _getPerformanceState(caster) {
  const p = caster?.flags?.eq5e?.songs?.performance ?? {};
  return {
    currentSpellId: p.currentSpellId ?? null,
    startedRound: Number.isFinite(p.startedRound) ? p.startedRound : null,
    lastPlayedRound: Number.isFinite(p.lastPlayedRound) ? p.lastPlayedRound : null
  };
}

async function _setPerformanceState(caster, next) {
  const state = _ensureSongState(caster);
  state.performance = {
    currentSpellId: next.currentSpellId ?? null,
    startedRound: next.startedRound ?? null,
    lastPlayedRound: next.lastPlayedRound ?? null
  };
  await caster.setFlag("eq5e", "songs", state);
  try { await updateBardSynergy(caster); } catch (e) {}
  return state.performance;
}
/* ------------------------------ BARD SYNERGY ------------------------------ */

function computeBardSynergy(actor) {
  const songs = actor?.flags?.eq5e?.songs ?? {};
  const active = Array.isArray(songs.active) ? songs.active : [];
  const perf = songs.performance ?? {};
  const currentId = perf.currentSpellId ?? null;

  const count = active.length;
  const groups = new Set(active.map(s => s.group ?? "song"));
  const uniqueGroups = groups.size;

  // Simple deterministic synergy rules (tunable later):
  // - 2+ maintained songs: +1 attack
  // - 3+ maintained songs: +1 damage
  // - 3 unique groups: +1 attack (extra)
  // - If an instrument is equipped/selected and currently playing song matches: +1 damage (small)
  let attackBonus = 0;

// Discipline: attack penalty (e.g., Whirlwind)
try {
  const pen = getDisciplineAttackPenalty(attacker);
  if (pen) attackBonus = Number(attackBonus ?? 0) - Number(pen);
} catch {}
  let damageBonus = 0;

  if (count >= 2) attackBonus += 1;
  if (count >= 3) damageBonus += 1;
  if (uniqueGroups >= 3) attackBonus += 1;

  // Instrument match bonus (optional)
  const inst = String(actor?.flags?.eq5e?.bard?.instrument ?? "").toLowerCase().trim();
  if (inst && currentId) {
    const it = actor.items?.find(i => i?.flags?.eq5e?.spell?.spellId === currentId);
    const sp = it?.flags?.eq5e?.spell;
    const want = String(sp?.meta?.instrument ?? "any").toLowerCase().trim();
    if (want === "any" || want === inst) damageBonus += 1;
  }

  // Cap for sanity
  attackBonus = Math.min(3, Math.max(0, attackBonus));
  damageBonus = Math.min(3, Math.max(0, damageBonus));

  return { attackBonus, damageBonus, count, uniqueGroups };
}

async function updateBardSynergy(actor) {
  if (!actor) return null;
  const sy = computeBardSynergy(actor);
  await actor.setFlag("eq5e", "bard", foundry.utils.mergeObject(actor.flags?.eq5e?.bard ?? {}, { synergy: sy }, { inplace: false }));
  return sy;
}




async function registerMaintainedSong({ caster, spell, targetUuid=null }) {// Cadence: starting a new performance ends the previous performance immediately.
// Songs remain "maintained" for durationRounds, so twisting = rotating through songs before they expire.
const perf = _getPerformanceState(caster);
const cadenceRounds = _songCadenceRounds(caster);
const nowRound = _getCombatRound();
if (perf.lastPlayedRound !== null && cadenceRounds > 0 && (nowRound - perf.lastPlayedRound) < cadenceRounds) {
  return { ok: false, reason: "cadence", detail: { lastPlayedRound: perf.lastPlayedRound, cadenceRounds } };
}


  const sp = spell;
  const sid = sp?.spellId;
  if (!sid) return { ok: false, reason: "missing-spellId" };

  const round = nowRound;
  const durationRounds = Number(sp?.meta?.durationRounds ?? sp?.durationRounds ?? 2);
  const pulseRounds = Math.max(1, Number(sp?.meta?.pulseRounds ?? 1));
  const group = _songGroupFromSpell(sp);
  const priority = Number(sp?.priority ?? 50);

  const state = _ensureSongState(caster);
  let active = state.active;

  // Refresh same song if already active
  active = active.filter(e => e.spellId !== sid);

  // Overwrite rule: one song per group (movement/combat/control/etc.)
  active = active.filter(e => e.group !== group);

  // Capacity rule: keep up to maxActive (drop oldest)
  while (active.length >= state.maxActive) {
    active.sort((a,b) => (a.startedRound ?? 0) - (b.startedRound ?? 0));
    active.shift();
  }

  active.push({
    spellId: sid,
    group,
    targetUuid: targetUuid ?? null,
    startedRound: round,
    expiresRound: round + durationRounds,
    pulseRounds,
    nextPulseRound: round + pulseRounds,
    priority
  });

  state.active = active;

// Update performance: playing this song ends previous performance (only one actively playing at a time).
state.performance = {
  currentSpellId: sid,
  startedRound: round,
  lastPlayedRound: round
};

  await caster.setFlag("eq5e", "songs", state);
  try { await updateBardSynergy(caster); } catch (e) {}
  return { ok: true, spellId: sid, group, expiresRound: round + durationRounds };
}

async function pruneExpiredSongs(actor) {
  const state = _ensureSongState(actor);
  const round = nowRound;
  const before = state.active.length;
  state.active = state.active.filter(e => (e.expiresRound ?? 0) > round);
  if (state.active.length !== before) {
    await actor.setFlag("eq5e", "songs", state);
    try { await updateBardSynergy(actor); } catch (e) {}
  }
}

async function _applySongPulse({ caster, spell, target }) {
  // Pulse does NOT spend mana / cooldown; it's deterministic periodic damage only (for now).
  // Buff maintenance is handled by the song's own duration / AE duration on cast; twisting refreshes by recasting.
  const sp = spell;
  const potencyMult = _instrumentPotencyMultForSong(caster, sp);

  if (!sp) return;

  const meta = sp?.meta ?? {};
  const hasDamage = Array.isArray(sp.damage) && sp.damage.length > 0;
  const doDamagePulse = !!meta.dot || !!meta.damagePulse || !!meta.pulseDamage;

  if (hasDamage && doDamagePulse) {
    for (const d of sp.damage) {
      const formula = d.formula ?? "1";
      const type = d.type ?? "magic";
      await game.eq5e.api.applyDamage({
        source: caster,
        target,
        formula,
        damageType: type,
        category: d.category ?? "song",
        options: { silent: true, potencyMult }
      });
    }
  }
// Condition pulses (for control songs like Lullaby). Must be explicitly enabled by meta.pulseConditions.
if (Array.isArray(sp.conditions) && sp.conditions.length && (meta.pulseConditions || meta.conditionPulse)) {
  for (const c of sp.conditions) {
    const dur = foundry.utils.duplicate(c.duration ?? null);
    const metaC = foundry.utils.duplicate(c.meta ?? null) ?? {};

    // Instrument potency can extend pulsed control slightly (rounds only).
    if (dur?.rounds !== undefined && dur?.rounds !== null) {
      const base = Number(dur.rounds);
      const scaled = Math.max(0, Math.round(base * potencyMult));
      dur.rounds = scaled;
    }

    await setCondition({
      actor: target,
      conditionId: c.id,
      active: true,
      sourceUuid: caster.uuid,
      duration: dur,
      meta: metaC
    });
  }
}


}

async function processSongPulses(combat) {
  if (!combat) return;
  const round = combat.round ?? 0;

  for (const c of combat.combatants) {
    const actor = c?.actor;
    if (!actor) continue;

    const state = actor?.flags?.eq5e?.songs;
    if (!state?.active?.length) continue;

    // prune expired
    await pruneExpiredSongs(actor);

    const active = (actor.flags?.eq5e?.songs?.active ?? []).slice();
    if (!active.length) continue;

    for (const inst of active) {
      if ((inst.nextPulseRound ?? 0) > round) continue;

      // Resolve spell item by spellId from owned items
      const sid = inst.spellId;
      const item = actor.items?.find(i => i?.flags?.eq5e?.spell?.spellId === sid) ?? null;
      const sp = item?.flags?.eq5e?.spell;
      if (!sp) {
        inst.nextPulseRound = round + (inst.pulseRounds ?? 1);
        continue;
      }

      // Resolve target: default self if none
      let target = actor;
      if (inst.targetUuid) {
        try {
          const tdoc = await fromUuid(inst.targetUuid);
          if (tdoc?.documentName === "Actor") target = tdoc;
        } catch (e) {}
      }

      await _applySongPulse({ caster: actor, spell: sp, target });
      inst.nextPulseRound = round + (inst.pulseRounds ?? 1);
    }

    // Save updated pulse schedule
    const nextState = _ensureSongState(actor);
    nextState.active = active;
    await actor.setFlag("eq5e", "songs", nextState);
    try { await updateBardSynergy(actor); } catch (e) {}
  }
}


/* ----------------------- SHADOWKNIGHT UNHOLY AURA ------------------------ */
/**
 * Adds deterministic threat each round to nearby hostile NPCs while in combat.
 * Uses AA "aa.sk.unholy-aura" rank. Runs GM-only on round advance.
 */
async function processShadowknightUnholyAura({ combat }) {
  if (!combat?.started) return;
  if (!game.user.isGM) return;

  const round = Number(combat.round ?? 0);
  const combatId = String(combat.id ?? "");

  const combatants = (combat.combatants ?? []).map(c => canvas.tokens?.get(c.tokenId)).filter(t => t?.actor);
  const skTokens = combatants.filter(t => {
    const a = t.actor;
    const cls = String(a?.flags?.eq5e?.class?.id ?? a?.flags?.eq5e?.classId ?? a?.flags?.eq5e?.class ?? "").toLowerCase();
    return cls === "shadowknight";
  });

  if (!skTokens.length) return;

  const npcTokens = combatants.filter(t => t.actor?.type === "npc" && t.document?.disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY);

  for (const skT of skTokens) {
    const sk = skT.actor;
    const rank = Math.max(0, getAARankById(sk, "aa.sk.unholy-aura"));
    if (!rank) continue;

    const last = sk.getFlag("eq5e","shadowknight.auraLast") ?? null;
    if (last && last.combatId === combatId && Number(last.round ?? -1) === round) continue;

    // Base threat per nearby NPC each round; tweakable later
    const amount = Math.max(1, Math.floor(5 * rank));

    for (const npcT of npcTokens) {
      const npc = npcT.actor;
      // Range check: 30ft
      const dist = canvas.grid?.measureDistance?.(skT, npcT) ?? null;
      if (dist === null || dist > 30) continue;

      // Only apply if NPC has a threat table already (engaged) OR if it currently targets someone (combatant exists)
      const st = getThreatState(npc);
      const engaged = !!Object.keys(st.entries ?? {}).length;
      if (!engaged) continue;

      await addThreat(npc, sk.uuid, amount, { reason: "unholyAura" });
    }

    await sk.setFlag("eq5e","shadowknight.auraLast",{ combatId, round });
  }
}

/* -------------------------- TURN-BASED CLEANUP --------------------------- */

Hooks.on("updateCombat", async (combat, changed) => {
  if (!combat?.started) return;
  const turnChanged = Object.prototype.hasOwnProperty.call(changed, "turn");
  const roundChanged = Object.prototype.hasOwnProperty.call(changed, "round");
  if (!turnChanged && !roundChanged) return;

  const c = combat.combatant;
  const token = canvas.tokens?.get(c?.tokenId);
  const actor = token?.actor;
  if (!actor) return;

  await pruneExpiredConditions(actor);

  // EQ5E: threat decay + stickiness (GM only, round advance)
  if (roundChanged && game.user.isGM && THREAT.decayPerRoundPct > 0) {
    try {
      const npcs = (combat.combatants ?? []).map(c => canvas.tokens?.get(c.tokenId)?.actor).filter(a => a && a.type === "npc");
      for (const npc of npcs) {
        const st = getThreatState(npc);
        const entries = st.entries ?? {};
        const decayBase = Number(THREAT.decayPerRoundPct ?? 0);
        let changedAny = false;
        for (const [uuid, rec] of Object.entries(entries)) {
          const cur = Number(rec?.threat ?? 0);
          if (!cur) continue;
          const red = Math.max(0, Math.min(0.90, Number(getThreatDecayReductionForSourceUuid(uuid) ?? 0)));
          const decay = decayBase * (1 - red);
          const nxt = Math.max(0, Math.floor(cur * (1 - decay)));
          if (nxt !== cur) { entries[uuid] = { ...rec, threat: nxt }; changedAny = true; }
        }
        if (changedAny) {
          st.entries = entries;
          // update lastTargetUuid opportunistically (helps stickiness feel consistent)
          st.lastTargetUuid = getTopThreatTargetUuid(npc);
          await setThreatState(npc, st);
        }
      }
    } catch (e) { console.error("[EQ5E] threat decay failed", e); }
  }



// Disciplines (GM only): expire at end of duration
if (roundChanged && game.user.isGM) {
  try { await expireDisciplinesForCombat({ combat }); } catch (e) { console.error("[EQ5E] discipline expiry failed", e); }
}

// DOT ticks (GM only, round advance)
if (roundChanged && game.user.isGM) {
  try {
    const actors = (combat.combatants ?? []).map(c => canvas.tokens?.get(c.tokenId)?.actor).filter(a => a);
    for (const a of actors) await processDotsForActor({ actor: a, combat });
 
// Shadowknight: Unholy Aura (GM only, round advance)
if (roundChanged && game.user.isGM) {
  try { await processShadowknightUnholyAura({ combat }); } catch (e) { console.error("[EQ5E] SK aura failed", e); }
}

 } catch (e) { console.error("[EQ5E] dot tick failed", e); }
}

  // eq5e.checkSummonExpiry
  if (game.user.isGM) {
    const s = actor.flags?.eq5e?.summon;
    if (s?.active && s.expires && combat?.id && s.expires.combatId === combat.id) {
      if ((combat.round ?? 0) >= Number(s.expires.round ?? 0)) {
        await despawnSummonedPet({ actor, reason: "expired" });
      }
    }
  }

  if (roundChanged && THREAT.decayPerRoundPct > 0 && (actor.type === "npc")) {
    const state = getThreatState(actor);
    for (const k of Object.keys(state.entries)) {
      const t = state.entries[k]?.threat ?? 0;
      const decayed = Math.floor(t * (1 - THREAT.decayPerRoundPct));
      if (decayed <= 0) delete state.entries[k];
      else state.entries[k].threat = decayed;
    }
    await setThreatState(actor, state);
  }
});

/* ------------------------------ API EXPORT ------------------------------- */


/* ------------------ Active Effect sync hooks ------------------ */

Hooks.on("createActiveEffect", async (effect, _opts, _userId) => {
  try {
    const actor = effect?.parent;
    if (!actor || actor.documentName !== "Actor") return;
    // Only sync for EQ5E actors; harmless if used elsewhere
    await syncConditionsFromEffects(actor);
  
if (data.type === "eq5e.summonPet") {
  const { userId, casterUuid, summonData } = data;
  const caster = await fromUuid(casterUuid);
  if (!caster || caster.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  // Authorization: requesting user must have OWNER permission on caster actor
  if (!caster.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] SummonPet denied (no OWNER perm)", { userId, casterUuid });
    return;
  }

  // Find a token for caster on current scene (required for placement)
  const casterToken = canvas.tokens?.placeables?.find(t => t.actor?.id === caster.id) ?? null;
  if (!casterToken) {
    console.warn("[EQ5E] SummonPet denied (no caster token on scene)", { casterUuid });
    return;
  }

  const res = await summonPetFromCompendium({
    caster,
    casterToken,
    summon: summonData,
    ownerUuid: caster.uuid
  });
  console.log("[EQ5E] SummonPet processed", res);
}


if (data.type === "eq5e.setPetAI") {
  const { userId, petUuid, mode, enabled } = data;
  const pet = await fromUuid(petUuid);
  if (!pet || pet.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  // Authorization:
  // - user must have OWNER on pet actor OR OWNER on the pet's owner actor (eq5e.pet.ownerUuid)
  let authorized = pet.testUserPermission(user, "OWNER");
  if (!authorized) {
    const ownerUuid = pet?.flags?.eq5e?.pet?.ownerUuid;
    if (ownerUuid) {
      const owner = await fromUuid(ownerUuid);
      if (owner && owner.documentName === "Actor") {
        authorized = owner.testUserPermission(user, "OWNER");
      }
    }
  }
  if (!authorized) {
    console.warn("[EQ5E] setPetAI denied (no OWNER perm)", { userId, petUuid });
    return;
  }

  const allowed = new Set(["assist", "guard", "passive", "autonomous"]);
  const newMode = allowed.has(String(mode)) ? String(mode) : "assist";
  const newEnabled = (enabled === undefined || enabled === null) ? true : !!enabled;

  await pet.setFlag("eq5e", "ai", {
    ...(pet.flags?.eq5e?.ai ?? {}),
    enabled: newEnabled,
    mode: newMode
  });

  console.log("[EQ5E] setPetAI processed", { pet: pet.name, enabled: newEnabled, mode: newMode });
}

} catch (e) {
    console.error("[EQ5E] createActiveEffect sync error", e);
  }
});

Hooks.on("updateActiveEffect", async (effect, _changed, _opts, _userId) => {
  try {
    const actor = effect?.parent;
    if (!actor || actor.documentName !== "Actor") return;
    await syncConditionsFromEffects(actor);
  } catch (e) {
    console.error("[EQ5E] updateActiveEffect sync error", e);
  }
});

Hooks.on("deleteActiveEffect", async (effect, _opts, _userId) => {
  try {
    const actor = effect?.parent;
    if (!actor || actor.documentName !== "Actor") return;
    await syncConditionsFromEffects(actor);
  } catch (e) {
    console.error("[EQ5E] deleteActiveEffect sync error", e);
  }
});

Hooks.once("init", async () => {

// EQ5E: Whirlwind optional shared attack roll for cleave targets
__eq5eRegisterSetting("eq5e", "whirlwindSharedAttackRoll", {
  name: "Whirlwind uses shared attack roll",
  hint: "If enabled, Whirlwind cleave uses one shared d20 roll across all cleave targets (EQ-ish flurry vibe).",
  scope: "world",
  config: true,
  type: Boolean,
  default: false
});

  

/* -------------------- Balance & Parse Settings (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "parseMode", {
  name: "Parse Mode (combat logging)",
  hint: "If enabled, EQ5e will record simple damage/heal/threat stats per combat for balance tuning and GM HUD readouts.",
  scope: "world",
  config: true,
  type: Boolean,
  default: false
});

__eq5eRegisterSetting("eq5e", "threatDamageToThreat", {
  name: "Threat: damage → threat coefficient",
  hint: "Global coefficient applied to damage when generating threat on NPCs (1.0 = baseline).",
  scope: "world",
  config: true,
  type: Number,
  default: 1.0
});

/* -------------------- Tank Threat Tuning (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "tankThreatMultWarrior", {
  name: "Tank threat multiplier: Warrior",
  hint: "Damage-based threat multiplier for Warriors.",
  scope: "world",
  config: true,
  type: Number,
  default: 1.10
});
__eq5eRegisterSetting("eq5e", "tankThreatMultPaladin", {
  name: "Tank threat multiplier: Paladin",
  hint: "Damage-based threat multiplier for Paladins.",
  scope: "world",
  config: true,
  type: Number,
  default: 1.05
});
__eq5eRegisterSetting("eq5e", "tankThreatMultShadowknight", {
  name: "Tank threat multiplier: Shadowknight",
  hint: "Damage-based threat multiplier for Shadowknights.",
  scope: "world",
  config: true,
  type: Number,
  default: 1.08
});
__eq5eRegisterSetting("eq5e", "threatOpeningBonusRounds", {
  name: "Threat: opening bonus rounds",
  hint: "For the first N rounds of a combat, tanks generate extra threat from damage.",
  scope: "world",
  config: true,
  type: Number,
  default: 2
});
__eq5eRegisterSetting("eq5e", "threatOpeningBonusPct", {
  name: "Threat: opening bonus percent",
  hint: "Bonus percent for tank classes during the opening rounds (e.g., 0.25 = +25%).",
  scope: "world",
  config: true,
  type: Number,
  default: 0.25
});


/* -------------------- Shadowknight Lifetap Tuning (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "skLifetapHealCapPct", {
  name: "SK lifetap heal cap (pct of max HP)",
  hint: "Maximum healing per lifetap event as a fraction of the caster's max HP (e.g., 0.25 = 25%).",
  scope: "world",
  config: true,
  type: Number,
  default: 0.25
});


/* -------------------- Healer Throughput Tuning (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "healerPowerMultCleric", {
  name: "Healer throughput: Cleric",
  hint: "Multiplier applied to outgoing healing from Clerics.",
  scope: "world",
  config: true,
  type: Number,
  default: 1.05
});
__eq5eRegisterSetting("eq5e", "healerPowerMultDruid", {
  name: "Healer throughput: Druid",
  hint: "Multiplier applied to outgoing healing from Druids.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.95
});
__eq5eRegisterSetting("eq5e", "healerPowerMultShaman", {
  name: "Healer throughput: Shaman",
  hint: "Multiplier applied to outgoing healing from Shamans.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.98
});


__eq5eRegisterSetting("eq5e", "threatHealToThreat", {
  name: "Threat: healing → threat coefficient",
  hint: "Threat generated by healing on hostile NPCs already engaged with the healed target. 0 disables.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.15
});


/* -------------------- Healer Threat-Aware Rotation (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "healerThreatCautionRounds", {
  name: "Healer AI: threat caution rounds",
  hint: "During the first N rounds, healer auto-rotation avoids big heals if tank threat is unstable.",
  scope: "world",
  config: true,
  type: Number,
  default: 2
});
__eq5eRegisterSetting("eq5e", "healerThreatCautionHpPct", {
  name: "Healer AI: override HP threshold",
  hint: "If lowest friendly HP is below this percent, healer will use big heals even if threat is unstable.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.25
});


__eq5eRegisterSetting("eq5e", "supportSlowAtkSpeedMultShaman", {
  name: "Support: Shaman attack slow potency multiplier",
  hint: "Scales Shaman attack-speed slow effects (slowAtkPct). 1.0 = unchanged.",
  scope: "world",
  config: true,
  type: Number,
  default: 1.10
});

__eq5eRegisterSetting("eq5e", "petThreatTransferCapPerEvent", {
  name: "Pets: Threat transfer cap per event",
  hint: "Caps how much threat can be transferred from an owner to their Guard pet per threat event (0 = unlimited).",
  scope: "world",
  config: true,
  type: Number,
  default: 200
});

__eq5eRegisterSetting("eq5e", "threatFlipGapThreshold", {
  name: "GM HUD: Threat flip warning threshold",
  hint: "If the gap between #1 and #2 threat is at or below this value, show a flip warning on NPC Token HUD threat bar.",
  scope: "world",
  config: true,
  type: Number,
  default: 120
});

__eq5eRegisterSetting("eq5e", "threatFlipPulseEnabled", {
  name: "GM HUD: Threat flip pulse animation",
  hint: "If enabled, NPC threat bar and Flip badge will pulse when threat gap is below the warning threshold.",
  scope: "world",
  config: true,
  type: Boolean,
  default: true
});

__eq5eRegisterSetting("eq5e", "raceTokenVisionEnabled", {
  name: "Races: Apply token vision presets",
  hint: "If enabled, newly created/updated tokens will apply simple vision presets based on race vision (normal/lowlight/infravision). This is cosmetic and can be overridden per token.",
  scope: "world",
  config: true,
  type: Boolean,
  default: false
});




try { Handlebars.registerHelper("eq", (a,b) => String(a) === String(b)); } catch (e) {}

  try {
    const sw = await import("./setup/setup-wizard.js");
    sw.registerEQ5eSetupWizard();
  } catch (e) { console.error("[EQ5E] setup wizard init failed", e); }

    console.log("[EQ5E] System init");
/* -------------------- Tank Mitigation Tuning (Alpha) -------------------- */
__eq5eRegisterSetting("eq5e", "mitigationClassBonusWarriorPct", {
  name: "Warrior mitigation bonus (pct)",
  hint: "Additional mitigation percent applied to Warriors (e.g. 0.05 = 5%).",
  scope: "world",
  config: true,
  type: Number,
  default: 0.06
});
__eq5eRegisterSetting("eq5e", "mitigationClassBonusPaladinPct", {
  name: "Paladin mitigation bonus (pct)",
  hint: "Additional mitigation percent applied to Paladins.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.04
});
__eq5eRegisterSetting("eq5e", "mitigationClassBonusShadowknightPct", {
  name: "Shadowknight mitigation bonus (pct)",
  hint: "Additional mitigation percent applied to Shadowknights.",
  scope: "world",
  config: true,
  type: Number,
  default: 0.045
});
  game.eq5e = game.eq5e || {};
  
/* -------------------- Parse Harness -------------------- */
function ensureParseStore() {
  game.eq5e = game.eq5e || {};
  game.eq5e.parse = game.eq5e.parse || { combats: {} };
  return game.eq5e.parse;
}
function parseCombatStore(combatId) {
  const store = ensureParseStore();
  store.combats[combatId] = store.combats[combatId] || { actors: {}, startedAt: Date.now() };
  return store.combats[combatId];
}
function parseActorEntry(store, actor) {
  if (!actor) return null;
  const uuid = actor.uuid;
  store.actors[uuid] = store.actors[uuid] || {
    uuid,
    name: actor.name,
    damageOut: 0,
    damageIn: 0,
    healOut: 0,
    healIn: 0,
    threatOut: 0,
    mitigated: 0,
    resisted: 0,
    absorbed: 0,
    slowSuppressedAttacks: 0,
    slowProcSuppression: 0
  };
  return store.actors[uuid];
}
function recordParseEvent({ kind, sourceActor, targetActor, amount = 0, threat = 0, resisted = 0, mitigated = 0, absorbed = 0 } = {}) {
  try {
    if (!game.settings.get("eq5e","parseMode")) return;
    const combat = game.combat;
    if (!combat?.id) return;
    const store = parseCombatStore(combat.id);
    const s = parseActorEntry(store, sourceActor);
    const t = parseActorEntry(store, targetActor);
    amount = Math.max(0, Number(amount ?? 0));
    threat = Math.max(0, Number(threat ?? 0));

    if (kind === "damage") {
      if (s) { s.damageOut += amount; s.threatOut += threat; }
      if (t) t.damageIn += amount;
      if (t) { t.mitigated += Math.max(0, Number(mitigated ?? 0)); t.resisted += Math.max(0, Number(resisted ?? 0)); t.absorbed += Math.max(0, Number(absorbed ?? 0)); }
    } else if (kind === "healing") {
      if (s) { s.healOut += amount; s.threatOut += threat; }
      if (t) t.healIn += amount;
    } else if (kind === "slow") {
      if (s) s.slowSuppressedAttacks += amount;
    } else if (kind === "slowProc") {
      if (s) s.slowProcSuppression += amount;
    }
  } catch(e) {}
}

async function executeShadowknightRotation({ actor, token } = {}) {
  try {
    if (!actor || !token) return { ok: false, reason: "missing actor or token" };
    const rot = String(actor?.flags?.eq5e?.shadowknight?.rotation ?? "balanced");
    const targetToken = game.user.targets?.first?.() ?? null;
    const target = targetToken?.actor ?? null;

    // Helper to cast by spellId
    const castById = async (spellId) => {
      const item = actor.items?.find(i => String(i?.flags?.eq5e?.spell?.spellId) === spellId);
      if (!item) return false;
      const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target, targetToken, item });
      return !!res?.ok;
    };

    // Priority tables per rotation (deterministic order)
    const tables = {
      balanced: [
        "sk.terror.focus.2",
        "sk.debuff.decay.1",
        "sk.buff.mortalcoil.1",
        "sk.tap.7",
        "sk.tap.6"
      ],
      terror: [
        "sk.terror.focus.2",
        "sk.terror.2",
        "sk.debuff.decay.1",
        "sk.tap.7"
      ],
      lifetap: [
        "sk.debuff.decay.1",
        "sk.tap.7",
        "sk.tap.6",
        "sk.buff.mortalcoil.1"
      ],
      defensive: [
        "sk.buff.mortalcoil.1",
        "sk.heal.self.1",
        "sk.terror.focus.2"
      ]
    };

    const list = tables[rot] ?? tables.balanced;
    for (const sid of list) {
      try {
        const ok = await castById(sid);
        if (ok) return { ok: true, spellId: sid };
      } catch (e) {}
    }
    return { ok: false, reason: "no valid action" };
  } catch (e) {
    console.warn("[EQ5E] executeShadowknightRotation failed", e);
    return { ok: false, reason: "error" };
  }
}

// Race helpers declared early to avoid ReferenceError during init
let applyRaceToActor;

/* -------------------- Race Helpers (early bind) -------------------- */
function getRaceById(actor, raceId) {
  const id = String(
    raceId ??
    actor?.flags?.eq5e?.raceId ??
    ""
  ).toLowerCase();

  return (game.eq5e?.races ?? {})[id] ?? null;
}


/* -------------------- Parse Reset Helper -------------------- */
function resetParse() {
  try {
    game.eq5e = game.eq5e || {};
    // Keep parse buckets predictable; downstream HUDs/macros can extend as needed.
    game.eq5e.parse = {
      damage: {},
      healing: {},
      threat: {}
    };
    console.log("[EQ5E] Parse state reset");
  } catch (e) {
    console.warn("[EQ5E] resetParse failed", e);
  }
}

game.eq5e.api = {
  version: "0.3.0-alpha",
  CONDITIONS,

  applyRaceToActor,
  getRaceById,

  // Threat
  getThreatConfig: () => ({
    damageToThreat: getThreatDamageToThreat(),
    decayPerRoundPct: Number(THREAT.decayPerRoundPct ?? 0),
    stickinessPct: Number(THREAT.stickinessPct ?? 0)
  }),
  transferThreat: async ({ npcActor, fromActor, toActor, pct = 0.5 }) => transferThreat({ npcActor, fromActor, toActor, pct }),
  addThreat: async ({ npcActor, sourceActor, amount }) => addThreat({ npcActor, sourceActor, amount }),
  getTopThreatEntries: (npcActor, limit = 3) => getTopThreatEntries(npcActor, limit),

  // Conditions
  hasCondition, canAct, canMove, canCast, getMoveMultiplier,
  setCondition, clearCondition, pruneExpiredConditions, syncConditionsFromEffects,

  // Cooldowns + haste
  getCombatKey, isOnCooldown, setCooldown, getHastePct, hasteToExtraAttacks,

  // Movement
  getSpeedFt, ftToPixels, moveTowardTokenByFt,

  // Damage / threat
  applyDamage,
  getThreatState, setThreatState, getTopThreatTargetUuid, applyTaunt, clearExpiredForcedTarget,

  // Attacks / spells
  getAC, getHP, getMana, spendMana,
  getAttackItemsReady, getMeleeAttackItemsReady, getMeleeSwingsPerTurn,
  performAttack,
  getSpellItemsReady, castSpell,

  // Pets / summons
  summonPetFromCompendium,
  despawnSummonedPet,
  dismissSummonedPet,
  updatePetConfig,
  renamePet,
  swapSummonVariant,
  charmTarget,
  setPetAIState,
  setPetStance,

  // Procs / threat
  armOnHitProc,
  setOnHitProcs,
  getOnHitProcs,
  dropThreat,

  // Disciplines
  activateDiscipline,
  activateDisciplineSafe,
  clearActiveDisciplineSafe,
  clearActiveDiscipline,
  getActiveDiscipline,
  getDisciplineCooldownRemaining,

  // Rotation
  executeShadowknightRotation,
  executeRotation,
  setRotationProfile,
  setAutoRotation,
  setAutoRotationTargetOnly,

  // Parse
  resetParse
};

});
/* --------------------------- EQ5E Lifetap postDamage --------------------------- */
/**
 * Deterministic lifetap: if a spell packet includes meta.lifetapPct, heal the source for that % of applied damage.
 * Shadowknight AAs can increase lifetapPct and add flat healing per lifetap event.
 */
Hooks.on("eq5e.postDamage", async (wf) => {
  try {
    const src = wf?.sourceActor;
    const tgt = wf?.targetActor;
    if (!src || !tgt) return;
    const meta = wf?.packet?.meta ?? null;
    const lifetapPct = Number(meta?.lifetapPct ?? 0);
    if (!lifetapPct || lifetapPct <= 0) return;
    const applied = Number(wf?.totals?.applied ?? 0);
    if (!applied || applied <= 0) return;

    const mods = computeShadowknightAAMods(src);
    const pct = Math.max(0, lifetapPct + Number(mods.lifetapPctBonus ?? 0));
    let heal = Math.floor(applied * pct) + Math.max(0, Number(mods.lifetapFlatBonus ?? 0));
    // Cap per-event healing to avoid immortal tap-tanking in long fights
    const capPct = clamp(Number(game.settings.get("eq5e","skLifetapHealCapPct") ?? 0.25), 0.05, 0.75);
    const maxHp = Number(foundry.utils.getProperty(src, "system.attributes.hp.max") ?? 0);
    if (maxHp > 0) heal = Math.min(heal, Math.floor(maxHp * capPct));
    if (heal <= 0) return;

    const hpPath = "system.attributes.hp.value";
    const cur = Number(foundry.utils.getProperty(src, hpPath) ?? 0);
    const max = Number(foundry.utils.getProperty(src, "system.attributes.hp.max") ?? cur);
    const next = Math.min(max, cur + heal);
    if (next === cur) return;
    await src.update({ [hpPath]: next });

    // Short chat hint (can be silenced by options.silentLifetap on applyDamage call)
    if (!wf?.options?.silentLifetap) {
      const html = `<div class="eq5e-lifetap-hint"><b>Lifetap</b>: ${src.name} heals ${heal}.</div>`;
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: src }), content: html });
    }
  } catch (e) { console.warn("[EQ5E] Lifetap postDamage failed", e); }
});




/* ---------------------- ROOTSELF MOVEMENT RESTRICTION ---------------------- */
/**
 * Restrict token movement while a discipline is active with effects.rootSelf=true (e.g., Weapon Shield).
 * GM can override by passing {eq5eForceMove:true} in update options.
 */
function isRootSelfActive(actor) {
  try {
    const st = getDisciplineState(actor);
    const active = st?.active ?? null;
    if (!active?.effects?.rootSelf) return false;

    // If combat is active, also require it hasn't expired
    const combat = game.combat;
    if (combat) {
      const round = Number(combat.round ?? 0);
      const ends = Number(active.endsAtRound ?? round);
      if (round > ends) return false;
    }
    return true;
  } catch (e) { return false; }
}

Hooks.on("preUpdateToken", (doc, changes, options, userId) => {
  try {
    if (!changes) return;
    if (options?.eq5eForceMove) return;
    if (!("x" in changes) && !("y" in changes)) return;

    const actor = doc?.actor;
    if (!actor) return;

    // Allow GM to reposition if needed
    const u = game.users?.get(userId);
    if (u?.isGM) return;

    if (!isRootSelfActive(actor)) return;

    // Block movement
    delete changes.x;
    delete changes.y;

    if (u?.active) ui.notifications?.warn(`${actor.name} cannot move while Weapon Shield is active.`);
  } catch (e) {}
});

Hooks.once("ready", () => {

// ---------------- Socket: allow non-GM owners to request GM actions (summon dismiss, etc.) ----------------
game.eq5e = game.eq5e || {};
game.eq5e.socket = game.eq5e.socket || {};


// ===== Vendor transactions (GM-authoritative) =====
function itemPriceCP(item) {
  return Number(item?.system?.eq5e?.price?.cp ?? item?.flags?.eq5e?.price?.cp ?? 0) || 0;
}
function vendorSellPriceCP(item) {
  const base = itemPriceCP(item);
  const markup = (game.settings?.get?.("eq5e", "vendorMarkup") ?? 1.20);
  return Math.max(0, Math.round(base * markup));
}
function vendorBuybackPriceCP(item) {
  const base = itemPriceCP(item);
  const buyback = (game.settings?.get?.("eq5e", "vendorBuyback") ?? 0.40);
  return Math.max(0, Math.round(base * buyback));
}

async function gmVendorBuy({ userId, buyerActorUuid, vendorActorUuid, vendorItemId, quantity=1 }) {
  const buyer = buyerActorUuid ? await fromUuid(buyerActorUuid) : null;
  const vendor = vendorActorUuid ? await fromUuid(vendorActorUuid) : null;
  if (!buyer || !vendor) return;

  const user = game.users?.get(userId);
  if (!user) return;
  if (!buyer.testUserPermission(user, "OWNER")) return;

  const vItem = vendor.items?.get(vendorItemId);
  if (!vItem) return;

  quantity = Math.max(1, Math.min(99, Number(quantity)||1));

  // vendor stock qty
  const stock = getItemQty(vItem);
  quantity = Math.min(quantity, stock);

  const priceEach = Math.round(vendorSellPriceCP(vItem) * (effectiveItemValueCP(vItem) / Math.max(1, priceCPFromItem(vItem))));
  const total = priceEach * quantity;

  const buyerCP = getActorCP(buyer);
  if (buyerCP < total) {
    ChatMessage.create({content: `<p><b>${buyer.name}</b> cannot afford <b>${vItem.name}</b> (need ${total}cp).</p>`});
    return;
  }

  const infinite = (game.settings?.get?.("eq5e","vendorsInfiniteFunds") ?? true);
  if (!infinite) {
    const vcp = getActorCP(vendor);
    await setActorCP(vendor, vcp + total);
  }

  await setActorCP(buyer, buyerCP - total);

  // Reduce vendor stock
  const newStock = stock - quantity;
  if (newStock <= 0) {
    await vendor.deleteEmbeddedDocuments("Item", [vItem.id]);
  } else {
    await vItem.update({ "system.eq5e.quantity": newStock });
  }

  // Add to buyer inventory (merge stack if possible)
  const sk = stackKey(vItem);
  const stackable = isStackableItem(vItem);
  if (stackable) {
    const existing = buyer.items.find(i => !i.flags?.eq5e?.vendorItem && stackKey(i) === sk);
    if (existing) {
      const q0 = getItemQty(existing);
      await existing.update({ "system.eq5e.quantity": q0 + quantity });
      ChatMessage.create({content: `<p><b>${buyer.name}</b> bought <b>${quantity}× ${vItem.name}</b> for <b>${total}cp</b>.</p>`});
      return;
    }
  }

  const data = vItem.toObject();
  data.flags = data.flags || {};
  data.flags.eq5e = data.flags.eq5e || {};
  delete data.flags.eq5e.vendorItem;
  data.system = data.system || {};
  data.system.eq5e = data.system.eq5e || {};
  data.system.eq5e.quantity = quantity;

  await buyer.createEmbeddedDocuments("Item", [data]);
  ChatMessage.create({content: `<p><b>${buyer.name}</b> bought <b>${quantity}× ${vItem.name}</b> for <b>${total}cp</b>.</p>`});
}

async function gmVendorSell({ userId, sellerActorUuid, vendorActorUuid, sellerItemId, quantity=1 }) {
  const seller = sellerActorUuid ? await fromUuid(sellerActorUuid) : null;
  const vendor = vendorActorUuid ? await fromUuid(vendorActorUuid) : null;
  if (!seller || !vendor) return;

  const user = game.users?.get(userId);
  if (!user) return;
  if (!seller.testUserPermission(user, "OWNER")) return;

  const sItem = seller.items?.get(sellerItemId);
  if (!sItem) return;

  quantity = Math.max(1, Math.min(99, Number(quantity)||1));

  const have = getItemQty(sItem);
  quantity = Math.min(quantity, have);

  const priceEach = Math.round(vendorBuybackPriceCP(sItem) * (effectiveItemValueCP(sItem) / Math.max(1, priceCPFromItem(sItem))));
  const total = priceEach * quantity;

  const infinite = (game.settings?.get?.("eq5e","vendorsInfiniteFunds") ?? true);

  if (!infinite) {
    const vcp = getActorCP(vendor);
    if (vcp < total) {
      ChatMessage.create({content: `<p><b>${vendor.name}</b> cannot afford to buy <b>${quantity}× ${sItem.name}</b>.</p>`});
      return;
    }
    await setActorCP(vendor, vcp - total);
  }

  const sellerCP = getActorCP(seller);
  await setActorCP(seller, sellerCP + total);

  // Reduce seller stack
  const newHave = have - quantity;
  if (newHave <= 0) {
    await seller.deleteEmbeddedDocuments("Item", [sItem.id]);
  } else {
    await sItem.update({ "system.eq5e.quantity": newHave });
  }

  // Add to vendor stock (merge stack where possible)
  const data = sItem.toObject();
  data.flags = data.flags || {};
  data.flags.eq5e = data.flags.eq5e || {};
  data.flags.eq5e.vendorItem = true;
  // Tag sold items with condition/quality so vendors can price accordingly
  data.flags.eq5e.condition = data.flags.eq5e.condition ?? "used";
  data.flags.eq5e.quality = data.flags.eq5e.quality ?? "worn";
  data.system = data.system || {};
  data.system.eq5e = data.system.eq5e || {};
  data.system.eq5e.quantity = quantity;

  const sk = stackKey(sItem);
  const stackable = isStackableItem(sItem);

  if (stackable) {
    const existing = vendor.items.find(i => i.flags?.eq5e?.vendorItem && stackKey(i) === sk);
    if (existing) {
      const q0 = getItemQty(existing);
      await existing.update({ "system.eq5e.quantity": q0 + quantity });
      ChatMessage.create({content: `<p><b>${seller.name}</b> sold <b>${quantity}× ${sItem.name}</b> for <b>${total}cp</b>.</p>`});
      return;
    }
  }

  await vendor.createEmbeddedDocuments("Item", [data]);
  ChatMessage.create({content: `<p><b>${seller.name}</b> sold <b>${quantity}× ${sItem.name}</b> for <b>${total}cp</b>.</p>`});
}

if (!game.eq5e.socket._initialized) {
  game.eq5e.socket._initialized = true;

  game.socket.on("system.eq5e", async (data) => {

if (data.type === "eq5e.setWards") {
  const { actorUuid, wards } = data;
  const actor = actorUuid ? await fromUuid(actorUuid) : null;
  if (!actor) return;
  if (!game.user.isGM) return;
  await actor.setFlag("eq5e", "wards", Array.isArray(wards) ? wards : []);
  return;
}


if (data.type === "eq5e.vendorBuy") {
  const { userId, buyerActorUuid, vendorActorUuid, vendorItemId, quantity } = data;
  if (!game.user.isGM) return;
  await gmVendorBuy({ userId, buyerActorUuid, vendorActorUuid, vendorItemId, quantity });
  return;
}

if (data.type === "eq5e.vendorSell") {
  const { userId, sellerActorUuid, vendorActorUuid, sellerItemId, quantity } = data;
  if (!game.user.isGM) return;
  await gmVendorSell({ userId, sellerActorUuid, vendorActorUuid, sellerItemId, quantity });
  return;
}

    try {
      if (!data || typeof data !== "object") return;
      if (!game.user.isGM) return; // only GM processes requests

      
if (data.type === "eq5e.activateDiscipline") {
  const { userId, actorUuid, itemUuid } = data;
  const actor = await fromUuid(actorUuid);
  if (!actor || actor.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  if (!actor.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] activateDiscipline denied (no OWNER perm)", { userId, actorUuid, itemUuid });
    return;
  }

  const item = actor.items?.get(itemUuid?.split(".").pop()) ?? actor.items?.find(i => i.uuid === itemUuid) ?? null;
  if (!item) return;

  await activateDiscipline({ actor, item, silent: false });
  return;
}

if (data.type === "eq5e.clearDiscipline") {
  const { userId, actorUuid } = data;
  const actor = await fromUuid(actorUuid);
  if (!actor || actor.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  if (!actor.testUserPermission(user, "OWNER")) return;

  await clearActiveDiscipline(actor);
  return;
}





if (data.type === "eq5e.feignDeath") {
  const { userId, actorUuid, durationRounds } = data;
  const user = game.users?.get(userId);
  if (!game.user.isGM || !user) return;

  const actor = await fromUuid(actorUuid);
  if (!actor || actor.documentName !== "Actor") return;
  if (!actor.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] feignDeath denied (no OWNER)", { userId, actorUuid });
    return;
  }

  await attemptFeignDeathActor(actor, { durationRounds: Number(durationRounds ?? 1) });
  return;
}


if (data.type === "eq5e.taunt") {
  const { userId, taunterActorUuid, targets, durationRounds, flatThreat, snapPct, reason } = data;
  const user = game.users?.get(userId);
  if (!game.user.isGM || !user) return;

  const taunterActor = await fromUuid(taunterActorUuid);
  if (!taunterActor || taunterActor.documentName !== "Actor") return;
  if (!taunterActor.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] taunt denied (no OWNER on taunter)", { userId, taunterActorUuid });
    return;
  }

  const list = Array.isArray(targets) ? targets : [];
  for (const t of list) {
    const npcActor = await fromUuid(t?.npcActorUuid);
    if (!npcActor || npcActor.documentName !== "Actor") continue;
    await applyTaunt({ npcActor, taunterActor, durationRounds: Number(durationRounds ?? 1), snapPct: Number(snapPct ?? 1.0) });
    const amt = Number(flatThreat ?? 0);
    if (amt) await addThreat({ npcActor, sourceActor: taunterActor, amount: amt, reason: String(reason ?? "taunt") });
  }
  return;
}
if (data.type === "eq5e.resurrectActor") {
  const { userId, targetActorUuid, sourceActorUuid, hpPct, sicknessRounds } = data;

  const targetActor = await fromUuid(targetActorUuid);
  if (!targetActor || targetActor.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  // Authorization:
  // - If sourceActorUuid provided, user must have OWNER on sourceActor (casting actor)
  // - Otherwise, user must have OWNER on the targetActor
  if (sourceActorUuid) {
    const sourceActor = await fromUuid(sourceActorUuid);
    if (!sourceActor || sourceActor.documentName !== "Actor") return;
    if (!sourceActor.testUserPermission(user, "OWNER")) {
      console.warn("[EQ5E] resurrect denied (no OWNER on sourceActor)", { userId, sourceActorUuid });
      return;
    }
    await resurrectActor({ targetActor, hpPct, sicknessRounds, sourceActor });
  } else {
    if (!targetActor.testUserPermission(user, "OWNER")) return;
    await resurrectActor({ targetActor, hpPct, sicknessRounds, sourceActor: null });
  }
  return;
}
if (data.type === "eq5e.dismissSummon") {
        const { userId, casterUuid, summonId } = data;
        const caster = await fromUuid(casterUuid);
        if (!caster || caster.documentName !== "Actor") return;

        const user = game.users?.get(userId);
        if (!user) return;

        // Authorization: requesting user must have OWNER permission on caster actor
        if (!caster.testUserPermission(user, "OWNER")) {
          console.warn("[EQ5E] DismissSummon denied (no OWNER perm)", { userId, casterUuid, summonId });
          return;
        }


if (data.type === "eq5e.updatePetConfig") {
  const { userId, ownerUuid, petUuid, summonId, summonType, changes } = data;
  const owner = await fromUuid(ownerUuid);
  if (!owner || owner.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  if (!owner.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] updatePetConfig denied (no OWNER perm)", { userId, ownerUuid, petUuid, summonId });
    return;
  }

  let petActor = petUuid ? await fromUuid(petUuid) : null;
  if (!petActor || petActor.documentName !== "Actor") {
    petActor = findActiveSummonForOwner({ ownerUuid, summonId, summonType });
  }
  if (!petActor) return;

  // Whitelist allowed updates (players can configure behavior, not raw stats)
  const allow = new Set([
    "ai.enabled",
    "ai.mode",
    "ai.stance",
    "ai.followDistance",
    "ai.autoTaunt",
    "ai.rotationProfile",
    "pet.nickname"
  ]);

  const patch = {};
  for (const [k, v] of Object.entries(changes ?? {})) {
    if (!allow.has(k)) continue;
    if (k.startsWith("ai.")) {
      const kk = k.slice(3);
      patch[`flags.eq5e.ai.${kk}`] = v;
    } else if (k.startsWith("pet.")) {
      const kk = k.slice(4);
      patch[`flags.eq5e.pet.${kk}`] = v;
    }
  }

  if (Object.keys(patch).length) await petActor.update(patch);

  // GM cue (whisper)
  try {
    const gmIds = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
    const ownerName = owner.name ?? "Owner";
    const petName = petActor.name ?? "Pet";
    const summary = Object.keys(patch).map(k => k.replace("flags.eq5e.","")).join(", ");
    await ChatMessage.create({
      content: `<p><b>Pet Config</b>: ${ownerName} updated ${petName}: ${summary}</p>`,
      whisper: gmIds
    });
  } catch (e) {}

  return;
}

if (data.type === "eq5e.renamePet") {
  const { userId, ownerUuid, petUuid, newName, summonId, summonType } = data;
  const owner = await fromUuid(ownerUuid);
  if (!owner || owner.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  if (!owner.testUserPermission(user, "OWNER")) return;

  let petActor = petUuid ? await fromUuid(petUuid) : null;
  if (!petActor || petActor.documentName !== "Actor") {
    petActor = findActiveSummonForOwner({ ownerUuid, summonId, summonType });
  }
  if (!petActor) return;

  const nm = String(newName ?? "").trim();
  if (!nm) return;
  await petActor.update({ name: nm });

  try {
    const gmIds = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
    await ChatMessage.create({
      content: `<p><b>Pet Rename</b>: ${owner.name} renamed pet to <b>${nm}</b>.</p>`,
      whisper: gmIds
    });
  } catch (e) {}

  return;
}


if (data.type === "eq5e.swapSummonVariant") {
  const { userId, ownerUuid, summonId, summonType, pack, name, tokenName, abilitiesPack, ai } = data;
  const owner = await fromUuid(ownerUuid);
  if (!owner || owner.documentName !== "Actor") return;

  const user = game.users?.get(userId);
  if (!user) return;

  if (!owner.testUserPermission(user, "OWNER")) {
    console.warn("[EQ5E] swapSummonVariant denied (no OWNER perm)", { userId, ownerUuid, summonId });
    return;
  }


if (data.type === "eq5e.applyCharm") {
  const { userId, casterUuid, targetTokenUuid, durationRounds, summonId } = data;
  const caster = await fromUuid(casterUuid);
  const targetTokenDoc = await fromUuid(targetTokenUuid);
  const targetToken = targetTokenDoc?.object ?? null;
  const targetActor = targetToken?.actor ?? null;

  if (!caster || caster.documentName !== "Actor") return;
  const user = game.users?.get(userId);
  if (!user) return;
  if (!caster.testUserPermission(user, "OWNER")) return;

  if (!targetToken || !targetActor) return;
  await applyCharmToTarget({ caster, casterToken: caster.getActiveTokens(true)?.[0] ?? null, targetActor, targetToken, durationRounds: Number(durationRounds||3), summonId: summonId ?? "enchanter.charm" });

  try {
    const gmIds = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
    await ChatMessage.create({
      content: `<p><b>Charm</b>: ${caster.name} charmed <b>${targetActor.name}</b>.</p>`,
      whisper: gmIds
    });
  } catch (e) {}
  return;
}


  // Dismiss existing summon (if any)
  try {
    await dismissSummonedPet({ ownerUuid, summonId, reason: "swap" });
  } catch (e) {}

  // Summon the requested variant
  const ownerTokens = owner.getActiveTokens(true);
  const casterToken = ownerTokens?.[0] ?? null;
  if (!casterToken) {
    console.warn("[EQ5E] swapSummonVariant: owner has no active token");
    return;
  }

  await summonPetFromCompendium({
    ownerActor: owner,
    casterToken,
    pack,
    name,
    tokenName: tokenName ?? name,
    summonId,
    summonType,
    abilitiesPack,
    ai: ai ?? { enabled: true, mode: "assist" }
  });

  try {
    const gmIds = game.users?.filter(u => u.isGM).map(u => u.id) ?? [];
    await ChatMessage.create({
      content: `<p><b>Pet Swap</b>: ${owner.name} swapped pet (${summonId}) → <b>${name}</b>.</p>`,
      whisper: gmIds
    });
  } catch (e) {}

  return;
}



        const res = await dismissSummonedPet({ ownerUuid: caster.uuid, summonId, reason: "dismissed" });
        console.log("[EQ5E] DismissSummon processed", res);
      }
    } catch (e) {
      console.error("[EQ5E] socket handler error", e);
    }
  });
}


  console.log("[EQ5E] System ready");
});

__eq5eRegisterSetting("eq5e", "aeExamplesOnStartup", {
  name: "Generate AE spell-effect example compendium on startup",
  hint: "Creates/updates world.eq5e-spell-effects-ae-examples showing ActiveEffect -> condition sync (silence/mez/root/snare).",
  scope: "world",
  config: true,
  type: Boolean,
  default: true
});

// EQ5E Song pulses: process maintained song damage ticks on combat round advance (GM drives state)
Hooks.on("updateCombat", async (combat, changed) => {
  try {
    if (!game.user.isGM) return;
    if (!combat) return;
    if (changed.round === undefined) return; // only on round changes
    await processSongPulses(combat);
  } catch (e) {
    console.error("[EQ5E] processSongPulses error", e);
  }
});
// EQ5E AA level interception: allow players to choose between leveling and AA purchase
Hooks.on("preUpdateActor", async (actor, update, options, userId) => {
  try {
    // Only handle owned actors and only for the user making the change
    if (userId !== game.user.id) return;
    if (!actor.isOwner) return;

    const newLevel = foundry.utils.getProperty(update, "system.details.level")
      ?? foundry.utils.getProperty(update, "system.level");
    if (newLevel === undefined) return;

    const oldLevel = Number(foundry.utils.getProperty(actor, "system.details.level")
      ?? foundry.utils.getProperty(actor, "system.level")
      ?? 1);
    const nextLevel = Number(newLevel);

    if (!Number.isFinite(nextLevel) || nextLevel <= oldLevel) return;

    const mode = actor.flags?.eq5e?.aa?.mode ?? "leveling";
    if (mode !== "aa") return; // normal leveling

    // Cancel the level increase and award AA points instead.
    // Foundry supports options.preventUpdate = true in preUpdate? We use a safe pattern: rewrite update to keep old level.
    if (foundry.utils.hasProperty(update, "system.details.level")) foundry.utils.setProperty(update, "system.details.level", oldLevel);
    if (foundry.utils.hasProperty(update, "system.level")) foundry.utils.setProperty(update, "system.level", oldLevel);

    const aaPerLevel = Number(game.settings.get("eq5e", "aaPerLevel") ?? 1);
    const aaMod = game.eq5e?.aa ?? (await import("./aa/aa.js"));
    await aaMod.awardAAPoints(actor, aaPerLevel);

    ui.notifications?.info(`EQ5E: ${actor.name} gained ${aaPerLevel} AA point(s) instead of leveling.`);
  } catch (e) {
    console.error("[EQ5E] AA level interception failed", e);
  }
});
function eq5eHash32(str) {
  // Deterministic 32-bit hash (FNV-1a)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function eq5eRoll01(seedStr) {
  const h = eq5eHash32(seedStr);
  // xorshift32
  let x = h || 0x12345678;
  x ^= x << 13; x >>>= 0;
  x ^= x >> 17; x >>>= 0;
  x ^= x << 5;  x >>>= 0;
  return (x >>> 0) / 4294967296;
}

function mapDamageTypeToResist(dmgType) {
  const dt = String(dmgType ?? "").toLowerCase();
  // Untyped / aliases
  if (dt === "arcane" || dt === "force") return "magic";
  if (dt === "lightning") return "electric";
  if (dt === "shock") return "electric";
  if (dt === "disease") return "disease";
  if (dt === "poison") return "poison";
  if (dt === "cold" || dt === "ice") return "cold";
  if (dt === "fire") return "fire";
  if (dt === "electric" || dt === "electricity") return "electric";
  // default bucket
  return "magic";
}

async function loadResistProfiles() {
  try {
    const url = _systemPath("eq5e", "data/resist-profiles.json");
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}

async function loadRacesClassic() {
  try {
    const url = _systemPath("eq5e", "data/races-classic.json");
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) { return []; }
}

function getRaceById(idOrKey) {
  const id = String(idOrKey ?? "").toLowerCase();
  return (game.eq5e?.races ?? {})[id] ?? null;
}

const applyRaceToActor = async function applyRaceToActor(actor, raceId) {
  try {
    if (!actor) return;
    const id = String(raceId ?? "").toLowerCase();
    const race = (game.eq5e?.races ?? {})[id] ?? null;
    if (!race) return;

    // Store canonical race flag
    await actor.update({ "flags.eq5e.raceId": id });

    // One stable Active Effect that mirrors race resists + basic metadata
    const existing = actor.effects?.find(e => e?.flags?.eq5e?.raceEffect === true) ?? null;

    const changes = [];
    // Resist bonuses land in flags.eq5e.resists.* (used by resist system)
    const resists = race.resists ?? {};
    for (const [k,v] of Object.entries(resists)) {
      changes.push({ key: `flags.eq5e.resists.${String(k).toLowerCase()}`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: Number(v) });
    }

    // Metadata flags (informational / future hooks)
    changes.push({ key: "flags.eq5e.race.name", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: String(race.name ?? id) });
    changes.push({ key: "flags.eq5e.race.size", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: String(race.size ?? "medium") });
    changes.push({ key: "flags.eq5e.race.vision", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: String(race.vision ?? "normal") });
    changes.push({ key: "flags.eq5e.race.movement", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: Number(race.movement ?? 30) });
    changes.push({ key: "flags.eq5e.race.hpRegenPerRound", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: Number(race.hpRegenPerRound ?? 0) });
    if (race.traits?.frontalStunImmune) {
      changes.push({ key: "flags.eq5e.race.frontalStunImmune", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: true });
    }

    
// Trait mirror (data-driven)
const traits = race.traits ?? {};
changes.push({ key: "flags.eq5e.race.traits", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: traits });
// Also mirror commonly used traits as direct flags for easy checks (optional)
if (traits.frontalStunImmune) changes.push({ key: "flags.eq5e.race.frontalStunImmune", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: true });
if (traits.threatMult) changes.push({ key: "flags.eq5e.race.threatMult", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: Number(traits.threatMult) });
if (traits.infravision) changes.push({ key: "flags.eq5e.race.infravision", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: true });
if (traits.manaMult) changes.push({ key: "flags.eq5e.race.manaMult", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: Number(traits.manaMult) });
if (traits.coldSlowDurAdj) changes.push({ key: "flags.eq5e.race.coldSlowDurAdj", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: Number(traits.coldSlowDurAdj) });
if (traits.sneakBonus) changes.push({ key: "flags.eq5e.race.sneakBonus", mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE, value: true });

const aeData = {
      name: `Race: ${race.name ?? id}`,
      icon: "system/eq5e/assets/eq5e.png",
      disabled: false,
      flags: { eq5e: { raceEffect: true, raceId: id } },
      changes
    };

    if (existing) {
      await existing.update(aeData);
    } else {
      await actor.createEmbeddedDocuments("ActiveEffect", [aeData]);
    }
  } catch(e) {
    console.warn("[EQ5E] applyRaceToActor failed", e);
  }
}


function getResistValue(targetActor, dmgType) {
  const dt = String(dmgType ?? "magic").toLowerCase();
  return Number(targetActor?.flags?.eq5e?.resists?.[dt] ?? targetActor?.system?.resists?.[dt] ?? 0);
}

function getPenetrationPct(sourceActor, dmgType) {
    const dt = String(dmgType ?? "").toLowerCase();
  // Wizard arcane penetration applies to magic bucket spells
  if (dt === "magic") return Number(sourceActor?.flags?.eq5e?.wizard?.arcanePenPct ?? 0);
  return 0;
}

/**
 * Apply per-damage-part resists deterministically.
 * - Full resist: 0 damage
 * - Partial resist: dmg * partialResist (e.g. lure)
 * Chance derived from resist stat and penetration.
 */
function applyResistsToDamagePart({ wf, dmgType, amount, partIndex }) {
  try {
    const source = wf?.sourceActor;
    const target = wf?.targetActor;
    if (!source || !target) return { amount, outcome: "none", resistChance: 0 };

    const isSpell = (wf.item?.type === "spell") || !!wf.item?.flags?.eq5e?.spell || (wf.item?.system?.actionType === "spell");
    if (!isSpell) return { amount, outcome: "none", resistChance: 0 };

      const dt = String(dmgType ?? "").toLowerCase();
    // Don't resist physical
    if (dt === "physical" || dt === "bludgeoning" || dt === "piercing" || dt === "slashing") return { amount, outcome: "none", resistChance: 0 };

    const resistVal = getResistValue(target, dt);
    const penPct = Math.max(0, Math.min(0.90, getPenetrationPct(source, dt)));
    // Convert resist value to chance. Tune: 100 resist ~= 50% chance before pen.
    let resistChance = Math.max(0, Math.min(0.75, (resistVal / 200)));
    resistChance = resistChance * (1 - penPct);

// Condition-driven resist adjustments (e.g., disease vulnerability debuffs)
try {
  const conds = target.flags?.eq5e?.conditions ?? {};
  for (const [cid, c] of Object.entries(conds)) {
    if (!c?.active) continue;
    const meta = c?.meta ?? null;
    if (!meta) continue;
    if (String(meta.resistFamily ?? "") === String(dt ?? "")) {
      const adj = Number(meta.resistPctAdj ?? 0);
      if (Number.isFinite(adj) && adj !== 0) resistChance = Math.max(0, Math.min(0.95, resistChance + adj));
    }
  }
} catch (e) {}


    if (resistChance <= 0 || amount <= 0) return { amount, outcome: "none", resistChance };

    const spellId = wf.item?.flags?.eq5e?.spell?.spellId ?? wf.item?.name ?? "spell";
    const round = Number(game.combat?.round ?? 0);
    const seed = `${round}|${source.uuid}|${target.uuid}|${spellId}|${dt}|${partIndex}`;
    const r = eq5eRoll01(seed);

    const partialResist = Number(wf.meta?.partialResist ?? wf.packet?.meta?.partialResist ?? 0);
    const fullThreshold = resistChance * (partialResist > 0 ? 0.45 : 1.0);
    const partialThreshold = resistChance;

    if (r < fullThreshold) return { amount: 0, outcome: "full", resistChance };
    if (r < partialThreshold && partialResist > 0) return { amount: Math.floor(amount * partialResist), outcome: "partial", resistChance };
    if (r < partialThreshold && partialResist <= 0) return { amount: 0, outcome: "full", resistChance };

    return { amount, outcome: "none", resistChance };
  } catch (e) {
    return { amount, outcome: "none", resistChance: 0 };
  }
}



/* ------------------------------ DISCIPLINE HUD ----------------------------- */

function _getDisciplineItemsForActor(actor) {
  return (actor?.items ?? []).filter(i => !!i?.flags?.eq5e?.discipline?.disciplineId);
}

// Ensure API bindings are populated even if the api object was created before these helpers were assigned.try {  if (game.eq5e?.api) {    game.eq5e.api.applyRaceToActor = applyRaceToActor;    game.eq5e.api.getRaceById = getRaceById;  }} catch (e) {}
async function _openDisciplineHudDialog(actor) {
  if (!actor) return;
  const active = getActiveDiscipline(actor);
  const items = _getDisciplineItemsForActor(actor).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  const options = items.map(i => `<option value="${i.id}">${i.name}</option>`).join("");

  const content = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div><b>Active:</b> ${active?.label ?? "—"}</div>
        <div style="opacity:.8;"><b>Remaining:</b> ${active ? Math.max(0, Number(active.endsAtRound ?? 0) - Number(game.combat?.round ?? 0)) : 0} r</div>
      </div>

      <div style="display:flex; gap:8px; align-items:center;">
        <label style="min-width:70px;">Activate</label>
        <select name="discPick" style="flex:1;">
          ${options}
        </select>
      </div>

      <div style="display:flex; gap:8px; justify-content:flex-end;">
        <button type="button" data-action="cancel" class="eq5e-disc-cancel"><i class="fa-solid fa-ban"></i> Cancel Active</button>
        <button type="button" data-action="activate" class="eq5e-disc-activate"><i class="fa-solid fa-bolt"></i> Activate</button>
      </div>
      <p style="margin:0; opacity:.75; font-size:12px;">Disciplines are exclusive. Activating one replaces the current discipline.</p>
    </div>
  `;

  const dlg = new Dialog({
    title: `${actor.name}: Disciplines`,
    content,
    buttons: {},
    render: (html) => {
      html.find(".eq5e-disc-cancel").on("click", async () => {
        await game.eq5e.api.clearActiveDisciplineSafe({ actor });
        dlg.close();
      });
      html.find(".eq5e-disc-activate").on("click", async () => {
        const id = String(html.find('select[name="discPick"]').val() ?? "");
        const item = actor.items?.get(id);
        if (!item) return ui.notifications?.warn("Discipline item not found on actor.");
        await game.eq5e.api.activateDisciplineSafe({ actor, item });
        dlg.close();
      });
    }
  }, { width: 420 });

  dlg.render(true);
}

Hooks.on("renderTokenHUD", (hud, html, data) => {
  try {
    const token = canvas.tokens?.get(data._id);
    const actor = token?.actor;
    if (!actor) return;

    const active = getActiveDiscipline(actor);
    if (!active) return;

    const eff = active.effects ?? {};
    const bits = [];
    if (Number(eff.extraAttacks ?? 0) > 0) bits.push(`+${Number(eff.extraAttacks)} atk`);
    if (eff.cleaveAdjacent) bits.push("cleave");
    if (eff.attackOverride) bits.push("override");
    if (Number(eff.incomingPhysicalMult ?? 1) !== 1) bits.push("guard");
    if (Number(eff.attackPenalty ?? 0) > 0) bits.push(`-${Number(eff.attackPenalty)} hit`);
    if (eff.rootSelf) bits.push("rooted");

    const r = Number(game.combat?.round ?? 0);
    const rem = Math.max(0, Number(active.endsAtRound ?? 0) - r);

    const clickable = actor.isOwner;
    const pill = $(`
      <div class="eq5e-discipline-pill" style="position:absolute; left:50%; transform:translateX(-50%); bottom:-18px; padding:2px 8px; border-radius:999px; font-size:11px; line-height:16px; background:rgba(0,0,0,.72); border:1px solid rgba(255,255,255,.15); white-space:nowrap; ${clickable ? "pointer-events:auto; cursor:pointer;" : "pointer-events:none;"}">
        <b>${active.label}</b> <span style="opacity:.8;">(${rem}r)</span>${bits.length?` <span style="opacity:.65;">• ${bits.join(" • ")}</span>`:""}
      </div>
    `);

    if (clickable) {
      pill.attr("title", eff.rootSelf ? "Rooted (cannot move). Click to manage disciplines" : "Click to manage disciplines");
      pill.on("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        _openDisciplineHudDialog(actor);
      });
    }

    html.append(pill);
  } catch (e) { console.error("[EQ5E] discipline HUD pill failed", e); }
});

/* --------------------------- ROTATION ENGINE --------------------------- */
/**
 * Deterministic rotation executor.
 * Uses owned items only (spells/feats/disciplines) and respects mana + cooldowns.
 * Profiles: balanced | offensive | defensive | control
 */

function getActorClassId(actor) {
  return String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? "").toLowerCase();
}

function getRotationProfile(actor) {
  return String(actor?.flags?.eq5e?.rotation?.profile ?? "balanced");
}

function setRotationProfile(actor, profile) {
  return actor?.setFlag?.("eq5e","rotation.profile", String(profile ?? "balanced"));
}

function rotationMana(actor) {
  try { return Number(actor?.system?.attributes?.mp?.value ?? actor?.system?.attributes?.mana?.value ?? 0) || 0; } catch(e){ return 0; }
}
function rotationHpPct(actor) {
  try {
    const hp = Number(actor?.system?.attributes?.hp?.value ?? 0);
    const mx = Number(actor?.system?.attributes?.hp?.max ?? hp);
    return mx>0 ? (hp/mx) : 1;
  } catch(e){ return 1; }
}

function itemSpellFlags(item) { return item?.flags?.eq5e?.spell ?? null; }
function itemKind(item) {
  const sp = itemSpellFlags(item);
  return String(sp?.kind ?? sp?.meta?.kind ?? "").toLowerCase();
}
function itemTags(item) {
  const sp = itemSpellFlags(item);
  const tags = sp?.meta?.tags ?? sp?.meta?.tag ?? sp?.tags ?? [];
  if (Array.isArray(tags)) return tags.map(t=>String(t).toLowerCase());
  if (typeof tags === "string") return tags.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  return [];
}
function itemManaCost(item) {
  const sp = itemSpellFlags(item);
  return Number(sp?.manaCost ?? sp?.meta?.mana ?? 0) || 0;
}

function canUseItemNow(actor, item) {
  if (!actor || !item) return { ok:false, reason:"Missing" };
  const cost = itemManaCost(item);
  if (rotationMana(actor) < cost) return { ok:false, reason:"No mana" };
  const key = `item:${item.uuid}`;
  const onCd = game.eq5e?.api?.isOnCooldown?.(actor, key);
  if (onCd) return { ok:false, reason:"Cooldown" };
  return { ok:true, reason:"" };
}

function pickHighestBy(actor, items, scoreFn) {
  let best = null;
  for (const it of items) {
    const chk = canUseItemNow(actor, it);
    if (!chk.ok) continue;
    const s = scoreFn(it);
    if (!best || s > best.s) best = { it, s };
  }
  return best?.it ?? null;
}

function pickByTag(actor, items, tag) {
  const t = String(tag).toLowerCase();
  const filtered = items.filter(i => itemTags(i).includes(t));
  if (!filtered.length) return null;
  return pickHighestBy(actor, filtered, (it) => Number(itemSpellFlags(it)?.rank ?? 0));
}


function pickByTags(actor, items, tagsInPriority = []) {
  for (const t of (tagsInPriority ?? [])) {
    const it = pickByTag(actor, items, t);
    if (it) return it;
  }
  return null;
}


function pickByKind(actor, items, kind) {
  const k = String(kind).toLowerCase();
  const filtered = items.filter(i => itemKind(i) === k);
  if (!filtered.length) return null;
  return pickHighestBy(actor, filtered, (it) => {
    const sp = itemSpellFlags(it);
    const parts = sp?.damageParts ?? sp?.meta?.damageParts ?? [];
    const dmg = Array.isArray(parts) ? parts.reduce((a,p)=>a+Number(p?.amount ?? 0),0) : 0;
    const heal = Number(sp?.meta?.healAmount ?? 0);
    return (Number(sp?.rank ?? 0) * 1000) + dmg + heal;
  });
}

function hasPet(actor) {
  try {
    const a = game.actors?.contents ?? [];
    return !!a.find(p => p?.flags?.eq5e?.summon?.active === true && p?.flags?.eq5e?.summon?.ownerUuid === actor.uuid);
  } catch(e){ return false; }
}


function pickDefensive(actor, items) {
  const hp = rotationHpPct(actor);
  if (hp <= 0.35) return pickByTags(actor, items, ["heal:complete","heal:big","ward","heal"]) || pickByKind(actor, items, "heal");
  if (hp <= 0.55) return pickByTags(actor, items, ["heal:big","heal:primary","ward","heal"]) || pickByKind(actor, items, "heal");
  return pickByTags(actor, items, ["defensive","ward","aegis"]) || null;
}


function pickDebuff(actor, items) {
  return pickByTags(actor, items, ["debuff:resist","debuff","slow","snare"]) || null;
}
function pickTaunt(actor, items) {
  return pickByKind(actor, items, "taunt") || pickByTag(actor, items, "taunt") || null;
}

function pickNuke(actor, items) {
  return pickByTags(actor, items, ["nuke:primary","nuke:aoe","nuke","damage"]) || pickByKind(actor, items, "damage");
}

function pickDoT(actor, items) {
  return pickByTags(actor, items, ["dot:primary","dot"]) || null;
}

function pickCC(actor, items) {
  return pickByTags(actor, items, ["mez:single","mez","root","stun","charm"]) || null;
}

function pickBuff(actor, items) {
  return pickByTags(actor, items, ["aura","buff","haste","mana","familiar","ds"]) || null;
}

function pickPetSummon(actor, items) {
  if (hasPet(actor)) return null;
  const summons = items.filter(i => !!itemSpellFlags(i)?.meta?.summon);
  if (!summons.length) return null;
  // prefer explicit tag if present
  return pickByTags(actor, summons, ["pet:summon"]) || pickHighestBy(actor, summons, (it)=> Number(itemSpellFlags(it)?.rank ?? 0));
}


async function rotationPickForClass(actor, targetToken) {
  const items = actor?.items?.contents ?? [];
  const cls = getActorClassId(actor);
  const profile = getRotationProfile(actor);

  const maybePet = pickPetSummon(actor, items);

  const isTank = ["warrior","paladin","shadowknight"].includes(cls);
  const isHealer = ["cleric","shaman","druid"].includes(cls);
  const isCC = ["enchanter","bard"].includes(cls);
  const isPetCaster = ["magician","necromancer","beastlord","shaman","ranger","shadowknight"].includes(cls);
  const isWizard = cls === "wizard";
  const isNecro = cls === "necromancer";
  const isBard = cls === "bard";
  const isEnch = cls === "enchanter";

  // Per-class priority tables (tags-first, deterministic)
  const order = {
    wizard: {
      offensive: ["nuke:primary","nuke:aoe","manaburn","debuff:resist","root","snare","buff","aura"],
      balanced:  ["debuff:resist","nuke:primary","nuke:aoe","root","snare","buff","aura"],
      defensive: ["ward","buff","aura","root","snare","nuke:primary"],
      control:   ["root","snare","nuke:primary","nuke:aoe"]
    },
    cleric: {
      offensive: ["stun","debuff","nuke","buff","aura"],
      balanced:  ["heal:big","heal:primary","cure","buff","aura","stun","heal:complete"],
      defensive: ["heal:complete","heal:big","heal:primary","ward","cure","buff","aura"],
      control:   ["stun","cure","buff","aura"]
    },
    enchanter: {
      offensive: ["debuff:resist","slow","nuke","buff","mana","haste","ward"],
      balanced:  ["mez:single","debuff:resist","slow","buff","mana","haste","ward","nuke"],
      defensive: ["ward","mez:single","debuff:resist","slow","buff","mana","haste"],
      control:   ["mez:single","charm","root","debuff:resist","slow"]
    },
    bard: {
      offensive: ["song:buff","song","debuff","nuke","dot"],
      balanced:  ["song:buff","song","song:cc","mez:single","snare","debuff"],
      defensive: ["song:buff","ward","song","song:cc","mez:single"],
      control:   ["song:cc","mez:single","root","snare","debuff"]
    },
    shadowknight: {
      offensive: ["taunt","debuff:resist","debuff","lifetap","dot","nuke","ward"],
      balanced:  ["taunt","debuff:resist","debuff","ward","lifetap","dot","nuke"],
      defensive: ["ward","heal","taunt","debuff","lifetap"],
      control:   ["taunt","fear","snare","debuff"]
    },
    paladin: {
      offensive: ["stun","taunt","debuff","nuke","heal:primary"],
      balanced:  ["taunt","stun","heal:primary","buff","aura","debuff"],
      defensive: ["heal:big","heal:primary","ward","taunt","stun"],
      control:   ["stun","taunt","debuff"]
    },
    druid: {
      offensive: ["dot","nuke:primary","nuke:aoe","snare","root","buff"],
      balanced:  ["buff","aura","snare","root","dot","nuke:primary"],
      defensive: ["heal:big","heal:primary","ward","root","snare"],
      control:   ["root","snare","dot","nuke:primary"]
    },
    shaman: {
      offensive: ["slow","dot","nuke","buff","aura"],
      balanced:  ["pet:summon","slow","buff","aura","dot","nuke","heal:primary"],
      defensive: ["heal:big","heal:primary","ward","slow","buff","aura"],
      control:   ["slow","root","snare","dot"]
    },
    necromancer: {
      offensive: ["dot","lifetap","nuke","snare","fear","debuff:resist"],
      balanced:  ["pet:summon","snare","dot","lifetap","debuff:resist","nuke"],
      defensive: ["ward","lifetap","snare","dot"],
      control:   ["fear","snare","root","dot"]
    },
    beastlord: {
      offensive: ["pet:summon","buff","haste","dot","nuke","slow"],
      balanced:  ["pet:summon","buff","haste","slow","dot","nuke"],
      defensive: ["ward","heal:primary","buff","slow"],
      control:   ["slow","snare","root","dot"]
    },
    ranger: {
      offensive: ["snare","dot","nuke","buff"],
      balanced:  ["buff","snare","dot","nuke"],
      defensive: ["ward","heal:primary","snare"],
      control:   ["snare","root","dot"]
    }
  };

  const clsOrder = order[cls]?.[profile] ?? null;
  if (clsOrder && clsOrder.length) {
    const byTags = pickByTags(actor, items, clsOrder);
    if (byTags) return byTags;
  }

  // Universal pet opener for pet classes
  if (isPetCaster && maybePet) return maybePet;

  // Fallback generic logic
  if (profile === "defensive") {
    return pickDefensive(actor, items) || (isTank ? pickTaunt(actor, items) : null) || pickDebuff(actor, items) || pickNuke(actor, items) || maybePet;
  }
  if (profile === "control") {
    return pickCC(actor, items) || pickDebuff(actor, items) || (isTank ? pickTaunt(actor, items) : null) || pickNuke(actor, items) || maybePet;
  }
  if (profile === "offensive") {
    return (isTank ? pickTaunt(actor, items) : null) || pickDebuff(actor, items) || pickDoT(actor, items) || pickNuke(actor, items) || pickBuff(actor, items) || maybePet;
  }

  // Balanced (default)
  if (isTank) {
    return pickTaunt(actor, items) || pickDebuff(actor, items) || pickDefensive(actor, items) || pickNuke(actor, items) || maybePet;
  }
  if (isCC) {
    return pickCC(actor, items) || pickDebuff(actor, items) || pickNuke(actor, items) || maybePet;
  }
  // Healers generally keep buffs / steady heals; without party context, prefer buffs then heals.
  if (isHealer) {
    return pickBuff(actor, items) || pickByKind(actor, items, "heal") || pickDebuff(actor, items) || maybePet;
  }
  return pickDebuff(actor, items) || pickDoT(actor, items) || pickNuke(actor, items) || pickBuff(actor, items) || maybePet;
}

function findLowestHpFriendlyToken(casterToken) {
  try {
    const caster = casterToken ?? canvas.tokens?.controlled?.[0] ?? null;
    const disp = caster?.document?.disposition ?? caster?.document?.data?.disposition ?? null;
    const tokens = canvas.tokens?.placeables ?? [];
    const friends = tokens.filter(t => t?.actor && t?.document?.disposition === disp);
    let best = null;
    let bestPct = 1.01;
    for (const t of friends) {
      const hp = getHP(t.actor);
      if (!hp?.max) continue;
      const pct = clamp(Number(hp.value ?? 0) / Number(hp.max ?? 1), 0, 1);
      if (pct < bestPct) { bestPct = pct; best = t; }
    }
    return best;
  } catch (e) { return null; }
}


function rotationLowestFriendlyHpPct(casterToken) {
  try {
    const caster = casterToken ?? canvas.tokens?.controlled?.[0] ?? null;
    const disp = caster?.document?.disposition ?? null;
    const tokens = canvas.tokens?.placeables ?? [];
    const friends = tokens.filter(t => t?.actor && t?.document?.disposition === disp);
    let bestPct = 1.0;
    for (const t of friends) {
      const hp = getHP(t.actor);
      if (!hp?.max) continue;
      const pct = clamp(Number(hp.value ?? 0) / Number(hp.max ?? 1), 0, 1);
      if (pct < bestPct) bestPct = pct;
    }
    return bestPct;
  } catch (e) { return 1.0; }
}

async function executeRotation({ actor, casterToken, targetToken } = {}) {
  actor = actor ?? casterToken?.actor ?? null;
  if (!actor) return { ok:false, reason:"No actor" };
  if (!actor.isOwner) return { ok:false, reason:"Not owner" };

  casterToken = casterToken ?? actor.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.find(t=>t.actor?.id===actor.id) ?? null;
  const pick = rotationPickForClass(actor, targetToken);
  if (!pick) return { ok:false, reason:"No valid rotation action" };

  const target = targetToken?.actor ?? null;

  if (itemSpellFlags(pick)) {
    const res = await game.eq5e?.api?.castSpell?.({ caster: actor, casterToken, target, targetToken, item: pick });
    return res ?? { ok:true };
  }
  return { ok:false, reason:"Unsupported item type for rotation" };
}




/* ------------------------- AUTO ROTATION ------------------------- */

function isAutoRotationTargetOnly(actor) {
  return !!(actor?.flags?.eq5e?.rotation?.requireTarget === true);
}

async function setAutoRotationTargetOnly(actor, enabled) {
  return actor?.setFlag?.("eq5e","rotation.requireTarget", !!enabled);
}

function isAutoRotationEnabled(actor) {
  return !!(actor?.flags?.eq5e?.rotation?.auto === true);
}

async function setAutoRotation(actor, enabled) {
  return actor?.setFlag?.("eq5e","rotation.auto", !!enabled);
}

function lastTurnKey(combat, combatant) {
  return `${combat?.id ?? "?"}:${combat?.round ?? 0}:${combat?.turn ?? 0}:${combatant?.id ?? "?"}`;
}

function shouldGMRunRotationFor(actor) {
  // Prefer the actual player-owner to run their own auto-rotation; GM only runs if no active non-GM owner exists.
  try {
    const owners = game.users?.contents?.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER")) ?? [];
    const active = owners.find(u => u.active);
    return !active; // GM runs only if no active player owner
  } catch (e) { return true; }
}

async function maybeAutoRotate(combat, changes = {}) {
  try {
    if (!combat?.started) return;
    // Only react when turn/round/combatant changes
    const turnChanged = ("turn" in changes) || ("round" in changes) || ("combatantId" in changes);
    if (!turnChanged) return;

    const c = combat.combatant;
    if (!c) return;
    const actor = c.actor;
    if (!actor) return;
    if (!isAutoRotationEnabled(actor)) return;

    // Ownership gating
    if (!actor.testUserPermission(game.user, "OWNER")) return;
    if (game.user.isGM && !shouldGMRunRotationFor(actor)) return;

    const key = lastTurnKey(combat, c);
    const last = actor?.flags?.eq5e?.rotation?.lastTurnKey;
    if (last === key) return; // already ran this turn
    await actor.setFlag("eq5e","rotation.lastTurnKey", key);

    // Determine caster/target tokens
    const casterToken = c.token ?? actor.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null;
    const targetToken = game.user.targets?.first?.() ?? null;
    if (isAutoRotationTargetOnly(actor) && !targetToken) return;

    // Execute exactly once at turn start (deterministic)
    const res = await executeRotation({ actor, casterToken, targetToken });
    if (!res?.ok) {
      // Quiet failure; users can still click Execute manually.
      // Uncomment for debugging:
      // console.warn("[EQ5E] auto-rotation skipped:", res?.reason);
    }
  } catch (e) {
    console.error("[EQ5E] auto-rotation error", e);
  }
}

Hooks.on("updateCombat", (combat, changes, opts, userId) => {
  // Only the client whose userId matches should consider running (prevents spam)
  try {
    if (userId && userId !== game.userId) return;
  } catch (e) {}
  maybeAutoRotate(combat, changes);
});

/* ------------------------- GENERIC ROTATION WIDGET ------------------------- */
Hooks.on("renderActorSheet", (app, html) => {
  try {
    const actor = app?.actor;
    if (!actor || !actor.isOwner) return;
    const cls = getActorClassId(actor);
    if (!cls) return;

    const root = html?.[0]?.querySelector?.(".window-content");
    if (!root) return;
    if (root.querySelector?.(".eq5e-rotation-widget")) return;

    const profile = getRotationProfile(actor);

    const wrap = document.createElement("section");
    wrap.className = "eq5e-rotation-widget";
    wrap.innerHTML = `
      <header class="head">
        <div class="title">Rotation</div>
        <div class="meta">Class: <b>${cls}</b></div>
      </header>
      <div class="row">
        <label>Profile
          <select class="eq5e-rot-profile">
            <option value="balanced">Balanced</option>
            <option value="offensive">Offensive</option>
            <option value="defensive">Defensive</option>
            <option value="control">Control</option>
          </select>
        </label>
        <button type="button" class="eq5e-rot-exec"><i class="fa-solid fa-robot"></i> Execute</button>
        <label class="auto"><input type="checkbox" class="eq5e-rot-auto"> Auto</label>
        <label class="auto"><input type="checkbox" class="eq5e-rot-requiretarget"> Target Only</label>
        <span class="hint muted">Uses owned items only (mana + cooldown aware). Target optional.</span>
      </div>
      <div class="row2 muted">Tip: select a target to bias toward taunts/debuffs/CC.</div>
    `;

    root.prepend(wrap);
    const sel = wrap.querySelector(".eq5e-rot-profile");
    sel.value = profile;

const autoChk = wrap.querySelector(".eq5e-rot-auto");
autoChk.checked = !!(actor?.flags?.eq5e?.rotation?.auto === true);

const tgtChk = wrap.querySelector(".eq5e-rot-requiretarget");
tgtChk.checked = !!(actor?.flags?.eq5e?.rotation?.requireTarget === true);
tgtChk.addEventListener("change", async (ev) => {
  await setAutoRotationTargetOnly(actor, ev.target.checked);
  ui.notifications?.info(`Auto-rotation requires target: ${ev.target.checked ? "ON" : "OFF"}`);
});

autoChk.addEventListener("change", async (ev) => {
  await setAutoRotation(actor, ev.target.checked);
  ui.notifications?.info(`Auto-rotation: ${ev.target.checked ? "ON" : "OFF"}`);
});

    sel.addEventListener("change", async (ev) => {
      await setRotationProfile(actor, ev.target.value);
      ui.notifications?.info(`Rotation profile set: ${ev.target.value}`);
    });

    wrap.querySelector(".eq5e-rot-exec")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      const casterToken = actor.getActiveTokens?.()[0] ?? canvas.tokens?.controlled?.[0] ?? null;
      const targetToken = game.user.targets?.first?.() ?? null;
    if (isAutoRotationTargetOnly(actor) && !targetToken) return;
      const res = await executeRotation({ actor, casterToken, targetToken });
      if (!res?.ok) ui.notifications?.warn(`Rotation: ${res?.reason ?? "failed"}`);
    });
  } catch (e) { console.error("[EQ5E] rotation widget error", e); }
});



/* -------- EQ5E GM HUD AUTO ROTATION INDICATOR -------- */
Hooks.on("renderEq5eGmHud", (app, html) => {
  try {
    if (!game.user.isGM) return;
    html.find("[data-actor-id]").each((_, el) => {
      const aid = el.dataset.actorId;
      const actor = game.actors?.get(aid);
      if (!actor) return;
      if (actor?.flags?.eq5e?.rotation?.auto === true) {
        if (!el.querySelector(".eq5e-auto-rot")) {
          const span = document.createElement("span");
          span.className = "eq5e-auto-rot";
          span.title = "Auto-Rotation ON";
          span.textContent = "⚙️";
          el.appendChild(span);
        }
      }
    });
  } catch (e) { console.error("[EQ5E] GM HUD auto-rot indicator error", e); }
});



Hooks.on("combatRound", async (combat, round) => {
  await snapshotThreatRoundStart(combat);
});

Hooks.on("combatStart", async (combat) => {
  await snapshotThreatRoundStart(combat);
});



/* -------------------- Threat Transfer Round Tracking -------------------- */
Hooks.on("combatStart", async (combat) => {
  try {
    game.eq5e.threatTransfersThisRound = game.eq5e.threatTransfersThisRound ?? {};
    game.eq5e.threatTransfersThisRound[combat.id] = {};
    game.eq5e.threatTransfersThisRound[combat.id][Number(combat.round ?? 0)] = {};
  } catch(e) {}
});

Hooks.on("combatRound", async (combat, round) => {
  try {
    game.eq5e.threatTransfersThisRound = game.eq5e.threatTransfersThisRound ?? {};
    game.eq5e.threatTransfersThisRound[combat.id] = game.eq5e.threatTransfersThisRound[combat.id] ?? {};
    game.eq5e.threatTransfersThisRound[combat.id][Number(round ?? combat.round ?? 0)] = {};
  } catch(e) {}
});


/* -------------------- Token HUD: Pet Threat Sponge -------------------- */
Hooks.on("renderTokenHUD", (hud, html, data) => {
  try {
    const token = canvas.tokens?.get(data?._id) ?? hud?.object ?? null;
    const actor = token?.actor ?? null;
    if (!actor) return;

    const ownerUuid = actor.flags?.eq5e?.pet?.ownerUuid ?? null;
    if (!ownerUuid) return;

    // resolve owner and compute transfer pct
    fromUuid(ownerUuid).then(owner => {
      const ownerActor = owner?.actor ?? owner;
      if (!ownerActor) return;
      const mods = getOwnerAggroMods(ownerActor);
      const pct = Number(mods?.petThreatTransferPct ?? 0);
      const stance = String(actor.flags?.eq5e?.pet?.stance ?? "").toLowerCase();
      const active = actor.flags?.eq5e?.pet?.active !== false;
      if (!(pct > 0 && active && stance === "guard")) return;

      const pill = document.createElement("div");
      pill.className = "eq5e-threat-sponge-pill";
      pill.style.position = "absolute";
      pill.style.left = "6px";
      pill.style.top = "6px";
      pill.style.padding = "2px 6px";
      pill.style.borderRadius = "999px";
      pill.style.fontSize = "12px";
      pill.style.background = "rgba(0,0,0,0.65)";
      pill.style.color = "white";
      pill.style.pointerEvents = "none";
      pill.title = `Threat Sponge: ON (+${Math.round(pct*100)}%)\nOwner: ${ownerActor.name}`;
      pill.textContent = `Sponge +${Math.round(pct*100)}%`;
      html[0].appendChild(pill);
    }).catch(()=>{});

/* -------------------- Token HUD: Owner Threat Sponge -------------------- */
Hooks.on("renderTokenHUD", (hud, html, data) => {
  try {
    const token = canvas.tokens?.get(data?._id) ?? hud?.object ?? null;
    const actor = token?.actor ?? null;
    if (!actor) return;

    // owner pill only for non-pet actors
    if (actor.flags?.eq5e?.pet?.ownerUuid) return;

    const mods = getOwnerAggroMods(actor);
    const pct = Number(mods?.petThreatTransferPct ?? 0);
    if (!(pct > 0)) return;

    // ensure owner has an active guard pet
    const pet = findActiveGuardPetForOwner(actor);
    if (!pet) return;

    const pill = document.createElement("div");
    pill.className = "eq5e-owner-threat-sponge-pill";
    pill.style.position = "absolute";
    pill.style.right = "6px";
    pill.style.top = "6px";
    pill.style.padding = "2px 6px";
    pill.style.borderRadius = "999px";
    pill.style.fontSize = "12px";
    pill.style.background = "rgba(20,60,120,0.75)";
    pill.style.color = "white";
    pill.style.pointerEvents = "none";
    const cap = Number(game.settings.get("eq5e","petThreatTransferCapPerEvent") ?? 0);
    pill.title = `Threat Transfer Active\\nTo pet: ${pet.name}\\nRate: +${Math.round(pct*100)}%\\nCap/event: ${cap>0 ? cap : "∞"}`;
    pill.textContent = `Transfer +${Math.round(pct*100)}%`;
    html[0].appendChild(pill);
  } catch(e) {
    console.warn("[EQ5E] renderTokenHUD owner threat sponge pill failed", e);
  }
});

  } catch(e) {
    console.warn("[EQ5E] renderTokenHUD threat sponge pill failed", e);
  }
});



/* -------------------- Token HUD: GM Threat Bar (NPCs) -------------------- */

Hooks.on("renderTokenHUD", (hud, html, data) => {
  try {
    if (!game.user.isGM) return;
    const token = canvas.tokens?.get(data?._id) ?? hud?.object ?? null;
    const actor = token?.actor ?? null;
    if (!actor) return;
    const isNpc = (actor.type === "npc") || (actor.system?.details?.type === "npc") || (actor.flags?.eq5e?.isNpc === true);
    if (!isNpc) return;
    const top = game.eq5e?.api?.getTopThreatEntries?.(actor, 3) ?? [];
    if (!top.length) return;

    const t1 = top[0];
    const t2 = top[1] ?? null;
    const t3 = top[2] ?? null;
    const sum = Math.max(1, Number(t1.threat ?? 0) + Number(t2?.threat ?? 0) + Number(t3?.threat ?? 0));
    const p1 = Math.max(0, Math.min(1, Number(t1.threat ?? 0) / sum));
    const p2 = t2 ? Math.max(0, Math.min(1, Number(t2.threat ?? 0) / sum)) : 0;
    const p3 = t3 ? Math.max(0, Math.min(1, Number(t3.threat ?? 0) / sum)) : 0;

    const bar = document.createElement("div");
    bar.className = "eq5e-threatbar" + ((imminent && pulseEnabled) ? " eq5e-threatbar-imminent" : "");
    bar.style.position = "absolute";
    bar.style.left = "6px";
    bar.style.right = "6px";
    bar.style.bottom = "6px";
    bar.style.height = "6px";
    bar.style.borderRadius = "6px";
    bar.style.background = "rgba(0,0,0,0.45)";
    bar.style.overflow = "hidden";
    bar.style.pointerEvents = "none";

    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.width = "100%";
    wrap.style.height = "100%";

    const seg = (pct, color) => {
      const d = document.createElement("div");
      d.style.height = "100%";
      d.style.width = `${Math.round(pct*100)}%`;
      d.style.background = color;
      return d;
    };
    
// Threat bar color shift based on gap severity
const gap = t2 ? Math.floor(Number(t1.threat ?? 0) - Number(t2.threat ?? 0)) : Infinity;
const thr = Number(game.settings.get("eq5e","threatFlipGapThreshold") ?? 0);
const sev = (thr>0 && isFinite(gap)) ? Math.max(0, Math.min(1, 1 - (gap / thr))) : 0;
const red = Math.round(220 + (255-220)*sev);
const green = Math.round(60 * (1-sev));
const col1 = `rgba(${red},${green},60,0.9)`;
    const pulseEnabled = !!game.settings.get("eq5e","threatFlipPulseEnabled");
    const imminent = (thr>0 && isFinite(gap) && gap <= thr);

wrap.appendChild(seg(p1, col1));

    if (t2) wrap.appendChild(seg(p2, "rgba(240,180,60,0.9)"));
    if (t3) wrap.appendChild(seg(p3, "rgba(180,180,180,0.9)"));

    bar.appendChild(wrap);

    // Tooltip with top 3
    try {
      const nm = (uu) => (game.combat?.combatants?.find(x => x.actor?.uuid === uu)?.actor?.name ?? uu);
      const parts = [`#1 ${nm(t1.uuid)} (${Math.floor(t1.threat)})`];
      if (t2) parts.push(`#2 ${nm(t2.uuid)} (${Math.floor(t2.threat)})`);
      if (t3) parts.push(`#3 ${nm(t3.uuid)} (${Math.floor(t3.threat)})`);
      bar.title = `Threat: ${parts.join(" | ")}`;
    } catch(e) {}

    // Flip warning if gap <= threshold
    try {
      const thr = Number(game.settings.get("eq5e","threatFlipGapThreshold") ?? 0);
      if (t2 && thr > 0) {
        const gap = Math.floor(Number(t1.threat ?? 0) - Number(t2.threat ?? 0));
        if (gap <= thr) {
          const warn = document.createElement("div");
          warn.className = "eq5e-threatbar-warning" + ((pulseEnabled) ? " eq5e-threatbar-warning-pulse" : "");
          warn.textContent = "Flip?";
          warn.style.position = "absolute";
          warn.style.right = "8px";
          warn.style.bottom = "14px";
          warn.style.fontSize = "11px";
          warn.style.padding = "1px 6px";
          warn.style.borderRadius = "10px";
          warn.style.background = "rgba(200,0,0,0.75)";
          warn.style.color = "white";
          warn.style.pointerEvents = "none";
          warn.title = `Threat gap (#1-#2): ${gap} ≤ ${thr}`;
          html[0].appendChild(warn);
        }
      }
    } catch(e) {}

    html[0].appendChild(bar);
  } catch(e) {
    console.warn("[EQ5E] GM threat bar HUD failed", e);
  }
});



/* -------------------- Post-Combat Threat Summary -------------------- */
Hooks.on("combatEnd", async (combat) => {
  try {
    if (!game.user.isGM) return;
    const cid = combat.id;
    const rounds = game.eq5e?.threatRoundStart?.[cid] ?? {};
    const totals = {};
    for (const r of Object.keys(rounds)) {
      const snap = rounds[r];
      for (const npcUuid of Object.keys(snap)) {
        const entries = snap[npcUuid];
        for (const [attUuid, val] of Object.entries(entries)) {
          totals[attUuid] = Number(totals[attUuid] ?? 0) + Number(val ?? 0);
        }
      }
    }
    const rows = Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,10);
    if (!rows.length) return;

    const renderName = (uuid) => {
      const c = game.combat?.combatants?.find(x=>x.actor?.uuid===uuid);
      return c?.actor?.name ?? uuid;
    };

    let html = `<h3>Post-Combat Threat Summary</h3><table style="width:100%"><tr><th align="left">Actor</th><th align="right">Threat</th></tr>`;
    for (const [uuid,val] of rows) {
      html += `<tr><td>${renderName(uuid)}</td><td align="right">${Math.floor(val)}</td></tr>`;
    }
    html += `</table>`;

    new Dialog({
      title: "EQ5e Threat Summary",
      content: html,
      
buttons: {
  chat: {
    label: "Export to Chat",
    callback: () => {
      const lines = rows.map(([uuid,val]) => `• ${renderName(uuid)}: ${Math.floor(val)}`);
      ChatMessage.create({content: `<b>Post-Combat Threat Summary</b><br>`+lines.join("<br>")});
    }
  },
  json: {
    label: "Copy JSON",
    callback: () => {
      const payload = rows.map(([uuid,val]) => ({ actor: renderName(uuid), threat: Math.floor(val) }));
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      ui.notifications.info("Threat summary copied to clipboard.");
    }
  },
  ok: { label: "Close" }
},

      default: "ok"
    }).render(true);
  } catch(e) {
    console.warn("[EQ5E] postCombatThreatSummary failed", e);
  }
});


/* -------------------- Actor Sheet: Race Selector (Classic EQ) -------------------- */
Hooks.on("renderActorSheet", (app, html, data) => {
  try {
    const actor = app?.actor ?? null;
    if (!actor) return;
    // only PCs by default
    const isChar = actor.type === "character" || actor.type === "pc" || actor.system?.details?.type === "pc";
    if (!isChar) return;

    const races = game.eq5e?.races ?? {};
    const raceId = String(actor.flags?.eq5e?.raceId ?? "").toLowerCase();

    // build selector
    const wrap = document.createElement("div");
    wrap.className = "eq5e-race-select";
    wrap.style.display = "flex";
    wrap.style.gap = "8px";
    wrap.style.alignItems = "center";
    wrap.style.padding = "6px 8px";
    wrap.style.marginBottom = "6px";
    wrap.style.borderRadius = "8px";
    wrap.style.background = "rgba(0,0,0,0.04)";

    const label = document.createElement("div");
    label.style.fontSize = "12px";
    label.style.opacity = "0.85";
    label.textContent = "Race";

    const sel = document.createElement("select");
    sel.style.flex = "0 0 220px";
    sel.innerHTML = `<option value="">(none)</option>` + Object.values(races)
      .sort((a,b)=>String(a.name).localeCompare(String(b.name)))
      .map(r => `<option value="${String(r.raceId).toLowerCase()}" ${String(r.raceId).toLowerCase()===raceId?"selected":""}>${r.name}</option>`)
      .join("");

    const info = document.createElement("div");
    info.style.fontSize = "12px";
    info.style.opacity = "0.85";
    const rr = races[raceId];
    if (rr) {
      const res = rr.resists ?? {};
      const resTxt = Object.keys(res).length ? ("Resists: " + Object.entries(res).map(([k,v])=>`${k} ${v>=0?"+":""}${Math.round(v*100)}%`).join(", ")) : "";
      const regenTxt = (Number(rr.hpRegenPerRound ?? 0) > 0) ? (`Regen: +${Number(rr.hpRegenPerRound)} HP/round`) : "";
      
const tr = rr.traits ?? {};
const tbits = [];
if (tr.frontalStunImmune) tbits.push("Frontal Stun Immune");
if (tr.threatMult && Number(tr.threatMult) !== 1) tbits.push(`Threat: ${Math.round(Number(tr.threatMult)*100)}%`);
if (tr.infravision) tbits.push("Infravision");
if (tr.manaMult && Number(tr.manaMult) !== 1) tbits.push(`Mana: +${Math.round((Number(tr.manaMult)-1)*100)}%`);
if (tr.coldSlowDurAdj) tbits.push("Cold slows -1r");
if (tr.sneakBonus) tbits.push("Sneak bonus");
const traitsTxt = tbits.length ? ("Traits: " + tbits.join(", ")) : "";

      const bits = [rr.vision ? `Vision: ${rr.vision}` : "", rr.movement ? `Move: ${rr.movement}` : "", regenTxt, resTxt, traitsTxt].filter(Boolean);
      if (rr.flavor) bits.push(rr.flavor);
      info.textContent = bits.join(" • ");
    } else {
      info.textContent = "Classic EQ baseline racial traits.";
    }

    sel.addEventListener("change", async (ev) => {
      const id = String(ev.target.value ?? "").toLowerCase();
      if (!id) {
        await actor.update({ "flags.eq5e.raceId": "" });
        const existing = actor.effects?.find(e => e?.flags?.eq5e?.raceEffect === true) ?? null;
        if (existing) await existing.delete();
        ui.notifications.info("Race cleared.");
        return;
      }
      await applyRaceToActor(actor, id);
      ui.notifications.info(`Race set: ${races[id]?.name ?? id}`);
    });

    wrap.appendChild(label);
    wrap.appendChild(sel);
    wrap.appendChild(info);

    // Insert near top of sheet
    const root = html?.[0]?.querySelector?.(".window-content") ?? html?.[0];
    if (!root) return;
    if (root.querySelector(".eq5e-race-select")) return;
    root.prepend(wrap);
  } catch(e) {
    console.warn("[EQ5E] renderActorSheet race selector failed", e);
  }
});

/* -------------------- Combat Round: Classic Regen (Iksar/Troll) -------------------- */
Hooks.on("combatRound", async (combat, round) => {
  try {
    // light-touch: only apply to characters with race regen and only if alive
    for (const c of (combat.combatants ?? [])) {
      const a = c?.actor ?? null;
      if (!a) continue;
      const regen = Number(a.flags?.eq5e?.race?.hpRegenPerRound ?? 0) + Number(a.flags?.eq5e?.combat?.hpRegenBonus ?? 0);
      if (!(regen > 0)) continue;
      const hpPath = "system.attributes.hp";
      const hp = foundry.utils.getProperty(a, hpPath) ?? null;
      if (!hp) continue;
      const cur = Number(hp.value ?? 0);
      const mx  = Number(hp.max ?? 0);
      if (cur <= 0 || cur >= mx) continue;
      const add = Math.max(0, Math.min(regen, mx - cur));
      if (add <= 0) continue;
      await a.update({ "system.attributes.hp.value": cur + add });
    }
  } catch(e) {}
});



function applyRaceVisionToToken(tokenDoc) {
  try {
    if (!game.settings.get("eq5e","raceTokenVisionEnabled")) return;
    const actor = tokenDoc?.actor ?? null;
    if (!actor) return;
    const vision = String(actor.flags?.eq5e?.race?.vision ?? "").toLowerCase();
    if (!vision) return;
    // Foundry v13 token sight fields: sight.enabled + sight.range, dim/bright might exist depending on core.
    const update = {};
    // Basic presets:
    // normal: leave default
    // lowlight: modest dim range
    // infravision: stronger dim range (still not rules-accurate; just a convenience)
    if (vision === "lowlight") {
      update["sight.enabled"] = true;
      update["sight.range"] = Math.max(Number(tokenDoc.sight?.range ?? 0), 30);
    }
    if (vision === "infravision") {
      update["sight.enabled"] = true;
      update["sight.range"] = Math.max(Number(tokenDoc.sight?.range ?? 0), 60);
    }
    if (Object.keys(update).length) tokenDoc.updateSource(update);
  } catch(e) {}
}

Hooks.on("preCreateToken", (doc) => {
  try { applyRaceVisionToToken(doc); } catch(e) {}
});
Hooks.on("preUpdateToken", (doc, change) => {
  try {
    // If actor race changed (or token actor linked), allow refresh
    if (change?.actorId || change?.actorLink) applyRaceVisionToToken(doc);
  } catch(e) {}
});



/* -------------------- Classic Out-of-Combat Regen (Iksar/Troll) -------------------- */
Hooks.once("ready", () => {
  try {
    if (!game.user.isGM) return;
    if (game.eq5e?.oocRegenTimer) return;
    game.eq5e.oocRegenTimer = setInterval(async () => {
      try {
        if (game.combat) return;
        for (const a of (game.actors?.contents ?? [])) {
          const regen = Number(a.flags?.eq5e?.race?.hpRegenPerRound ?? 0) + Number(a.flags?.eq5e?.combat?.hpRegenBonus ?? 0);
          if (!(regen > 0)) continue;
          const hp = a.system?.attributes?.hp;
          if (!hp) continue;
          const cur = Number(hp.value ?? 0);
          const mx = Number(hp.max ?? 0);
          if (cur <= 0 || cur >= mx) continue;
          const add = Math.max(0, Math.min(regen, mx - cur));
          if (add <= 0) continue;
          await a.update({ "system.attributes.hp.value": cur + add });
        }
      } catch(e) {}
    }, 10000);
  } catch(e) {}
});


export function isBetaFreeze() {
  try { return !!game.settings.get("eq5e","betaFreeze"); }
  catch(e) { return false; }
}


Hooks.once("ready", () => {
  try {
    if (!game.user?.isGM || !game.settings.get("eq5e","betaFreeze")) return;
    const sysVer = game.system?.version ?? "";
    for (const m of game.modules.values()) {
      if (!m.active) continue;
      if (String(m.id).startsWith("eq5e")) {
        const mv = m.version ?? m.data?.version ?? "";
        if (mv && sysVer && mv !== sysVer) {
          ui.notifications.warn(`EQ5e Beta Freeze: Module ${m.id} version ${mv} does not match system ${sysVer}`);
        }
      }
    }
  } catch(e) {}
});

// Character sheet registration is handled in scripts/character-sheet.js (ActorSheetV2).


import { runFeatToAAMigration } from './migrations/migrate-feat-to-aa.js';
Hooks.once('ready', () => runFeatToAAMigration());