// module/world/ui/eq-gm-quickbar.js
// ------------------------------------------------------------
// GM Quick‑Action Bar
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";
import { EQDirectorOverlay } from "./eq-director-overlay.js";
import { EQWorldDashboard } from "./eq-world-dashboard.js";

export class EQGMQuickbar {
  static render() {
    const bar = document.createElement("div");
    bar.classList.add("eq-gm-quickbar");

    bar.innerHTML = `
      <button data-action="beat">Beat</button>
      <button data-action="dashboard">Dashboard</button>
      <button data-action="overlay">Overlay</button>
      <button data-action="inspect">Inspector</button>
    `;

    document.body.appendChild(bar);

    bar.addEventListener("click", ev => {
      const action = ev.target.dataset.action;
      if (action === "beat") EQWorldState.triggerBeat();
      if (action === "dashboard") new EQWorldDashboard().render(true);
      if (action === "overlay") EQDirectorOverlay.toggle();
      if (action === "inspect") ui.notifications.info("Click a region to inspect");
    });
  }
}

Hooks.once("ready", () => EQGMQuickbar.render());
