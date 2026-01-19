// Shadowknight Necrotic Minion UI widget

async function loadVariants() {
  const pack = game.packs?.get("world.eq5e-sk-necrotic-pets");
  if (!pack) return [{ name: "Minor Necrotic Minion", value: "Minor Necrotic Minion" }];
  const docs = await pack.getDocuments();
  return docs.map(d => ({ name: d.name, value: d.name }));
}

const SUMMON_ID = "sk.necrotic-minion";

function isShadowknight(actor) {
  const cls = actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? null;
  if (String(cls).toLowerCase() === "shadowknight") return true;
  return !!actor?.items?.find(i => i?.flags?.eq5e?.class?.id === "shadowknight" || String(i?.name ?? "").toLowerCase().includes("shadowknight"));
}

function findActiveMinion(owner) {
  const ownerUuid = owner?.uuid;
  if (!ownerUuid) return null;
  const actors = game.actors?.contents ?? [];
  return actors.find(a => a?.flags?.eq5e?.summon?.active === true
    && a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid
    && a?.flags?.eq5e?.summon?.summonId === SUMMON_ID
  ) ?? null;
}

function fmt(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? String(x) : "0";
}

async function buildHTML(owner, pet) {
  const has = !!pet;
  const bond = pet?.flags?.eq5e?.pet?.bond ?? null;
  const hpMax = pet?.system?.attributes?.hp?.max ?? null;
  const hpCur = pet?.system?.attributes?.hp?.value ?? null;

  // SK currently only has the Minor Necrotic Minion template (more can be added later without changing summonId)
  const options = await loadVariants();

  const current = has ? pet.name : options[0].value;

  return `
  <section class="eq5e-necrotic-widget" data-owner-id="${owner.id}">
    <header class="eq5e-necrotic-head">
      <div class="title">Necrotic Minion</div>
      <div class="status">${has ? `<span class="pill on">Active</span>` : `<span class="pill off">None</span>`}</div>
    </header>

    ${has ? `
      <div class="row">
        <div class="label">Minion</div>
        <div class="value"><b>${pet.name}</b> <span class="muted">(HP ${fmt(hpCur)}/${fmt(hpMax)})</span></div>
      </div>

      <div class="grid">
        <div class="cell"><div class="k">HP Bonus</div><div class="v">${fmt(bond?.hpBonus)}</div></div>
        <div class="cell"><div class="k">ATK Bonus</div><div class="v">${fmt(bond?.attackBonus)}</div></div>
        <div class="cell"><div class="k">DMG Bonus</div><div class="v">${fmt(bond?.damageBonus)}</div></div>
        <div class="cell"><div class="k">AC Bonus</div><div class="v">${fmt(bond?.acBonus)}</div></div>
      </div>
    ` : `
      <div class="row muted">No active necrotic minion found. Summon one to see bond bonuses.</div>
    `}

    <div class="actions">
      <div class="swap">
        <select class="eq5e-necrotic-variant">
          ${options.map(o => `<option value="${o.value}" ${o.value===current?"selected":""}>${o.name}</option>`).join("")}
        </select>
        <button type="button" class="eq5e-necrotic-swap"><i class="fa-solid fa-rotate"></i> Re-summon</button>
      </div>
      <button type="button" class="eq5e-necrotic-dismiss"><i class="fa-solid fa-xmark"></i> Dismiss</button>
      <div class="hint muted">Re-summon/dismiss are socket-authorized: players can do this without GM clicks; GM receives a cue.</div>
    </div>
  </section>`;
}

export function registerShadowknightNecroticWidget() {
  Hooks.on("renderActorSheet", (app, html) => {
    try {
      const actor = app?.actor;
      if (!actor || !actor.isOwner) return;
      if (!isShadowknight(actor)) return;

      if (html[0].querySelector(".eq5e-necrotic-widget")) return;

      const pet = findActiveMinion(actor);

      const wrap = document.createElement("div");
      wrap.innerHTML = await buildHTML(actor, pet);
      const el = wrap.firstElementChild;
      if (!el) return;

      const root = html[0].querySelector(".window-content");
      if (root) root.prepend(el);

      el.querySelector(".eq5e-necrotic-dismiss")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ok = await Dialog.confirm({ title: "Dismiss Necrotic Minion", content: "<p>Dismiss your necrotic minion?</p>" });
        if (!ok) return;
        const res = await game.eq5e?.api?.dismissSummonedPet?.({ ownerUuid: actor.uuid, summonId: SUMMON_ID, reason: "dismissed" });
        if (res?.ok) ui.notifications?.info("Necrotic minion dismissed.");
        else ui.notifications?.warn(`Dismiss failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });

      el.querySelector(".eq5e-necrotic-swap")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const sel = el.querySelector(".eq5e-necrotic-variant");
        const variant = sel?.value;
        if (!variant) return;

        const ok = await Dialog.confirm({
          title: "Re-summon Necrotic Minion",
          content: `<p>Re-summon <b>${variant}</b>? (Current minion will be dismissed.)</p>`
        });
        if (!ok) return;

        const res = await game.eq5e?.api?.swapSummonVariant?.({
          ownerUuid: actor.uuid,
          summonId: SUMMON_ID,
          summonType: "necrotic",
          pack: "world.eq5e-sk-necrotic-pets",
          name: variant,
          tokenName: "Necrotic Minion",
          abilitiesPack: "world.eq5e-sk-necrotic-pet-abilities",
          ai: { enabled: true, mode: "assist" }
        });

        if (res?.ok) ui.notifications?.info("Necrotic minion re-summon requested.");
        else ui.notifications?.warn(`Re-summon failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });
    } catch (e) {
      console.error("[EQ5E] SK necrotic widget error", e);
    }
  });
}
