/**
 * EQ5e Setup Wizard (v13)
 * Minimal stable wizard that can import core packs and set missing class/race flags.
 * This is intentionally conservative to avoid blocking world load.
 */

function _escape(s="") {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

async function _safeLoadPack(packId) {
  try {
    const pack = game.packs.get(packId);
    if (!pack) return null;
    await pack.getIndex();
    return pack;
  } catch (e) { return null; }
}

async function _importPackToWorld(packId, worldPackId) {
  const src = await _safeLoadPack(packId);
  if (!src) throw new Error(`Missing pack: ${packId}`);

  // Ensure world pack exists (best-effort). If it doesn't, just import into world by creating documents.
  const docs = await src.getDocuments();
  let created = 0;
  for (const d of docs) {
    try {
      const data = d.toObject();
      delete data._id;
      await d.documentName?.create ? null : null;
      // Create in world (directory) for its document type
      const cls = CONFIG[d.documentName]?.documentClass;
      if (cls?.create) { await cls.create(data, { keepId: false }); created++; }
    } catch (e) { /* ignore duplicates */ }
  }
  return created;
}

function _actorRows() {
  const actors = game.actors?.contents ?? [];
  return actors
    .filter(a => a.type === "character")
    .map(a => {
      const cls = String(a.flags?.eq5e?.classId ?? a.flags?.eq5e?.class?.id ?? "");
      const race = String(a.flags?.eq5e?.raceId ?? a.flags?.eq5e?.race?.id ?? "");
      return { id: a.id, name: a.name, cls, race };
    });
}

async function _applyActorFlags(actorId, { classId, raceId } = {}) {
  const a = game.actors.get(actorId);
  if (!a) return;
  const updates = {};
  if (classId !== undefined) updates["flags.eq5e.classId"] = classId || null;
  if (raceId !== undefined) updates["flags.eq5e.raceId"] = raceId || null;
  await a.update(updates);
}

function _classOptions() {
  // Keep conservative: known core IDs. If packs add more, they can extend via hook.
  const opts = [
    "", "warrior","paladin","shadowknight","cleric","druid","shaman","bard","wizard","magician",
    "enchanter","necromancer","ranger","rogue","monk","berserker","beastlord"
  ];
  Hooks.callAll("eq5e.setupWizardClassOptions", opts);
  return opts;
}

function _raceOptions() {
  // Classic baseline; extend via hook.
  const opts = ["","human","barbarian","erudite","high-elf","wood-elf","dark-elf","dwarf","halfling","gnome",
    "ogre","troll","iksar","vah-shir","froglok","drakkin"];
  Hooks.callAll("eq5e.setupWizardRaceOptions", opts);
  return opts;
}

function _buildHTML() {
  const rows = _actorRows();
  const classOpts = _classOptions();
  const raceOpts = _raceOptions();

  const rowHtml = rows.length ? rows.map(r => {
    const cSel = classOpts.map(o => `<option value="${_escape(o)}" ${o===r.cls?"selected":""}>${_escape(o || "—")}</option>`).join("");
    const rSel = raceOpts.map(o => `<option value="${_escape(o)}" ${o===r.race?"selected":""}>${_escape(o || "—")}</option>`).join("");
    return `
      <tr data-actor-id="${_escape(r.id)}">
        <td>${_escape(r.name)}</td>
        <td><select class="eq5e-sw-class" style="width:160px">${cSel}</select></td>
        <td><select class="eq5e-sw-race" style="width:160px">${rSel}</select></td>
        <td><button type="button" class="eq5e-sw-apply">Apply</button></td>
      </tr>`;
  }).join("") : `<tr><td colspan="4" style="opacity:0.7">No character actors found.</td></tr>`;

  return `
  <div class="eq5e-setup-wizard" style="display:flex;flex-direction:column;gap:10px;">
    <div style="opacity:0.85;font-size:12px">
      Use this to sanity-check core EQ5e data in a new world. This wizard is safe and won't hard-fail if packs are missing.
    </div>

    <h3 style="margin:0">Actor Flags</h3>
    <table style="width:100%;font-size:12px">
      <thead><tr><th align="left">Actor</th><th align="left">Class Id</th><th align="left">Race Id</th><th></th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>

    <hr/>

    <h3 style="margin:0">Core Imports (optional)</h3>
    <div style="display:flex;flex-direction:column;gap:6px;font-size:12px">
      <button type="button" class="eq5e-sw-import" data-pack="eq5e.eq5e-core-conditions">Import Conditions</button>
      <button type="button" class="eq5e-sw-import" data-pack="eq5e.eq5e-aa-definitions">Import AA Definitions</button>
      <button type="button" class="eq5e-sw-import" data-pack="eq5e.eq5e-items-core">Import Core Items</button>
    </div>
  </div>`;
}

export function openEQ5eSetupWizard() {
  const dlg = new Dialog({
    title: "EQ5e Setup Wizard",
    content: _buildHTML(),
    buttons: { close: { label: "Close" } },
    default: "close",
    render: (html) => {
      html[0].querySelectorAll(".eq5e-sw-apply").forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          const tr = ev.currentTarget.closest("tr");
          const actorId = tr?.dataset?.actorId;
          const classId = tr.querySelector(".eq5e-sw-class")?.value ?? "";
          const raceId = tr.querySelector(".eq5e-sw-race")?.value ?? "";
          await _applyActorFlags(actorId, { classId, raceId });
          ui.notifications?.info?.("Updated actor flags.");
        });
      });

      html[0].querySelectorAll(".eq5e-sw-import").forEach(btn => {
        btn.addEventListener("click", async (ev) => {
          const packId = ev.currentTarget?.dataset?.pack;
          if (!packId) return;
          try {
            const count = await _importPackToWorld(packId);
            ui.notifications?.info?.(`Imported ${count} entries from ${packId}.`);
          } catch (e) {
            console.error(e);
            ui.notifications?.error?.(`Import failed: ${e?.message ?? e}`);
          }
        });
      });
    }
  }, { width: 720 });

  dlg.render(true);
}

export function registerEQ5eSetupWizard() {
  Hooks.once("ready", () => {
    game.eq5e = game.eq5e || {};
    game.eq5e.api = game.eq5e.api || {};
    game.eq5e.api.openSetupWizard = openEQ5eSetupWizard;

    // Add a settings button for GMs.
    if (!game.user?.isGM) return;
    game.settings.register("eq5e", "openSetupWizard", {
      name: "Open EQ5e Setup Wizard",
      hint: "Click to open the setup wizard for importing core packs and fixing actor flags.",
      scope: "client",
      config: true,
      type: Boolean,
      default: false,
      onChange: (v) => { if (v) { openEQ5eSetupWizard(); game.settings.set("eq5e","openSetupWizard", false); } }
    });
  });
}
