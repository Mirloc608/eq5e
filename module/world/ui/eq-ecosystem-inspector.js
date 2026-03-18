// module/world/ui/eq-ecosystem-inspector.js
// ------------------------------------------------------------
// Ecosystem Inspector
//  • Click a region → view ecosystem resources + modifiers
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQEcosystemInspector extends Application {
  constructor(regionId) {
    super();
    this.regionId = regionId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-ecosystem-inspector",
      title: "Ecosystem Inspector",
      template: "systems/eq5e/templates/world/ecosystem-inspector.html",
      width: 500,
      height: "auto",
      classes: ["eq-ui"]
    });
  }

  getData() {
    const w = EQWorldState.data;
    const eco = w.ecosystem?.regions?.[this.regionId] ?? { forage: 0, game: 0, water: 0 };
    const region = w.regions?.[this.regionId] ?? {};
    return {
      region,
      eco,
      season: w.ecosystem?.season,
      spawnModifier: region.spawnModifier ?? 1
    };
  }
}

// Simple canvas click hook using existing region polygons
Hooks.on("clickCanvas", (canvas, event) => {
  const pos = event.data.getLocalPosition(canvas.stage);
  const w = EQWorldState.data;

  for (const [id, region] of Object.entries(w.regions ?? {})) {
    if (!region.polygon) continue;
    if (PIXI.utils.isPointInPolygon(pos, region.polygon)) {
      new EQEcosystemInspector(id).render(true);
      return;
    }
  }
});
