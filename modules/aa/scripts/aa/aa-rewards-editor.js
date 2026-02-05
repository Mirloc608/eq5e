import { normalizeQuestRewards } from "./aa-rewards-normalize.js";
import { postQuestRewardCard, resolveRewardTargets } from "./aa-quests.js";

const NS = "eq5e";

export function registerQuestRewardsEditorTab() {
  Hooks.on("renderJournalPageSheet", async (app, html) => {
    const page = app.document;
    if (!page) return;

    const root = html?.[0] ?? html;
    const tabs = root.querySelector("nav.sheet-tabs, nav.tabs");
    const body = root.querySelector("section.sheet-body, section.content, .sheet-body");
    if (!tabs || !body) return;
    if (root.querySelector('[data-tab="eq5e-rewards"]')) return;

    const canEdit = game.user.isGM;

    const tabBtn = document.createElement("a");
    tabBtn.classList.add("item");
    tabBtn.dataset.tab = "eq5e-rewards";
    tabBtn.innerHTML = `<i class="fa-solid fa-trophy"></i> EQ5e Rewards`;
    tabs.appendChild(tabBtn);

    const panel = document.createElement("div");
    panel.classList.add("tab");
    panel.dataset.tab = "eq5e-rewards";

    const current = page.getFlag(NS, "questRewards") ?? {};
    const completed = Boolean(page.getFlag(NS, "completed") ?? false);

    panel.innerHTML = `
      <div>
        <h2 style="margin: 0 0 8px 0;">Quest / Milestone Rewards</h2>

        <div class="form-group">
          <label>Completed</label>
          <div class="form-fields">
            <input type="checkbox" data-eq5e-completed ${completed ? "checked" : ""} ${!canEdit ? "disabled" : ""}/>
          </div>
        </div>

        <div class="form-group">
          <label>questRewards JSON</label>
          <div class="form-fields" style="flex-direction: column; align-items: stretch;">
            <textarea rows="18" data-eq5e-json ${!canEdit ? "disabled" : ""}>${foundry.utils.escapeHTML(JSON.stringify(current, null, 2))}</textarea>
            <div style="display:flex; gap:8px; margin-top:8px;">
              <button type="button" class="eq5e-save" ${!canEdit ? "disabled" : ""}><i class="fa-solid fa-floppy-disk"></i> Save</button>
              <button type="button" class="eq5e-post"><i class="fa-solid fa-comment"></i> Post Award Card</button>
            </div>
          </div>
        </div>
      </div>
    `;

    body.appendChild(panel);
    try { app._tabs?.[0]?.bind?.(root); } catch (_) {}

    const txt = panel.querySelector("[data-eq5e-json]");
    const chk = panel.querySelector("[data-eq5e-completed]");
    panel.querySelector(".eq5e-save")?.addEventListener("click", async () => {
      try {
        const parsed = JSON.parse(String(txt.value ?? "{}"));
        const normalized = normalizeQuestRewards(parsed);
        await page.setFlag(NS, "questRewards", normalized);
        await page.setFlag(NS, "completed", Boolean(chk.checked));
        ui.notifications.info("EQ5e rewards saved.");
      } catch (e) { ui.notifications.error(e?.message ?? String(e)); }
    });

    panel.querySelector(".eq5e-post")?.addEventListener("click", async () => {
      try {
        const parsed = JSON.parse(String(txt.value ?? "{}"));
        const normalized = normalizeQuestRewards(parsed);
        const label = normalized.meta.label ?? (page?.name ? `Quest Reward: ${page.name}` : "Quest Reward");
        const actorUuids = resolveRewardTargets(normalized.meta.targets);
        await postQuestRewardCard({ label, actorUuids, rewards: normalized, pageUuid: page.uuid });
      } catch (e) { ui.notifications.error(e?.message ?? String(e)); }
    });
  });
}
