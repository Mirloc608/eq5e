// module/world/ui/eq-world-dashboard.js
// ------------------------------------------------------------
// Unified World Simulation Dashboard
// Tabs:
//  • Director
//  • Timeline
//  • Heatmap
//  • Forecast
//  • Influence
//  • Settlements
//  • Story Arcs
// ------------------------------------------------------------

import { EQDirectorPanel } from "./eq-director-panel.js";
import { EQDirectorTimeline } from "./eq-director-timeline.js";
import { EQDirectorHeatmap } from "./eq-director-heatmap.js";
import { EQDirectorForecast } from "./eq-director-forecast.js";
import { EQRegionInfluencePanel } from "./eq-region-influence-panel.js";
import { EQSettlementPanel } from "./eq-settlement-panel.js";
import { EQStoryArcEditor } from "./eq-story-arc-editor.js";

export class EQWorldDashboard extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-world-dashboard",
      title: "World Simulation Dashboard",
      template: "systems/eq5e/templates/world/world-dashboard.html",
      width: 900,
      height: 700,
      tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "director" }]
    });
  }

  getData() {
    return {};
  }

  activateListeners(html) {
    super.activateListeners(html);

    const panels = {
      director: EQDirectorPanel,
      timeline: EQDirectorTimeline,
      heatmap: EQDirectorHeatmap,
      forecast: EQDirectorForecast,
      influence: EQRegionInfluencePanel,
      settlements: EQSettlementPanel,
      arcs: EQStoryArcEditor
    };

    html.find(".eq-open-panel").click(ev => {
      const panel = ev.currentTarget.dataset.panel;
      const PanelClass = panels[panel];
      if (PanelClass) new PanelClass().render(true);
    });
  }
}
