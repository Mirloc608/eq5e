import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("berserker", {
  label: "Berserker",
  tabs: [
    { id: "rages", label: "Rages" },
    { id: "throws", label: "Throws" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/berserker/rages.html" },
    { path: "systems/eq5e/templates/classes/berserker/throws.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d10", "Berserker Rage")
});
