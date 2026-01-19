# EQ5e Spell Compendium + Condition Spell Examples

This repo ships a **deterministic world compendium generator** that creates a world item pack containing example spells
that apply the core EQ5e conditions:

- **Mez** → `mezzed` (break on damage)
- **Root** → `rooted`
- **Snare** → `snared` (moveMult 0.5)
- **Silence** → `silenced` (blocks casting)

## Where the sources live
- `system/eq5e/data/spells-examples.json`

## Where the compendium is generated
- World pack key: `world.eq5e-spells-examples`
- Label: `EQ5e Spells (Examples)`

## How conditions are applied
Spells use `flags.eq5e.spell.conditions` entries like:

```json
{ "id": "mezzed", "duration": { "rounds": 2 }, "meta": { "breakOnDamage": true } }
```

Your existing pipeline applies these via `game.eq5e.api.castSpell`, and your Active Effect ↔ Condition syncing ensures
buffs/effects and conditions stay consistent.

## Control
System setting:
- **Generate example spell compendium on startup** (`eq5e.exampleSpellsOnStartup`)


## AE Examples (Active Effect ↔ Condition sync)
This repo also generates a second world pack containing Items with **embedded ActiveEffects**.
Those effects set EQ5e conditions via either:
- `flags.eq5e.conditions = ["silenced"]` on the ActiveEffect, or
- `changes` that write `flags.eq5e.conditions.<id>.active = true`

Generated pack:
- `world.eq5e-spell-effects-ae-examples` (label: `EQ5e Spell Effects (AE Examples)`)

Source file:
- `system/eq5e/data/spell-effects-ae-examples.json`
