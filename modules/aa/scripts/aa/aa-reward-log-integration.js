import { EQ5ERewardLogApp } from "./aa-reward-log-app.js";

export function registerRewardLogHeaderButton() {
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    const actor = sheet?.actor;
    if (!actor) return;
    if (!["character", "npc"].includes(actor.type)) return;

    buttons.unshift({
      label: "Rewards",
      class: "eq5e-reward-log-open",
      icon: "fa-solid fa-clock-rotate-left",
      onclick: () => new EQ5ERewardLogApp(actor).render(true)
    });
  });
}
