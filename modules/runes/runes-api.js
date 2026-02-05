const NS = "eq5e";

export function getRunesState(item) {
  const runes = foundry.utils.deepClone(item.getFlag(NS, "runes") ?? {});
  runes.slots ??= [];
  return runes;
}
export async function setRunesState(item, runes) {
  await item.setFlag(NS, "runes", runes ?? { slots: [] });
}
export function getInfusionsState(item) {
  return foundry.utils.deepClone(item.getFlag(NS, "infusions") ?? []);
}
export async function setInfusionsState(item, infusions) {
  await item.setFlag(NS, "infusions", infusions ?? []);
}
export function getItemStress(item) {
  return Number(item.getFlag(NS, "itemStress") ?? 0) || 0;
}
export async function setItemStress(item, value) {
  await item.setFlag(NS, "itemStress", Math.max(0, Math.floor(Number(value) || 0)));
}
