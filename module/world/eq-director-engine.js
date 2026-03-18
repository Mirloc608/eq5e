// module/world/eq-director-engine.js
// ------------------------------------------------------------
// Director Engine
//  • Advances world time
//  • Fires eqDirectorBeat hook
//  • All simulation layers listen to this
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

export const EQDirectorEngine = {
  onBeat() {
    EQWorldState.incrementBeat();

    Hooks.callAll("eqDirectorBeat", EQWorldState.data);
  }
};
