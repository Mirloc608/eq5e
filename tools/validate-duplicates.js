// EQ5e Tool — Auto‑Generated Header

// tools/validate-duplicates.js
// Ensures no duplicate filenames or duplicate pack metadata names exist.

export default async function validateDuplicates({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const issues = [];

    // ------------------------------------------------------------
    // 1. Duplicate JS filenames in system code
    // ------------------------------------------------------------
    const SCAN_DIRS = ["module", "scripts", "src"];
    const seenFiles = new Map();

    function walk(dir) {
      const base = path.basename(dir);

      if (
        base === "node_modules" ||
        base === "dist" ||
        base === "packs" ||
        base === "tests"
      ) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const baseName = entry.name;
          if (seenFiles.has(baseName)) {
            issues.push({
              file: full,
              message: `Duplicate JS filename also found at ${seenFiles.get(baseName)}`
            });
          } else {
            seenFiles.set(baseName, full);
          }
        }
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    // ------------------------------------------------------------
    // 2. Duplicate pack folder names
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    const seenPackFolders = new Set();

    if (fs.existsSync(packsDir)) {
      const packFolders = fs
        .readdirSync(packsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folder of packFolders) {
        if (seenPackFolders.has(folder)) {
          issues.push({
            file: path.join(packsDir, folder),
            message: "Duplicate pack folder name"
          });
        } else {
          seenPackFolders.add(folder);
        }
      }

      // ------------------------------------------------------------
      // 3. Duplicate metadata.json → name fields
      // ------------------------------------------------------------
      const seenMetadataNames = new Map();

      for (const folder of packFolders) {
        const metadataPath = path.join(packsDir, folder, "metadata.json");
        if (!fs.existsSync(metadataPath)) continue;

        try {
          const raw = fs.readFileSync(metadataPath, "utf8");
          const meta = JSON.parse(raw);

          const name = meta.name;
          if (name) {
            if (seenMetadataNames.has(name)) {
              issues.push({
                file: metadataPath,
                message: `Duplicate metadata name '${name}' also found at ${seenMetadataNames.get(name)}`
              });
            } else {
              seenMetadataNames.set(name, metadataPath);
            }
          }
        } catch (err) {
          issues.push({
            file: metadataPath,
            message: `Invalid metadata.json (${err.message})`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-duplicates found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Duplicate validation failed");
    } else {
      console.log("✔ validate-duplicates passed");
    }
  } catch (err) {
    console.log("⚠ validate-duplicates encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
