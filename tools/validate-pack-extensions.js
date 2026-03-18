// EQ5e Tool — Auto‑Generated Header

// tools/validate-pack-extensions.js
// Ensures that each pack folder contains only valid FoundryVTT pack file extensions.

export default async function validatePackExtensions({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    const errors = [];

    // Ensure packs directory exists
    if (!fs.existsSync(packsDir)) {
      console.log("⚠ packs directory not found");
      if (strict) throw new Error("Pack extension validation failed");
      return;
    }

    const packFolders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    if (packFolders.length === 0) {
      console.log("⚠ No pack folders found in packs/");
      if (strict) throw new Error("Pack extension validation failed");
      return;
    }

    // Allowed extensions
    const allowed = new Set([
      ".json",
      ".db",
      ".db-shm",
      ".db-wal"
    ]);

    // Validate each pack folder
    for (const folder of packFolders) {
      const folderPath = path.join(packsDir, folder);
      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        const full = path.join(folderPath, file);

        // Skip directories inside packs (should not exist)
        if (fs.statSync(full).isDirectory()) {
          errors.push(`Unexpected directory inside pack '${folder}': ${file}`);
          continue;
        }

        // metadata.json is always allowed
        if (file === "metadata.json") continue;

        // Validate extension
        const ext = file.includes(".") ? file.slice(file.indexOf(".")) : "";

        if (!allowed.has(ext)) {
          errors.push(`Invalid file in pack '${folder}': ${file}`);
        }
      }
    }

    // Report
    if (errors.length > 0) {
      console.log("❌ validate-pack-extensions found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Pack extension validation failed");
    } else {
      console.log("✔ validate-pack-extensions passed");
    }
  } catch (err) {
    console.log("⚠ validate-pack-extensions encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
