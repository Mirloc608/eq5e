// Necromancer Undead Servant UI widget
const SUMMON_ID = "necro.undead-servant";

function isNecromancer(actor) {
  const cls = actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? null;
  if (String(cls).toLowerCase() === "necromancer") return true;
  return !!actor?.items?.find(i => i?.flags?.eq5e?.class?.id === "necromancer" || String(i?.name ?? "").toLowerCase().includes("necromancer"));
}

function findActiveUndead(owner) {
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

function buildHTML(owner, pet) {
  const has = !!pet;
  const bond = pet?.flags?.eq5e?.pet?.bond ?? null;
  const hpMax = pet?.system?.attributes?.hp?.max ?? null;
  const hpCur = pet?.system?.attributes?.hp?.value ?? null;

  const options = [
    { name: "Undead Servant (Skeleton)", value: "Undead Servant (Skeleton)" },
    { name: "Undead Servant (Zombie)", value: "Undead Servant (Zombie)" },
    { name: "Undead Servant (Wraith)", value: "Undead Servant (Wraith)" }
  ];

  const current = has ? pet.name : options[0].value;

  return `
  <section class="eq5e-undead-widget" data-owner-id="${owner.id}">
    <header class="eq5e-undead-head">
      <div class="title">Undead Servant</div>
      <div class="status">${has ? `<span class="pill on">Active</span>` : `<span class="pill off">None</span>`}</div>
    </header>

    ${has ? `
      <div class="row">
        <div class="label">Servant</div>
        <div class="value"><b>${pet.name}</b> <span class="muted">(HP ${fmt(hpCur)}/${fmt(hpMax)})</span></div>
      </div>

      <div class="grid">
        <div class="cell"><div class="k">HP Bonus</div><div class="v">${fmt(bond?.hpBonus)}</div></div>
        <div class="cell"><div class="k">ATK Bonus</div><div class="v">${fmt(bond?.attackBonus)}</div></div>
        <div class="cell"><div class="k">DMG Bonus</div><div class="v">${fmt(bond?.damageBonus)}</div></div>
        <div class="cell"><div class="k">AC Bonus</div><div class="v">${fmt(bond?.acBonus)}</div></div>
      </div>
    ` : `
      <div class="row muted">No active undead servant found. Summon one to see bond bonuses.</div>
    `}

    <div class="actions">
      <div class="swap">
        <select class="eq5e-undead-variant">
          ${options.map(o => `<option value="${o.value}" ${o.value===current?"selected":""}>${o.name}</option>`).join("")}
        </select>
        <button type="button" class="eq5e-undead-swap"><i class="fa-solid fa-rotate"></i> Swap</button>
      </div>
      <button type="button" class="eq5e-undead-dismiss"><i class="fa-solid fa-xmark"></i> Dismiss</button>
      <div class="hint muted">Swap/dismiss are socket-authorized: players can do this without GM clicks; GM receives a cue.</div>
    </div>
  </section>`;
}

export function registerNecroUndeadWidget() {
  Hooks.on("renderActorSheet", (app, html) => {
    try {
      const actor = app?.actor;
      if (!actor || !actor.isOwner) return;
      if (!isNecromancer(actor)) return;

      if (html[0].querySelector(".eq5e-undead-widget")) return;

      const pet = findActiveUndead(actor);

      const wrap = document.createElement("div");
      wrap.innerHTML = buildHTML(actor, pet);
      const el = wrap.firstElementChild;
      if (!el) return;

      const root = html[0].querySelector(".window-content");
      if (root) root.prepend(el);

      el.querySelector(".eq5e-undead-dismiss")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ok = await Dialog.confirm({ title: "Dismiss Undead Servant", content: "<p>Dismiss your undead servant?</p>" });
        if (!ok) return;
        const res = await game.eq5e?.api?.dismissSummonedPet?.({ ownerUuid: actor.uuid, summonId: SUMMON_ID, reason: "dismissed" });
        if (res?.ok) ui.notifications?.info("Undead servant dismissed.");
        else ui.notifications?.warn(`Dismiss failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });

      el.querySelector(".eq5e-undead-swap")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const sel = el.querySelector(".eq5e-undead-variant");
        const variant = sel?.value;
        if (!variant) return;

        const ok = await Dialog.confirm({
          title: "Swap Undead Servant",
          content: `<p>Swap your servant to <b>${variant}</b>? (Current will be dismissed.)</p>`
        });
        if (!ok) return;

        const res = await game.eq5e?.api?.swapSummonVariant?.({
          ownerUuid: actor.uuid,
          summonId: SUMMON_ID,
          summonType: "undead",
          pack: "world.eq5e-necro-undead-pets",
          name: variant,
          tokenName: "Undead Servant",
          abilitiesPack: "world.eq5e-necro-undead-abilities",
          ai: { enabled: true, mode: "assist" }
        });

        if (res?.ok) ui.notifications?.info("Undead servant swap requested.");
        else ui.notifications?.warn(`Swap failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });
    } catch (e) {
      console.error("[EQ5E] Necro undead widget error", e);
    }
  });
}
