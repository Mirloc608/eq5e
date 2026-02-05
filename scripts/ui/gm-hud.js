/**
 * EQ5e GM HUD (v13)
 * Minimal, safe implementation to avoid hard failures during beta.
 * Provides a small pop-out dialog summarizing PCs/NPCs and exposing a hook point
 * for future AI assistant integrations (without bundling an AI component here).
 */

function _actorHP(actor) {
  const hp = actor?.system?.attributes?.hp ?? {};
  return { v: Number(hp.value ?? 0), m: Number(hp.max ?? 0) };
}

function _actorMana(actor) {
  const mana = actor?.system?.attributes?.mana ?? {};
  return { v: Number(mana.value ?? 0), m: Number(mana.max ?? 0) };
}

function _conds(actor) {
  const c = actor?.flags?.eq5e?.conditions ?? {};
  return Object.entries(c).filter(([_, v]) => !!v).map(([k]) => k);
}

function _escape(s="") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function _pcRows() {
  const tokens = canvas?.tokens?.placeables ?? [];
  const actors = tokens.map(t => t.actor).filter(a => a?.hasPlayerOwner);
  return actors.map(a => {
    const hp = _actorHP(a);
    const mana = _actorMana(a);
    const conds = _conds(a);
    return {
      name: a.name,
      hp: `${hp.v}/${hp.m}`,
      mana: mana.m ? `${mana.v}/${mana.m}` : "—",
      conds: conds.length ? conds.join(", ") : "—"
    };
  });
}

function _npcRows() {
  const tokens = canvas?.tokens?.placeables ?? [];
  const actors = tokens.map(t => t.actor).filter(a => a?.type === "npc");
  return actors.map(a => {
    const hp = _actorHP(a);
    return { name: a.name, hp: `${hp.v}/${hp.m}` };
  });
}

function _buildHTML() {
  const pcs = _pcRows();
  const npcs = _npcRows();

  const pcHtml = pcs.length ? pcs.map(r => `
    <tr><td>${_escape(r.name)}</td><td>${_escape(r.hp)}</td><td>${_escape(r.mana)}</td><td>${_escape(r.conds)}</td></tr>
  `).join("") : `<tr><td colspan="4" style="opacity:0.7">No player-owned tokens on scene.</td></tr>`;

  const npcHtml = npcs.length ? npcs.map(r => `
    <tr><td>${_escape(r.name)}</td><td>${_escape(r.hp)}</td></tr>
  `).join("") : `<tr><td colspan="2" style="opacity:0.7">No NPC tokens on scene.</td></tr>`;

  return `
  <div class="eq5e-gm-hud" style="display:flex;flex-direction:column;gap:10px;">
    <div style="font-size:12px;opacity:0.85">
      Tip: This HUD is intentionally lightweight. Future passes can add threat/parse panes and AI-assist hooks without destabilizing core.
    </div>

    <h3 style="margin:0">Players</h3>
    <table style="width:100%;font-size:12px">
      <thead><tr><th align="left">Name</th><th align="left">HP</th><th align="left">Mana</th><th align="left">Conditions</th></tr></thead>
      <tbody>${pcHtml}</tbody>
    </table>

    <h3 style="margin:0">NPCs</h3>
    <table style="width:100%;font-size:12px">
      <thead><tr><th align="left">Name</th><th align="left">HP</th></tr></thead>
      <tbody>${npcHtml}</tbody>
    </table>

    <hr/>

    <div style="font-size:12px;opacity:0.9">
      Reserved: <b>AI Assistant</b> pane (external module) can hook into <code>Hooks.on("eq5e.gmHudRender")</code>.
    </div>
  </div>`;
}

export function openEQ5eGMHUD() {
  if (!game.user?.isGM) return ui.notifications?.warn?.("GM only.");
  Hooks.callAll("eq5e.gmHudRender"); // integration point
  new Dialog({
    title: "EQ5e GM HUD",
    content: _buildHTML(),
    buttons: {
      refresh: { label: "Refresh", callback: () => openEQ5eGMHUD() },
      close: { label: "Close" }
    },
    default: "close"
  }, { width: 520 }).render(true);
}

export function registerEQ5eGMHUD() {
  Hooks.once("ready", () => {
    // Expose API + add a simple controls button for GMs.
    game.eq5e = game.eq5e || {};
    game.eq5e.api = game.eq5e.api || {};
    game.eq5e.api.openGMHUD = openEQ5eGMHUD;

    if (!game.user?.isGM) return;
    Hooks.on("getSceneControlButtons", (controls) => {
      const tokenTools = controls.find(c => c.name === "token");
      if (!tokenTools) return;
      tokenTools.tools.push({
        name: "eq5e-gm-hud",
        title: "EQ5e GM HUD",
        icon: "fas fa-helmet-battle",
        visible: game.user.isGM,
        onClick: () => openEQ5eGMHUD(),
        button: true
      });
    });
  });
}

registerEQ5eGMHUD();
