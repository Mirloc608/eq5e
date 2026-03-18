import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("rogue", {
  label: "Rogue",
  tabs: [
    { id: "stealth", label: "Stealth" },
    { id: "tricks", label: "Tricks" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/rogue/stealth.html" },
    { path: "systems/eq5e/templates/classes/rogue/tricks.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Rogue Ability")
});
