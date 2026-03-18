import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("enchanter", {
  label: "Enchanter",
  tabs: [
    { id: "charms", label: "Charms" },
    { id: "illusions", label: "Illusions" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/enchanter/charms.html" },
    { path: "systems/eq5e/templates/classes/enchanter/illusions.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Enchanter Ability")
});
