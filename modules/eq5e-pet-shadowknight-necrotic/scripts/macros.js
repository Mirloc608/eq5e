// Example macros for pet stance control (run from Foundry macro bar)
// Requires selecting the pet token.

// Assist:
async function petAssist() {
  const t = canvas.tokens.controlled?.[0];
  if (!t?.actor) return ui.notifications.warn("Select your pet token.");
  await game.eq5e.api.setPetStance({ petUuid: t.actor.uuid, stance: "assist" });
}

// Guard:
async function petGuard() {
  const t = canvas.tokens.controlled?.[0];
  if (!t?.actor) return ui.notifications.warn("Select your pet token.");
  await game.eq5e.api.setPetStance({ petUuid: t.actor.uuid, stance: "guard" });
}

// Passive:
async function petPassive() {
  const t = canvas.tokens.controlled?.[0];
  if (!t?.actor) return ui.notifications.warn("Select your pet token.");
  await game.eq5e.api.setPetStance({ petUuid: t.actor.uuid, stance: "passive" });
}
