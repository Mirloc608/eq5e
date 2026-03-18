import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("cleric", {
  label: "Cleric",
  tabs: [
    { id: "prayers", label: "Prayers" },
    { id: "blessings", label: "Blessings" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/cleric/prayers.html" },
    { path: "systems/eq5e/templates/classes/cleric/blessings.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Cleric Ability")
});
