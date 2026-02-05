const NS = "eq5e";

function nowISO() { return new Date().toISOString(); }

export function getRewardLog(actor) {
  return foundry.utils.deepClone(actor.getFlag(NS, "rewardLog") ?? []);
}

export async function appendRewardLog(actor, entry) {
  const log = getRewardLog(actor);
  log.push(entry);
  const max = 200;
  const trimmed = log.length > max ? log.slice(log.length - max) : log;
  await actor.setFlag(NS, "rewardLog", trimmed);
}

export async function popRewardLog(actor) {
  const log = getRewardLog(actor);
  const entry = log.pop() ?? null;
  await actor.setFlag(NS, "rewardLog", log);
  return entry;
}

export function makeRewardLogEntry({ sourceLabel, reason, rewards, pageUuid, automationMode, preAA, postAA }) {
  return {
    id: foundry.utils.randomID(16),
    ts: nowISO(),
    userId: game.user?.id ?? null,
    userName: game.user?.name ?? null,
    sourceLabel: sourceLabel ?? "Quest Rewards",
    reason: reason ?? "",
    pageUuid: pageUuid ?? null,
    automationMode: automationMode ?? null,
    rewards,
    pre: { aa: preAA ?? null },
    post: { aa: postAA ?? null },
    applied: { itemsCreated: [] }
  };
}

function clampInt(n) {
  const x = Math.floor(Number(n ?? 0));
  return Number.isFinite(x) ? x : 0;
}

export async function undoRewardEntry(actor, entry) {
  if (!entry?.rewards) throw new Error("Invalid reward log entry.");
  const r = entry.rewards;

  const createdIds = (entry.applied?.itemsCreated ?? []).map(x => x.itemId).filter(Boolean);
  if (createdIds.length) {
    const existing = createdIds.filter(id => actor.items.has(id));
    if (existing.length) await actor.deleteEmbeddedDocuments("Item", existing);
  }

  if (entry?.pre?.aa !== undefined) {
    if (entry.pre.aa === null) await actor.unsetFlag(NS, "aa");
    else await actor.setFlag(NS, "aa", foundry.utils.deepClone(entry.pre.aa));
  }

  if (r?.xp?.amount) {
    const delta = clampInt(r.xp.amount);
    const prog = foundry.utils.deepClone(actor.getFlag(NS, "progress") ?? {});
    prog.xp = Math.max(0, clampInt(prog.xp) - delta);
    await actor.setFlag(NS, "progress", prog);
  }

  if (r?.currency) {
    const cur = foundry.utils.deepClone(actor.getFlag(NS, "currency") ?? {});
    cur.pp = Math.max(0, clampInt(cur.pp) - clampInt(r.currency.pp));
    cur.gp = Math.max(0, clampInt(cur.gp) - clampInt(r.currency.gp));
    cur.sp = Math.max(0, clampInt(cur.sp) - clampInt(r.currency.sp));
    cur.cp = Math.max(0, clampInt(cur.cp) - clampInt(r.currency.cp));
    cur.extras ??= {};
    for (const ex of (r.currency.extras ?? [])) {
      if (!ex?.id) continue;
      cur.extras[ex.id] = Math.max(0, clampInt(cur.extras[ex.id]) - clampInt(ex.amount));
      if (cur.extras[ex.id] === 0) delete cur.extras[ex.id];
    }
    await actor.setFlag(NS, "currency", cur);
  }

  if (Array.isArray(r?.faction) && r.faction.length) {
    const fac = foundry.utils.deepClone(actor.getFlag(NS, "faction") ?? {});
    for (const row of r.faction) {
      if (!row?.id) continue;
      const delta = clampInt(row.delta);
      fac[row.id] = Math.max(0, clampInt(fac[row.id]) - delta);
      if (fac[row.id] === 0) delete fac[row.id];
    }
    await actor.setFlag(NS, "faction", fac);
  }

  if (r?.unlocks) {
    const u = foundry.utils.deepClone(actor.getFlag(NS, "unlocks") ?? {});
    u.spells ??= {}; u.recipes ??= {}; u.features ??= {};
    for (const s of (r.unlocks.spells ?? [])) if (s?.id) delete u.spells[s.id];
    for (const rec of (r.unlocks.recipes ?? [])) if (rec?.id) delete u.recipes[rec.id];
    for (const f of (r.unlocks.features ?? [])) if (f?.id) delete u.features[f.id];
    await actor.setFlag(NS, "unlocks", u);
  }

  if (Array.isArray(r?.enhancements) && r.enhancements.length) {
    const list = foundry.utils.deepClone(actor.getFlag(NS, "enhancements") ?? []);
    const remove = new Set(r.enhancements.map(e => e?.id).filter(Boolean));
    const next = list.filter(e => !remove.has(e?.id));
    await actor.setFlag(NS, "enhancements", next);
  }
}

export async function undoRewardLogUntil(actor, entryId) {
  const log = getRewardLog(actor);
  if (!log.length) return 0;

  const idx = log.findIndex(e => e?.id === entryId);
  if (idx === -1) return 0;

  const toUndoCount = (log.length - 1) - idx + 1;
  for (let i = 0; i < toUndoCount; i++) {
    const entry = await popRewardLog(actor);
    if (!entry) break;
    await undoRewardEntry(actor, entry);
  }
  return toUndoCount;
}
