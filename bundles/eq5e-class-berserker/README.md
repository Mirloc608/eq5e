# EQ5e Class: Berserker

Adds Berserker class scaffolding (features + disciplines) and integrates Berserker-specific AAs into the shared AA pack.

## Generated packs
- `world.eq5e-berserker-features`
- `world.eq5e-berserker-disciplines`

## AA integration
- Merges Berserker AAs into `world.eq5e-aa` (used by the AA Browser UI)

## Flags
- Disciplines are `Item` type `spell` with `flags.eq5e.spell.kind="discipline"` and `meta.discipline=true`.

## Settings
- `eq5e.berserkerOnStartup`
- `eq5e.berserkerAAsOnStartup`
