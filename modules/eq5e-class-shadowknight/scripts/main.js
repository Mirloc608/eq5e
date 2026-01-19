import { registerShadowknightNecroticWidget } from './necrotic-widget.js';
const MOD = "eq5e-class-shadowknight";

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _modulePath(rel) {
  const mod = game.modules?.get(MOD);
  if (!mod) throw new Error(`Module not found: ${MOD}`);
  return `${mod.path}/${rel}`;
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

async function upsertByKey(pack, docs, keyFn) {
  const existing = await pack.getDocuments();
  const byKey = new Map();
  for (const d of existing) {
    const k = keyFn(d);
    if (k) byKey.set(k, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of (docs ?? [])) {
    const k = keyFn(it);
    if (!k) continue;
    const doc = byKey.get(k);
    const h = _stableHash(it);

    if (!doc) {
      it.flags = it.flags ?? {}; it.flags.eq5e = it.flags.eq5e ?? {};
      it.flags.eq5e.derivedHash = h;
      toCreate.push(it);
    } else {
      const old = doc?.flags?.eq5e?.derivedHash;
      if (old !== h) {
        const upd = foundry.utils.duplicate(it);
        upd._id = doc.id;
        upd.flags = upd.flags ?? {}; upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = h;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function generateShadowknightSummonPack() {
  const summons = await _fetchJSON(_modulePath("data/sk-summons.json"));
  const pack = await ensureWorldPack({ key: "world.eq5e-sk-summons", label: "EQ5e Shadowknight Summons", type: "Item" });
  await upsertByKey(pack, summons, d => d?.flags?.eq5e?.spell?.spellId);
  ui.notifications?.info("EQ5E: Shadowknight summon pack generated/updated.");
}

Hooks.once("init", () => {
  registerShadowknightNecroticWidget();
  game.settings.register("eq5e", "shadowknightOnStartup", {
    name: "Generate Shadowknight packs on startup",
    hint: "Creates/updates Shadowknight summon pack.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    if (game.settings.get("eq5e", "shadowknightOnStartup")) await generateShadowknightSummonPack();
  } catch (e) {
    console.error("[EQ5E] Shadowknight startup failed", e);
  }
});
