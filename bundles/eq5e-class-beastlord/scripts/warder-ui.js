// Beastlord Warder Bond Link UI
// Adds a small panel to the actor sheet showing active warder + bond bonuses + dismiss button.

function isBeastlordActor(actor) {
  const cls = actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? null;
  if (String(cls).toLowerCase() === "beastlord") return true;
  return !!actor?.items?.find(i => i?.flags?.eq5e?.class?.id === "beastlord" || String(i?.name ?? "").toLowerCase().includes("beastlord"));
}

function findActiveWarderForOwner(owner) {
  const ownerUuid = owner?.uuid;
  if (!ownerUuid) return null;
  const actors = game.actors?.contents ?? [];
  // Prefer summonId "beastlord-warder" if present, otherwise any summonType/family warder.
  return actors.find(a => a?.flags?.eq5e?.summon?.active === true
    && a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid
    && (
      a?.flags?.eq5e?.summon?.summonId === "beastlord-warder"
      || String(a?.flags?.eq5e?.summon?.summonType ?? "").toLowerCase() === "warder"
      || String(a?.flags?.eq5e?.pet?.family ?? "").toLowerCase() === "warder"
    )
  ) ?? null;
}

function fmt(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? String(x) : "0";
}

function buildHTML(owner, warder) {
  const bond = warder?.flags?.eq5e?.pet?.bond ?? null;
  const hpMax = warder?.system?.attributes?.hp?.max ?? null;
  const hpCur = warder?.system?.attributes?.hp?.value ?? null;

  const has = !!warder;
  return `
  <section class="eq5e-warder-widget" data-owner-id="${owner.id}">
    <header class="eq5e-warder-head">
      <div class="title">Warder Bond</div>
      <div class="status">${has ? `<span class="pill on">Active</span>` : `<span class="pill off">None</span>`}</div>
    </header>

    ${has ? `
      <div class="row">
        <div class="label">Warder</div>
        <div class="value"><b>${warder.name}</b> <span class="muted">(HP ${fmt(hpCur)}/${fmt(hpMax)})</span></div>
      </div>

      <div class="grid">
        <div class="cell"><div class="k">HP Bonus</div><div class="v">${fmt(bond?.hpBonus)}</div></div>
        <div class="cell"><div class="k">ATK Bonus</div><div class="v">${fmt(bond?.attackBonus)}</div></div>
        <div class="cell"><div class="k">DMG Bonus</div><div class="v">${fmt(bond?.damageBonus)}</div></div>
        <div class="cell"><div class="k">AC Bonus</div><div class="v">${fmt(bond?.acBonus)}</div></div>
      </div>

      <div class="actions">
        <button type="button" class="eq5e-warder-dismiss">
          <i class="fa-solid fa-xmark"></i> Dismiss Warder
        </button>
        <span class="hint">Dismiss uses the same GM-socket authorization flow as other pets.</span>
      </div>
    ` : `
      <div class="row muted">No active warder found. Cast a Summon Warder spell.</div>
    `}
  </section>`;
}

export function registerWarderBondWidget() {
  Hooks.on("renderActorSheet", (app, html) => {
    try {
      const actor = app?.actor;
      if (!actor || !actor.isOwner) return;
      if (!isBeastlordActor(actor)) return;

      // Avoid duplicating the widget on rerenders
      if (html[0].querySelector(".eq5e-warder-widget")) return;

      const warder = findActiveWarderForOwner(actor);

      const wrap = document.createElement("div");
      wrap.innerHTML = buildHTML(actor, warder);
      const el = wrap.firstElementChild;
      if (!el) return;

      const root = html[0].querySelector(".window-content");
      if (root) root.prepend(el);

      el.querySelector(".eq5e-warder-dismiss")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        const ok = await Dialog.confirm({
          title: "Dismiss Warder",
          content: `<p>Dismiss your active warder?</p>`
        });
        if (!ok) return;

        const api = game.eq5e?.api;
        if (!api?.dismissSummonedPet) {
          ui.notifications?.warn("EQ5E API not ready (dismissSummonedPet missing).");
          return;
        }

        const res = await api.dismissSummonedPet({ ownerUuid: actor.uuid, summonId: "beastlord-warder", reason: "dismissed" });
        if (res?.ok) ui.notifications?.info("Warder dismissed.");
        else ui.notifications?.warn(`Dismiss failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });
    } catch (e) {
      console.error("[EQ5E] Warder widget error", e);
    }
  });
}
