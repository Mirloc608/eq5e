// module/world/eq-world-ticker.js
// ------------------------------------------------------------
// World Ticker
//  • Triggers Director Beats on an interval
// ------------------------------------------------------------

import { EQDirectorEngine } from "./eq-director-engine.js";

export const EQWorldTicker = {
  _intervalId: null,
  _intervalMs: 6000, // 6 seconds per beat

  start() {
    if (this._intervalId) return;

    console.log("EQ5e | World Ticker Started");

    this._intervalId = window.setInterval(() => {
      EQDirectorEngine.onBeat();
    }, this._intervalMs);
  },

  stop() {
    if (!this._intervalId) return;
    window.clearInterval(this._intervalId);
    this._intervalId = null;
  }
};
