// module/world/eq-director-mood.js
// ------------------------------------------------------------
// Director Mood Engine
// Moods: calm, rage, panic, frenzy
// Modulates pacing via mood + intensity
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

export const EQDirectorMood = {
  /**
   * Ensure mood fields exist.
   */
  initialize() {
    const w = EQWorldState.data;
    w.mood = w.mood || "calm";
    w.moodIntensity = typeof w.moodIntensity === "number" ? w.moodIntensity : 5;
  },

  /**
   * Set mood and intensity (0–10).
   * @param {string} mood
   * @param {number} intensity
   */
  setMood(mood, intensity = 5) {
    const w = EQWorldState.data;
    w.mood = mood;
    w.moodIntensity = Math.max(0, Math.min(10, intensity));
  },

  /**
   * Drift mood intensity slightly toward neutral (5).
   */
  tick() {
    const w = EQWorldState.data;
    let i = typeof w.moodIntensity === "number" ? w.moodIntensity : 5;
    if (i > 5) i -= 0.5;
    else if (i < 5) i += 0.5;
    w.moodIntensity = Math.max(0, Math.min(10, i));
  },

  /**
   * Apply mood to pacing.
   * @param {number} basePacing
   * @returns {number}
   */
  applyToPacing(basePacing) {
    const w = EQWorldState.data;
    const mood = w.mood || "calm";
    const t = (w.moodIntensity ?? 5) / 10; // 0–1

    if (mood === "calm") return basePacing * (1 - 0.3 * t);
    if (mood === "rage") return basePacing * (1 + 0.5 * t);
    if (mood === "panic") return basePacing * (1 + 0.3 * t);
    if (mood === "frenzy") return basePacing * (1 + 0.8 * t);
    return basePacing;
  }
};

Hooks.once("ready", () => EQDirectorMood.initialize());
Hooks.on("eqDirectorBeat", () => EQDirectorMood.tick());
