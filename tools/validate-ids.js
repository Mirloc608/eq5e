// EQ5e Tool — Auto‑Generated Header

// tools/validate-ids.js
// Ensures that all documents across all packs have valid, unique, non-empty _id fields.

export default async function validateIds({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");
    const issues = [];

    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-ids passed (no packs directory)");
      return;
    }

    const packFolders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    // Global ID registry: id → { pack, file }
    const globalIds = new Map();

    for (const folder of packFolders) {
      const packPath = path.join(packsDir, folder);
      const files = fs
        .readdirSync(packPath)
        .filter(f => f.endsWith(".json") && f !== "metadata.json");

      // Local pack-level ID registry
      const localIds = new Set();

      for (const file of files) {
        const full = path.join(packPath, file);

        let doc = null;
        try {
          const raw = fs.readFileSync(full, "utf8");
          doc = JSON.parse(raw);
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
          continue;
        }

        // Validate _id presence
        if (!doc._id) {
          issues.push({
            file: full,
            message: "Missing required _id field"
          });
          continue;
        }

        // Validate _id type
        if (typeof doc._id !== "string") {
          issues.push({
            file: full,
            message: `_id must be a string (found ${typeof doc._id})`
          });
          continue;
        }

        // Validate _id non-empty
        if (doc._id.trim().length === 0) {
          issues.push({
            file: full,
            message: "_id cannot be empty"
          });
          continue;
        }

        // Check local (pack-level) uniqueness
        if (localIds.has(doc._id)) {
          issues.push({
            file: full,
            message: `Duplicate _id '${doc._id}' within pack '${folder}'`
          });
        } else {
          localIds.add(doc._id);
        }

        // Check global uniqueness
        if (globalIds.has(doc._id)) {
          const prev = globalIds.get(doc._id);
          issues.push({
            file: full,
            message: `Duplicate _id '${doc._id}' also found in pack '${prev.pack}' file '${prev.file}'`
          });
        } else {
          globalIds.set(doc._id, { pack: folder, file });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-ids found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("ID validation failed");
    } else {
      console.log("✔ validate-ids passed");
    }
  } catch (err) {
    console.log("⚠ validate-ids encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
