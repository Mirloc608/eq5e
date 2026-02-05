// EQ5e Shadowknight deterministic derive+scale loader
// - Reads Necromancer spell definitions from that module's data/necro-spells.json
// - Reads SK mapping from this module's data/derived-from-necro.json
// - Generates scaled SK spells into a WORLD compendium (default: world.eq5e-sk-derived-spells)
// Deterministic: same inputs => same outputs (no randomness, stable scaling).

const SK_MODULE = "eq5e-class-shadowknight";
const NECRO_MODULE = "eq5e-class-necromancer";

async function _fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${path}`);
  return res.json();
}

function _modulePath(moduleId, relPath) {
  return `modules/${moduleId}/${relPath}`;
}

function _stableHash(obj) {
  // Deterministic hash for "already derived" checks
  const s = JSON.stringify(obj, Object.keys(obj).sort());
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function _scaleFormulaSimple(formula, mult) {
  // Supports simple additive expressions with dice and flat numbers:
  //   "3d6+6" => "2d6+4" (mult 0.6)
  //   "2d8+@mod" => scales dice, leaves @mod untouched (becomes "1d8+@mod")
  //   "1d6+1d4+2" => each dice term scales independently
  //
  // If we can't parse safely, we wrap with a deterministic multiplier: "floor((<formula>)*mult)"
  // but Foundry Roll doesn't support arbitrary JS inside; so fallback = keep formula unchanged.
  const f = String(formula ?? "").replace(/\s+/g, "");
  if (!f) return f;

  // Split into tokens with +/-
  const tokens = [];
  let cur = "";
  let sign = "+";
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if ((ch === "+" || ch === "-") && i > 0) {
      tokens.push({ sign, term: cur });
      sign = ch;
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push({ sign, term: cur });

  const scaled = tokens.map(t => {
    const term = t.term;

    // Dice term: NdX
    const mDice = term.match(/^(\d+)d(\d+)$/i);
    if (mDice) {
      const n = Number(mDice[1]);
      const faces = Number(mDice[2]);
      const sn = Math.max(1, Math.round(n * mult));
      return `${t.sign}${sn}d${faces}`;
    }

    // Flat number
    const mNum = term.match(/^(\d+)$/);
    if (mNum) {
      const n = Number(mNum[1]);
      const sn = Math.max(0, Math.round(n * mult));
      return `${t.sign}${sn}`;
    }

    // Dice plus mod etc: handle "NdX@something" not supported; leave as-is
    // Variables like @mod: leave as-is
    if (term.includes("@")) return `${t.sign}${term}`;

    // Complex (keep as-is deterministically)
    return `${t.sign}${term}`;
  }).join("");

  // Remove leading +
  return scaled.startsWith("+") ? scaled.slice(1) : scaled;
}

function _deepClone(obj) { return foundry.utils.duplicate(obj); }

function _deriveSpell(source, map) {
  const item = _deepClone(source);

  // Name and identity
  const srcId = source?.flags?.eq5e?.spell?.spellId ?? map.sourceSpellId;
  const prefix = map.namePrefix ?? "SK ";
  item.name = `${prefix}${source.name}`;
  item.flags = item.flags ?? {};
  item.flags.eq5e = item.flags.eq5e ?? {};
  item.flags.eq5e.derivedFrom = { sourceSpellId: srcId, potencyMult: map.potencyMult };

  // Spell flag exists
  const sp = item.flags.eq5e.spell ?? {};
  sp.spellId = `sk.${srcId}`; // deterministic derived spellId
  sp.priority = Math.max(0, Math.floor(Number(sp.priority ?? 0) * 0.8));
  sp.manaCost = Math.max(0, Math.floor(Number(sp.manaCost ?? 0) * 0.8)); // SK version slightly cheaper by default
  item.flags.eq5e.spell = sp;

  // Scale damage formulas (simple deterministic scaling)
  const mult = Number(map.potencyMult ?? 1);
  const damage = Array.isArray(sp.damage) ? sp.damage : [];
  for (const d of damage) {
    d.formula = _scaleFormulaSimple(d.formula, mult);
  }
  sp.damage = damage;

  // Optional: scale durations for conditions with rounds
  if (Array.isArray(sp.conditions)) {
    for (const c of sp.conditions) {
      if (c?.duration?.rounds != null) {
        const r = Number(c.duration.rounds);
        if (Number.isFinite(r) && r > 0) {
          c.duration.rounds = Math.max(1, Math.round(r * mult));
        }
      }
    }
  }

  return item;
}

async function ensureWorldCompendium({ key, label }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;

  // Create a world pack (GM only)
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  const pack = await CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type: "Item",
    package: "world"
  });
  return pack;
}

async function upsertIntoCompendium(pack, items) {
  // Deterministic: use derived spellId as "lookup key" via flags.
  const existing = await pack.getDocuments();
  const bySpellId = new Map();
  for (const d of existing) {
    const sid = d.getFlag("eq5e", "spell")?.spellId ?? d.flags?.eq5e?.spell?.spellId;
    if (sid) bySpellId.set(sid, d);
  }

  const toCreate = [];
  const toUpdate = [];

  for (const it of items) {
    const sid = it?.flags?.eq5e?.spell?.spellId;
    if (!sid) continue;

    const doc = bySpellId.get(sid);
    if (!doc) {
      toCreate.push(it);
    } else {
      // update only if hash differs
      const newHash = _stableHash(it);
      const oldHash = doc.getFlag("eq5e", "derivedHash");
      if (oldHash !== newHash) {
        const upd = _deepClone(it);
        upd._id = doc.id;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) {
    const created = await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
    // stamp hash
    for (const doc of created) {
      const h = _stableHash(doc.toObject());
      await doc.setFlag("eq5e", "derivedHash", h);
    }
  }

  for (const upd of toUpdate) {
    const doc = existing.find(d => d.id === upd._id);
    const h = _stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(upd) : upd));
    upd.flags = upd.flags ?? {};
    upd.flags.eq5e = upd.flags.eq5e ?? {};
    upd.flags.eq5e.derivedHash = h;
    await pack.documentClass.updateDocuments([upd], { pack: pack.collection });
  }

  return { created: toCreate.length, updated: toUpdate.length };
}

export async function deriveShadowknightSpellsFromNecro({ key = "world.eq5e-sk-derived-spells", label = "EQ5e Shadowknight Spells (Derived)" } = {}) {
  const necroMod = game.modules?.get(NECRO_MODULE);
  const skMod = game.modules?.get(SK_MODULE);
  if (!necroMod?.active) {
    ui.notifications?.warn("EQ5E: Necromancer module not active; SK derive skipped.");
    return { ok: false, reason: "necro-module-inactive" };
  }
  if (!skMod?.active) return { ok: false, reason: "sk-module-inactive" };

  const necroSpellsPath = _modulePath(NECRO_MODULE, "data/necro-spells.json");
  const skMapPath = _modulePath(SK_MODULE, "data/derived-from-necro.json");

  const [sources, mapping] = await Promise.all([_fetchJSON(necroSpellsPath), _fetchJSON(skMapPath)]);

  const byId = new Map();
  for (const s of (sources ?? [])) {
    const sid = s?.flags?.eq5e?.spell?.spellId;
    if (sid) byId.set(sid, s);
  }

  const derived = [];
  for (const m of (mapping ?? [])) {
    const src = byId.get(m.sourceSpellId);
    if (!src) continue;
    derived.push(_deriveSpell(src, m));
  }

  const pack = await ensureWorldCompendium({ key, label });
  const res = await upsertIntoCompendium(pack, derived);

  ui.notifications?.info(`EQ5E: Derived SK spells: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, ...res, pack: pack.collection };
}


// --------------------- Shadowknight necrotic pet generator ---------------------

async function ensureWorldCompendiumAny({ key, label, type }) {
  const existing = game.packs?.get(key);
  if (existing) return existing;
  if (!game.user.isGM) throw new Error("Only GM can create world compendiums.");
  const pack = await CompendiumCollection.createCompendium({
    label,
    name: key.split(".")[1],
    type,
    package: "world"
  });
  return pack;
}

async function upsertActorsIntoCompendium(pack, actors) {
  const existing = await pack.getDocuments();
  const byName = new Map(existing.map(a => [a.name, a]));

  const toCreate = [];
  const toUpdate = [];

  for (const a of actors) {
    const name = a?.name;
    if (!name) continue;
    const doc = byName.get(name);
    if (!doc) toCreate.push(a);
    else {
      // update if content differs (simple JSON compare via derivedHash flag)
      const s = JSON.stringify(a);
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      const newHash = (h >>> 0).toString(16);
      const oldHash = doc.getFlag("eq5e", "derivedHash");
      if (oldHash !== newHash) {
        const upd = foundry.utils.duplicate(a);
        upd._id = doc.id;
        upd.flags = upd.flags ?? {};
        upd.flags.eq5e = upd.flags.eq5e ?? {};
        upd.flags.eq5e.derivedHash = newHash;
        toUpdate.push(upd);
      }
    }
  }

  if (toCreate.length) {
    const created = await pack.documentClass.createDocuments(toCreate, { pack: pack.collection });
    for (const doc of created) {
      const s = JSON.stringify(doc.toObject());
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      await doc.setFlag("eq5e", "derivedHash", (h >>> 0).toString(16));
    }
  }

  if (toUpdate.length) await pack.documentClass.updateDocuments(toUpdate, { pack: pack.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

export async function deriveShadowknightNecroticPets({ key = "world.eq5e-sk-necrotic-pets", label = "EQ5e SK Necrotic Pets (World)" } = {}) {
  const skPetMod = game.modules?.get("eq5e-pet-shadowknight-necrotic");
  if (!skPetMod?.active) {
    ui.notifications?.warn("EQ5E: SK necrotic pet module not active; pet derive skipped.");
    return { ok: false, reason: "sk-pet-module-inactive" };
  }
  const petsPath = _modulePath("eq5e-pet-shadowknight-necrotic", "data/sk-necrotic-pets.json");
  const pets = await _fetchJSON(petsPath);

  // Ensure output world pack (Actor)
  const pack = await ensureWorldCompendiumAny({ key, label, type: "Actor" });

  // Stamp deterministic marker
  const stamped = (pets ?? []).map(a => {
    a.flags = a.flags ?? {};
    a.flags.eq5e = a.flags.eq5e ?? {};
    a.flags.eq5e.sourceModule = "eq5e-pet-shadowknight-necrotic";
    return a;
  });

  const res = await upsertActorsIntoCompendium(pack, stamped);
  ui.notifications?.info(`EQ5E: Derived SK necrotic pets: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, ...res, pack: pack.collection };
}

// Include SK-native summon spells into the derived spell pack (in addition to derived necro lines)
export async function upsertShadowknightSummonsIntoDerivedSpells({ spellPackKey = "world.eq5e-sk-derived-spells" } = {}) {
  const skSummonPath = _modulePath(SK_MODULE, "data/sk-summons.json");
  const spells = await _fetchJSON(skSummonPath);
  const pack = await ensureWorldCompendium({ key: spellPackKey, label: "EQ5e Shadowknight Spells (Derived)" });
  const res = await upsertIntoCompendium(pack, spells ?? []);
  ui.notifications?.info(`EQ5E: SK summon spells: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, ...res, pack: pack.collection };
}


// --------------------- SK necrotic pet abilities generator ---------------------

export async function deriveShadowknightNecroticPetAbilities({ key = "world.eq5e-sk-necrotic-pet-abilities", label = "EQ5e SK Necrotic Pet Abilities (World)" } = {}) {
  const skPetMod = game.modules?.get("eq5e-pet-shadowknight-necrotic");
  if (!skPetMod?.active) {
    ui.notifications?.warn("EQ5E: SK necrotic pet module not active; abilities derive skipped.");
    return { ok: false, reason: "sk-pet-module-inactive" };
  }
  const abilitiesPath = _modulePath("eq5e-pet-shadowknight-necrotic", "data/sk-necrotic-pet-abilities.json");
  const abilities = await _fetchJSON(abilitiesPath);

  const pack = await ensureWorldCompendiumAny({ key, label, type: "Item" });
  const res = await upsertIntoCompendium(pack, abilities ?? []);
  ui.notifications?.info(`EQ5E: SK necrotic pet abilities: created ${res.created}, updated ${res.updated}.`);
  return { ok: true, ...res, pack: pack.collection };
}
