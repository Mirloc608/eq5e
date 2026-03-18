// EQ5e Tool — Auto‑Generated Header

// tools/validate-localization.js
// Ensures that all localization files are valid and all referenced keys exist.

export default async function validateLocalization({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const issues = [];

    // ------------------------------------------------------------
    // 1. Load all localization files
    // ------------------------------------------------------------
    const langDir = path.join(root, "lang");
    const localization = {};

    if (fs.existsSync(langDir)) {
      const files = fs
        .readdirSync(langDir)
        .filter(f => f.endsWith(".json"));

      for (const file of files) {
        const full = path.join(langDir, file);
        try {
          const raw = fs.readFileSync(full, "utf8");
          const parsed = JSON.parse(raw);

          if (typeof parsed !== "object" || parsed === null) {
            issues.push({
              file: full,
              message: "Localization file must contain a JSON object"
            });
            continue;
          }

          localization[file] = parsed;
        } catch (err) {
          issues.push({
            file: full,
            message: `Invalid JSON (${err.message})`
          });
        }
      }
    }

    // Merge all localization keys into one flat set
    const allKeys = new Set();
    for (const file of Object.keys(localization)) {
      const obj = localization[file];
      for (const key of Object.keys(obj)) {
        if (allKeys.has(key)) {
          issues.push({
            file: path.join(langDir, file),
            message: `Duplicate localization key '${key}'`
          });
        }
        allKeys.add(key);
      }
    }

    // ------------------------------------------------------------
    // 2. Scan system code for localization references
    // ------------------------------------------------------------
    const SCAN_DIRS = ["module", "scripts", "src"];

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
          scanFile(full);
        }
      }
    }

    function scanFile(filePath) {
      const raw = fs.readFileSync(filePath, "utf8");
      const lines = raw.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for game.i18n.localize("KEY")
        const idx = line.indexOf("localize(");
        if (idx === -1) continue;

        const quote = line.includes('"') ? '"' : line.includes("'") ? "'" : null;
        if (!quote) continue;

        const start = line.indexOf(quote, idx);
        const end = line.indexOf(quote, start + 1);
        if (start === -1 || end === -1) continue;

        const key = line.slice(start + 1, end);

        if (!allKeys.has(key)) {
          issues.push({
            file: `${filePath}:${i + 1}`,
            message: `Missing localization key '${key}'`
          });
        }
      }
    }

    for (const dir of SCAN_DIRS) {
      const full = path.join(root, dir);
      if (fs.existsSync(full)) walk(full);
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-localization found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Localization validation failed");
    } else {
      console.log("✔ validate-localization passed");
    }
  } catch (err) {
    console.log("⚠ validate-localization encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
