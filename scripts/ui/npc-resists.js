const RESIST_KEYS = ["fire","cold","electric","magic","poison","disease"];

function getActorResists(actor) {
  const r = actor?.flags?.eq5e?.resists ?? {};
  const out = {};
  for (const k of RESIST_KEYS) out[k] = Number(r[k] ?? 0);
  return out;
}

async function setActorResist(actor, key, val) {
  const v = Math.max(0, Math.min(300, Number(val ?? 0)));
  await actor.setFlag("eq5e", `resists.${key}`, v);
}

async function applyProfile(actor, profile) {
  if (!profile) return;
  const vals = profile.values ?? {};
  // set provided keys, leave others unchanged
  for (const k of RESIST_KEYS) {
    if (k in vals) await setActorResist(actor, k, vals[k]);
  }
}

Hooks.on("renderActorSheet", (app, html, data) => {
  try {
    const actor = app.actor;
    if (!actor || actor.type !== "npc") return;

    const resists = getActorResists(actor);
    const profiles = (game.eq5e?.resistProfiles ?? []);
    const container = document.createElement("div");
    container.className = "eq5e-npc-resists";
    container.style.marginTop = "8px";
    container.style.padding = "8px";
    container.style.border = "1px solid rgba(255,255,255,0.12)";
    container.style.borderRadius = "8px";

    const title = document.createElement("div");
    title.textContent = "EQ5e Resists";
    title.style.fontWeight = "600";
    title.style.marginBottom = "6px";
    container.appendChild(title);

    // Profile dropdown
    const row0 = document.createElement("div");
    row0.style.display = "flex";
    row0.style.gap = "8px";
    row0.style.alignItems = "center";
    row0.style.marginBottom = "8px";

    const sel = document.createElement("select");
    sel.style.flex = "1";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Apply resist profile…";
    sel.appendChild(opt0);
    for (const p of profiles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", async () => {
      const id = sel.value;
      const p = profiles.find(x => x.id === id);
      if (!p) return;
      await applyProfile(actor, p);
      sel.value = "";
      try { app.render(false); } catch (e) {}
    });

    row0.appendChild(sel);
    container.appendChild(row0);

    // Grid inputs
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 1fr)";
    grid.style.gap = "6px";

    for (const k of RESIST_KEYS) {
      const cell = document.createElement("label");
      cell.style.display = "flex";
      cell.style.gap = "6px";
      cell.style.alignItems = "center";
      cell.style.justifyContent = "space-between";

      const lab = document.createElement("span");
      lab.textContent = k[0].toUpperCase() + k.slice(1);
      lab.style.opacity = "0.9";

      const inp = document.createElement("input");
      inp.type = "number";
      inp.min = "0";
      inp.max = "300";
      inp.step = "5";
      inp.value = String(resists[k] ?? 0);
      inp.style.width = "70px";
      inp.addEventListener("change", async () => {
        await setActorResist(actor, k, inp.value);
      });

      cell.appendChild(lab);
      cell.appendChild(inp);
      grid.appendChild(cell);
    }

    container.appendChild(grid);

    // Insert into sheet: after attributes block if present, else at end
    const target = html[0].querySelector(".tab.details") || html[0].querySelector(".sheet-body") || html[0];
    target.appendChild(container);
  } catch (e) {}
});

Hooks.on("renderTokenHUD", (app, html, data) => {
  try {
    if (!game.user.isGM) return;
    const token = canvas?.tokens?.get(data?._id) ?? app?.object;
    const actor = token?.actor;
    if (!actor || actor.type !== "npc") return;

    const res = getActorResists(actor);

    // Try to match a known profile (exact match on provided keys)
    const profiles = (game.eq5e?.resistProfiles ?? []);
    let profName = "";
    for (const p of profiles) {
      const vals = p.values ?? {};
      let ok = true;
      for (const k of Object.keys(vals)) {
        if (Number(res[k] ?? 0) !== Number(vals[k])) { ok = false; break; }
      }
      if (ok && Object.keys(vals).length) { profName = p.name; break; }
    }

    const pill = document.createElement("div");
    pill.className = "eq5e-resist-hud-pill";
    pill.style.position = "absolute";
    pill.style.left = "50%";
    pill.style.bottom = "-8px";
    pill.style.transform = "translateX(-50%)";
    pill.style.padding = "2px 6px";
    pill.style.borderRadius = "10px";
    pill.style.border = "1px solid rgba(255,255,255,0.20)";
    pill.style.background = "rgba(0,0,0,0.55)";
    pill.style.backdropFilter = "blur(2px)";
    pill.style.fontSize = "11px";
    pill.style.whiteSpace = "nowrap";
    pill.style.pointerEvents = "none";
    pill.style.opacity = "0.95";

    const short = `F${res.fire} C${res.cold} E${res.electric} M${res.magic} P${res.poison} D${res.disease}`;
    pill.textContent = profName ? `${profName} · ${short}` : short;

    html[0].style.position = "relative";
    html[0].appendChild(pill);
  } catch (e) {}
});
