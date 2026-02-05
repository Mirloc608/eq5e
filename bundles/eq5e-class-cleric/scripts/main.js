const MODULE_ID = "eq5e-class-cleric";

/* ------------------------------ PACK LOADER ------------------------------ */

async function ensureWorldPack({ pack, label, type="Item" }) {
  const exists = game.packs?.get(pack);
  if (exists) return exists;
  const meta = {
    name: pack.split(".")[1],
    label,
    type,
    system: "eq5e",
    package: "world",
    path: `packs/${pack.split(".")[1]}.db`,
  };
  return await CompendiumCollection.createCompendium(meta);
}

async function fetchJSON(rel) {
  const url = `systems/eq5e/bundles/${MODULE_ID}/${rel}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  return res.json();
}

function stableHash(obj) {
  const s = JSON.stringify(obj);
  let h = 2166136261;
  for (let i=0;i<s.length;i++) { h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h>>>0).toString(16);
}

async function upsertJSONToPack({ rel, pack, label, key }) {
  const docs = await fetchJSON(rel);
  const p = await ensureWorldPack({ pack, label, type: "Item" });
  await p.getIndex();
  const existingDocs = await p.getDocuments();
  const byKey = new Map();
  for (const d of existingDocs) {
    try { byKey.set(String(key(d)), d); } catch {}
  }
  const toCreate = [];
  const toUpdate = [];
  for (const raw of docs) {
    const d = foundry.utils.duplicate(raw);
    d.flags = d.flags ?? {};
    d.flags.eq5e = d.flags.eq5e ?? {};
    d.flags.eq5e.derivedHash = stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(d) : d));
    const k = String(key(d));
    const ex = byKey.get(k);
    if (!ex) toCreate.push(d);
    else if (ex.flags?.eq5e?.derivedHash !== d.flags.eq5e.derivedHash) {
      d._id = ex.id;
      toUpdate.push(d);
    }
  }
  if (toCreate.length) await p.documentClass.createDocuments(toCreate, { pack: p.collection });
  if (toUpdate.length) await p.documentClass.updateDocuments(toUpdate, { pack: p.collection });
  return { created: toCreate.length, updated: toUpdate.length };
}

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    await upsertJSONToPack({ rel:"data/spells.json", pack:"world.eq5e-cleric-spells", label:"EQ5e Cleric Spells", key:d=>d?.flags?.eq5e?.spell?.spellId ?? d?.name });
    await upsertJSONToPack({ rel:"data/aas.json", pack:"world.eq5e-cleric-aas", label:"EQ5e Cleric AAs", key:d=>d?.flags?.eq5e?.aa?.aaId ?? d?.name });
    await upsertJSONToPack({ rel:"data/abilities.json", pack:"world.eq5e-cleric-abilities", label:"EQ5e Cleric Abilities", key:d=>d?.flags?.eq5e?.ability?.abilityId ?? d?.name });
    console.log(`[EQ5E] ${MODULE_ID} loaded Cleric packs.`);
  } catch (e) { console.error(`[EQ5E] ${MODULE_ID} pack load failed`, e); }
});

/* ----------------------------- CLERIC WIDGET ----------------------------- */

function _isClericActor(actor) {
  const cid = String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
  if (cid === "cleric") return true;
  return actor.items?.some(i => !!i?.flags?.eq5e?.spell?.spellId?.startsWith?.("clr.")) ?? false;
}

async function _setupCleric(actor) {
  const packs = [
    ["world.eq5e-cleric-spells","spell"],
    ["world.eq5e-cleric-aas","feat"],
    ["world.eq5e-cleric-abilities","feat"],
  ];
  let added = 0;

  for (const [pid] of packs) {
    const pack = game.packs?.get(pid);
    if (!pack) continue;
    const docs = await pack.getDocuments();
    const objs = docs.map(d => d.toObject());
    // Key by spellId/aaId/abilityId when present
    const ownedKeys = new Set(actor.items.map(i =>
      i.flags?.eq5e?.spell?.spellId ??
      i.flags?.eq5e?.aa?.aaId ??
      i.flags?.eq5e?.ability?.abilityId ??
      i.name
    ));
    const filtered = objs.filter(o => {
      const k = o.flags?.eq5e?.spell?.spellId ?? o.flags?.eq5e?.aa?.aaId ?? o.flags?.eq5e?.ability?.abilityId ?? o.name;
      return !ownedKeys.has(k);
    });
    if (filtered.length) {
      await actor.createEmbeddedDocuments("Item", filtered);
      added += filtered.length;
    }
  }

  ui.notifications?.info(`Cleric setup complete: added ${added} items to ${actor.name}.`);
}

function _renderClericWidget(app, html) {
  const actor = app?.actor;
  if (!actor) return;
  if (!actor.isOwner) return;
  if (!_isClericActor(actor)) return;
  if (html.find(".eq5e-cleric-widget").length) return;

  const healPct = Number(actor.flags?.eq5e?.cleric?.healPct ?? 0);
  const healCrit = Number(actor.flags?.eq5e?.cleric?.healCritPct ?? 0);
  const chThreat = clamp(2.5 + Number(actor.flags?.eq5e?.cleric?.completeHealThreatMult ?? 0), 0, 10);

  const widget = $(`
    <section class="eq5e-cleric-widget" style="border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:8px; margin:6px 0;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0; font-size:14px;">Cleric</h3>
        <div style="display:flex; gap:6px;">
          <button type="button" class="eq5e-cleric-setup" title="Import Cleric spells/AAs/abilities"><i class="fa-solid fa-wand-magic-sparkles"></i> Setup</button>
          <button type="button" class="eq5e-cleric-refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
        </div>
      </header>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8;">Healing</div>
          <div style="font-size:12px;">Bonus: <b>${Math.round(healPct*100)}%</b></div>
          <div style="font-size:12px;">Crit: <b>${Math.round(healCrit*100)}%</b></div>
        </div>
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8;">Complete Heal</div>
          <div style="font-size:12px;">Threat Mult: <b>${chThreat.toFixed(2)}×</b></div>
        </div>
      </div>

      <div style="font-size:12px; opacity:.7; margin-top:6px;">
        Complete Heal is a pure spell: big heal, big threat. AAs can reduce threat multiplier.
      </div>
    </section>
  `);

  const form = html.find("form");
  if (form.length) form.prepend(widget);
  else html.prepend(widget);

  widget.find(".eq5e-cleric-refresh").on("click", async ()=>{ try { await app.render(false);} catch{} });
  widget.find(".eq5e-cleric-setup").on("click", async ()=>{ await _setupCleric(actor); try { await app.render(false);} catch{} });
}

Hooks.on("renderActorSheet", (app, html) => {
  try { _renderClericWidget(app, html); } catch (e) { console.error("[EQ5E] Cleric widget error", e); }
});
