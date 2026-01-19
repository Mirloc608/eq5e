# EQ5e Class: Bard

This module adds the EverQuest-inspired **Bard** class scaffolding and generates a **world compendium** of Bard **songs** (Items).

## Generated compendium
- Key: `world.eq5e-bard-songs`
- Label: `EQ5e Bard Songs`

Upsert key is deterministic via `flags.eq5e.spell.spellId`.

## Song format
Songs are stored as `Item` documents (type `spell`) using the same execution pipeline as spells:
- `flags.eq5e.spell.kind = "song"`
- `flags.eq5e.spell.meta.isSong = true`
- optional `effects` (ActiveEffects) and/or `flags.eq5e.spell.conditions`

Example songs included:
- Selo's Accelerando (movement buff)
- Anthem of War (attack/damage bonus via AE)
- Lullaby (mez via condition)
- Chant of Disease (DoT damage pulses)
- Song of Silence (silence via condition)

## Settings
- **Generate Bard song compendium on startup** (`eq5e.bardSongsOnStartup`)

> Notes: This is a template starter. “Song twisting” and pulse/maintenance mechanics can be added later without changing spell IDs.


## Song twisting support
Songs are treated as **maintained** on the caster:
- tracked in `actor.flags.eq5e.songs.active`
- overwrite rules by `spell.meta.songGroup`
- max simultaneous songs default `3` (`actor.flags.eq5e.songs.maxActive`)
- pulse ticks apply deterministic periodic damage for DoT songs (`meta.dot` / `meta.damagePulse`).


## Twist cadence
Starting a new song counts as beginning a new **performance** and ends the previous one immediately.
Songs persist for `meta.durationRounds` and can be maintained by **rotating** (recasting) them before expiry.
Cadence is enforced by `actor.flags.eq5e.songs.cadenceRounds` (default from world setting).

## Instrument modifiers (optional)
Set `actor.flags.eq5e.bard.instrument` to one of:
- `brass`, `strings`, `percussion`

Songs may declare a preferred instrument via `spell.meta.instrument` and a multiplier via `spell.meta.instrumentMult`.
When matched, the song's potency scales:
- DoT song pulse damage uses `potencyMult`
- Numeric ActiveEffect change values are scaled on cast

## Bard sheet widget
When this module is enabled, bard-owned actors get a simple widget at the top of their sheet:
- Instrument dropdown (`brass/strings/percussion`)
- Twist cadence slider (`songs.cadenceRounds`)
- Max maintained slider (`songs.maxActive`)

The widget writes to actor flags so it works across any sheet layout.


## Bard Instruments
Generated compendium:
- `world.eq5e-bard-instruments` (example brass/strings/percussion items)

Set your bard’s instrument via the sheet widget or by setting `actor.flags.eq5e.bard.instrument`.


## Song twisting synergy bonuses
The EQ5e system computes deterministic synergy from maintained songs and stores it on the actor:
- `actor.flags.eq5e.bard.synergy.attackBonus`
- `actor.flags.eq5e.bard.synergy.damageBonus`

These bonuses are applied automatically to attacks (to-hit) and melee damage.
