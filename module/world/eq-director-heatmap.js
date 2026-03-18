// module/world/ui/eq-director-heatmap.js
// ------------------------------------------------------------
// Region Danger Heatmap
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQDirectorHeatmap extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-director-heatmap",
      title: "Region Heatmap",
      template: "systems/eq5e/templates/world/director-heatmap.html",
      width: 420,
      height: "auto"
    });
  }

  getData() {
    return {
      regions: EQWorldState.data.regions ?? {}
    };
  }
}
