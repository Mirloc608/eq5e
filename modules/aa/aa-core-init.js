/**
 * EQ5e AA Framework (core merge wrapper)
 *
 * Import and call registerAAFrameworkCore() from your EQ5e system init.
 * Paths assume the folder lives at: systems/eq5e/modules/aa/
 */
import { registerAACatalogSettings } from "./scripts/aa/aa-catalog.js";
import { registerRewardsUI } from "./scripts/rewards/reward-log-app.js";
import { registerRewardAutomation } from "./scripts/rewards/reward-automation.js";
import { registerAAPurchaseHeaderButton } from "./scripts/aa/aa-purchase-integration.js";
import { injectEq5eAccentCardStyles } from "./scripts/shared/accent-card.js";

export function registerAAFrameworkCore() {
  // Stable API surface
  game.eq5e = game.eq5e || {};
  game.eq5e.aa = game.eq5e.aa || {};

  // Register settings + UIs + hooks
  registerAACatalogSettings();
  registerRewardsUI();
  registerRewardAutomation();
  registerAAPurchaseHeaderButton();
  injectEq5eAccentCardStyles();
}
