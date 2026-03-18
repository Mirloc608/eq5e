import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("magician", {
  label: "Magician",
  tabs: [
    { id: "conjurations", label: "Conjurations" },
    { id: "elementals", label: "Elementals" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/magician/conjurations.html" },
    { path: "systems/eq5e/templates/classes/magician/elementals.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Magician Ability")
});
