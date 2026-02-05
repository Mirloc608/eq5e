const MOD = "eq5e-class-druid";
const SUMMON_ID = "druid.companion";
const PACK_COMPANIONS = "world.eq5e-druid-companions";
const PACK_ABILITIES = "world.eq5e-druid-companion-abilities";

async function loadVariants() {
  const pack = game.packs?.get(PACK_COMPANIONS);
  if (!pack) return [{ name: "Companion (Bear)", value: "Companion (Bear)" }];
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

function pillFor(actor, pet) {
  const form = actor.flags?.eq5e?.druid?.wildshape?.form ?? "";
  const wild = form ? `<span class="pill ok">Form: ${form}</span>` : `<span class="pill warn">Form: none</span>`;
  if (!pet) return wild + ` <span class="pill warn">No Companion</span>`;
  const mez = pet.flags?.eq5e?.conditions?.mezzed?.active ? "Mez" : null;
  const sil = pet.flags?.eq5e?.conditions?.silenced?.active ? "Silence" : null;
  const root = pet.flags?.eq5e?.conditions?.rooted?.active ? "Root" : null;
  const blocked = mez || sil || root;
  const p = blocked ? `<span class="pill warn">Pet Blocked: ${blocked}</span>` : `<span class="pill ok">Pet: Active</span>`;
  return wild + " " + p;
}

export function registerDruidWidget() {
  Hooks.on("renderActorSheet", async (app, html) => {
    const actor = app.actor;
    if (!actor || actor.type !== "character") return;
    const cls = String(actor.flags?.eq5e?.class?.id ?? actor.flags?.eq5e?.classId ?? "").toLowerCase();
    if (cls !== "druid") return;

    const pet = getActiveCompanion(actor);
    const variants = await loadVariants();

    const wrap = $(`
      <div class="eq5e-druid-widget">
        <div class="head">
          <div class="title">Druid Companion & Wild Shape</div>
          <div class="pills">${pillFor(actor, pet)}</div>
        </div>

        <div class="grid">
          <div>
            <div class="row"><b>Companion</b></div>
            <div class="row">
              <select class="variant">
                ${variants.map(v => `<option value="${v.value}" ${v.value===(pet?.name??"")?'selected':''}>${v.name}</option>`).join("")}
              </select>
            </div>
            <div class="actions">
              <button type="button" class="summon"><i class="fa-solid fa-paw"></i> Summon/Swap</button>
              <button type="button" class="dismiss"><i class="fa-solid fa-ban"></i> Dismiss</button>
            </div>
          </div>

          <div>
            <div class="row"><b>Wild Shape</b></div>
            <div class="actions">
              <button type="button" class="ws-wolf"><i class="fa-solid fa-wolf-pack-battalion"></i> Wolf</button>
              <button type="button" class="ws-bear"><i class="fa-solid fa-paw"></i> Bear</button>
            </div>
            <div class="actions">
              <button type="button" class="ws-dismiss"><i class="fa-solid fa-ban"></i> Dismiss Form</button>
            </div>
            <div class="muted">Tip: Wild Shape is deterministic (Active Effect), and AAs can add potency later without changing mechanics.</div>
          </div>
        </div>
      </div>
    `);

    // Companion summon/swap
    wrap.on("click", "button.summon", async () => {
      const variant = String(wrap.find("select.variant").val() ?? "Companion (Bear)");
      const casterToken = actor.getActiveTokens(true)?.[0] ?? null;
      if (!casterToken) return ui.notifications?.warn("Place your Druid token on a scene to summon the companion.");
      const family = variant.includes("Wolf") ? "Wolf:" : (variant.includes("Hawk") ? "Hawk:" : "Bear:");
      const summon = {
        pack: PACK_COMPANIONS,
        name: variant,
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
      const res = await game.eq5e.api.dismissSummonedPet({ ownerUuid: actor.uuid, summonId: SUMMON_ID, reason: "druid-dismiss" });
      if (res?.ok) ui.notifications?.info("Dismiss requested.");
      else ui.notifications?.error(`Dismiss failed: ${res?.reason ?? "unknown"}`);
    });

    async function castById(spellId) {
      const item = actor.items?.find(i => i?.flags?.eq5e?.spell?.spellId === spellId);
      if (!item) return ui.notifications?.warn(`Spell not found on actor: ${spellId}. Run Setup Wizard -> Apply to actor.`);
      const token = actor.getActiveTokens(true)?.[0] ?? null;
      const target = null;
      await game.eq5e.api.castSpell({ caster: actor, item, casterToken: token, target });
    }

    wrap.on("click", "button.ws-wolf", () => castById("dru.wildshape.wolf.1"));
    wrap.on("click", "button.ws-bear", () => castById("dru.wildshape.bear.1"));
    wrap.on("click", "button.ws-dismiss", () => castById("dru.wildshape.dismiss"));

    html.find(".window-content").prepend(wrap);
  });
}
