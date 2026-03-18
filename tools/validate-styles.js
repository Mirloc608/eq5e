// EQ5e Tool — Auto‑Generated Header

// tools/validate-styles.js
// Ensures that all stylesheet paths referenced in system.json exist and use valid extensions.

export default async function validateStyles({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const systemPath = path.join(root, "system.json");
    if (!fs.existsSync(systemPath)) {
      console.log("✔ validate-styles passed (no system.json found)");
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

    const styles = system.styles;
    if (!styles) {
      console.log("✔ validate-styles passed (no styles defined)");
      return;
    }

    if (!Array.isArray(styles)) {
      issues.push({
        file: systemPath,
        message: "styles must be an array"
      });
      report();
      return;
    }

    // ------------------------------------------------------------
    // Validate each stylesheet entry
    // ------------------------------------------------------------
    for (let i = 0; i < styles.length; i++) {
      const entry = styles[i];

      if (typeof entry !== "string") {
        issues.push({
          file: systemPath,
          message: `styles[${i}] must be a string`
        });
        continue;
      }

      if (!entry.endsWith(".css")) {
        issues.push({
          file: systemPath,
          message: `styles[${i}] must end with .css (${entry})`
        });
      }

      const full = path.join(root, entry);
      if (!fs.existsSync(full)) {
        issues.push({
          file: systemPath,
          message: `Missing stylesheet file: ${entry}`
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-styles found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("Stylesheet validation failed");
      } else {
        console.log("✔ validate-styles passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-styles encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
