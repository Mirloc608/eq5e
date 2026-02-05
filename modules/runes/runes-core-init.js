import { registerRuneInfusionSettings } from "./runes-catalog.js";
import * as api from "./runes-api.js";
import * as catalog from "./runes-catalog.js";

export function registerRunesFrameworkCore() {
  registerRuneInfusionSettings();
  game.eq5e = game.eq5e || {};
  game.eq5e.runes = game.eq5e.runes || {};
  game.eq5e.runes.api = api;
  game.eq5e.runes.catalog = catalog;
}
