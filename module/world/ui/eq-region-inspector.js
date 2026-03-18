// module/world/ui/eq-region-inspector.js
// ------------------------------------------------------------
// World Inspector
// Click a region → show full stats
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQRegionInspector extends Application {
  constructor(regionId) {
    super();
    this.regionId = regionId;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-region-inspector",
      title: "Region Inspector",
      template: "systems/eq5e/templates/world/region-inspector.html",
      width: 500,
      height: "auto"
    });
  }

  getData() {
    const region = EQWorldState.data.regions[this.regionId];
    return { region };
  }
}

// Canvas click handler
Hooks.on("clickCanvas", (canvas, event) => {
  const pos = event.data.getLocalPosition(canvas.stage);
  const regions = EQWorldState.data.regions ?? {};

  for (const [id, region] of Object.entries(regions)) {
    if (!region.polygon) continue;
    if (PIXI.utils.isPointInPolygon(pos, region.polygon)) {
      new EQRegionInspector(id).render(true);
      return;
    }
  }
});
