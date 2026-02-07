# EQ5e Mount Token FX (Sequencer-required)

This drop-in wires equipped mounts into **token-mounted VFX** using the Sequencer module.

## What you get
- Persistent mount animation under the token while a mount is equipped
- Automatic cleanup when the mount is unequipped
- Per-mount customization via item flags
- A macro to toggle FX per actor

## Install
Unzip into Foundry Data so files land under:
- systems/eq5e/scripts/mount-sequencer.mjs
- systems/eq5e/scripts/macros/mount-toggle-sequencer.js
- systems/eq5e/assets/fx/mounts/

## Enable in system.json
Add the script **after** your core eq5e.mjs is fine (it installs its own hooks on ready):
"esmodules": [
  "scripts/ae-normalizer.mjs",
  "scripts/eq5e.mjs",
  "scripts/mount-sequencer.mjs",
  "scripts/character-sheet.js"
]

(Exact order doesn't matter as long as it loads.)

## Requirements
- Module: Sequencer (active)

## Mount detection
An equipped mount is:
- item.flags.eq5e.category === "mount"
- item.flags.eq5e.equipped === true

## Default FX mapping
If you don't set a file, it uses:
systems/eq5e/assets/fx/mounts/<era_default>.webm

Based on:
item.flags.eq5e.mount.era  (classic/kunark/velious/luclin/pop)

## Customize per mount
Set on the mount item:
flags.eq5e.mount.fx = {
  file: "modules/your-fx-pack/mount.webm",
  scale: 0.9,
  below: true,
  opacity: 1.0,
  offsetX: 0,
  offsetY: 14,
  tint: "#ffffff"
}

## Disable per actor
flags.eq5e.disableMountFx = true

## Macro
Import / run:
systems/eq5e/scripts/macros/mount-toggle-sequencer.js

It toggles disableMountFx on the selected token's actor (or your character).

---
If you want the *really slick* version next:
- Different FX per mount "family" (horse/wolf/cat/disc)
- Rider overlay sprite (token above mount, mount animation below)
- Speed-based motion blur while the token is moving (requires token move hooks)
