import { normalizeQuestRewards } from "./aa-rewards-normalize.js";
import { grantAAPoints } from "./aa-api.js";
import { appendRewardLog, makeRewardLogEntry } from "./aa-reward-log.js";

const NS = "eq5e";

function clampInt(n) {
  const x = Math.floor(Number(n ?? 0));
  return Number.isFinite(x) ? x : 0;
}

async function resolveActors(actorUuids) {
  const out = [];
  for (const uuid of actorUuids ?? []) {
    const doc = await fromUuid(uuid);
    if (doc?.documentName === "Actor") out.push(doc);
  }
  return out;
}

async function applyItems({ actors, items }) {
  const createdMap = new Map();
  const addCreated = (actor, doc, qty) => {
    const arr = createdMap.get(actor.id) ?? [];
    arr.push({ itemId: doc.id, itemName: doc.name, qty });
    createdMap.set(actor.id, arr);
  };

  for (const it of (items ?? [])) {
    const mode = it?.mode ?? "compendium";
    const qty = Math.max(1, clampInt(it?.quantity ?? 1));
    const to = it?.to ?? "each";

    let itemData = null;

    if (mode === "compendium") {
      const uuid = it?.uuid;
      if (!uuid) continue;
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      itemData = doc.toObject();
    } else if (mode === "create") {
      if (!it?.name) continue;
      itemData = { name: it.name, type: it.type ?? "equipment", system: it.data ?? {} };
    }
    if (!itemData) continue;

    const recipients = (to === "each") ? actors : [actors[0]].filter(Boolean);
    for (const a of recipients) {
      const docs = await a.createEmbeddedDocuments("Item", [itemData]);
      for (const d of docs) addCreated(a, d, qty);
    }
  }

  return createdMap;
}

export async function applyQuestRewardsToActors({ actorUuids, rewards, sourceLabel, reason, pageUuid, automationMode }) {
  const normalized = normalizeQuestRewards(rewards ?? {});
  const actors = await resolveActors(actorUuids ?? []);

  const logEntries = new Map();
  for (const a of actors) {
    const preAA = foundry.utils.deepClone(a.getFlag(NS, "aa") ?? null);
    logEntries.set(a.id, makeRewardLogEntry({
      sourceLabel, reason, rewards: normalized, pageUuid,
      automationMode: automationMode ?? normalized.meta.automation,
      preAA
    }));
  }

  if (normalized.aa.points > 0) for (const a of actors) await grantAAPoints(a, normalized.aa.points);

  if (normalized.xp.amount > 0) {
    for (const a of actors) {
      const prog = foundry.utils.deepClone(a.getFlag(NS, "progress") ?? {});
      prog.xp = clampInt(prog.xp) + normalized.xp.amount;
      await a.setFlag(NS, "progress", prog);
    }
  }

  if ((normalized.items ?? []).length) {
    const created = await applyItems({ actors, items: normalized.items });
    for (const a of actors) {
      const entry = logEntries.get(a.id);
      if (entry) entry.applied.itemsCreated = created.get(a.id) ?? [];
    }
  }

  for (const a of actors) {
    const entry = logEntries.get(a.id);
    if (!entry) continue;
    entry.post.aa = foundry.utils.deepClone(a.getFlag(NS, "aa") ?? null);
    await appendRewardLog(a, entry);
  }

  return { actors, normalized };
}
