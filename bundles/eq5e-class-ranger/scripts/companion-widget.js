const MOD = "eq5e-class-ranger";
const SUMMON_ID = "ranger.companion";
const PACK_COMPANIONS = "world.eq5e-ranger-companions";
const PACK_ABILITIES = "world.eq5e-ranger-companion-abilities";

async function loadVariants() {
  const pack = game.packs?.get(PACK_COMPANIONS);
  if (!pack) return [{ name: "Companion (Wolf)", value: "Companion (Wolf)" }];
  const docs = await pack.getDocuments();
  return docs.map(d => ({ name: d.name, value: d.name }));
}

function getActiveCompanion(owner) {
  const a = (game.actors?.contents ?? []).find(x =>
    x?.flags?.eq5e?.summon?.active === true &&
    x?.flags?.eq5e?.summon?.ownerUuid === owner.uuid &&
    x?.flags?.eq5e?.summon?.summonId === SUMMON_ID
  );
  return a ?? null;
}

function companionPill(owner, pet) {
  if (!pet) return `<span class="pill warn">No Companion</span>`;
  const mez = pet.flags?.eq5e?.conditions?.mezzed?.active ? "Mez" : null;
  const sil = pet.flags?.eq5e?.conditions?.silenced?.active ? "Silence" : null;
  const root = pet.flags?.eq5e?.conditions?.rooted?.active ? "Root" : null;
  const blocked = mez || sil || root;
  return blocked ? `<span class="pill warn">Blocked: ${blocked}</span>` : `<span class="pill ok">Active</span>`;
}

async function buildHTML(owner, pet) {
  const variants = await loadVariants();
  const activeName = pet?.name ?? null;
  return `
  <div class="eq5e-ranger-companion">
    <div class="head">
      <div class="title">Animal Companion</div>
      ${companionPill(owner, pet)}
    </div>
    <div class="row">
      <select class="variant">
        ${variants.map(v => `<option value="${v.value}" ${v.value===activeName?'selected':''}>${v.name}</option>`).join("")}
      </select>
    </div>
    <div class="row muted">
      SummonId: <b>${SUMMON_ID}</b>
    </div>
    <div class="actions">
      <button type="button" class="summon"><i class="fa-solid fa-paw"></i> Summon / Swap</button>
      <button type="button" class="dismiss"><i class="fa-solid fa-ban"></i> Dismiss</button>
    </div>
  </div>`;
}

export function registerRangerCompanionWidget() {
  Hooks.on("renderActorSheet", async (app, html, data) => {
    const actor = app.actor;
    if (!actor || actor.type !== "character") return;
    const cls = actor.flags?.eq5e?.class?.id ?? actor.flags?.eq5e?.classId ?? "";
    if (String(cls).toLowerCase() !== "ranger") return;

    const pet = getActiveCompanion(actor);
    const wrap = $(`<div></div>`);
    wrap.html(await buildHTML(actor, pet));

    wrap.on("click", "button.summon", async () => {
      const variant = wrap.find("select.variant").val();
      const casterToken = actor.getActiveTokens(true)?.[0] ?? null;
      if (!casterToken) return ui.notifications?.warn("Place your Ranger token on a scene to summon the companion.");
      const family = String(variant).includes("Bear") ? "Bear:" : (String(variant).includes("Hawk") ? "Hawk:" : "Wolf:");
      const summon = {
        pack: PACK_COMPANIONS,
        name: String(variant),
        tokenName: "Companion",
        summonId: SUMMON_ID,
        summonType: "pet",
        abilitiesPack: PACK_ABILITIES,
        abilitiesQuery: family,
        ai: { enabled: true, mode: "assist" }
      };
      const res = await game.eq5e.api.summonPetFromCompendium({ caster: actor, casterToken, summon, ownerUuid: actor.uuid });
      if (res?.ok) ui.notifications?.info("Companion summon/swap requested.");
      else ui.notifications?.error(`Summon failed: ${res?.reason ?? "unknown"}`);
    });

    wrap.on("click", "button.dismiss", async () => {
      const res = await game.eq5e.api.dismissSummonedPet({ ownerUuid: actor.uuid, summonId: SUMMON_ID, reason: "ranger-dismiss" });
      if (res?.ok) ui.notifications?.info("Dismiss requested.");
      else ui.notifications?.error(`Dismiss failed: ${res?.reason ?? "unknown"}`);
    });

    html.find(".window-content").prepend(wrap);
  });
}
