// EQ5e Tool — Auto‑Generated Header

// tools/validate-licenses.js
// Ensures that all third-party assets referenced in the system have valid license declarations.

export default async function validateLicenses({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Load system.json
    // ------------------------------------------------------------
    const systemPath = path.join(root, "system.json");
    if (!fs.existsSync(systemPath)) {
      console.log("✔ validate-licenses passed (no system.json found)");
      return;
    }

    let system = null;
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

    // ------------------------------------------------------------
    // Collect all referenced third-party assets
    // ------------------------------------------------------------
    const referenced = new Set();

    function collect(obj) {
      if (!obj || typeof obj !== "object") return;
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (typeof val === "string") {
          referenced.add(val);
        } else if (Array.isArray(val)) {
          for (const v of val) {
            if (typeof v === "string") referenced.add(v);
            else if (typeof v === "object") collect(v);
          }
        } else if (typeof val === "object") {
          collect(val);
        }
      }
    }

    if (system.dependencies) collect(system.dependencies);
    if (system.credits) collect(system.credits);
    if (system.authors) collect(system.authors);
    if (system.assets) collect(system.assets);

    // ------------------------------------------------------------
    // Validate licenses folder
    // ------------------------------------------------------------
    const licensesDir = path.join(root, "licenses");
    if (!fs.existsSync(licensesDir)) {
      issues.push({
        file: licensesDir,
        message: "Missing licenses/ directory"
      });
      report();
      return;
    }

    const licenseFiles = fs
      .readdirSync(licensesDir)
      .filter(f => f.endsWith(".txt") || f.endsWith(".md"));

    const licenseMap = new Map();
    for (const file of licenseFiles) {
      const full = path.join(licensesDir, file);
      try {
        const raw = fs.readFileSync(full, "utf8");
        if (raw.trim().length === 0) {
          issues.push({
            file: full,
            message: "License file is empty"
          });
        }
        licenseMap.set(file, raw);
      } catch (err) {
        issues.push({
          file: full,
          message: `Unable to read license file (${err.message})`
        });
      }
    }

    // ------------------------------------------------------------
    // Ensure each referenced asset has a license file
    // ------------------------------------------------------------
    for (const asset of referenced) {
      const expected = `${asset}.txt`;
      if (!licenseMap.has(expected)) {
        issues.push({
          file: systemPath,
          message: `Missing license file for asset '${asset}' (expected ${expected})`
        });
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-licenses found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("License validation failed");
      } else {
        console.log("✔ validate-licenses passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-licenses encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
