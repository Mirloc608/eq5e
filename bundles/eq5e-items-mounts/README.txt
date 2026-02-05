EQ5e Mount Compendiums (Kunark → Planes of Power)

Drop-in location (system bundle):
  systems/eq5e/bundles/eq5e-items-mounts/

Files included:
  scripts/main.js
  data/mounts_kunark.json
  data/mounts_velious.json
  data/mounts_luclin.json
  data/mounts_planes.json
  data/mount_gear_tack.json
  data/mount_gear_barding.json

What it does:
- On GM startup (ready hook), creates/updates world packs:
  world.eq5e-mounts-kunark
  world.eq5e-mounts-velious
  world.eq5e-mounts-luclin
  world.eq5e-mounts-planes
  world.eq5e-mount-gear

Compatibility note:
- If your system.json does NOT yet define Item types "mount" and "mountGear",
  the loader will fall back to "equipment" (or "consumable") automatically and
  preserve the semantic type in flags.eq5e.semanticType.
