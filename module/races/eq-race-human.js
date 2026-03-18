import { EQRaceRegistry, rollRaceFeatureGeneric } from "./eq-race-registry.js";

EQRaceRegistry.register("human", {
  label: "Human",
  tabs: [],
  partials: [],
  rollFeature: (actor, featureId) =>
    rollRaceFeatureGeneric(actor, featureId, "1d8", "Human Racial Ability")
});
