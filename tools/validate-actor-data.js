// EQ5e Tool — Auto‑Generated Header

// tools/validate-actor-data.js
// Ensures that all Actor documents in packs are valid and match system.json definitions.

export default async function validateActorData({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Load system.json to get allowed actor types
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    let allowedTypes = [];

    if (fs.existsSync(systemPath)) {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        const system = JSON.parse(raw);
        allowedTypes = system.types?.Actor?.types ?? [];
      } catch (err) {
        issues.push({
          file: systemPath,
          message: `Invalid system.json (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // Scan packs for actor documents
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-actor-data passed (no packs directory)");
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

      for (const file of files) {
        const full = path.join(packPath, file);

        try {
          const raw = fs.readFileSync(full, "utf8");
          const doc = JSON.parse(raw);

          // Only validate actor documents
          if (doc.type && allowedTypes.includes(doc.type)) {
            validateActor(doc, full);
          }
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Actor validation rules
    // ------------------------------------------------------------
    function validateActor(doc, source) {
      if (!doc.name || typeof doc.name !== "string") {
        issues.push({
          file: source,
          message: "Actor missing required field: name"
        });
      }

      if (!doc.type || typeof doc.type !== "string") {
        issues.push({
          file: source,
          message: "Actor missing required field: type"
        });
      } else if (!allowedTypes.includes(doc.type)) {
        issues.push({
          file: source,
          message: `Actor type '${doc.type}' is not defined in system.json`
        });
      }

      if (!doc.img || typeof doc.img !== "string") {
        issues.push({
          file: source,
          message: "Actor missing required field: img"
        });
      }

      if (!doc.system || typeof doc.system !== "object") {
        issues.push({
          file: source,
          message: "Actor missing required field: system"
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-actor-data found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Actor data validation failed");
    } else {
      console.log("✔ validate-actor-data passed");
    }
  } catch (err) {
    console.log("⚠ validate-actor-data encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
