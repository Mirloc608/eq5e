const NS = "eq5e";
const MODULE_ID = NS; // merged into system

export function registerAACatalogSettings() {
// Era gating + caps (core)
game.settings.register(NS, "currentEra", { name: "EQ5e Current Era", hint: "Controls which AA nodes are available (requires.era) and AA caps by era.", scope: "world", config: true, type: Number, default: 1 });
game.settings.register(NS, "aaCapsByEraJson", { name: "AA Caps By Era (JSON)", hint: "JSON mapping era->AA cap. Example: {\"1\":50,\"2\":150}", scope: "world", config: true, type: String, default: "{\"1\": 50}", multiline: true });
game.settings.register(NS, "maxLevelByEraJson", { name: "Level Caps By Era (JSON)", hint: "JSON mapping era->level cap. Example: {\"1\":10,\"2\":20}", scope: "world", config: true, type: String, default: "{\"1\": 10}", multiline: true });

  game.settings.register(MODULE_ID, "aaCatalogJson", {
    name: "AA Catalog JSON",
    hint: "Optional. Paste a full AA catalog JSON to override the bundled catalog. Leave blank to use the default.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    multiline: true
  });
}

export async function loadAACatalog() {
  const override = game.settings.get(MODULE_ID, "aaCatalogJson") || "";
  if (override.trim()) {
    try {
      const parsed = JSON.parse(override);
      return validateCatalog(parsed);
    } catch (err) {
      ui.notifications.error(`[EQ5e] AA Catalog JSON invalid: ${err?.message ?? err}`);
    }
  }

  const sysId = game.system?.id || "eq5e";
  const url = `systems/${sysId}/modules/aa/data/aa-catalog.json`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fetch failed ${res.status} for ${url}${body ? " (non-JSON response)" : ""}`);
  }
  const ct = res.headers?.get?.("content-type") || "";
  if (ct && !ct.includes("json")) {
    // Foundry sometimes serves HTML for 404s; avoid JSON.parse crash
    const body = await res.text().catch(() => "");
    throw new Error(`Expected JSON but got ${ct || "unknown content-type"} for ${url}`);
  }
  const parsed = await res.json();
  return validateCatalog(parsed);
}

function validateCatalog(cat) {
  const out = foundry.utils.deepClone(cat ?? {});
  out.version ??= 1;
  out.meta ??= {};

  out.categories = Array.isArray(out.categories) ? out.categories : [];
  for (const c of out.categories) {
    c.id ??= foundry.utils.randomID(8);
    c.label ??= c.id;
    c.children = Array.isArray(c.children) ? c.children : [];
    for (const aa of c.children) normalizeAA(aa, c);
  }

  const byId = {};
  for (const c of out.categories) for (const aa of c.children) byId[aa.id] = aa;
  out._byId = byId;

  return out;
}

function normalizeAA(aa, cat) {
  aa.id ??= foundry.utils.randomID(12);
  aa.name ??= aa.id;
  aa.category ??= cat?.id ?? "misc";
  aa.type ??= "passive";
  aa.maxRank = Math.max(1, Math.floor(Number(aa.maxRank ?? 1)));
  aa.description ??= "";
  aa.tags = Array.isArray(aa.tags) ? aa.tags : [];
  aa.prereq = Array.isArray(aa.prereq) ? aa.prereq : [];
  aa.requires ??= {};
  aa.requires.level = Math.max(1, Math.floor(Number(aa.requires.level ?? 1)));

  aa.cost ??= { type: "flat", value: 1 };
  if (aa.cost.type === "flat") aa.cost.value = Math.max(0, Math.floor(Number(aa.cost.value ?? 0)));
  if (aa.cost.type === "byRank") aa.cost.values = Array.isArray(aa.cost.values) ? aa.cost.values.map(v => Math.max(0, Math.floor(Number(v ?? 0)))) : [];
}
