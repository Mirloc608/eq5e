/**
 * EQ5E Silhouettes + Sheet Animations (V13)
 * - Purely enhances the sheet DOM.
 * - Detects which tab is active (character/paperdoll/mount/pet) and swaps silhouette.
 *
 * Expected HTML hook points (safe if missing):
 * - .eq5e-doll-silhouette-img (img)
 * - sheet root has .eq5e-sheet (or app element)
 */

const MARK = "EQ5E_SILHOUETTE_ANIM_V1";

function _silhouettePath(kind, key) {
  // kind: 'mount' | 'pet' | 'character'
  const base = "systems/eq5e/assets/ui/silhouettes";
  if (kind === "mount") {
    const era = String(key || "classic").toLowerCase();
    const fn = ["classic","kunark","velious","luclin","pop"].includes(era) ? `mount_${era}.svg` : "mount_classic.svg";
    return `${base}/${fn}`;
  }
  if (kind === "pet") {
    const t = String(key || "wolf").toLowerCase();
    const fn = ({ wolf:"pet_wolf.svg", bear:"pet_bear.svg", elemental:"pet_elemental.svg" }[t]) || "pet_wolf.svg";
    return `${base}/${fn}`;
  }
  return `${base}/mount_classic.svg`;
}

function _getActiveTab(root) {
  // Foundry toggles .tabs .item.active AND .tab.active depending on framework.
  const navActive = root.querySelector(".tabs [data-tab].active")?.getAttribute("data-tab")
    || root.querySelector("nav.tabs [data-tab].active")?.getAttribute("data-tab");
  if (navActive) return navActive;

  const paneActive = root.querySelector(".tab.active[data-tab]")?.getAttribute("data-tab");
  return paneActive || "character";
}

function _guessMountEra(actor) {
  // Prefer explicit flags, otherwise infer from item name keywords.
  const era = actor?.getFlag?.("eq5e", "mountEra") || actor?.system?.details?.mountEra;
  if (era) return era;

  const mount = actor?.items?.find(i => i?.type === "mount" || i?.flags?.eq5e?.mount);
  const name = String(mount?.name || "").toLowerCase();
  if (/luclin|shissar|vex/.test(name)) return "luclin";
  if (/velious|thurg|kael|skyshrine|wyrm/.test(name)) return "velious";
  if (/kunark|sarnak|iksar|sebilis/.test(name)) return "kunark";
  if (/plane|po[pb]|tranquility|valor|storm|fire/.test(name)) return "pop";
  return "classic";
}

function _guessPetType(actor) {
  const pet = actor?.items?.find(i => i?.type === "pet" || i?.flags?.eq5e?.pet);
  const n = String(pet?.name || "").toLowerCase();
  if (/elemental|fire|water|air|earth/.test(n)) return "elemental";
  if (/bear/.test(n)) return "bear";
  return "wolf";
}

function _applySilhouette(app, html) {
  const root = html?.[0] || html;
  if (!root?.querySelector) return;

  const img = root.querySelector(".eq5e-doll-silhouette-img");
  if (!img) return;

  const actor = app?.document || app?.actor || app?.object;
  const active = _getActiveTab(root);

  let kind = "character";
  let key = "classic";

  // You can name your tabs however you like; this is forgiving.
  if (/mount/.test(active)) {
    kind = "mount";
    key = _guessMountEra(actor);
  } else if (/pet/.test(active)) {
    kind = "pet";
    key = _guessPetType(actor);
  } else {
    // character / paperdoll => show mount-era as a vibe, but you can change this.
    kind = "mount";
    key = _guessMountEra(actor);
  }

  const src = _silhouettePath(kind, key);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);

  // expose state for CSS
  root.setAttribute("data-eq5e-silhouette", `${kind}:${key}`);
}

function _wireDragGlow(app, html) {
  const root = html?.[0] || html;
  if (!root?.querySelector) return;

  // Highlight valid drops: any element with data-eq5e-drop-slot
  root.querySelectorAll("[data-eq5e-drop-slot]").forEach((el) => {
    if (el.dataset.eq5eGlowWired === "1") return;
    el.dataset.eq5eGlowWired = "1";

    el.addEventListener("dragenter", () => el.classList.add("eq5e-drop-hot"));
    el.addEventListener("dragover", () => el.classList.add("eq5e-drop-hot"));
    el.addEventListener("dragleave", () => el.classList.remove("eq5e-drop-hot"));
    el.addEventListener("drop", () => {
      el.classList.remove("eq5e-drop-hot");
      el.classList.add("eq5e-drop-flash");
      setTimeout(() => el.classList.remove("eq5e-drop-flash"), 260);
    });
  });
}

Hooks.on("renderActorSheet", (app, html) => {
  try {
    _applySilhouette(app, html);
    _wireDragGlow(app, html);

    // Re-apply when tabs change
    const root = html?.[0] || html;
    if (!root?.querySelector) return;
    const tabs = root.querySelectorAll(".tabs [data-tab]");
    tabs.forEach((t) => {
      if (t.dataset.eq5eSilWired === "1") return;
      t.dataset.eq5eSilWired = "1";
      t.addEventListener("click", () => setTimeout(() => _applySilhouette(app, html), 0));
    });

    if (!globalThis.EQ5E_SILHOUETTE_ANIM_READY) {
      console.log(`[EQ5E] Silhouette animations installed (${MARK}).`);
      globalThis.EQ5E_SILHOUETTE_ANIM_READY = true;
    }
  } catch (e) {
    console.error("[EQ5E] Silhouette animation hook failed", e);
  }
});
