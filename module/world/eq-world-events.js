// module/world/eq-world-events.js
// ------------------------------------------------------------
// World Event Scheduler
//  • Timed events (atTime in world seconds)
//  • Arc phases, crises, narrative beats
//  • Fires eqWorldEvent when an event triggers
// ------------------------------------------------------------

import { EQWorldState } from "./eq-world-state.js";

/**
 * @typedef {Object} EQWorldEvent
 * @property {string} id
 * @property {string} label
 * @property {number} atTime
 * @property {string} type
 * @property {Object} payload
 * @property {boolean} fired
 */

export const EQWorldEvents = {
  initialize() {
    const w = EQWorldState.data;
    w.events = w.events || {};
  },

  /**
   * Schedule a world event.
   * @param {Object} data
   * @param {string} [data.id]
   * @param {string} data.label
   * @param {number} data.atTime
   * @param {string} [data.type]
   * @param {Object} [data.payload]
   */
  scheduleEvent({ id = randomID(), label, atTime, type = "generic", payload = {} }) {
    const w = EQWorldState.data;

    w.events[id] = {
      id,
      label,
      atTime,
      type,
      payload,
      fired: false
    };

    console.log(`EQ5e | WorldEvents: Scheduled event '${label}' at ${atTime}s`);
  },

  /**
   * Tick all events and fire any whose time has come.
   */
  tick() {
    const w = EQWorldState.data;
    const now = w.time ?? 0;
    const events = w.events ?? {};

    for (const [id, ev] of Object.entries(events)) {
      if (!ev.fired && now >= ev.atTime) {
        this._fireEvent(ev);
        ev.fired = true;
      }
    }
  },

  /**
   * Internal: fire a world event.
   * @param {EQWorldEvent} ev
   * @private
   */
  _fireEvent(ev) {
    console.log("EQ5e | WorldEvents: Event fired:", ev);
    Hooks.callAll("eqWorldEvent", ev);
  }
};

// Initialize on ready
Hooks.once("ready", () => EQWorldEvents.initialize());

// Tick events on each Director Beat (coarse, stable)
Hooks.on("eqDirectorBeat", () => EQWorldEvents.tick());
