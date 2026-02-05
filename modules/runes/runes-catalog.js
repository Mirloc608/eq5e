const SETTINGS_NS = "eq5e";
function safeJsonParse(str, fallback) { try { return JSON.parse(str); } catch (e) { return fallback; } }

export function registerRuneInfusionSettings() {
  game.settings.register(SETTINGS_NS, "runeCatalogJson", { name: "Rune Catalog JSON", hint: "Optional JSON array of rune definitions. Leave blank to use the built-in starter list.", scope: "world", config: true, type: String, default: "", multiline: true });
  game.settings.register(SETTINGS_NS, "infusionCatalogJson", { name: "Infusion Catalog JSON", hint: "Optional JSON array of infusion definitions. Leave blank to use the built-in starter list.", scope: "world", config: true, type: String, default: "", multiline: true });
}

const BUILTIN_RUNES = [
  { id:"rune-echo-step", name:"Rune: Echo Step", slotType:"echo", tier:1, effect:"Once per short rest, reposition 10ft ignoring difficult terrain and minor planar hazards." },
  { id:"rune-warded-will", name:"Rune: Warded Will", slotType:"ward", tier:1, effect:"Minor resistance vs fear/charm while equipped." }
];

const BUILTIN_INFUSIONS = [
  { id:"inf-ashen-veil", name:"Infusion: Ashen Veil", plane:"shadow", tier:1,
    benefit:"Once per rest, ignore minor concealment/veil effects for 1 minute.",
    drawback:"After use, disadvantage on checks in bright light for 10 minutes.",
    corruption:{ track:"echo", value:1, max:6 }
  }
];

export function loadRuneCatalog() {
  const raw = game.settings.get(SETTINGS_NS, "runeCatalogJson") ?? "";
  const parsed = raw.trim() ? safeJsonParse(raw, null) : null;
  const arr = Array.isArray(parsed) ? parsed : BUILTIN_RUNES;
  return { runes: arr, byId: Object.fromEntries(arr.map(r => [r.id, r])) };
}
export function loadInfusionCatalog() {
  const raw = game.settings.get(SETTINGS_NS, "infusionCatalogJson") ?? "";
  const parsed = raw.trim() ? safeJsonParse(raw, null) : null;
  const arr = Array.isArray(parsed) ? parsed : BUILTIN_INFUSIONS;
  return { infusions: arr, byId: Object.fromEntries(arr.map(i => [i.id, i])) };
}
