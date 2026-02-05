import { getRewardLog, popRewardLog, undoRewardEntry, undoRewardLogUntil } from "./aa-reward-log.js";

function formatLocalDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const locale = game.i18n.lang || undefined;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(d);
  } catch { return iso; }
}

function compactEntrySummary(entry) {
  const r = entry?.rewards;
  if (!r) return "";
  const parts = [];
  if (r.aa?.points) parts.push(`AA +${r.aa.points}`);
  if (r.xp?.amount) parts.push(`XP +${r.xp.amount}`);
  const itemsCfg = (r.items ?? []).length;
  const itemsCreated = (entry?.applied?.itemsCreated ?? []).length;
  if (itemsCfg || itemsCreated) {
    if (itemsCfg) parts.push(`Items(cfg)×${itemsCfg}`);
    if (itemsCreated) parts.push(`Items(created)×${itemsCreated}`);
  }
  const unlocks = (r.unlocks?.spells?.length ?? 0) + (r.unlocks?.recipes?.length ?? 0) + (r.unlocks?.features?.length ?? 0);
  if (unlocks) parts.push(`Unlocks×${unlocks}`);
  const enh = (r.enhancements ?? []).length;
  if (enh) parts.push(`Enh×${enh}`);
  return parts.join(", ");
}

function compactEntryTooltip(entry) {
  const r = entry?.rewards;
  if (!r) return "No reward payload.";
  const lines = [];
  const who = entry?.userName ?? entry?.userId ?? "Unknown";
  const whenRaw = entry?.ts ?? "";
  const when = formatLocalDateTime(whenRaw);
  const mode = entry?.automationMode ?? r?.meta?.automation ?? "";
  lines.push(`Source: ${entry?.sourceLabel ?? "Quest Rewards"}`);
  if (when) lines.push(`When: ${when} (${whenRaw})`);
  if (who) lines.push(`By: ${who}`);
  if (mode) lines.push(`Mode: ${mode}`);
  if (r.aa?.points) lines.push(`AA: +${r.aa.points}`);
  if (r.xp?.amount) lines.push(`XP: +${r.xp.amount}`);
  const created = (entry?.applied?.itemsCreated ?? []);
  if (created.length) lines.push(`Items(created): ${created.map(i => i.itemName).slice(0,12).join(", ")}${created.length>12?" …":""}`);
  return lines.join("\n");
}

export class EQ5ERewardLogApp extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "eq5e-reward-log",
    tag: "section",
    window: { title: "EQ5e: Reward Log", icon: "fa-solid fa-clock-rotate-left", resizable: true },
    position: { width: 720, height: 720 },
    actions: {
      "undo-entry": EQ5ERewardLogApp.#onUndoEntry,
      "toggle-force": EQ5ERewardLogApp.#onToggleForce
    }
  };

  static PARTS = { content: { template: `systems/${game.system?.id || "eq5e"}/modules/aa/templates/aa/reward-log.hbs` } };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.force = false;
  }

  _onAttach() {
    super._onAttach();
    this._boundOnUpdate = (doc) => { if (doc?.uuid === this.actor?.uuid) this.render({ force: true }); };
    Hooks.on("updateActor", this._boundOnUpdate);
  }

  _onDetach() {
    Hooks.off("updateActor", this._boundOnUpdate);
    super._onDetach();
  }

  async _prepareContext() {
    const log = getRewardLog(this.actor) ?? [];
    const newestIndex = log.length - 1;

    const entries = [...log].reverse().map((e) => {
      const originalIndex = log.findIndex(x => x?.id === e?.id);
      const newerCount = originalIndex >= 0 ? (newestIndex - originalIndex) : 0;
      const rewindCount = newerCount + 1;

      const sum = compactEntrySummary(e);
      const tip = compactEntryTooltip(e);

      return {
        ...e,
        tsLocal: formatLocalDateTime(e?.ts),
        summaryText: sum,
        summaryTooltip: foundry.utils.escapeHTML(tip),
        isLatest: originalIndex === newestIndex,
        rewindCount
      };
    });

    return { actor: this.actor, isGM: game.user.isGM, force: this.force, entries };
  }

  static async #onToggleForce(event, target) {
    const app = this;
    if (!game.user.isGM) return;
    app.force = !!target.checked;
    app.render({ force: true });
  }

  static async #onUndoEntry(event, target) {
    const app = this;
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can undo rewards.");
    const entryId = target.dataset.entryId;
    if (!entryId) return;

    const log = getRewardLog(app.actor) ?? [];
    const idx = log.findIndex(e => e?.id === entryId);
    if (idx === -1) return ui.notifications.warn("Entry not found.");

    const isLatest = idx === (log.length - 1);
    if (!isLatest && !app.force) return ui.notifications.warn("Only latest can be undone (enable Force for safe rewind).");

    const ok = await Dialog.confirm({
      title: "Undo Reward Entry?",
      content: !isLatest
        ? `<p>Safe Force Mode will rewind and undo newer entries first.</p>`
        : `<p>Undo the latest reward entry?</p>`
    });
    if (!ok) return;

    if (isLatest) {
      const entry = await popRewardLog(app.actor);
      if (!entry) return ui.notifications.warn("No entries to undo.");
      await undoRewardEntry(app.actor, entry);
    } else {
      await undoRewardLogUntil(app.actor, entryId);
    }
    app.render({ force: true });
  }
}


export class RewardLogApp extends Application {
  static get defaultOptions() { return foundry.utils.mergeObject(super.defaultOptions, { title: 'EQ5e Reward Log', width: 640, height: 560, resizable: true }); }
  getData() { return { entries: [] }; }
  async _render(...args) { return super._render(...args); }
}
