# Threat and Aggro

## Basics
Each hostile NPC maintains a threat table. The NPC targets the highest threat actor unless overridden by specific mechanics (e.g., scripted behavior).

## Common sources
- Damage: generates threat on the damaged NPC
- Healing: can generate threat on nearby hostiles (depending on ruleset implementation)
- Taunts: add snap threat and/or force target briefly
- Pet threat: pets generate threat and may transfer a portion to their owner based on settings/AAs

## Snap vs sustained
- **Snap tools**: quick threat spike (good for “oh no” moments)
- **Sustained tools**: consistent threat generation over time (good for holding)

## Why did the mob turn?
- DPS spiked
- Healing spike created threat
- Threat decay / transfer changed ordering
- Taunt immunity or resist
