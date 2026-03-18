import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("ranger", {
  label: "Ranger",
  tabs: [
    { id: "archery", label: "Archery" },
    { id: "tracking", label: "Tracking" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/ranger/archery.html" },
    { path: "systems/eq5e/templates/classes/ranger/tracking.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Ranger Ability")
});
