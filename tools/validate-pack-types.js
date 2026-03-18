// EQ5e Tool — Auto‑Generated Header

// tools/validate-pack-types.js
// Ensures all entries in each .db file match the pack.json declared type.

export default async function validatePackTypes({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping validate-pack-types");
      return;
    }

    const folders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const errors = [];

    for (const folder of folders) {
      const packPath = path.join(packsDir, folder);
      const metadataPath = path.join(packPath, "pack.json");

      if (!fs.existsSync(metadataPath)) {
        errors.push({
          pack: folder,
          message: "Missing pack.json (cannot validate types)"
        });
        continue;
      }

      let metadata;
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      } catch {
        errors.push({
          pack: folder,
          message: "Invalid JSON in pack.json"
        });
        continue;
      }

      const declaredType = metadata.type;
      const primaryType = metadata.system?.primaryType;

      if (!declaredType) {
        errors.push({
          pack: folder,
          message: "pack.json missing 'type'"
        });
        continue;
      }

      const dbFiles = fs.readdirSync(packPath).filter(f => f.endsWith(".db"));

      for (const db of dbFiles) {
        const full = path.join(packPath, db);
        const raw = fs.readFileSync(full, "utf8").trim();

        if (!raw) continue;

        const lines = raw.split("\n").filter(l => l.trim().length > 0);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let entry;

          try {
            entry = JSON.parse(line);
          } catch {
            errors.push({
              pack: folder,
              file: db,
              message: `Invalid JSON on line ${i + 1}`
            });
            continue;
          }

          // Missing type
          if (!entry.type) {
            errors.push({
              pack: folder,
              file: db,
              message: `Entry missing 'type' on line ${i + 1}`
            });
            continue;
          }

          // Type mismatch
          if (entry.type !== declaredType) {
            errors.push({
              pack: folder,
              file: db,
              message: `Entry type '${entry.type}' does not match pack type '${declaredType}' on line ${i + 1}`
            });
          }

          // primaryType mismatch
          if (primaryType && entry.type !== primaryType) {
            errors.push({
              pack: folder,
              file: db,
              message: `Entry type '${entry.type}' does not match system.primaryType '${primaryType}' on line ${i + 1}`
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      console.log("❌ validate-pack-types found issues:\n");
      for (const err of errors) {
        const loc = err.file ? `${err.pack}/${err.file}` : err.pack;
        console.log(` - ${loc}: ${err.message}`);
      }
      if (strict) throw new Error("Pack type validation failed");
    } else {
      console.log("✔ validate-pack-types passed");
    }
  } catch (err) {
    console.log("⚠ validate-pack-types encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
