// module/events/eq-ambient-events.js
// ------------------------------------------------------------
// Ambient Events Engine
//  • Triggers non-combat world flavor events
//  • Director Engine calls triggerRandom(world)
// ------------------------------------------------------------

import { EQWorldState } from "../world/eq-world-state.js";

export const EQAmbientEvents = {
  /**
   * Trigger a random ambient event based on world state.
   * @param {import("../world/eq-world-state.js").EQWorldData} world
   */
  triggerRandom(world) {
    // Placeholder: you can route by region, time of day, etc.
    Hooks.callAll("eqAmbientEvent", { world });
    console.log("EQ5e | AmbientEvents: Random ambient event triggered");
  }
};
