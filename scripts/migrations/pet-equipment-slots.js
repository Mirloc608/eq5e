/**
 * Migration: initialize pet equipment slot flags on existing pet actors
 * Adds flags.eq5e.petEquipmentSlots = {} if missing for any actor marked as a pet.
 */
export async function migratePetEquipmentSlots() {
  if (!game.user.isGM) return;

  const isPetActor = (a) => {
    const f = a.flags?.eq5e ?? {};
    if (f.isPet) return true;
    if (f.pet?.isPet) return true;
    if (f.petOwnerUuid) return true;
    if (f.petOwnerId) return true;
    if (f.ownerUuid) return true;
    // fallback: summoned pets created by our pipeline typically have "summonId"
    if (f.summonId || f.summon?.id) return true;
    return false;
  };

  let touched = 0;
  for (const a of game.actors?.contents ?? []) {
    if (!isPetActor(a)) continue;
    const cur = a.getFlag("eq5e","petEquipmentSlots");
    if (cur != null) continue;
    await a.setFlag("eq5e","petEquipmentSlots", {});
    touched++;
  }

  if (touched) console.log(`[EQ5E] Migration pet equipment slots initialized for ${touched} actors.`);
}
