EQ5E weapon materials (hybrid) drop-in

Adds data/weapon-materials.json (5 materials) and updates eq5e-items-core importer
to generate deterministic weapon material variants at import time.

How to use:
1) Drop these files into your system folder, preserving paths.
2) In Foundry as GM, run: game.eq5e.itemization.importCore({rebuildTables:true})
3) Your Weapons pack will include base weapons + material variants.

Marker: EQ5E_WEAPON_MATERIALS_5
