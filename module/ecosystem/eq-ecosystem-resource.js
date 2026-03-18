// module/ecosystem/eq-ecosystem-resource.js
// ------------------------------------------------------------
// Ecosystem Resource Engine
//  • Tracks renewable resources per region
//  • Regeneration and depletion
// ------------------------------------------------------------

export const EQEcosystemResource = {
  ensureRegion(eco, regionId) {
    eco.regions[regionId] = eco.regions[regionId] || {
      forage: 100,
      game: 100,
      water: 100
    };
  },

  updateResources(eco, world) {
    const regions = world.regions ?? {};
    for (const regionId of Object.keys(regions)) {
      this.ensureRegion(eco, regionId);
      const r = eco.regions[regionId];

      r.forage = Math.min(100, r.forage + 1);
      r.game = Math.min(100, r.game + 0.5);
      r.water = Math.min(100, r.water + 0.2);

      const mod = this._seasonModifier(eco.season);
      r.forage *= mod.forage;
      r.game *= mod.game;
      r.water *= mod.water;

      r.forage = Math.min(100, Math.max(0, r.forage));
      r.game = Math.min(100, Math.max(0, r.game));
      r.water = Math.min(100, Math.max(0, r.water));
    }
  },

  _seasonModifier(season) {
    switch (season) {
      case "winter": return { forage: 0.6, game: 0.8, water: 1.0 };
      case "summer": return { forage: 0.9, game: 1.0, water: 0.8 };
      case "autumn": return { forage: 1.1, game: 1.0, water: 1.0 };
      default:       return { forage: 1.2, game: 1.1, water: 1.0 };
    }
  }
};
