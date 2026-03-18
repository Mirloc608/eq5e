// module/ecosystem/eq-ecosystem-seasonal.js
// ------------------------------------------------------------
// Ecosystem Seasonal Engine
//  • Progresses seasons
//  • Applies global modifiers
// ------------------------------------------------------------

export const EQEcosystemSeasonal = {
  updateSeason(eco) {
    eco.seasonProgress = (eco.seasonProgress + 1) % 100;
    if (eco.seasonProgress === 0) {
      eco.season = this._nextSeason(eco.season);
    }
  },

  _nextSeason(season) {
    const order = ["spring", "summer", "autumn", "winter"];
    const idx = order.indexOf(season);
    return order[(idx + 1) % order.length];
  }
};
