
function _deterministicFloat01(seedStr) {
  const s = String(seedStr ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // convert uint32 -> [0,1)
  return (h >>> 0) / 4294967296;
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
function canAct(actor) { return !hasCondition(actor, "mezzed"); }
function canMove(actor) { return !hasCondition(actor, "mezzed") && !hasCondition(actor, "rooted"); }
function canCast(actor) { return !hasCondition(actor, "mezzed") && !hasCondition(actor, "stunned") && !hasCondition(actor, "silenced"); }
function getMoveMultiplier(actor) {
  const sn = actor?.flags?.eq5e?.conditions?.snared;
  if (!sn?.active) return 1.0;
  const slowPct = Number(sn.meta?.slowPct ?? 50);
  const mult = clamp(1 - clamp(slowPct, 0, 90)/100, 0.1, 1.0);
  return mult;
}

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

const THREAT = Object.freeze({
  damageToThreat: 1.0,
  tauntSnapToTop: true,
  decayPerRoundPct: 0.0,
  stickinessPct: 0.10
});

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
async function addThreat({ npcActor, sourceActor, amount, now = Date.now() }) {
  if (!npcActor || !sourceActor || amount <= 0) return;
  const state = getThreatState(npcActor);
  const key = sourceActor.uuid;
  const prev = state.entries[key]?.threat ?? 0;
  state.entries[key] = { threat: prev + amount, lastSeen: now };
  await setThreatState(npcActor, state);
}
function getTopThreatTargetUuid(npcActor) {
  const state = getThreatState(npcActor);
  const entries = Object.entries(state.entries);
  if (!entries.length) return null;
  entries.sort((a, b) => (b[1]?.threat ?? 0) - (a[1]?.threat ?? 0));
  return entries[0][0];
}
async function applyTaunt({ npcActor, taunterActor, durationRounds = 1 }) {
  if (!npcActor || !taunterActor) return;
  const state = getThreatState(npcActor);
  const key = taunterActor.uuid;
  const current = state.entries[key]?.threat ?? 0;
  const topUuid = getTopThreatTargetUuid(npcActor);
  const topThreat = topUuid ? (state.entries[topUuid]?.threat ?? 0) : 0;
  const newThreat = Math.max(current, topThreat + 1);
  state.entries[key] = { threat: newThreat, lastSeen: Date.now() };

  const combat = game.combat;
  const untilRound = combat ? (combat.round + durationRounds) : null;
  state.forced = { targetUuid: key, untilRound, reason: "taunt" };
  await setThreatState(npcActor, state);
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
  return Number(get(actor, "system.attributes.ac.value", get(actor, "system.attributes.ac", 10)));
}
function getHP(actor) {
  const value = Number(get(actor, "system.attributes.hp.value", get(actor, "system.attributes.hp", 0)));
  const max = Number(get(actor, "system.attributes.hp.max", value));
  return { value, max };
}

async function applyDamage({ packet, options = {} }) {
  const opts = foundry.utils.mergeObject({ applyDamage: true, showChat: true }, options, { inplace: false });

  const sourceActor = packet.sourceActorUuid ? await fromUuid(packet.sourceActorUuid) : null;
  const targetActor = packet.targetActorUuid ? await fromUuid(packet.targetActorUuid) : null;
  if (!targetActor) return { ok: false, reason: "missing-target" };

  const parts = (packet.parts ?? [])
    .map(p => ({
      amount: Math.max(0, Number(p.amount ?? 0)),
      type: String(p.type ?? "untyped").toLowerCase(),
      category: String(p.category ?? guessCategory(p.type)).toLowerCase()
    }))
    .filter(p => p.amount > 0);

  const wf = {
    packet,
    parts,
    sourceActor,
    targetActor,
    options: opts,
    totals: { incoming: sumParts(parts), resisted: 0, mitigated: 0, absorbed: 0, applied: 0 }
  };

  await Hooks.callAll("eq5e.preDamage", wf);

  // Resist phase (MVP % reduction from resist stat)
  const res = targetActor.system?.resists ?? {};
  for (const p of wf.parts) {
    const isElem = ["fire","cold","magic","poison","disease"].includes(p.type);
    if (!isElem) continue;
    const r = Number(res[p.type] ?? 0);
    const pct = clamp(r/100, 0, 0.75);
    const before = p.amount;
    const after = Math.max(0, Math.floor(before * (1 - pct)));
    wf.totals.resisted += (before - after);
    p.amount = after;
  }
  await Hooks.callAll("eq5e.resistDamage", wf);

  // Mitigation phase (MVP flat+% by category)
  const mit = targetActor.system?.mitigation ?? {};
  for (const p of wf.parts) {
    const before = p.amount;
    if (p.category === "physical") {
      const flat = Number(mit.physicalFlat ?? 0);
      const pct = clamp(Number(mit.physicalPct ?? 0), 0, 0.90);
      let amt = Math.max(0, before - flat);
      amt = Math.max(0, Math.floor(amt * (1 - pct)));
      wf.totals.mitigated += (before - amt);
      p.amount = amt;
    } else if (p.category === "spell") {
      const flat = Number(mit.spellFlat ?? 0);
      const pct = clamp(Number(mit.spellPct ?? 0), 0, 0.90);
      let amt = Math.max(0, before - flat);
      amt = Math.max(0, Math.floor(amt * (1 - pct)));
      wf.totals.mitigated += (before - amt);
      p.amount = amt;
    }
  }
  await Hooks.callAll("eq5e.mitigateDamage", wf);

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
      let mult = 1.0;
      const role = wf.sourceActor.flags?.eq5e?.pet?.role;
      if (role === "tank") mult = 1.5;
      await addThreat({ npcActor: wf.targetActor, sourceActor: wf.sourceActor, amount: wf.totals.applied * THREAT.damageToThreat * mult });
    }
  }

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

async function performAttack({ attacker, attackerToken, target, targetToken, item, applyDamage: doApplyDamage=true }) {
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


  const attackTotalFormula = `1d20 + ${mod} + ${prof} + ${flat} + ${globalAtkBonus} + ${rangerArchHit}`;
  const attackRoll = await (new Roll(attackTotalFormula)).evaluate();

  const ac = getAC(target);
  const d20 = attackRoll.dice?.[0]?.total ?? null;
  const isCrit = (d20 === 20);
  const isHit = (attackRoll.total >= ac) || isCrit;

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
    tags: ["melee", attacker.flags?.eq5e?.pet ? "pet" : "pc"],
    isCrit,
    meta: { itemUuid: item.uuid }
  };

  const res = await applyDamage({ packet, options: { applyDamage: doApplyDamage, showChat: true } });
  return { ok: true, isHit: true, isCrit, attackTotal: attackRoll.total, ac, damageTotal: sumParts(parts), damageResult: res };
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
    const cost = Number(sp?.manaCost ?? 0);
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

  const spent = await spendMana(caster, Number(sp.manaCost ?? 0));
  if (!spent.ok) return { ok: false, reason: spent.reason, cost: spent.cost };

  // Cooldown on cast
  const cdDef = item.getFlag("eq5e","cooldown");
  if (cdDef?.value) {
    await setCooldown(caster, `item:${item.uuid}`, cdDef);
    if (cdDef.sharedGroup) await setCooldown(caster, `group:${cdDef.sharedGroup}`, cdDef);
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
const spellDamagePct = Number(caster.flags?.eq5e?.druid?.spellDamagePct ?? 0);
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
if (!isHealing) {
  const pct = (spellDamagePct ? (1 + spellDamagePct) : 1) * (petSpellDamagePct ? (1 + petSpellDamagePct) : 1);
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
      meta: { itemUuid: item.uuid }
    };
    await applyDamage({ packet, options: { applyDamage: true, showChat: true } });
  }


if (sp.conditions?.length) {
  // Enchanter AAs can modify control durations + break chances deterministically.
  const mezBonus = Number(caster?.flags?.eq5e?.enchanter?.mezBonusRounds ?? 0);
  const mezBreakRed = Number(caster?.flags?.eq5e?.enchanter?.mezBreakChanceRed ?? 0);   // e.g. 0.05 = -5%
  const charmBreakRed = Number(caster?.flags?.eq5e?.enchanter?.charmBreakChanceRed ?? 0);

  for (const c of sp.conditions) {
    const dur = foundry.utils.duplicate(c.duration ?? null);
    const meta = foundry.utils.duplicate(c.meta ?? null) ?? {};

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
      const allow = new Set(["ai.enabled","ai.mode","ai.stance","ai.followDistance","ai.autoTaunt","ai.rotationProfile","pet.nickname"]);
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

  const summonId = String(summon?.summonId ?? summon?.name ?? "summon");
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

    // Apply class-specific companion bonuses
    await applyRangerCompanionBonuses({ owner: caster, petActor });

  }

  
      }
    }
  }

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
  try { Handlebars.registerHelper("eq", (a,b) => String(a) === String(b)); } catch (e) {}

  try {
    const sw = await import("./setup/setup-wizard.js");
    sw.registerEQ5eSetupWizard();
  } catch (e) { console.error("[EQ5E] setup wizard init failed", e); }

  console.log("[EQ5E] System init");
  game.eq5e = game.eq5e || {};
  game.eq5e.api = {
    version: "0.3.0-alpha",
    CONDITIONS,
    // Conditions
    hasCondition, canAct, canMove, canCast, getMoveMultiplier,
    setCondition, clearCondition, pruneExpiredConditions, syncConditionsFromEffects,
    // Cooldowns + haste
    getCombatKey, isOnCooldown, setCooldown, getHastePct, hasteToExtraAttacks,
    // Movement
    getSpeedFt, ftToPixels, moveTowardTokenByFt,
    // Damage / threat
    applyDamage,
    getThreatState, setThreatState, addThreat, getTopThreatTargetUuid, applyTaunt, clearExpiredForcedTarget,
    // Attacks / spells
    getAC, getHP, getMana, spendMana,
    getAttackItemsReady, getMeleeAttackItemsReady, getMeleeSwingsPerTurn,
    performAttack,
    getSpellItemsReady, castSpell,
    summonPetFromCompendium,
    despawnSummonedPet,
    dismissSummonedPet,
    updatePetConfig,
    renamePet,
    swapSummonVariant,
    charmTarget,
    setPetAIState,
    setPetStance
  };
});

Hooks.once("ready", () => {

// ---------------- Socket: allow non-GM owners to request GM actions (summon dismiss, etc.) ----------------
game.eq5e = game.eq5e || {};
game.eq5e.socket = game.eq5e.socket || {};

if (!game.eq5e.socket._initialized) {
  game.eq5e.socket._initialized = true;

  game.socket.on("system.eq5e", async (data) => {
    try {
      if (!data || typeof data !== "object") return;
      if (!game.user.isGM) return; // only GM processes requests

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

game.settings.register("eq5e", "aeExamplesOnStartup", {
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

