import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("druid", {
  label: "Druid",
  tabs: [
    { id: "circles", label: "Circles" },
    { id: "nature", label: "Nature" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/druid/circles.html" },
    { path: "systems/eq5e/templates/classes/druid/nature.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Druid Ability")
});
