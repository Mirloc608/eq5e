// modules/eq5e-class-necromancer/scripts/necromancer.js

Hooks.once("ready", () => {
  if (!game.eq5e?.api) return;

  game.eq5e.api.registerModule("eq5e-class-necromancer", {
    type: "class",
    classId: "necromancer",
    title: "Necromancer"
  });

  console.log("[EQ5E] Necromancer module ready");
});
