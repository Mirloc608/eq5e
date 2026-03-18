// module/factions/eq-faction-engine.js
// ------------------------------------------------------------
// Faction Engine
//  • Stores faction data in world state
//  • Supports ecoBehavior + region assignment
// ------------------------------------------------------------

import { EQWorldState } from "../world/eq-world-state.js";

export const EQFactionEngine = {
  getAll() {
    return EQWorldState.data.factions ?? {};
  },

  setFaction(id, data) {
    EQWorldState.data.factions = EQWorldState.data.factions || {};
    EQWorldState.data.factions[id] = foundry.utils.mergeObject(
      EQWorldState.data.factions[id] || {},
      data,
      { inplace: false }
    );
  },

  setRegion(id, regionId) {
    this.setFaction(id, { region: regionId });
  },

  setEcoBehavior(id, behavior) {
    this.setFaction(id, { ecoBehavior: behavior });
  }
};
