EQ5e UI + Syntax Patch (Foundry v13)

What’s included
- scripts/eq5e.mjs: current repaired module file from this chat
- scripts/character-sheet.js: ApplicationV2/ActorSheetV2 sheet + crest mapping
- styles/eq5e.css: EQ-inspired skin styles
- templates/actor/character-sheet.hbs: a clean, skinned sheet template
- assets/ui/*.png: original fantasy UI art (EverQuest-inspired, not game assets)

Install
1) Unzip into your Foundry Data folder so it lands at:
   Data/systems/eq5e/...

2) If you already have an EQ5e system installed and want to overlay:
   - Merge folders; allow overwrite for the files above.

Notes
- The sheet template uses common system paths (system.abilities.*, system.attributes.*).
  If your EQ5e data model differs, adjust those bindings in the .hbs.

