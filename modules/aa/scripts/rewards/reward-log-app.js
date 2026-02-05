import { RewardLogApp } from "../aa/aa-reward-log-app.js";

/**
 * Registers a Scene Controls button to open the AA Reward Log.
 * Foundry v13 passes an Array of controls; some wrappers may pass an object. We normalize.
 */
export function registerRewardsUI() {
  console.log("[EQ5E][AA] registerRewardsUI");
  Hooks.on("getSceneControlButtons", (controls) => {
    try {
      const arr = Array.isArray(controls) ? controls : (Array.isArray(controls?.controls) ? controls.controls : null);
      if (!arr) return;

      // Use the standard "token" controls group when possible.
      const token = arr.find?.(c => c?.name === "token") ?? arr[0];
      if (!token) return;
      token.tools = token.tools || [];
      if (token.tools.some(t => t?.name === "eq5eRewardLog")) return;

      token.tools.push({
        name: "eq5eRewardLog",
        title: "EQ5e Reward Log",
        icon: "fa-solid fa-list-check",
        visible: game.user?.isGM,
        onClick: () => new RewardLogApp().render(true),
        button: true
      });
    } catch (e) {
      console.warn("[EQ5E][AA] getSceneControlButtons hook failed", e);
    }
  });
}
