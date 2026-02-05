import { applyQuestRewardsToActors } from "./aa-apply.js";
import { registerQuestCardClickHandler } from "./aa-quests.js";

const SOCKET = `system.${game.system?.id || "eq5e"}`;

export function registerAASocketHandlers() {
  game.socket.on(SOCKET, async (payload) => {
    try {
      if (!payload?.op) return;
      if (payload.op === "applyRewards") {
        if (!game.user.isGM) return;
        await applyQuestRewardsToActors(payload);
      }
      if (payload.op === "requestApplyRewards") {
        if (!game.user.isGM) return;
        await handleRewardsRequest(payload);
      }
    } catch (err) {
      console.error("[EQ5e AA Tools] Socket handler error", err);
      ui.notifications.error(err?.message ?? String(err));
    }
  });

  registerQuestCardClickHandler();
}

export function requestApplyRewardsFromClient({ actorUuids, rewards, sourceLabel, reason, pageUuid, automationMode }) {
  const isGM = game.user?.isGM;
  const payload = { op: isGM ? "applyRewards" : "requestApplyRewards", actorUuids, rewards, sourceLabel, reason, pageUuid, automationMode };
  return game.socket.emit(SOCKET, payload);
}

async function handleRewardsRequest({ actorUuids, rewards, sourceLabel, reason, pageUuid, automationMode }) {
  const ok = await Dialog.confirm({ title: "Approve Quest Rewards", content: `<p>Apply rewards: <b>${foundry.utils.escapeHTML(sourceLabel ?? "Quest Rewards")}</b>?</p>` });
  if (!ok) return;
  await applyQuestRewardsToActors({ actorUuids, rewards, sourceLabel, reason, pageUuid, automationMode });
}
