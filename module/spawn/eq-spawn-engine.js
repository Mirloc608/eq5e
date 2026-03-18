// module/spawn/eq-spawn-engine.js
// ------------------------------------------------------------
// Spawn Engine
//  • Ambient spawns
//  • Modified by ecosystem health
// ------------------------------------------------------------

let regionModifiers = {};

export const EQSpawnEngine = {
  setRegionModifier(regionId, mod) {
    regionModifiers[regionId] = mod;
  },

  getRegionModifier(regionId) {
    return regionModifiers[regionId] ?? 1;
  },

  spawnAmbient(regionId) {
    const baseChance = 0.2;
    const mod = this.getRegionModifier(regionId);
    const chance = baseChance * mod;

    if (Math.random() < chance) {
      console.log(`EQSpawnEngine | Ambient spawn in region ${regionId} (mod=${mod.toFixed(2)})`);
    }
  }
};

// Optional: spawn on every beat
Hooks.on("eqDirectorBeat", (world) => {
  for (const regionId of Object.keys(world.regions ?? {})) {
    EQSpawnEngine.spawnAmbient(regionId);
  }
});
