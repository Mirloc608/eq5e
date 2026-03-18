// EQ5e Tool — Auto‑Generated Header

// tools/validate-templates-fields.js
// Ensures that all Handlebars field references inside templates correspond to
// real fields in the TypeScript data models.

export default async function validateTemplateFields({ strict = false } = {}) {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");

  try {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const root = path.resolve(__dirname, "..");
    const templatesDir = path.join(root, "templates");
    const srcDir = path.join(root, "src");
    const issues = [];

    if (!fs.existsSync(templatesDir)) {
      console.log("✔ validate-templates-fields passed (no templates directory)");
      return;
    }

    // ------------------------------------------------------------
    // Load TypeScript model files (actor + item)
    // ------------------------------------------------------------
    const modelPaths = [
      path.join(srcDir, "documents", "actor", "data.ts"),
      path.join(srcDir, "documents", "item", "data.ts")
    ];

    const modelFields = new Set();

    for (const file of modelPaths) {
      if (!fs.existsSync(file)) continue;

      const raw = fs.readFileSync(file, "utf8");
      const lines = raw.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();

        // Very safe, non-regex extraction of "field: type" patterns
        const colon = trimmed.indexOf(":");
        if (colon === -1) continue;

        const key = trimmed.slice(0, colon).trim();
        if (!key) continue;

        // Only accept simple identifiers
        let valid = true;
        for (const ch of key) {
          const ok =
            (ch >= "a" && ch <= "z") ||
            (ch >= "A" && ch <= "Z") ||
            (ch >= "0" && ch <= "9") ||
            ch === "_" ||
            ch === "$";
          if (!ok) {
            valid = false;
            break;
          }
        }

        if (valid) modelFields.add(key);
      }
    }

    // ------------------------------------------------------------
    // Scan templates for {{ field }} references
    // ------------------------------------------------------------
    const templateFiles = fs
      .readdirSync(templatesDir)
      .filter(f => f.endsWith(".html"));

    for (const file of templateFiles) {
      const full = path.join(templatesDir, file);
      const raw = fs.readFileSync(full, "utf8");

      let i = 0;
      while (i < raw.length) {
        const start = raw.indexOf("{{", i);
        if (start === -1) break;

        const end = raw.indexOf("}}", start + 2);
        if (end === -1) break;

        const expr = raw.slice(start + 2, end).trim();
        i = end + 2;

        // Skip helpers (#each, #if, /each, etc.)
        if (expr.startsWith("#") || expr.startsWith("/")) continue;

        // Skip empty expressions
        if (expr.length === 0) {
          issues.push({
            file: full,
            message: "Empty Handlebars expression {{ }}"
          });
          continue;
        }

        // Extract the first segment before any dot
        const dot = expr.indexOf(".");
        const rootField = dot === -1 ? expr : expr.slice(0, dot);

        // Validate identifier characters
        let valid = true;
        for (const ch of rootField) {
          const ok =
            (ch >= "a" && ch <= "z") ||
            (ch >= "A" && ch <= "Z") ||
            (ch >= "0" && ch <= "9") ||
            ch === "_" ||
            ch === "$";
          if (!ok) {
            valid = false;
            break;
          }
        }

        if (!valid) {
          issues.push({
            file: full,
            message: `Malformed field reference '{{${expr}}}'`
          });
          continue;
        }

        // Check against TypeScript model fields
        if (!modelFields.has(rootField)) {
          issues.push({
            file: full,
            message: `Unknown field root '${rootField}' in '{{${expr}}}'`
          });
        }
      }
    }

    // ------------------------------------------------------------
    // Report results
    // ------------------------------------------------------------
    if (issues.length > 0) {
      console.log("❌ validate-templates-fields found issues:\n");
      for (const issue of issues) {
        console.log(` - ${issue.file} → ${issue.message}`);
      }
      if (strict) throw new Error("Template field validation failed");
    } else {
      console.log("✔ validate-templates-fields passed");
    }
  } catch (err) {
    console.log("⚠ validate-templates-fields encountered an error");
    if (strict) throw err;
  }
}

// End of EQ5e Tool
