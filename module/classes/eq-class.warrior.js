import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("warrior", {
  label: "Warrior",
  tabs: [
    { id: "stances", label: "Stances" },
    { id: "maneuvers", label: "Maneuvers" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/warrior/stances.html" },
    { path: "systems/eq5e/templates/classes/warrior/maneuvers.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Warrior Ability")
});
