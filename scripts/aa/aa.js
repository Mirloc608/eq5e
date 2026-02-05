// EQ5e AA Loader + runtime helpers
// - Generates a world AA compendium (Item pack) from JSON
// - Provides APIs to spend AA points and rank up AA items
//
// Deterministic upsert key: flags.eq5e.aa.aaId

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type: "Item",
    package: "world"
  });
}

async function upsertItemsByAAId(pack, items) {
  const existing = await pack.getDocuments();
  const byId = new Map();
  for (const d of existing) {
    const aaId = d?.flags?.eq5e?.aa?.aaId;
    if (aaId) byId.set(aaId, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (items ?? [])) {
    const aaId = it?.flags?.eq5e?.aa?.aaId;
    if (!aaId) continue;
    const doc = byId.get(aaId);
    const h = _stableHash(it);

    if (!doc) {
      it.flags = it.flags ?? {};
      it.flags.eq5e = it.flags.eq5e ?? {};
      it.flags.eq5e.derivedHash = h;
      toCreate.push(it);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      if (old !== h) {
        const upd = foundry.utils.duplicate(it);
        upd._id = doc.id;
        upd.flags = upd.flags ?? {};
        upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = h;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateAACompendium({
  key = "world.eq5e-aa",
  label = "EQ5e Alternate Abilities (Examples)"
} = {}) {
  const paths = [
  "system/eq5e/data/aa-examples.json",
  "system/eq5e/data/aa-racial.json"
];
let items = [];
for (const p of paths) {
  try { items = items.concat(await _fetchJSON(p)); }
  catch(e) { /* ignore missing optional packs */ }
}
  const pack = await ensureWorldPack({ key, label });
  const res = await upsertItemsByAAId(pack, items);
  ui.notifications?.info(`EQ5E: AA compendium upserted: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, pack: pack.collection, ...res };
}

// -------------------------- Runtime purchasing APIs --------------------------

function _aaState(actor) {
  const aa = actor?.flags?.eq5e?.aa ?? {};
  return {
    unspent: Number(aa.unspent ?? 0),
    total: Number(aa.total ?? 0),
    mode: aa.mode ?? "leveling", // "leveling" | "aa"
  };
}

async function _setAAState(actor, next) {
  await actor.setFlag("eq5e", "aa", {
    ...(actor.flags?.eq5e?.aa ?? {}),
    ...next
  });
}

function _meetsPrereq(actor, aaItem) {
  const req = aaItem?.flags?.eq5e?.aa?.prereq ?? {};
  const lvl = Number(foundry.utils.getProperty(actor, "system.details.level") ?? foundry.utils.getProperty(actor, "system.level") ?? 1);
if (Number(req.minLevel ?? 0) > lvl) return false;

// prerequisite chains: requires=[{aaId, rank}]
const requires = Array.isArray(req.requires) ? req.requires : [];
for (const r of requires) {
  const needId = r?.aaId;
  const needRank = Number(r?.rank ?? 1);
  if (!needId) continue;
  const owned = actor.items?.find(i => i?.flags?.eq5e?.aa?.aaId === needId);
  const haveRank = Number(owned?.flags?.eq5e?.aa?.rank ?? 0);
  if (haveRank < needRank) return false;
}

return true;
}

function _currentRankOnActor(actor, aaId) {
  const owned = actor.items?.find(i => i?.flags?.eq5e?.aa?.aaId === aaId);
  return Number(owned?.flags?.eq5e?.aa?.rank ?? 0);
}

function _maxRank(aaDoc) {
  return Number(aaDoc?.flags?.eq5e?.aa?.maxRank ?? 1);
}

function _cost(aaDoc) {
  return Number(aaDoc?.flags?.eq5e?.aa?.cost ?? 1);
}

async function _applyRankScaling(actor, item) {
  // Scale numeric ActiveEffect changes based on rank and declared scales.
  const aa = item?.flags?.eq5e?.aa ?? {};
  const rank = Number(aa.rank ?? 0);
  const scales = aa.scales ?? {};
  if (!rank || !item.effects?.size) return;

  const updates = [];
  for (const ef of item.effects) {
    const e = ef.toObject();
    if (!e?.changes) continue;
    for (const ch of e.changes) {
      const key = ch.key;
      // Supported scaling keys -> multipliers
      // attackBonusPerRank -> flags.eq5e.combat.attackBonus
      if (key === "flags.eq5e.combat.attackBonus" && Number.isFinite(scales.attackBonusPerRank)) {
        ch.value = String(Number(scales.attackBonusPerRank) * rank);
      }
// Racial / generic scaling
if (key === "flags.eq5e.combat.damageBonus" && Number.isFinite(scales.damageBonusPerRank)) {
  ch.value = String(Number(scales.damageBonusPerRank) * rank);
}
if (key === "flags.eq5e.combat.hpRegenBonus" && Number.isFinite(scales.hpRegenBonusPerRank)) {
  ch.value = String(Number(scales.hpRegenBonusPerRank) * rank);
}
if (key === "flags.eq5e.combat.hpMaxBonus" && Number.isFinite(scales.hpMaxBonusPerRank)) {
  ch.value = String(Number(scales.hpMaxBonusPerRank) * rank);
}
if (key === "flags.eq5e.combat.spellDamagePct" && Number.isFinite(scales.spellDamagePctPerRank)) {
  ch.value = String(Number(scales.spellDamagePctPerRank) * rank);
}
if (key === "flags.eq5e.combat.manaReductionPct" && Number.isFinite(scales.manaReductionPctPerRank)) {
  ch.value = String(Number(scales.manaReductionPctPerRank) * rank);
}
if (key === "flags.eq5e.aa.threatPctRed" && Number.isFinite(scales.threatPctRedPerRank)) {
  ch.value = String(Number(scales.threatPctRedPerRank) * rank);
}
if (key === "flags.eq5e.combat.acBonus" && Number.isFinite(scales.acBonusPerRank)) {
  ch.value = String(Number(scales.acBonusPerRank) * rank);
}
if (key === "flags.eq5e.aa.sideRearStunResistPct" && Number.isFinite(scales.sideRearStunResistPctPerRank)) {
  ch.value = String(Number(scales.sideRearStunResistPctPerRank) * rank);
}
if (key === "flags.eq5e.resists.poison" && Number.isFinite(scales.poisonResistPerRank)) {
  ch.value = String(Number(scales.poisonResistPerRank) * rank);
}
if (key === "flags.eq5e.resists.disease" && Number.isFinite(scales.diseaseResistPerRank)) {
  ch.value = String(Number(scales.diseaseResistPerRank) * rank);
}
      if (key === "flags.eq5e.enchanter.mezBonusRounds" && Number.isFinite(scales.mezRoundsPerRank)) {
        ch.value = String(Number(scales.mezRoundsPerRank) * rank);
      }
      if (key === "flags.eq5e.enchanter.charmBonusRounds" && Number.isFinite(scales.charmRoundsPerRank)) {
        ch.value = String(Number(scales.charmRoundsPerRank) * rank);
      }

// Shaman scaling
if (key === "flags.eq5e.shaman.canniManaBonus" && Number.isFinite(scales.canniManaPerRank)) {
  ch.value = String(Number(scales.canniManaPerRank) * rank);
}
if (key === "flags.eq5e.shaman.slowBonusPct" && Number.isFinite(scales.slowPctPerRank)) {
  ch.value = String(Number(scales.slowPctPerRank) * rank);
}
if (key === "flags.eq5e.shaman.healPct" && Number.isFinite(scales.healPctPerRank)) {
  ch.value = String(Number(scales.healPctPerRank) * rank);
}
if (key === "flags.eq5e.shaman.petHpBonus" && Number.isFinite(scales.petHpPerRank)) {
  ch.value = String(Number(scales.petHpPerRank) * rank);
}
if (key === "flags.eq5e.shaman.petDamagePct" && Number.isFinite(scales.petDmgPctPerRank)) {
  ch.value = String(Number(scales.petDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.shaman.petThreatMult" && Number.isFinite(scales.petThreatMultPerRank)) {
  ch.value = String(Number(scales.petThreatMultPerRank) * rank);
}


// Rogue scaling
if (key === "flags.eq5e.rogue.backstabBonusDice" && Number.isFinite(scales.backstabDicePer2Ranks)) {
  ch.value = String(Math.floor(rank / 2) * Number(scales.backstabDicePer2Ranks));
}
if (key === "flags.eq5e.rogue.poisonDamagePct" && Number.isFinite(scales.poisonDmgPctPerRank)) {
  ch.value = String(Number(scales.poisonDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.rogue.evadeDropBonusPct" && Number.isFinite(scales.evadeDropPctPerRank)) {
  ch.value = String(Number(scales.evadeDropPctPerRank) * rank);
}
if (key === "flags.eq5e.rogue.offhandDamagePct" && Number.isFinite(scales.offhandDmgPctPerRank)) {
  ch.value = String(Number(scales.offhandDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.rogue.evasionCooldownReduction") {
  const ranks = Array.isArray(scales.evasionCdrAtRanks) ? scales.evasionCdrAtRanks : [];
  ch.value = String(ranks.filter(r => rank >= Number(r)).length);
}


      // Magician scaling (pet + spell)
if (key === "flags.eq5e.magician.spellDamagePct" && Number.isFinite(scales.spellDamagePctPerRank)) {
  ch.value = String(Number(scales.spellDamagePctPerRank) * rank);
}
if (key === "flags.eq5e.magician.petHpBonus" && Number.isFinite(scales.petHpPerRank)) {
  ch.value = String(Number(scales.petHpPerRank) * rank);
}
if (key === "flags.eq5e.magician.petDamagePct" && Number.isFinite(scales.petDmgPctPerRank)) {
  ch.value = String(Number(scales.petDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.magician.petThreatMult" && Number.isFinite(scales.petThreatMultPerRank)) {
  ch.value = String(Number(scales.petThreatMultPerRank) * rank);
}
if (key === "flags.eq5e.magician.manaReductionPct" && Number.isFinite(scales.manaReductionPctPerRank)) {
  ch.value = String(Number(scales.manaReductionPctPerRank) * rank);
}
if (key === "flags.eq5e.magician.cooldownRedPct" && Number.isFinite(scales.cooldownRedPctPerRank)) {
  ch.value = String(Number(scales.cooldownRedPctPerRank) * rank);
}
      if (key === "flags.eq5e.enchanter.mezBreakChanceRed" && Number.isFinite(scales.mezBreakChanceRedPerRank)) {
        ch.value = String(Number(scales.mezBreakChanceRedPerRank) * rank);
      }
      if (key === "flags.eq5e.enchanter.charmBreakChanceRed" && Number.isFinite(scales.charmBreakChanceRedPerRank)) {
        ch.value = String(Number(scales.charmBreakChanceRedPerRank) * rank);
      }

      if (key === "flags.eq5e.ranger.archeryHitBonus" && Number.isFinite(scales.archeryHitBonusPerRank)) {
        ch.value = String(Number(scales.archeryHitBonusPerRank) * rank);
      }
      if (key === "flags.eq5e.ranger.archeryDamagePct" && Number.isFinite(scales.archeryDamagePctPerRank)) {
        ch.value = String(Number(scales.archeryDamagePctPerRank) * rank);
      }
      if (key === "flags.eq5e.ranger.companionHpBonus" && Number.isFinite(scales.companionHpPerRank)) {
        ch.value = String(Number(scales.companionHpPerRank) * rank);
      }
      if (key === "flags.eq5e.ranger.companionDamagePct" && Number.isFinite(scales.companionDamagePctPerRank)) {
        ch.value = String(Number(scales.companionDamagePctPerRank) * rank);
      }
      if (key === "flags.eq5e.druid.healBonus" && Number.isFinite(scales.healBonusPerRank)) {
        ch.value = String(Number(scales.healBonusPerRank) * rank);
      }
      if (key === "flags.eq5e.druid.spellDamagePct" && Number.isFinite(scales.spellDamagePctPerRank)) {
        ch.value = String(Number(scales.spellDamagePctPerRank) * rank);
      }
      if (key === "flags.eq5e.druid.wildshapeMastery" && Number.isFinite(scales.wildshapeMitigationPerRank)) {
        ch.value = String(Number(scales.wildshapeMitigationPerRank) * rank);
      }
      if (key === "flags.eq5e.druid.companionHpBonus" && Number.isFinite(scales.companionHpPerRank)) {
        ch.value = String(Number(scales.companionHpPerRank) * rank);
      }

if (key === "flags.eq5e.enchanter.mezDurationPct" && Number.isFinite(scales.mezDurationPctPerRank)) {
  ch.value = String(Number(scales.mezDurationPctPerRank) * rank);
}
if (key === "flags.eq5e.enchanter.charmDurationPct" && Number.isFinite(scales.charmDurationPctPerRank)) {
  ch.value = String(Number(scales.charmDurationPctPerRank) * rank);
}
if (key === "flags.eq5e.bard.mezDurationPct" && Number.isFinite(scales.mezDurationPctPerRank)) {
  ch.value = String(Number(scales.mezDurationPctPerRank) * rank);
}
if (key === "flags.eq5e.shadowknight.lifetapHealBonus" && Number.isFinite(scales.lifetapHealBonusPerRank)) {
  ch.value = String(Number(scales.lifetapHealBonusPerRank) * rank);
}
if (key === "flags.eq5e.shadowknight.lifetapDamagePct" && Number.isFinite(scales.lifetapDamagePctPerRank)) {
  ch.value = String(Number(scales.lifetapDamagePctPerRank) * rank);
}
if (key === "flags.eq5e.necromancer.dotDamagePct" && Number.isFinite(scales.dotDamagePctPerRank)) {
  ch.value = String(Number(scales.dotDamagePctPerRank) * rank);
}
if (key === "flags.eq5e.druid.rootDurationPct" && Number.isFinite(scales.rootDurationPctPerRank)) {
  ch.value = String(Number(scales.rootDurationPctPerRank) * rank);
}

if (key === "flags.eq5e.ranger.petThreatPct" && Number.isFinite(scales.threatPctPerRank)) {
  ch.value = String(Number(scales.threatPctPerRank) * rank);
}
if (key === "flags.eq5e.ranger.petTauntBonus" && Number.isFinite(scales.tauntBonusPerRank)) {
  ch.value = String(Number(scales.tauntBonusPerRank) * rank);
}
if (key === "flags.eq5e.beastlord.warderThreatPct" && Number.isFinite(scales.threatPctPerRank)) {
  ch.value = String(Number(scales.threatPctPerRank) * rank);
}
if (key === "flags.eq5e.beastlord.warderTauntBonus" && Number.isFinite(scales.tauntBonusPerRank)) {
  ch.value = String(Number(scales.tauntBonusPerRank) * rank);
}
if (key === "flags.eq5e.druid.companionThreatPct" && Number.isFinite(scales.threatPctPerRank)) {
  ch.value = String(Number(scales.threatPctPerRank) * rank);
}
if (key === "flags.eq5e.necromancer.undeadThreatPct" && Number.isFinite(scales.threatPctPerRank)) {
  ch.value = String(Number(scales.threatPctPerRank) * rank);
}


if (key.endsWith("ThreatTransferPct") && Number.isFinite(scales.transferPctPerRank)) {
  ch.value = String(Number(scales.transferPctPerRank) * rank);
}


// Wizard scalers
if (key === "flags.eq5e.wizard.familiarManaRegenPct" && Number.isFinite(scales.familiarManaRegenPctPerRank)) {
  ch.value = String(Number(scales.familiarManaRegenPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.familiarCritPct" && Number.isFinite(scales.familiarCritPctPerRank)) {
  ch.value = String(Number(scales.familiarCritPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.fireFocusPct" && Number.isFinite(scales.fireFocusPctPerRank)) {
  ch.value = String(Number(scales.fireFocusPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.coldFocusPct" && Number.isFinite(scales.coldFocusPctPerRank)) {
  ch.value = String(Number(scales.coldFocusPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.arcanePenPct" && Number.isFinite(scales.arcanePenPctPerRank)) {
  ch.value = String(Number(scales.arcanePenPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.familiarHpBonus" && Number.isFinite(scales.familiarHpPerRank)) {
  ch.value = String(Number(scales.familiarHpPerRank) * rank);
}
if (key === "flags.eq5e.wizard.familiarWardingBonus" && Number.isFinite(scales.familiarWardingPerRank)) {
  ch.value = String(Number(scales.familiarWardingPerRank) * rank);
}
if (key === "flags.eq5e.wizard.familiarManaRefundPct" && Number.isFinite(scales.manaRefundPctPerRank)) {
  ch.value = String(Number(scales.manaRefundPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.spellCritPct" && Number.isFinite(scales.spellCritPctPerRank)) {
  ch.value = String(Number(scales.spellCritPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.spellCritDmgPct" && Number.isFinite(scales.spellCritDmgPctPerRank)) {
  ch.value = String(Number(scales.spellCritDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.fireSpecPct" && Number.isFinite(scales.fireSpecPctPerRank)) {
  ch.value = String(Number(scales.fireSpecPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.coldSpecPct" && Number.isFinite(scales.coldSpecPctPerRank)) {
  ch.value = String(Number(scales.coldSpecPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.lurePartialResistBonus" && Number.isFinite(scales.lurePartialResistBonusPerRank)) {
  ch.value = String(Number(scales.lurePartialResistBonusPerRank) * rank);
}
if (key === "flags.eq5e.wizard.rainTickDmgPct" && Number.isFinite(scales.rainTickDmgPctPerRank)) {
  ch.value = String(Number(scales.rainTickDmgPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.spellThreatRedPct" && Number.isFinite(scales.spellThreatRedPctPerRank)) {
  ch.value = String(Number(scales.spellThreatRedPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.oocManaRegenPct" && Number.isFinite(scales.oocManaRegenPctPerRank)) {
  ch.value = String(Number(scales.oocManaRegenPctPerRank) * rank);
}
if (key === "flags.eq5e.wizard.cooldownRedPct" && Number.isFinite(scales.cooldownRedPctPerRank)) {
  ch.value = String(Number(scales.cooldownRedPctPerRank) * rank);
}

// Pet aggro + durability scalers
if (key.endsWith("ThreatDecayRedPct") && Number.isFinite(scales.decayReductionPctPerRank)) {
  ch.value = String(Number(scales.decayReductionPctPerRank) * rank);
}
if (key.endsWith("StickinessPct") && Number.isFinite(scales.stickinessPctPerRank)) {
  ch.value = String(Number(scales.stickinessPctPerRank) * rank);
}
if (key.endsWith("HpBonus") && Number.isFinite(scales.petHpBonusPerRank)) {
  ch.value = String(Number(scales.petHpBonusPerRank) * rank);
}
if (key.endsWith("MitigationBonus") && Number.isFinite(scales.petMitigationPerRank)) {
  ch.value = String(Number(scales.petMitigationPerRank) * rank);
}
if (key.endsWith("WardingBonus") && Number.isFinite(scales.petWardingPerRank)) {
  ch.value = String(Number(scales.petWardingPerRank) * rank);
}

if (key === "flags.eq5e.shadowknight.minionThreatPct" && Number.isFinite(scales.threatPctPerRank)) {
  ch.value = String(Number(scales.threatPctPerRank) * rank);
}

if (key === "flags.eq5e.druid.snareDurationPct" && Number.isFinite(scales.snareDurationPctPerRank)) {
  ch.value = String(Number(scales.snareDurationPctPerRank) * rank);
}

      if (key === "flags.eq5e.druid.companionDamagePct" && Number.isFinite(scales.companionDamagePctPerRank)) {
        ch.value = String(Number(scales.companionDamagePctPerRank) * rank);
      }


        ch.value = String(Number(scales.companionDamagePctPerRank) * rank);
      }

      if (key === "flags.eq5e.pet.hpBonus" && Number.isFinite(scales.petHpPerRank)) {
        ch.value = String(Number(scales.petHpPerRank) * rank);
      }
      if (key === "flags.eq5e.pet.attackBonus" && Number.isFinite(scales.petAttackPerRank)) {
        ch.value = String(Number(scales.petAttackPerRank) * rank);
      }
      if (key === "flags.eq5e.pet.damageBonus" && Number.isFinite(scales.petDamagePerRank)) {
        ch.value = String(Number(scales.petDamagePerRank) * rank);
      }
      if (key === "flags.eq5e.pet.acBonus" && Number.isFinite(scales.petAcPerRank)) {
        ch.value = String(Number(scales.petAcPerRank) * rank);
      }
      if (key === "flags.eq5e.defense.acBonus" && Number.isFinite(scales.acBonusPerRank)) {
        ch.value = String(Number(scales.acBonusPerRank) * rank);
      }
      if (key === "flags.eq5e.spell.potencyMult" && Number.isFinite(scales.potencyMultPerRank)) {
        ch.value = String(Number(scales.potencyMultPerRank) * rank);
      }
    }
    updates.push({ _id: ef.id, changes: e.changes });
  }
  if (updates.length) await item.updateEmbeddedDocuments("ActiveEffect", updates);
}

export async function purchaseAA({ actor, aaDoc }) {
  if (!actor || !aaDoc) return { ok: false, reason: "missing" };
  if (!actor.isOwner) return { ok: false, reason: "no-permission" };

  if (!_meetsPrereq(actor, aaDoc)) return { ok: false, reason: "prereq" };

  const aaId = aaDoc.flags?.eq5e?.aa?.aaId;
  if (!aaId) return { ok: false, reason: "missing-aaId" };

  const state = _aaState(actor);
  const cost = _cost(aaDoc);
  const current = _currentRankOnActor(actor, aaId);
  const max = _maxRank(aaDoc);

  if (current >= max) return { ok: false, reason: "max-rank" };
  if (state.unspent < cost) return { ok: false, reason: "insufficient" };

  // Create or update owned item
  const owned = actor.items?.find(i => i?.flags?.eq5e?.aa?.aaId === aaId);
  if (!owned) {
    const obj = aaDoc.toObject();
    delete obj._id;
    obj.flags = obj.flags ?? {};
    obj.flags.eq5e = obj.flags.eq5e ?? {};
    obj.flags.eq5e.aa = obj.flags.eq5e.aa ?? {};
    obj.flags.eq5e.aa.rank = 1;
    const created = await actor.createEmbeddedDocuments("Item", [obj]);
    const it = created?.[0];
    if (it) await _applyRankScaling(actor, it);
  } else {
    const nextRank = current + 1;
    await owned.setFlag("eq5e", "aa", { ...(owned.flags?.eq5e?.aa ?? {}), rank: nextRank });
    await _applyRankScaling(actor, owned);
  }

  await _setAAState(actor, { unspent: state.unspent - cost });
  return { ok: true, aaId, spent: cost, newRank: current + 1 };
}

export async function awardAAPoints(actor, amount=1) {
  if (!actor) return;
  const state = _aaState(actor);
  const next = {
    total: state.total + amount,
    unspent: state.unspent + amount
  };
  await _setAAState(actor, next);
  return next;
}

export function getAAState(actor) {
  return _aaState(actor);
}

export async function respecAAs(actor) {
  if (!actor) return { ok: false, reason: "missing" };
  if (!actor.isOwner) return { ok: false, reason: "no-permission" };

  const ownedAAs = actor.items?.filter(i => i?.flags?.eq5e?.aa?.aaId) ?? [];
  const state = getAAState(actor);

  // Refund all spent AA points: set unspent = total
  await actor.setFlag("eq5e", "aa", { ...(actor.flags?.eq5e?.aa ?? {}), unspent: state.total });

  // Delete owned AA items
  if (ownedAAs.length) {
    await actor.deleteEmbeddedDocuments("Item", ownedAAs.map(i => i.id));
  }

  return { ok: true, refunded: Math.max(0, state.total - state.unspent), removed: ownedAAs.length };
}
