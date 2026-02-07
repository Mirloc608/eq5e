const MODULE_ID = "eq5e-class-shaman";

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
  if (toUpdate.length) await p.documentClass.updateDocuments(toUpdate, { pack: p.collection, recursive: false });
  return { created: toCreate.length, updated: toUpdate.length };
}

const IMPORTS = [
  { rel: "data/spells.json", pack: "world.eq5e-shaman-spells", label: "EQ5e Shaman Spells", key: d => d?.flags?.eq5e?.spell?.spellId },
  { rel: "data/aas.json", pack: "world.eq5e-aa", label: "EQ5e Alternate Abilities", key: d => d?.flags?.eq5e?.aa?.aaId },
];

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;
  try {
    for (const imp of IMPORTS) await upsertJSONToPack(imp);
    console.log(`[EQ5E] ${MODULE_ID} loaded packs.`);
  } catch (e) { console.error(`[EQ5E] ${MODULE_ID} pack load failed`, e); }
});

/* ---------------------------- SHAMAN SHEET WIDGET --------------------------- */

function _isShamanActor(actor) {
  if (!actor) return false;
  const cid = String(actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? "").toLowerCase();
  if (cid === "shaman") return true;
  if (actor?.flags?.eq5e?.shaman) return true;
  // Detect via owned spells that look like shaman summon/slow/malo
  return actor.items?.some(i => String(i?.flags?.eq5e?.spell?.spellId ?? "").startsWith("sha.")) ?? false;
}

function _getEqFlag(actor, dotted, fallback=null) {
  const parts = dotted.split('.');
  let cur = actor?.flags?.eq5e;
  for (const p of parts) { if (cur == null) return fallback; cur = cur[p]; }
  return (cur === undefined) ? fallback : cur;
}

async function _setEqFlag(actor, dotted, value) {
  return actor.setFlag("eq5e", dotted, value);
}

function _findActiveSpiritSummon(ownerUuid) {
  const ids = new Set(["sha.spirit.lesser", "sha.spirit.greater"]);
  return (game.actors?.contents ?? []).find(a =>
    a?.flags?.eq5e?.summon?.active === true &&
    a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid &&
    ids.has(String(a?.flags?.eq5e?.summon?.summonId ?? ""))
  ) ?? null;
}

function _spiritSummonData({ tier = 1, rotationId = "sha.spirit.basic" } = {}) {
  const greater = tier >= 2;
  return {
    pack: "world.eq5e-shaman-spirit-pets",
    name: greater ? "Spirit Companion (Greater)" : "Spirit Companion (Lesser)",
    tokenName: "Spirit Companion",
    summonId: greater ? "sha.spirit.greater" : "sha.spirit.lesser",
    abilitiesPack: "world.eq5e-shaman-spirit-abilities",
    ai: { enabled: true, mode: "assist", allowSpells: true, rotationId, casterPreference: { preferCasting: true } }
  };
}

function _renderShamanWidget(app, html) {
  const actor = app?.actor;
  if (!actor) return;
  if (!actor.isOwner) return;
  if (!_isShamanActor(actor)) return;
  if (html.find(".eq5e-shaman-widget").length) return;

  const aa = actor?.flags?.eq5e?.shaman ?? {};
  const rotation = String(_getEqFlag(actor, "shaman.spiritRotationId", "sha.spirit.basic") ?? "sha.spirit.basic");
  const ownedAncients = actor.items?.some(i => i?.flags?.eq5e?.aa?.aaId === "aa.sha.spirit-ancients" && Number(i?.flags?.eq5e?.aa?.rank ?? 0) > 0) ?? false;
  const tier = ownedAncients ? 2 : 1;

  const pet = _findActiveSpiritSummon(actor.uuid);
  const petName = pet?.name ?? "—";
  const petMode = String(pet?.flags?.eq5e?.ai?.mode ?? "—");
  const petCond = pet?.flags?.eq5e?.conditions ?? {};
  const activeConds = Object.entries(petCond).filter(([k,v]) => v?.active === true).map(([k]) => k);
  const petCondsLabel = activeConds.length ? activeConds.join(", ") : "none";

  const widget = $(`
    <section class="eq5e-shaman-widget" style="border:1px solid rgba(255,255,255,.12); border-radius:8px; padding:8px; margin:6px 0;">
      <header style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <h3 style="margin:0; font-size:14px;">Shaman</h3>
        <span style="font-size:12px; opacity:.85;">Spirit Tier: <b>${tier}</b></span>
      </header>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8; margin-bottom:4px;">Spirit Companion</div>
          <div class="eq5e-sha-petline" style="display:flex; justify-content:space-between; gap:8px;">
            <span><b class="eq5e-sha-petname">${petName}</b></span>
            <span style="opacity:.8;">Mode: <span class="eq5e-sha-petmode">${petMode}</span></span>
          </div>
          <div style="font-size:12px; opacity:.8; margin-top:4px;">Conditions: <span class="eq5e-sha-petconds">${petCondsLabel}</span></div>

          <div style="display:flex; gap:6px; margin-top:8px;">
            <button type="button" class="eq5e-sha-summon"><i class="fa-solid fa-paw"></i> Summon</button>
            <button type="button" class="eq5e-sha-summon-upgrade" title="Summon if missing; if you have Spirit of the Ancients, upgrade Lesser → Greater"><i class="fa-solid fa-wand-magic-sparkles"></i> Summon/Upgrade</button>
            <button type="button" class="eq5e-sha-dismiss"><i class="fa-solid fa-ban"></i> Dismiss</button>
            <button type="button" class="eq5e-sha-refresh" title="Refresh this widget state"><i class="fa-solid fa-rotate"></i></button>
          </div>

          
<div style="margin-top:8px; display:flex; align-items:center; gap:8px;">
  <label style="font-size:12px; opacity:.85; margin:0;">Rotation</label>
  <select class="eq5e-sha-rotation" style="flex:1;">
    <option value="sha.spirit.basic" ${rotation==="sha.spirit.basic"?"selected":""}>Spirit Basic</option>
  </select>

  <label style="font-size:12px; opacity:.85; margin:0; margin-left:6px;">Stance</label>
  <select class="eq5e-sha-stance" style="width:120px;">
    <option value="assist">Assist</option>
    <option value="guard">Guard</option>
    <option value="passive">Passive</option>
  </select>
</div>

          <div style="font-size:12px; opacity:.75; margin-top:6px;">
            Tip: “Spirit of the Ancients” auto-upgrades your summon to the Greater spirit.
          </div>
        </div>

        <div style="border:1px solid rgba(255,255,255,.08); border-radius:8px; padding:8px;">
          <div style="font-size:12px; opacity:.8; margin-bottom:6px;">AA Readout</div>
          <div style="font-size:12px; display:grid; grid-template-columns: 1fr auto; gap:4px 10px;">
            <span>Canni Mana Bonus</span><b>${Number(aa.canniManaBonus ?? 0)}</b>
            <span>Slow Bonus %</span><b>${Math.round(Number(aa.slowBonusPct ?? 0)*100)}%</b>
            <span>Heal %</span><b>${Math.round(Number(aa.healPct ?? 0)*100)}%</b>
            <span>Pet HP Bonus</span><b>${Number(aa.petHpBonus ?? 0)}</b>
            <span>Pet Dmg %</span><b>${Math.round(Number(aa.petDamagePct ?? 0)*100)}%</b>
            <span>Pet Threat %</span><b>${Math.round(Number(aa.petThreatMult ?? 0)*100)}%</b>
          </div>
        </div>
      </div>
    </section>
  `);

  const form = html.find("form");
  if (form.length) form.prepend(widget);
  else html.prepend(widget);

  async function _refresh() { try { await app.render(false); } catch {} }



// Initialize stance dropdown from pet state (default assist)
try {
  const petActor = _findActiveSpiritSummon(actor.uuid);
  const mode = String(petActor?.flags?.eq5e?.ai?.mode ?? "assist");
  const enabled = (petActor?.flags?.eq5e?.ai?.enabled !== false);
  const stance = (!enabled || mode === "passive") ? "passive" : (mode === "guard" ? "guard" : "assist");
  widget.find(".eq5e-sha-stance").val(stance);
} catch {}

widget.find(".eq5e-sha-stance").on("change", async (ev) => {
  const v = String(ev.currentTarget.value || "assist");
  const petActor = _findActiveSpiritSummon(actor.uuid);
  if (!petActor) return ui.notifications?.info("No active Spirit Companion to change stance.");
  await game.eq5e.api.setPetStance({ petUuid: petActor.uuid, stance: v });
  await _refresh();
});

  widget.find(".eq5e-sha-refresh").on("click", _refresh);

  widget.find(".eq5e-sha-rotation").on("change", async (ev) => {
    const v = String(ev.currentTarget.value || "sha.spirit.basic");
    await _setEqFlag(actor, "shaman.spiritRotationId", v);

    // If pet exists, update its rotation live
    const petActor = _findActiveSpiritSummon(actor.uuid);
    if (petActor) {
      const ai = petActor.getFlag("eq5e","ai") ?? petActor.flags?.eq5e?.ai ?? {};
      await petActor.setFlag("eq5e","ai", foundry.utils.mergeObject(ai, { allowSpells: true, rotationId: v }));
    }
    await _refresh();
  });

  widget.find(".eq5e-sha-summon").on("click", async () => {
    const tok = actor.getActiveTokens?.()[0] ?? null;
    if (!tok) return ui.notifications?.warn("You need a token on the scene to summon your Spirit Companion.");
    const rot = String(_getEqFlag(actor, "shaman.spiritRotationId", "sha.spirit.basic") ?? "sha.spirit.basic");
    const summon = _spiritSummonData({ tier, rotationId: rot });
    await game.eq5e.api.summonPetFromCompendium({ caster: actor, casterToken: tok, summon, ownerUuid: actor.uuid });
    await _refresh();
  });

widget.find(".eq5e-sha-summon-upgrade").on("click", async () => {
  const tok = actor.getActiveTokens?.()[0] ?? null;
  if (!tok) return ui.notifications?.warn("You need a token on the scene to summon/upgrade your Spirit Companion.");

  const rot = String(_getEqFlag(actor, "shaman.spiritRotationId", "sha.spirit.basic") ?? "sha.spirit.basic");
  const ownedAncients = actor.items?.some(i => i?.flags?.eq5e?.aa?.aaId === "aa.sha.spirit-ancients" && Number(i?.flags?.eq5e?.aa?.rank ?? 0) > 0) ?? false;

  const petActor = _findActiveSpiritSummon(actor.uuid);
  const sid = String(petActor?.flags?.eq5e?.summon?.summonId ?? "");

  // If missing: summon (tier will auto-upgrade if AA is owned)
  if (!petActor) {
    const summon = _spiritSummonData({ tier: ownedAncients ? 2 : 1, rotationId: rot });
    await game.eq5e.api.summonPetFromCompendium({ caster: actor, casterToken: tok, summon, ownerUuid: actor.uuid });
    await _refresh();
    return;
  }

  // If present but lesser and AA owned: dismiss + resummon (system will swap to greater)
  if (ownedAncients && sid === "sha.spirit.lesser") {
    await game.eq5e.api.dismissSummonedPet({ ownerUuid: actor.uuid, summonId: sid, reason: "upgrade" });
    const summon = _spiritSummonData({ tier: 2, rotationId: rot });
    await game.eq5e.api.summonPetFromCompendium({ caster: actor, casterToken: tok, summon, ownerUuid: actor.uuid });
    await _refresh();
    return;
  }

  ui.notifications?.info("Your Spirit Companion is already active (and upgraded if eligible).");
  await _refresh();
});


  widget.find(".eq5e-sha-dismiss").on("click", async () => {
    const petActor = _findActiveSpiritSummon(actor.uuid);
    if (!petActor) return ui.notifications?.info("No active Spirit Companion to dismiss.");
    const sid = String(petActor?.flags?.eq5e?.summon?.summonId ?? "");
    await game.eq5e.api.dismissSummonedPet({ ownerUuid: actor.uuid, summonId: sid, reason: "dismissed" });
    await _refresh();
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  try { _renderShamanWidget(app, html); } catch (e) { console.error("[EQ5E] Shaman widget error", e); }
});
