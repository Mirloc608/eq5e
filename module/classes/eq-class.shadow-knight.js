import { EQClassRegistry, rollClassFeatureGeneric } from "./eq-class-feature-helper.js";

EQClassRegistry.register("shadow-knight", {
  label: "Shadow Knight",
  tabs: [
    { id: "darkness", label: "Darkness" },
    { id: "curses", label: "Curses" }
  ],
  partials: [
    { path: "systems/eq5e/templates/classes/shadow-knight/darkness.html" },
    { path: "systems/eq5e/templates/classes/shadow-knight/curses.html" }
  ],
  rollFeature: (actor, featureId) =>
    rollClassFeatureGeneric(actor, featureId, "1d8", "Shadow Knight Ability")
});
