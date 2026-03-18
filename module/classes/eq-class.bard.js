import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("bard", {
  label: "Bard",
  tabs: [
    { id: "songs", label: "Songs" },
    { id: "chants", label: "Chants" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/bard/songs.html" },
    { path: "systems/eq5e/templates/classes/bard/chants.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Bardic Performance")
});
