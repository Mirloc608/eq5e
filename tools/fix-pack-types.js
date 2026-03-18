// EQ5e Tool — Auto‑Generated Header

// tools/fix-pack-types.js
// Corrects pack.json "type" and adds system.primaryType metadata.

export default async function fixPackTypes({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping fix-pack-types");
      return;
    }

    const files = fs
      .readdirSync(packsDir)
      .filter(f => f.endsWith(".json") && f !== "system.json");

    const fixed = [];

    // Canonical EQ‑5e pack types
    const VALID_PACK_TYPES = new Set([
      "Item",
      "Actor",
      "Scene",
      "JournalEntry",
      "RollTable",
      "Macro",
      "Cards",
      "Playlist",
      "Adventure",
      "Book"
    ]);

    for (const file of files) {
      const full = path.join(packsDir, file);
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));

      let modified = false;

      // Infer type from filename
      const inferred = inferPackType(file);

      // Fix pack.type
      if (!VALID_PACK_TYPES.has(raw.type)) {
        raw.type = inferred;
        modified = true;
        console.log(`✔ ${file}: corrected pack.type → "${inferred}"`);
      }

      // Ensure system.primaryType exists
      if (!raw.system) {
        raw.system = {};
        modified = true;
      }

      if (raw.system.primaryType !== inferred) {
        raw.system.primaryType = inferred;
        modified = true;
        console.log(`✔ ${file}: set system.primaryType → "${inferred}"`);
      }

      if (modified) {
        fs.writeFileSync(full, JSON.stringify(raw, null, 2));
        fixed.push(file);
      }
    }

    if (fixed.length > 0) {
      console.log("\n✔ fix-pack-types updated:");
      for (const f of fixed) console.log(" - " + f);
    } else {
      console.log("✔ fix-pack-types passed");
    }
  } catch (err) {
    console.log("⚠ fix-pack-types encountered an error");
    if (strict) throw err;
  }

  // Infer Foundry pack type from filename
  function inferPackType(filename) {
    const base = filename.replace(".json", "").toLowerCase();

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
