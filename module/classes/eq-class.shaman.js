import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("shaman", {
  label: "Shaman",
  tabs: [
    { id: "totems", label: "Totems" },
    { id: "spirits", label: "Spirits" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/shaman/totems.html" },
    { path: "systems/eq5e/templates/classes/shaman/spirits.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Shaman Ability")
});
