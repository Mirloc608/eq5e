// EQ5e Tool — Auto‑Generated Header

// tools/validate-sheet-path.js
// Ensures that every sheet path defined in system.json actually exists.

export default async function validateSheetPath({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");

    const systemPath = path.join(root, "system.json");
    const errors = [];

    if (!fs.existsSync(systemPath)) {
      console.log("⚠ system.json not found");
      if (strict) throw new Error("Sheet path validation failed");
      return;
    }

    const system = JSON.parse(fs.readFileSync(systemPath, "utf8"));

    const actorSheets = system.sheets?.Actor ?? {};
    const itemSheets = system.sheets?.Item ?? {};

    // Validate Actor sheet paths
    for (const [type, sheetPath] of Object.entries(actorSheets)) {
      const full = path.join(root, sheetPath);
      if (!fs.existsSync(full)) {
        errors.push(`Actor '${type}' sheet not found: ${sheetPath}`);
      }
    }

    // Validate Item sheet paths
    for (const [type, sheetPath] of Object.entries(itemSheets)) {
      const full = path.join(root, sheetPath);
      if (!fs.existsSync(full)) {
        errors.push(`Item '${type}' sheet not found: ${sheetPath}`);
      }
    }

    // Report
    if (errors.length > 0) {
      console.log("❌ validate-sheet-path found issues:\n");
      for (const err of errors) console.log(" - " + err);
      if (strict) throw new Error("Sheet path validation failed");
    } else {
      console.log("✔ validate-sheet-path passed");
    }
  } catch (err) {
    console.log("⚠ validate-sheet-path encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
