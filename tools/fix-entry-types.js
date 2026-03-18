// EQ5e Tool — Auto‑Generated Header

// tools/fix-entry-types.js
// Normalizes entry.type values across all EQ5e JSON packs.

export default async function fixEntryTypes({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping fix-entry-types");
      return;
    }

    // Canonical EQ‑5e entry types
    const VALID_TYPES = new Set([
      "ability",
      "ambientEvent",
      "blackmarketSmuggling",
      "bountyHunter",
      "class",
      "crafting",
      "crimeAndJustice",
      "deity",
      "deityBoon",
      "discipline",
      "dungeon",
      "economy",
      "factionStanding",
      "factionTable",
      "faction",
      "gatheringSkill",
      "harvestable",
      "item",
      "lawEnforcementAI",
      "lawEnforcementPatrolRoute",
      "loot",
      "marketEvent",
      "npc",
      "pet",
      "quest",
      "race",
      "regionHazard",
      "regionMetadata",
      "resourceRefinement",
      "resourceTier",
      "smugglingMission",
      "socialBehavior",
      "song",
      "spawnTable",
      "spell",
      "startingCity",
      "transport",
      "travelPath",
      "vendorExpansion",
      "vendor",
      "weather",
      "zone"
    ]);

    const files = fs.readdirSync(packsDir).filter(f => f.endsWith(".json"));
    const fixed = [];

    for (const file of files) {
      const full = path.join(packsDir, file);
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));

      if (!Array.isArray(raw.entries)) continue;

      let modified = false;

      for (const entry of raw.entries) {
        const oldType = entry.type;

        // If missing or invalid, try to infer from filename
        if (!VALID_TYPES.has(oldType)) {
          const inferred = inferTypeFromFilename(file);

          if (inferred && VALID_TYPES.has(inferred)) {
            entry.type = inferred;
            modified = true;
            console.log(`✔ ${file}: fixed entry "${entry.name}" → type="${inferred}"`);
          } else {
            // fallback: mark as "item"
            entry.type = "item";
            modified = true;
            console.log(`✔ ${file}: fallback type applied to "${entry.name}"`);
          }
        }
      }

      if (modified) {
        fs.writeFileSync(full, JSON.stringify(raw, null, 2));
        fixed.push(file);
      }
    }

    if (fixed.length > 0) {
      console.log("\n✔ fix-entry-types updated:");
      for (const f of fixed) console.log(" - " + f);
    } else {
      console.log("✔ fix-entry-types passed");
    }
  } catch (err) {
    console.log("⚠ fix-entry-types encountered an error");
    if (strict) throw err;
  }

  // Infer type from filename prefix
  function inferTypeFromFilename(filename) {
    const base = filename.replace(".json", "").replace(/^eq-/, "");

    // Example: eq-abilities.json → "ability"
    if (base.endsWith("s")) return base.slice(0, -1);
    return base;
  }
}

// End of EQ5e Tool
