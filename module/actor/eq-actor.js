// module/actor/eq-actor.js
// ------------------------------------------------------------
// Unified EQ Actor
//  • Derived stats
//  • Race bonuses
//  • Cooldowns for spells & disciplines
// ------------------------------------------------------------

import { EQRaceRegistry } from "../races/eq-race-registry.js";

export class EQActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    // Abilities + race bonuses
    const abilities = sys.abilities ?? {};
    const raceId = sys.race?.id;
    const race = EQRaceRegistry.get(raceId);
    const bonuses = race?.bonuses ?? {};

    for (const [key, ability] of Object.entries(abilities)) {
      const base = Number(ability.base ?? ability.value ?? 0);
      const bonus = Number(bonuses[key] ?? 0);
      const total = base + bonus;
      ability.base = base;
      ability.raceBonus = bonus;
      ability.value = total;
    }
    sys.abilities = abilities;

    // Resources (simple example)
    if (sys.resources?.hp) {
      sys.resources.hp.max = 10 + (abilities.con?.value ?? 0) * 2;
    }
    if (sys.resources?.mana) {
      sys.resources.mana.max = (abilities.int?.value ?? 0) * 2;
    }

    // Cooldowns: normalize remaining to >= 0
    for (const item of this.items) {
      const itSys = item.system;
      if (item.type === "spell" && itSys.cooldown) {
        itSys.cooldown.remaining = Math.max(0, Number(itSys.cooldown.remaining ?? 0));
      }
      if (item.type === "discipline" && itSys.cooldown) {
        itSys.cooldown.remaining = Math.max(0, Number(itSys.cooldown.remaining ?? 0));
      }
    }
  }

  // Called by world ticker each tick (e.g., every 6 seconds)
  tickCooldowns(deltaSeconds = 6) {
    for (const item of this.items) {
      const itSys = item.system;
      if (item.type === "spell" && itSys.cooldown?.remaining > 0) {
        itSys.cooldown.remaining = Math.max(0, itSys.cooldown.remaining - deltaSeconds);
      }
      if (item.type === "discipline" && itSys.cooldown?.remaining > 0) {
        itSys.cooldown.remaining = Math.max(0, itSys.cooldown.remaining - deltaSeconds);
      }
    }
  }
}
