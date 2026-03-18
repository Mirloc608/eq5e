// module/world/eq-region-influence.js
// ------------------------------------------------------------
// Region Influence Map
//  • Computes faction control per region
//  • Used by Region Influence Panel / Heatmaps
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

export const EQRegionInfluence = {
  /**
   * Compute influence data for all regions.
   * @returns {Object<string, {label: string, factions: Array<{id: string, label: string, value: number, percent: number}>}>}
   */
  compute() {
    const regions = EQWorldState.data.regions ?? {};
    const factions = EQWorldState.data.factions ?? {};

    const result = {};

    for (const [regionId, region] of Object.entries(regions)) {
      const inf = region.influence ?? {}; // { factionId: value }
      const entries = Object.entries(inf);
      const total = entries.reduce((s, [, v]) => s + (v ?? 0), 0) || 1;

      result[regionId] = {
        label: region.label || regionId,
        factions: entries.map(([fid, val]) => ({
          id: fid,
          label: factions[fid]?.label ?? fid,
          value: val,
          percent: Math.round((val / total) * 100)
        }))
      };
    }

    return result;
  }
};
