const MODULE_ID = "eq5e-class-warrior";

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
    if (toUpdate.length) await p.documentClass.updateDocuments(toUpdate, { pack: p.collection, recursive: false });
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
  if (toUpdate.length) await p.documentClass.updateDocuments(toUpdate, { pack: p.collection, recursive: false });
  return { created: toCreate.length, updated: toUpdate.length };
}

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    await upsertJSONToPack({ rel:"data/disciplines.json", pack:"world.eq5e-warrior-disciplines", label:"EQ5e Warrior Disciplines", key:d=>d?.flags?.eq5e?.discipline?.disciplineId ?? d?.name });
    await upsertJSONToPack({ rel:"data/aas.json", pack:"world.eq5e-warrior-aas", label:"EQ5e Warrior AAs", key:d=>d?.flags?.eq5e?.aa?.aaId ?? d?.name });
    await upsertJSONToPack({ rel:"data/abilities.json", pack:"world.eq5e-warrior-abilities", label:"EQ5e Warrior Abilities", key:d=>d?.flags?.eq5e?.ability?.abilityId ?? d?.name });
    console.log(`[EQ5E] ${MODULE_ID} loaded Warrior packs.`);
  } catch (e) { console.error(`[EQ5E] ${MODULE_ID} pack load failed`, e); }
});

/* ----------------------------- WARRIOR WIDGET ----------------------------- */

function _isWarriorActor(actor) {
  const cid = String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
  if (cid === "warrior") return true;
  return actor.items?.some(i => String(i?.flags?.eq5e?.discipline?.disciplineId ?? "").startsWith("war.")) ?? false;
}

function _getAARankById(actor, aaId) {
  if (!actor || !aaId) return 0;
  const id = String(aaId);
  for (const it of actor.items ?? []) {
    const aa = it?.flags?.eq5e?.aa;
    if (!aa) continue;
    if (String(aa.aaId ?? "") !== id) continue;
    const r = Number(aa.rank ?? aa.currentRank ?? aa.purchasedRank ?? aa.value ?? 0);
    if (Number.isFinite(r) && r > 0) return r;
  }
  return 0;
}

function _computeWarriorSummary(actor) {
  const threatPct = Number(actor.flags?.eq5e?.warrior?.threatPct ?? 0);
  const avoidBonus = Number(actor.flags?.eq5e?.warrior?.avoidanceBonus ?? 0);
  const tauntBonus = Number(actor.flags?.eq5e?.warrior?.tauntBonus ?? 0);

  const hateRank = _getAARankById(actor, "war.aa.hate-adept");
  const agiRank  = _getAARankById(actor, "war.aa.combat-agility");
  const etRank   = _getAARankById(actor, "war.aa.enhanced-taunt");

  const threat = threatPct + (0.05 * Math.max(0, hateRank));
  const avoid  = avoidBonus + (0.02 * Math.max(0, agiRank));
  const taunt  = tauntBonus + (5 * Math.max(0, etRank));

  return {
    threatPct: threat,
    avoidanceBonus: avoid,
    tauntBonus: taunt,
    aaHint: `AA: Hate Adept r${hateRank||0} · Combat Agility r${agiRank||0} · Enhanced Taunt r${etRank||0}`
  };
}

async function _setupWarrior(actor) {
  const packs = [
    "world.eq5e-warrior-disciplines",
    "world.eq5e-warrior-aas",
    "world.eq5e-warrior-abilities",
  ];
  let added = 0;

  for (const pid of packs) {
    const pack = game.packs?.get(pid);
    if (!pack) continue;
    const docs = await pack.getDocuments();
    const objs = docs.map(d => d.toObject());
    const ownedKeys = new Set(actor.items.map(i =>
      i.flags?.eq5e?.discipline?.disciplineId ??
      i.flags?.eq5e?.aa?.aaId ??
      i.flags?.eq5e?.ability?.abilityId ??
      i.name
    ));
    const filtered = objs.filter(o => {
      const k = o.flags?.eq5e?.discipline?.disciplineId ??
                o.flags?.eq5e?.aa?.aaId ??
                o.flags?.eq5e?.ability?.abilityId ??
                o.name;
      return !ownedKeys.has(k);
    });
    if (filtered.length) {
      await actor.createEmbeddedDocuments("Item", filtered);
      added += filtered.length;
    }
  }

  ui.notifications?.info(`Warrior setup complete: added ${added} items to ${actor.name}.`);
}

function _renderWarriorWidget(app, html) {
  const actor = app?.actor;
  if (!actor) return;
  if (!actor.isOwner) return;
  if (!_isWarriorActor(actor)) return;
  if (html.find(".eq5e-warrior-widget").length) return;

  const summary = _computeWarriorSummary(actor);
  const aaHint = summary.aaHint || "";

  const widget = $(`
    <section class="eq5e-warrior-widget" style="border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:8px; margin:6px 0;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0; font-size:14px;">Warrior</h3>
        <div style="display:flex; gap:6px;">
          <button type="button" class="eq5e-warrior-setup" title="Import Warrior disciplines/AAs/abilities"><i class="fa-solid fa-wand-magic-sparkles"></i> Setup</button>
          <button type="button" class="eq5e-warrior-refresh" title="Refresh"><i class="fa-solid fa-rotate"></i></button>
        </div>
      </header>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8;">Bonuses</div>
          <div style="font-size:12px;">Threat: <b>${Math.round(summary.threatPct*100)}%</b></div>
          <div style="font-size:12px;">Avoidance: <b>${Math.round(summary.avoidanceBonus*100)}%</b></div>
          <div style="font-size:12px;">Taunt Bonus: <b>${summary.tauntBonus}</b></div>
          <div style="font-size:11px; opacity:.75;">${aaHint}</div>
        </div>

        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8;">Notes</div>
          <div style="font-size:12px; opacity:.85;">Disciplines drive your mitigation spikes.</div>
          <div style="font-size:12px; opacity:.85;">Taunt tools are instant abilities (no mana).</div>
        </div>
      </div>
    </section>
  `);

  const form = html.find("form");
  if (form.length) form.prepend(widget);
  else html.prepend(widget);

  widget.find(".eq5e-warrior-refresh").on("click", async ()=>{ try { await app.render(false);} catch{} });
  widget.find(".eq5e-warrior-setup").on("click", async ()=>{ await _setupWarrior(actor); try { await app.render(false);} catch{} });
}

Hooks.on("renderActorSheet", (app, html) => {
  try { _renderWarriorWidget(app, html); } catch (e) { console.error("[EQ5E] Warrior widget error", e); }
});
