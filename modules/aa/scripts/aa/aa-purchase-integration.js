import { EQ5EAAPurchaseApp } from "./aa-purchase-app.js";

export function registerAAPurchaseHeaderButton() {
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    const actor = sheet?.actor;
    if (!actor) return;
    if (!["character", "npc"].includes(actor.type)) return;

    buttons.unshift({
      label: "AAs",
      class: "eq5e-aa-open",
      icon: "fa-solid fa-diagram-project",
      onclick: () => new EQ5EAAPurchaseApp(actor).render(true)
    });
  });
}
