// module/ecosystem/eq-ecosystem-spawn.js
// ------------------------------------------------------------
// Ecosystem Spawn Engine
//  • Adjusts spawn weights based on ecosystem health
//  • Feeds into EQSpawnEngine
// ------------------------------------------------------------

import { EQSpawnEngine } from "../spawn/eq-spawn-engine.js";

export const EQEcosystemSpawn = {
  updateSpawnWeights(eco, world) {
    const regions = world.regions ?? {};
    for (const [regionId, region] of Object.entries(regions)) {
      const ecoRegion = eco.regions?.[regionId];
      if (!ecoRegion) continue;

      const forage = ecoRegion.forage / 100;
      const game = ecoRegion.game / 100;

      const modifier = 1 + (forage + game - 1) * 0.5;
      region.spawnModifier = modifier;

      if (EQSpawnEngine.setRegionModifier) {
        EQSpawnEngine.setRegionModifier(regionId, modifier);
      }
    }
  }
};
