export * from "../aa/aa-reward-log-integration.js";
export * from "../aa/aa-rewards-normalize.js";
export * from "../aa/aa-rewards-editor.js";

// Adapter export expected by aa-core-init.js
export function registerRewardAutomation() {
  console.log('[EQ5E][AA] registerRewardAutomation adapter loaded');
  // No-op placeholder. The reward log + award application is driven elsewhere in the AA module.
}
