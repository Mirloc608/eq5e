// EQ5e Tool — Auto‑Generated Header

// tools/validate-folders.js
// Ensures that all folder documents in packs are valid, unique, and structurally correct.

export default async function validateFolders({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const packsDir = path.join(root, "packs");
    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-folders passed (no packs directory)");
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

      const folders = new Map(); // id → folder doc
      const seenIds = new Set();

      // ------------------------------------------------------------
      // First pass: collect folder documents
      // ------------------------------------------------------------
      for (const file of files) {
        const full = path.join(packPath, file);

        try {
          const raw = fs.readFileSync(full, "utf8");
          const doc = JSON.parse(raw);

          if (doc.type === "Folder") {
            validateFolderBasics(doc, full, seenIds);
            folders.set(doc._id, doc);
          }
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }

      // ------------------------------------------------------------
      // Second pass: validate folder parent relationships
      // ------------------------------------------------------------
      for (const [id, folderDoc] of folders.entries()) {
        if (folderDoc.parent) {
          if (!folders.has(folderDoc.parent)) {
            issues.push({
              file: `${packPath}/${id}.json`,
              message: `Folder parent '${folderDoc.parent}' does not exist`
            });
          }
        }
      }

      // ------------------------------------------------------------
      // Third pass: validate folder type consistency
      // ------------------------------------------------------------
      for (const file of files) {
        const full = path.join(packPath, file);

        try {
          const raw = fs.readFileSync(full, "utf8");
          const doc = JSON.parse(raw);

          if (doc.type === "Folder") continue;

          if (doc.folder) {
            const folderDoc = folders.get(doc.folder);
            if (!folderDoc) {
              issues.push({
                file: full,
                message: `Document references missing folder '${doc.folder}'`
              });
            } else if (folderDoc.type !== doc.type) {
              issues.push({
                file: full,
                message: `Document type '${doc.type}' does not match folder type '${folderDoc.type}'`
              });
            }
          }
        } catch {
          // Already handled in first pass
        }
      }
    }

    // ------------------------------------------------------------
    // Folder validation rules
    // ------------------------------------------------------------
    function validateFolderBasics(doc, source, seenIds) {
      if (!doc._id || typeof doc._id !== "string") {
        issues.push({
          file: source,
          message: "Folder missing required field: _id"
        });
      } else if (seenIds.has(doc._id)) {
        issues.push({
          file: source,
          message: `Duplicate folder _id '${doc._id}'`
        });
      } else {
        seenIds.add(doc._id);
      }

      if (!doc.name || typeof doc.name !== "string") {
        issues.push({
          file: source,
          message: "Folder missing required field: name"
        });
      }

      if (!doc.type || typeof doc.type !== "string") {
        issues.push({
          file: source,
          message: "Folder missing required field: type"
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-folders found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Folder validation failed");
    } else {
      console.log("✔ validate-folders passed");
    }
  } catch (err) {
    console.log("⚠ validate-folders encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
