// module/classes/eq-class-feature-helper.js
// Central class registry + generic feature roller
// -----------------------------------------------

export const EQClassRegistry = {
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

export async function rollClassFeatureGeneric(actor, featureId, formula = "1d20", label = "Class Feature") {
  const item = actor.items.get(featureId);
  if (!item) {
    ui.notifications.warn(`Feature not found: ${featureId}`);
    return null;
  }

  const roll = await new Roll(formula, { actor, item }).evaluate({ async: true });
  roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `${label}: ${item.name}`
  });
  return roll;
}
