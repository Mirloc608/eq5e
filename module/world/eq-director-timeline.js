// module/world/ui/eq-director-timeline.js
// ------------------------------------------------------------
// Director Beat Timeline
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQDirectorTimeline extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-director-timeline",
      title: "Director Timeline",
      template: "systems/eq5e/templates/world/director-timeline.html",
      width: 520,
      height: "auto"
    });
  }

  getData() {
    return {
      timeline: EQWorldState.data.timeline ?? []
    };
  }
}

// Record beats
Hooks.on("eqDirectorBeat", world => {
  world.timeline = world.timeline ?? [];
  world.timeline.push({
    beat: world.beat,
    time: world.time,
    pacing: world.pacing,
    mood: world.mood,
    personality: world.personality,
    stamp: Date.now()
  });
});
