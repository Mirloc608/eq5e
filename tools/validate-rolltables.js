// EQ5e Tool — Auto‑Generated Header

// tools/validate-rolltables.js
// Ensures that all RollTable documents in packs are valid and structurally complete.

export default async function validateRolltables({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const issues = [];

    // ------------------------------------------------------------
    // Scan packs for rolltable documents
    // ------------------------------------------------------------
    const packsDir = path.join(root, "packs");
    if (!fs.existsSync(packsDir)) {
      console.log("✔ validate-rolltables passed (no packs directory)");
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

          // Only validate rolltables
          if (doc.type === "RollTable") {
            validateRolltable(doc, full);
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
    // Rolltable validation rules
    // ------------------------------------------------------------
    function validateRolltable(doc, source) {
      if (!doc.name || typeof doc.name !== "string") {
        issues.push({
          file: source,
          message: "RollTable missing required field: name"
        });
      }

      if (!doc.formula || typeof doc.formula !== "string") {
        issues.push({
          file: source,
          message: "RollTable missing required field: formula"
        });
      }

      if (!Array.isArray(doc.results)) {
        issues.push({
          file: source,
          message: "RollTable missing required field: results[]"
        });
        return;
      }

      for (let i = 0; i < doc.results.length; i++) {
        const r = doc.results[i];
        const prefix = `${source} (result ${i + 1})`;

        // Range must be [min, max]
        if (
          !Array.isArray(r.range) ||
          r.range.length !== 2 ||
          typeof r.range[0] !== "number" ||
          typeof r.range[1] !== "number"
        ) {
          issues.push({
            file: prefix,
            message: "Invalid or missing range [min, max]"
          });
        }

        // Must have either text OR a document reference
        const hasText = typeof r.text === "string" && r.text.length > 0;
        const hasDocRef =
          typeof r.documentCollection === "string" &&
          typeof r.documentId === "string";

        if (!hasText && !hasDocRef) {
          issues.push({
            file: prefix,
            message: "Result must have either text or a document reference"
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-rolltables found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Rolltable validation failed");
    } else {
      console.log("✔ validate-rolltables passed");
    }
  } catch (err) {
    console.log("⚠ validate-rolltables encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
