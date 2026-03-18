// module/world/ui/eq-director-overlay.js
// ------------------------------------------------------------
// Canvas Overlay for Director Heatmaps
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQDirectorOverlay {
  static enabled = false;

  static toggle() {
    this.enabled = !this.enabled;
    canvas.stage.removeChild(this._graphics);
    if (this.enabled) this._draw();
  }

  static _draw() {
    const regions = EQWorldState.data.regions ?? {};
    const g = new PIXI.Graphics();
    this._graphics = g;

    for (const region of Object.values(regions)) {
      if (!region.polygon) continue;

      const danger = region.danger ?? 0;
      const color = PIXI.utils.rgb2hex([danger / 10, 0, 0]);

      g.beginFill(color, 0.35);
      g.drawPolygon(region.polygon);
      g.endFill();
    }

    canvas.stage.addChild(g);
    game.eq5e.hudLayer?.classList.add("eq-anim-fade-in");

  }
}

Hooks.on("canvasReady", () => {
  if (EQDirectorOverlay.enabled) EQDirectorOverlay._draw();
});
