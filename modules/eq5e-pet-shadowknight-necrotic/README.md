# EQ5e Shadowknight Pet: Necrotic (Minor)

**Module ID:** `eq5e-pet-shadowknight-necrotic`  
**Type:** pet  
**Requires:** EQ5e system + EQ5e AI + `eq5e-class-shadowknight`

This module provides **minor necrotic/undead pet** templates intended for Shadowknights.
They should be **weaker** than Necromancer pets (lower HP, lower base damage, fewer spells).

## Pet Actor flags (minimum)
Set on the pet Actor:
- `actor.flags.eq5e.pet.ownerUuid` (Actor UUID of owner)
- `actor.flags.eq5e.pet.role` = `"tank"|"caster"|"melee"` (usually `"melee"` or `"tank-lite"`)
- `actor.flags.eq5e.ai.enabled` = `true`
- `actor.flags.eq5e.ai.mode` = `"assist"`
- Optional: `actor.flags.eq5e.ai.allowSpells` = `true` (if you add a small spell list)

## Suggested balance knobs (deterministic)
- HP multiplier: `flags.eq5e.balance.hpMult = 0.7`
- Damage multiplier: `flags.eq5e.balance.dmgMult = 0.7`
- Threat multiplier (tank-lite): `flags.eq5e.balance.threatMult = 0.8`

> These are content-time tuning knobs; the current templates don’t yet apply them automatically.
