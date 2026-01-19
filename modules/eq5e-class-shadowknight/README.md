# EQ5e Class: Shadowknight

**Module ID:** `eq5e-class-shadowknight`  
**Type:** class  
**Requires:** EQ5e system + EQ5e AI module

This is a **template content module**. It is intentionally lightweight so you can update class/pet content independently.

## What you add here
- **Class Features** (Items: `feature`)
- **Class Spells** (Items: `spell`, with EQ5e spell flags)
- **Class Progression / Notes**
- **Pet Actors** (for pet modules)

## Recommended content structure
- `packs/` (compendiums)
- `data/` (source JSON/YAML you generate into compendiums)
- `scripts/` (migration + setup hooks)

## Minimal EQ5e flags you can use
- Spell: `item.flags.eq5e.spell`
  - `enabled: true`
  - `kind: "dot"|"nuke"|"debuff"|"heal"|"utility"|...`
  - `rangeFt`, `manaCost`, `priority`
  - `damage: [{formula,type,category}]`
  - `conditions: [{id,duration,meta}]` (syncs with conditions)

- Attack: `item.flags.eq5e.attack`
  - `enabled: true`
  - `type: "melee"|"ranged"`
  - `ability`, `proficient`, `attackBonus`, `priority`
  - `damage: [{formula,type,category}]`

## Shadowknight necrotic lines (weaker pets + Necromancer-derived spells)

Shadowknights can use **weaker** versions of select Necromancer spell lines (DoTs / lifetaps / debuffs) and can command a **minor necrotic pet**.

This repo provides this as **separate, independently updatable content**:

- **Pet module:** `eq5e-pet-shadowknight-necrotic` (minor undead/necrotic pet templates)
- **Spell-line linkage:** shadowknight spells can be authored as:
  - **Native SK copies** (best for balance control), OR
  - **Derived-from-Necro** references using a deterministic multiplier.

### Deterministic “derived-from” authoring (recommended pattern)
When you want a Shadowknight spell to be a weaker Necromancer line spell, set on the SK spell item:

- `flags.eq5e.derivedFrom = { sourceSpellId: "<necro spellId>", potencyMult: 0.6 }`

Authoring intent:
- **potencyMult** scales damage/heal values (and optionally duration ticks) deterministically during content generation/migration.
- Mechanics stay deterministic; later “AI suggestions” never change the numbers.

> Note: The current module templates ship scaffolding only. The actual “derive + scale into compendiums” loader will be added when we implement pack generation/import scripts.

## Summon Necrotic Minion (auto-generated)
The Shadowknight module includes `data/sk-summons.json` which defines **Summon Necrotic Minion**.
On startup (GM), the module will upsert that spell into the derived spell compendium.

The spell uses:
- `flags.eq5e.spell.summon.pack = "world.eq5e-sk-necrotic-pets"`
- `flags.eq5e.spell.summon.name = "Minor Necrotic Minion"`

When cast via `game.eq5e.api.castSpell`, the system will:
- create a new Actor from that compendium entry
- set pet ownership to the caster
- drop a token adjacent to the caster

### Summon tightening behaviors
- **Reuse:** casting again will reuse the existing summoned pet (moves it next to you) instead of creating new Actors.
- **Only one:** only one active summon per caster per `summonId` (older ones are despawned if found).
- **Duration:** summon can expire after `durationRounds` (despawned on round tick).
- **Abilities:** pet abilities can be auto-attached from `world.eq5e-sk-necrotic-pet-abilities` on first spawn.

- **Dismiss Necrotic Minion** spell (dismissSummon) cleanly despawns your active minion.
