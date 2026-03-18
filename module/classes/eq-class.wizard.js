import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("wizard", {
  label: "Wizard",
  tabs: [
    { id: "spellbook", label: "Spellbook" },
    { id: "focus", label: "Focus" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/wizard/spellbook.html" },
    { path: "systems/eq5e/templates/classes/wizard/focus.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Wizard Ability")
});
