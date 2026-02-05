const MODULE_ID = "eq5e-pet-enchanter-charm";

const BASE = "systems/eq5e/bundles/eq5e-pet-enchanter-charm";
const MOD = "eq5e-pet-enchanter-charm";
const CHARM_SUMMON_ID = "enchanter.charm";

function isCharmed(actor) {
  return actor?.flags?.eq5e?.summon?.summonType === "charm" && actor?.flags?.eq5e?.summon?.summonId === CHARM_SUMMON_ID;
}

function hasCharmCondition(actor) {
  return actor?.flags?.eq5e?.conditions?.charmed?.active === true || actor?.flags?.eq5e?.conditions?.charmed !== undefined;
}

Hooks.once("ready", () => {
  // When conditions are pruned/updated and charm is gone, release.
  Hooks.on("updateActor", async (actor, changes, opts, userId) => {
    try {
      if (!game.user.isGM) return;
      if (!actor) return;
      if (!isCharmed(actor)) return;

      // If charm flag exists but condition removed/expired, release
      const charm = actor.flags?.eq5e?.charm ?? null;
      const cond = actor.flags?.eq5e?.conditions?.charmed ?? null;
      const combat = game.combat;
      const round = combat?.round ?? 0;
      const expired = (cond?.expiresRound !== undefined && cond?.expiresRound !== null) ? (Number(cond.expiresRound) <= Number(round)) : false;

      if (!cond || expired) {
        await game.eq5e?.api?.despawnSummonedPet?.({ actor, reason: "charm-expired" });
      }
    } catch (e) {
      console.error("[EQ5E] charm module updateActor failed", e);
    }
  });
});
