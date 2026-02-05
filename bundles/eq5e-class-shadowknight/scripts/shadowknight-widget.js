/**
 * Shadowknight Widget (v13)
 * Stubbed to a safe minimal implementation during beta stabilization.
 * The full widget logic is implemented in later passes; this file must remain parse-safe.
 */

export function registerShadowknightWidget() {
  Hooks.once("ready", () => {
    // Hook point: external UI modules or later system passes can extend this.
    Hooks.callAll("eq5e.shadowknightWidgetReady");
  });
}

registerShadowknightWidget();
