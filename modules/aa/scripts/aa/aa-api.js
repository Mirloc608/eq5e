const NS = "eq5e";

export async function grantAAPoints(actor, points) {
  const p = Math.max(0, Math.floor(Number(points ?? 0)));
  if (!p) return;

  const aa = foundry.utils.deepClone(actor.getFlag(NS, "aa") ?? {});
  aa.points ??= { available: 0, spent: 0 };
  aa.ranks ??= {};
  aa.points.available = Math.max(0, Math.floor(Number(aa.points.available ?? 0))) + p;

  await actor.setFlag(NS, "aa", aa);
}

export function getAAState(actor) {
  const aa = foundry.utils.deepClone(actor.getFlag(NS, "aa") ?? {});
  aa.points ??= { available: 0, spent: 0 };
  aa.ranks ??= {};
  return aa;
}

export async function setAAState(actor, aa) {
  await actor.setFlag(NS, "aa", aa);
}
