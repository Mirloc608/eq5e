// EQ5e Tool — Auto‑Generated Header

// tools/validate-pack-metadata.js
// Ensures that each pack folder contains a valid metadata.json file.

export default async function validatePackMetadata({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const packsDir = path.join(root, "packs");

    const errors = [];

    // Check packs directory
    if (!fs.existsSync(packsDir)) {
      console.log("⚠ packs directory not found");
      if (strict) throw new Error("Pack metadata validation failed");
      return;
    }

    const packFolders = fs
      .readdirSync(packsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    if (packFolders.length === 0) {
      console.log("⚠ No pack folders found in packs/");
      if (strict) throw new Error("Pack metadata validation failed");
      return;
    }

    // Validate each pack
    for (const folder of packFolders) {
      const metadataPath = path.join(packsDir, folder, "metadata.json");

      if (!fs.existsSync(metadataPath)) {
        errors.push(`Pack '${folder}' missing metadata.json`);
        continue;
      }

      try {
        const raw = fs.readFileSync(metadataPath, "utf8");
        const meta = JSON.parse(raw);

        const required = ["name", "label", "system", "path", "type"];
        for (const key of required) {
          if (!(key in meta)) {
            errors.push(`Pack '${folder}' metadata.json missing required field '${key}'`);
          }
        }
      } catch (err) {
        errors.push(`Pack '${folder}' metadata.json is invalid JSON (${err.message})`);
      }
    }

    // Report
    if (errors.length > 0) {
      console.log("❌ validate-pack-metadata found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Pack metadata validation failed");
    } else {
      console.log("✔ validate-pack-metadata passed");
    }
  } catch (err) {
    console.log("⚠ validate-pack-metadata encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
