// module/world/eq-story-arcs.js
// ------------------------------------------------------------
// Story Arc Engine
//  • Arcs with phases
//  • Each phase schedules a world event at offset time
//  • Activation triggers all phase events
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";
import { EQWorldEvents } from "./eq-world-events.js";

/**
 * @typedef {Object} EQStoryArcPhase
 * @property {string} id
 * @property {string} label
 * @property {number} offset
 * @property {string} type
 * @property {Object} payload
 */

/**
 * @typedef {Object} EQStoryArc
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {boolean} active
 * @property {number|null} startTime
 * @property {Array<EQStoryArcPhase>} phases
 */

export const EQStoryArcs = {
  initialize() {
    const w = EQWorldState.data;
    w.arcs = w.arcs || {};
  },

  /**
   * Create a new story arc.
   * @param {Object} data
   * @param {string} [data.id]
   * @param {string} [data.label]
   * @param {string} [data.description]
   * @returns {EQStoryArc}
   */
  createArc({ id = randomID(), label = "New Arc", description = "" } = {}) {
    const arcs = EQWorldState.data.arcs;

    arcs[id] = {
      id,
      label,
      description,
      active: false,
      startTime: null,
      phases: []
    };

    console.log("EQ5e | StoryArcs: Created arc", id);
    return arcs[id];
  },

  /**
   * Add a phase to an arc.
   * @param {string} arcId
   * @param {Object} data
   * @param {string} [data.id]
   * @param {string} [data.label]
   * @param {number} [data.offset]
   * @param {string} [data.type]
   * @param {Object} [data.payload]
   */
  addPhase(arcId, { id = randomID(), label = "Phase", offset = 0, type = "generic", payload = {} }) {
    const arc = EQWorldState.data.arcs[arcId];
    if (!arc) {
      console.warn("EQ5e | StoryArcs: Unknown arc", arcId);
      return;
    }

    arc.phases.push({ id, label, offset, type, payload });
    console.log(`EQ5e | StoryArcs: Added phase '${label}' to arc '${arc.label}'`);
  },

  /**
   * Activate an arc and schedule all its phases.
   * @param {string} arcId
   * @param {number|null} [startTime]
   */
  activateArc(arcId, startTime = null) {
    const w = EQWorldState.data;
    const arc = w.arcs[arcId];
    if (!arc) {
      console.warn("EQ5e | StoryArcs: Unknown arc", arcId);
      return;
    }

    const baseTime = startTime ?? w.time ?? 0;
    arc.active = true;
    arc.startTime = baseTime;

    for (const phase of arc.phases) {
      const atTime = baseTime + (phase.offset ?? 0);

      EQWorldEvents.scheduleEvent({
        label: `${arc.label}: ${phase.label}`,
        atTime,
        type: phase.type,
        payload: {
          ...phase.payload,
          arcId: arc.id,
          phaseId: phase.id
        }
      });
    }

    console.log(`EQ5e | StoryArcs: Activated arc '${arc.label}' at ${baseTime}s`);
  }
};

// Initialize on ready
Hooks.once("ready", () => EQStoryArcs.initialize());
