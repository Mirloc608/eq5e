// EQ5e Pet Control UI (Token HUD buttons + optional context menu)
// Uses game.eq5e.api.setPetStance / setPetAIState

const CONDITION_ICON = {
  silenced: { icon: "fa-comment-slash", label: "Silenced" },
  mezzed:   { icon: "fa-wand-magic-sparkles", label: "Mezzed" },
  rooted:   { icon: "fa-anchor", label: "Rooted" },
  snared:   { icon: "fa-shoe-prints", label: "Snared" }
};

const STANCES = [
  { id: "assist", label: "Assist", icon: "fa-hand-fist" },
  { id: "guard", label: "Guard", icon: "fa-shield-halved" },
  { id: "passive", label: "Passive", icon: "fa-hand" }
];

function isPetActor(actor) {
  return !!actor?.flags?.eq5e?.pet?.ownerUuid;
}

function canControlPet(user, actor) {
  if (!user || !actor) return false;
  // Owner of pet OR owner of the pet's owner
  if (actor.testUserPermission(user, "OWNER")) return true;
  const ownerUuid = actor?.flags?.eq5e?.pet?.ownerUuid;
  if (ownerUuid) {
    const owner = fromUuidSync(ownerUuid);
    if (owner?.documentName === "Actor" && owner.testUserPermission(user, "OWNER")) return true;
  }
  return false;
}

function fromUuidSync(uuid) {
  try {
    return fromUuid(uuid);
  } catch (e) {
    return null;
  }
}

function activeConditions(actor) {
  const conds = actor?.flags?.eq5e?.conditions ?? {};
  const active = [];
  for (const [id, data] of Object.entries(conds)) {
    if (data?.active) active.push(id);
  }
  // Stable ordering
  return active.sort();
}

function currentStance(actor) {

  const ai = actor?.flags?.eq5e?.ai ?? {};
  const mode = String(ai.mode ?? "assist");
  const enabled = ai.enabled !== false;
  if (!enabled || mode === "passive") return "passive";
  if (mode === "guard") return "guard";
  if (mode === "autonomous") return "autonomous";
  return "assist";
}

function _getPetOwnerUuid(petActor) {
  return petActor?.flags?.eq5e?.summon?.ownerUuid ?? petActor?.flags?.eq5e?.pet?.ownerUuid ?? null;
}

async function openPetConfigDialog(petActor) {
  const ownerUuid = _getPetOwnerUuid(petActor);
  if (!ownerUuid) {
    ui.notifications?.warn("Pet has no owner link.");
    return;
  }
  const owner = await fromUuid(ownerUuid);
  if (!owner) return;

  // Only owners (or GM) can configure
  const can = owner.testUserPermission(game.user, "OWNER") || game.user.isGM;
  if (!can) {
    ui.notifications?.warn("You don't have permission to configure this pet.");
    return;
  }

  const ai = petActor?.flags?.eq5e?.ai ?? {};
  const pet = petActor?.flags?.eq5e?.pet ?? {};
  const curName = petActor.name ?? "Pet";

  const content = `
  <form class="eq5e-pet-config">
    <div class="form-group">
      <label>Pet Name</label>
      <input type="text" name="petName" value="${foundry.utils.escapeHTML(curName)}"/>
    </div>

    <div class="form-group">
      <label>AI Enabled</label>
      <input type="checkbox" name="enabled" ${ai.enabled === false ? "" : "checked"}/>
    </div>

    <div class="form-group">
      <label>Stance</label>
      <select name="stance">
        ${["assist","guard","passive"].map(s => `<option value="${s}" ${String(ai.stance ?? ai.mode ?? "assist")===s?"selected":""}>${s}</option>`).join("")}
      </select>
    </div>

    <div class="form-group">
      <label>Follow Distance (ft)</label>
      <input type="number" name="followDistance" min="0" max="120" step="5" value="${Number(ai.followDistance ?? 15)}"/>
    </div>

    <div class="form-group">
      <label>Auto Taunt</label>
      <input type="checkbox" name="autoTaunt" ${ai.autoTaunt ? "checked" : ""}/>
    </div>

    <div class="form-group">
      <label>Rotation Profile</label>
      <select name="rotationProfile">
        ${["default","tank","dps","caster"].map(p => `<option value="${p}" ${String(ai.rotationProfile ?? "default")===p?"selected":""}>${p}</option>`).join("")}
      </select>
    </div>

    <p class="notes">Changes are applied via the EQ5E socket authorization flow: players control their own pets without needing GM clicks, and the GM receives status cues.</p>
  </form>`;

  new Dialog({
    title: "Pet Configuration",
    content,
    buttons: {
      save: {
        label: "Save",
        callback: async (html) => {
          const form = html[0].querySelector("form.eq5e-pet-config");
          const fd = new FormData(form);
          const newName = String(fd.get("petName") ?? "").trim();

          const enabled = form.querySelector('input[name="enabled"]').checked;
          const stance = String(fd.get("stance") ?? "assist");
          const followDistance = Number(fd.get("followDistance") ?? 15);
          const autoTaunt = form.querySelector('input[name="autoTaunt"]').checked;
          const rotationProfile = String(fd.get("rotationProfile") ?? "default");

          // Apply config (GM will apply if needed)
          await game.eq5e?.api?.updatePetConfig?.({
            ownerUuid,
            petUuid: petActor.uuid,
            summonId: petActor?.flags?.eq5e?.summon?.summonId ?? null,
            summonType: petActor?.flags?.eq5e?.summon?.summonType ?? petActor?.flags?.eq5e?.pet?.family ?? null,
            changes: {
              "ai.enabled": enabled,
              "ai.stance": stance,
              "ai.followDistance": followDistance,
              "ai.autoTaunt": autoTaunt,
              "ai.rotationProfile": rotationProfile
            }
          });

          // Rename if changed
          if (newName && newName !== curName) {
            await game.eq5e?.api?.renamePet?.({
              ownerUuid,
              petUuid: petActor.uuid,
              summonId: petActor?.flags?.eq5e?.summon?.summonId ?? null,
              summonType: petActor?.flags?.eq5e?.summon?.summonType ?? null,
              newName
            });
          }

          ui.notifications?.info("Pet update requested.");
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "save"
  }).render(true);
}



async function openPetRenameDialog(petActor) {
  const ownerUuid = _getPetOwnerUuid(petActor);
  if (!ownerUuid) {
    ui.notifications?.warn("Pet has no owner link.");
    return;
  }
  const owner = await fromUuid(ownerUuid);
  if (!owner) return;

  const can = owner.testUserPermission(game.user, "OWNER") || game.user.isGM;
  if (!can) {
    ui.notifications?.warn("You don't have permission to rename this pet.");
    return;
  }

  const cur = petActor.name ?? "Pet";
  const content = `
    <form class="eq5e-pet-rename">
      <div class="form-group">
        <label>New Pet Name</label>
        <input type="text" name="name" value="${foundry.utils.escapeHTML(cur)}"/>
      </div>
      <p class="notes">Rename is applied through the EQ5E socket authorization flow (no GM clicks).</p>
    </form>`;

  new Dialog({
    title: "Rename Pet",
    content,
    buttons: {
      ok: {
        label: "Rename",
        callback: async (html) => {
          const fd = new FormData(html[0].querySelector("form.eq5e-pet-rename"));
          const nm = String(fd.get("name") ?? "").trim();
          if (!nm) return;

          const summon = petActor?.flags?.eq5e?.summon ?? {};
          await game.eq5e?.api?.renamePet?.({
            ownerUuid,
            petUuid: petActor.uuid,
            summonId: summon.summonId ?? null,
            summonType: summon.summonType ?? null,
            newName: nm
          });
          ui.notifications?.info("Pet rename requested.");
        }
      },
      cancel: { label: "Cancel" }
    },
    default: "ok"
  }).render(true);
}


function computeBlockReason(actor, token) {
  // HUD-only heuristic based on shared condition flags + stance + simple range checks.
  // This does NOT change mechanics; it just explains likely blockers.
  const ai = actor?.flags?.eq5e?.ai ?? {};
  const stance = currentStance(actor);
  const conds = new Set(activeConditions(actor));

  if (stance === "passive") return { kind: "blocked", text: "Blocked: Passive" };
  if (conds.has("mezzed")) return { kind: "blocked", text: "Blocked: Mez" };

  // Silence blocks casting, not necessarily melee.
  const allowSpells = ai.allowSpells !== false; // default true-ish for casters
  if (conds.has("silenced") && allowSpells) return { kind: "limited", text: "Casting blocked: Silence" };

  // Movement blocker: rooted + out of melee range of current target
  // Target resolution order (best-effort):
  // 1) actor.flags.eq5e.ai.targetTokenId (scene token id)
  // 2) actor.flags.eq5e.ai.targetUuid (TokenDocument/Actor UUID)
  const rooted = conds.has("rooted");
  const targetTokenId = ai.targetTokenId;
  const targetUuid = ai.targetUuid;

  let targetToken = null;
  if (targetTokenId && canvas?.tokens) targetToken = canvas.tokens.get(targetTokenId) ?? null;

  if (!targetToken && targetUuid) {
    // Try resolve UUID; if actor UUID, find a placed token for it
    try {
      const doc = fromUuidSync(targetUuid);
      if (doc?.documentName === "Token") {
        targetToken = canvas.tokens?.get(doc.id) ?? null;
      } else if (doc?.documentName === "Actor") {
        targetToken = canvas.tokens?.placeables?.find(t => t.actor?.id === doc.id) ?? null;
      }
    } catch (e) {}
  }

  if (rooted && token && targetToken) {
    const meleeRangeFt = Number(ai.meleeRangeFt ?? actor?.flags?.eq5e?.combat?.meleeRangeFt ?? 5);
    const dist = canvas.grid.measureDistance(token.center, targetToken.center);
    if (Number.isFinite(dist) && dist > meleeRangeFt) {
      return { kind: "blocked", text: "Blocked: Rooted (out of range)" };
    }


// Non-blocking hint: out of melee range and not rooted -> pet should be moving in.
if (!rooted && token && targetToken) {
  const meleeRangeFt = Number(ai.meleeRangeFt ?? actor?.flags?.eq5e?.combat?.meleeRangeFt ?? 5);
  const dist = canvas.grid.measureDistance(token.center, targetToken.center);
  if (Number.isFinite(dist) && dist > meleeRangeFt) {
    return { kind: "hint", text: "Closing range…" };
  }
}
  }

  return null;
}

async function setStance(actor, stance) {
  if (!actor) return;
  await game.eq5e.api.setPetStance({ petUuid: actor.uuid, stance });
}

function renderHUDButtons(app, html, data) {
  try {
    const token = canvas.tokens?.get(data._id);
    const actor = token?.actor;
    if (!token || !actor) return;
    if (!isPetActor(actor)) return;
    if (!canControlPet(game.user, actor)) return;

    // Add a tiny row at the bottom center of HUD
    const hud = html[0];
    const existing = hud.querySelector(".eq5e-pet-controls");
    if (existing) existing.remove();

    const stanceNow = currentStance(actor);

    const wrap = document.createElement("div");

    // Status pill: stance + key conditions
    const pill = document.createElement("div");
    pill.className = "eq5e-pet-status";
    pill.style.display = "flex";
    pill.style.alignItems = "center";
    pill.style.gap = "6px";
    pill.style.marginBottom = "4px";
    pill.style.padding = "2px 6px";
    pill.style.borderRadius = "999px";
    pill.style.background = "rgba(0,0,0,0.55)";
    pill.style.border = "1px solid rgba(255,255,255,0.18)";
    pill.style.pointerEvents = "none";

    const stanceLabel = document.createElement("span");
    stanceLabel.className = "eq5e-pet-stance";
    stanceLabel.textContent = `Pet: ${stanceNow.charAt(0).toUpperCase()}${stanceNow.slice(1)}`;
    stanceLabel.style.fontSize = "12px";
    stanceLabel.style.whiteSpace = "nowrap";
    pill.appendChild(stanceLabel);

    const block = computeBlockReason(actor, token);
    if (block) {
      const b = document.createElement("span");
      b.className = "eq5e-pet-block";
      b.textContent = block.text;
      b.style.fontSize = "12px";
      b.style.opacity = "0.95";
      b.style.padding = "0 4px";
      b.style.borderRadius = "999px";
      b.style.border = "1px solid rgba(255,255,255,0.18)";
      b.style.background = (block.kind === "blocked") ? "rgba(200,0,0,0.18)" : (block.kind === "hint") ? "rgba(0,120,255,0.14)" : "rgba(255,200,0,0.14)";
      pill.appendChild(b);
    }

    const condWrap = document.createElement("span");
    condWrap.className = "eq5e-pet-cond";
    condWrap.style.display = "inline-flex";
    condWrap.style.gap = "6px";

    const conds = activeConditions(actor);
    for (const cid of conds) {
      const def = CONDITION_ICON[cid];
      if (!def) continue;
      const i = document.createElement("i");
      i.className = `fa-solid ${def.icon}`;
      i.title = def.label;
      i.style.fontSize = "12px";
      condWrap.appendChild(i);
    }
    if (condWrap.childNodes.length) pill.appendChild(condWrap);

    wrap.className = "eq5e-pet-controls";
    wrap.style.position = "absolute";
    wrap.style.left = "50%";
    wrap.style.transform = "translateX(-50%)";
    wrap.style.bottom = "-4px";
    wrap.style.display = "flex";
    wrap.style.gap = "4px";
    wrap.style.padding = "2px 4px";
    wrap.style.borderRadius = "6px";
    wrap.style.background = "rgba(0,0,0,0.55)";
    wrap.style.backdropFilter = "blur(2px)";
    wrap.style.pointerEvents = "auto";

    for (const s of STANCES) {
      const btn = document.createElement("a");
      btn.className = "control-icon";
      btn.title = `Pet: ${s.label}`;
      btn.style.width = "28px";
      btn.style.height = "28px";
      btn.style.display = "flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.borderRadius = "6px";
      btn.style.border = (stanceNow === s.id) ? "1px solid rgba(255,255,255,0.85)" : "1px solid rgba(255,255,255,0.2)";
      btn.style.background = (stanceNow === s.id) ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.0)";
      btn.innerHTML = `<i class="fa-solid ${s.icon}"></i>`;
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await setStance(actor, s.id);
      });
      wrap.appendChild(btn);
    }

    hud.appendChild(pill);
    hud.appendChild(wrap);
  } catch (e) {
    console.error("[EQ5E] Pet HUD render error", e);
  }
}

function registerTokenHUD() {
  Hooks.on("renderTokenHUD", renderHUDButtons);
}

// Optional: token context menu in the sidebar directory (Actors) is different; token right-click menu is not a standard hook across versions.
// We'll support the common hook if present, but HUD buttons are the primary UI.
function registerTokenHUDButtonsHook() {
  // Foundry provides this hook in some versions/systems:
  Hooks.on("getTokenHUDButtons", (hud, buttons) => {
    try {
      const token = hud?.object;
      const actor = token?.actor;
      if (!actor || !isPetActor(actor)) return;

      if (!canControlPet(game.user, actor)) return;

      const stanceNow = currentStance(actor);
      const group = buttons.find(b => b.name === "left") ?? buttons[0];
      const extra = STANCES.map(s => ({
        icon: `fa-solid ${s.icon}`,
        label: `Pet: ${s.label}`,
        callback: () => setStance(actor, s.id),
        active: stanceNow === s.id
      }));

      // Push into left group if structure matches; otherwise append raw
      if (group?.controls) group.controls.push(...extra);
    } catch (e) {
      console.warn("[EQ5E] getTokenHUDButtons hook error", e);
    }
  });
}

export function registerPetControlUI() {
  registerTokenHUD();
  registerTokenHUDButtonsHook();
  console.log("[EQ5E] Pet Control UI registered");
}
