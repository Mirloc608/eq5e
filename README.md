# EQ5e Foundry Repo

## Content modules (templates included)
This repo includes template modules for each EverQuest class and several pet archetypes. Enable only the ones you want.

### Classes (modules)
- eq5e-class-warrior
- eq5e-class-cleric
- eq5e-class-paladin
- eq5e-class-ranger
- eq5e-class-shadowknight
- eq5e-class-druid
- eq5e-class-monk
- eq5e-class-bard
- eq5e-class-rogue
- eq5e-class-shaman
- eq5e-class-necromancer
- eq5e-class-wizard
- eq5e-class-magician
- eq5e-class-enchanter
- eq5e-class-beastlord
- eq5e-class-berserker

### Pets (modules)
- eq5e-pet-mage-elemental
- eq5e-pet-necro-undead
- eq5e-pet-beastlord-warder
- eq5e-pet-enchanter-charm

Each template has:
- `module.json`
- `scripts/main.js`
- `README.md`
- `data/sample.json`
- eq5e-pet-shadowknight-necrotic

## Deterministic derive + scale (Shadowknight ↔ Necromancer)
If `eq5e-class-shadowknight` and `eq5e-class-necromancer` are enabled, the GM can auto-generate **derived Shadowknight spells**
from Necromancer spell definitions on startup.

- Necro source file: `modules/eq5e-class-necromancer/data/necro-spells.json`
- SK mapping file: `modules/eq5e-class-shadowknight/data/derived-from-necro.json`
- Output (world compendium): `world.eq5e-sk-derived-spells` (configurable in SK settings)

This is deterministic: same source + mapping => same generated items. The loader upserts (creates/updates) by derived `spellId`.

## Shadowknight necrotic pets + summon (generated)
If `eq5e-pet-shadowknight-necrotic` is enabled, the Shadowknight derive loader will also generate a **world Actor compendium**:

- `world.eq5e-sk-necrotic-pets` (contains "Minor Necrotic Minion")

It also upserts a summon spell into the derived SK spell compendium:
- "Summon Necrotic Minion" (spellId `sk.summon.necrotic-minion.1`)

Casting that spell spawns the pet token adjacent to the caster (GM only).

- Added smarter summon placement + Dismiss Necrotic Minion utility spell.
- Added socket-based summon dismissal so non-GM owners can dismiss their own summons (GM validated).
- Added socket-based pet AI stance control (assist/guard/passive/autonomous) so non-GM owners can change pet behavior.
- Added Pet Control UI (Token HUD buttons) for stance switching without macros.
- Added Pet HUD status pill showing stance + active conditions (silenced/mezzed/rooted/snared).
- Pet HUD status pill now includes a simple blocker reason label (e.g., Blocked: Mez, Casting blocked: Silence).
- Pet HUD blocker reason now detects Rooted + out-of-range (based on best-effort target + melee range).
- Pet HUD blocker label now also shows a non-blocking "Closing range…" hint when out of melee range (not rooted).
- Added example spell compendium generator: world.eq5e-spells-examples (mez/root/snare/silence).
- Added AE spell-effect example compendium generator: world.eq5e-spell-effects-ae-examples.
- Added Bard song twisting support: maintained songs tracked on caster, group overwrite rules, and pulse ticks for DoT songs.
- Added Bard twist cadence + optional instrument modifiers (brass/strings/percussion) that scale song potency.
- Added Bard sheet widget (instrument + cadence/maxActive controls) on Actor sheets.
- Bard sheet widget now includes a Now Playing panel (current performance + maintained songs remaining rounds).
- Implemented full Bard: songs + instruments + twisting cadence + synergy bonuses applied to attacks/damage.
- Bard sheet widget now includes a Bard Class Setup button (imports features + instruments onto the actor).
- Added Alternate Abilities framework: AA points, AA compendium, purchase UI, and level-vs-AA advancement mode.
- AA Browser now has category tabs, prereq chains, and a Respec AAs button (refund + remove).
- Added Berserker class module (features + disciplines) and Berserker AA set merged into the shared AA browser pack.
- Beastlord: added Warder Bond (owner->pet scaling on summon), Beastlord↔Warder focus synergy bonus (+1 damage), and Warder actor pack + summon spells (wolf/bear/tiger).
- Beastlord: added Warder Bond link UI widget (active warder + bond bonuses + one-click dismiss via socket flow).
- Players can configure pet AI + rename pets via a Pet Configuration UI (socket-authorized). GM receives whispered cues when players change pet settings.
- Pet rename: owners can rename pets via HUD Rename button (socket-authorized), with GM whisper cue.
- Necromancer + Shadowknight: undead/ncrotic pet packs + summon spells wired into the summon pipeline; undead bond scaling uses owner level + pet AAs.
- Necromancer: Undead Servant sheet widget shows active pet + bond bonuses, and allows Swap Variant + Dismiss using socket-authorized GM execution (GM gets cue).
- Shadowknight: Necrotic Minion sheet widget shows active minion + bond bonuses, and allows Re-summon + Dismiss via socket-authorized GM execution (GM gets cue).
- Enchanter: spells pack + AA merge + Charm control (charm sets condition + temporarily flips target token to friendly; dismissal/expiry restores disposition). Includes Enchanter sheet widget to show active charm + one-click Break Charm.
- Enchanter: Charm + Mez now use deterministic break checks on damage (per-hit chance). Mez defaults 35% (override via condition meta.breakChance). Charm defaults 20%+damage scaling, reduced by Charm Mastery flag, and can be overridden via charmed condition meta.breakChance.
- Enchanter AAs now modify mez/charm durations and break chances deterministically: Extended Mez adds rounds + reduces mez break chance; Charm Mastery adds rounds + reduces charm break chance; Total Domination further stabilizes charm.
- Bard: Lullaby now functions as a real mezzing control song via song pulse condition application (meta.pulseConditions). While maintained, it re-applies mezzed each pulse; damage can still break it, but the next pulse can re-mez if the song is still active.
- Added Ranger class module (spells, disciplines, AAs) and Ranger Companion pet module (companions + abilities). Includes Ranger Animal Companion sheet widget and core support for taunt meta + ranger archery bonuses.

- Added Druid class module (spells, wild shape, AAs) and Druid companion pet module.
