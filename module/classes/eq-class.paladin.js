import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("paladin", {
  label: "Paladin",
  tabs: [
    { id: "virtues", label: "Virtues" },
    { id: "smite", label: "Smite" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/paladin/virtues.html" },
    { path: "systems/eq5e/templates/classes/paladin/smite.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Paladin Ability")
});
