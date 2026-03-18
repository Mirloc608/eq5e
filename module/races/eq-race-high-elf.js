import { EQRaceRegistry, rollRaceFeatureGeneric } from "./eq-race-registry.js";

EQRaceRegistry.register("high-elf", {
  label: "High Elf",
  tabs: [],
  partials: [],
  rollFeature: (actor, featureId) =>
    rollRaceFeatureGeneric(actor, featureId, "1d8", "High Elf Racial Ability")
});
