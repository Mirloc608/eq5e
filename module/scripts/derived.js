// module/scripts/derived.js
// EQ5e Derived Stat Engine (Patched for Class Metadata)

import { EQ5eBuffs } from "./buffs.js";
import { EQ5eClassFeatures } from "./class-features.js";
import { EQ5eEquipment } from "./equipment.js";
import { EQ5eResists } from "./resists.js";
import { EQClassMetadata } from "../classes/eq-class-metadata.js";

export class EQ5eDerived {
  static prepareActor(actor) {
    if (actor.type !== "character" && actor.type !== "npc") return;

    const sys = actor.system;

    const buffs = EQ5eBuffs.collect(actor);
    const equip = EQ5eEquipment.getBonuses(actor);
    const feats = EQ5eClassFeatures.getBonuses(actor);

    this._applyPrimaryStats(sys, buffs, equip, feats);
    this._applyCombatStats(sys, buffs, equip, feats);
    this._applyResists(sys, buffs, equip, feats);
    this._applyRegen(sys, buffs, equip, feats);
    this._applyResources(actor, sys);
    this._clampValues(sys);
  }

  // ---------------------------------------------------------------------------
  // Primary Stats
  // ---------------------------------------------------------------------------

  static _applyPrimaryStats(sys, buffs, equip, feats) {
    const base = sys.attributes;

    const get = (key) =>
      (base[key] ?? 0) +
      (buffs.stats[key] ?? 0) +
      (equip.stats?.[key] ?? 0) +
      (feats.stats?.[key] ?? 0);

    sys.attributes.str = get("str");
    sys.attributes.sta = get("sta");
    sys.attributes.dex = get("dex");
    sys.attributes.agi = get("agi");
    sys.attributes.int = get("int");
    sys.attributes.wis = get("wis");
    sys.attributes.cha = get("cha");
  }

  // ---------------------------------------------------------------------------
  // Combat Stats
  // ---------------------------------------------------------------------------

  static _applyCombatStats(sys, buffs, equip, feats) {
    const base = sys.combat;

    const get = (key) =>
      (base[key] ?? 0) +
      (buffs.combat[key] ?? 0) +
      (equip.combat?.[key] ?? 0) +
      (feats.combat?.[key] ?? 0);

    sys.combat.atk = get("atk");
    sys.combat.ac = get("ac");
    sys.combat.haste = get("haste");
    sys.combat.critChance = get("critChance");
    sys.combat.critDamage = get("critDamage");
  }

  // ---------------------------------------------------------------------------
  // Resists
  // ---------------------------------------------------------------------------

  static _applyResists(sys, buffs, equip, feats) {
    const base = sys.resists;

    const get = (key) =>
      (base[key] ?? 0) +
      (buffs.resists[key] ?? 0) +
      (equip.resists?.[key] ?? 0) +
      (feats.resists?.[key] ?? 0);

    sys.resists.fire = get("fire");
    sys.resists.cold = get("cold");
    sys.resists.magic = get("magic");
    sys.resists.poison = get("poison");
    sys.resists.disease = get("disease");

    EQ5eResists.finalize(sys.resists);
  }

  // ---------------------------------------------------------------------------
  // Regen
  // ---------------------------------------------------------------------------

  static _applyRegen(sys, buffs, equip, feats) {
    const base = sys.regen;

    const get = (key) =>
      (base[key] ?? 0) +
      (buffs.regen[key] ?? 0) +
      (equip.regen?.[key] ?? 0) +
      (feats.regen?.[key] ?? 0);

    sys.regen.hp = get("hp");
    sys.regen.mana = get("mana");
    sys.regen.endurance = get("endurance");
  }

  // ---------------------------------------------------------------------------
  // Resources (HP, Mana, Endurance)
  // ---------------------------------------------------------------------------

  static _applyResources(actor, sys) {
    const cls = actor.system.class;
    const meta = EQClassMetadata[cls] ?? null;

    const a = sys.attributes;

    if (meta) {
      sys.resources.hp.max = a.sta * 10 + (sys.level * meta.hpPerLevel);
      sys.resources.mana.max = meta.primaryManaStat
        ? a[meta.primaryManaStat] * 10 + (sys.level * meta.manaPerLevel)
        : 0;
      sys.resources.endurance.max = (a.str + a.sta) * 5 + (sys.level * meta.endPerLevel);
    } else {
      sys.resources.hp.max = a.sta * 10 + (sys.level * 5);
      sys.resources.mana.max = a.int * 10 + (sys.level * 3);
      sys.resources.endurance.max = (a.str + a.sta) * 5 + (sys.level * 2);
    }

    sys.resources.hp.value = Math.min(sys.resources.hp.value, sys.resources.hp.max);
    sys.resources.mana.value = Math.min(sys.resources.mana.value, sys.resources.mana.max);
    sys.resources.endurance.value = Math.min(sys.resources.endurance.value, sys.resources.endurance.max);
  }

  // ---------------------------------------------------------------------------
  // Final clamps
  // ---------------------------------------------------------------------------

  static _clampValues(sys) {
    const clamp = (obj) => {
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "number") obj[k] = Math.max(0, v);
      }
    };

    clamp(sys.attributes);
    clamp(sys.combat);
    clamp(sys.resists);
    clamp(sys.regen);
  }
}
