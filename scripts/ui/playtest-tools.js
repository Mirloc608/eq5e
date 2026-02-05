/**
 * EQ5e Playtest Tools
 * - Captures recent chat messages into a rolling buffer for beta reports
 * - Adds round markers on combatRound
 */
const SYS = "eq5e";
const MAX = 100;

Hooks.once("ready", () => {
  game.eq5e = game.eq5e || {};
  game.eq5e.playtest = game.eq5e.playtest || {};
  game.eq5e.playtest.log = game.eq5e.playtest.log || []; // {ts, kind, scene, round, speaker, content, flags}
});

Hooks.on("createChatMessage", (msg) => {
  try {
    game.eq5e = game.eq5e || {};
    game.eq5e.playtest = game.eq5e.playtest || {};
    const log = game.eq5e.playtest.log = game.eq5e.playtest.log || [];
    log.push({
      ts: Date.now(),
      kind: "chat",
      scene: canvas?.scene?.name ?? "",
      round: game.combat?.round ?? null,
      speaker: msg.speaker ?? {},
      content: msg.content ?? "",
      flags: msg.flags?.eq5e ?? null
    });
    while (log.length > MAX) log.shift();
  } catch (e) {}
});

Hooks.on("combatRound", (combat, round) => {
  try {
    game.eq5e = game.eq5e || {};
    game.eq5e.playtest = game.eq5e.playtest || {};
    const log = game.eq5e.playtest.log = game.eq5e.playtest.log || [];
    log.push({
      ts: Date.now(),
      kind: "round",
      scene: canvas?.scene?.name ?? "",
      round: round ?? combat?.round ?? null,
      marker: true
    });
    while (log.length > MAX) log.shift();
  } catch (e) {}
});

/** Helpers used by GM HUD */
export function getRecentEvents(n=20) {
  const log = game.eq5e?.playtest?.log ?? [];
  return log.slice(Math.max(0, log.length - n));
}

export function getCCSnapshot() {
  const npcs = canvas.tokens?.placeables?.map(t => t.actor).filter(a => a?.type === "npc") ?? [];
  return npcs.map(a => {
    const cond = a.flags?.eq5e?.conditions ?? {};
    const meta = a.flags?.eq5e?.conditionMeta ?? {};
    const active = Object.entries(cond).filter(([_,v]) => !!v).map(([k]) => ({
      id: k,
      remaining: meta?.[k]?.remainingRounds ?? meta?.remainingRounds ?? null
    }));
    return { name: a.name, uuid: a.uuid, active };
  });
}

export function getThreatSnapshot() {
  const npcs = canvas.tokens?.placeables?.map(t => t.actor).filter(a => a?.type === "npc") ?? [];
  return npcs.map(a => {
    const st = a.flags?.eq5e?.threat ?? { entries: {}, forced: null, lastTargetUuid: null };
    const entries = Object.entries(st.entries ?? {}).map(([uuid, v]) => ({
      uuid,
      threat: Number(v?.threat ?? 0),
      delta: Number(v?.delta ?? 0)
    })).sort((x,y)=> y.threat-x.threat).slice(0,5);
    return {
      name: a.name,
      uuid: a.uuid,
      forced: st.forced ?? null,
      top: entries
    };
  });
}
