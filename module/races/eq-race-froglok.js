import { EQRaceRegistry, rollRaceFeatureGeneric } from "./eq-race-registry.js";

EQRaceRegistry.register("froglok", {
  label: "Froglok",
  tabs: [],
  partials: [],
  rollFeature: (actor, featureId) =>
    rollRaceFeatureGeneric(actor, featureId, "1d8", "Froglok Racial Ability")
});
