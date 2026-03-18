// EQ5e Tool — Auto‑Generated Header

// tools/generate-pack-metadata.js
// Generates pack.json metadata files for each pack folder in /packs.

export default async function generatePackMetadata({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping generate-pack-metadata");
      return;
    }

    const folders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const fixed = [];

    for (const folder of folders) {
      const packPath = path.join(packsDir, folder);
      const metadataPath = path.join(packPath, "pack.json");

      let metadata = {};

      // Load existing metadata if present
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        } catch {
          console.log(`⚠ ${folder}/pack.json is invalid JSON — regenerating`);
          metadata = {};
        }
      }

      const inferredType = inferPackType(folder);

      const expected = {
        name: folder,
        label: toLabel(folder),
        path: `packs/${folder}.db`,
        type: inferredType,
        system: {
          primaryType: inferredType
        }
      };

      let modified = false;

      // Fill missing fields
      for (const key of Object.keys(expected)) {
        if (metadata[key] === undefined) {
          metadata[key] = expected[key];
          modified = true;
          console.log(`✔ ${folder}: added missing field "${key}"`);
        }
      }

      // Ensure system.primaryType
      if (!metadata.system) {
        metadata.system = { primaryType: inferredType };
        modified = true;
      } else if (metadata.system.primaryType !== inferredType) {
        metadata.system.primaryType = inferredType;
        modified = true;
        console.log(`✔ ${folder}: corrected system.primaryType → "${inferredType}"`);
      }

      if (modified) {
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
        fixed.push(folder);
      }
    }

    if (fixed.length > 0) {
      console.log("\n✔ generate-pack-metadata updated:");
      for (const f of fixed) console.log(" - " + f);
    } else {
      console.log("✔ generate-pack-metadata passed");
    }
  } catch (err) {
    console.log("⚠ generate-pack-metadata encountered an error");
    if (strict) throw err;
  }

  // Convert folder name → human label
  function toLabel(name) {
    return name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // Infer Foundry pack type from folder name
  function inferPackType(folder) {
    const base = folder.toLowerCase();

    if (base.includes("items")) return "Item";
    if (base.includes("actors")) return "Actor";
    if (base.includes("scenes")) return "Scene";
    if (base.includes("tables")) return "RollTable";
    if (base.includes("journal")) return "JournalEntry";
    if (base.includes("macros")) return "Macro";
    if (base.includes("cards")) return "Cards";
    if (base.includes("playlists")) return "Playlist";
    if (base.includes("adventure")) return "Adventure";
    if (base.includes("book")) return "Book";

    // Default fallback
    return "Item";
  }
}

// End of EQ5e Tool
