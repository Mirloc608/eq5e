import { EQRaceRegistry, rollRaceFeatureGeneric } from "./eq-race-registry.js";

EQRaceRegistry.register("barbarian", {
  label: "Barbarian",
  tabs: [],
  partials: [],
  rollFeature: (actor, featureId) =>
    rollRaceFeatureGeneric(actor, featureId, "1d8", "Barbarian Racial Ability")
});
