import { loadAACatalog } from "./aa-catalog.js";
import { getAAState, setAAState } from "./aa-api.js";

const NS = "eq5e";

function clampInt(n) {
  const x = Math.floor(Number(n ?? 0));
  return Number.isFinite(x) ? x : 0;
}

function getActorLevel(actor) {
  const lvl = foundry.utils.getProperty(actor, "system.details.level")
    ?? foundry.utils.getProperty(actor, "system.level")
    ?? foundry.utils.getProperty(actor, "system.attributes.level")
    ?? 1;
  return Math.max(1, clampInt(lvl));
}

function costForNextRank(aaDef, nextRank) {
  const cost = aaDef?.cost ?? { type: "flat", value: 1 };
  if (cost.type === "flat") return clampInt(cost.value ?? 0);
  if (cost.type === "byRank") {
    const arr = cost.values ?? [];
    return clampInt(arr[nextRank - 1] ?? arr[arr.length - 1] ?? 0);
  }
  return 1;
}

function meetsPrereqs(aaState, catalog, aaDef) {
  const prereq = aaDef?.prereq ?? [];
  for (const p of prereq) {
    const need = clampInt(p.rank ?? 1);
    const have = clampInt(aaState?.ranks?.[p.id]?.rank ?? 0);
    if (have < need) return false;
  }
  return true;
}

function formatReq(aaDef) {
  const lvl = aaDef?.requires?.level ?? 1;
  const prereq = aaDef?.prereq ?? [];
  const bits = [];
  if (lvl && lvl > 1) bits.push(`Level ${lvl}+`);
  if (prereq.length) bits.push(`Prereq: ${prereq.map(p => `${p.id} (${p.rank ?? 1})`).join(", ")}`);
  return bits.join(" • ");
}

export class EQ5EAAPurchaseApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: "eq5e-aa-purchase",
    tag: "section",
    window: { title: "EQ5e: Alternate Advancement", icon: "fa-solid fa-diagram-project", resizable: true },
    position: { width: 860, height: 720 },
    actions: {
      "select-aa": EQ5EAAPurchaseApp.#onSelectAA,
      "buy-rank": EQ5EAAPurchaseApp.#onBuyRank,
      "refund-rank": EQ5EAAPurchaseApp.#onRefundRank,
      "set-search": EQ5EAAPurchaseApp.#onSearch,
      "toggle-owned": EQ5EAAPurchaseApp.#onToggleOwned,
      "toggle-available": EQ5EAAPurchaseApp.#onToggleAffordable
    }
  };

  static PARTS = {
    content: { template: `systems/${game.system?.id || "eq5e"}/modules/aa/templates/aa/aa-purchase.hbs` }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.catalog = null;
    this.selectedId = null;
    this.search = "";
    this.filterOwned = false;
    this.filterAffordable = false;
  }

  _onAttach() {
    super._onAttach();
    this._boundOnUpdate = (doc) => {
      if (doc?.uuid === this.actor?.uuid) this.render({ force: true });
    };
    Hooks.on("updateActor", this._boundOnUpdate);
  }

  _onDetach() {
    Hooks.off("updateActor", this._boundOnUpdate);
    super._onDetach();
  }

  async _prepareContext() {
    if (!this.catalog) this.catalog = await loadAACatalog();

    const aa = getAAState(this.actor);
    const level = getActorLevel(this.actor);
    const search = (this.search ?? "").trim().toLowerCase();

    const categories = [];
    for (const cat of (this.catalog.categories ?? [])) {
      const children = [];

      for (const def of (cat.children ?? [])) {
        const rank = clampInt(aa.ranks?.[def.id]?.rank ?? 0);
        const maxRank = clampInt(def.maxRank ?? 1);
        const nextRank = Math.min(maxRank, rank + 1);
        const costNext = rank >= maxRank ? 0 : costForNextRank(def, nextRank);

        const okLevel = level >= clampInt(def?.requires?.level ?? 1);
        const okPrereq = meetsPrereqs(aa, this.catalog, def);
        const canBuy = okLevel && okPrereq && (clampInt(aa.points.available) >= costNext) && rank < maxRank;

        const matchesSearch = !search
          || (def.name ?? "").toLowerCase().includes(search)
          || (def.id ?? "").toLowerCase().includes(search)
          || (def.tags ?? []).some(t => String(t).toLowerCase().includes(search));

        if (!matchesSearch) continue;
        if (this.filterOwned && rank === 0) continue;
        if (this.filterAffordable && !canBuy) continue;

        children.push({
          ...def,
          rank,
          maxRank,
          costNext,
          canBuy,
          locked: !(okLevel && okPrereq),
          reqText: formatReq(def),
          isSelected: def.id === this.selectedId
        });
      }

      if (!children.length) continue;
      categories.push({ id: cat.id, label: cat.label, children });
    }

    const selected = this.selectedId ? this.catalog._byId?.[this.selectedId] : null;
    const selectedRank = selected ? clampInt(aa.ranks?.[selected.id]?.rank ?? 0) : 0;
    const selectedMax = selected ? clampInt(selected.maxRank ?? 1) : 1;
    const selectedNext = selected ? Math.min(selectedMax, selectedRank + 1) : 0;
    const selectedCostNext = selected ? (selectedRank >= selectedMax ? 0 : costForNextRank(selected, selectedNext)) : 0;

    const canBuySelected = selected
      ? (level >= clampInt(selected?.requires?.level ?? 1))
        && meetsPrereqs(aa, this.catalog, selected)
        && clampInt(aa.points.available) >= selectedCostNext
        && selectedRank < selectedMax
      : false;

    const canRefundSelected = game.user.isGM && selected && selectedRank > 0;

    return {
      actor: this.actor,
      aa,
      level,
      categories,
      selected,
      selectedRank,
      selectedCostNext,
      canBuySelected,
      canRefundSelected,
      search: this.search,
      filterOwned: this.filterOwned,
      filterAffordable: this.filterAffordable
    };
  }

  static async #onSelectAA(event, target) {
    const app = this;
    app.selectedId = target.dataset.aaId ?? null;
    app.render({ force: true });
  }

  static async #onSearch(event, target) {
    const app = this;
    app.search = String(target.value ?? "");
    app.render({ force: true });
  }

  static async #onToggleOwned(event, target) {
    const app = this;
    app.filterOwned = !!target.checked;
    app.render({ force: true });
  }

  static async #onToggleAffordable(event, target) {
    const app = this;
    app.filterAffordable = !!target.checked;
    app.render({ force: true });
  }

  static async #onBuyRank(event, target) {
    const app = this;
    const aaId = target.dataset.aaId;
    if (!aaId) return;

    if (!app.catalog) app.catalog = await loadAACatalog();
    const def = app.catalog._byId?.[aaId];
    if (!def) return ui.notifications.warn("AA not found in catalog.");

    const aa = getAAState(app.actor);
    const level = getActorLevel(app.actor);

    const rank = clampInt(aa.ranks?.[aaId]?.rank ?? 0);
    const maxRank = clampInt(def.maxRank ?? 1);
    if (rank >= maxRank) return ui.notifications.warn("Already at max rank.");

    const nextRank = rank + 1;
    const cost = costForNextRank(def, nextRank);

    if (level < clampInt(def?.requires?.level ?? 1)) return ui.notifications.warn("Level requirement not met.");
    if (!meetsPrereqs(aa, app.catalog, def)) return ui.notifications.warn("Prerequisites not met.");
    if (clampInt(aa.points.available) < cost) return ui.notifications.warn("Not enough AA points.");

    aa.points.available = clampInt(aa.points.available) - cost;
    aa.points.spent = clampInt(aa.points.spent) + cost;

    aa.ranks ??= {};
    aa.ranks[aaId] ??= {};
    aa.ranks[aaId].rank = nextRank;
    aa.ranks[aaId].maxRank = maxRank;
    aa.ranks[aaId].lastUpdated = new Date().toISOString();

    // Purchase log (optional)
    const log = foundry.utils.deepClone(app.actor.getFlag(NS, "aaPurchases") ?? []);
    log.push({ ts: new Date().toISOString(), aaId, from: rank, to: nextRank, cost });
    await app.actor.setFlag(NS, "aaPurchases", log.slice(-500));

    await setAAState(app.actor, aa);
    ui.notifications.info(`Purchased ${def.name} rank ${nextRank} (cost ${cost}).`);
  }

  static async #onRefundRank(event, target) {
    const app = this;
    if (!game.user.isGM) return ui.notifications.warn("Only the GM can refund AA ranks.");
    const aaId = target.dataset.aaId;
    if (!aaId) return;

    if (!app.catalog) app.catalog = await loadAACatalog();
    const def = app.catalog._byId?.[aaId];
    if (!def) return ui.notifications.warn("AA not found in catalog.");

    const aa = getAAState(app.actor);
    const rank = clampInt(aa.ranks?.[aaId]?.rank ?? 0);
    if (rank <= 0) return;

    // Refund assumes same cost schedule as purchase for the current rank
    const cost = costForNextRank(def, rank);
    aa.points.available = clampInt(aa.points.available) + cost;
    aa.points.spent = Math.max(0, clampInt(aa.points.spent) - cost);

    const nextRank = rank - 1;
    if (nextRank <= 0) delete aa.ranks[aaId];
    else {
      aa.ranks[aaId].rank = nextRank;
      aa.ranks[aaId].lastUpdated = new Date().toISOString();
    }

    const log = foundry.utils.deepClone(app.actor.getFlag(NS, "aaPurchases") ?? []);
    log.push({ ts: new Date().toISOString(), aaId, from: rank, to: nextRank, cost: -cost, gm: true });
    await app.actor.setFlag(NS, "aaPurchases", log.slice(-500));

    await setAAState(app.actor, aa);
    ui.notifications.info(`Refunded ${def.name} to rank ${nextRank} (refund ${cost}).`);
  }
}
