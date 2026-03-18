// module/world/ui/eq-settlement-panel.js
// ------------------------------------------------------------
// Settlement Simulation Panel
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQSettlementPanel extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-settlement-panel",
      title: "Settlements",
      template: "systems/eq5e/templates/world/settlements.html",
      width: 520,
      height: "auto"
    });
  }

  getData() {
    return {
      settlements: EQWorldState.data.settlements ?? {}
    };
  }
}
