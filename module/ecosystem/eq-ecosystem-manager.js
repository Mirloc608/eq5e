// module/ecosystem/eq-ecosystem-manager.js
// ------------------------------------------------------------
// Ecosystem Manager
//  • Runs on Director Beats
//  • Updates resources, seasons, and spawn weights
//  • Writes results into World State
// ------------------------------------------------------------

import { EQWorldState } from "../world/eq-world-state.js";
import { EQEcosystemResource } from "./eq-ecosystem-resource.js";
import { EQEcosystemSeasonal } from "./eq-ecosystem-seasonal.js";
import { EQEcosystemSpawn } from "./eq-ecosystem-spawn.js";

export const EQEcosystemManager = {
  initialize() {
    const w = EQWorldState.data;
    w.ecosystem = w.ecosystem || {
      season: "spring",
      seasonProgress: 0,
      regions: {}
    };
  },

  onBeat(world) {
    const eco = world.ecosystem;
    if (!eco) return;

    EQEcosystemSeasonal.updateSeason(eco);
    EQEcosystemResource.updateResources(eco, world);
    EQEcosystemSpawn.updateSpawnWeights(eco, world);
  }
};

Hooks.on("eqDirectorBeat", (world) => {
  EQEcosystemManager.onBeat(world);
});

Hooks.once("ready", () => EQEcosystemManager.initialize());
