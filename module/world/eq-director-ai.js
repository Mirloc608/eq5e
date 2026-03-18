// module/world/eq-director-ai.js
// ------------------------------------------------------------
// Director AI Personality System
// Personalities:
//  • balanced (default)
//  • aggressive
//  • cautious
//  • chaotic
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

function getPersonality() {
  return EQWorldState.data.personality || "balanced";
}

export const EQDirectorAI = {
  /**
   * Optional pacing modifier based on personality.
   * @param {number} pacing
   * @returns {number}
   */
  modifyPacing(pacing) {
    const p = getPersonality();
    if (p === "aggressive") return pacing * 1.1;
    if (p === "cautious") return pacing * 0.9;
    if (p === "chaotic") return pacing * (0.7 + Math.random() * 0.8);
    return pacing;
  },

  _scale(base, aggressive, cautious) {
    const p = getPersonality();
    if (p === "aggressive") return base * aggressive;
    if (p === "cautious") return base * cautious;
    if (p === "chaotic") return base * (0.5 + Math.random() * 1.5);
    return base;
  },

  modifySpawnChance(base) {
    return this._scale(base, 1.5, 0.6);
  },

  modifyAmbientChance(base) {
    return this._scale(base, 0.8, 1.2);
  },

  modifyFactionChance(base) {
    return this._scale(base, 1.4, 0.7);
  },

  modifyRegionEscalationChance(base) {
    return this._scale(base, 1.3, 0.8);
  }
};
