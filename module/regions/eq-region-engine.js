// module/regions/eq-region-engine.js
// ------------------------------------------------------------
// Region Engine
//  • Maintains region danger
//  • Applies danger → ecosystem depletion feedback
// ------------------------------------------------------------

export const EQRegionEngine = {
  onBeat(world) {
    const regions = world.regions ?? {};
    const eco = world.ecosystem;

    for (const [regionId, region] of Object.entries(regions)) {
      const ecoRegion = eco.regions?.[regionId];
      if (!ecoRegion) continue;

      // Danger > 5 slowly depletes resources
      if ((region.danger ?? 0) > 5) {
        ecoRegion.forage *= 0.98;
        ecoRegion.game *= 0.97;
      }

      // Clamp
      ecoRegion.forage = Math.min(100, Math.max(0, ecoRegion.forage));
      ecoRegion.game = Math.min(100, Math.max(0, ecoRegion.game));
    }
  }
};

Hooks.on("eqDirectorBeat", (world) => {
  EQRegionEngine.onBeat(world);
});
