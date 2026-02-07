/**
 * EQ5e Macro: Toggle Mount Token FX (Sequencer)
 * - Toggles actor flag flags.eq5e.disableMountFx
 * - Refreshes FX on active tokens
 */
(async () => {
  const actor = canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
  if (!actor) return ui.notifications?.warn("Select a token (or set a character) first.");

  const cur = actor.flags?.eq5e?.disableMountFx === true;
  await actor.setFlag("eq5e", "disableMountFx", !cur);

  const state = (!cur) ? "DISABLED" : "ENABLED";
  ui.notifications?.info(`EQ5E Mount Token FX: ${state} for ${actor.name}`);

  if (game.eq5e?.mountFx?.refreshActorMountFx) {
    await game.eq5e.mountFx.refreshActorMountFx(actor, { reason: "macroToggle" });
  }
})();
