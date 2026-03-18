// EQ5e Tool — Auto‑Generated Header

// tools/fix-packs.js
// Repairs malformed EQ5e JSON packs: wraps arrays, normalizes structure, generates IDs.

export default async function fixPacks({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const crypto = await import("node:crypto");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping fix-packs");
      return;
    }

    const files = fs.readdirSync(packsDir).filter(f => f.endsWith(".json"));
    const fixed = [];

    for (const file of files) {
      const full = path.join(packsDir, file);
      let rawText = fs.readFileSync(full, "utf8");

      // Remove comments (block + line)
      rawText = rawText
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        console.log(`❌ ${file}: JSON parse failed`);
        if (strict) throw new Error(`Invalid JSON in ${file}`);
        continue;
      }

      let modified = false;

      // If the pack is a raw array, wrap it
      if (Array.isArray(data)) {
        data = {
          name: file.replace(".json", ""),
          label: file.replace(".json", ""),
          entries: data
        };
        modified = true;
        console.log(`✔ Wrapped raw array → pack object: ${file}`);
      }

      // Ensure entries exists
      if (!Array.isArray(data.entries)) {
        data.entries = [];
        modified = true;
        console.log(`✔ Added missing entries[] to ${file}`);
      }

      // Normalize each entry
      for (const entry of data.entries) {
        // Generate missing _id
        if (!entry._id) {
          entry._id = crypto.randomUUID();
          modified = true;
          console.log(`✔ ${file}: generated _id for "${entry.name || "unnamed"}"`);
        }

        // Trim whitespace in names
        if (entry.name && entry.name !== entry.name.trim()) {
          entry.name = entry.name.trim();
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(full, JSON.stringify(data, null, 2));
        fixed.push(file);
      }
    }

    if (fixed.length > 0) {
      console.log("\n✔ fix-packs updated:");
      for (const f of fixed) console.log(" - " + f);
    } else {
      console.log("✔ fix-packs passed");
    }
  } catch (err) {
    console.log("⚠ fix-packs encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
