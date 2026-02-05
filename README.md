# EQ5E: DerivedHash Normalization Patch Tool

This tool patches EQ5e bundle scripts to compute `flags.eq5e.derivedHash` from the
**normalized item data** (using `game.eq5e.normalizeItemData`) to prevent
"update churn" across startups now that ActiveEffects are normalized at the system layer.

## What it changes (heuristic, safe)
It rewrites hash expressions like:

- `const h = _stableHash(it);`
- `const h = stableHash(d);`
- `d.flags.eq5e.derivedHash = stableHash(d);`
- `it.flags.eq5e.derivedHash = h;` (unchanged; only hash computation changes)

into:

- `const h = _stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(it) : it));`
- `d.flags.eq5e.derivedHash = stableHash((game.eq5e?.normalizeItemData ? game.eq5e.normalizeItemData(d) : d));`

It **does not** attempt to restructure the object pushed into create/update; the system-level
Item create/update patch will normalize at write time. This tool just ensures the hash matches
the normalized form.

## Usage

From your Foundry user data folder (the one that contains `systems/eq5e/`):

```bash
node tools/patch-derivedhash-normalize.mjs --root . --dry-run
node tools/patch-derivedhash-normalize.mjs --root .
```

## Notes
- Writes `.bak` backups next to each changed file (only if not already present).
- Targets files under `systems/eq5e/bundles/**/scripts/*.js` and `.../scripts/*.mjs`
