// EQ5E_ITEMS_MOUNTS_BUNDLE_V1
// Bundled under: systems/eq5e/bundles/eq5e-items-mounts/
//
// Creates/updates world compendiums for mounts through Planes of Power.
// Deterministic upsert key:
//  - Mounts: flags.eq5e.mount.mountId
//  - Mount Gear: flags.eq5e.mountGear.gearId
//
// Notes:
// - Item type "mount"/"mountGear" may not exist in system.json yet.
//   This loader will safely fall back to "equipment" (or "consumable") at runtime.

const MOD = "eq5e-items-mounts";

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _modulePath(moduleId, rel) {
  // If running as a separate module, use its path.
  try {
    const mod = game.modules?.get(moduleId);
    if (mod?.active && mod?.path) return `${mod.path}/${rel}`;
  } catch (e) {}
  // Bundled into the system: fall back to system bundle folder.
  return `systems/eq5e/bundles/${moduleId}/${rel}`;
}

function _stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

async function ensureWorldPack({ key, label, type="Item" }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  return CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type,
    package: "world"
  });
}

function _supportedItemType(preferred) {
  const types = game.system?.documentTypes?.Item ? Object.keys(game.system.documentTypes.Item) : [];
  if (types.includes(preferred)) return preferred;
  if (types.includes("equipment")) return "equipment";
  if (types.includes("consumable")) return "consumable";
  // last resort: first available type
  return types[0] ?? "consumable";
}

function _normalizeItem(it) {
  const data = foundry.utils.duplicate(it);
  // Ensure flags exist
  data.flags = data.flags ?? {};
  data.flags.eq5e = data.flags.eq5e ?? {};
  // Derived hash for idempotent upsert tracking
  data.flags.eq5e.derivedHash = _stableHash(data);

  // Normalize item type for current system.json
  const preferred = (data.type === "mountGear") ? "mountGear" : (data.type === "mount" ? "mount" : data.type);
  data.type = _supportedItemType(preferred);

  // Preserve original semantic type for sheet logic
  data.flags.eq5e.semanticType = preferred;

  return data;
}

async function upsertByKey(pack, items, keyFn) {
  const existing = await pack.getDocuments();
  const byKey = new Map();
  for (const d of existing) {
    const k = keyFn(d);
    if (k) byKey.set(k, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const raw of (items ?? [])) {
    const it = _normalizeItem(raw);
    const k = keyFn(it);
    if (!k) continue;
    const doc = byKey.get(k);

    if (!doc) {
      toCreate.push(it);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      const cur = it?.flags?.eq5e?.derivedHash;
      if (old !== cur) {
        it._id = doc.id;
        toUpdate.push(it);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection, recursive: false });

  return { created: toCreate.length, updated: toUpdate.length };
}

function _mountKey(d) {
  return d?.flags?.eq5e?.mount?.mountId ?? null;
}
function _gearKey(d) {
  return d?.flags?.eq5e?.mountGear?.gearId ?? null;
}

export async function generateMountPacks() {
  const kunark = await _fetchJSON(_modulePath(MOD, "data/mounts_kunark.json"));
  const velious = await _fetchJSON(_modulePath(MOD, "data/mounts_velious.json"));
  const luclin = await _fetchJSON(_modulePath(MOD, "data/mounts_luclin.json"));
  const planes = await _fetchJSON(_modulePath(MOD, "data/mounts_planes.json"));
  const tack = await _fetchJSON(_modulePath(MOD, "data/mount_gear_tack.json"));
  const barding = await _fetchJSON(_modulePath(MOD, "data/mount_gear_barding.json"));

  const pkKunark = await ensureWorldPack({ key: "world.eq5e-mounts-kunark", label: "EQ5e Mounts (Kunark)" });
  const pkVelious = await ensureWorldPack({ key: "world.eq5e-mounts-velious", label: "EQ5e Mounts (Velious)" });
  const pkLuclin = await ensureWorldPack({ key: "world.eq5e-mounts-luclin", label: "EQ5e Mounts (Luclin)" });
  const pkPlanes = await ensureWorldPack({ key: "world.eq5e-mounts-planes", label: "EQ5e Mounts (Planes of Power)" });
  const pkGear = await ensureWorldPack({ key: "world.eq5e-mount-gear", label: "EQ5e Mount Gear (Tack & Barding)" });

  const r1 = await upsertByKey(pkKunark, kunark, _mountKey);
  const r2 = await upsertByKey(pkVelious, velious, _mountKey);
  const r3 = await upsertByKey(pkLuclin, luclin, _mountKey);
  const r4 = await upsertByKey(pkPlanes, planes, _mountKey);
  const r5 = await upsertByKey(pkGear, [...tack, ...barding], _gearKey);

  ui.notifications?.info(`EQ5E: Mount packs updated (K:${r1.created}+${r1.updated}, V:${r2.created}+${r2.updated}, L:${r3.created}+${r3.updated}, PoP:${r4.created}+${r4.updated}, Gear:${r5.created}+${r5.updated})`);
  return { ok: true, kunark: r1, velious: r2, luclin: r3, planes: r4, gear: r5 };
}

Hooks.once("init", () => {
  game.settings.register("eq5e", "mountPacksOnStartup", {
    name: "Generate Mount packs on startup",
    hint: "Creates/updates world compendiums for mounts through Planes of Power.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  if (!game.settings.get("eq5e", "mountPacksOnStartup")) return;
  try {
    await generateMountPacks();
  } catch (e) {
    console.error("[EQ5E] Mount pack generation failed", e);
  }
});
