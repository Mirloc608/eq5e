// module/world/eq-settlement-sim.js
// ------------------------------------------------------------
// Settlement Simulation
//  • population, economy, morale
//  • ticked on Director Beats (coarse)
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

export const EQSettlementSim = {
  initialize() {
    const w = EQWorldState.data;
    w.settlements = w.settlements || {};
  },

  /**
   * Tick settlement simulation.
   * @param {number} deltaSeconds
   */
  tick(deltaSeconds = 3600) {
    const settlements = EQWorldState.data.settlements ?? {};

    for (const [id, s] of Object.entries(settlements)) {
      s.label = s.label || id;
      s.population = s.population ?? 100;
      s.economy = s.economy ?? 5; // 0–10
      s.morale = s.morale ?? 5;   // 0–10

      const econDrift = (Math.random() - 0.5) * 0.1;
      const moraleDrift = (Math.random() - 0.5) * 0.1;

      s.economy = Math.max(0, Math.min(10, s.economy + econDrift));
      s.morale = Math.max(0, Math.min(10, s.morale + moraleDrift));

      const growthRate = (s.economy - 5) * 0.001 + (s.morale - 5) * 0.001;
      s.population = Math.max(1, Math.round(s.population * (1 + growthRate)));
    }
  }
};

Hooks.once("ready", () => EQSettlementSim.initialize());
Hooks.on("eqDirectorBeat", () => EQSettlementSim.tick(3600));
