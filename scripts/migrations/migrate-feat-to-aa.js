/* -------------------------------------------- */
/* Feat -> AA Migration (Foundry v13)            */
/* -------------------------------------------- */

export async function migrateCompendiumItems(pack, { dryRun = false } = {}) {
  if (!pack) return;

  const packKey = pack.collection; // e.g. "world.eq5e-ranger-disciplines"
  const docs = await pack.getDocuments();

  // Example: convert items of type "feat" to type "aa"
  const toConvert = docs.filter(d => d?.documentName === "Item" && d.type === "feat");
  if (!toConvert.length) return;

  console.log(`[EQ5E] Migrating ${toConvert.length} feat(s) -> aa in ${packKey}`);

  const createdIds = [];
  const deleteIds = [];

  for (const feat of toConvert) {
    // Build AA item data from feat
    const aaData = feat.toObject();
    aaData.type = "aa";
    aaData.name = aaData.name; // keep name; adjust if desired
    aaData.system = aaData.system ?? {};

    // Optional: move feat fields into aa system structure here
    // aaData.system.rank = aaData.system.rank ?? 1;

    if (dryRun) {
      console.log(`[EQ5E] DRY RUN would create aa from feat: ${feat.name} (${feat.id})`);
      continue;
    }

    try {
      const created = await Item.create(aaData, { pack: packKey });
      if (created) {
        createdIds.push(created.id);
        deleteIds.push(feat.id);
      }
    } catch (err) {
      console.error(`[EQ5E] Failed creating aa item from feat ${feat.name} (${feat.id}) in ${packKey}`, err);
      // Do NOT schedule deletion if create failed
    }
  }

  // Only delete the old feats if we created replacements
  if (!dryRun && deleteIds.length) {
    if (pack.locked) {
      ui.notifications?.warn?.(`[EQ5E] Pack is locked (${packKey}); cannot delete old feats. Unlock and re-run.`);
      console.warn(`[EQ5E] Pack locked, skipping delete in ${packKey}`);
      return;
    }

    try {
      await Item.implementation.deleteDocuments(deleteIds, { pack: packKey });
      console.log(`[EQ5E] Deleted ${deleteIds.length} old feat(s) from ${packKey}`);
    } catch (err) {
      console.error(`[EQ5E] Failed deleting old feats from ${packKey}`, err);
      throw err;
    }
  }
}

export async function runFeatToAAMigration({ dryRun = false } = {}) {
  // Adjust the list of packs you want to migrate.
  // You can also make this auto-detect by scanning game.packs for keys.
  const packKeys = [
    "world.eq5e-ranger-disciplines"
  ];

  for (const key of packKeys) {
    const pack = game.packs.get(key);
    if (!pack) {
      console.warn(`[EQ5E] Missing pack: ${key}`);
      continue;
    }
    await migrateCompendiumItems(pack, { dryRun });
  }
}