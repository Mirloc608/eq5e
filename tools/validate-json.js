// EQ5e Tool — Auto‑Generated Header

// tools/validate-json.js
// Ensures that all JSON files in the system are valid JSON.

export default async function validateJson({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const issues = [];

    // Directories to scan for JSON files
    const SCAN_DIRS = ["module", "scripts", "src"];

    function walk(dir) {
      const base = path.basename(dir);

      // Skip irrelevant directories
      if (
        base === "node_modules" ||
        base === "dist" ||
        base === "packs" || // packs handled separately
        base === "tests"
      ) {
        return;
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          validateJsonFile(full);
        }
      }
    }

    function validateJsonFile(filePath) {
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        JSON.parse(raw);
      } catch (err) {
        issues.push({
          file: filePath,
          message: `Invalid JSON (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // Validate root-level JSON files
    // ------------------------------------------------------------
    const rootFiles = fs.readdirSync(root);
    for (const file of rootFiles) {
      if (file.endsWith(".json")) {
        validateJsonFile(path.join(root, file));
      }
    }

    // ------------------------------------------------------------
    // Validate JSON files in system code directories
    // ------------------------------------------------------------
    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    // ------------------------------------------------------------
    // Validate metadata.json inside packs
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (fs.existsSync(packsDir)) {
      const packFolders = fs
        .readdirSync(packsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folder of packFolders) {
        const metadataPath = path.join(packsDir, folder, "metadata.json");
        if (fs.existsSync(metadataPath)) {
          validateJsonFile(metadataPath);
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-json found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("JSON validation failed");
    } else {
      console.log("✔ validate-json passed");
    }
  } catch (err) {
    console.log("⚠ validate-json encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
