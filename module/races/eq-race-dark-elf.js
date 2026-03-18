import { EQRaceRegistry, rollRaceFeatureGeneric } from "./eq-race-registry.js";

EQRaceRegistry.register("dark-elf", {
  label: "Dark Elf",
  tabs: [],
  partials: [],
  rollFeature: (actor, featureId) =>
    rollRaceFeatureGeneric(actor, featureId, "1d8", "Dark Elf Racial Ability")
});
