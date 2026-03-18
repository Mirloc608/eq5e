// EQ5e Tool — Auto‑Generated Header

// tools/validate-collections.js
// Ensures that all Foundry document collections in packs are valid and structurally complete.

export default async function validateCollections({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Scan packs for documents
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-collections passed (no packs directory)");
      return;
    }

    const packFolders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const folder of packFolders) {
      const packPath = path.join(packsDir, folder);
      const files = fs
        .readdirSync(packPath)
        .filter(f => f.endsWith(".json") && f !== "metadata.json");

      const seenIds = new Set();

      for (const file of files) {
        const full = path.join(packPath, file);

        try {
          const raw = fs.readFileSync(full, "utf8");
          const doc = JSON.parse(raw);

          validateDocument(doc, full, seenIds);
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Document validation rules
    // ------------------------------------------------------------
    function validateDocument(doc, source, seenIds) {
      if (!doc || typeof doc !== "object") {
        issues.push({
          file: source,
          message: "Document is not a valid object"
        });
        return;
      }

      // _id
      if (!doc._id || typeof doc._id !== "string") {
        issues.push({
          file: source,
          message: "Document missing required field: _id"
        });
      } else if (seenIds.has(doc._id)) {
        issues.push({
          file: source,
          message: `Duplicate _id '${doc._id}' within pack`
        });
      } else {
        seenIds.add(doc._id);
      }

      // name
      if (!doc.name || typeof doc.name !== "string") {
        issues.push({
          file: source,
          message: "Document missing required field: name"
        });
      }

      // type
      if (!doc.type || typeof doc.type !== "string") {
        issues.push({
          file: source,
          message: "Document missing required field: type"
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-collections found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Collection validation failed");
    } else {
      console.log("✔ validate-collections passed");
    }
  } catch (err) {
    console.log("⚠ validate-collections encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
