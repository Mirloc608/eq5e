// module/world/eq-world-state.js
// ------------------------------------------------------------
// EQ World State
//  • Central mutable simulation state
//  • Shared by Director, Ecosystem, Regions, Factions, Spawn
// ------------------------------------------------------------

export const EQWorldState = {
  data: {
    time: {
      day: 1,
      beat: 0
    },

    regions: {},     // regionId → region data
    factions: {},    // factionId → faction data

    ecosystem: {
      season: "spring",
      seasonProgress: 0,
      regions: {}     // regionId → { forage, game, water }
    }
  },

  initialize() {
    console.log("EQ5e | Initializing World State");

    this.data.regions = this.data.regions || {};
    this.data.factions = this.data.factions || {};

    this.data.ecosystem = this.data.ecosystem || {
      season: "spring",
      seasonProgress: 0,
      regions: {}
    };
  },

  incrementBeat() {
    this.data.time.beat++;

    if (this.data.time.beat >= 24) {
      this.data.time.beat = 0;
      this.data.time.day++;
    }
  }
};
