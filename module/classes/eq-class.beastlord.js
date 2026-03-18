import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("beastlord", {
  label: "Beastlord",
  tabs: [
    { id: "companions", label: "Companions" },
    { id: "claws", label: "Claws" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/beastlord/companions.html" },
    { path: "systems/eq5e/templates/classes/beastlord/claws.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Beastlord Ability")
});
