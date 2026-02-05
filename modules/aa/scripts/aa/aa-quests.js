import { normalizeQuestRewards } from "./aa-rewards-normalize.js";
import { requestApplyRewardsFromClient } from "./aa-awards.js";

function formatLocalDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const locale = game.i18n.lang || undefined;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(d);
  } catch { return iso; }
}

export function resolveRewardTargets(targets) {
  const t = String(targets ?? "party");

  if (t === "selected") {
    const uuids = new Set();
    for (const tok of (canvas?.tokens?.controlled ?? [])) if (tok?.actor?.uuid) uuids.add(tok.actor.uuid);
    return [...uuids];
  }
  if (t.startsWith("actor:")) return [t.slice(6)];

  const out = [];
  for (const a of game.actors.contents) {
    if (a.type !== "character") continue;
    const anyNonGMOwner = Object.entries(a.ownership ?? {}).some(([uid, lvl]) => {
      const u = game.users.get(uid);
      return u && !u.isGM && lvl >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    });
    if (anyNonGMOwner) out.push(a.uuid);
  }
  return out;
}

export function registerQuestCardClickHandler() {
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html?.[0] ?? html;
    const card = root?.querySelector?.(".eq5e-quest-reward");
    if (!card) return;

    const btn = card.querySelector(".eq5e-award-aa");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      try {
        const raw = card.dataset.eq5eQuestReward;
        const decoded = JSON.parse(decodeURIComponent(raw));
        requestApplyRewardsFromClient({
          actorUuids: decoded.actorUuids ?? [],
          rewards: decoded.rewards ?? {},
          sourceLabel: decoded.label,
          reason: decoded.reason,
          pageUuid: decoded.pageUuid ?? null,
          automationMode: decoded.rewards?.meta?.automation ?? decoded.automationMode
        });
      } catch (err) {
        ui.notifications.error(err?.message ?? String(err));
      }
    });
  });
}

export async function postQuestRewardCard({ label, actorUuids, rewards, pageUuid }) {
  const normalized = normalizeQuestRewards(rewards ?? {});
  const iso = new Date().toISOString();
  const when = formatLocalDateTime(iso);
  const who = game.user?.name ?? "Unknown";

  const data = {
    label,
    actorUuids,
    rewards: normalized,
    reason: normalized.meta.reason ?? label,
    pageUuid: pageUuid ?? null,
    posted: { iso, when, who }
  };

  const content = `
    <div class="eq5e-quest-reward eq5e-card"
         data-eq5e-quest-reward='${encodeURIComponent(JSON.stringify(data))}'
         data-eq5e-ts="${foundry.utils.escapeHTML(iso)}">
      <h3 class="eq5e-card__title">${foundry.utils.escapeHTML(label)}</h3>

      <div class="eq5e-card__stamp">
        <span><b>When:</b> ${foundry.utils.escapeHTML(when)}</span>
        <span><b>By:</b> ${foundry.utils.escapeHTML(who)}</span>
      </div>

      ${renderRewardsSummary(normalized)}
      <hr class="eq5e-card__hr"/>
      <button type="button" class="eq5e-award-aa">
        <i class="fa-solid fa-trophy"></i> Apply Rewards
      </button>
    </div>
  `;

  return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ alias: "EQ5e" }) });
}

function renderRewardsSummary(r) {
  const lines = [];
  if (r.aa.points) lines.push(`<div><b>AA:</b> ${r.aa.points}</div>`);
  if (r.xp.amount) lines.push(`<div><b>XP:</b> ${r.xp.amount}</div>`);
  const money = ["pp","gp","sp","cp"].map(k => r.currency[k] ? `${r.currency[k]} ${k}` : null).filter(Boolean).join(", ");
  if (money) lines.push(`<div><b>Currency:</b> ${money}</div>`);
  const unlocks = r.unlocks.spells.length + r.unlocks.recipes.length + r.unlocks.features.length;
  if (unlocks) lines.push(`<div><b>Unlocks:</b> ${unlocks}</div>`);
  if ((r.enhancements ?? []).length) lines.push(`<div><b>Enhancements:</b> ${r.enhancements.length}</div>`);
  if ((r.items ?? []).length) lines.push(`<div><b>Items:</b> ${r.items.length} entries</div>`);
  return lines.join("");
}
