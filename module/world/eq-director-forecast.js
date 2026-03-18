// module/world/ui/eq-director-forecast.js
// ------------------------------------------------------------
// Threat Forecast Panel
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQDirectorForecast extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-director-forecast",
      title: "Threat Forecast",
      template: "systems/eq5e/templates/world/director-forecast.html",
      width: 520,
      height: "auto"
    });
  }

  getData() {
    const w = EQWorldState.data;

    const regionForecast = Object.entries(w.regions ?? {}).map(([id, r]) => ({
      id,
      label: r.label,
      danger: r.danger ?? 0,
      risk: (r.danger ?? 0) + (w.pacing ?? 5)
    }));

    const factionForecast = Object.entries(w.factions ?? {}).map(([id, f]) => ({
      id,
      label: f.label,
      tension: f.tension ?? 0,
      activity: f.activity ?? 0,
      risk: (f.tension ?? 0) * 2 + (f.activity ?? 0)
    }));

    return {
      pacing: w.pacing ?? 5,
      regionForecast,
      factionForecast
    };
  }
}
