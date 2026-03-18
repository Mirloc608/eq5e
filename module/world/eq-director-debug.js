// module/world/eq-director-debug.js
// ------------------------------------------------------------
// Optional Director Debug Logging
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

const DEBUG_DIRECTOR = false;

Hooks.on("eqDirectorBeat", (world) => {
  if (!DEBUG_DIRECTOR) return;

  console.log("EQ5e | Director Beat", {
    beat: world.beat,
    pacing: world.pacing,
    personality: world.personality,
    mood: world.mood,
    moodIntensity: world.moodIntensity,
    time: world.time,
    day: world.day
  });
});

// Optional manual debug helper
Hooks.once("ready", () => {
  game.eq5e = game.eq5e || {};
  game.eq5e.dumpDirectorState = () => {
    console.log("EQ5e | Director State Dump", EQWorldState.data);
  };
});
