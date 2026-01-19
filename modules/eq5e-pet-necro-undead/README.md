# EQ5e Necromancer Pet: Undead

    **Module ID:** `eq5e-pet-necro-undead`  
    **Type:** pet  
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


## Pet module notes
Pet Actors should set:
- `actor.flags.eq5e.pet.ownerUuid` (Actor UUID of owner)
- `actor.flags.eq5e.pet.role` = `"tank"|"caster"|"melee"`
- `actor.flags.eq5e.ai.enabled` = `true`
- `actor.flags.eq5e.ai.mode` = `"assist"` (recommended)

For pets that cast, also set:
- `actor.flags.eq5e.ai.allowSpells` = `true`
