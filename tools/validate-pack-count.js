// EQ5e Tool — Auto‑Generated Header

// tools/validate-pack-count.js
// Ensures each pack folder contains non-empty .db files with valid JSON entries.

export default async function validatePackCount({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    if (!fs.existsSync(packsDir)) {
      console.log("⚠ No packs directory found, skipping validate-pack-count");
      return;
    }

    const folders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    const errors = [];

    for (const folder of folders) {
      const packPath = path.join(packsDir, folder);

      // Find .db files
      const dbFiles = fs
        .readdirSync(packPath)
        .filter(f => f.endsWith(".db"));

      if (dbFiles.length === 0) {
        errors.push({
          pack: folder,
          message: "Pack contains no .db files"
        });
        continue;
      }

      for (const db of dbFiles) {
        const full = path.join(packPath, db);
        const raw = fs.readFileSync(full, "utf8").trim();

        if (!raw) {
          errors.push({
            pack: folder,
            file: db,
            message: "Empty .db file"
          });
          continue;
        }

        const lines = raw.split("\n").filter(l => l.trim().length > 0);

        if (lines.length === 0) {
          errors.push({
            pack: folder,
            file: db,
            message: "No valid entries in .db file"
          });
          continue;
        }

        // Validate each line is valid JSON
        for (const [i, line] of lines.entries()) {
          try {
            JSON.parse(line);
          } catch {
            errors.push({
              pack: folder,
              file: db,
              message: `Invalid JSON on line ${i + 1}`
            });
            break;
          }
        }
      }
    }

    if (errors.length > 0) {
      console.log("❌ validate-pack-count found issues:\n");
      for (const err of errors) {
        const loc = err.file ? `${err.pack}/${err.file}` : err.pack;
        console.log(` - ${loc}: ${err.message}`);
      }
      if (strict) throw new Error("Pack count validation failed");
    } else {
      console.log("✔ validate-pack-count passed");
    }
  } catch (err) {
    console.log("⚠ validate-pack-count encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
