export function normalizeQuestRewards(raw = {}) {
  const out = foundry.utils.deepClone(raw ?? {});
  out.version ??= 1;

  out.meta ??= {};
  out.meta.targets ??= out.targets ?? "party";
  out.meta.automation ??= out.meta.automation ?? "request";
  out.meta.split ??= out.meta.split ?? "equal";
  out.meta.reason ??= out.meta.reason ?? out.reason ?? "";
  out.meta.label ??= out.meta.label ?? undefined;

  if (typeof out.aa === "number") out.aa = { points: out.aa };
  out.aa ??= {};
  out.aa.points = Math.max(0, Math.floor(Number(out.aa.points ?? 0)));

  out.xp ??= {};
  out.xp.amount = Math.max(0, Math.floor(Number(out.xp.amount ?? 0)));

  out.currency ??= {};
  for (const k of ["pp","gp","sp","cp"]) out.currency[k] = Math.max(0, Math.floor(Number(out.currency[k] ?? 0)));
  out.currency.extras ??= [];

  out.faction = Array.isArray(out.faction) ? out.faction : [];
  out.items = Array.isArray(out.items) ? out.items : [];

  out.unlocks ??= {};
  out.unlocks.spells = Array.isArray(out.unlocks.spells) ? out.unlocks.spells : [];
  out.unlocks.recipes = Array.isArray(out.unlocks.recipes) ? out.unlocks.recipes : [];
  out.unlocks.features = Array.isArray(out.unlocks.features) ? out.unlocks.features : [];

  out.enhancements = Array.isArray(out.enhancements) ? out.enhancements : [];

  return out;
}
