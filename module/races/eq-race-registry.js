// module/races/eq-race-registry.js
// Unified race registry + generic feature roller
// ----------------------------------------------

export const EQRaceRegistry = {
  _registry: {},

  register(id, data) {
    this._registry[id] = data;
  },

  get(id) {
    return this._registry[id] ?? null;
  },

  all() {
    return this._registry;
  }
};

export async function rollRaceFeatureGeneric(actor, featureId, formula = "1d20", label = "Racial Ability") {
  const item = actor.items.get(featureId);
  if (!item) {
    ui.notifications.warn(`Race feature not found: ${featureId}`);
    return null;
  }

  const roll = await new Roll(formula, { actor, item }).evaluate({ async: true });
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${label}: ${item.name}`
  });
  return roll;
}
