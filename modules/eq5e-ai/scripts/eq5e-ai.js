import { registerPetControlUI } from "./pet-ui.js";
// EQ5E AI Module (Foundry VTT v13)
// Full combat pipeline integration: pet turns, caster rotation, melee multiattack,
// threat-based NPC targeting, tank pet taunt, and condition awareness.

const MODULE_ID = "eq5e-ai";
const TURN_STATE = { lastCombatId: null, lastRound: null, lastTurn: null, lastExecAt: 0 };

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "runAsGMOnly", {
    name: "Run AI as GM only",
    hint: "Only the GM executes pet/NPC AI (recommended).",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "debug", {
    name: "Debug logging",
    hint: "Verbose AI logs in the browser console.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
});

function log(msg, data) {
  const dbg = game.settings.get(MODULE_ID, "debug");
  if (!dbg) return;
  console.log(`[EQ5E AI] ${msg}`, data ?? "");
}

function isPet(actor) {
  const isSubtypePet = (actor.system?.type === "pet") || (actor.flags?.eq5e?.pet != null);
  return actor.type === "pet" || isSubtypePet;
}

function getAIFlags(actor) {
  const defaults = {
    enabled: false,
    mode: "assist",
    leash: { enabled: true, maxDistance: 30 },
    aggression: { enabled: false, radius: 20 },
    allowTaunt: true,
    allowSpells: false,
    engagedRangeFt: 5,
    neverStepAwayWhenEngaged: true,
    casterPreference: {
      preferCasting: true,
      meleeFallbackWhenEngaged: true,
      meleeFallbackWhenOOM: true,
      meleeFallbackWhenSilenced: true
    }
  };
  return foundry.utils.mergeObject(defaults, actor.flags?.eq5e?.ai ?? {}, { inplace: false });
}

async function resolveOwnerActor(petActor) {
  const ownerUuid = petActor.flags?.eq5e?.pet?.ownerUuid;
  if (!ownerUuid) return null;
  try { return await fromUuid(ownerUuid); } catch { return null; }
}

function getPetCurrentTargetToken(petToken) {
  const targetId = petToken.document.getFlag("eq5e", "aiTargetTokenId");
  if (!targetId) return null;
  return canvas.tokens?.get(targetId) ?? null;
}
function setTokenTargetForPet(petToken, targetToken) {
  return petToken.document.setFlag("eq5e", "aiTargetTokenId", targetToken.id);
}

function findNearestHostileToken(sourceToken, radius) {
  const tokens = canvas.tokens?.placeables ?? [];
  const candidates = tokens.filter(t => {
    if (t.id === sourceToken.id) return false;
    if (!t.actor) return false;
    const hostile = (t.document.disposition ?? 0) !== (sourceToken.document.disposition ?? 0);
    if (!hostile) return false;
    const d = canvas.grid.measureDistance(sourceToken.center, t.center);
    return d <= radius;
  });
  if (!candidates.length) return null;
  candidates.sort((a,b) =>
    canvas.grid.measureDistance(sourceToken.center, a.center) -
    canvas.grid.measureDistance(sourceToken.center, b.center)
  );
  return candidates[0];
}

function getOwnerTargetToken(ownerActorOrToken) {
  if (!ownerActorOrToken) return null;
  let ownerToken = null;
  if (ownerActorOrToken.documentName === "Token") {
    ownerToken = canvas.tokens?.get(ownerActorOrToken.id) ?? null;
  } else if (ownerActorOrToken.documentName === "Actor") {
    const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === ownerActorOrToken.id);
    ownerToken = controlled ?? canvas.tokens?.placeables?.find(t => t.actor?.id === ownerActorOrToken.id) ?? null;
  }
  if (!ownerToken) return null;
  const targets = Array.from(game.user?.targets ?? []);
  if (targets.length > 0) return targets[0];
  return null;
}

function isEngagedInMelee({ token, targetToken, engagedRangeFt = 5 }) {
  if (!token || !targetToken) return false;
  const d = canvas.grid.measureDistance(token.center, targetToken.center);
  return d <= engagedRangeFt;
}
function shouldHoldPositionWhenEngaged(actor) {
  const ai = actor.flags?.eq5e?.ai ?? {};
  return ai.neverStepAwayWhenEngaged !== false;
}

async function stepIntoSpellRange({ casterActor, casterToken, targetToken, rangeFt, ai, engagedTargetToken=null, engagedRangeFt=5 }) {
  if (!rangeFt || rangeFt <= 0) return { ok: true, inRange: true };

  if (game.eq5e?.api?.canMove && !game.eq5e.api.canMove(casterActor)) {
    const distFt = canvas.grid.measureDistance(casterToken.center, targetToken.center);
    return { ok: true, inRange: distFt <= rangeFt, held: true };
  }

  if (engagedTargetToken && shouldHoldPositionWhenEngaged(casterActor)) {
    const engaged = isEngagedInMelee({ token: casterToken, targetToken: engagedTargetToken, engagedRangeFt });
    if (engaged) {
      const distFt = canvas.grid.measureDistance(casterToken.center, targetToken.center);
      return { ok: true, inRange: distFt <= rangeFt, held: true };
    }
  }

  const distFt = canvas.grid.measureDistance(casterToken.center, targetToken.center);
  if (distFt <= rangeFt) return { ok: true, inRange: true };

  const needFt = Math.max(0, distFt - rangeFt + 1);
  const speedFt = game.eq5e?.api?.getSpeedFt ? game.eq5e.api.getSpeedFt(casterActor) : 30;
  const stepFt = Math.min(needFt, speedFt);
  if (stepFt <= 0) return { ok: true, inRange: false };

  if (ai?.leash?.enabled) {
    const owner = await resolveOwnerActor(casterActor);
    const ownerToken = owner?.documentName === "Actor"
      ? canvas.tokens?.placeables?.find(t => t.actor?.id === owner.id)
      : null;
    if (ownerToken) {
      const curOwnerFt = canvas.grid.measureDistance(casterToken.center, ownerToken.center);
      if (curOwnerFt >= (ai.leash.maxDistance ?? 30)) return { ok: true, inRange: false };
    }
  }

  await game.eq5e.api.moveTowardTokenByFt({ moverToken: casterToken, targetToken, stepFt });
  const newDistFt = canvas.grid.measureDistance(casterToken.center, targetToken.center);
  return { ok: true, inRange: newDistFt <= rangeFt };
}

async function approachTarget({ token, targetToken, ai, engageRangeFt = 5, allowDash = false }) {
  const actor = token.actor;
  if (game.eq5e?.api?.canMove && !game.eq5e.api.canMove(actor)) return;

  const speedFt = game.eq5e?.api?.getSpeedFt ? game.eq5e.api.getSpeedFt(actor) : 30;
  const moveBudgetFt = allowDash ? speedFt * 2 : speedFt;

  const distFt = canvas.grid.measureDistance(token.center, targetToken.center);
  if (distFt <= engageRangeFt) return;

  const neededFt = Math.max(0, distFt - engageRangeFt);
  const stepFt = Math.min(moveBudgetFt, neededFt);
  if (stepFt <= 0) return;

  if (ai.leash?.enabled) {
    const owner = await resolveOwnerActor(actor);
    const ownerToken = owner?.documentName === "Actor"
      ? canvas.tokens?.placeables?.find(t => t.actor?.id === owner.id)
      : null;
    if (ownerToken) {
      const curOwnerFt = canvas.grid.measureDistance(token.center, ownerToken.center);
      if (curOwnerFt >= (ai.leash.maxDistance ?? 30)) return;
    }
  }

  await game.eq5e.api.moveTowardTokenByFt({ moverToken: token, targetToken, stepFt });
}

async function chooseTarget({ token, actor, ai }) {
  if (ai.mode === "assist") {
    const owner = await resolveOwnerActor(actor);
    const ownerTarget = getOwnerTargetToken(owner);
    if (ownerTarget) {
      await setTokenTargetForPet(token, ownerTarget);
      return ownerTarget;
    }
  }

  const current = getPetCurrentTargetToken(token);
  if (current) return current;

  if (ai.mode === "guard" || ai.mode === "autonomous") {
    const radius = ai.aggression?.radius ?? 20;
    const nearest = findNearestHostileToken(token, radius);
    if (nearest) {
      await setTokenTargetForPet(token, nearest);
      return nearest;
    }
  }

  return null;
}

async function maybeTaunt({ petActor, petToken, targetToken, ai }) {
  if (!ai.allowTaunt) return false;
  const role = petActor.flags?.eq5e?.pet?.role;
  if (role !== "tank") return false;

  const npcActor = targetToken.actor;
  if (!npcActor || !game.eq5e?.api?.getThreatState) return false;

  await game.eq5e.api.clearExpiredForcedTarget(npcActor);

  const topUuid = game.eq5e.api.getTopThreatTargetUuid(npcActor);
  if (topUuid === petActor.uuid) return false;

  const combatKey = `${game.combat?.id}:${game.combat?.round}`;
  const last = petToken.document.getFlag("eq5e", "tauntRoundKey");
  if (last === combatKey) return false;

  await game.eq5e.api.applyTaunt({ npcActor, taunterActor: petActor, durationRounds: 1 });
  await petToken.document.setFlag("eq5e", "tauntRoundKey", combatKey);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: petActor, token: petToken }),
    content: `<b>${petActor.name}</b> taunts <b>${targetToken.name}</b>!`
  });

  return true;
}

async function meleeMultiattackWithHaste({ actor, token, targetToken }) {
  const targetActor = targetToken.actor;
  if (!targetActor) return;

  const swings = game.eq5e?.api?.getMeleeSwingsPerTurn ? game.eq5e.api.getMeleeSwingsPerTurn(actor) : 1;
  for (let n = 0; n < swings; n++) {
    const readyMelee = game.eq5e?.api?.getMeleeAttackItemsReady ? game.eq5e.api.getMeleeAttackItemsReady(actor) : [];
    if (!readyMelee.length) break;
    const item = readyMelee[0];
    await game.eq5e.api.performAttack({
      attacker: actor,
      attackerToken: token,
      target: targetActor,
      targetToken,
      item,
      applyDamage: true
    });
  }
}

function getHPPct(actor) {
  const v = Number(foundry.utils.getProperty(actor, "system.attributes.hp.value"));
  const m = Number(foundry.utils.getProperty(actor, "system.attributes.hp.max"));
  if (!Number.isFinite(v) || !Number.isFinite(m) || m <= 0) return null;
  return v / m;
}

function getCastMemory(token) { return token.document.getFlag("eq5e", "aiCastMemory") ?? {}; }
function setCastMemory(token, mem) { return token.document.setFlag("eq5e", "aiCastMemory", mem); }
function spellKey(item) {
  const spId = item.getFlag("eq5e","spell")?.spellId;
  return spId ? `spell:${spId}` : `item:${item.uuid}`;
}
function rememberCast({ token, targetActor, item }) {
  const mem = getCastMemory(token);
  mem[targetActor.uuid] ??= {};
  mem[targetActor.uuid][spellKey(item)] = game.combat?.round ?? 0;
  return setCastMemory(token, mem);
}
function pickNotRecentlyCastOnTarget({ token, targetActor, candidates, cooldownRounds }) {
  if (!candidates?.length) return null;
  const mem = getCastMemory(token);
  const tgt = mem[targetActor.uuid] ?? {};
  const round = game.combat?.round ?? 0;
  for (const item of candidates) {
    const key = spellKey(item);
    const last = Number(tgt[key] ?? -999);
    if ((round - last) >= cooldownRounds) return item;
  }
  return null;
}

async function chooseHealTarget({ actor, token }) {
  const selfPct = getHPPct(actor);
  if (selfPct != null && selfPct <= 0.5) return token;

  const owner = await resolveOwnerActor(actor);
  const ownerToken = owner?.documentName === "Actor"
    ? canvas.tokens?.placeables?.find(t => t.actor?.id === owner.id)
    : null;
  if (ownerToken) {
    const ownerPct = getHPPct(ownerToken.actor);
    if (ownerPct != null && ownerPct <= 0.5) return ownerToken;
  }
  return null;
}

async function runCasterRotation({ actor, token, targetToken, engaged=false, engagedRangeFt=5, ai }) {
  const targetActor = targetToken.actor;
  if (!targetActor) return { ok: false, reason: "no-target" };

  const ready = game.eq5e?.api?.getSpellItemsReady ? game.eq5e.api.getSpellItemsReady(actor) : [];
  if (!ready.length) return { ok: false, reason: "no-ready-spells" };

  const byKind = { heal:[], dot:[], debuff:[], mez:[], nuke:[], buff:[], utility:[] };
  for (const item of ready) {
    const sp = item.getFlag("eq5e","spell");
    const kind = String(sp.kind ?? "utility").toLowerCase();
    (byKind[kind] ?? byKind.utility).push(item);
  }

  const healTargetToken = await chooseHealTarget({ actor, token });
  if (healTargetToken && byKind.heal.length) {
    const spell = byKind.heal[0];
    const sp = spell.getFlag("eq5e","spell");
    const step = await stepIntoSpellRange({ casterActor: actor, casterToken: token, targetToken: healTargetToken, rangeFt: Number(sp.rangeFt ?? 0), ai });
    if (!step.inRange) return { ok:false, reason:"out-of-range" };
    const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target: healTargetToken.actor, targetToken: healTargetToken, item: spell });
    return res.ok ? { ok:true, spell: spell.name } : { ok:false, reason: res.reason ?? "cast-failed" };
  }

  const dot = pickNotRecentlyCastOnTarget({ token, targetActor, candidates: byKind.dot, cooldownRounds: 3 });
  if (dot) {
    const sp = dot.getFlag("eq5e","spell");
    const step = await stepIntoSpellRange({ casterActor: actor, casterToken: token, targetToken, rangeFt: Number(sp.rangeFt ?? 0), ai, engagedTargetToken: engaged ? targetToken : null, engagedRangeFt });
    if (!step.inRange) return { ok:false, reason:"out-of-range" };
    const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target: targetActor, targetToken, item: dot });
    if (res.ok) rememberCast({ token, targetActor, item: dot });
    return res.ok ? { ok:true, spell: dot.name } : { ok:false, reason: res.reason ?? "cast-failed" };
  }

  const debuff = pickNotRecentlyCastOnTarget({ token, targetActor, candidates: byKind.debuff, cooldownRounds: 5 });
  if (debuff) {
    const sp = debuff.getFlag("eq5e","spell");
    const step = await stepIntoSpellRange({ casterActor: actor, casterToken: token, targetToken, rangeFt: Number(sp.rangeFt ?? 0), ai, engagedTargetToken: engaged ? targetToken : null, engagedRangeFt });
    if (!step.inRange) return { ok:false, reason:"out-of-range" };
    const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target: targetActor, targetToken, item: debuff });
    if (res.ok) rememberCast({ token, targetActor, item: debuff });
    return res.ok ? { ok:true, spell: debuff.name } : { ok:false, reason: res.reason ?? "cast-failed" };
  }

  if (byKind.nuke.length) {
    const nuke = byKind.nuke[0];
    const sp = nuke.getFlag("eq5e","spell");
    const step = await stepIntoSpellRange({ casterActor: actor, casterToken: token, targetToken, rangeFt: Number(sp.rangeFt ?? 0), ai, engagedTargetToken: engaged ? targetToken : null, engagedRangeFt });
    if (!step.inRange) return { ok:false, reason:"out-of-range" };
    const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target: targetActor, targetToken, item: nuke });
    return res.ok ? { ok:true, spell: nuke.name } : { ok:false, reason: res.reason ?? "cast-failed" };
  }

  const any = ready[0];
  const sp = any.getFlag("eq5e","spell");
  const step = await stepIntoSpellRange({ casterActor: actor, casterToken: token, targetToken, rangeFt: Number(sp.rangeFt ?? 0), ai, engagedTargetToken: engaged ? targetToken : null, engagedRangeFt });
  if (!step.inRange) return { ok:false, reason:"out-of-range" };
  const res = await game.eq5e.api.castSpell({ caster: actor, casterToken: token, target: targetActor, targetToken, item: any });
  return res.ok ? { ok:true, spell: any.name } : { ok:false, reason: res.reason ?? "cast-failed" };
}

async function runPetCombatAction({ actor, token, targetToken, ai }) {
  if (game.eq5e?.api?.pruneExpiredConditions) await game.eq5e.api.pruneExpiredConditions(actor);
  if (game.eq5e?.api?.canAct && !game.eq5e.api.canAct(actor)) return;

  await maybeTaunt({ petActor: actor, petToken: token, targetToken, ai });

  const engaged = isEngagedInMelee({ token, targetToken, engagedRangeFt: ai.engagedRangeFt });
  const role = actor.flags?.eq5e?.pet?.role ?? "melee";
  const wantsCasting = ai.allowSpells && role === "caster" && (ai.casterPreference?.preferCasting !== false);

  if (wantsCasting) {
    const cannotCast = game.eq5e?.api?.canCast ? !game.eq5e.api.canCast(actor) : false;
    if (cannotCast) {
      if (ai.casterPreference?.meleeFallbackWhenSilenced !== false) {
        if (!engaged) await approachTarget({ token, targetToken, ai, engageRangeFt: ai.engagedRangeFt, allowDash: false });
        await meleeMultiattackWithHaste({ actor, token, targetToken });
      }
      return;
    }

    const castRes = await runCasterRotation({ actor, token, targetToken, engaged, engagedRangeFt: ai.engagedRangeFt, ai });
    if (castRes.ok) return;

    if (engaged && ai.casterPreference?.meleeFallbackWhenEngaged !== false) {
      await meleeMultiattackWithHaste({ actor, token, targetToken });
      return;
    }

    await approachTarget({ token, targetToken, ai, engageRangeFt: ai.engagedRangeFt, allowDash: false });
    await meleeMultiattackWithHaste({ actor, token, targetToken });
    return;
  }

  await approachTarget({ token, targetToken, ai, engageRangeFt: ai.engagedRangeFt, allowDash: false });
  await meleeMultiattackWithHaste({ actor, token, targetToken });
}

function tokenFromActorUuid(actorUuid) {
  const tokens = canvas.tokens?.placeables ?? [];
  return tokens.find(t => t.actor?.uuid === actorUuid) ?? null;
}
function isHostileNpcToken(token) {
  if (!token?.actor) return false;
  const isNpc = token.actor.type === "npc" || token.actor.system?.type === "npc";
  const hostile = (token.document.disposition ?? 0) < 0;
  return isNpc && hostile;
}

async function chooseNpcTargetByThreat(npcToken) {
  const npcActor = npcToken.actor;
  if (!npcActor || !game.eq5e?.api?.getThreatState) return null;

  await game.eq5e.api.clearExpiredForcedTarget(npcActor);
  const state = game.eq5e.api.getThreatState(npcActor);

  if (state.forced?.targetUuid) {
    const forcedToken = tokenFromActorUuid(state.forced.targetUuid);
    if (forcedToken) return forcedToken;
  }

  const topUuid = game.eq5e.api.getTopThreatTargetUuid(npcActor);
  if (!topUuid) return null;

  const currentUuid = state.lastTargetUuid;
  if (currentUuid && currentUuid !== topUuid) {
    const cur = state.entries[currentUuid]?.threat ?? 0;
    const top = state.entries[topUuid]?.threat ?? 0;
    if (top < cur * (1 + 0.10)) {
      const currentToken = tokenFromActorUuid(currentUuid);
      if (currentToken) return currentToken;
    }
  }

  return tokenFromActorUuid(topUuid);
}

async function runNpcThreatTurn({ token }) {
  const actor = token.actor;
  if (game.eq5e?.api?.pruneExpiredConditions) await game.eq5e.api.pruneExpiredConditions(actor);
  if (game.eq5e?.api?.canAct && !game.eq5e.api.canAct(actor)) return;

  const targetToken = await chooseNpcTargetByThreat(token);
  if (!targetToken) return;

  const state = game.eq5e.api.getThreatState(actor);
  state.lastTargetUuid = targetToken.actor.uuid;
  await game.eq5e.api.setThreatState(actor, state);

  await approachTarget({ token, targetToken, ai: { leash: { enabled: false } }, engageRangeFt: 5, allowDash: false });

  const item = (game.eq5e?.api?.getMeleeAttackItemsReady ? game.eq5e.api.getMeleeAttackItemsReady(actor) : [])[0];
  if (!item) return;

  await game.eq5e.api.performAttack({
    attacker: actor,
    attackerToken: token,
    target: targetToken.actor,
    targetToken,
    item,
    applyDamage: true
  });
}

async function runTurn({ combat }) {
  const combatant = combat.combatant;
  if (!combatant?.token) return;

  const token = canvas.tokens?.get(combatant.token.id);
  const actor = token?.actor;
  if (!actor) return;

  if (isPet(actor)) {
    const ai = getAIFlags(actor);
    if (!ai.enabled || ai.mode === "passive") return;

    const targetToken = await chooseTarget({ token, actor, ai });
    if (!targetToken) return;

    await runPetCombatAction({ actor, token, targetToken, ai });
    return;
  }

  if (isHostileNpcToken(token)) {
    await runNpcThreatTurn({ token });
  }
}

Hooks.on("updateCombat", async (combat, changed) => {
  try {
    if (!combat?.started) return;
    const turnChanged = Object.prototype.hasOwnProperty.call(changed, "turn");
    const roundChanged = Object.prototype.hasOwnProperty.call(changed, "round");
    if (!turnChanged && !roundChanged) return;

    if (game.settings.get(MODULE_ID, "runAsGMOnly") && !game.user.isGM) return;

    const now = Date.now();
    if (now - TURN_STATE.lastExecAt < 150) return;
    if (TURN_STATE.lastCombatId === combat.id && TURN_STATE.lastRound === combat.round && TURN_STATE.lastTurn === combat.turn) return;

    TURN_STATE.lastCombatId = combat.id;
    TURN_STATE.lastRound = combat.round;
    TURN_STATE.lastTurn = combat.turn;
    TURN_STATE.lastExecAt = now;

    await runTurn({ combat });
  } catch (err) {
    console.error("[EQ5E AI] updateCombat error", err);
  }
});

Hooks.once("ready", () => { registerPetControlUI(); });
