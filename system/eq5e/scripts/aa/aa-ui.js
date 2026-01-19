import { getAAState, purchaseAA, respecAAs } from "./aa.js";

function _isOwner(actor) { return actor?.isOwner; }

function buildAAWidgetHTML(actor) {
  const st = getAAState(actor);
  return `
  <section class="eq5e-aa-widget" data-actor-id="${actor.id}">
    <header class="eq5e-aa-head">
      <div class="title">Alternate Abilities</div>
      <div class="points">Unspent: <b>${st.unspent}</b> / Total: ${st.total}</div>
    </header>
    <div class="eq5e-aa-row">
      <label>Advancement Mode</label>
      <select class="eq5e-aa-mode">
        <option value="leveling" ${st.mode==="leveling"?"selected":""}>Leveling</option>
        <option value="aa" ${st.mode==="aa"?"selected":""}>Purchase AAs</option>
      </select>
      <span class="hint">Choose what happens when you would gain a level.</span>
    </div>
    <div class="eq5e-aa-row">
      <button type="button" class="eq5e-aa-open"><i class="fa-solid fa-sparkles"></i> Open AA Browser</button>
      <button type="button" class="eq5e-aa-respec"><i class="fa-solid fa-rotate-left"></i> Respec AAs</button>
    </div>
  </section>`;
}

async function openAABrowser(actor) {
  const pack = game.packs?.get("world.eq5e-aa");
  if (!pack) return ui.notifications?.warn("AA pack not found: world.eq5e-aa");
  const docs = await pack.getDocuments();
  const st = getAAState(actor);

  
const content = document.createElement("div");
content.className = "eq5e-aa-browser";

const categories = Array.from(new Set(docs.map(d => String(d.flags?.eq5e?.aa?.category ?? "General")))).sort();
categories.unshift("All");
let activeCat = "All";

const level = Number(foundry.utils.getProperty(actor, "system.details.level")
  ?? foundry.utils.getProperty(actor, "system.level")
  ?? 1);

const rankOf = (aaId) => {
  const owned = actor.items?.find(i => i?.flags?.eq5e?.aa?.aaId === aaId);
  return Number(owned?.flags?.eq5e?.aa?.rank ?? 0);
};

const meets = (doc) => {
  const aa = doc.flags?.eq5e?.aa ?? {};
  const req = aa.prereq ?? {};
  if (Number(req.minLevel ?? 0) > level) return { ok: false, why: `Requires level ${req.minLevel}` };

  const chain = Array.isArray(req.requires) ? req.requires : [];
  for (const r of chain) {
    const needId = r?.aaId;
    const needRank = Number(r?.rank ?? 1);
    if (!needId) continue;
    const have = rankOf(needId);
    if (have < needRank) return { ok: false, why: `Requires ${needId} rank ${needRank}` };
  }
  return { ok: true, why: "" };
};

const render = () => {
  const st2 = getAAState(actor);
  const tabHtml = categories.map(c => `<button type="button" class="aa-tab ${c===activeCat?"active":""}" data-cat="${c}">${c}</button>`).join("");
  const list = docs
    .filter(d => activeCat==="All" || String(d.flags?.eq5e?.aa?.category ?? "General") === activeCat)
    .map(d => {
      const aa = d.flags?.eq5e?.aa ?? {};
      const req = aa.prereq?.minLevel ? `min lvl ${aa.prereq.minLevel}` : "—";
      const owned = actor.items?.find(i => i?.flags?.eq5e?.aa?.aaId === aa.aaId);
      const rank = Number(owned?.flags?.eq5e?.aa?.rank ?? 0);
      const max = Number(aa.maxRank ?? 1);
      const cost = Number(aa.cost ?? 1);
      const prereq = meets(d);
      const disabled = (!actor.isOwner) || st2.unspent < cost || rank >= max || !prereq.ok;
      const prereqText = prereq.ok ? "" : prereq.why;
      return `<div class="aa-entry" data-aa-id="${aa.aaId}">
        <div class="left">
          <div class="name"><b>${d.name}</b></div>
          <div class="meta">Category: ${aa.category ?? "General"} • Cost: ${cost} • Rank: ${rank}/${max} • Prereq: ${req}</div>
          ${prereqText ? `<div class="prereq">${prereqText}</div>` : ""}
        </div>
        <div class="right">
          <button type="button" class="buy" ${disabled?"disabled":""}>Buy/Rank Up</button>
        </div>
      </div>`;
    }).join("");

  content.innerHTML = `
    <div class="aa-top">
      <div class="aa-points">Unspent: <b>${st2.unspent}</b> / Total: ${st2.total}</div>
    </div>
    <div class="aa-tabs">${tabHtml}</div>
    <div class="aa-list">${list}</div>
  `;

  content.querySelectorAll(".aa-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCat = btn.dataset.cat;
      render();
    });
  });

  content.querySelectorAll(".aa-entry .buy").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      const entry = ev.currentTarget.closest(".aa-entry");
      const aaId = entry?.dataset?.aaId;
      const doc = docs.find(d => d.flags?.eq5e?.aa?.aaId === aaId);
      const res = await purchaseAA({ actor, aaDoc: doc });
      if (!res.ok) ui.notifications?.warn(`AA purchase failed: ${res.reason}`);
      else ui.notifications?.info(`Purchased ${doc.name} (rank ${res.newRank})`);
      actor.sheet?.render(false);
      render();
    });
  });
};

render();

const dlg = new Dialogconst dlg = new Dialog({
    title: `AA Browser — ${actor.name}`,
    content: content.outerHTML,
    buttons: { close: { label: "Close" } },
    render: (html) => {
      html[0].querySelectorAll(".aa-entry .buy").forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          const entry = ev.currentTarget.closest(".aa-entry");
          const aaId = entry?.dataset?.aaId;
          const doc = docs.find(d => d.flags?.eq5e?.aa?.aaId === aaId);
          const res = await purchaseAA({ actor, aaDoc: doc });
          if (!res.ok) ui.notifications?.warn(`AA purchase failed: ${res.reason}`);
          else ui.notifications?.info(`Purchased ${doc.name} (rank ${res.newRank})`);
          actor.sheet?.render(false);
          dlg.render(true);
        });
      });
    }
  });
  dlg.render(true);
}

export function registerAAWidget() {
  Hooks.on("renderActorSheet", (app, html, data) => {
    const actor = app?.actor;
    if (!actor || !_isOwner(actor)) return;

    // Insert near top (below header)
    const panel = document.createElement("div");
    panel.innerHTML = buildAAWidgetHTML(actor);
    const el = panel.firstElementChild;
    if (!el) return;

    const header = html[0].querySelector(".window-content");
    if (header) header.prepend(el);

    el.querySelector(".eq5e-aa-mode")?.addEventListener("change", async (ev) => {
      const mode = ev.currentTarget.value;
      await actor.setFlag("eq5e", "aa", { ...(actor.flags?.eq5e?.aa ?? {}), mode });
    });

el.querySelector(".eq5e-aa-respec")?.addEventListener("click", async (ev) => {
  ev.preventDefault();
  const ok = await Dialog.confirm({
    title: "Respec Alternate Abilities",
    content: "<p>This will remove all purchased AAs from the actor and refund spent AA points. Continue?</p>"
  });
  if (!ok) return;
  const res = await respecAAs(actor);
  if (res.ok) ui.notifications?.info(`EQ5E: Respec complete (removed ${res.removed}, refunded ${res.refunded}).`);
  else ui.notifications?.warn(`EQ5E: Respec failed: ${res.reason}`);
  actor.sheet?.render(false);
});

    el.querySelector(".eq5e-aa-open")?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      await openAABrowser(actor);
    });
  });
}
