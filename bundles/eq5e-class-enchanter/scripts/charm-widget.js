
let AA_NAME_CACHE = null;

async function loadAANamesFromCompendium() {
  try {
    const pack = game.packs?.get("world.eq5e-aa");
    if (!pack) return null;
    const idx = await pack.getIndex({ fields: ["name", "flags.eq5e.aa.aaId"] });
    const map = new Map();
    for (const e of idx) {
      const aaId = e?.flags?.eq5e?.aa?.aaId;
      if (aaId) map.set(String(aaId), String(e.name ?? ""));
    }
    AA_NAME_CACHE = map;
    return map;
  } catch (e) {
    console.warn("[EQ5E] AA name cache build failed", e);
    return null;
  }
}

const CHARM_SUMMON_ID = "enchanter.charm";

function isEnchanter(actor) {
  const cls = actor?.flags?.eq5e?.class?.id ?? actor?.flags?.eq5e?.classId ?? actor?.flags?.eq5e?.class ?? null;
  if (String(cls).toLowerCase() === "enchanter") return true;
  return !!actor?.items?.find(i => i?.flags?.eq5e?.class?.id === "enchanter" || String(i?.name ?? "").toLowerCase().includes("enchanter"));
}

function findActiveCharm(owner) {
  const ownerUuid = owner?.uuid;
  if (!ownerUuid) return null;
  const actors = game.actors?.contents ?? [];
  return actors.find(a => a?.flags?.eq5e?.summon?.active === true
    && a?.flags?.eq5e?.summon?.ownerUuid === ownerUuid
    && a?.flags?.eq5e?.summon?.summonId === CHARM_SUMMON_ID
  ) ?? null;
}

function remainingRounds(charmedActor) {
  const combat = game.combat;
  if (!combat) return null;
  const exp = charmedActor?.flags?.eq5e?.conditions?.charmed?.expiresRound ?? charmedActor?.flags?.eq5e?.charm?.expiresRound ?? null;
  if (exp === null || exp === undefined) return null;
  return Math.max(0, Number(exp) - Number(combat.round ?? 0));
}


function aaContribTooltip(actor) {
  try {
    const owned = actor?.items ?? [];
    const rows = [];

    for (const it of owned) {
      const aa = it?.flags?.eq5e?.aa;
      if (!aa?.aaId) continue;
      const rank = Number(aa.rank ?? 0);
      if (!rank) continue;

      const scales = aa.scales ?? {};
      const mezRounds = Number(scales.mezRoundsPerRank ?? 0) * rank;
      const charmRounds = Number(scales.charmRoundsPerRank ?? 0) * rank;
      const mezBreakRed = Number(scales.mezBreakChanceRedPerRank ?? 0) * rank;
      const charmBreakRed = Number(scales.charmBreakChanceRedPerRank ?? 0) * rank;

      if (!(mezRounds || charmRounds || mezBreakRed || charmBreakRed)) continue;

      const parts = [];
      if (mezRounds) parts.push(`+${mezRounds} mez rounds`);
      if (charmRounds) parts.push(`+${charmRounds} charm rounds`);
      if (mezBreakRed) parts.push(`-${Math.round(mezBreakRed * 100)}% mez break`);
      if (charmBreakRed) parts.push(`-${Math.round(charmBreakRed * 100)}% charm break`);

      const label = aa.name ?? it.name ?? (AA_NAME_CACHE?.get(String(aa.aaId)) ?? aa.aaId);
      rows.push(`<div><b>${label}</b> (r${rank}): ${parts.join(", ")}</div>`);
    }

    if (!rows.length) return `<div>No contributing Enchanter control AAs owned.</div>`;
    return `<div class="eq5e-tt-title"><b>AA Contributions</b></div>${rows.join("")}`;
  } catch (e) {
    return `<div>AA contribution details unavailable.</div>`;
  }
}

function buildHTML(owner, charmed) {
  const has = !!charmed;
  const rem = has ? remainingRounds(charmed) : null;

  const mezBonus = Number(owner?.flags?.eq5e?.enchanter?.mezBonusRounds ?? 0);
  const charmBonus = Number(owner?.flags?.eq5e?.enchanter?.charmBonusRounds ?? 0);
  const mezRed = Number(owner?.flags?.eq5e?.enchanter?.mezBreakChanceRed ?? 0);
  const charmRed = Number(owner?.flags?.eq5e?.enchanter?.charmBreakChanceRed ?? 0);
  const mezRedPct = Math.round(mezRed * 100);
  const charmRedPct = Math.round(charmRed * 100);
  const charmBase = 22;
  const charmEff = Math.max(0, Math.round((0.22 - charmRed) * 100));
  const aaTip = aaContribTooltip(owner);

  return `
  <section class="eq5e-charm-widget" data-owner-id="${owner.id}">
    <header class="eq5e-charm-head">
      <div class="title">Charm <i class="fa-solid fa-circle-info eq5e-tt" data-tooltip="${aaTip}"></i></div>
      <div class="status">${has ? `<span class="pill on">Active</span>` : `<span class="pill off">None</span>`}</div>
    </header>

    ${has ? `
      <div class="row">
        <div class="label">Target</div>
        <div class="value"><b>${charmed.name}</b> ${rem!==null?`<span class="muted">(~${rem} rds)</span>`:""}</div>
      </div>

      <div class="eq5e-charm-mods eq5e-tt" data-tooltip="${aaTip}">
        <div class="cell"><div class="k">Mez +Rounds</div><div class="v">+${mezBonus}</div></div>
        <div class="cell"><div class="k">Mez Break Red</div><div class="v">-${mezRedPct}%</div></div>
        <div class="cell"><div class="k">Charm +Rounds</div><div class="v">+${charmBonus}</div></div>
        <div class="cell"><div class="k">Charm Break</div><div class="v">${charmEff}% <span class="muted">(base ${charmBase}%)</span></div></div>
      </div>
    ` : `<div class="row muted">No active charm target found.</div>

      <div class="eq5e-charm-mods eq5e-tt" data-tooltip="${aaTip}">
        <div class="cell"><div class="k">Mez +Rounds</div><div class="v">+${mezBonus}</div></div>
        <div class="cell"><div class="k">Mez Break Red</div><div class="v">-${mezRedPct}%</div></div>
        <div class="cell"><div class="k">Charm +Rounds</div><div class="v">+${charmBonus}</div></div>
        <div class="cell"><div class="k">Charm Break</div><div class="v">${charmEff}% <span class="muted">(base ${charmBase}%)</span></div></div>
      </div>`}

    <div class="actions">
      <button type="button" class="eq5e-charm-dismiss" ${has?"":"disabled"}><i class="fa-solid fa-xmark"></i> Break Charm</button>
      <div class="hint muted">Break Charm uses the same socket-authorized flow (GM will execute; GM gets a cue).</div>
    </div>
  </section>`;
}

export function registerEnchanterCharmWidget() {
  Hooks.once("ready", async () => {
    await loadAANamesFromCompendium();
  });
  Hooks.on("renderActorSheet", (app, html) => {
    try {
      const actor = app?.actor;
      if (!actor || !actor.isOwner) return;
      if (!isEnchanter(actor)) return;

      if (html[0].querySelector(".eq5e-charm-widget")) return;

      const charmed = findActiveCharm(actor);

      const wrap = document.createElement("div");
      wrap.innerHTML = buildHTML(actor, charmed);
      const el = wrap.firstElementChild;
      if (!el) return;

      const root = html[0].querySelector(".window-content");
      if (root) root.prepend(el);

      el.querySelector(".eq5e-charm-dismiss")?.addEventListener("click", async (ev) => {
        ev.preventDefault();
        if (!charmed) return;
        const ok = await Dialog.confirm({ title: "Break Charm", content: `<p>Break charm on <b>${charmed.name}</b>?</p>` });
        if (!ok) return;
        const res = await game.eq5e?.api?.dismissSummonedPet?.({ ownerUuid: actor.uuid, summonId: CHARM_SUMMON_ID, reason: "break-charm" });
        if (res?.ok) ui.notifications?.info("Charm break requested.");
        else ui.notifications?.warn(`Break failed: ${res?.reason ?? "unknown"}`);
        actor.sheet?.render(false);
      });
    } catch (e) {
      console.error("[EQ5E] Enchanter charm widget error", e);
    }
  });
}
