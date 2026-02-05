# EQ5e Mounts Bundle (Classic → Planes of Power)

This bundle generates *world* compendiums for mounts by era:

- world.eq5e-mounts-classic
- world.eq5e-mounts-kunark
- world.eq5e-mounts-velious
- world.eq5e-mounts-luclin
- world.eq5e-mounts-pop

Implementation notes:
- Item type is **consumable** for compatibility with current eq5e system.json.
- Mount metadata is stored in:
  - flags.eq5e.category = "mount"
  - flags.eq5e.mount.{era,type,speed}
  - system.mount.{era,type,speed}
- Deterministic upsert key: flags.eq5e.sourceId
- Deterministic change detection: flags.eq5e.derivedHash
- If your system provides `game.eq5e.normalizeItemForFoundry` (AE normalizer), it is used automatically.
