// EQ5e Tool — Auto‑Generated Header

// tools/validate-config.js
// Ensures that system.json is valid, complete, and structurally correct.

export default async function validateConfig({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    const systemPath = path.join(root, "system.json");
    if (!fs.existsSync(systemPath)) {
      console.log("✔ validate-config passed (no system.json found)");
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
    }

    if (!system) {
      report();
      return;
    }

    // ------------------------------------------------------------
    // Required fields
    // ------------------------------------------------------------
    function requireField(obj, field, type) {
      if (!(field in obj)) {
        issues.push({
          file: systemPath,
          message: `Missing required field: ${field}`
        });
        return;
      }
      if (typeof obj[field] !== type) {
        issues.push({
          file: systemPath,
          message: `Field '${field}' must be of type ${type}`
        });
      }
    }

    requireField(system, "id", "string");
    requireField(system, "title", "string");
    requireField(system, "version", "string");
    requireField(system, "compatibility", "object");

    // ------------------------------------------------------------
    // Validate id
    // ------------------------------------------------------------
    if (typeof system.id === "string") {
      const id = system.id;
      for (const ch of id) {
        const ok =
          (ch >= "a" && ch <= "z") ||
          (ch >= "0" && ch <= "9") ||
          ch === "-";
        if (!ok) {
          issues.push({
            file: systemPath,
            message: `Invalid character '${ch}' in system id`
          });
          break;
        }
      }
    }

    // ------------------------------------------------------------
    // Validate version (simple semver check)
    // ------------------------------------------------------------
    if (typeof system.version === "string") {
      const parts = system.version.split(".");
      if (
        parts.length !== 3 ||
        parts.some(p => isNaN(Number(p)))
      ) {
        issues.push({
          file: systemPath,
          message: `Version '${system.version}' is not valid semver (x.y.z)`
        });
      }
    }

    // ------------------------------------------------------------
    // Validate compatibility
    // ------------------------------------------------------------
    if (system.compatibility) {
      const c = system.compatibility;

      if (typeof c.minimum !== "string") {
        issues.push({
          file: systemPath,
          message: "compatibility.minimum must be a string"
        });
      }

      if (typeof c.verified !== "string") {
        issues.push({
          file: systemPath,
          message: "compatibility.verified must be a string"
        });
      }
    }

    // ------------------------------------------------------------
    // Validate arrays of strings
    // ------------------------------------------------------------
    function validateStringArray(field) {
      const arr = system[field];
      if (!arr) return;

      if (!Array.isArray(arr)) {
        issues.push({
          file: systemPath,
          message: `'${field}' must be an array`
        });
        return;
      }

      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] !== "string") {
          issues.push({
            file: systemPath,
            message: `'${field}[${i}]' must be a string`
          });
        }
      }
    }

    validateStringArray("scripts");
    validateStringArray("styles");
    validateStringArray("packs");
    validateStringArray("templates");
    validateStringArray("languages");

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    function report() {
      if (issues.length > 0) {
        console.log("❌ validate-config found issues:\n");
        for (const issue of issues) {
          console.log(` - ${issue.file} → ${issue.message}`);
        }
        if (strict) throw new Error("Config validation failed");
      } else {
        console.log("✔ validate-config passed");
      }
    }

    report();
  } catch (err) {
    console.log("⚠ validate-config encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
