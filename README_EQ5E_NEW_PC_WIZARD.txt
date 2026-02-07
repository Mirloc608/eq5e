EQ5E Drop-in: New Character Wizard (Classic → Planes of Power)

Files included
 - systems/eq5e/system.json (adds scripts/new-character-wizard.mjs to esmodules)
 - systems/eq5e/scripts/new-character-wizard.mjs
 - systems/eq5e/templates/app/new-character-wizard.hbs

What it does
 - Adds an "EQ5e: New PC" button to the Actor Directory (left sidebar) for players and GMs.
 - Wizard steps: Name → Era → Class/Race (era-restricted) → Options (auto spells / starter kit) → Create.
 - GM settings:
   - Enforce era restrictions
   - Max era available (Classic / Kunark / Velious / Luclin / PoP)

Notes
 - Auto-assign spells + starter kit are best-effort: the wizard tries to CLONE items/spells from any available Item compendiums.
   If a matching item/spell isn't found, it will skip it and show a warning.
