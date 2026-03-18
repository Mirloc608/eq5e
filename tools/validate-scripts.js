// EQ5e Tool — Auto‑Generated Header

// tools/validate-scripts.js
// Ensures that all script paths referenced in system.json exist and use valid extensions.

export default async function validateScripts({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const systemPath = path.join(root, "system.json");
    if (!fs.existsSync(systemPath)) {
      console.log("✔ validate-scripts passed (no system.json found)");
      return;
    }

    let system = null;

    // ------------------------------------------------------------
    // Load system.json
    // ------------------------------------------------------------
    try {
      const raw = fs.readFileSync(systemPath, "utf8");
      system = JSON.parse(raw);
    } catch (err) {
      issues.push({
        file: systemPath,
        message: `Invalid JSON (${err.message})`
      });
      report();
      return;
    }

    const scripts = system.scripts;
    if (!scripts) {
      console.log("✔ validate-scripts passed (no scripts defined)");
      return;
    }

    if (!Array.isArray(scripts)) {
      issues.push({
        file: systemPath,
        message: "scripts must be an array"
      });
      report();
      return;
    }

    // ------------------------------------------------------------
    // Validate each script entry
    // ------------------------------------------------------------
    for (let i = 0; i < scripts.length; i++) {
      const entry = scripts[i];

      if (typeof entry !== "string") {
        issues.push({
          file: systemPath,
          message: `scripts[${i}] must be a string`
        });
        continue;
      }

      if (!entry.endsWith(".js")) {
        issues.push({
          file: systemPath,
          message: `scripts[${i}] must end with .js (${entry})`
        });
      }

      const full = path.join(root, entry);
      if (!fs.existsSync(full)) {
        issues.push({
          file: systemPath,
          message: `Missing script file: ${entry}`
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-scripts found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("Script validation failed");
      } else {
        console.log("✔ validate-scripts passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-scripts encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
