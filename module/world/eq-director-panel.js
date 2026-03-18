// module/world/ui/eq-director-panel.js
// ------------------------------------------------------------
// Director Panel (GM Controls)
//  • Pacing
//  • Personality
//  • Mood
//  • Region danger
//  • Faction tension/activity
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";

export class EQDirectorPanel extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-director-panel",
      title: "Director Panel",
      template: "systems/eq5e/templates/world/director-panel.html",
      width: 520,
      height: "auto"
    });
  }

  getData() {
    const w = EQWorldState.data;
    return {
      world: w,
      regions: w.regions ?? {},
      factions: w.factions ?? {}
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".eq-dir-pacing").change(ev => {
      EQWorldState.data.pacing = Number(ev.currentTarget.value);
      this.render(false);
    });

    html.find(".eq-dir-personality").change(ev => {
      EQWorldState.data.personality = ev.currentTarget.value;
      this.render(false);
    });

    html.find(".eq-dir-mood").change(ev => {
      EQWorldState.data.mood = ev.currentTarget.value;
      this.render(false);
    });

    html.find(".eq-dir-mood-intensity").change(ev => {
      EQWorldState.data.moodIntensity = Number(ev.currentTarget.value);
      this.render(false);
    });

    html.find(".eq-dir-region-danger").change(ev => {
      const id = ev.currentTarget.dataset.id;
      EQWorldState.data.regions[id].danger = Number(ev.currentTarget.value);
    });

    html.find(".eq-dir-faction-tension").change(ev => {
      const id = ev.currentTarget.dataset.id;
      EQWorldState.data.factions[id].tension = Number(ev.currentTarget.value);
    });

    html.find(".eq-dir-faction-activity").change(ev => {
      const id = ev.currentTarget.dataset.id;
      EQWorldState.data.factions[id].activity = Number(ev.currentTarget.value);
    });

    html.find(".eq-dir-trigger-beat").click(() => {
      EQWorldState.triggerBeat();
      ui.notifications.info("Director Beat triggered");
    });
  }
}
