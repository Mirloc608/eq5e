// module/ecosystem/eq-ecosystem-faction.js
// ------------------------------------------------------------
// Ecosystem ↔ Faction Interactions
//  • Poaching
//  • Stewardship
//  • Corruption
// ------------------------------------------------------------

export const EQEcosystemFaction = {
  onBeat(world) {
    const eco = world.ecosystem;
    const factions = world.factions ?? {};
    const regions = world.regions ?? {};
    if (!eco) return;

    for (const [factionId, faction] of Object.entries(factions)) {
      const regionId = faction.region;
      if (!regionId || !regions[regionId]) continue;

      const ecoRegion = eco.regions?.[regionId];
      if (!ecoRegion) continue;

      switch (faction.ecoBehavior) {
        case "poaching":
          this._applyPoaching(ecoRegion, regions[regionId]);
          break;
        case "stewardship":
          this._applyStewardship(ecoRegion, regions[regionId]);
          break;
        case "corruption":
          this._applyCorruption(ecoRegion, regions[regionId]);
          break;
      }
    }
  },

  _applyPoaching(ecoRegion, region) {
    ecoRegion.game = Math.max(0, ecoRegion.game - 2);
    region.danger = Math.min(10, (region.danger ?? 0) + 0.1);
  },

  _applyStewardship(ecoRegion, region) {
    ecoRegion.forage = Math.min(100, ecoRegion.forage + 1.5);
    ecoRegion.game = Math.min(100, ecoRegion.game + 1);
    region.danger = Math.max(0, (region.danger ?? 0) - 0.1);
  },

  _applyCorruption(ecoRegion, region) {
    ecoRegion.water = Math.max(0, ecoRegion.water - 1.5);
    region.danger = Math.min(10, (region.danger ?? 0) + 0.2);
  }
};

Hooks.on("eqDirectorBeat", (world) => {
  EQEcosystemFaction.onBeat(world);
});
