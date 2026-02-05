
Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  ui.notifications.info("EQ5E Mounts, Tack, and Barding (Hybrid C) ready.");
});
