// module/world/ui/eq-story-arc-editor.js
// ------------------------------------------------------------
// Story Arc Editor (GM Tool)
// ------------------------------------------------------------

import { EQWorldState } from "../eq-world-state.js";
import { EQStoryArcs } from "../eq-story-arcs.js";

export class EQStoryArcEditor extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "eq-story-arc-editor",
      title: "Story Arcs",
      template: "systems/eq5e/templates/world/story-arcs.html",
      width: 640,
      height: "auto"
    });
  }

  getData() {
    return {
      arcs: EQWorldState.data.arcs ?? {},
      currentTime: EQWorldState.data.time ?? 0
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".eq-arc-create").click(() => {
      EQStoryArcs.createArc();
      this.render(false);
    });

    html.find(".eq-arc-activate").click(ev => {
      const id = ev.currentTarget.dataset.id;
      EQStoryArcs.activateArc(id);
      ui.notifications.info("Arc activated");
      this.render(false);
    });

    html.find(".eq-arc-add-phase").click(ev => {
      const id = ev.currentTarget.dataset.id;
      EQStoryArcs.addPhase(id, {});
      this.render(false);
    });

    html.find(".eq-arc-label").change(ev => {
      const id = ev.currentTarget.dataset.id;
      EQWorldState.data.arcs[id].label = ev.currentTarget.value;
    });

    html.find(".eq-arc-description").change(ev => {
      const id = ev.currentTarget.dataset.id;
      EQWorldState.data.arcs[id].description = ev.currentTarget.value;
    });

    html.find(".eq-phase-label").change(ev => {
      const arcId = ev.currentTarget.dataset.arcId;
      const phaseId = ev.currentTarget.dataset.phaseId;
      const phase = EQWorldState.data.arcs[arcId].phases.find(p => p.id === phaseId);
      phase.label = ev.currentTarget.value;
    });

    html.find(".eq-phase-offset").change(ev => {
      const arcId = ev.currentTarget.dataset.arcId;
      const phaseId = ev.currentTarget.dataset.phaseId;
      const phase = EQWorldState.data.arcs[arcId].phases.find(p => p.id === phaseId);
      phase.offset = Number(ev.currentTarget.value);
    });

    html.find(".eq-phase-type").change(ev => {
      const arcId = ev.currentTarget.dataset.arcId;
      const phaseId = ev.currentTarget.dataset.phaseId;
      const phase = EQWorldState.data.arcs[arcId].phases.find(p => p.id === phaseId);
      phase.type = ev.currentTarget.value;
    });
  }
}
