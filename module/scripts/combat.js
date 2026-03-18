// module/scripts/combat.js
// --------------------------------

import { EQRolls } from "../rolls/eq-rolls.js";

export class EQCombat {
  static async weaponAttack(actor, item, target) {
    const roll = await EQRolls.rollWeaponAttack(actor, item);
    if (!roll) return null;
 
    const total = roll.total ?? 0;
    const ac = Number(target?.system?.combat?.ac ?? 10);
    const hit = total >= ac;

    const message = await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Weapon Attack: ${item.name}`,
      content: `
        <div>Attack Total: ${total} vs AC ${ac}</div>
        <div>${hit ? "<b>HIT</b>" : "MISS"}</div>
        ${hit ? `<button class="eq-apply-damage" data-target="${target.id}" data-amount="${item.system.damage ?? 1}">
          Apply Damage
        </button>` : ""}
    `
    });

    return { roll, hit, ac, total };
  }


  static applyDamage(target, amount) {
    const hp = Number(target.system.resources?.hp?.value ?? 0);
    const next = Math.max(0, hp - amount);
    target.update({ "system.resources.hp.value": next });
    return next;
  }
}
