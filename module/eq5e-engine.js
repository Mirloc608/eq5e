// eq5e-engine.js
// Core bootstrap utilities for the EQ5e system.
// ------------------------------------------------

export const EQ5eEngine = {
  /**
   * Safe getter for nested system data.
   */
  get(obj, path, fallback = null) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj) ?? fallback;
  },

  /**
   * Clamp a numeric value.
   */
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  },

  /**
   * Roll a Foundry formula safely.
   */
  rollFormula(formula, data = {}) {
    try {
      const roll = new Roll(formula, data);
      return roll.evaluate({ async: false });
    } catch (err) {
      console.error("EQ5e | Invalid roll formula:", formula, err);
      return null;
    }
  }
};
