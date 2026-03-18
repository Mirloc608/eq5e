import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("monk", {
  label: "Monk",
  tabs: [
    { id: "stances", label: "Stances" },
    { id: "techniques", label: "Techniques" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/monk/stances.html" },
    { path: "systems/eq5e/templates/classes/monk/techniques.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Monk Technique")
});
