// EQ5e Tool — Auto‑Generated Header

// tools/validate-system.js
// Validates the structure of system.json for required fields and sheet paths.

export default async function validateSystem({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const systemPath = path.join(root, "system.json");
    const errors = [];

    // ------------------------------------------------------------
    // Load system.json
    // ------------------------------------------------------------
    if (!fs.existsSync(systemPath)) {
      errors.push("Missing system.json");
    } else {
      try {
        const raw = fs.readFileSync(systemPath, "utf8");
        var system = JSON.parse(raw);
      } catch (err) {
        errors.push(`system.json is not valid JSON (${err.message})`);
      }
    }

    if (errors.length > 0) {
      console.log("❌ validate-system found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("System.json validation failed");
      return;
    }

    // ------------------------------------------------------------
    // Validate required top-level fields
    // ------------------------------------------------------------
    if (!("packs" in system)) {
      errors.push("Missing required top-level field 'packs'");
    } else if (!Array.isArray(system.packs)) {
      errors.push("packs must be an array");
    }

    // ------------------------------------------------------------
    // Validate sheet paths for Actor and Item types
    // ------------------------------------------------------------
    const actorTypes = system.types?.Actor?.types ?? [];
    const itemTypes = system.types?.Item?.types ?? [];

    const actorSheets = system.sheets?.Actor ?? {};
    const itemSheets = system.sheets?.Item ?? {};

    for (const type of actorTypes) {
      if (!(type in actorSheets)) {
        errors.push(`Actor type '${type}' missing sheet path in sheets.Actor`);
      }
    }

    for (const type of itemTypes) {
      if (!(type in itemSheets)) {
        errors.push(`Item type '${type}' missing sheet path in sheets.Item`);
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (errors.length > 0) {
      console.log("❌ validate-system found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("System.json validation failed");
    } else {
      console.log("✔ validate-system passed");
    }
  } catch (err) {
    console.log("⚠ validate-system encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
