// module/world/eq-world-system.js
// ------------------------------------------------------------
// Unified World System Orchestrator
//  • Initializes World State
//  • Starts/Stops World Ticker
//  • Exposes API on game.eq5e.world
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";
import { EQWorldTicker } from "./eq-world-ticker.js";
import { EQDirectorEngine } from "./eq-director-engine.js";

export const EQWorldSystem = {
  /**
   * Initialize the world system.
   * Called once on ready.
   */
  initialize() {
    EQWorldState.initialize();
    EQWorldTicker.start();

    // Expose on game.eq5e
    game.eq5e = game.eq5e || {};
    game.eq5e.world = this;

    console.log("EQ5e | World System initialized");
  },

  /**
   * Shutdown the world system.
   */
  shutdown() {
    EQWorldTicker.stop();
    console.log("EQ5e | World System shut down");
  },

  /**
   * Manually trigger a Director Beat + Engine pass.
   */
  triggerBeat() {
    EQWorldState.triggerBeat();
    EQDirectorEngine.onBeat(EQWorldState.data);
  }
};

// Hook Director Beat → Director Engine (single place)
Hooks.on("eqDirectorBeat", (world) => {
  EQDirectorEngine.onBeat(world);
});
