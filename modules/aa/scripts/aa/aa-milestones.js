import { normalizeQuestRewards } from "./aa-rewards-normalize.js";
import { postQuestRewardCard, resolveRewardTargets } from "./aa-quests.js";
import { requestApplyRewardsFromClient } from "./aa-awards.js";

const NS = "eq5e";

export function registerMilestoneAutomation() {
  Hooks.on("updateJournalEntryPage", async (page, changes) => {
    const completedNow = foundry.utils.getProperty(changes, `flags.${NS}.completed`);
    if (completedNow !== true) return;

    const raw = page.getFlag(NS, "questRewards");
    if (!raw) return;

    const rewards = normalizeQuestRewards(raw);
    const label = rewards.meta.label ?? (page.name ? `Milestone: ${page.name}` : "Milestone Reward");
    const reason = rewards.meta.reason ?? label;
    const actorUuids = resolveRewardTargets(rewards.meta.targets);

    if (rewards.meta.automation === "auto") {
      requestApplyRewardsFromClient({ actorUuids, rewards, sourceLabel: label, reason, pageUuid: page.uuid, automationMode: rewards.meta.automation });
      return;
    }

    await postQuestRewardCard({ label, actorUuids, rewards, pageUuid: page.uuid });
  });
}
