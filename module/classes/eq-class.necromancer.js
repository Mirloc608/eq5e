import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("necromancer", {
  label: "Necromancer",
  tabs: [
    { id: "necromancy", label: "Necromancy" },
    { id: "shadows", label: "Shadows" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/necromancer/necromancy.html" },
    { path: "systems/eq5e/templates/classes/necromancer/shadows.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Necromancer Ability")
});
