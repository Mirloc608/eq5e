// module/system-init.js
// ------------------------------------------------------------
// EQ5e System Initialization (Modernized)
// ------------------------------------------------------------

// Actor system
import { EQActor } from "./actor/eq-actor.js";
import { EQActorSheetPC } from "./actor/sheets/eq-actor-sheet-pc.js";
import { EQActorSheetNPC } from "./actor/sheets/eq-actor-sheet-npc.js";
import { EQActorSheetPet } from "./actor/sheets/eq-actor-sheet-pet.js";
import { EQActorSheetMercenary } from "./actor/sheets/eq-actor-sheet-mercenary.js";

// World + Director
import { EQWorldState } from "./world/eq-world-state.js";
import { EQWorldTicker } from "./world/eq-world-ticker.js";
import { EQDirectorEngine } from "./world/eq-director-engine.js";

// Director UI Panels
import { EQDirectorPanel } from "./world/eq-director-panel.js";
import { EQDirectorTimeline } from "./world/eq-director-timeline.js";
import { EQDirectorHeatmap } from "./world/eq-director-heatmap.js";
import { EQDirectorForecast } from "./world/eq-director-forecast.js";

// World UI Panels
import { EQSettlementPanel } from "./world/eq-settlement-panel.js";
import { EQStoryArcEditor } from "./world/eq-story-arc-editor.js";
import { EQWorldDashboard } from "./world/ui/eq-world-dashboard.js";

// Narrative Systems
import { EQWorldEvents } from "./world/eq-world-events.js";
import { EQStoryArcs } from "./world/eq-story-arcs.js";

// Ecosystem System
import { EQEcosystemManager } from "./ecosystem/eq-ecosystem-manager.js";

// HUD / Inspector
import { EQRegionInspector } from "./world/ui/eq-region-inspector.js";
import { EQEcosystemInspector } from "./world/ui/eq-ecosystem-inspector.js";

// GM Quickbar
import "./world/ui/eq-gm-quickbar.js";


// ------------------------------------------------------------
// INIT HOOK
// ------------------------------------------------------------
Hooks.once("init", function () {
  console.log("EQ5e | Initializing EverQuest 5e system");

  // Register Actor class
  CONFIG.Actor.documentClass = EQActor;

  // Unregister core sheets
  Actors.unregisterSheet("core", ActorSheet);

  // Register EQ5e sheets
  Actors.registerSheet("eq5e", EQActorSheetPC, { types: ["pc"], makeDefault: true });
  Actors.registerSheet("eq5e", EQActorSheetNPC, { types: ["npc"], makeDefault: true });
  Actors.registerSheet("eq5e", EQActorSheetPet, { types: ["pet"], makeDefault: true });
  Actors.registerSheet("eq5e", EQActorSheetMercenary, { types: ["mercenary"], makeDefault: true });

  // Global namespace
  game.eq5e = game.eq5e || {};

  // World state + ticker
  game.eq5e.worldState = EQWorldState;
  game.eq5e.worldTicker = EQWorldTicker;

  // Director UI
  game.eq5e.openDirectorPanel = () => new EQDirectorPanel().render(true);
  game.eq5e.openDirectorTimeline = () => new EQDirectorTimeline().render(true);
  game.eq5e.openDirectorHeatmap = () => new EQDirectorHeatmap().render(true);
  game.eq5e.openDirectorForecast = () => new EQDirectorForecast().render(true);

  // World UI
  game.eq5e.openSettlements = () => new EQSettlementPanel().render(true);
  game.eq5e.openStoryArcEditor = () => new EQStoryArcEditor().render(true);
  game.eq5e.openWorldDashboard = () => new EQWorldDashboard().render(true);

  // Narrative systems
  game.eq5e.worldEvents = EQWorldEvents;
  game.eq5e.storyArcs = EQStoryArcs;

  // Inspectors
  game.eq5e.openRegionInspector = (id) => new EQRegionInspector(id).render(true);
  game.eq5e.openEcosystemInspector = (id) => new EQEcosystemInspector(id).render(true);
});


// ------------------------------------------------------------
// READY HOOK
// ------------------------------------------------------------
Hooks.once("ready", function () {
  // Initialize world state
  EQWorldState.initialize();

  // Start world ticker (drives Director Beats)
  EQWorldTicker.start();

  // Initialize Ecosystem
  EQEcosystemManager.initialize();

  console.log("EQ5e | World systems ready");
});


// ------------------------------------------------------------
// HUD LAYER
// ------------------------------------------------------------
Hooks.once("canvasReady", () => {
  const hud = document.createElement("div");
  hud.classList.add("eq-hud-layer");
  document.body.appendChild(hud);
  game.eq5e.hudLayer = hud;
});
