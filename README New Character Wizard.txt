EQ5e New Character Wizard (drop-in)

Files:
- systems/eq5e/scripts/new-character-wizard.mjs
- systems/eq5e/templates/app/new-character-wizard.hbs

Install:
1) Copy the systems/eq5e/... files into your EQ5e system folder.
2) Add this line to system.json -> esmodules (preferably before eq5e.mjs):
   "scripts/new-character-wizard.mjs"
3) Reload Foundry.

Usage:
- In the Actors Directory, click the "New EQ5e PC" button.
- Wizard creates a Character actor and (if your system has race/class Items in compendiums) it will try to add them.

Notes:
- The wizard uses fallback race/class lists if it can't find items.
- You can safely tweak the FALLBACK_RACES / FALLBACK_CLASSES arrays.
