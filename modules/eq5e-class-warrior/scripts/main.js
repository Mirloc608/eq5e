// EQ5e Class: Warrior (class) - EQ5e content module
// This module is intentionally a template scaffold.
// Put your Items/Actors/Spells in compendiums or JSON and load them here later.

const MODULE_ID = "eq5e-class-warrior";

Hooks.once("init", () => {
  console.log(`[EQ5E] eq5e-class-warrior init`);
});

Hooks.once("ready", async () => {
  console.log(`[EQ5E] eq5e-class-warrior ready`);

  // Example: register default flags/schema helpers for this module.
  // You can remove or expand this as needed.
  game.eq5e = game.eq5e || {};
  game.eq5e.modules = game.eq5e.modules || {};
  game.eq5e.modules[MODULE_ID] = {
    version: "0.5.0-alpha",
    kind: "class",
    title: "EQ5e Class: Warrior"
  };
});
